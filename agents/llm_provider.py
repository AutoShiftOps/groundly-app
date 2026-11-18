"""
Provider-neutral LLM call layer (unify/3-gemini). Every chat/structured
text-generation call in this codebase goes through structured_completion()
or text_completion() here -- no caller imports an AsyncOpenAI client or
the Gemini SDK directly. (agents/db.py's embeddings stay on OpenAI
directly and are untouched by this module -- every stored pgvector
embedding must keep coming from the same model, so provider choice
never applies to them.)

config.LLM_PROVIDER ("gemini" by default, or "openai") picks which
provider is tried FIRST. On a Gemini quota/429/5xx/timeout -- or a
missing GEMINI_API_KEY, treated the same way -- the call is retried
once on Gemini, then made with OpenAI instead. Never falls back to
canned content: if both providers fail, the exception propagates and
the caller's own existing "never default to a false success" handling
takes over (verified=False, a null framework result, etc.), exactly as
it already does for an OpenAI-only failure today. When LLM_PROVIDER is
explicitly "openai", Gemini is never attempted at all.

Every call returns (result, provider_used) where provider_used is
"gemini" or "openai" for THAT call -- never "mixed"; a per-request
aggregate across several calls is for the caller to compute.
"""

import json
import logging

from agents import config
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

_openai_client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
_genai_client = None

# One retry on Gemini before falling back to OpenAI -- not a generic
# retry loop; this module only ever tries Gemini at most twice (second
# attempt) and OpenAI at most once per structured_completion/
# text_completion call.
_GEMINI_MAX_ATTEMPTS = 2


def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        from google import genai
        _genai_client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _genai_client


_GEMINI_TYPE_MAP = {
    "string": "STRING", "number": "NUMBER", "integer": "INTEGER",
    "boolean": "BOOLEAN", "array": "ARRAY", "object": "OBJECT",
}


def json_schema_to_gemini(schema):
    """Converts an OpenAI-style strict JSON schema (nullable expressed
    as "type": ["string", "null"] or "anyOf": [{...}, {"type": "null"}],
    plus "additionalProperties": False) into Gemini's response_schema
    shape: type is one of Gemini's Type enum strings, nullable is a
    sibling boolean instead of a union type, and additionalProperties
    is dropped (Gemini's schema has no equivalent -- it's always
    effectively closed to the declared properties)."""
    if not isinstance(schema, dict):
        return schema

    if "anyOf" in schema:
        variants = schema["anyOf"]
        non_null = [v for v in variants if v.get("type") != "null"]
        has_null = any(v.get("type") == "null" for v in variants)
        # Every anyOf in this codebase's schemas is exactly one real
        # variant plus {"type": "null"} (an optional object field) --
        # a real union of two differently-shaped objects never occurs,
        # so taking the first non-null variant is never a lossy choice
        # here, only a defensive fallback if that ever changes.
        converted = json_schema_to_gemini(non_null[0]) if non_null else {"type": "STRING"}
        if has_null:
            converted["nullable"] = True
        return converted

    result = {}
    node_type = schema.get("type")
    if isinstance(node_type, list):
        non_null_types = [t for t in node_type if t != "null"]
        if non_null_types:
            result["type"] = _GEMINI_TYPE_MAP.get(non_null_types[0], non_null_types[0].upper())
        if "null" in node_type:
            result["nullable"] = True
    elif isinstance(node_type, str):
        result["type"] = _GEMINI_TYPE_MAP.get(node_type, node_type.upper())

    if "enum" in schema:
        result["enum"] = schema["enum"]
    if "description" in schema:
        result["description"] = schema["description"]
    if "properties" in schema:
        result["properties"] = {k: json_schema_to_gemini(v) for k, v in schema["properties"].items()}
    if "required" in schema:
        result["required"] = schema["required"]
    if "items" in schema:
        result["items"] = json_schema_to_gemini(schema["items"])
    return result


async def _gemini_structured_call(system_prompt, user_content, schema, temperature):
    from google.genai import types
    client = _get_genai_client()
    response = await client.aio.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=json_schema_to_gemini(schema),
            temperature=temperature,
        ),
    )
    return json.loads(response.text)


async def _gemini_text_call(system_prompt, user_content, temperature):
    client = _get_genai_client()
    response = await client.aio.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=user_content,
        config={"system_instruction": system_prompt, "temperature": temperature},
    )
    return response.text


async def _openai_structured_call(model, system_prompt, user_content, schema_name, schema, temperature):
    completion = await _openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": schema_name, "strict": True, "schema": schema},
        },
        temperature=temperature,
    )
    return json.loads(completion.choices[0].message.content)


async def _openai_text_call(model, system_prompt, user_content, temperature):
    completion = await _openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
    )
    return completion.choices[0].message.content


async def structured_completion(
    model: str, system_prompt: str, user_content: str, schema_name: str, schema: dict,
    temperature: float = 0,
) -> tuple[dict, str]:
    """Runs one structured-JSON call and returns (parsed_dict,
    provider_used). `model` is the OpenAI model name used only when
    the OpenAI path actually runs (first choice, or fallback) --
    Gemini always uses config.GEMINI_MODEL, never this argument, so
    Gemini's model name stays env-configurable independent of what
    any given caller historically hardcoded for OpenAI.

    Raises only if every attempt across both providers fails -- the
    caller's existing failure handling (verified=False, a null
    framework result, etc.) takes over from there, exactly as it did
    when this module only ever called OpenAI."""
    if config.LLM_PROVIDER == "gemini":
        last_error = None
        for attempt in range(_GEMINI_MAX_ATTEMPTS):
            try:
                return await _gemini_structured_call(system_prompt, user_content, schema, temperature), "gemini"
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "llm_provider: Gemini structured call failed (attempt %d/%d): %s",
                    attempt + 1, _GEMINI_MAX_ATTEMPTS, exc,
                )
        logger.warning("llm_provider: Gemini exhausted, falling back to OpenAI. Last error: %s", last_error)

    parsed = await _openai_structured_call(model, system_prompt, user_content, schema_name, schema, temperature)
    return parsed, "openai"


async def text_completion(
    model: str, system_prompt: str, user_content: str, temperature: float = 0.2,
) -> tuple[str, str]:
    """Same provider selection/fallback as structured_completion, for a
    plain (non-schema) text completion. Returns (text, provider_used)."""
    if config.LLM_PROVIDER == "gemini":
        last_error = None
        for attempt in range(_GEMINI_MAX_ATTEMPTS):
            try:
                return await _gemini_text_call(system_prompt, user_content, temperature), "gemini"
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "llm_provider: Gemini text call failed (attempt %d/%d): %s",
                    attempt + 1, _GEMINI_MAX_ATTEMPTS, exc,
                )
        logger.warning("llm_provider: Gemini exhausted, falling back to OpenAI. Last error: %s", last_error)

    text = await _openai_text_call(model, system_prompt, user_content, temperature)
    return text, "openai"


async def google_search_grounding_urls(query: str, max_results: int = 5) -> list[tuple[str, str]]:
    """One Gemini call with the Google Search grounding tool enabled.
    Returns [(url, title), ...] from the response's groundingChunks --
    NEVER the grounded text/snippet itself. Callers (agents/
    web_retrieval.py) must fetch each URL's real page and ingest it
    through the normal chunk/embed/store path; a citation must always
    point at a stored, re-searchable chunk the verifier can check, and
    groundingMetadata's own snippet text is not that. Raises on
    failure -- the caller decides how to degrade (same "never fake a
    result" discipline as every other call in this module)."""
    from google.genai import types
    client = _get_genai_client()
    response = await client.aio.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=query,
        config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
    )
    candidates = response.candidates or []
    if not candidates:
        return []
    grounding_metadata = getattr(candidates[0], "grounding_metadata", None)
    chunks = getattr(grounding_metadata, "grounding_chunks", None) or []
    urls: list[tuple[str, str]] = []
    for chunk in chunks[:max_results]:
        web = getattr(chunk, "web", None)
        uri = getattr(web, "uri", None) if web else None
        if uri:
            urls.append((uri, getattr(web, "title", None) or uri))
    return urls


def overall_provider(provider_uses: list) -> str:
    """Reduces a list of per-call provider_used values to one summary:
    "gemini" or "openai" if every call used the same one, "mixed"
    otherwise (e.g. a framework that fell back to OpenAI mid-request
    while others stayed on Gemini). Empty input -> "openai" (the
    always-available baseline)."""
    distinct = set(provider_uses)
    if not distinct:
        return "openai"
    if len(distinct) == 1:
        return distinct.pop()
    return "mixed"

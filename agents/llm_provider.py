"""
Provider-neutral LLM call layer (unify/3-gemini). Every chat/structured
text-generation call in this codebase goes through structured_completion()
or text_completion() here -- no caller imports an AsyncOpenAI client or
the Gemini SDK directly. (agents/db.py's embeddings stay on OpenAI
directly and are untouched by this module -- every stored pgvector
embedding must keep coming from the same model, so provider choice
never applies to them.)

config.LLM_PROVIDER ("gemini" by default, or "openai") picks which
provider is tried FIRST. Every Gemini call is bounded by
GEMINI_TIMEOUT_SECONDS. A 429, 5xx, timeout or network error gets one
retry on Gemini; any other error (invalid/missing key, 400/401/403/404/
409) goes straight to OpenAI. A circuit breaker skips Gemini entirely
for GEMINI_COOLDOWN_SECONDS after an auth/key/model-not-found error or
3 consecutive Gemini failures. Never falls back to canned content: if
both providers fail, the exception propagates and the caller's own
existing "never default to a false success" handling takes over
(verified=False, a null framework result, etc.), exactly as it already
does for an OpenAI-only failure today. When LLM_PROVIDER is explicitly
"openai", Gemini is never attempted at all.

Every call returns (result, provider_used) where provider_used is
"gemini" or "openai" for THAT call -- never "mixed"; a per-request
aggregate across several calls is for the caller to compute.
"""

import asyncio
import json
import logging
import time

import httpx
from agents import config
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

_openai_client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
_genai_client = None

# One retry on Gemini before falling back to OpenAI, and only for
# transient errors -- this module tries Gemini at most twice and OpenAI
# at most once per structured_completion/text_completion call.
_GEMINI_MAX_ATTEMPTS = 2
_BREAKER_FAILURE_THRESHOLD = 3


class GeminiUnavailable(Exception):
    """Gemini is skipped (circuit breaker open) or not configured."""


def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        if not config.GEMINI_API_KEY:
            raise GeminiUnavailable("GEMINI_API_KEY is not set")
        from google import genai
        _genai_client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _genai_client


# --- Error classification -------------------------------------------------
# "fatal": Gemini can't work at all (bad/missing key, auth, unknown model) --
#          skip the retry AND open the breaker immediately.
# "permanent": this request won't succeed on retry (400, 409, other 4xx,
#          unparseable output) -- skip the retry, count toward the breaker.
# "transient": 429, 5xx, timeouts, network errors -- one retry.

def _classify(exc: BaseException) -> str:
    if isinstance(exc, GeminiUnavailable):
        return "fatal"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, httpx.TransportError, ConnectionError)):
        return "transient"
    try:
        from google.genai import errors as genai_errors
    except ImportError:  # SDK missing entirely -- Gemini can't be used.
        return "fatal"
    if isinstance(exc, ValueError) and "API key" in str(exc):
        return "fatal"
    if isinstance(exc, genai_errors.APIError):
        code = exc.code or 0
        details = f"{exc.message or ''} {exc.details or ''}"
        if code in (401, 403, 404) or "API_KEY_INVALID" in details or "API key not valid" in details:
            return "fatal"
        if code == 429 or code >= 500:
            return "transient"
        return "permanent"
    return "permanent"


# --- Circuit breaker (process-local) ---------------------------------------

_now = time.monotonic
_breaker_open_until = 0.0
_consecutive_failures = 0


def _gemini_allowed() -> bool:
    """False while the breaker is open. Closes it (logging once) when the
    cooldown has passed, so the next call tries Gemini again."""
    global _breaker_open_until, _consecutive_failures
    if not _breaker_open_until:
        return True
    if _now() < _breaker_open_until:
        return False
    _breaker_open_until = 0.0
    _consecutive_failures = 0
    logger.warning("llm_provider: Gemini circuit breaker closed -- trying Gemini again.")
    return True


def _open_breaker(reason: str) -> None:
    global _breaker_open_until
    if _breaker_open_until:
        return  # already open (concurrent calls failing together) -- log once
    _breaker_open_until = _now() + config.GEMINI_COOLDOWN_SECONDS
    logger.warning(
        "llm_provider: Gemini circuit breaker OPEN for %ds -- every call goes straight to OpenAI. Reason: %s",
        config.GEMINI_COOLDOWN_SECONDS, reason,
    )


def _record_success() -> None:
    global _consecutive_failures
    _consecutive_failures = 0


def _record_failure(exc: BaseException, kind: str) -> None:
    global _consecutive_failures
    _consecutive_failures += 1
    if kind == "fatal":
        _open_breaker(f"{type(exc).__name__}: {exc}")
    elif _consecutive_failures >= _BREAKER_FAILURE_THRESHOLD:
        _open_breaker(f"{_consecutive_failures} consecutive failures, last: {type(exc).__name__}: {exc}")


def gemini_available() -> bool:
    """True when Gemini is configured and the circuit breaker is closed."""
    return config.LLM_PROVIDER == "gemini" and bool(config.GEMINI_API_KEY) and _gemini_allowed()


def reset_breaker() -> None:
    global _breaker_open_until, _consecutive_failures
    _breaker_open_until = 0.0
    _consecutive_failures = 0


def provider_status() -> dict:
    """For /health: what's configured, what calls are actually using right
    now, and whether the breaker is open (with seconds left)."""
    remaining = max(0.0, _breaker_open_until - _now()) if _breaker_open_until else 0.0
    breaker_open = remaining > 0
    gemini_usable = config.LLM_PROVIDER == "gemini" and bool(config.GEMINI_API_KEY) and not breaker_open
    return {
        "llm_provider_configured": config.LLM_PROVIDER,
        "llm_provider_active": "gemini" if gemini_usable else "openai",
        "gemini_breaker_open": breaker_open,
        "gemini_breaker_seconds_remaining": round(remaining),
    }


async def _run_gemini(label: str, make_call):
    """Runs one Gemini call (with timeout, one retry for transient errors,
    breaker bookkeeping). Returns the result, or raises the last error /
    GeminiUnavailable so the caller falls back to OpenAI."""
    if not _gemini_allowed():
        raise GeminiUnavailable("circuit breaker open")
    last_error: BaseException | None = None
    for attempt in range(_GEMINI_MAX_ATTEMPTS):
        try:
            result = await asyncio.wait_for(make_call(), timeout=config.GEMINI_TIMEOUT_SECONDS)
        except Exception as exc:
            kind = _classify(exc)
            last_error = exc
            _record_failure(exc, kind)
            logger.info(
                "llm_provider: Gemini %s call failed (attempt %d/%d, %s): %s",
                label, attempt + 1, _GEMINI_MAX_ATTEMPTS, kind, exc or type(exc).__name__,
            )
            if kind != "transient" or not _gemini_allowed():
                break
            continue
        _record_success()
        return result
    raise last_error


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
        try:
            parsed = await _run_gemini(
                "structured",
                lambda: _gemini_structured_call(system_prompt, user_content, schema, temperature),
            )
            return parsed, "gemini"
        except Exception as exc:
            logger.info("llm_provider: using OpenAI for structured call (%s)", exc or type(exc).__name__)

    parsed = await _openai_structured_call(model, system_prompt, user_content, schema_name, schema, temperature)
    return parsed, "openai"


async def text_completion(
    model: str, system_prompt: str, user_content: str, temperature: float = 0.2,
) -> tuple[str, str]:
    """Same provider selection/fallback as structured_completion, for a
    plain (non-schema) text completion. Returns (text, provider_used)."""
    if config.LLM_PROVIDER == "gemini":
        try:
            text = await _run_gemini(
                "text", lambda: _gemini_text_call(system_prompt, user_content, temperature),
            )
            return text, "gemini"
        except Exception as exc:
            logger.info("llm_provider: using OpenAI for text call (%s)", exc or type(exc).__name__)

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
    result" discipline as every other call in this module). Shares the
    timeout and circuit breaker with the other Gemini calls but has no
    retry and no OpenAI equivalent; raises GeminiUnavailable while the
    breaker is open."""
    from google.genai import types

    async def call():
        client = _get_genai_client()
        return await client.aio.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=query,
            config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
        )

    if not _gemini_allowed():
        raise GeminiUnavailable("circuit breaker open")
    try:
        response = await asyncio.wait_for(call(), timeout=config.GEMINI_TIMEOUT_SECONDS)
    except Exception as exc:
        _record_failure(exc, _classify(exc))
        raise
    _record_success()
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

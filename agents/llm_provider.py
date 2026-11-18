"""
Small provider-neutral structured-completion call, used by
agents/claim_verifier.py (and anywhere else that wants one strict-JSON
LLM call without caring which vendor answers it). Only OpenAI is wired
up today; a later PR adds a Gemini branch behind this exact same
`structured_completion()` call shape, selected by config rather than
by changing any caller.
"""

import json

from agents import config
from openai import AsyncOpenAI

_openai_client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)


async def structured_completion(
    model: str, system_prompt: str, user_content: str, schema_name: str, schema: dict,
    temperature: float = 0,
) -> dict:
    """Runs one structured-JSON chat completion and returns the parsed
    object. Raises on any failure (network, non-JSON response, schema
    violation) -- callers decide how to degrade, this never swallows an
    error into a fake success."""
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

"""
LlmProxyView — SPORT Backend LLM Proxy
Routes OpenAI-compatible LLM requests through the backend server
to prevent API key exposure in the mobile client bundle.

T02 Emergency Lockdown:
- Out of RC: endpoint returns 404 by default (outside home lab / when not enabled).
- Client cannot supply custom base_url / apiUrl (prevents SSRF / open proxy abuse).
- Server configuration is read dynamically from environment.
"""

import json
import logging
import os

import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

FORBIDDEN_CLIENT_URL_KEYS = ("base_url", "baseurl", "api_url", "apiurl", "url")


def is_llm_proxy_enabled() -> bool:
    """Returns True if LLM proxy is enabled via environment (e.g. in home lab)."""
    return (
        os.getenv("ENABLE_LLM_PROXY", "0").strip().lower() in ("1", "true", "yes", "on")
        or os.getenv("LLM_PROXY_ENABLED", "0").strip().lower() in ("1", "true", "yes", "on")
        or os.getenv("HOME_LAB", "0").strip().lower() in ("1", "true", "yes", "on")
    )


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def llm_proxy(request):
    """
    POST /api/llm/proxy/
    Body: { "messages": [...], "model": "gpt-4o-mini", "max_tokens": 80, "temperature": 0.9 }

    Proxies the request to the configured LLM API.
    The API key NEVER leaves the server.
    """
    if not is_llm_proxy_enabled():
        return JsonResponse({"error": "LLM proxy is disabled"}, status=404)

    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("[LlmProxy] No OPENAI_API_KEY configured")
        return JsonResponse(
            {"error": "LLM not configured on server"},
            status=503,
        )

    try:
        body = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if not isinstance(body, dict):
        return JsonResponse({"error": "Invalid JSON object"}, status=400)

    for key in body:
        if key.lower() in FORBIDDEN_CLIENT_URL_KEYS:
            return JsonResponse({"error": "Custom base_url is not allowed"}, status=400)

    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        return JsonResponse({"error": 'Missing or invalid "messages" field'}, status=400)

    api_url = os.environ.get("LLM_API_URL", "https://api.openai.com/v1").rstrip("/")
    default_model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    try:
        timeout_ms = int(os.environ.get("LLM_TIMEOUT_MS", "5000"))
    except (ValueError, TypeError):
        timeout_ms = 5000

    model = body.get("model", default_model)
    max_tokens = body.get("max_tokens", 80)
    temperature = body.get("temperature", 0.9)

    try:
        response = requests.post(
            f"{api_url}/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout_ms / 1000.0,
        )
        response.raise_for_status()
        return JsonResponse(response.json())

    except requests.exceptions.Timeout:
        logger.warning(f"[LlmProxy] LLM timeout after {timeout_ms}ms")
        return JsonResponse(
            {"error": f"LLM request timed out after {timeout_ms}ms"},
            status=504,
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"[LlmProxy] LLM request failed: {e}")
        return JsonResponse(
            {"error": "LLM service unavailable"},
            status=502,
        )

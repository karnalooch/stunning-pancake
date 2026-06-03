"""
LlmProxyView — SPORT Backend LLM Proxy
Routes OpenAI-compatible LLM requests through the backend server
to prevent API key exposure in the mobile client bundle.
"""

import os
import json
import logging
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings

logger = logging.getLogger(__name__)

LLM_API_KEY = os.environ.get("OPENAI_API_KEY", "")
LLM_API_URL = os.environ.get("LLM_API_URL", "https://api.openai.com/v1")
LLM_DEFAULT_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
LLM_TIMEOUT_MS = int(os.environ.get("LLM_TIMEOUT_MS", "5000"))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def llm_proxy(request):
    """
    POST /api/llm/proxy/
    Body: { "messages": [...], "model": "gpt-4o-mini", "max_tokens": 80, "temperature": 0.9 }

    Proxies the request to the configured LLM API.
    The API key NEVER leaves the server.
    """
    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    if not LLM_API_KEY:
        logger.warning("[LlmProxy] No OPENAI_API_KEY configured")
        return JsonResponse(
            {"error": "LLM not configured on server"},
            status=503,
        )

    try:
        body = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        return JsonResponse({"error": 'Missing or invalid "messages" field'}, status=400)

    model = body.get("model", LLM_DEFAULT_MODEL)
    max_tokens = body.get("max_tokens", 80)
    temperature = body.get("temperature", 0.9)

    try:
        response = requests.post(
            f"{LLM_API_URL}/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=LLM_TIMEOUT_MS / 1000.0,
        )
        response.raise_for_status()
        return JsonResponse(response.json())

    except requests.exceptions.Timeout:
        logger.warning(f"[LlmProxy] LLM timeout after {LLM_TIMEOUT_MS}ms")
        return JsonResponse(
            {"error": f"LLM request timed out after {LLM_TIMEOUT_MS}ms"},
            status=504,
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"[LlmProxy] LLM request failed: {e}")
        return JsonResponse(
            {"error": "LLM service unavailable"},
            status=502,
        )

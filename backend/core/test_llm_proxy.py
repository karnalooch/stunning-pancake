"""Tests for LLM proxy emergency lockdown (T02)."""

import json
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, SimpleTestCase

from core.llm_proxy import llm_proxy


class LlmProxyLockdownTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_default_disabled_returns_404(self):
        with patch.dict("os.environ", {}, clear=True):
            req = self.factory.post(
                "/api/llm/proxy/",
                data=json.dumps({"messages": [{"role": "user", "content": "hi"}]}),
                content_type="application/json",
            )
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 404)
            data = json.loads(resp.content.decode("utf-8"))
            self.assertIn("error", data)

    def test_options_when_disabled_returns_404(self):
        with patch.dict("os.environ", {}, clear=True):
            req = self.factory.options("/api/llm/proxy/")
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 404)

    def test_options_when_enabled_returns_cors_headers(self):
        with patch.dict("os.environ", {"ENABLE_LLM_PROXY": "1"}):
            req = self.factory.options("/api/llm/proxy/")
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp["Access-Control-Allow-Origin"], "*")

    def test_client_custom_base_url_rejected(self):
        with patch.dict("os.environ", {"ENABLE_LLM_PROXY": "1", "OPENAI_API_KEY": "sk-test"}):
            for forbidden_key in ("base_url", "apiUrl", "url"):
                req = self.factory.post(
                    "/api/llm/proxy/",
                    data=json.dumps(
                        {
                            "messages": [{"role": "user", "content": "hi"}],
                            forbidden_key: "https://malicious.site/v1",
                        }
                    ),
                    content_type="application/json",
                )
                resp = llm_proxy(req)
                self.assertEqual(resp.status_code, 400)
                data = json.loads(resp.content.decode("utf-8"))
                self.assertIn("base_url", data["error"].lower())

    def test_enabled_without_api_key_returns_503(self):
        with patch.dict("os.environ", {"ENABLE_LLM_PROXY": "1", "OPENAI_API_KEY": ""}):
            req = self.factory.post(
                "/api/llm/proxy/",
                data=json.dumps({"messages": [{"role": "user", "content": "hi"}]}),
                content_type="application/json",
            )
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 503)

    def test_invalid_json_returns_400(self):
        with patch.dict("os.environ", {"ENABLE_LLM_PROXY": "1", "OPENAI_API_KEY": "sk-test"}):
            req = self.factory.post(
                "/api/llm/proxy/",
                data="not valid json",
                content_type="application/json",
            )
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 400)

    def test_missing_messages_returns_400(self):
        with patch.dict("os.environ", {"ENABLE_LLM_PROXY": "1", "OPENAI_API_KEY": "sk-test"}):
            req = self.factory.post(
                "/api/llm/proxy/",
                data=json.dumps({"model": "gpt-4o-mini"}),
                content_type="application/json",
            )
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 400)

    @patch("core.llm_proxy.requests.post")
    def test_valid_request_proxies_to_server_url(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"choices": [{"message": {"content": "Dasz radę!"}}]}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        with patch.dict(
            "os.environ",
            {
                "ENABLE_LLM_PROXY": "1",
                "OPENAI_API_KEY": "sk-server-secret",
                "LLM_API_URL": "https://api.openai.com/v1",
            },
        ):
            req = self.factory.post(
                "/api/llm/proxy/",
                data=json.dumps({"messages": [{"role": "user", "content": "Zmotywuj mnie"}]}),
                content_type="application/json",
            )
            resp = llm_proxy(req)
            self.assertEqual(resp.status_code, 200)
            mock_post.assert_called_once()
            call_url = mock_post.call_args[0][0]
            self.assertEqual(call_url, "https://api.openai.com/v1/chat/completions")
            call_headers = mock_post.call_args[1]["headers"]
            self.assertEqual(call_headers["Authorization"], "Bearer sk-server-secret")

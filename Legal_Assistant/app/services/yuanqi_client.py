import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings
from app.core.exceptions import AppError


class YuanqiClient:
    """腾讯元器 OpenAPI 客户端（/openapi/v1/agent/chat/completions）。"""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.yuanqi_timeout_seconds),
            http2=settings.yuanqi_http2,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def _headers(self, api_key: str | None = None) -> dict[str, str]:
        key = api_key or self._settings.yuanqi_api_key
        if not key:
            raise AppError(
                "yuanqi_not_configured",
                "未配置腾讯元器 API Key（YUANQI_API_KEY 或 HUNYUAN_API_KEY）",
                status_code=503,
            )
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Source": "openapi",
        }

    async def chat_completions(
        self,
        *,
        assistant_id: str,
        user_id: str,
        messages: list[dict[str, Any]],
        stream: bool = False,
        custom_variables: dict[str, str] | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        if not assistant_id:
            raise AppError(
                "yuanqi_not_configured",
                "未配置智能体 assistant_id（YUANQI_ASSISTANT_ID 或场景专用 ID）",
                status_code=503,
            )
        payload: dict[str, Any] = {
            "assistant_id": assistant_id,
            "user_id": user_id,
            "stream": stream,
            "messages": messages,
        }
        if custom_variables:
            payload["custom_variables"] = custom_variables

        url = base_url or self._settings.yuanqi_base_url
        print(f"=== REQUEST DEBUG ===")
        print(f"URL: {url}")
        print(f"Headers: {self._headers(api_key=api_key)}")
        print(f"Payload: {payload}")
        print(f"===================")
        resp = await self._client.post(
            url,
            headers=self._headers(api_key=api_key),
            json=payload,
        )
        return self._parse_json_response(resp)

    async def chat_completions_stream(
        self,
        *,
        assistant_id: str,
        user_id: str,
        messages: list[dict[str, Any]],
        custom_variables: dict[str, str] | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
    ) -> httpx.Response:
        if not assistant_id:
            raise AppError(
                "yuanqi_not_configured",
                "未配置智能体 assistant_id（YUANQI_ASSISTANT_ID 或场景专用 ID）",
                status_code=503,
            )
        payload: dict[str, Any] = {
            "assistant_id": assistant_id,
            "user_id": user_id,
            "stream": True,
            "messages": messages,
        }
        if custom_variables:
            payload["custom_variables"] = custom_variables

        url = base_url or self._settings.yuanqi_base_url
        req = self._client.build_request(
            "POST",
            url,
            headers=self._headers(api_key=api_key),
            json=payload,
        )
        resp = await self._client.send(req, stream=True)
        if resp.status_code >= 400:
            try:
                body = (await resp.aread()).decode("utf-8", errors="replace")
            finally:
                await resp.aclose()
            raise AppError(
                "yuanqi_http_error",
                f"元器流式接口错误 HTTP {resp.status_code}",
                status_code=502,
                detail=body[:2000],
            )
        return resp

    def _parse_json_response(self, resp: httpx.Response) -> dict[str, Any]:
        if resp.status_code >= 400:
            raise AppError(
                "yuanqi_http_error",
                f"元器接口返回错误 HTTP {resp.status_code}",
                status_code=502,
                detail=_safe_json(resp),
            )
        try:
            return resp.json()
        except json.JSONDecodeError as e:
            raise AppError(
                "yuanqi_invalid_response",
                "元器返回非 JSON",
                status_code=502,
                detail=str(e),
            ) from e

    @staticmethod
    async def iter_stream_bytes(response: httpx.Response) -> AsyncIterator[bytes]:
        try:
            async for chunk in response.aiter_bytes():
                yield chunk
        finally:
            await response.aclose()


def _safe_json(resp: httpx.Response) -> Any:
    try:
        return resp.json()
    except Exception:
        return resp.text[:2000]


def extract_assistant_text(data: dict[str, Any]) -> str | None:
    choices = data.get("choices") or []
    if not choices:
        return None
    first = choices[0]
    msg = first.get("message") or {}
    content = msg.get("content")
    if isinstance(content, str):
        return content
    return None

import pytest
import respx
from httpx import AsyncClient, Response

from app.core.config import get_settings


@pytest.mark.asyncio
@respx.mock
async def test_chat_completions_non_stream(client: AsyncClient) -> None:
    settings = get_settings()
    respx.post(settings.yuanqi_base_url).mock(
        return_value=Response(
            200,
            json={
                "id": "rid",
                "created": "123",
                "assistant_id": "aid",
                "choices": [
                    {"message": {"role": "assistant", "content": "法律咨询回复"}}
                ],
            },
        )
    )
    r = await client.post(
        "/api/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "stream": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["content"] == "法律咨询回复"


@pytest.mark.asyncio
@respx.mock
async def test_chat_completions_stream(client: AsyncClient) -> None:
    settings = get_settings()
    body = 'data: {"choices":[{"delta":{"content":"\\u6d41"}}]}\n\n'.encode()
    respx.post(settings.yuanqi_base_url).mock(
        return_value=Response(
            200,
            content=body,
            headers={"Content-Type": "text/event-stream"},
        )
    )
    r = await client.post(
        "/api/v1/chat/completions",
        json={
            "messages": [{"role": "user", "content": "hi"}],
            "stream": True,
        },
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/event-stream")
    text = r.text
    assert "delta" in text


@pytest.mark.asyncio
@respx.mock
async def test_agent_chat_completions_non_stream(client: AsyncClient) -> None:
    settings = get_settings()
    respx.post(settings.yuanqi_base_url).mock(
        return_value=Response(
            200,
            json={
                "id": "rid",
                "created": "123",
                "assistant_id": "aid",
                "choices": [
                    {"message": {"role": "assistant", "content": "统一入口回复"}}
                ],
            },
        )
    )
    r = await client.post(
        "/api/v1/agent/chat/completions",
        json={
            "messages": [{"role": "user", "content": "你好"}],
            "stream": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["content"] == "统一入口回复"


@pytest.mark.asyncio
@respx.mock
async def test_contract_review_dialog_uses_dedicated_contract_review_agent(
    client: AsyncClient,
) -> None:
    settings = get_settings()
    settings.yuanqi_contract_review_base_url = (
        "https://yuanqi.tencent.com/openapi/v1/agent/chat/completions"
    )
    settings.yuanqi_contract_review_api_key = "test-contract-review-key"
    settings.yuanqi_assistant_contract_review = "test-contract-review-assistant"

    respx.post(settings.yuanqi_contract_review_base_url).mock(
        return_value=Response(
            200,
            json={
                "id": "rid",
                "created": "123",
                "assistant_id": "aid",
                "choices": [
                    {"message": {"role": "assistant", "content": "合同审查结果"}}
                ],
            },
        )
    )

    r = await client.post(
        "/api/v1/contracts/review/dialog",
        json={
            "messages": [{"role": "user", "content": "请审查这份合同"}],
            "stream": False,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["content"] == "合同审查结果"
    assert body["assistant_id"] == "aid"


@pytest.mark.asyncio
@respx.mock
async def test_clause_search_with_hunyuan_client(client: AsyncClient) -> None:
    settings = get_settings()
    settings.hunyuan_api_key = "test-hunyuan-key"
    settings.hunyuan_assistant_id = "test-assistant-id"
    respx.post(settings.hunyuan_base_url).mock(
        return_value=Response(
            200,
            json={
                "id": "rid",
                "created": "123",
                "assistant_id": "aid",
                "choices": [
                    {"message": {"role": "assistant", "content": "法条检索结果"}}
                ],
            },
        )
    )

    r = await client.post(
        "/api/v1/legal/clauses/search",
        json={"query": "劳动法第几条", "filters": "行政法"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["content"] == "法条检索结果"

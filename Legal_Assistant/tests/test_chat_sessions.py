import pytest
import respx
from httpx import AsyncClient, Response

from app.core.config import get_settings


@pytest.mark.asyncio
@respx.mock
async def test_chat_sessions_crud_and_chat_persist(client: AsyncClient) -> None:
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

    r = await client.post("/api/v1/chat/sessions", json={"tool_type": "chat"})
    assert r.status_code == 200
    body = r.json()
    sid = body["id"]
    assert body["title"] == "新对话"

    r2 = await client.post(
        "/api/v1/chat/completions",
        json={
            "session_id": sid,
            "messages": [{"role": "user", "content": "你好"}],
            "stream": False,
        },
    )
    assert r2.status_code == 200
    assert r2.json()["content"] == "法律咨询回复"

    r3 = await client.get(f"/api/v1/chat/sessions/{sid}/messages")
    assert r3.status_code == 200
    data = r3.json()
    assert data["total"] == 2
    assert data["items"][0]["role"] == "user"
    assert data["items"][1]["role"] == "assistant"
    assert data["items"][1]["content"] == "法律咨询回复"

    r4 = await client.get("/api/v1/chat/sessions")
    assert r4.status_code == 200
    assert r4.json()["total"] >= 1

    r5 = await client.delete(f"/api/v1/chat/sessions/{sid}")
    assert r5.status_code == 200


@pytest.mark.asyncio
async def test_chat_with_session_id_rejects_assistant_role_in_messages(client: AsyncClient) -> None:
    r = await client.post("/api/v1/chat/sessions", json={})
    assert r.status_code == 200
    sid = r.json()["id"]

    r2 = await client.post(
        "/api/v1/chat/completions",
        json={
            "session_id": sid,
            "messages": [{"role": "assistant", "content": "非法"}],
            "stream": False,
        },
    )
    assert r2.status_code == 400

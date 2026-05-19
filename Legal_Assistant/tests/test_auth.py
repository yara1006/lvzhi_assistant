import pytest
import respx
from httpx import ASGITransport, AsyncClient, Response

from app.core.config import get_settings
from app.main import create_app


@pytest.mark.asyncio
@respx.mock
async def test_api_key_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_KEY", "only-secret")
    get_settings.cache_clear()
    import app.db.session as db_session

    if db_session._engine is not None:
        await db_session._engine.dispose()
    db_session._engine = None
    db_session.SessionLocal = None

    app = create_app()
    settings = get_settings()
    respx.post(settings.yuanqi_base_url).mock(
        return_value=Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]},
        )
    )
    from app.db.base import Base
    from app.db.session import get_engine

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            r = await client.post(
                "/api/v1/chat/completions",
                json={"messages": [{"role": "user", "content": "x"}], "stream": False},
            )
            assert r.status_code == 401
            r2 = await client.post(
                "/api/v1/chat/completions",
                json={"messages": [{"role": "user", "content": "x"}], "stream": False},
                headers={"X-API-Key": "only-secret"},
            )
            assert r2.status_code != 401
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
        db_session._engine = None
        db_session.SessionLocal = None
        monkeypatch.delenv("API_KEY", raising=False)
        get_settings.cache_clear()


@pytest.mark.asyncio
@respx.mock
async def test_jwt_login_and_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    get_settings.cache_clear()
    import app.db.session as db_session

    if db_session._engine is not None:
        await db_session._engine.dispose()
    db_session._engine = None
    db_session.SessionLocal = None

    app = create_app()
    settings = get_settings()
    respx.post(settings.yuanqi_base_url).mock(
        return_value=Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]},
        )
    )
    from app.db.base import Base
    from app.db.session import get_engine

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            send_code = await client.post(
                "/api/v1/auth/send-code",
                json={"phone": "13800138000"},
            )
            assert send_code.status_code == 200
            code = send_code.json()["code"]
            assert code is not None

            login = await client.post(
                "/api/v1/auth/login",
                json={"phone": "13800138000", "code": code},
            )
            assert login.status_code == 200
            token = login.json()["access_token"]

            protected = await client.post(
                "/api/v1/chat/completions",
                json={"messages": [{"role": "user", "content": "x"}], "stream": False},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert protected.status_code == 200

            unauthorized = await client.post(
                "/api/v1/chat/completions",
                json={"messages": [{"role": "user", "content": "x"}], "stream": False},
            )
            assert unauthorized.status_code == 401

            logout = await client.post(
                "/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert logout.status_code == 200
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
        db_session._engine = None
        db_session.SessionLocal = None
        monkeypatch.delenv("JWT_SECRET", raising=False)
        get_settings.cache_clear()

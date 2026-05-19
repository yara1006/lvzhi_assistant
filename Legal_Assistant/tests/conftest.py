import os

# 必须在导入 app 之前设置，以便 session 与 Settings 使用测试库
os.environ["YUANQI_API_KEY"] = "test-yuanqi-key"
os.environ["YUANQI_ASSISTANT_ID"] = "test-assistant-id"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["API_KEY"] = ""
os.environ["JWT_SECRET"] = ""

from app.core.config import get_settings

get_settings.cache_clear()

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture(autouse=True)
async def db_schema() -> None:
    from app.db.base import Base
    from app.db.session import get_engine

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    import app.db.session as db_session

    db_session._engine = None
    db_session.SessionLocal = None


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

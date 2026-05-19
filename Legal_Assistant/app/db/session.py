from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings

_engine: AsyncEngine | None = None
SessionLocal: async_sessionmaker[AsyncSession] | None = None


def _ensure_engine() -> async_sessionmaker[AsyncSession]:
    global _engine, SessionLocal
    if SessionLocal is None:
        settings = get_settings()
        url = settings.database_url
        kwargs: dict[str, Any] = {"echo": settings.debug}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
            kwargs["poolclass"] = StaticPool
        else:
            kwargs["pool_pre_ping"] = True
        _engine = create_async_engine(url, **kwargs)
        SessionLocal = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return SessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    maker = _ensure_engine()
    async with maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_engine() -> AsyncEngine:
    _ensure_engine()
    assert _engine is not None
    return _engine

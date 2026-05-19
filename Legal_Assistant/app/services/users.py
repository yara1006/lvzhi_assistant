from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.user import User
from app.services.user_ids import normalize_user_id


async def get_or_create_user(session: AsyncSession, raw_user_id: str, settings: Settings) -> User:
    uid = normalize_user_id(raw_user_id, settings)
    result = await session.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(id=uid, nickname="用户", user_type="personal")
    session.add(user)
    await session.flush()
    return user

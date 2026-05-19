import uuid

from app.core.config import Settings


def normalize_user_id(raw: str, settings: Settings) -> str:
    """将 JWT sub / body 中的 user_id 转为 users.id（CHAR(36)）。"""
    if raw == "anonymous":
        return settings.anonymous_user_id
    try:
        uuid.UUID(raw)
        return raw
    except ValueError:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"user:{raw}"))

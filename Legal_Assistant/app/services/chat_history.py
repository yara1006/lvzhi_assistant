"""chat_sessions / chat_messages 的查询与落库（与元器 messages 上限对齐）。"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.db.models.chat_message import ChatMessage as ChatMessageRow
from app.db.models.chat_session import ChatSession
from app.schemas.common import ChatMessage as ChatMessageSchema

if TYPE_CHECKING:
    pass

YUANQI_MAX_MESSAGES = 40
TITLE_MAX_LEN = 22
DEFAULT_TITLE = "新对话"


def plain_text_from_message(msg: ChatMessageSchema) -> str:
    if isinstance(msg.content, str):
        return msg.content
    parts: list[str] = []
    for p in msg.content:
        if p.type == "text" and p.text:
            parts.append(p.text)
    return "\n".join(parts)


def tool_badge_from_session_tool_type(tool_type: str) -> str | None:
    if tool_type in ("law", "case", "contract", "review", "chat"): # 添加 "chat"
        return tool_type
    return None


async def get_chat_session_owned(
    db: AsyncSession, user_id: str, session_id: str
) -> ChatSession:
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id,
        )
    )
    row = r.scalar_one_or_none()
    if row is None:
        raise AppError(
            "session_not_found",
            "会话不存在或无权访问",
            status_code=404,
        )
    return row


async def load_messages_as_schemas(
    db: AsyncSession, session_id: str
) -> list[ChatMessageSchema]:
    r = await db.execute(
        select(ChatMessageRow)
        .where(ChatMessageRow.session_id == session_id)
        .order_by(ChatMessageRow.created_at.asc())
    )
    rows = r.scalars().all()
    return [
        ChatMessageSchema(role=m.role, content=m.content) for m in rows
    ]


def merge_for_yuanqi(
    existing: list[ChatMessageSchema],
    new_msgs: list[ChatMessageSchema],
) -> list[ChatMessageSchema]:
    merged = existing + new_msgs
    if len(merged) <= YUANQI_MAX_MESSAGES:
        return merged
    return merged[-YUANQI_MAX_MESSAGES:]


async def update_session_title_if_default(
    db: AsyncSession,
    session_row: ChatSession,
    first_message: str | None,
) -> None:
    """如果会话标题是默认值，则根据第一条消息更新标题。"""
    if session_row.title == DEFAULT_TITLE and first_message:
        raw = first_message.strip()
        if len(raw) > TITLE_MAX_LEN:
            session_row.title = raw[:TITLE_MAX_LEN] + "…"
        else:
            session_row.title = raw or DEFAULT_TITLE
    await db.flush() # 确保标题更新被持久化

async def persist_turn(
    db: AsyncSession,
    *,
    session_row: ChatSession,
    new_user_messages: list[ChatMessageSchema],
    assistant_text: str | None,
) -> None:
    first_user: str | None = None
    for m in new_user_messages:
        if m.role == "user":
            t = plain_text_from_message(m)
            if t:
                first_user = t
                break

    await update_session_title_if_default(db, session_row, first_user)

    badge = tool_badge_from_session_tool_type(session_row.tool_type)

    for m in new_user_messages:
        if m.role != "user":
            continue
        text = plain_text_from_message(m)
        db.add(
            ChatMessageRow(
                id=str(uuid.uuid4()),
                session_id=session_row.id,
                role="user",
                content=text,
                tool_badge=badge, # 使用 badge 变量
            )
        )

    if assistant_text:
        db.add(
            ChatMessageRow(
                id=str(uuid.uuid4()),
                session_id=session_row.id,
                role="assistant",
                content=assistant_text,
                tool_badge=badge,
            )
        )


async def count_messages(db: AsyncSession, session_id: str) -> int:
    r = await db.execute(
        select(sa_func.count())
        .select_from(ChatMessageRow)
        .where(ChatMessageRow.session_id == session_id)
    )
    return int(r.scalar_one() or 0)

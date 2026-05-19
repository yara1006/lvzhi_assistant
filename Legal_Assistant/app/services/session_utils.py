"""会话管理公共工具"""
import uuid
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat_session import ChatSession
from app.db.models.chat_message import ChatMessage as ChatMessageRow
from app.core.exceptions import AppError


async def ensure_session_owned(
    session: AsyncSession,
    user_uuid: str,
    session_id: str | None,
) -> None:
    """验证会话是否属于当前用户"""
    if not session_id:
        return
    r = await session.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user_uuid,
        )
    )
    if r.scalar_one_or_none() is None:
        raise AppError("invalid_session", "会话不存在或无权访问", status_code=403)


async def create_or_get_session(
    session: AsyncSession,
    user_id: str,
    session_id: Optional[str],
    title: str,
    tool_type: str,
) -> tuple[str, bool]:
    """
    创建或获取会话
    返回: (session_id, is_new)
    """
    is_new = False
    actual_session_id = session_id
    
    if not actual_session_id:
        actual_session_id = str(uuid.uuid4())
        new_session = ChatSession(
            id=actual_session_id,
            user_id=user_id,
            title=title[:50] if title else "新对话",
            tool_type=tool_type,
        )
        session.add(new_session)
        await session.flush()
        is_new = True
        print(f"自动创建会话: {actual_session_id}, tool_type={tool_type}")
    
    return actual_session_id, is_new


async def save_user_message(
    session: AsyncSession,
    session_id: str,
    content: str,
    tool_badge: str,
) -> None:
    """保存用户消息"""
    try:
        user_msg = ChatMessageRow(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role="user",
            content=content[:5000] if content else "",
            tool_badge=tool_badge,
        )
        session.add(user_msg)
        await session.flush()
    except Exception as e:
        print(f"保存用户消息失败: {e}")
        raise


async def save_assistant_message(
    session: AsyncSession,
    session_id: str,
    content: str,
    tool_badge: str,
) -> None:
    """保存 AI 回复消息"""
    try:
        assistant_msg = ChatMessageRow(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role="assistant",
            content=content,
            tool_badge=tool_badge,
        )
        session.add(assistant_msg)
        await session.flush()
    except Exception as e:
        print(f"保存AI回复失败: {e}")
        raise


async def update_session_title(
    session: AsyncSession,
    session_id: str,
    new_title: str,
) -> None:
    """更新会话标题"""
    try:
        await session.execute(
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(title=new_title[:50])
        )
        await session.flush()
        print(f"更新会话标题: {new_title[:50]}")
    except Exception as e:
        print(f"更新会话标题失败: {e}")

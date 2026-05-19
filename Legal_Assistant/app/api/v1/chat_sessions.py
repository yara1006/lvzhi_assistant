import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_service_auth, resolve_user_id
from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.db.models.chat_message import ChatMessage as ChatMessageRow
from app.db.models.chat_session import ChatSession
from app.db.session import get_db
from app.schemas.common import (
    ChatSessionCreate,
    ChatSessionItem,
    ChatSessionPatch,
    PaginatedChatMessages,
    PaginatedChatSessions,
    ChatMessageItem,
)
from app.services.users import get_or_create_user

router = APIRouter(prefix="/chat/sessions", tags=["chat-sessions"])


@router.get(
    "",
    dependencies=[Depends(require_service_auth)],
)
async def list_chat_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PaginatedChatSessions:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)

    total_r = await db.execute(
        select(sa_func.count()).select_from(ChatSession).where(ChatSession.user_id == user.id)
    )
    total = int(total_r.scalar_one() or 0)

    rows_r = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = rows_r.scalars().all()
    items: list[ChatSessionItem] = []
    for s in sessions:
        mc_r = await db.execute(
            select(sa_func.count())
            .select_from(ChatMessageRow)
            .where(ChatMessageRow.session_id == s.id)
        )
        mc = int(mc_r.scalar_one() or 0)
        items.append(
            ChatSessionItem(
                id=s.id,
                user_id=s.user_id,
                title=s.title,
                tool_type=s.tool_type,
                created_at=s.created_at,
                message_count=mc,
            )
        )
    return PaginatedChatSessions(total=total, items=items)


@router.post(
    "",
    dependencies=[Depends(require_service_auth)],
)
async def create_chat_session(
    body: ChatSessionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> ChatSessionItem:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)
    sid = str(uuid.uuid4())
    title = (body.title or "").strip() or "新对话"
    row = ChatSession(
        id=sid,
        user_id=user.id,
        title=title or "新对话",
        tool_type=body.tool_type,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)  # 添加这一行，刷新对象获取默认值
    return ChatSessionItem(
        id=row.id,
        user_id=row.user_id,
        title=row.title,
        tool_type=row.tool_type,
        created_at=row.created_at,
        message_count=0,
    )


@router.get(
    "/{session_id}",
    dependencies=[Depends(require_service_auth)],
)
async def get_chat_session(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> ChatSessionItem:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    s = r.scalar_one_or_none()
    if not s:
        raise AppError("session_not_found", "会话不存在或无权访问", status_code=404)
    mc_r = await db.execute(
        select(sa_func.count())
        .select_from(ChatMessageRow)
        .where(ChatMessageRow.session_id == s.id)
    )
    mc = int(mc_r.scalar_one() or 0)
    return ChatSessionItem(
        id=s.id,
        user_id=s.user_id,
        title=s.title,
        tool_type=s.tool_type,
        created_at=s.created_at,
        message_count=mc,
    )


@router.patch(
    "/{session_id}",
    dependencies=[Depends(require_service_auth)],
)
async def patch_chat_session(
    session_id: str,
    body: ChatSessionPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> ChatSessionItem:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    s = r.scalar_one_or_none()
    if not s:
        raise AppError("session_not_found", "会话不存在或无权访问", status_code=404)
    if body.title is not None:
        t = body.title.strip()
        if t:
            s.title = t
    if body.tool_type is not None:
        s.tool_type = body.tool_type
    await db.flush()
    mc_r = await db.execute(
        select(sa_func.count())
        .select_from(ChatMessageRow)
        .where(ChatMessageRow.session_id == s.id)
    )
    mc = int(mc_r.scalar_one() or 0)
    return ChatSessionItem(
        id=s.id,
        user_id=s.user_id,
        title=s.title,
        tool_type=s.tool_type,
        created_at=s.created_at,
        message_count=mc,
    )


@router.delete(
    "/{session_id}",
    dependencies=[Depends(require_service_auth)],
)
async def delete_chat_session(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    s = r.scalar_one_or_none()
    if not s:
        raise AppError("session_not_found", "会话不存在或无权访问", status_code=404)
    await db.delete(s)
    return {"message": "deleted"}


@router.get(
    "/{session_id}/messages",
    dependencies=[Depends(require_service_auth)],
)
async def list_chat_messages(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedChatMessages:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    if r.scalar_one_or_none() is None:
        raise AppError("session_not_found", "会话不存在或无权访问", status_code=404)

    total_r = await db.execute(
        select(sa_func.count())
        .select_from(ChatMessageRow)
        .where(ChatMessageRow.session_id == session_id)
    )
    total = int(total_r.scalar_one() or 0)

    msg_r = await db.execute(
        select(ChatMessageRow)
        .where(ChatMessageRow.session_id == session_id)
        .order_by(ChatMessageRow.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = msg_r.scalars().all()
    items = [
        ChatMessageItem(
            id=m.id,
            session_id=m.session_id,
            role=m.role,
            content=m.content,
            tool_badge=m.tool_badge,
            created_at=m.created_at,
        )
        for m in rows
    ]
    return PaginatedChatMessages(total=total, items=items)


from app.schemas.common import ChatMessageCreate

@router.post("/{session_id}/messages", dependencies=[Depends(require_service_auth)])
async def add_chat_message(
    session_id: str,
    body: ChatMessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> ChatMessageItem:
    uid = resolve_user_id(settings, authorization, None)
    user = await get_or_create_user(db, uid, settings)
    
    # 验证会话是否存在且属于当前用户
    r = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        )
    )
    session = r.scalar_one_or_none()
    if not session:
        raise AppError("session_not_found", "会话不存在或无权访问", status_code=404)
    
    # 创建消息
    message_id = str(uuid.uuid4())
    message = ChatMessageRow(
        id=message_id,
        session_id=session_id,
        role=body.role,
        content=body.content,
        tool_badge=body.tool_badge,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)  # 添加这一行，刷新获取默认值
    
    return ChatMessageItem(
        id=message.id,
        session_id=message.session_id,
        role=message.role,
        content=message.content,
        tool_badge=message.tool_badge,
        created_at=message.created_at,
    )
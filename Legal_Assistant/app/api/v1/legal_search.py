import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_yuanqi_client, require_service_auth, resolve_user_id
from app.services.yuanqi_client import YuanqiClient
from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.db.models.chat_session import ChatSession
from app.db.models.chat_message import ChatMessage as ChatMessageRow
from app.db.session import get_db
from app.schemas.common import ChatCompletionResponse, ClauseSearchRequest
from app.services.conversation import build_user_message
from app.services.users import get_or_create_user
from app.services.chat_history import update_session_title_if_default # 导入新的函数

router = APIRouter(prefix="/legal", tags=["legal"])


async def _ensure_session_owned(
    session: AsyncSession,
    user_uuid: str,
    session_id: str | None,
) -> None:
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


@router.post("/clauses/search", dependencies=[Depends(require_service_auth)])
async def clause_search(
    body: ClauseSearchRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[YuanqiClient, Depends(get_yuanqi_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> ChatCompletionResponse:
    uid = resolve_user_id(settings, authorization, body.user_id)
    user = await get_or_create_user(session, uid, settings)
    
    # 自动创建会话（如果没有传入 session_id）
    actual_session_id = body.session_id
    session_row = None # 用于传递给 update_session_title_if_default
    if not actual_session_id:
        actual_session_id = str(uuid.uuid4())
        title = body.query[:50] if body.query else "法条检索"
        new_session = ChatSession(
            id=actual_session_id,
            user_id=user.id,
            title=title,
            tool_type="law",
        )
        session.add(new_session)
        await session.flush()
        session_row = new_session
        print(f"自动创建法条检索会话: {actual_session_id}")
    else:
        session_row = await _ensure_session_owned(session, user.id, actual_session_id) # 获取现有会话
    
    # await _ensure_session_owned(session, user.id, actual_session_id) # 这一行不再需要

    # 判断使用哪个智能体配置
    if settings.hunyuan_assistant_id:
        assistant_id = settings.hunyuan_assistant_id_for("clause_search")
        base_url = settings.hunyuan_base_url
        api_key = settings.hunyuan_api_key
    else:
        assistant_id = settings.assistant_id_for("clause_search")
        base_url = None
        api_key = None

    prompt = (
        "请根据用户问题进行法律条款检索与说明，尽量引用可核对来源；用户问题：\n"
        f"{body.query}"
    )
    messages = build_user_message(prompt)

    # 合并自定义变量
    custom = body.custom_variables
    if body.filters:
        if custom is None:
            custom = {}
        custom["filters"] = body.filters

    # 保存用户消息
    user_msg = ChatMessageRow(
        id=str(uuid.uuid4()),
        session_id=actual_session_id,
        role="user",
        content=body.query,
        tool_badge="law",
    )
    session.add(user_msg)
    await session.flush()

    # 更新会话标题（如果需要）
    if session_row:
        await update_session_title_if_default(session, session_row, body.query)
        await session.flush() # 确保标题更新被持久化

    data = await client.chat_completions(
        assistant_id=assistant_id,
        user_id=uid,
        messages=messages,
        stream=False,
        custom_variables=custom,
        base_url=base_url,
        api_key=api_key,
    )
    text = extract_assistant_text(data)
    
    # 保存 AI 回复
    assistant_msg = ChatMessageRow(
        id=str(uuid.uuid4()),
        session_id=actual_session_id,
        role="assistant",
        content=text,
        tool_badge="law",
    )
    session.add(assistant_msg)
    await session.commit()

    return ChatCompletionResponse(
        id=data.get("id"),
        created=str(data.get("created")) if data.get("created") is not None else None,
        assistant_id=data.get("assistant_id"),
        content=text,
        raw=data if settings.debug else None,
    )

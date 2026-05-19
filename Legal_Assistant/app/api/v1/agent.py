from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_yuanqi_client, require_service_auth
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.common import ChatCompletionRequest, ChatCompletionResponse
from app.services.chat_completion_handler import handle_yuanqi_chat_completion
from app.services.yuanqi_client import YuanqiClient

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post(
    "/chat/completions",
    dependencies=[Depends(require_service_auth)],
    response_model=None,
)
async def agent_chat_completions(
    body: ChatCompletionRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[YuanqiClient, Depends(get_yuanqi_client)],
    db: Annotated[AsyncSession, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> ChatCompletionResponse | StreamingResponse:
    return await handle_yuanqi_chat_completion(
        body=body,
        settings=settings,
        client=client,
        db=db,
        authorization=authorization,
    )

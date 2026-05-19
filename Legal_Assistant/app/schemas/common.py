from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    detail: Any = None


class MessagePart(BaseModel):
    type: str = "text"
    text: str | None = None
    image_url: dict[str, Any] | None = None


class ChatMessage(BaseModel):
    role: str
    content: str | list[MessagePart]


class ChatCompletionRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    stream: bool = False
    user_id: str | None = None
    custom_variables: dict[str, str] | None = None
    session_id: str | None = Field(
        None,
        description="若填写则读取该会话历史、合并后调用元器，并在成功后落库；messages 须仅含本轮 user 消息",
    )


ChatSessionToolType = Literal["chat", "law", "case", "contract", "review"]


class ChatSessionCreate(BaseModel):
    title: str | None = Field(None, max_length=128, description="默认「新对话」，也可首条对话后自动截取")
    tool_type: ChatSessionToolType = "chat"


class ChatSessionPatch(BaseModel):
    title: str | None = Field(None, max_length=128)
    tool_type: ChatSessionToolType | None = None


class ChatSessionItem(BaseModel):
    id: str
    user_id: str
    title: str
    tool_type: str
    created_at: datetime
    message_count: int = 0


class PaginatedChatSessions(BaseModel):
    total: int
    items: list[ChatSessionItem]


class ChatMessageItem(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    tool_badge: str | None = None
    created_at: datetime


class PaginatedChatMessages(BaseModel):
    total: int
    items: list[ChatMessageItem]


class ChatCompletionResponse(BaseModel):
    id: str | None = None
    created: str | None = None
    assistant_id: str | None = None
    content: str | None = None
    raw: dict[str, Any] | None = None
    contract_id: str | None = Field(None, description="合同生成落库后的 contracts.id")


class AuthSendCodeRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=20)


class AuthSendCodeResponse(BaseModel):
    message: str
    code: str | None = None


class AuthLoginRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=20)
    code: str = Field(..., min_length=4, max_length=10)
    nickname: str | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str


class AuthLogoutResponse(BaseModel):
    message: str


class ClauseSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=8000)
    filters: str | None = Field(None, description="可选检索范围/标签，如与元器 custom_variables 对齐")
    user_id: str | None = None
    session_id: str | None = None
    custom_variables: dict[str, str] | None = None


class ContractGenerateRequest(BaseModel):
    contract_type: str = Field(..., min_length=1, max_length=256)
    parties: str | None = Field(None, max_length=4000)
    subject_matter: str | None = Field(None, max_length=8000)
    extra_requirements: str | None = Field(None, max_length=8000)
    user_id: str | None = None
    session_id: str | None = Field(None, description="可选，关联 chat_sessions.id")
    custom_variables: dict[str, str] | None = None


class ContractReviewResultResponse(BaseModel):
    contract_id: str
    status: str = Field(..., description="pending / done / failed")
    result: str | None = None
    error: str | None = None

class ChatMessageCreate(BaseModel):
    role: str = Field(..., description="user 或 assistant", pattern="^(user|assistant)$")
    content: str = Field(..., max_length=10000, description="消息内容")
    tool_badge: str | None = Field(None, max_length=16, description="工具标识：law/contract/review/chat")
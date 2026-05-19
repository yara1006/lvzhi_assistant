from datetime import datetime, timedelta
from typing import Annotated
import random

from fastapi import APIRouter, Depends
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.api.deps import require_service_auth
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.common import AuthLoginRequest, AuthLogoutResponse, AuthTokenResponse
from app.services.user_ids import normalize_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


def _create_access_token(settings: Settings, user_id: str) -> str:
    if not settings.jwt_secret:
        raise AppError(
            "jwt_not_configured",
            "未配置 JWT_SECRET",
            status_code=503,
        )
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=30)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


from pydantic import BaseModel

class SendCodeRequest(BaseModel):
    phone: str


# 用于存储验证码的内存字典
_dev_codes = {}


@router.post("/send-code")
async def send_code(
    body: SendCodeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
):
    """发送验证码 - 开发模式：随机生成验证码，返回给前端alert"""
    if not body.phone or len(body.phone) != 11:
        raise AppError("invalid_phone", "手机号格式错误", status_code=400)
    
    # 生成6位随机验证码
    code = str(random.randint(100000, 999999))
    
    # 存储验证码
    _dev_codes[body.phone] = code
    
    print(f"验证码发送到 {body.phone}: {code}")
    
    # 返回验证码给前端alert
    return {
        "message": "验证码已发送",
        "phone": body.phone,
        "dev_code": code
    }


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    body: AuthLoginRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuthTokenResponse:
    if body.phone:
        if not body.code:
            raise AppError(
                "missing_code",
                "手机号登录需要提供验证码",
                status_code=400,
            )
        
        # 验证存储的随机码
        stored_code = _dev_codes.get(body.phone)
        if not stored_code or stored_code != body.code:
            raise AppError("invalid_code", "验证码错误", status_code=401)
        
        # 验证成功后清除验证码
        _dev_codes.pop(body.phone, None)
        
        result = await session.execute(select(User).where(User.phone == body.phone))
        user = result.scalar_one_or_none()
        if user is None:
            uid = normalize_user_id(body.phone, settings)
            user = User(
                id=uid,
                nickname=body.nickname or "用户",
                user_type="personal",
                phone=body.phone,
            )
            session.add(user)
            await session.flush()
        elif body.nickname and user.nickname == "用户":
            user.nickname = body.nickname
            await session.flush()
    else:
        uid = normalize_user_id(body.user_id, settings)
        result = await session.execute(select(User).where(User.id == uid))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                id=uid,
                nickname=body.nickname or "用户",
                user_type="personal",
                phone=None,
            )
            session.add(user)
            await session.flush()
        elif body.nickname and user.nickname == "用户":
            user.nickname = body.nickname
            await session.flush()

    token = _create_access_token(settings, user.id)
    return AuthTokenResponse(access_token=token, token_type="bearer", user_id=user.id)


@router.post("/logout", dependencies=[Depends(require_service_auth)], response_model=AuthLogoutResponse)
async def logout() -> AuthLogoutResponse:
    return AuthLogoutResponse(message="已登出")

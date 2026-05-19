from typing import Annotated

from fastapi import Depends, Header, Request

from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.services.yuanqi_client import YuanqiClient


def get_yuanqi_client(request: Request) -> YuanqiClient:
    state = request.app.state
    client = getattr(state, "yuanqi", None)
    if client is None:
        client = YuanqiClient(get_settings())
        state.yuanqi = client
    return client


async def require_service_auth(
    settings: Annotated[Settings, Depends(get_settings)],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    if settings.api_key and x_api_key == settings.api_key:
        return

    if settings.jwt_secret and authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            try:
                from jose import JWTError, jwt

                jwt.decode(
                    token,
                    settings.jwt_secret,
                    algorithms=[settings.jwt_algorithm],
                )
                return
            except JWTError:
                raise AppError(
                    "invalid_token",
                    "JWT 无效或已过期",
                    status_code=401,
                ) from None

    if settings.api_key or settings.jwt_secret:
        raise AppError(
            "unauthorized",
            "无效的认证信息",
            status_code=401,
        )

    return


def resolve_user_id(
    settings: Settings,
    authorization: str | None,
    body_user_id: str | None,
) -> str:
    if settings.jwt_secret and authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            try:
                from jose import JWTError, jwt

                payload = jwt.decode(
                    token,
                    settings.jwt_secret,
                    algorithms=[settings.jwt_algorithm],
                )
                sub = payload.get("sub")
                if isinstance(sub, str) and sub:
                    return sub
            except JWTError:
                raise AppError("invalid_token", "JWT 无效或已过期", status_code=401) from None
    if body_user_id:
        return body_user_id
    return "anonymous"

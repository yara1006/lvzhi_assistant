from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import AppError, app_error_handler
from app.core.logging import get_logger, new_request_id, request_id_ctx, setup_logging
from app.db import models
from app.services.yuanqi_client import YuanqiClient

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    client = YuanqiClient(settings)
    app.state.yuanqi = client
    logger.info("应用启动")
    yield
    await client.aclose()
    logger.info("应用关闭")


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        debug=settings.debug,
        swagger_ui_parameters={"persistAuthorization": True},
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or new_request_id()
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            request_id_ctx.reset(token)

    app.add_exception_handler(AppError, app_error_handler)

    # API 路由
    app.include_router(api_router)

    # 托管前端静态文件
    frontend_path = "/home/ubuntu/Frontend"
    if os.path.exists(frontend_path):
        # 单独处理登录页
        @app.get("/login.html")
        async def serve_login():
            return FileResponse(os.path.join(frontend_path, "login.html"))
        
        @app.get("/")
        async def serve_index():
            return FileResponse(os.path.join(frontend_path, "index.html"))
        
        # 托管其他静态文件
        app.mount("/css", StaticFiles(directory=os.path.join(frontend_path, "css")), name="css")
        app.mount("/js", StaticFiles(directory=os.path.join(frontend_path, "js")), name="js")
        app.mount("/config.js", StaticFiles(directory=frontend_path), name="config")
        
        # 其他路径返回 index.html（SPA 支持）
        @app.get("/{path:path}")
        async def catch_all(path: str):
            file_path = os.path.join(frontend_path, path)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(os.path.join(frontend_path, "index.html"))

    return app


app = create_app()
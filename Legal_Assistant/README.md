# 法律助手 API

FastAPI 后端：对接腾讯元器 OpenAPI，MySQL 持久化。

**表结构以队友提供的 SQL 为准**（`users`、`chat_sessions`、`chat_messages`、`contracts`、`uploaded_files`）。首次建库请执行队友 DDL；`alembic upgrade head` 当前为**空迁移**（仅占位 revision `001_baseline`），不会重复建表。

## 目录与职责

| 路径 | 作用 |
|------|------|
| `app/` | 应用主包：入口、配置、路由、业务服务、数据库与请求/响应模型。 |
| `app/core/` | 横切能力：环境配置（`config.py`）、日志与 `request_id`（`logging.py`）、统一业务异常（`exceptions.py`）。 |
| `app/api/` | HTTP 层依赖与版本化路由聚合；`deps.py` 提供元器客户端、API Key 校验、`user_id` 解析（JWT / body）。 |
| `app/api/v1/` | **v1 接口实现**：健康检查、对话、条款检索、合同审查与生成；`router.py` 挂载到 `/api/v1`。 |
| `app/services/` | 领域服务：腾讯元器 HTTP 客户端（`yuanqi_client.py`）、消息拼装（`conversation.py`）、用户 upsert（`users.py`）、用户 ID 规范化（`user_ids.py`）。 |
| `app/db/` | 异步 SQLAlchemy：`base.py` 声明基类，`session.py` 引擎与会话工厂，`models/` 下 ORM 与队友 DDL 对齐。 |
| `app/schemas/` | Pydantic 模型：与前端/调用方约定的 JSON 入参、出参及错误体结构。 |
| `alembic/` | 数据库迁移占位与未来增量；**首版表结构由队友 SQL 初始化**。 |
| `tests/` | `pytest`：ASGI 客户端、元器接口 `respx` 模拟、鉴权与 SQLite 内存库。 |
| 项目根目录 | `pyproject.toml` 依赖与打包；`alembic.ini` 迁移配置；`.env.example` 环境变量说明；`Dockerfile` 容器运行入口。 |

## 重要文件说明

| 文件 | 作用 |
|------|------|
| `app/main.py` | 创建 FastAPI 应用：生命周期内创建/关闭元器客户端、CORS、`X-Request-ID` 中间件、注册异常处理与 `/api/v1` 路由。 |
| `app/core/config.py` | `pydantic-settings`：元器 URL/密钥、各场景 `assistant_id`、MySQL 连接串、`API_KEY` / `JWT`、匿名用户 UUID、CORS、上传大小等。 |
| `app/core/logging.py` | 日志初始化；通过 `contextvars` 在日志中带上 `request_id`。 |
| `app/core/exceptions.py` | `AppError` 及处理器，输出统一 JSON：`code`、`message`、`detail`。 |
| `app/api/deps.py` | 注入 `YuanqiClient`（支持测试场景下懒创建）、`require_service_auth`、`resolve_user_id`。 |
| `app/api/v1/router.py` | 将 health、chat、legal、contract 子路由汇总到 `/api/v1`。 |
| `app/api/v1/health.py` | `GET /health`、`GET /ready`（对数据库执行 `SELECT 1`）。 |
| `app/api/v1/chat.py` | `POST /chat/completions`：非流式 JSON 或流式 `text/event-stream` 转发元器。 |
| `app/api/v1/legal_search.py` | `POST /legal/clauses/search`：条款检索提示 + 可选 `custom_variables`。 |
| `app/api/v1/contract.py` | `POST /contracts/review`（multipart，落库 `contracts`+`uploaded_files`）、`GET /contracts/review/{contract_id}`、`POST /contracts/generate`（落库 `contracts`）。 |
| `app/services/yuanqi_client.py` | 封装元器 `chat/completions`：请求头、非流式 JSON、流式响应体迭代与错误处理。 |
| `app/services/conversation.py` | 将业务侧 `messages` 转为元器要求的 `content` 块结构；拼装单条用户消息等。 |
| `app/services/users.py` | 按规范化后的 UUID 查询或创建 `users` 行。 |
| `app/services/user_ids.py` | 将 `anonymous` / 非 UUID 的 `sub` 转为稳定 UUID 字符串。 |
| `app/db/session.py` | 延迟创建异步引擎；`get_db` 依赖注入；SQLite 测试时使用 `StaticPool`。 |
| `app/db/models/*.py` | ORM：`User`、`ChatSession`、`ChatMessage`、`Contract`、`UploadedFile`（与队友 DDL 一致）。 |
| `app/schemas/common.py` | 对话、条款检索、合同生成/审查等请求与响应模型，以及统一错误体。 |
| `alembic/env.py` | 异步迁移运行时：加载 `Base.metadata` 与 `DATABASE_URL`。 |
| `alembic/versions/001_baseline_external_schema.py` | 空迁移（占位），不创建表。 |
| `tests/conftest.py` | 测试环境变量、`metadata.create_all` / 清理、共享 `httpx.AsyncClient`。 |

## 本地运行

```bash
pip install -e ".[dev]"
cp .env.example .env
# 编辑 .env：DATABASE_URL、YUANQI_*；请先在 MySQL 中执行队友提供的建库 SQL
# 可选：写入 alembic 版本记录（空迁移，不修改表）
alembic upgrade head
uvicorn app.main:app --reload
```

文档：<http://127.0.0.1:8000/docs>

## 测试

```bash
pytest
```

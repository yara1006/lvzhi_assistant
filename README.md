# 律智助手

律智助手是一个面向法律咨询、法条检索、合同生成、合同审查和模拟法庭练习的 AI 法律辅助项目。仓库中同时包含静态前端、FastAPI 业务后端、数据库初始化脚本，以及一个独立的庭审预演演示应用。

## 项目结构

```text
lvzhi_assistant/
├── Frontend/                 # 律智助手静态前端
│   ├── index.html            # 主页面
│   ├── login.html            # 手机号验证码登录页
│   ├── config.js             # 前端运行配置
│   ├── server.js             # 旧版 Node 元器代理服务
│   ├── css/style.css         # 前端样式
│   └── js/                   # 前端交互逻辑
├── Legal_Assistant/          # 核心 FastAPI 后端
│   ├── app/main.py           # FastAPI 应用入口
│   ├── app/api/v1/           # API 路由
│   ├── app/core/             # 配置、异常、日志
│   ├── app/db/               # SQLAlchemy 数据库模型与会话
│   ├── app/services/         # 元器调用、会话、用户等服务
│   ├── tests/                # pytest 测试
│   ├── .env.example          # 后端环境变量模板
│   ├── pyproject.toml        # Python 依赖配置
│   └── Dockerfile            # 后端容器构建文件
├── court-rehearsal-ai/       # 独立的 AI 模拟法庭预演应用
│   ├── index.html            # Vite 前端入口
│   ├── server/index.js       # DeepSeek/得理法搜代理服务
│   └── package.json          # Node/Vite 项目配置
├── luzhi_db.sql              # MySQL 建库建表脚本
└── start-legal-api.sh        # 服务器上启动 FastAPI 后端的脚本
```

## 核心模块

### `Legal_Assistant`

核心业务后端，基于 FastAPI + MySQL + SQLAlchemy Async。主要能力包括：

- 用户登录：`POST /api/v1/auth/send-code`、`POST /api/v1/auth/login`
- 法律对话：`POST /api/v1/chat/completions`
- 法条检索：`POST /api/v1/legal/clauses/search`
- 会话管理：`/api/v1/chat-sessions`
- 合同生成与审查：`/api/v1/contracts/*`
- 健康检查：`GET /api/v1/health`

后端通过腾讯元器 OpenAPI / 混元 OpenAPI 调用智能体，并将用户、会话、消息、合同、上传文件等数据写入 MySQL。

### `Frontend`

静态前端页面，包含登录页和主工作台。页面会读取 `config.js` 中的配置，并调用后端 `/api/v1` 接口。生产环境中，`Legal_Assistant/app/main.py` 默认会尝试托管服务器路径 `/home/ubuntu/Frontend` 下的静态文件。

### `court-rehearsal-ai`

独立演示应用，使用 React + Vite。它有自己的 Express 代理服务：

- `POST /api/ai`：代理 DeepSeek Chat API
- `POST /api/cases`：代理得理类案检索
- `POST /api/laws`：代理得理法规检索

这个模块和 `Legal_Assistant` 后端相对独立，适合单独作为“模拟法庭预演”功能演示。

## 快速启动

### 1. 初始化数据库

先准备 MySQL 8.0+，然后执行根目录下的 SQL：

```bash
mysql -u root -p < luzhi_db.sql
```

数据库默认名为 `luzhi_assistant`，字符集为 `utf8mb4`。

### 2. 启动核心后端

进入后端目录：

```bash
cd Legal_Assistant
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

编辑 `.env`，至少配置：

```env
DATABASE_URL=mysql+asyncmy://root:password@127.0.0.1:3306/luzhi_assistant?charset=utf8mb4
JWT_SECRET=change-me
YUANQI_API_KEY=your-yuanqi-api-key
YUANQI_ASSISTANT_ID=your-assistant-id
```

启动服务：

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

启动后可访问：

- API 文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/api/v1/health`
- 前端首页：`http://localhost:8000/`，前提是服务器上存在 `/home/ubuntu/Frontend`

### 3. 启动前端

本地开发时可以直接用静态服务器打开 `Frontend`：

```bash
cd Frontend
python -m http.server 3000
```

然后访问：

```text
http://localhost:3000/login.html
```

如果前后端不在同一域名下，确认 `Frontend/config.js` 中的 API 地址和后端 CORS 配置一致。

### 4. 启动模拟法庭应用

```bash
cd court-rehearsal-ai
npm install
npm run dev
```

如需启动它的代理后端：

```bash
npm run server
```

相关环境变量：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DELI_APPID=
DELI_SECRET=
PORT=4000
```

## 环境变量

`Legal_Assistant/.env.example` 提供了核心后端配置模板。常用配置如下：

| 变量 | 说明 |
| --- | --- |
| `APP_NAME` | FastAPI 应用名 |
| `DEBUG` | 是否启用调试信息 |
| `CORS_ORIGINS` | 允许跨域访问的前端来源 |
| `DATABASE_URL` | MySQL 异步连接串 |
| `YUANQI_API_KEY` | 腾讯元器 API Key |
| `YUANQI_ASSISTANT_ID` | 默认元器智能体 ID |
| `HUNYUAN_API_KEY` | 混元 OpenAPI Key，可用于法条检索 |
| `HUNYUAN_ASSISTANT_ID` | 混元智能体 ID |
| `API_KEY` | 可选服务端 API Key |
| `JWT_SECRET` | 登录签发 JWT 必填密钥 |
| `MAX_UPLOAD_BYTES` | 合同审查上传文件大小限制 |

不要把真实 `.env`、API Key、数据库密码提交到仓库。

## 测试

后端测试位于 `Legal_Assistant/tests`：

```bash
cd Legal_Assistant
pytest
```

测试使用内存 SQLite 和模拟配置，不需要连接真实 MySQL 或元器服务。

## 部署建议

服务器部署时可以采用以下结构：

```text
/home/ubuntu/
├── Frontend/
└── Legal_Assistant/
```

后端启动脚本可参考根目录的 `start-legal-api.sh`。如果使用 systemd、PM2 或 Docker 部署，需要确保：

- 已创建并配置 `Legal_Assistant/.env`
- MySQL 已执行 `luzhi_db.sql`
- `JWT_SECRET` 和各类 API Key 已正确配置
- 前端静态目录位置与 `app/main.py` 中的 `frontend_path` 保持一致

## 当前注意事项

- `Frontend` 目录中保留了若干 `.bak` 备份文件，当前没有参与运行主流程。
- `court-rehearsal-ai/dist` 是已构建产物，源码入口仍以 `index.html` 和 Vite 配置为准。
- `Legal_Assistant` 已从 Git submodule 替换为仓库内真实源码，后续克隆仓库时不再需要额外初始化子模块。
- 仓库根目录 `.gitignore` 已忽略日志文件和常见本地配置，运行产生的 `*.log` 不应提交。

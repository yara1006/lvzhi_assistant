# 律智助手 · 法内狂徒

> 基于腾讯元器智能体 API 的法律 AI 前端项目

---

## 文件结构

```
法内狂徒-前端/
├── README.md           # 项目说明书
├── index.html          # 前端主页面
├── index.html.bak      # index.html 的备份文件，一般不是运行必须文件。
├── login.html          # 登录页面（手机号 + 验证码登录）
├── config.example.js   # 前端配置模板
├── config.js           # 你自己的前端配置（复制 config.example.js 后填写
├── server.js           # 后端代理（隐藏 Token，必须运行）
├── css/
│   └── style.css       # 页面样式（颜色、布局、按钮、聊天气泡外观）
└── js/
    ├── main.js         # 页面启动入口（检查登录、加载用户信息、绑定事件）
    ├── chat.js         # 聊天核心逻辑（发送消息、渲染消息、会话历史）
    ├── tools.js        # 工具切换和不同API请求逻辑（法条检索/合同生成等）
    └── utils.js        # 通用小工具函数（滚动到底部、输入框自适应、登出等）
```

---

## 第一步：从元器平台获取 API 信息

1. 打开 https://yuanqi.tencent.com
2. 进入 **「我的创建」**，找到你已发布的智能体
3. 点击右上角 **「更多」→「调用 API」**
4. 弹窗中会显示：
   - `API Endpoint`（接口地址）
   - `assistant_id`（智能体ID）
   - `Token`（鉴权令牌）

> ⚠️ Token 请勿泄露或直接写在前端代码中！

---

## 第二步：配置后端代理

打开 `server.js`，找到这两行并填入真实值：

```javascript
const YUANQI_TOKEN = 'YOUR_TOKEN_HERE';      // 替换为你的 Token
const DEFAULT_ASSISTANT_ID = 'YOUR_ASSISTANT_ID_HERE';  // 替换为你的智能体ID
```

然后安装依赖并启动：

```bash
npm install express cors
node server.js
```

看到 `🚀 律智助手代理服务已启动` 即成功。

---

## 第三步：配置前端

复制 `config.example.js` 为 `config.js`，填入你的信息：

```javascript
window.YUANQI_CONFIG = {
  ASSISTANT_ID: 'AB1234567890abc',   // 你的智能体ID
  PROXY_URL: 'http://localhost:3001/api/chat',
  DEMO_MODE: false,   // 改为 false 启用真实 API
};
```

---

## 第四步：打开前端

直接用浏览器打开 `index.html` 即可（或用 VS Code Live Server）。

增加登录界面后：
先打开 login.html 登录，登录成功后，浏览器保存 token，然后跳转到 index.html。
index.html 会按顺序加载：config.js -> utils.js -> tools.js -> chat.js -> main.js。
你输入问题后，chat.js 会调用 tools.js 里的接口请求。
请求带上 token 发到后端API地址（目前在 config.js 里配置了 API_BASE）。
后端返回结果，前端把结果一段段显示成聊天内容

---

## Demo 模式

如果 `config.js` 不存在，或 `DEMO_MODE: true`，会使用内置模拟数据演示功能，不调用真实 API。**比赛演示可以先用 Demo 模式跑通流程。**

---

## API 调用说明

前端发给 `server.js` 的请求格式：

```json
POST http://localhost:3001/api/chat
{
  "message": "劳动合同试用期最长多久？",
  "assistant_id": "可选，不填用默认",
  "stream": true
}
```

`server.js` 会转发给元器 API（附上 Token），然后把 SSE 流式响应传回前端。

---

## 元器 API 官方文档

- 文档地址：https://docs.qq.com/aio/p/scxmsn78nzsuj64
- 接口地址：`https://yuanqi.tencent.com/openapi/v1/agent/chat/completions`
- Headers：`Authorization: Bearer {token}` + `X-source: openapi`

---

## 评分要点对照

| 评分维度 | 本项目实现 |
|---------|-----------|
| AI工具运用深度 | 接入元器智能体API，流式SSE输出，多工作流模块 |
| Demo核心功能完整可运行 | 法条检索/案例检索/合同生成三大功能 |
| 界面简洁流畅 | 专业法律风格UI，左右分栏布局，流式打字输出 |
| Prompt设计专业 | 三套场景化Prompt，引导AI输出结构化法律内容 |


##项目整体流程图：
[打开 login.html]
        |
        v
[输入手机号 + 验证码]
        |
        v
[调用登录接口 /api/v1/auth/login]
        |
        v
[登录成功 -> 浏览器保存 token 到 localStorage]
        |
        v
[跳转到 index.html 主页面]
        |
        v
[index.html 依次加载这些脚本]
config.js -> utils.js -> tools.js -> chat.js -> main.js
        |
        v
[main.js 启动]
- 检查是否有 token
- 没有 token 就跳回 login.html
- 有 token 就初始化聊天界面
        |
        v
[用户在输入框提问并点击发送]
        |
        v
[chat.js::sendMessage()]
- 先把用户的话显示在右侧气泡
- 创建“AI正在回复”的气泡
        |
        v
[tools.js::callToolAPI()]
- 根据当前工具类型（chat/law/contract/review）
- 组装不同请求参数
- 带上 Authorization: Bearer token
- 请求对应后端接口
        |
        v
[后端返回结果]
        |
        v
[chat.js 把返回文本逐字显示]
        |
        v
[显示完成，消息进入会话历史]

#关键功能介绍
1. 法条检索：该功能用于帮助用户快速定位与问题相关的法律条文。用户在主页面点击“法条检索”后，可输入具体法律问题或关键词，系统会调用法条检索接口进行匹配，并返回可读性较高的条文内容。前端对返回内容做了展示优化，支持在对话区连续查看结果，便于用户快速理解法条依据并继续追问细节。
页面体现：左侧工具栏提供“法条检索”入口；输入区快捷按钮支持一键切换至法条检索；返回结果在聊天区以专业问答形式展示。
2. 案例检索：该功能用于辅助用户通过“相似案例/典型情形”理解法律问题的实际适用场景。主页面欢迎区文案已明确支持“案例查询”，系统可基于用户问题给出案例方向分析与处理思路，帮助用户从“法条”延伸到“实务判断”。
页面体现：左侧工具栏提供“案例检索”入口；输入区快捷按钮支持一键切换至案例检索；对话式交互支持围绕案件事实连续追问；结果与历史会话联动，便于回看和比较不同案例分析。
3. 合同生成：该功能面向“起草初稿”场景。用户输入合同需求（如交易对象、标的、条款重点等）后，系统调用合同生成接口，自动产出结构化合同草稿，帮助用户快速完成从“需求描述”到“文本初稿”的转换，显著降低起草门槛和时间成本。
页面体现：左侧工具栏提供“合同生成”入口；输入区快捷按钮支持快速切换；结果在聊天区流式展示，便于边看边补充需求。
4. 合同审查：该功能用于识别合同中的风险点与潜在隐患。用户粘贴合同文本后，系统调用审查接口输出风险分析结果，辅助用户发现不合理条款、责任不对等、表述不清等问题。该功能适合签约前自检和条款优化，提升合同安全性与规范性。
页面体现：左侧工具栏提供“合同审查”入口；输入区快捷按钮支持快速切换；输出内容突出“风险识别”和“审查结论”；与会话历史联动，支持多轮修订与复查。

/**
 * 元器智能体 API 后端代理
 * 
 * 作用：把前端的请求转发给元器API，同时附上 Token（不暴露给浏览器）
 * 
 * 使用方法：
 *   1. npm install express cors node-fetch
 *   2. 在下方填入你的 YUANQI_TOKEN 和 ASSISTANT_ID
 *   3. node server.js
 *   4. 前端将请求发到 http://localhost:3001/api/chat
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// 在这里填入你从元器平台获取的信息
// 元器平台 → 我的创建 → 找到智能体 → 更多 → 调用API
// ─────────────────────────────────────────────
const YUANQI_TOKEN = process.env.YUANQI_TOKEN || 'YOUR_TOKEN_HERE';
const DEFAULT_ASSISTANT_ID = process.env.ASSISTANT_ID || 'YOUR_ASSISTANT_ID_HERE';
const YUANQI_API_URL = 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions';

// ─────────────────────────────────────────────
// 代理接口
// ─────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, assistant_id, stream = true, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Build messages array (supports multi-turn conversation)
  const messages = [
    ...history,
    {
      role: 'user',
      content: [{ type: 'text', text: message }],
    },
  ];

  const requestBody = {
    assistant_id: assistant_id || DEFAULT_ASSISTANT_ID,
    user_id: 'frontend-user',
    stream: stream,
    messages,
  };

  console.log(`[${new Date().toLocaleTimeString()}] → 转发请求到元器 | assistant: ${requestBody.assistant_id}`);

  try {
    const yuanqiRes = await fetch(YUANQI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YUANQI_TOKEN}`,
        'Content-Type': 'application/json',
        'X-source': 'openapi',
      },
      body: JSON.stringify(requestBody),
    });

    if (!yuanqiRes.ok) {
      const errText = await yuanqiRes.text();
      console.error('元器 API 错误:', yuanqiRes.status, errText);
      return res.status(yuanqiRes.status).json({ error: errText });
    }

    if (stream) {
      // Stream SSE back to frontend
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = yuanqiRes.body;
      reader.pipe(res);

      reader.on('end', () => {
        console.log(`[${new Date().toLocaleTimeString()}] ✓ 流式响应完成`);
        res.end();
      });

      reader.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      // Non-stream: return JSON directly
      const data = await yuanqiRes.json();
      console.log(`[${new Date().toLocaleTimeString()}] ✓ 响应成功`);
      res.json(data);
    }
  } catch (err) {
    console.error('代理请求失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 律智助手代理服务已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   前端代理接口: http://localhost:${PORT}/api/chat`);
  if (YUANQI_TOKEN === 'YOUR_TOKEN_HERE') {
    console.log(`\n⚠️  警告: 请先在 server.js 中填入真实的 YUANQI_TOKEN 和 ASSISTANT_ID！`);
  }
  console.log('');
});

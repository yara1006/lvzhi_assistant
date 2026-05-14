/**
 * Court Rehearsal AI - 后端 API 代理服务器
 * 
 * 作用：保护 API 密钥不暴露到前端，代理转发请求
 * 
 * 支持三个路由：
 *   POST /api/ai     → Anthropic Claude API
 *   POST /api/cases  → 得理类案检索 API
 *   POST /api/laws   → 得理法规检索 API
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── 在生产环境中提供前端静态文件 ───
app.use(express.static(join(__dirname, '..', 'dist')));

// ─── 配置（从环境变量读取） ───
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DELI_APPID = process.env.DELI_APPID || 'QthdBErlyaYvyXul';
const DELI_SECRET = process.env.DELI_SECRET || 'EC5D455E6BD348CE8E18BE05926D2EBE';
const DELI_BASE = 'https://openapi.delilegal.com/api/qa/v3/search';

// ─── 健康检查 ───
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    deepseek: !!DEEPSEEK_KEY,
    deli: !!DELI_APPID,
    model: DEEPSEEK_MODEL,
  });
});

// ─── DeepSeek API 代理 ───
app.post('/api/ai', async (req, res) => {
  try {
    if (!DEEPSEEK_KEY) {
      return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' });
    }

    const { system, messages } = req.body;

    // DeepSeek 兼容 OpenAI 格式
    const openaiMessages = [];
    if (system) openaiMessages.push({ role: 'system', content: system });
    openaiMessages.push(...(messages || []));

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        max_tokens: 800,
        messages: openaiMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('DeepSeek API error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('AI proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 得理类案检索 API 代理 ───
app.post('/api/cases', async (req, res) => {
  try {
    const { keyword } = req.body;
    
    const response = await fetch(`${DELI_BASE}/queryListCase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appid': DELI_APPID,
        'secret': DELI_SECRET,
      },
      body: JSON.stringify({
        pageNo: 1,
        pageSize: 5,
        sortField: 'correlation',
        sortOrder: 'desc',
        condition: {
          keywordArr: [keyword || ''],
        },
      }),
    });

    const data = await response.json();
    const records = data?.data?.records || data?.data || [];
    
    const cases = records.map(c => ({
      title: c.caseName || c.title || '未命名案例',
      court: c.courtName || '',
      date: c.judgementDate || c.caseYear || '',
      summary: c.caseSummary || c.caseDigest || (c.content ? c.content.substring(0, 300) : ''),
      caseNo: c.caseNo || '',
    }));

    res.json({ cases });
  } catch (err) {
    console.error('Case search error:', err.message);
    res.json({ cases: [] });
  }
});

// ─── 得理法规检索 API 代理 ───
app.post('/api/laws', async (req, res) => {
  try {
    const { keyword } = req.body;
    
    const response = await fetch(`${DELI_BASE}/queryListLaw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appid': DELI_APPID,
        'secret': DELI_SECRET,
      },
      body: JSON.stringify({
        pageNo: 1,
        pageSize: 5,
        sortField: 'correlation',
        sortOrder: 'desc',
        condition: {
          keywords: [keyword || ''],
          fieldName: 'semantic',
        },
      }),
    });

    const data = await response.json();
    const records = data?.data?.records || data?.data || [];
    
    const laws = records.map(l => ({
      title: l.title || l.lawName || '未命名法规',
      issuer: l.issueOrgan || l.publisher || '',
      date: l.publishDate || '',
      status: l.timeliness || l.status || '',
      level: l.lawLevelName || '',
    }));

    res.json({ laws });
  } catch (err) {
    console.error('Law search error:', err.message);
    res.json({ laws: [] });
  }
});

// ─── 前端路由 fallback（SPA） ───
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// ─── 启动 ───
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   ⚖️  Court Rehearsal AI Server         ║
║   服务已启动: http://localhost:${PORT}       ║
║                                          ║
║   API 状态:                              ║
║   · DeepSeek:  ${DEEPSEEK_KEY ? '✅ 已配置' : '❌ 未配置'}             ║
║   · 得理法搜:  ${DELI_APPID ? '✅ 已配置' : '❌ 未配置'}             ║
║   · 模型:      ${DEEPSEEK_MODEL}    ║
╚══════════════════════════════════════════╝
  `);
});

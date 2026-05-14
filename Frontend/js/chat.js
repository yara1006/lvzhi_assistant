// 聊天相关变量（暴露到全局）
window.isLoading = false;
window.chats = [];
window.activeChatId = null;
window.currentSessionServerId = null;
window.isInitialized = false;
window.isLoadingSession = null;
window.isRenderingHistory = false;
window.currentTool = 'chat';  // ✅ 定义当前工具
window.isCreatingChat = false;

function getChat() { return window.chats.find(c => c.id === window.activeChatId); }

// ✅ 工具切换函数
function selectTool(toolType) {
  console.log('选择工具:', toolType);
  
  if (window.currentTool === toolType) {
    console.log('已在当前工具，无需切换');
    return;
  }
  
  const oldTool = window.currentTool;
  window.currentTool = toolType;
  
  const toolNames = {
    'chat': '法律对话',
    'law': '法条检索',
    'contract': '合同生成',
    'review': '合同审查',
    'court': '模拟法庭'
  };
  
  const toolName = toolNames[toolType] || toolType;
  console.log(`工具已从 ${toolNames[oldTool] || oldTool} 切换到 ${toolName}`);
  
  // 可选：显示提示
  const titleEl = document.getElementById('chat-title');
  if (titleEl && !window.activeChatId) {
    titleEl.textContent = `${toolName}`;
  }
  
  // 模拟法庭特殊提示
  if (toolType === 'court') {
    console.log('模拟法庭：将调用独立服务端口 8001');
  }
}

function newChat(options = {}) {
  const createRemote = options.createRemote === true;
  const forceNew = options.forceNew === true;

  if (window.isCreatingChat) {
    console.log('newChat 跳过：正在创建会话中');
    return Promise.resolve();
  }
  window.isCreatingChat = true;
  console.log('newChat 被调用');
  const existingEmptyChat = !forceNew
    ? window.chats.find(
        c =>
          c.messages.length === 0 &&
          !c.serverId &&
          (c.tool_type || 'chat') === (window.currentTool || 'chat')
      )
    : null;
  if (existingEmptyChat) {
    console.log('发现已有空会话，直接使用:', existingEmptyChat.id);
    window.activeChatId = existingEmptyChat.id;
    window.currentSessionServerId = null;
    renderMessages();
    const titleEl = document.getElementById('chat-title');
    if (titleEl) titleEl.textContent = '新建对话';
    window.isCreatingChat = false;
    return Promise.resolve();
  }
  
  if (createRemote) {
    saveCurrentSessionToServer();
  }
  const id = Date.now().toString();
  
  // ✅ 使用当前工具类型创建会话
  const toolTitles = {
    'chat': '法律对话',
    'law': '法条检索', 
    'contract': '合同生成',
    'review': '合同审查',
    'court': '模拟法庭'
  };
  const title = toolTitles[window.currentTool] || '新对话';
  const newChatObj = { id, title: title, messages: [], serverId: null, tool_type: window.currentTool };
  window.chats.unshift(newChatObj);
  window.activeChatId = id;
  window.currentSessionServerId = null;
  renderHistoryFromServer();
  renderMessages();
  const titleEl = document.getElementById('chat-title');
  if (titleEl) titleEl.textContent = title;

  if (!createRemote) {
    window.isCreatingChat = false;
    return Promise.resolve(newChatObj);
  }

  return createSession(title).then(session => {
    if (session && session.id) {
      const localChat = window.chats.find(c => c.id === newChatObj.id);
      if (localChat) {
        localChat.serverId = session.id;
        localChat.id = session.id;
        window.activeChatId = session.id;
        window.currentSessionServerId = session.id;
        console.log('后端会话已创建并更新本地ID:', session.id);
        renderHistoryFromServer();
      }
    } else {
      console.error('后端会话创建失败，移除本地临时会话');
      window.chats = window.chats.filter(c => c.id !== newChatObj.id);
      if (window.chats.length > 0) {
        return loadSession(window.chats[0].id, window.chats[0].title);
      } else {
        renderHistoryFromServer();
        renderMessages();
      }
    }
  }).catch(err => {
    console.error('创建后端会话异常:', err);
    window.chats = window.chats.filter(c => c.id !== newChatObj.id);
    if (window.chats.length > 0) {
      return loadSession(window.chats[0].id, window.chats[0].title);
    } else {
      renderHistoryFromServer();
      renderMessages();
    }
  }).finally(() => {
    window.isCreatingChat = false;
  });
}

function renderMessages() {
  const chat = getChat();
  const el = document.getElementById('messages');
  if (!el) return;
  if (!chat || !chat.messages.length) {
    el.innerHTML = `<div class="welcome" id="welcome">
      <div class="welcome-icon">⚖️</div>
      <div><div class="welcome-title">您好，我是您的法律AI助手</div>
      <div class="welcome-sub">直接输入任何法律问题，或使用左侧专业工具进行精准的法条检索、案例查询和合同生成。</div></div>
      <div class="suggestion-grid">
        <div class="suggestion-card" onclick="quickAsk('劳动合同试用期最长多久？工资不得低于多少？')"><div class="sc-icon">⏱</div><div class="sc-title">试用期规定</div><div class="sc-desc">时长与工资标准</div></div>
        <div class="suggestion-card" onclick="quickAsk('合同无效的情形有哪些？法律后果是什么？')"><div class="sc-icon">❌</div><div class="sc-title">合同无效情形</div><div class="sc-desc">认定条件与法律后果</div></div>
        <div class="suggestion-card" onclick="quickAsk('员工离职泄露商业秘密，公司如何维权并要求赔偿？')"><div class="sc-icon">🔒</div><div class="sc-title">商业秘密保护</div><div class="sc-desc">侵权认定与赔偿路径</div></div>
        <div class="suggestion-card" onclick="quickAsk('股东知情权的范围包括哪些？公司拒绝提供怎么办？')"><div class="sc-icon">👁</div><div class="sc-title">股东知情权</div><div class="sc-desc">权利范围与救济方式</div></div>
      </div>
    </div>`;
    return;
  }
  el.innerHTML = chat.messages.map(m => bubbleHTML(m)).join('');
  scrollBot();
}

function renderMarkdownContent(raw) {
  // 先归一化换行，并移除已有 HTML 标签，避免将标签原文显示到气泡中。
  // 注意：这里不信任后端返回的 HTML，统一按纯文本 + Markdown 重新渲染。
  const normalized = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  // 先转义，再做 Markdown 语法替换，防止注入。
  const escapedAll = esc(normalized);
  const lines = escapedAll.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  const inline = (s) => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) {
      closeLists();
      continue;
    }

    // 支持 #、##、###、####（也兼容无空格写法：###标题）
    const h = line.match(/^(#{1,6})\s*(.+)$/);
    if (h) {
      closeLists();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeLists();
  return out.join('');
}

function extractDownloadMarker(content) {
  const raw = String(content ?? '');
  const match = raw.match(/\[DOWNLOAD_CONTRACT:([^\]]+)\]/);
  if (!match) return { cleanText: raw, contractId: null };
  const contractId = String(match[1] || '').trim();
  const cleanText = raw.replace(/\[DOWNLOAD_CONTRACT:[^\]]+\]/g, '').trim();
  return { cleanText, contractId };
}

function buildDownloadButtonHtml(contractId) {
  const id = String(contractId || '').trim();
  if (!id || id === 'contract_id_placeholder') return '';
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return '';
  return `<button onclick="downloadContract('${safeId}')" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: var(--gold, #c9a84c); color: var(--ink, #1a1a2e); text-decoration: none; border-radius: 6px; font-weight: 500; border: none; cursor: pointer;">📥 下载Word合同</button>`;
}

function bubbleHTML(m) {
  const t = new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const who = m.role === 'user' ? '您' : '律智助手';
  
  // 严格限制：仅合同生成功能（toolBadge=contract）走下载按钮渲染分支
  const isContractMessage = m.toolBadge === 'contract';
  if (isContractMessage) {
    const optimizeContractText = (text) => {
      const normalized = String(text ?? '').replace(/\r\n/g, '\n');
      const lines = normalized.split('\n');
      const merged = [];

      const isListLine = (s) => /^(\s*[-*]\s+|\s*\d+\.\s+)/.test(s);

      for (let i = 0; i < lines.length; i++) {
        const cur = lines[i];
        const prev = merged.length ? merged[merged.length - 1] : '';
        const next = i + 1 < lines.length ? lines[i + 1] : '';

        // 保留空行（用于段落分隔）
        if (cur.trim() === '') {
          merged.push('');
          continue;
        }

        // 列表行保持独立换行
        if (isListLine(cur)) {
          merged.push(cur);
          continue;
        }

        // 如果上一行是空行或列表行，直接开启新行
        if (prev === '' || isListLine(prev) || isListLine(next)) {
          merged.push(cur.trim());
          continue;
        }

        // 其余单换行合并为空格
        merged[merged.length - 1] = `${prev.trim()} ${cur.trim()}`;
      }

      // 清理多余空白并保留双换行段落
      return merged
        .join('\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const raw = String(m.content ?? '');
    const { cleanText: markerCleanText, contractId: markerContractId } = extractDownloadMarker(raw);
    const markerBtnHtml = buildDownloadButtonHtml(markerContractId);
    const rawWithoutMarker = markerCleanText;
    const btnMatch = rawWithoutMarker.match(/<button[\s\S]*?downloadContract\([\s\S]*?<\/button>/i);
    let contractHtml = '';
    if (btnMatch) {
      const btnHtml = btnMatch[0];
      const textPart = rawWithoutMarker.replace(btnHtml, '');
      const optimizedText = optimizeContractText(textPart);
      contractHtml = `${optimizedText.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}${btnHtml}`;
    } else {
      const optimizedText = optimizeContractText(rawWithoutMarker);
      contractHtml = optimizedText.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
      if (markerBtnHtml) contractHtml += markerBtnHtml;
    }

    const cls = 'tr-contract';
    const lbl = '合同草稿';
    const header = `<div class="tool-result-header"><span class="tr-badge ${cls}">${lbl}</span></div>`;
    return `<div class="msg-row ${m.role}"><div class="msg-meta">${who} · ${t}</div><div class="msg-bubble">${header}${contractHtml}</div></div>`;
  }

  if (m.isHtml) {
    return `<div class="msg-row ${m.role}"><div class="msg-meta">${who} · ${t}</div><div class="msg-bubble html-content">${m.content}</div></div>`;
  }
  
  let inner = '';
  let contentHtml = '';
  if (m.role === 'assistant') {
    // 非合同功能不渲染下载按钮，避免误触发
    contentHtml = renderMarkdownContent(m.content);
  } else {
    contentHtml = esc(m.content).replace(/\n/g, '<br>');
  }

  if (m.toolBadge) {
    const cls = { law: 'tr-law', case: 'tr-case', contract: 'tr-contract', review: 'tr-review', court: 'tr-court' }[m.toolBadge] || '';
    const lbl = { law: '法条检索', case: '案例检索', contract: '合同草稿', review: '合同风险审查', court: '模拟法庭' }[m.toolBadge] || '';
    inner = `<div class="tool-result-header"><span class="tr-badge ${cls}">${lbl}</span></div>${contentHtml}`;
  } else {
    inner = contentHtml;
  }
  return `<div class="msg-row ${m.role}"><div class="msg-meta">${who} · ${t}</div><div class="msg-bubble">${inner}</div></div>`;
}

function appendBubble(m) {
  const welcomeEl = document.getElementById('welcome');
  if (welcomeEl) welcomeEl.remove();
  const el = document.getElementById('messages');
  if (!el) return;
  const t = new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `msg-row ${m.role}`;
  div.innerHTML = `<div class="msg-meta">${m.role === 'user' ? '您' : '律智助手'} · ${t}</div><div class="msg-bubble">${m.content}</div>`;
  el.appendChild(div);
  scrollBot();
}

function createStreamBubble(toolBadge) {
  const welcomeEl = document.getElementById('welcome');
  if (welcomeEl) welcomeEl.remove();
  const el = document.getElementById('messages');
  if (!el) return { target: null, cursor: null };
  const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'msg-row assistant';
  let hdr = '';
  if (toolBadge) {
    const cls = { law: 'tr-law', case: 'tr-case', contract: 'tr-contract', review: 'tr-review', court: 'tr-court' }[toolBadge] || '';
    const lbl = { law: '法条检索', case: '案例检索', contract: '合同草稿', review: '合同风险审查', court: '模拟法庭' }[toolBadge] || '';
    hdr = `<div class="tool-result-header"><span class="tr-badge ${cls}">${lbl}</span></div>`;
  }
  div.innerHTML = `<div class="msg-meta">律智助手 · ${t}</div><div class="msg-bubble">${hdr}<span id="st"></span><span class="cursor"></span></div>`;
  el.appendChild(div);
  scrollBot();
  return { target: div.querySelector('#st'), cursor: div.querySelector('.cursor') };
}

const DEMOS = {
  review: `合同风险审查报告...`,
  law: `根据《中华人民共和国劳动合同法》相关规定...`,
  contract: `技术服务合同（AI草稿）...`,
  chat: `您好，我是您的法律AI助手，请问有什么可以帮您？`,
  court: `模拟法庭：请描述您的案件情况，我将为您模拟庭审辩论。`
};

async function demoStream(target, cursor, type) {
  const text = DEMOS[type] || DEMOS.chat;
  let full = '';
  for (let i = 0; i < text.length; i++) {
    if (target) target.textContent += text[i];
    full += text[i];
    await new Promise(r => setTimeout(r, Math.random() * 10 + 3));
    if (i % 20 === 0) scrollBot();
  }
  return full;
}

async function callAPI(prompt, target, cursor) {
  // 合同审查
  if (window.currentTool === 'review') {
    const msg = '📄 请点击输入框右侧的 📎 按钮上传合同文件，我将为您进行风险审查。\n\n支持的文件格式：PDF、Word、TXT，最大 20MB。';
    if (target) target.textContent = msg;
    return msg;
  }
  
  // 模拟法庭 - 调用独立服务（8001端口）
  if (window.currentTool === 'court') {
    try {
      const response = await fetch('http://localhost:8001/api/moot/court', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, user_id: localStorage.getItem('userId') })
      });
      if (response.ok) {
        const data = await response.json();
        return data.reply || data.message || '模拟法庭服务响应成功';
      } else {
        return `模拟法庭服务异常：${response.status}`;
      }
    } catch (err) {
      console.error('模拟法庭调用失败:', err);
      return '模拟法庭服务连接失败，请检查 8001 端口服务是否启动';
    }
  }
  
  // 其他工具通过 tools.js 处理
  if (typeof callToolAPI !== 'undefined') {
    return await callToolAPI(prompt, target, cursor);
  }
  return await demoStream(target, cursor, 'chat');
}

async function sendMessage(text, toolBadge) {
  if (isLoading) return;
  
  const pendingFile = window.pendingFile;
  const inp = document.getElementById('user-input');
  const msg = text !== undefined ? text : inp.value.trim();
  
  if (!msg && !pendingFile) return;
  
  const filePreview = document.getElementById('pendingFilePreview');
  if (filePreview) filePreview.remove();
  
  if (msg) inp.value = '';
  autoResize(inp);
  setLoading(true);
  isLoading = true;

  if (!window.activeChatId) {
    await newChat({ createRemote: false });
  }

  let chat = getChat();
  // 发送消息时补建后端会话（唯一入口）
  if (chat && !chat.serverId) {
    if (!window.sessionCreatePromise) {
      window.sessionCreatePromise = createSession(chat.title || '新对话')
        .finally(() => { window.sessionCreatePromise = null; });
    }
    const newSession = await window.sessionCreatePromise;
    if (newSession && newSession.id) {
      chat.serverId = newSession.id;
      chat.id = newSession.id;
      window.activeChatId = newSession.id;
      window.currentSessionServerId = newSession.id;
      await renderHistoryFromServer(true);
    }
  }

  let waitCount = 0;
  while (!chat?.serverId && waitCount < 20) {
    await new Promise(r => setTimeout(r, 50));
    chat = getChat();
    waitCount++;
  }

  if (!chat?.serverId) {
    console.error('会话创建失败，无法发送消息');
    setLoading(false);
    isLoading = false;
    return;
  }
  
  // 合同审查文件上传流程
  if (pendingFile) {
    const token = localStorage.getItem('token');
    const userContent = msg || `上传合同文件进行审查：${pendingFile.name}`;
    
    const userMsg = { role: 'user', content: userContent, ts: Date.now(), hasFile: true, fileName: pendingFile.name };
    chat.messages.push(userMsg);
    if (chat.messages.length === 1) {
      chat.title = buildSessionTitleFromText(userContent);
      const titleEl = document.getElementById('chat-title');
      if (titleEl) titleEl.textContent = chat.title;
      await saveCurrentSessionToServer();
    }
    appendBubbleWithFile(userMsg);
    
    const formData = new FormData();
    formData.append('file', pendingFile);
    if (msg) formData.append('notes', msg);
    if (chat.serverId) formData.append('session_id', chat.serverId);
    
    const loadingMsg = { role: 'assistant', content: '正在分析合同，请稍候...', ts: Date.now() };
    appendBubble(loadingMsg);
    
    try {
      const res = await fetch('/api/v1/contracts/review', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
      }
      
      const data = await res.json();
      
      const messagesEl = document.getElementById('messages');
      if (messagesEl.lastChild && messagesEl.lastChild.textContent.includes('正在分析')) {
        messagesEl.lastChild.remove();
      }
      
      let result = data.result || data.message || '审查完成';
      if (typeof result === 'string') {
        result = result.replace(/^\u200b/, '').trim();
      }
      
      if (typeof result === 'string' && result.startsWith('{')) {
        try {
          const parsed = JSON.parse(result);
          result = formatReviewResult(parsed);
        } catch(e) {
          console.log('JSON 解析失败:', e);
        }
      }
      
      const assistantMsg = { role: 'assistant', content: result, ts: Date.now(), toolBadge: 'review' };
      chat.messages.push(assistantMsg);
      appendBubble(assistantMsg);
      
      // review 接口后端已自动保存消息，前端跳过重复落库
      console.log("review 模式由后端自动保存消息，前端跳过 saveMessageToSession");
      
    } catch (err) {
      console.error('审查失败:', err);
      const messagesEl = document.getElementById('messages');
      if (messagesEl.lastChild && messagesEl.lastChild.textContent.includes('正在分析')) {
        messagesEl.lastChild.remove();
      }
      appendBubble({ role: 'assistant', content: `审查失败：${err.message}`, ts: Date.now() });
    }
    
    window.pendingFile = null;
    setLoading(false);
    isLoading = false;
    return;
  }
  
  // 普通文本消息：合同生成场景显式使用用户原始输入 msg，避免显示后端拼接 prompt
  // [修改位置] sendMessage -> 普通文本消息分支
  const displayUserContent = window.currentTool === 'contract'
    ? msg
    : msg;
  const userMsg = { role: 'user', content: displayUserContent, ts: Date.now() };
  chat.messages.push(userMsg);
  if (chat.messages.length === 1) {
    chat.title = buildSessionTitleFromText(displayUserContent);
    const titleEl = document.getElementById('chat-title');
    if (titleEl) titleEl.textContent = chat.title;
    await saveCurrentSessionToServer();
  }
  appendBubble(userMsg);
  
  const { target, cursor: cursorEl } = createStreamBubble(toolBadge || null);
  let full = CONFIG.DEMO_MODE ? await demoStream(target, cursorEl, toolBadge || 'chat') : await callAPI(msg, target, cursorEl);

  if (cursorEl) cursorEl.remove();
  const assistantMsg = {
    role: 'assistant',
    content: full,
    ts: Date.now(),
    // toolBadge 未显式传入时，回退到当前工具，避免合同消息丢失 badge
    toolBadge: toolBadge || window.currentTool || null
  };
  chat.messages.push(assistantMsg);
  
  if (!chat.serverId) {
    console.error('会话未正确初始化，无法保存消息');
    setLoading(false);
    isLoading = false;
    return;
  }

  // chat/law/contract/review 由对应后端接口自动持久化，避免前后端重复写入
  const backendAutoSavesTools = new Set(['chat', 'law', 'contract', 'review']);
  if (backendAutoSavesTools.has(window.currentTool)) {
    console.log(`${window.currentTool} 模式由后端自动保存消息，前端跳过 saveMessageToSession`);
  } else {
    await saveMessageToSession(chat.serverId, "user", msg, toolBadge || null);
    await saveMessageToSession(chat.serverId, "assistant", full, toolBadge || null);
    console.log("消息已保存到数据库");
  }
  
  renderMessages();
  
  setLoading(false);
  isLoading = false;
}

function quickAsk(t) {
  const inputEl = document.getElementById('user-input');
  if (inputEl) inputEl.value = t;
  sendMessage();
}

let sessionsCache = null;
let fetchSessionsPromise = null;

async function fetchSessions(forceRefresh = false) {
  if (sessionsCache && !forceRefresh) {
    return sessionsCache;
  }
  if (fetchSessionsPromise) {
    return fetchSessionsPromise;
  }

  const token = localStorage.getItem('token');
  fetchSessionsPromise = (async () => {
    try {
      const res = await fetch('/api/v1/chat/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      sessionsCache = data.items || [];
      return sessionsCache;
    } catch (err) {
      console.error('获取会话列表失败:', err);
      sessionsCache = [];
      return [];
    } finally {
      fetchSessionsPromise = null;
    }
  })();
  return fetchSessionsPromise;
}

async function createSession(title) {
  console.log('createSession 被调用，标题:', title, '当前工具:', window.currentTool);
  const token = localStorage.getItem('token');
  const toolType = window.currentTool === 'legal_chat' ? 'legal_chat' : (window.currentTool || 'chat');
  try {
    const res = await fetch('/api/v1/chat/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: title || '新对话', tool_type: toolType })
    });
    const data = await res.json();
    console.log('createSession 成功，返回会话ID:', data?.id);
    return data;
  } catch (err) {
    console.error('创建会话失败:', err);
    return null;
  }
}

async function fetchMessages(sessionId) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/v1/chat/sessions/${sessionId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error('获取消息失败:', err);
    return [];
  }
}

async function loadSession(sessionId, sessionTitle) {
  if (isLoadingSession === sessionId) {
    console.log('Already loading session:', sessionId);
    return;
  }
  isLoadingSession = sessionId;
  
  console.log('=== loadSession 开始 ===', sessionId);
  const messages = await fetchMessages(sessionId);
  
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.role === 'user' && b.role === 'assistant') return -1;
    if (a.role === 'assistant' && b.role === 'user') return 1;
    return 0;
  });
  
  const formattedMessages = sortedMessages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    toolBadge: m.tool_badge,
    ts: new Date(m.created_at).getTime()
  }));
  
  let targetChat = chats.find(c => c.id === sessionId);
  if (targetChat) {
    targetChat.messages = formattedMessages;
    targetChat.title = sessionTitle;
  } else {
    targetChat = {
      id: sessionId,
      serverId: sessionId,
      title: sessionTitle,
      messages: formattedMessages
    };
    chats.unshift(targetChat);
  }
  
  activeChatId = sessionId;
  currentSessionServerId = sessionId;
  
  const sessionData = chats.find(c => c.id === sessionId);
  if (sessionData && sessionData.tool_type) {
    currentTool = sessionData.tool_type;
  } else {
    currentTool = 'chat';
  }

  await renderHistoryFromServer();
  renderMessages();
  const titleEl = document.getElementById('chat-title');
  if (titleEl) titleEl.textContent = sessionTitle;
  scrollBot();
  
  isLoadingSession = null;
}

async function renderHistoryFromServer(forceRefresh = false) {
  if (isRenderingHistory && !forceRefresh) {
    console.log('Already rendering history, skipping');
    return;
  }
  isRenderingHistory = true;
  
  try {
    const el = document.getElementById('history-scroll');
    if (!el) return;
    
    const sessions = await fetchSessions(forceRefresh);
    
    if (!sessions.length) {
      el.innerHTML = '<div class="history-empty">暂无历史对话<br>开始第一次咨询吧</div>';
      return;
    }
    
    const toolIcons = {
      'chat': '💬',
      'legal_chat': '💬',
      'law': '📜',
      'contract': '📝',
      'review': '🛡',
      'court': '⚖️'
    };

    const toolNames = {
      'chat': '通用对话',
      'legal_chat': '法律对话',
      'law': '法条检索',
      'contract': '合同生成',
      'review': '合同审查',
      'court': '模拟法庭'
    };
    
    for (const s of sessions) {
      let existingChat = chats.find(c => c.id === s.id);
      if (existingChat) {
        existingChat.title = s.title;
        existingChat.tool_type = s.tool_type;
        existingChat.serverId = s.id;
        existingChat.created_at = s.created_at;
      } else {
        chats.push({
          id: s.id,
          serverId: s.id,
          title: s.title,
          tool_type: s.tool_type,
          created_at: s.created_at,
          messages: []
        });
      }
    }
    
    const sorted = [...chats].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
    
    el.innerHTML = sorted.map(s => {
      const icon = toolIcons[s.tool_type] || '💬';
      const toolName = toolNames[s.tool_type] || '对话';
      return `
        <div class="history-item ${activeChatId === s.id ? 'active' : ''}" onclick="onHistoryItemClick(event, '${s.id}', '${esc(s.title)}')">
          <div class="history-icon">${icon}</div>
          <div class="history-content">
            <div class="hi-text">${esc(s.title)}</div>
            <div class="hi-tool">${toolName}</div>
          </div>
          <div class="hi-del" onclick="deleteSessionFromList('${s.id}', event); return false;">✕</div>
        </div>
      `;
    }).join('');
  } finally {
    isRenderingHistory = false;
  }
}

function onHistoryItemClick(e, sessionId, sessionTitle) {
  if (e && e.target && e.target.closest('.hi-del')) return;
  loadSession(sessionId, sessionTitle);
}

async function deleteSessionFromList(sessionId, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }
  }

  const nextChat = chats.find(c => c.id !== sessionId);
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`/api/v1/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok || response.status === 404) {
      // 本地状态先同步移除，避免 UI 残留与闪现
      chats = chats.filter(c => c.id !== sessionId);
      if (Array.isArray(sessionsCache)) {
        sessionsCache = sessionsCache.filter(s => s.id !== sessionId);
      }

      if (activeChatId === sessionId) {
        if (nextChat) {
          // 仅走一条切换路径，避免 loadSession + renderHistory 双重重渲染
          await loadSession(nextChat.id, nextChat.title);
        } else {
          await newChat({ createRemote: false });
          await renderHistoryFromServer(false);
        }
      } else {
        await renderHistoryFromServer(false);
      }
    } else {
      console.error('删除会话失败:', response.status);
    }
  } catch (err) {
    console.error('删除会话失败:', err);
  }
}

async function saveCurrentSessionToServer() {
  const chat = getChat();
  if (!chat || !chat.messages.length) return;
  const token = localStorage.getItem('token');
  try {
    if (chat.serverId) {
      await fetch(`/api/v1/chat/sessions/${chat.serverId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: chat.title })
      });
    } else {
      console.log('saveCurrentSessionToServer: 跳过创建会话，应在 newChat 中处理');
    }
  } catch (err) {
    console.error('保存会话失败:', err);
  }
}

async function saveMessageToSession(sessionId, role, content, toolBadge) {
  if (!sessionId) {
    console.error('saveMessageToSession: sessionId 为空，无法保存消息。');
    return null;
  }

  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/v1/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role, content, tool_badge: toolBadge })
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }
    const data = await res.json();
    console.log('消息已保存:', data);
    return data;
  } catch (err) {
    console.error('保存消息失败:', err);
    return null;
  }
}

function appendBubbleWithFile(m) {
  const welcomeEl = document.getElementById('welcome');
  if (welcomeEl) welcomeEl.remove();
  const el = document.getElementById('messages');
  if (!el) return;
  const t = new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `msg-row ${m.role}`;
  div.innerHTML = `
    <div class="msg-meta">${m.role === 'user' ? '您' : '律智助手'} · ${t}</div>
    <div class="msg-bubble">
      ${esc(m.content)}
      ${m.hasFile ? `<div class="file-preview-msg"><span class="file-icon">📄</span><span class="file-name">${esc(m.fileName)}</span></div>` : ''}
    </div>
  `;
  el.appendChild(div);
  scrollBot();
}

function formatReviewResult(data) {
  let html = '<div class="review-result">';
  if (data.风险点识别) {
    html += `<div class="risk-item"><strong>🔍 风险点识别：</strong>${esc(data.风险点识别)}</div>`;
  }
  if (data.风险等级) {
    const levelClass = data.风险等级 === '高' ? 'risk-high' : (data.风险等级 === '中' ? 'risk-med' : 'risk-low');
    html += `<div class="risk-item"><strong>📊 风险等级：</strong><span class="risk-tag ${levelClass}">${esc(data.风险等级)}</span></div>`;
  }
  if (data.修改建议) {
    html += `<div class="risk-item"><strong>✏️ 修改建议：</strong>${esc(data.修改建议)}</div>`;
  }
  if (data.法律依据) {
    html += `<div class="risk-item"><strong>⚖️ 法律依据：</strong>${esc(data.法律依据)}</div>`;
  }
  html += '</div>';
  return html;
}

function buildSessionTitleFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '新对话';
  return raw.slice(0, 22) + (raw.length > 22 ? '…' : '');
}

async function initChatApp() {
  if (isInitialized) {
    console.log('Chat app already initialized, skipping');
    return;
  }
  isInitialized = true;
  
  console.log('Initializing chat app...');
  const sessions = await fetchSessions(true);
  
  if (sessions.length > 0) {
    const sortedSessions = [...sessions].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
    const latestSession = sortedSessions[0];
    await loadSession(latestSession.id, latestSession.title);
  } else {
    await newChat();
    await renderHistoryFromServer();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatApp);
} else {
  initChatApp();
}

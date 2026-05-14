// 通用工具函数
function scrollBot() {
  const m = document.getElementById('messages');
  if (m) m.scrollTop = m.scrollHeight;
}

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ✅ 修复：统一使用 window.isLoading，并在 chat.js 中也使用 window.isLoading
function setLoading(on) {
  // 同时设置两种方式
  if (typeof isLoading !== 'undefined') {
    isLoading = on;
  }
  window.isLoading = on;
  
  const b = document.getElementById('send-btn');
  if (b) {
    b.disabled = on;
    b.classList.toggle('loading', on);
  }
}

function logout() {
  console.log('退出登录');
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/login.html';
}

// 显示用户信息
function loadUserInfo() {
  const userId = localStorage.getItem('userId');
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    if (userId) {
      userNameEl.textContent = `用户${userId.slice(-6)}`;
    } else {
      userNameEl.textContent = '法律助手';
    }
  }
}

// ✅ 优化：带重试的 fetch 函数，只对网络错误和 5xx 错误重试
async function fetchWithRetry(url, options, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // 成功或客户端错误（4xx）直接返回，不重试
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      // 5xx 服务器错误，重试
      if (response.status >= 500 && i < maxRetries - 1) {
        console.warn(`请求失败 (${response.status})，正在重试... (第 ${i + 1} 次)`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      
      return response; // 最后一次尝试，直接返回
      
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        console.warn(`网络请求失败，正在重试... (第 ${i + 1} 次)`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      } else {
        console.error(`网络请求失败，已达最大重试次数 (${maxRetries})`, error);
        throw error;
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after multiple retries');
}

// 消息备份系统
const MessageBackup = {
  backup: function(chatId, message) {
    try {
      const key = `backup_${chatId}`;
      const backups = JSON.parse(localStorage.getItem(key) || '[]');
      backups.push({ ...message, backupTime: Date.now() });
      localStorage.setItem(key, JSON.stringify(backups));
      console.log('消息已备份到本地:', message);
    } catch (error) {
      console.error('消息备份失败:', error);
    }
  },

  // ✅ 修复：添加函数存在性检查
  retry: async function(chatId) {
    const key = `backup_${chatId}`;
    const backups = JSON.parse(localStorage.getItem(key) || '[]');
    if (backups.length === 0) return;

    // ✅ 检查 saveMessageToSession 是否存在
    if (typeof saveMessageToSession !== 'function') {
      console.warn('saveMessageToSession 未定义，无法重发备份消息');
      return;
    }

    console.log(`正在尝试重发 ${backups.length} 条备份消息...`);
    const successful = [];
    for (const msg of backups) {
      try {
        const result = await saveMessageToSession(chatId, msg.role, msg.content, msg.toolBadge);
        if (result) {
          successful.push(msg);
        }
      } catch (error) {
        console.error('重发备份消息失败:', error);
      }
    }

    const remaining = backups.filter(msg => !successful.includes(msg));
    localStorage.setItem(key, JSON.stringify(remaining));
    console.log(`成功重发 ${successful.length} 条消息，剩余 ${remaining.length} 条。`);
  },

  cleanup: function(expireHours = 24) {
    const expireTime = Date.now() - (expireHours * 60 * 60 * 1000);
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('backup_')) {
        try {
          const backups = JSON.parse(localStorage.getItem(key));
          if (Array.isArray(backups)) {
            const filtered = backups.filter(msg => msg.backupTime > expireTime);
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch (error) {
          console.error('清理备份失败:', error);
        }
      }
    });
  }
};

// 错误处理工具
const ErrorHandler = {
  handle: function(error, context = '') {
    console.error(`[${context}] 错误:`, error);
    // 可选：显示用户友好的错误提示
    // alert(`操作失败: ${error.message || '未知错误'}`);
  }
};
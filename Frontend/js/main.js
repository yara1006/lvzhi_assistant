// 删除这行
// window.currentTool = 'chat';

// 检查登录状态
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

// 配置
window.CONFIG = window.YUANQI_CONFIG || { DEMO_MODE: true };

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', async () => {
  console.log('页面加载开始...');
  
  // 绑定登出按钮
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      logout();
      return false;
    };
  }
  
  // 加载用户信息
  loadUserInfo();
  
  // ✅ chat.js 会自动初始化，这里不再重复调用
  
  // 绑定输入框事件
  const inputEl = document.getElementById('user-input');
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // 绑定模态框关闭
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) el.classList.remove('open');
    });
  });
  
  // ========== 文件上传功能 ==========
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');
  
  if (attachBtn && fileInput) {
    attachBtn.onclick = () => {
      fileInput.click();
    };
    
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 20 * 1024 * 1024) {
        alert('文件过大，请上传小于20MB的文件');
        fileInput.value = '';
        return;
      }
      
      window.pendingFile = file;
      
      const existingPreview = document.getElementById('pendingFilePreview');
      if (existingPreview) existingPreview.remove();
      
      const filePreview = document.createElement('div');
      filePreview.id = 'pendingFilePreview';
      filePreview.className = 'file-preview-msg';
      filePreview.innerHTML = `
        <span class="file-icon">📄</span>
        <span class="file-name">${file.name}</span>
        <span style="cursor:pointer; margin-left:8px; color:var(--red-law);" onclick="this.parentElement.remove(); window.pendingFile = null;">✕</span>
      `;
      
      const inputWrap = document.querySelector('.input-wrap');
      if (inputWrap) {
        inputWrap.parentNode.insertBefore(filePreview, inputWrap.nextSibling);
      }
    };
  }
  
  console.log('页面加载完成');
});
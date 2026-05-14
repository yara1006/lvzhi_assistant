// ✅ 删除这行，避免与 chat.js 冲突
// let currentTool = 'chat';

// 当前选中的合同类型（挂到 window，跨文件和重渲染更稳定）
window.selectedContractType = window.selectedContractType || '';

// 15种合同类型的默认提示词模板
const contractTemplates = {
  "借款合同": "帮我起草一份借款合同，出借方为【出借人姓名】，借款方为【借款人姓名】。借款金额为【金额】元，借款用途为【用途】。借款期限为【X】个月/年，年利率为【X】%。还款方式为【到期一次性还本付息】。请注明双方权利义务、违约责任、提前还款条款及争议解决方式。",
  "劳动合同": "帮我起草一份劳动合同，用人单位为【公司名称】，劳动者为【姓名】。工作岗位为【岗位名称】，月工资为【金额】元，试用期为【X】个月，合同期限为【X】年。请包含社会保险、工作时间、休息休假、解除条件等必备条款。",
  "房屋租赁": "帮我起草一份房屋租赁合同，出租方为【房东姓名】，承租方为【租客姓名】。房屋地址为【地址】，月租金为【金额】元，押金为【X】个月租金，租期为【X】个月。请注明维修责任、提前解约条款及押金退还条件。",
  "买卖合同": "帮我起草一份买卖合同，买方为【买方名称】，卖方为【卖方名称】。标的物为【产品名称】，数量为【X】，单价为【金额】元。请注明质量标准、验收方式、付款条件及违约责任。",
  "服务合同": "帮我起草一份服务合同，委托方为【甲方名称】，服务方为【乙方名称】。服务内容为【描述】，服务费用为【金额】元。请注明服务标准、付款方式、保密条款及违约责任。",
  "技术合同": "帮我起草一份技术合同，委托方为【甲方名称】，开发方为【乙方名称】。技术项目为【项目名称】，开发费用为【金额】元。请注明知识产权归属、验收标准及保密义务。",
  "合作协议": "帮我起草一份合作协议，甲方为【甲方名称】，乙方为【乙方名称】。合作内容为【事项】，双方出资比例为【X:Y】。请注明利润分配、退出机制及争议解决。",
  "委托合同": "帮我起草一份委托合同，委托人为【委托人姓名】，受托人为【受托人姓名】。委托事项为【事务】，委托费用为【金额】元。请注明受托人权限及违约责任。",
  "运输合同": "帮我起草一份运输合同，托运方为【托运人】，承运方为【承运人】。货物为【名称】，起运地为【地点】，目的地为【地点】。请注明货损责任及保险条款。",
  "仓储合同": "帮我起草一份仓储合同，存货方为【存货人】，保管方为【保管人】。仓储物为【货物】，仓储费为【金额】元/月。请注明验收标准及违约责任。",
  "赠与合同": "帮我起草一份赠与合同，赠与人为【赠与人】，受赠人为【受赠人】。赠与财产为【描述】。请注明赠与条件及撤销权。",
  "担保合同": "帮我起草一份担保合同，债权人为【债权人】，债务人为【债务人】，担保人为【担保人】。担保金额为【金额】元。请注明担保方式及保证责任。",
  "租赁合同": "帮我起草一份租赁合同（非房屋），出租方为【出租人】，承租方为【承租人】。租赁物为【设备名称】，租金为【金额】元/月。请注明维护责任及损坏赔偿。",
  "购销合同": "帮我起草一份购销合同，供方为【供应商】，需方为【采购方】。产品为【名称】，数量为【X】，总价为【金额】元。请注明验收标准及违约责任。",
  "加工承揽合同": "帮我起草一份加工承揽合同，定作方为【甲方】，承揽方为【乙方】。加工标的为【产品】，加工费为【金额】元。请注明质量标准及验收方式。"
};

function openTool(tool) {
  console.log('切换到工具:', tool);
  
  if (tool === 'court') {
    window.open('http://42.193.138.163:8001', '_blank');
    return;
  }
  
  // 统一写入全局，避免作用域不一致
  window.currentTool = tool;
  console.log('currentTool 已设置为:', window.currentTool);
  
  // 保存当前会话
  if (typeof saveCurrentSessionToServer === 'function') {
    saveCurrentSessionToServer();
  }
  
  // 点击工具时按需新建界面（仅本地草稿，不立即落库）
  if (typeof newChat === 'function' && typeof getChat === 'function') {
    const chat = getChat();
    const needNewView =
      !chat ||
      !!chat.serverId ||
      (Array.isArray(chat.messages) && chat.messages.length > 0) ||
      (chat.tool_type || 'chat') !== tool;

    if (needNewView) {
      newChat({ createRemote: false, forceNew: false });
    }
  }
  
  // 根据工具类型设置标题和特殊逻辑
  const titleEl = document.getElementById('chat-title');
  if (tool === 'contract') {
    if (titleEl) titleEl.textContent = '📝 合同生成';
    showContractTemplateButtons();
  } else if (tool === 'law') {
    if (titleEl) titleEl.textContent = '📜 法条检索';
  } else if (tool === 'review') {
    if (titleEl) titleEl.textContent = '🛡 合同审查';
    const inputEl = document.getElementById('user-input');
    if (inputEl) {
      inputEl.placeholder = '📄 点击右侧 📎 按钮上传合同文件，或直接输入问题...';
    }
  } else if (tool === 'chat') {
    if (titleEl) titleEl.textContent = '💬 法律对话';
  }
}

// 显示合同模板按钮
function showContractTemplateButtons() {
  const contractTypes = Object.keys(contractTemplates);
  
  const buttonsHtml = `
    <div style="padding: 0;">
      <div style="font-size: 12px; font-weight: 500; margin-bottom: 8px; color: var(--ink);">📋 选择合同类型</div>
      <div class="contract-buttons-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
        ${contractTypes.map(type => `
          <button
            class="contract-type-btn"
            data-type="${type}"
            onclick="fillContractTemplate('${type}')"
            style="padding: 6px 8px; background: var(--paper-card); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; font-size: 11px; text-align: center; color: var(--ink); transition: all 0.2s; box-shadow: var(--shadow-sm);"
          >${type}</button>
        `).join('')}
      </div>
      <div style="font-size: 10px; color: var(--ink-muted); margin-top: 10px; padding-top: 6px; border-top: 1px solid var(--border);">
        💡 点击模板 → 自动填入输入框 → 将【】替换为实际信息 → 发送
      </div>
    </div>
  `;
  
  // ✅ 检查函数是否存在
  const chat = typeof getChat === 'function' ? getChat() : null;
  if (chat) {
    const msg = { role: 'assistant', content: buttonsHtml, ts: Date.now(), isHtml: true };
    chat.messages.push(msg);
    if (typeof renderMessages === 'function') renderMessages();
    if (typeof scrollBot === 'function') scrollBot();
  }
  
  // 兜底：即使内联 onclick 失效，也尝试在渲染后绑定一次
  setTimeout(() => {
    document.querySelectorAll('.contract-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const contractType = btn.getAttribute('data-type');
        fillContractTemplate(contractType);
      });
    });
  }, 50);
}

function fillContractTemplate(contractType) {
  // 关键：点击模板时立即更新合同类型
  window.selectedContractType = contractType;
  console.log('已选择合同类型:', window.selectedContractType);

  // 更新按钮高亮，便于可视化确认当前类型
  document.querySelectorAll('.contract-type-btn').forEach(btn => {
    const isActive = btn.getAttribute('data-type') === contractType;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.style.borderColor = 'var(--gold)';
      btn.style.boxShadow = '0 0 0 2px rgba(201,168,76,0.15)';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.boxShadow = 'var(--shadow-sm)';
    }
  });

  const template = contractTemplates[contractType];
  const inputEl = document.getElementById('user-input');
  if (inputEl) {
    inputEl.value = template;
    inputEl.focus();
    if (typeof autoResize === 'function') autoResize(inputEl);
  }
}

// ✅ 获取当前工具配置（使用正确的 API 路径）
function getCurrentToolConfig() {
  const tool = window.currentTool || 'chat';
  
  const configs = {
    chat: { title: '法律对话', apiUrl: '/api/v1/chat/completions' },
    law: { title: '法条检索', apiUrl: '/api/v1/legal/clauses/search' },
    contract: { title: '合同生成', apiUrl: '/api/v1/contracts/generate' },
    review: { title: '合同审查', apiUrl: '/api/v1/contracts/review' }
  };
  return configs[tool] || configs.chat;
}

async function callToolAPI(prompt, target, cursor) {
  const config = getCurrentToolConfig();
  const token = localStorage.getItem('token');
  const chat = (typeof getChat === 'function') ? getChat() : null;
  
  const tool = window.currentTool || 'chat';
  
  const resolveContractType = () => {
    // 1) 用户点击模板后的全局值
    if (window.selectedContractType) return window.selectedContractType;
    // 2) 若页面存在下拉选择，优先使用下拉值
    const selectVal = document.getElementById('contractTypeSelect')?.value;
    if (selectVal) return selectVal;
    // 3) 尝试从输入文本中识别模板类型
    const keys = Object.keys(contractTemplates);
    const hit = keys.find(k => String(prompt || '').includes(k));
    if (hit) return hit;
    // 4) 最后兜底
    return '通用合同';
  };

  let body = {};
  if (tool === 'contract') {
    const contractType = resolveContractType();
    body = { 
      session_id: chat?.serverId || null,
      contract_type: contractType,
      subject_matter: prompt, 
      extra_requirements: '',
      parties: ''
    };
    console.log('合同生成 - 类型:', contractType);
  } else if (tool === 'law') {
    body = {
      session_id: chat?.serverId || null,
      query: prompt
    };
  } else if (tool === 'review') {
    body = { contract_text: prompt };
  } else {
    // chat/completions 后端会在无 session_id 时自动创建会话。
    // 这里显式传入当前会话，避免重复创建新会话。
    body = {
      session_id: chat?.serverId || null,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    };
  }
  
  const url = config.apiUrl;
  console.log('调用 API:', url, '工具:', tool);
  
  let full = '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }
    
    const data = await res.json();
    let content =
      data.content ||
      data.message ||
      data.result ||
      data.response ||
      data.choices?.[0]?.message?.content ||
      JSON.stringify(data);

    // 避免将 {"response":"..."} 原样显示在聊天气泡中
    if (typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        content = parsed.content || parsed.message || parsed.result || parsed.response || content;
      } catch (_) {}
    }
    
    // 合同生成添加下载按钮（若后端已内嵌按钮则不重复追加）
    if (tool === 'contract' && data.contract_id && !String(content).includes('downloadContract(')) {
      content += `\n\n<button onclick="downloadContract('${data.contract_id}')" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: var(--gold, #c9a84c); color: var(--ink, #1a1a2e); text-decoration: none; border-radius: 6px; font-weight: 500; border: none; cursor: pointer;">📥 下载Word合同</button>`;
    }
    
    for (let i = 0; i < content.length; i++) {
      if (target) target.textContent += content[i];
      full += content[i];
      await new Promise(r => setTimeout(r, 5));
      if (i % 20 === 0 && typeof scrollBot === 'function') scrollBot();
    }
  } catch (err) {
    console.error('API 调用失败:', err);
    if (target) target.textContent = `请求失败：${err.message}`;
    full = target?.textContent || '';
  }
  return full;
}

// 下载合同
async function downloadContract(contractId) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  console.log('下载合同:', contractId, userId);
  
  try {
    const res = await fetch(`/api/v1/contracts/download/${contractId}?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${contractId}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log('下载成功');
    } else {
      const error = await res.json();
      console.error('下载失败:', error);
      alert('下载失败：' + (error.message || '未知错误'));
    }
  } catch (err) {
    console.error('下载失败:', err);
    alert('下载失败，请稍后重试');
  }
}

// 显示合同审查界面
function showContractReviewUI() {
  const chatView = document.getElementById('chatView');
  if (chatView) chatView.style.display = 'none';
  
  let reviewView = document.getElementById('contractReviewUI');
  if (reviewView) {
    reviewView.style.display = 'flex';
    return;
  }
  
  reviewView = document.createElement('div');
  reviewView.id = 'contractReviewUI';
  reviewView.className = 'chat-col';
  reviewView.style.display = 'flex';
  reviewView.innerHTML = `
    <div class="chat-header">
      <div class="chat-title">🛡 合同审查</div>
      <div class="chat-subtitle">上传合同文件或粘贴文本，AI将进行风险分析</div>
    </div>
    <div class="review-content">
      <div class="review-mode">
        <button class="mode-btn active" onclick="setReviewMode('file')">📄 上传文件</button>
        <button class="mode-btn" onclick="setReviewMode('text')">📝 粘贴文本</button>
      </div>
      
      <div id="reviewFileMode" class="review-mode-panel">
        <div class="upload-area" onclick="document.getElementById('reviewFile').click()">
          <div>📁 点击选择文件</div>
          <div class="upload-hint">支持 PDF、Word 格式，最大 20MB</div>
          <input type="file" id="reviewFile" accept=".pdf,.doc,.docx" style="display:none">
        </div>
        <div id="reviewFileName" class="file-info" style="display:none"></div>
      </div>
      
      <div id="reviewTextMode" class="review-mode-panel" style="display:none">
        <textarea id="reviewText" class="review-textarea" rows="10" placeholder="请在此粘贴合同文本..."></textarea>
      </div>
      
      <div class="review-focus">
        <label>审查重点（可选）：</label>
        <div class="focus-tags">
          <span data-focus="违约责任">违约责任</span>
          <span data-focus="付款条款">付款条款</span>
          <span data-focus="知识产权">知识产权</span>
          <span data-focus="保密条款">保密条款</span>
          <span data-focus="争议解决">争议解决</span>
        </div>
      </div>
      
      <div class="review-buttons">
        <button class="cancel-btn" onclick="backToChat()">返回</button>
        <button class="submit-btn" id="startReviewBtn">开始审查 →</button>
      </div>
    </div>
  `;
  
  const app = document.querySelector('.app');
  app.appendChild(reviewView);
  bindReviewEvents();
}

function bindReviewEvents() {
  const fileInput = document.getElementById('reviewFile');
  if (fileInput) {
    fileInput.onchange = (e) => {
      const fileName = e.target.files[0]?.name;
      const fileInfo = document.getElementById('reviewFileName');
      if (fileName) {
        fileInfo.textContent = `已选择：${fileName}`;
        fileInfo.style.display = 'block';
      }
    };
  }
  
  document.querySelectorAll('.focus-tags span').forEach(tag => {
    tag.onclick = () => tag.classList.toggle('active');
  });
  
  const startBtn = document.getElementById('startReviewBtn');
  if (startBtn) {
    startBtn.onclick = submitReview;
  }
}

function setReviewMode(mode) {
  const fileMode = document.getElementById('reviewFileMode');
  const textMode = document.getElementById('reviewTextMode');
  const btns = document.querySelectorAll('.mode-btn');
  
  btns.forEach(btn => btn.classList.remove('active'));
  
  if (mode === 'file') {
    fileMode.style.display = 'block';
    textMode.style.display = 'none';
    btns[0].classList.add('active');
  } else {
    fileMode.style.display = 'none';
    textMode.style.display = 'block';
    btns[1].classList.add('active');
  }
}

async function submitReview() {
  const token = localStorage.getItem('token');
  const isFileMode = document.getElementById('reviewFileMode').style.display !== 'none';
  
  const focuses = [];
  document.querySelectorAll('.focus-tags span.active').forEach(tag => {
    focuses.push(tag.textContent);
  });
  
  const formData = new FormData();
  
  if (isFileMode) {
    const file = document.getElementById('reviewFile').files[0];
    if (!file) {
      alert('请选择合同文件');
      return;
    }
    formData.append('file', file);
  } else {
    const text = document.getElementById('reviewText').value;
    if (!text.trim()) {
      alert('请粘贴合同文本');
      return;
    }
    await submitReviewByText(text, focuses);
    return;
  }
  
  if (focuses.length) {
    formData.append('notes', focuses.join('、'));
  }
  
  const userId = localStorage.getItem('userId');
  if (userId) {
    formData.append('user_id', userId);
  }
  
  const reviewUI = document.getElementById('contractReviewUI');
  const chatView = document.getElementById('chatView');
  if (reviewUI) reviewUI.style.display = 'none';
  if (chatView) chatView.style.display = 'flex';
  
  // ✅ 检查函数是否存在
  if (typeof newChat === 'function') newChat();
  if (typeof appendBubble === 'function') {
    appendBubble({ role: 'user', content: `上传合同文件进行审查${focuses.length ? `，重点：${focuses.join('、')}` : ''}`, ts: Date.now() });
    appendBubble({ role: 'assistant', content: '正在分析合同，请稍候...', ts: Date.now() });
  }
  
  try {
    const res = await fetch('/api/v1/contracts/review', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    
    const messagesEl = document.getElementById('messages');
    const lastMsg = messagesEl.lastChild;
    if (lastMsg && lastMsg.textContent.includes('正在分析')) {
      lastMsg.remove();
    }
    
    const result = data.result || data.message || '审查完成';
    if (typeof appendBubble === 'function') {
      appendBubble({ role: 'assistant', content: result, ts: Date.now() });
    }
  } catch (err) {
    console.error('审查失败:', err);
    const messagesEl = document.getElementById('messages');
    const lastMsg = messagesEl.lastChild;
    if (lastMsg && lastMsg.textContent.includes('正在分析')) {
      lastMsg.remove();
    }
    if (typeof appendBubble === 'function') {
      appendBubble({ role: 'assistant', content: `审查失败：${err.message}`, ts: Date.now() });
    }
  }
}

async function submitReviewByText(text, focuses) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  
  const reviewUI = document.getElementById('contractReviewUI');
  const chatView = document.getElementById('chatView');
  if (reviewUI) reviewUI.style.display = 'none';
  if (chatView) chatView.style.display = 'flex';
  
  if (typeof newChat === 'function') newChat();
  if (typeof appendBubble === 'function') {
    appendBubble({ role: 'user', content: `合同文本审查${focuses.length ? `，重点：${focuses.join('、')}` : ''}\n\n${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`, ts: Date.now() });
    appendBubble({ role: 'assistant', content: '正在分析合同，请稍候...', ts: Date.now() });
  }
  
  try {
    const res = await fetch('/api/v1/contracts/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        contract_text: text,
        notes: focuses.join('、'),
        user_id: userId
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    
    const messagesEl = document.getElementById('messages');
    const lastMsg = messagesEl.lastChild;
    if (lastMsg && lastMsg.textContent.includes('正在分析')) {
      lastMsg.remove();
    }
    
    const result = data.result || data.message || '审查完成';
    if (typeof appendBubble === 'function') {
      appendBubble({ role: 'assistant', content: result, ts: Date.now() });
    }
  } catch (err) {
    console.error('审查失败:', err);
    const messagesEl = document.getElementById('messages');
    const lastMsg = messagesEl.lastChild;
    if (lastMsg && lastMsg.textContent.includes('正在分析')) {
      lastMsg.remove();
    }
    if (typeof appendBubble === 'function') {
      appendBubble({ role: 'assistant', content: `审查失败：${err.message}`, ts: Date.now() });
    }
  }
}

function backToChat() {
  const reviewUI = document.getElementById('contractReviewUI');
  const chatView = document.getElementById('chatView');
  if (reviewUI) reviewUI.style.display = 'none';
  if (chatView) chatView.style.display = 'flex';
}

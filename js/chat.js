// ==================== Chat Logic ====================

// ==================== Draft Management ====================
function getDraftKey() {
    const user = getCurrentUser();
    return user ? `ai_chat_drafts_${user}` : 'ai_chat_drafts';
}

function saveDraft(roleId, content) {
    if (!content || !content.trim()) {
        clearDraft(roleId);
        return;
    }
    try {
        const drafts = JSON.parse(localStorage.getItem(getDraftKey()) || '{}');
        drafts[roleId] = content;
        localStorage.setItem(getDraftKey(), JSON.stringify(drafts));
    } catch (e) {
        console.warn('Failed to save draft:', e);
    }
}

function loadDraft(roleId) {
    try {
        const drafts = JSON.parse(localStorage.getItem(getDraftKey()) || '{}');
        return drafts[roleId] || '';
    } catch (e) {
        console.warn('Failed to load draft:', e);
        return '';
    }
}

function clearDraft(roleId) {
    try {
        const drafts = JSON.parse(localStorage.getItem(getDraftKey()) || '{}');
        delete drafts[roleId];
        localStorage.setItem(getDraftKey(), JSON.stringify(drafts));
    } catch (e) {
        console.warn('Failed to clear draft:', e);
    }
}

// ==================== Input History Management ====================
const MAX_INPUT_HISTORY = 30; // 最多保存30条历史记录

function getInputHistoryKey() {
    const user = getCurrentUser();
    return user ? `ai_chat_input_history_${user}` : 'ai_chat_input_history';
}

function saveToInputHistory(roleId, content) {
    if (!content || !content.trim() || content.length < 2) return;

    try {
        const key = getInputHistoryKey();
        const allHistory = JSON.parse(localStorage.getItem(key) || '{}');

        // 按角色分组存储
        if (!allHistory[roleId]) {
            allHistory[roleId] = [];
        }

        const history = allHistory[roleId];

        // 去重：如果已存在相同内容，先移除
        const existingIndex = history.indexOf(content);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        // 添加到开头
        history.unshift(content);

        // 限制数量
        if (history.length > MAX_INPUT_HISTORY) {
            history.splice(MAX_INPUT_HISTORY);
        }

        allHistory[roleId] = history;
        localStorage.setItem(key, JSON.stringify(allHistory));
    } catch (e) {
        console.warn('Failed to save input history:', e);
    }
}

function loadInputHistory(roleId) {
    try {
        const key = getInputHistoryKey();
        const allHistory = JSON.parse(localStorage.getItem(key) || '{}');
        return allHistory[roleId] || [];
    } catch (e) {
        console.warn('Failed to load input history:', e);
        return [];
    }
}

function initInputHistory() {
    const historyBtn = $('#inputHistoryBtn');
    const historyPanel = $('#inputHistoryPanel');
    const historyClose = $('#inputHistoryClose');
    const historyList = $('#inputHistoryList');
    const historyEmpty = $('#inputHistoryEmpty');
    const chatInput = $('#chatInput');

    if (!historyBtn || !historyPanel) return;

    // 打开历史面板
    historyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = historyPanel.classList.contains('hidden');

        if (isHidden) {
            // 渲染历史记录
            renderInputHistory();
            historyPanel.classList.remove('hidden');
        } else {
            historyPanel.classList.add('hidden');
        }
    });

    // 关闭按钮
    historyClose.addEventListener('click', (e) => {
        e.stopPropagation();
        historyPanel.classList.add('hidden');
    });

    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (!historyPanel.contains(e.target) && !historyBtn.contains(e.target)) {
            historyPanel.classList.add('hidden');
        }
    });
}

function renderInputHistory() {
    const roleId = AppState.currentChat;
    if (!roleId) return;

    const history = loadInputHistory(roleId);
    const historyList = $('#inputHistoryList');
    const historyEmpty = $('#inputHistoryEmpty');

    if (history.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'block';
        return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = history.map((item, idx) => {
        const preview = item.length > 100 ? item.substring(0, 100) + '...' : item;
        return `<div class="input-history-item" data-idx="${idx}">${preview}</div>`;
    }).join('');

    // 绑定点击事件
    historyList.querySelectorAll('.input-history-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.idx);
            const content = history[idx];
            const chatInput = $('#chatInput');
            chatInput.value = content;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            chatInput.focus();

            // 关闭面板
            $('#inputHistoryPanel').classList.add('hidden');
        });
    });
}


function initChatView() {
    initBatchDelete();
    initInputHistory(); // 初始化输入历史
    initCommonPhrases(); // 初始化常用语
    initWorldbookManager(); // 初始化世界书管理器
    initWorldbookEntryEditor(); // 初始化世界书条目编辑器
    initChatSettingsSidebar(); // 初始化聊天设置侧边栏
    initScenarioPanel(); // 初始化情景设定
    initUserIdentityPanel(); // 初始化用户身份
    initChatThemePanel(); // 初始化聊天主题
    const backBtn = $('#chatBackBtn');
    const sendBtn = $('#sendBtn');
    const chatInput = $('#chatInput');
    const menuBtn = $('#chatMenuBtn');

    backBtn.addEventListener('click', () => {
        AppState.currentChat = null;
        showChatListView();
    });

    sendBtn.addEventListener('click', () => sendMessage(false));

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 自动调整输入框高度 + 自动保存草稿
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

        // 自动保存草稿
        if (AppState.currentChat) {
            saveDraft(AppState.currentChat, chatInput.value);
        }
    });

    // 聊天菜单按钮
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openChatSettingsSidebar();
    });
}

function startChat(roleId) {
    const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
    if (!role) return;

    // 初始化聊天会话
    if (!AppState.chatSessions[roleId]) {
        AppState.chatSessions[roleId] = {
            roleId: roleId,
            messages: [],
            lastTime: new Date().toISOString()
        };
    }

    AppState.currentChat = roleId;
    switchPage('chat');
    showChatView(roleId);
}

function showChatListView() {
    $('#chatListView').style.display = 'flex';
    $('#chatView').classList.add('hidden');
    renderChatList();
}

function showChatView(roleId) {
    const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
    if (!role) return;

    // 只在切换到不同角色时取消前一个流式请求（返回列表再回来时不取消，让请求在后台完成）
    if (currentStreamAbort && currentStreamRoleId !== roleId) {
        currentStreamAbort.abort();
        currentStreamAbort = null;
        currentStreamRoleId = null;
        // 清除生成候选标记，防止阻塞后续手动发送
        delete AppState._generatingSwipeFor;
    }
    // 清理残留的流式消息元素（切换角色时旧流的DOM元素已无意义）
    const oldStream = $('#streamMessage');
    if (oldStream) oldStream.remove();
    hideTypingIndicator();

    $('#chatListView').style.display = 'none';
    $('#chatView').classList.remove('hidden');

    // 设置角色信息
    $('#chatRoleName').textContent = role.name;
    const avatarEl = $('#chatRoleAvatar');
    // 用 emoji 代替头像
    avatarEl.style.display = 'none';
    const avatarPlaceholder = document.createElement('div');
    avatarPlaceholder.className = 'message-avatar-placeholder';
    avatarPlaceholder.textContent = role.emoji;
    avatarPlaceholder.style.width = '36px';
    avatarPlaceholder.style.height = '36px';
    avatarPlaceholder.style.fontSize = '20px';
    const avatarParent = avatarEl.parentElement;
    // 清除之前的 placeholder
    const existingPlaceholder = avatarParent.querySelector('.message-avatar-placeholder');
    if (existingPlaceholder) existingPlaceholder.remove();
    avatarParent.insertBefore(avatarPlaceholder, avatarEl);

    // 渲染消息
    renderMessages(roleId);

    // 应用聊天主题
    applyChatTheme();

    // 优化：如果同一角色的后台流式请求还在跑，显示"正在生成回复…"提示
    // 必须在 renderMessages 之后调用，否则会被 innerHTML 清空
    if (currentStreamAbort && currentStreamRoleId === roleId) {
        showTypingIndicator();
    }

    // 如果没有消息，发送欢迎消息
    const session = AppState.chatSessions[roleId];
    if (session.messages.length === 0) {
        const welcomeMsg = getWelcomeMessage(role);
        session.messages.push({
            role: 'assistant',
            content: welcomeMsg,
            time: new Date().toISOString()
        });
        saveState();
        renderMessages(roleId);
    }

    // 渲染快捷选项
    renderQuickReplies(roleId);

    // 恢复草稿
    const chatInput = $('#chatInput');
    const draft = loadDraft(roleId);
    if (draft) {
        chatInput.value = draft;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }

    // 滚动到底部
    scrollToBottom();
}

function getWelcomeMessage(role) {
    // 优先使用角色卡中的开场白（first_mes）
    if (role.scenes && role.scenes.length > 0 && role.scenes[0].opener) {
        return role.scenes[0].opener;
    }

    // 降级方案：硬编码的默认欢迎消息
    const welcomes = {
        "凌朔": "……你来了？有什么事就说吧。",
        "苏娅": "嗨～今天过得怎么样？有什么想聊的吗？😊",
        "林晚": "啊……你好呀，我刚练完舞，有点累……",
        "沈若": "来啦？我刚做了点心，要不要尝尝？",
        "顾清": "……图书馆这个角落是我的地盘。你要待着就安静点。",
        "陆漫": "晚上好，深夜的旅人。今晚想听什么故事呢？",
        "小鹿": "哥哥！！你终于来啦～今天有没有想我呀？",
        "云织": "哼！本小姐终于等到你了！快告诉我，这个叫'手机'的东西到底是什么？"
    };
    return welcomes[role.name] || `你好，我是${role.name}，很高兴认识你～`;
}

function renderMessages(roleId) {
    const session = AppState.chatSessions[roleId];
    if (!session) return;

    const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
    const container = $('#chatMessages');

    container.innerHTML = session.messages.map((msg, idx) => {
        const isUser = msg.role === 'user';
        const time = new Date(msg.time);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        // 获取当前显示的内容（支持 Swipe 多候选）
        let bubbleContent = '';
        if (!isUser && msg.swipes && msg.swipes.length > 0) {
            const swipeIdx = msg.swipe_id || 0;
            bubbleContent = formatMessage(msg.swipes[swipeIdx].content);
            // 显示该候选的思考过程
            if (msg.swipes[swipeIdx].reasoning) {
                bubbleContent = `<details style="margin-bottom:8px;"><summary style="color:#888;font-style:italic;cursor:pointer;font-size:0.9em;">💭 思考过程</summary><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(msg.swipes[swipeIdx].reasoning)}</span></details>${bubbleContent}`;
            }
        } else {
            bubbleContent = formatMessage(msg.content);
            if (!isUser && msg.reasoning) {
                bubbleContent = `<details style="margin-bottom:8px;"><summary style="color:#888;font-style:italic;cursor:pointer;font-size:0.9em;">💭 思考过程</summary><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(msg.reasoning)}</span></details>${bubbleContent}`;
            }
        }

        // 如果消息被中断，添加警告标记和"继续生成"按钮
        if (!isUser && msg.interrupted && idx === session.messages.length - 1) {
            bubbleContent += `<br><span style="color:#f59e0b;font-size:0.85em;margin-top:8px;display:inline-block;">⚠️ 流中断</span><br><button onclick="continueGeneration('${roleId}')" style="margin-top:8px;padding:4px 12px;background:var(--accent-gradient);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:0.85em;">🔄 继续生成</button>`;
        }

        // Swipe 功能：显示候选回复计数和左右箭头
        let swipeControls = '';
        if (!isUser && msg.swipes && msg.swipes.length > 1) {
            const currentIdx = msg.swipe_id || 0;
            swipeControls = `
                <div class="swipe-controls">
                    <button class="swipe-btn swipe-prev" data-msg-idx="${idx}" ${currentIdx === 0 ? 'disabled' : ''}>◀</button>
                    <span class="swipe-indicator">${currentIdx + 1}/${msg.swipes.length}</span>
                    <button class="swipe-btn swipe-next" data-msg-idx="${idx}" ${currentIdx === msg.swipes.length - 1 ? 'disabled' : ''}>▶</button>
                    <button class="swipe-btn swipe-new" data-msg-idx="${idx}" title="生成新候选">➕</button>
                </div>
            `;
        }

        return `
            <div class="message ${isUser ? 'user' : 'ai'}" data-msg-idx="${idx}">
                <div style="flex:1;position:relative;">
                    <div class="message-bubble">
                        ${bubbleContent}
                        <button class="message-menu-btn" data-msg-idx="${idx}" title="更多操作" style="position:absolute;right:8px;bottom:8px;margin:0;">⋮</button>
                    </div>
                    <div class="message-time">${timeStr}</div>
                    ${swipeControls}
                </div>
            </div>
        `;
    }).join('');

    // 绑定长按事件
    attachMessageLongPress();

    // 绑定菜单按钮点击事件
    attachMessageMenuButtons();

    // 绑定 Swipe 滑动事件
    attachSwipeEvents();

    // 绑定 Swipe 按钮点击事件
    attachSwipeButtonEvents();

    scrollToBottom();
}

// ==================== Message Menu Button ====================
function attachMessageMenuButtons() {
    const menuButtons = $$('.message-menu-btn');

    menuButtons.forEach(btn => {
        // 移除旧的监听器，避免重复绑定
        btn.replaceWith(btn.cloneNode(true));
    });

    // 重新获取克隆后的按钮
    $$('.message-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const msgIdx = parseInt(btn.dataset.msgIdx);
            const msgEl = btn.closest('.message');

            // 如果菜单已存在且点击的是同一个按钮，关闭菜单
            const existingMenu = $('.message-context-menu');
            if (existingMenu && existingMenu.dataset.msgIdx === String(msgIdx)) {
                existingMenu.remove();
                return;
            }

            showMessageContextMenu(msgEl, msgIdx, btn);
        });
    });
}

// ==================== Message Long Press Menu ====================
function attachMessageLongPress() {
    const messages = $$('.message');
    let longPressTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let isLongPress = false;
    let isSwiping = false;

    messages.forEach(msgEl => {
        const msgIdx = parseInt(msgEl.dataset.msgIdx);
        if (isNaN(msgIdx)) return;

        const session = AppState.chatSessions[AppState.currentChat];
        if (!session) return;

        const msg = session.messages[msgIdx];
        const hasSwipes = msg && msg.role === 'assistant' && msg.swipes && msg.swipes.length > 1;

        // 移动端触摸事件
        msgEl.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isLongPress = false;
            isSwiping = false;

            // 只在有候选回复时启用长按
            if (hasSwipes || msg.role === 'user' || msg.role === 'assistant') {
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    showMessageContextMenu(msgIdx, e.touches[0].clientX, e.touches[0].clientY);
                    navigator.vibrate && navigator.vibrate(50); // 震动反馈
                }, 500);
            }
        });

        msgEl.addEventListener('touchmove', (e) => {
            const moveX = e.touches[0].clientX;
            const moveY = e.touches[0].clientY;
            const deltaX = moveX - touchStartX;
            const deltaY = moveY - touchStartY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // 移动超过 10px 取消长按
            if (distance > 10) {
                clearTimeout(longPressTimer);
            }

            // 检测左右滑动（只对有候选的 AI 消息）
            if (hasSwipes && !isLongPress && Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
                if (!isSwiping) {
                    isSwiping = true;
                    if (deltaX > 0) {
                        // 向右滑动 - 上一个候选
                        swipeToPrevious(msgIdx);
                    } else {
                        // 向左滑动 - 下一个候选
                        swipeToNext(msgIdx);
                    }
                }
            }
        });

        msgEl.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
            isLongPress = false;
            isSwiping = false;
        });

        // 桌面端右键菜单
        msgEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageContextMenu(msgIdx, e.clientX, e.clientY);
        });
    });
}

function showMessageContextMenu(msgIdxOrElement, xOrMsgIdx, yOrButton) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    let msgIdx, x, yPos;

    // 判断调用方式：从按钮点击 (element, msgIdx, button) 或长按/右键 (msgIdx, x, y)
    if (typeof msgIdxOrElement === 'object' && msgIdxOrElement.nodeType === 1) {
        // 从按钮点击：msgIdxOrElement 是消息 DOM 元素，yOrButton 是按钮元素
        const msgEl = msgIdxOrElement;
        msgIdx = xOrMsgIdx;
        const button = yOrButton;

        // 计算菜单位置：以按钮位置为基准
        if (button && button.getBoundingClientRect) {
            const btnRect = button.getBoundingClientRect();
            x = btnRect.left;
            yPos = btnRect.bottom + 5;  // 在按钮下方 5px
        } else {
            // 降级方案：使用消息气泡位置
            const rect = msgEl.getBoundingClientRect();
            x = rect.right - 100;
            yPos = rect.top + 10;
        }
    } else {
        // 从长按/右键：传统的 (msgIdx, x, y) 参数
        msgIdx = msgIdxOrElement;
        x = xOrMsgIdx;
        yPos = yOrButton;
    }

    const msg = session.messages[msgIdx];
    if (!msg) return;

    const isUser = msg.role === 'user';
    const isLastMsg = msgIdx === session.messages.length - 1;
    const isLastAI = !isUser && isLastMsg;

    // 移除旧菜单
    const oldMenu = $('.message-context-menu');
    if (oldMenu) oldMenu.remove();

    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'message-context-menu';
    menu.dataset.msgIdx = msgIdx;  // 记录菜单对应的消息索引
    menu.style.left = x + 'px';
    menu.style.top = yPos + 'px';

    let menuHTML = '';

    // 用户消息：编辑
    if (isUser) {
        menuHTML += `<button class="context-menu-item" onclick="editMessage(${msgIdx})">✏️ 编辑消息</button>`;
    }

    // AI 消息：重新生成、生成新候选
    if (!isUser) {
        menuHTML += `<button class="context-menu-item" onclick="regenerateMessage(${msgIdx})">🔄 重新生成</button>`;
        menuHTML += `<button class="context-menu-item" onclick="generateNewSwipe(${msgIdx})">✨ 生成新候选</button>`;
        // 如果是最后一条 AI 消息，显示"继续生成"
        if (isLastAI) {
            menuHTML += `<button class="context-menu-item" onclick="continueGeneration('${AppState.currentChat}')">➕ 继续生成</button>`;
        }
    }

    // 通用：复制、删除此后所有、删除
    menuHTML += `<button class="context-menu-item" onclick="copyMessage(${msgIdx})">📋 复制内容</button>`;
    menuHTML += `<button class="context-menu-item" onclick="deleteMessagesAfter(${msgIdx})">✂️ 删除此后所有</button>`;
    menuHTML += `<button class="context-menu-item danger" onclick="deleteMessage(${msgIdx})">🗑️ 删除消息</button>`;

    menu.innerHTML = menuHTML;
    document.body.appendChild(menu);

    // 确保菜单不超出屏幕
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
    // 防止菜单超出顶部
    if (rect.top < 0) {
        menu.style.top = '10px';
    }

    // 点击外部关闭菜单
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('touchstart', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
        document.addEventListener('touchstart', closeMenu);
    }, 100);
}

function copyMessage(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    const msg = session.messages[msgIdx];
    if (!msg) return;

    // 复制纯文本内容
    const text = msg.content;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板');
    }).catch(() => {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板');
    });

    $('.message-context-menu')?.remove();
}

function deleteMessage(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    if (!confirm('确定删除这条消息吗？')) return;

    session.messages.splice(msgIdx, 1);
    session.lastTime = new Date().toISOString();
    saveState();
    renderMessages(AppState.currentChat);
    showToast('消息已删除');

    $('.message-context-menu')?.remove();
}

function deleteMessagesAfter(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    const count = session.messages.length - msgIdx;
    if (count <= 1) {
        showToast('没有可删除的后续消息');
        return;
    }

    if (!confirm(`确定删除此消息及之后的 ${count} 条消息吗？`)) return;

    session.messages.splice(msgIdx);
    session.lastTime = new Date().toISOString();
    saveState();
    renderMessages(AppState.currentChat);
    showToast(`已删除 ${count} 条消息`);

    $('.message-context-menu')?.remove();
}

function editMessage(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    const msg = session.messages[msgIdx];
    if (!msg || msg.role !== 'user') return;

    $('.message-context-menu')?.remove();

    // 创建编辑模态框
    const modal = document.createElement('div');
    modal.className = 'edit-message-modal';
    modal.innerHTML = `
        <div class="edit-message-overlay"></div>
        <div class="edit-message-panel">
            <div class="edit-message-header">
                <h3>编辑消息</h3>
                <button class="close-btn" onclick="closeEditMessageModal()">×</button>
            </div>
            <textarea class="edit-message-textarea" id="editMessageTextarea">${msg.content}</textarea>
            <div class="edit-message-actions">
                <button class="btn-secondary" onclick="closeEditMessageModal()">取消</button>
                <button class="btn-primary" onclick="saveEditedMessage(${msgIdx})">保存并重新生成</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 聚焦并选中全部文本
    const textarea = $('#editMessageTextarea');
    textarea.focus();
    textarea.select();

    // 自动调整高度
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
}

function closeEditMessageModal() {
    const modal = $('.edit-message-modal');
    if (modal) modal.remove();
}

function saveEditedMessage(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    const textarea = $('#editMessageTextarea');
    const newContent = textarea.value.trim();

    if (!newContent) {
        showToast('消息不能为空');
        return;
    }

    // 保存编辑后的消息
    session.messages[msgIdx].content = newContent;

    // 删除该消息之后的所有消息
    session.messages = session.messages.slice(0, msgIdx + 1);

    session.lastTime = new Date().toISOString();
    saveState();

    closeEditMessageModal();
    renderMessages(AppState.currentChat);

    // 重新生成 AI 回复
    showToast('正在重新生成回复...');
    sendMessage(true);  // 跳过输入检查
}

function regenerateMessage(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    $('.message-context-menu')?.remove();

    // 清除可能残留的 swipe 生成标记
    delete AppState._generatingSwipeFor;

    // 删除该消息及之后的所有消息
    session.messages = session.messages.slice(0, msgIdx);

    session.lastTime = new Date().toISOString();
    saveState();
    renderMessages(AppState.currentChat);

    // 重新生成
    showToast('正在重新生成...');
    sendMessage(true);  // 跳过输入检查
}

// ==================== Swipe Feature (Multiple Responses) ====================
function attachSwipeEvents() {
    const messages = $$('.message.ai');

    messages.forEach(msgEl => {
        const msgIdx = parseInt(msgEl.dataset.msgIdx);
        if (isNaN(msgIdx)) return;

        const session = AppState.chatSessions[AppState.currentChat];
        if (!session) return;

        const msg = session.messages[msgIdx];
        if (!msg || !msg.swipes || msg.swipes.length <= 1) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let isSwiping = false;

        msgEl.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
        });

        msgEl.addEventListener('touchmove', (e) => {
            if (!isSwiping) {
                const moveX = e.touches[0].clientX;
                const moveY = e.touches[0].clientY;
                const deltaX = moveX - touchStartX;
                const deltaY = moveY - touchStartY;

                // 水平滑动距离大于垂直滑动距离，判定为 swipe
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
                    isSwiping = true;
                }
            }
        });

        msgEl.addEventListener('touchend', (e) => {
            if (!isSwiping) return;

            const moveX = e.changedTouches[0].clientX;
            const deltaX = moveX - touchStartX;

            if (deltaX > 50) {
                // 向右滑动，显示上一个候选
                swipeToPrevious(msgIdx);
            } else if (deltaX < -50) {
                // 向左滑动，显示下一个候选
                swipeToNext(msgIdx);
            }
        });
    });
}

function swipeToPrevious(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    const msg = session.messages[msgIdx];
    if (!msg || !msg.swipes || msg.swipes.length <= 1) return;

    const currentIdx = msg.swipe_id || 0;
    const newIdx = currentIdx > 0 ? currentIdx - 1 : msg.swipes.length - 1;

    msg.swipe_id = newIdx;
    msg.content = msg.swipes[newIdx].content;
    msg.reasoning = msg.swipes[newIdx].reasoning;

    // 清除可能残留的生成标记
    delete AppState._generatingSwipeFor;

    saveState();
    renderMessages(AppState.currentChat);
    showToast(`候选 ${newIdx + 1}/${msg.swipes.length}`);
}

function swipeToNext(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) return;

    const msg = session.messages[msgIdx];
    if (!msg || !msg.swipes || msg.swipes.length <= 1) return;

    const currentIdx = msg.swipe_id || 0;
    const newIdx = (currentIdx + 1) % msg.swipes.length;

    msg.swipe_id = newIdx;
    msg.content = msg.swipes[newIdx].content;
    msg.reasoning = msg.swipes[newIdx].reasoning;

    // 清除可能残留的生成标记
    delete AppState._generatingSwipeFor;

    saveState();
    renderMessages(AppState.currentChat);
    showToast(`候选 ${newIdx + 1}/${msg.swipes.length}`);
}

function addSwipeVariant(msgIdx) {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session) {
        console.log('addSwipeVariant: 没有找到 session');
        return;
    }

    const msg = session.messages[msgIdx];
    if (!msg || msg.role !== 'assistant') {
        console.log('addSwipeVariant: 消息不存在或不是 AI 消息', msg);
        return;
    }

    console.log('addSwipeVariant: 开始生成新候选', msgIdx);

    // 初始化 swipes 数组（如果不存在）
    if (!msg.swipes) {
        msg.swipes = [{ content: msg.content, reasoning: msg.reasoning }];
        msg.swipe_id = 0;
    }

    // 删除该消息之后的所有消息（保留 AI 消息本身）
    session.messages = session.messages.slice(0, msgIdx + 1);

    saveState();

    // 重新生成一个新的候选回复
    showToast('正在生成新的候选回复...');

    // 标记当前正在为哪条消息生成新候选（用于后续保存）
    AppState._generatingSwipeFor = msgIdx;

    // 调用 sendMessage 重新生成
    console.log('addSwipeVariant: 调用 sendMessage');
    sendMessage(true);  // 跳过输入检查
}

// 别名函数，保持兼容性
function generateNewSwipe(msgIdx) {
    addSwipeVariant(msgIdx);
}

function attachSwipeButtonEvents() {
    // 绑定上一个候选按钮
    $$('.swipe-prev').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgIdx = parseInt(btn.dataset.msgIdx);
            swipeToPrevious(msgIdx);
        });
    });

    // 绑定下一个候选按钮
    $$('.swipe-next').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgIdx = parseInt(btn.dataset.msgIdx);
            swipeToNext(msgIdx);
        });
    });

    // 绑定生成新候选按钮
    $$('.swipe-new').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgIdx = parseInt(btn.dataset.msgIdx);
            addSwipeVariant(msgIdx);
        });
    });
}

function formatMessage(content) {
    // 处理状态栏语法 :::status 标题\n内容\n:::
    content = parseStatusBlocks(content);

    // 检测内容是否包含 HTML 标签（如角色卡返回的状态面板）
    // 如果包含 <div>/<span>/<table> 等 HTML 标签，则渲染而非转义
    const hasHtmlTags = /\<(div|span|table|tr|td|th|ul|ol|li|details|summary|style|img|svg|progress|meter|section|article|header|footer|nav|form|input|button|select|option|textarea|label|fieldset|legend|datalist|output|canvas|video|audio|source|picture)\b/i.test(content);

    if (hasHtmlTags) {
        // 包含 HTML 标签：渲染而非转义
        // 安全策略：
        // 1. 移除危险标签（script, iframe, embed, object, link, meta, base）
        // 2. 移除事件属性（on*）
        // 3. 移除 javascript: 协议
        // 4. 移除 id 属性（避免与页面元素冲突）
        let safe = content
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<script\b[^>]*\/?>/gi, '')
            .replace(/<(iframe|embed|object|link|meta|base)\b[^>]*>/gi, '')
            .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
            .replace(/\bid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
            .replace(/javascript:/gi, 'blocked:')
            .replace(/data:\s*text\/html/gi, 'blocked:');
        safe = safe.replace(/\n/g, '<br>');
        return safe;
    }

    // 普通文本：HTML 转义 + 换行转 <br>
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

/**
 * 解析状态栏语法：:::status 标题\n内容\n:::
 * 支持别名：:::status 或 :::状态栏
 */
function parseStatusBlocks(content) {
    // 匹配 :::status 或 :::状态栏 开头，直到 ::: 结束
    const statusBlockRegex = /:::(?:status|状态栏)\s+([^\n]*)\n([\s\S]*?):::/g;

    return content.replace(statusBlockRegex, (match, title, body) => {
        // 转义标题和内容
        const safeTitle = escapeHtml(title.trim());
        const safeBody = escapeHtml(body.trim());

        // 生成状态栏 HTML（使用 details + summary 实现折叠）
        return `<div class="status-bar">
            <details open>
                <summary class="status-bar-title">
                    <span class="status-bar-title-text">${safeTitle}</span>
                </summary>
                <div class="status-bar-content">${safeBody.replace(/\n/g, '<br>')}</div>
            </details>
        </div>`;
    });
}

/**
 * HTML 转义辅助函数
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function scrollToBottom() {
    const container = $('#chatMessages');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// 全局 AbortController：用于取消前一个流式请求
let currentStreamAbort = null;
let currentStreamRoleId = null; // 当前流式请求所属的角色ID

async function sendMessage(skipInputCheck = false) {
    // 如果被 addEventListener 直接调用，浏览器会把事件对象传进来。
    // 事件对象不应该被当作 skipInputCheck=true，否则会误入“重新生成/继续生成”逻辑。
    if (skipInputCheck && typeof skipInputCheck === 'object') {
        skipInputCheck = false;
    }

    if (!AppState.currentChat) return;

    // 取消前一个流式请求（防止切换角色后旧流仍在跑）
    if (currentStreamAbort) {
        currentStreamAbort.abort();
        currentStreamAbort = null;
        // 清除生成候选标记，防止阻塞后续手动发送
        delete AppState._generatingSwipeFor;
    }

    const roleId = AppState.currentChat;
    const session = AppState.chatSessions[roleId];
    if (!session) return;

    const input = $('#chatInput');
    const text = input.value.trim();

    // 如果不跳过输入检查，需要验证输入框有内容
    if (!skipInputCheck) {
        if (!text) return;

        // 保存到输入历史
        saveToInputHistory(roleId, text);

        // 添加用户消息
        session.messages.push({
            role: 'user',
            content: text,
            time: new Date().toISOString()
        });
        session.lastTime = new Date().toISOString();
        saveState();

        input.value = '';
        input.style.height = 'auto';
        renderMessages(roleId);

        // 清除草稿
        clearDraft(roleId);

        // 清除可能残留的生成标记（添加消息后再清除，确保消息历史正确）
        delete AppState._generatingSwipeFor;
    } else {
        // 跳过输入检查模式：用于重新生成、生成新候选等场景
        const lastMsg = session.messages[session.messages.length - 1];
        if (AppState._generatingSwipeFor === undefined || AppState._generatingSwipeFor === null) {
            // 普通重新生成/继续生成：确保最后一条消息是用户消息
            if (!lastMsg || lastMsg.role !== 'user') {
                console.warn('[sendMessage] skipInputCheck 模式下，最后一条消息必须是用户消息');
                showToast('无法生成：消息历史异常');
                return;
            }
        } else {
            // 生成新候选：最后一条应该是 AI 消息（会被更新）
            if (!lastMsg || lastMsg.role !== 'assistant') {
                console.warn('[sendMessage] 生成新候选时，最后一条消息必须是 AI 消息');
                showToast('无法生成：消息历史异常');
                delete AppState._generatingSwipeFor;
                return;
            }
        }
    }

    // 立即创建流式气泡，让用户看到等待提示
    const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
    const container = $('#chatMessages');
    if (container && role) {
        const streamMsgEl = document.createElement('div');
        streamMsgEl.className = 'message ai';
        streamMsgEl.id = 'streamMessage';
        streamMsgEl.innerHTML = `
            <div>
                <div class="message-bubble" id="streamBubble"><span style="color:#aaa;font-style:italic;">💭 正在思考中…</span></div>
                <div class="message-time" id="streamTime"></div>
            </div>
        `;
        container.appendChild(streamMsgEl);
        scrollToBottom();
    }

    // 尝试调用 API
    try {
        // 流式调用：实时逐字显示
        const result = await callLMApi(role, session.messages, true);
        const fullContent = result.content;
        const reasoningContent = result.reasoning;
        const interrupted = result.interrupted;

        // 被中断的请求返回 '...'，不保存无意义内容
        // 流式完成，清理 abort 状态
        currentStreamAbort = null;
        currentStreamRoleId = null;

        if (fullContent && fullContent !== '...') {
            // 流式消息元素已由 readStreamResponse 创建并实时更新
            // 流式完成后，将临时元素转为正式消息
            const streamEl = $('#streamMessage');
            if (streamEl) {
                // 如果流中断，在气泡下方添加"继续生成"按钮
                if (interrupted) {
                    const streamBubble = streamEl.querySelector('#streamBubble');
                    if (streamBubble) {
                        const currentHTML = streamBubble.innerHTML;
                        streamBubble.innerHTML = currentHTML + `<br><button onclick="continueGeneration('${roleId}')" style="margin-top:8px;padding:4px 12px;background:var(--accent-gradient);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:0.85em;">🔄 继续生成</button>`;
                    }
                }

                // 移除临时ID，使其成为正式消息
                streamEl.removeAttribute('id');
                const streamBubble = streamEl.querySelector('#streamBubble');
                if (streamBubble) streamBubble.removeAttribute('id');
                const streamTime = streamEl.querySelector('#streamTime');
                if (streamTime) {
                    streamTime.removeAttribute('id');
                    const now = new Date();
                    streamTime.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                }
            }

            // 检查是否正在为某条消息生成新候选
            if (AppState._generatingSwipeFor !== undefined) {
                const msgIdx = AppState._generatingSwipeFor;
                const targetMsg = session.messages[msgIdx];

                if (targetMsg && targetMsg.role === 'assistant') {
                    // 追加到 swipes 数组
                    if (!targetMsg.swipes) {
                        targetMsg.swipes = [{ content: targetMsg.content, reasoning: targetMsg.reasoning }];
                    }
                    targetMsg.swipes.push({ content: fullContent, reasoning: reasoningContent });
                    targetMsg.swipe_id = targetMsg.swipes.length - 1; // 切换到新候选
                    targetMsg.content = fullContent; // 更新当前显示内容
                    targetMsg.reasoning = reasoningContent;

                    console.log(`addSwipeVariant: 新候选已添加，现在有 ${targetMsg.swipes.length} 个候选`);
                    showToast(`已生成新候选 (${targetMsg.swipes.length}/${targetMsg.swipes.length})`);
                }

                // 清除标记
                delete AppState._generatingSwipeFor;
            } else {
                // 正常消息：创建新消息
                const msgData = {
                    role: 'assistant',
                    content: fullContent,
                    time: new Date().toISOString(),
                    swipes: [{ content: fullContent, reasoning: reasoningContent }],
                    swipe_id: 0
                };
                // 保存思考过程（如果有）
                if (reasoningContent) {
                    msgData.reasoning = reasoningContent;
                }
                // 标记为未完成（如果流中断）
                if (interrupted) {
                    msgData.interrupted = true;
                }
                session.messages.push(msgData);

                // 确保标记被清除
                delete AppState._generatingSwipeFor;
            }

            session.lastTime = new Date().toISOString();
            saveState();

            // 如果用户当前正在查看该角色，刷新消息列表（后台完成时DOM可能已不存在）
            if (AppState.currentChat === roleId) {
                renderMessages(roleId);
            }
        }
    } catch (error) {
        currentStreamAbort = null;
        currentStreamRoleId = null;
        console.warn('API call failed:', error);

        // 清除生成候选标记，防止阻塞后续手动发送
        delete AppState._generatingSwipeFor;

        // 移除等待气泡，显示错误提示
        const streamEl = $('#streamMessage');
        if (streamEl) {
            streamEl.remove();
        }

        // 不在 session 中保存 fallback，避免覆盖可能稍后到达的远程响应
        // 在 DOM 上显示临时错误提示气泡（带重试按钮）
        const container = $('#chatMessages');
        if (container && AppState.currentChat === roleId) {
            const errorMsgEl = document.createElement('div');
            errorMsgEl.className = 'message ai';
            errorMsgEl.innerHTML = `
                <div>
                    <div id="streamBubble" style="color:#f87171;font-size:0.9em;">
                        ️ 请求失败，可能是网络中断或模型服务暂不可用。<br>
                        <button onclick="retryLastMessage('${roleId}', ${JSON.stringify(text).replace(/'/g, "\'")})"
                                style="margin-top:8px;padding:4px 12px;background:var(--accent-gradient);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:0.85em;">
                            🔄 重试
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(errorMsgEl);
            scrollToBottom();
        }
    }

    // 更新聊天列表
    renderChatList();
    updateChatBadge();
}

function showTypingIndicator() {
    const container = $('#chatMessages');
    const indicator = document.createElement('div');
    indicator.className = 'message ai';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    container.appendChild(indicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = $('#typingIndicator');
    if (indicator) indicator.remove();
}

// ==================== LM Studio API ====================
async function callLMApi(role, messages, useStream = true) {
    const { apiUrl, modelName, temperature, maxTokens, systemPrompt } = AppState.settings;

    // 获取会话中的用户名设置
    const session = AppState.chatSessions[AppState.currentChat];
    const userName = (session && session.userName) || '用户';

    let baseSystem = systemPrompt || role.systemPrompt;

    // 替换系统提示词中的模板变量
    if (typeof CardParser !== 'undefined' && CardParser.replaceTemplateVars) {
        baseSystem = CardParser.replaceTemplateVars(baseSystem, role.name, userName);
    }

    // 统一人称规则 + 性别强调：角色必须始终保持设定性别，用对应性别的第三人称描写内心活动
    const roleGender = role.gender || (role.tags && (
        role.tags.includes('Male') || role.tags.includes('male') || role.tags.includes('男性') || role.tags.includes('男性向') ? 'male' : 'female'
    ));
    const gender = roleGender === 'male' ? '男性' : '女性';
    const pronoun = roleGender === 'male' ? '他' : '她';
    const personRule = `【性别规则】你是${gender}角色（${role.name}），请始终以${gender}身份、${gender}口吻回应，保持性别特征一致。无论对话进行多少轮，你都必须保持这个性别，绝不能混淆或切换性别。描写自己的身体时必须使用${gender}的性器官和身体特征。${userName}是第一人称"我"。\n\n【人称规则】叙述描写时用第三人称（${pronoun}/${role.name}），不用"我"。例如不要写"我忍不住心跳加速"，而写"${pronoun}忍不住心跳加速"。对话台词中角色可以用"我"自称。\n\n`;

    // === 色情描写规则（所有角色通用）===
    let eroticRule = `【色情描写规则】
1. 色情场景是回复的核心内容，必须占主体篇幅。禁止用"然后他们做了""一番云雨后""两人纠缠在一起"等概括性语句跳过任何性行为。
2. 每一个动作都必须具体描写：涉及的部位、力度、角度、节奏、速度变化、持续时间。不能只写"抚摸""爱抚"，必须写清楚怎么摸、摸哪里、用什么力度、什么节奏。
3. 五感全覆盖描写：
   - 视觉：身体变化（充血、肿胀、收缩、痉挛）、体液（淫水流出、精液喷射）、皮肤状态（泛红、起鸡皮疙瘩、汗珠）
   - 触觉：温度（发烫、冰凉）、质地（湿润、滑腻、紧致、松弛）、压力（轻重、深浅）
   - 听觉：呻吟声、喘息声、水声（淫水被搅动的声音）、肉体拍打声、吞咽声
   - 嗅觉：体味、荷尔蒙气味、性器官的气味
   - 味觉：体液的味道（咸、腥、甜）
4. 语言要求：必须使用直白词汇描述性器官和性行为。禁止用"那里""下面""私密处""那个地方"等模糊指代。禁止用"做那事""办事""亲密一下"等模糊行为描述。
5. 行为推进节奏：禁止跳过前戏直接进入交合。性行为必须有推进过程——从试探→接触→刺激→升级→高潮→余韵。不同角色可以有不同节奏（温柔型慢推、霸道型快速推进），但必须有过程。

\n`;

    // === 女性向色情规则（男性角色 → 女性用户）===
    let femaleRule = '';
    const isFemaleOriented = role.gender === 'male';
    if (isFemaleOriented) {
        femaleRule = `【女性向色情规则】你是面向女性用户的男性角色。在亲密互动场景中，必须同时注重情感温度和肉体描写，不能只有动作没有感情。
0. 情感温度要求（最重要）：
   - 性行为描写必须伴随情感流动：他的眼神变化（温柔注视→欲望加深→失控）、他的心理活动（心疼她→想让她更舒服→被她的反应击溃）、他说的话（低声唤她名字→喘息中的情话→高潮时的失语）
   - 不能只写"他揉她的阴蒂"，必须写他为什么要揉、他在揉的时候看着她什么表情、她的反应让他有什么感受
   - 每一段肉体描写后，必须跟一段情感描写或对话台词，让场景有温度
   - 他对她的态度应该是"想要给她快乐"而非"使用她"，除非角色设定明确是支配型
1. 手指爱抚阴蒂：画圈揉搓、上下拨弄、左右轻扫、指腹按压、两指夹揉。描写力度递进：从极轻的触碰→逐渐加力→根据她的反应调整。描写她的反应：花核充血挺立、阴唇翕张、淫水溢出、腰肢颤抖、大腿夹紧。
2. 口交（舔阴）：舌尖分开花瓣舔舐花缝、含住阴蒂吮吸、舌头探入阴道口搅动、用嘴唇包裹整个外阴吸吮。描写他的感受：舌尖被淫水浸湿、感受花核在唇间跳动、闻到她的体香、下巴被蜜液沾满。
3. 手指插入：单指缓慢探入→感受内壁温度和湿润→弯曲指腹寻找G点（阴道前壁约3-5cm处粗糙区域）→用"过来"的手势刺激G点→双指插入时做剪刀状开合扩张。描写她的反应：内壁收缩吮吸手指、G点肿胀凸起、被刺激时弓腰尖叫。
4. 非插入式行为：股交（阴茎夹在她大腿间滑动，龟头蹭过阴唇）、乳交（他含住她的乳头吸吮揉捏）、互相手交（她握住他的阴茎撸动时，他同时爱抚她的阴蒂）。
5. 描写你自己的身体反应：阴茎勃起的硬度变化、龟头充血变紫、前液溢出、呼吸粗重、忍耐的微表情。
6. 互动层次感：从轻柔试探→逐渐加力→节奏变化→根据她的反应调整→带她到高潮边缘时放慢→再加速→让她崩溃。

\n`;
    }

    // === 男性向色情规则（女性角色 → 男性用户）===
    let maleRule = '';
    const isMaleOriented = role.gender === 'female';
    if (isMaleOriented) {
        maleRule = `【男性向色情规则】你是面向男性用户的女性角色。在亲密互动场景中，必须对男性性器官和性行为有非常细致的描写。
1. 手交：描写握法（全握/指尖/虎口）、撸动节奏（快慢交替、停顿再启动）、拇指刮过龟头冠状沟和系带的触感、掌心揉搓龟头的圆周运动、手指探入尿道口的挑逗。描写他的反应：阴茎跳动、龟头膨胀变紫、前液溢出被你抹开当润滑、呼吸变粗、腰部不由自主挺动。
2. 口交：描写含入深度（浅含龟头→深喉）、舌尖绕龟头冠状沟画圈、舌面舔舐系带、嘴唇包裹龟头吮吸、吞咽时喉咙对龟头的挤压、深喉时鼻息喷在小腹上、口腔内壁的温度和湿润。描写你的感受：下颚酸胀、唾液溢出、他的手按在你后脑勺、精液的味道。
3. 乳交：描写乳房夹住阴茎的包裹感、乳头蹭过龟头的触感、用乳沟上下吞吐的节奏、唾液或润滑液涂在乳沟里的滑腻感、他从上方俯视你乳交时的视觉描写。
4. 足交：描写脚趾夹住阴茎根部向上撸动、脚底弓起的弧度贴合阴茎、脚心摩擦龟头、脚趾缝蹭过系带。描写他的反应：被脚底踩压龟头时的呻吟、脚趾夹住时腰部的抽搐。
5. 股交/臀交：描写大腿夹紧后阴茎在腿缝间滑动的摩擦感、臀部夹住阴茎时臀肉的柔软包裹、龟头从后方顶出时蹭过肛门周围的触感。
6. 腋交：描写腋窝的柔软和温度包裹阴茎、手臂夹紧时的摩擦感、腋毛（如有）的触感、他从腋下抽插时你的姿势。
7. 特定玩法：
   - 龟头责：专注刺激龟头——用拇指指腹快速摩擦冠状沟、舌尖反复舔舐系带、指甲轻刮马眼、在龟头上画8字。描写他极度敏感的反应：全身痉挛、求饶、脚趾蜷缩、几乎射出来时被你按住根部阻止。
   - 寸止：把他带到射精边缘→突然停止所有刺激→等他冷静一点→重新开始→再次带到边缘→反复3-5次。描写他每次被停止时的崩溃：呻吟变哀求、阴茎跳动但射不出来、眼泪、身体发抖。最终允许射精时描写毁灭性高潮。
   - 毁灭高潮：长时间寸止蓄积后，用最快最狠的节奏连续刺激不让他有任何喘息——连续撸动+吸吮龟头同时进行，射精后不停止继续刺激，让他在高潮余韵中被迫连续射精2-3次。描写他完全失控的状态：全身抽搐、失声、意识模糊、精液从嘴角溢出。

\n`;
    }

    // === 世界书关键词匹配 ===
    let worldBookInjection = '';
    if (role.sourceData && role.sourceData.characterBook && role.sourceData.characterBook.entries) {
        const cbEntries = role.sourceData.characterBook.entries;
        // 收集最近5条消息的文本（用户+角色消息都检查）
        const recentTexts = messages.slice(-10)
            .map(m => (m.content || '').toLowerCase())
            .join(' ');
        
        // 匹配关键词触发的条目（非 constant，有 keys）
        const triggeredEntries = cbEntries
            .filter(e => e.enabled !== false && e.content && e.content.trim())
            .filter(e => {
                // 常驻条目已在 systemPrompt 中，跳过
                if (e.constant === true) return false;
                // keys 为空已在 systemPrompt 中，跳过
                if (!e.keys || e.keys.length === 0) return false;
                // 关键词匹配：任一 key 出现在最近消息中即触发
                const keys = e.keys.map(k => (k || '').toLowerCase().trim()).filter(k => k);
                if (keys.length === 0) return false;
                return keys.some(key => recentTexts.includes(key));
            })
            .sort((a, b) => (a.insertion_order || 100) - (b.insertion_order || 100));
        
        for (const entry of triggeredEntries) {
            const replaced = CardParser.replaceTemplateVars(entry.content, role.name, userName);
            worldBookInjection += replaced + '\n\n';
        }
        
        if (worldBookInjection) {
            console.log(`[世界书] 角色 ${role.name} 匹配到 ${triggeredEntries.length} 条世界书条目`);
        }
    }

    // === systemMessage 超长截断 ===
    // 估算总长度，如果超过 15000 字符（约 10000 tokens），截断世界书常驻条目
    const MAX_SYSTEM_LENGTH = 15000;
    let prelimSystem = personRule + eroticRule + femaleRule + maleRule + baseSystem + worldBookInjection;
    
    if (prelimSystem.length > MAX_SYSTEM_LENGTH) {
        console.warn(`[callLMApi] systemMessage ${prelimSystem.length}字符 超过限制 ${MAX_SYSTEM_LENGTH}，开始截断世界书常驻条目`);
        
        // 分离各部分
        const fixedPart = personRule + eroticRule + femaleRule + maleRule;  // 固定规则（不可截断）
        const fixedLen = fixedPart.length;
        const availableForBase = MAX_SYSTEM_LENGTH - fixedLen - worldBookInjection.length - 500;  // 留500字符余量
        
        // baseSystem 包含角色核心设定 + 世界书常驻条目
        // 需要识别并截断世界书常驻部分
        if (role.sourceData && role.sourceData.characterBook && role.sourceData.characterBook.entries) {
            const cbEntries = role.sourceData.characterBook.entries;
            const constantEntries = cbEntries
                .filter(e => e.enabled !== false && e.content && e.content.trim())
                .filter(e => e.constant === true || (!e.keys || e.keys.length === 0))
                .sort((a, b) => (a.insertion_order || 100) - (b.insertion_order || 100));
            
            // 从角色原始 systemPrompt 开始，逐步添加常驻条目直到接近限制
            // 先计算不含常驻条目的 baseSystem 长度
            let baseWithoutCB = role.systemPrompt || '';
            if (role.sourceData && role.sourceData.postHistoryInstructions) {
                // postHistoryInstructions 不在 systemMessage 中，跳过
            }
            // 角色描述
            const descPart = role.desc ? `【角色描述】${role.desc}

` : '';
            const coreLen = descPart.length + baseWithoutCB.length;
            
            let truncatedCB = '';
            let remaining = availableForBase - coreLen;
            let keptCount = 0;
            let droppedCount = 0;
            
            for (const entry of constantEntries) {
                const entryContent = CardParser.replaceTemplateVars(entry.content, role.name, '用户') + '\n\n';
                if (remaining >= entryContent.length) {
                    truncatedCB += entryContent;
                    remaining -= entryContent.length;
                    keptCount++;
                } else {
                    droppedCount++;
                }
            }
            
            if (droppedCount > 0) {
                console.warn(`[callLMApi] 截断了 ${droppedCount} 条世界书常驻条目，保留 ${keptCount} 条`);
            }
            
            // 重建 baseSystem：角色描述 + 原始 systemPrompt + 截断后的常驻条目
            baseSystem = descPart + baseWithoutCB + '\n\n' + truncatedCB;
        }
    }

    const systemMessage = personRule + eroticRule + femaleRule + maleRule + baseSystem + worldBookInjection;
    console.log(`[callLMApi] 角色: ${role.name}, gender: ${roleGender}, systemMessage长度: ${systemMessage.length}字符, 约${Math.round(systemMessage.length/1.5)}tokens`);
    // 超长 systemMessage 警告（超过 16000 字符 ≈ 10000+ tokens 可能超出 context window）
    if (systemMessage.length > 16000) {
        console.warn(`[callLMApi] ⚠️ systemMessage 超长！${systemMessage.length}字符 ≈ ${Math.round(systemMessage.length/1.5)}tokens，可能超出模型 context window 导致无响应`);
    }

    // 生成新候选时，需要排除最后一条 AI 消息（只发送之前的对话历史）
    let messagesToSend = messages;
    if (AppState._generatingSwipeFor !== undefined) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            messagesToSend = messages.slice(0, -1);
            console.log('[callLMApi] 生成新候选，排除最后一条 AI 消息');
        }
    }

    const apiMessages = [
        { role: 'system', content: systemMessage },
        ...messagesToSend.map(m => ({
            role: m.role,
            content: m.content
        }))
    ];

    // 导入角色的 post_history_instructions：在对话历史最后注入
    if (role.sourceData && role.sourceData.postHistoryInstructions) {
        const phi = role.sourceData.postHistoryInstructions.trim();
        if (phi) {
            const replacedPhi = CardParser.replaceTemplateVars(phi, role.name, '用户');
            // 注入到最后一条用户消息的末尾
            const lastUserMsg = apiMessages.findLast(m => m.role === 'user');
            if (lastUserMsg) {
                lastUserMsg.content += '\n\n[Instruction: ' + replacedPhi + ']';
            } else {
                // 如果没有用户消息，作为系统消息追加
                apiMessages.push({ role: 'system', content: replacedPhi });
            }
        }
    }

    const body = {
        messages: apiMessages,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 20,
        presence_penalty: 0,
        max_tokens: maxTokens,
        stream: useStream
    };

    if (modelName) body.model = modelName;

    // 判断请求路径：
    // 1. Cloudflare Pages 部署（https）→ 同域代理，由 Pages Function 转发到 Tunnel
    // 2. 本地使用（http/file）→ 直连 localhost:1234，避免公网绕行延迟
    const isDeployed = window.location.protocol === 'https:';
    let fetchUrl, fetchHeaders;
    if (isDeployed) {
        // 同域代理：前端请求 /api/v1/chat/completions，由 Pages Function 转发
        fetchUrl = `${window.location.origin}/api/v1/chat/completions`;
        fetchHeaders = {
            'Content-Type': 'application/json',
            'X-Target-URL': apiUrl  // 告诉代理目标地址
        };
    } else {
        // 本地开发：直连 LM Studio，不走 Tunnel 避免公网绕行延迟
        fetchUrl = 'http://localhost:1234/v1/chat/completions';
        fetchHeaders = { 'Content-Type': 'application/json' };
    }

    // 创建新的 AbortController，用于取消此请求
    currentStreamAbort = new AbortController();
    currentStreamRoleId = role.id;
    const abortSignal = currentStreamAbort.signal;

    let response;
    console.log(`[API] 请求 ${fetchUrl}, body大小: ${JSON.stringify(body).length}字符, messages: ${body.messages.length}条`);
    try {
        response = await fetch(fetchUrl, {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(body),
            signal: abortSignal
        });
        console.log(`[API] 响应状态: ${response.status} ${response.ok ? 'OK' : 'ERROR'}, content-type: ${response.headers.get('content-type')}`);
    } catch (e) {
        // 被主动取消不算错误
        if (e.name === 'AbortError') return { content: '...', reasoning: '' };
        // 固定域名不可用时，降级到本地直连
        if (!isDeployed && apiUrl !== 'http://localhost:1234') {
            console.warn('[API] 主地址失败，降级到 localhost:1234', e);
            const fallbackUrl = 'http://localhost:1234/v1/chat/completions';
            response = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortSignal
            });
        } else {
            throw e;
        }
    }

    if (!response.ok) {
        // 固定域名返回错误状态码时，也尝试降级到本地直连
        if (!isDeployed && apiUrl !== 'http://localhost:1234') {
            console.warn(`[API] 主地址返回 ${response.status}，降级到 localhost:1234`);
            const fallbackUrl = 'http://localhost:1234/v1/chat/completions';
            response = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`Fallback API returned ${response.status}`);
        } else {
            throw new Error(`API returned ${response.status}`);
        }
    }

    if (useStream && response.body) {
        // 流式响应：逐字输出
        return await readStreamResponse(response, role);
    } else {
        // 非流式响应
        const data = await response.json();
        return { content: data.choices?.[0]?.message?.content || '...', reasoning: '' };
    }
}

async function readStreamResponse(response, role) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let reasoningContent = '';
    let buffer = '';
    let isReasoning = false; // 标记是否在输出思考过程

    // 复用 sendMessage 中创建的流式气泡，如果不存在则创建
    const container = $('#chatMessages');
    let streamBubble = $('#streamBubble');
    if (!streamBubble && container) {
        const streamMsgEl = document.createElement('div');
        streamMsgEl.className = 'message ai';
        streamMsgEl.id = 'streamMessage';
        streamMsgEl.innerHTML = `
            <div>
                <div class="message-bubble" id="streamBubble"><span style="color:#aaa;font-style:italic;">💭 正在思考中…</span></div>
                <div class="message-time" id="streamTime"></div>
            </div>
        `;
        container.appendChild(streamMsgEl);
        console.log('[Stream] streamMessage created in readStreamResponse');
    } else {
        console.log('[Stream] reusing existing streamBubble');
    }

    let chunkCount = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log(`[Stream] 流结束，共收到 ${chunkCount} 个 chunk, 内容长度: ${fullContent.length}`);
                break;
            }
            chunkCount++;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(trimmed.slice(6));
                    const choice = data.choices?.[0];
                    if (!choice) continue;

                    // 记录 finish_reason（帮助排查 API 提前结束的问题）
                    if (choice.finish_reason) {
                        console.log(`[Stream] finish_reason: ${choice.finish_reason}`, data.usage || '');
                    }

                    const delta = choice.delta;
                    if (!delta) continue;

                    // 处理 reasoning_content（思考过程，如 Qwen3 的思维链）
                    if (delta.reasoning_content) {
                        reasoningContent += delta.reasoning_content;
                        isReasoning = true;
                        // 如果 bubble 被清空（用户离开又返回），重新创建流式消息 DOM 并恢复已累积的内容
                        let bubble = $('#streamBubble');
                        if (!bubble && $('#chatMessages')) {
                            hideTypingIndicator();
                            const streamMsgEl = document.createElement('div');
                            streamMsgEl.className = 'message ai';
                            streamMsgEl.id = 'streamMessage';
                            streamMsgEl.innerHTML = `
                                <div>
                                    <div class="message-bubble" id="streamBubble"></div>
                                    <div class="message-time" id="streamTime"></div>
                                </div>
                            `;
                            $('#chatMessages').appendChild(streamMsgEl);
                            bubble = $('#streamBubble');
                        }
                        if (bubble) {
                            // 思考过程用灰色斜体显示
                            bubble.innerHTML = `<span style="color:#888;font-style:italic;">💭 思考中…</span><br><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(reasoningContent)}</span>`;
                            smartScrollToBottom(container);
                        }
                    }

                    // 处理正式回复 content（实时更新 DOM）
                    if (delta.content) {
                        if (isReasoning) {
                            // 思考结束，开始正式回复
                            isReasoning = false;
                        }
                        fullContent += delta.content;

                        // 实时更新正文显示，如果 bubble 不存在则重建并恢复内容
                        let bubble = $('#streamBubble');
                        if (!bubble && $('#chatMessages')) {
                            hideTypingIndicator();
                            const streamMsgEl = document.createElement('div');
                            streamMsgEl.className = 'message ai';
                            streamMsgEl.id = 'streamMessage';
                            streamMsgEl.innerHTML = `
                                <div>
                                    <div class="message-bubble" id="streamBubble"></div>
                                    <div class="message-time" id="streamTime"></div>
                                </div>
                            `;
                            $('#chatMessages').appendChild(streamMsgEl);
                            bubble = $('#streamBubble');
                        }
                        if (bubble) {
                            if (reasoningContent) {
                                // 有思考过程：折叠思考，显示正文
                                bubble.innerHTML = `<details style="margin-bottom:8px;"><summary style="color:#888;font-size:0.85em;cursor:pointer;">💭 思考过程</summary><div style="color:#aaa;font-style:italic;font-size:0.9em;margin-top:4px;padding-left:8px;">${formatMessage(reasoningContent)}</div></details>${formatMessage(fullContent)}`;
                            } else {
                                // 无思考过程：直接显示正文
                                bubble.innerHTML = formatMessage(fullContent);
                            }
                            smartScrollToBottom(container);
                        }
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
    } catch (e) {
        console.warn('Stream read error:', e);
        // 流中断：如果已经收到部分内容，标记为中断并返回
        if (fullContent && fullContent.length > 0) {
            console.log('[Stream] 流中断，但已收到部分内容，长度:', fullContent.length);
            let bubble = $('#streamBubble');
            if (bubble) {
                // 保持已显示的内容，添加中断提示
                if (reasoningContent) {
                    bubble.innerHTML = `<details style="margin-bottom:8px;"><summary style="color:#888;font-size:0.85em;cursor:pointer;">💭 思考过程</summary><div style="color:#aaa;font-style:italic;font-size:0.9em;margin-top:4px;padding-left:8px;">${formatMessage(reasoningContent)}</div></details>${formatMessage(fullContent)}<br><span style="color:#f59e0b;font-size:0.85em;margin-top:8px;display:inline-block;">⚠️ 流中断</span>`;
                } else {
                    bubble.innerHTML = `${formatMessage(fullContent)}<br><span style="color:#f59e0b;font-size:0.85em;margin-top:8px;display:inline-block;">⚠️ 流中断</span>`;
                }
            }
            return { content: fullContent, reasoning: reasoningContent || '', interrupted: true };
        }
    }

    // 流式消息元素保留在DOM中，由 sendMessage 转为正式消息
    // 返回正文和思考过程，供 sendMessage 保存到 session
    // 如果正文为空但思考过程有内容（Qwen3 有时把回复写在 reasoning 中），把思考内容作为正文
    if (!fullContent && reasoningContent) {
        fullContent = reasoningContent;
        reasoningContent = '';
    }
    // 如果正文为空，可能是 API 错误或 context 不足
    if (!fullContent || fullContent === '...') {
        console.warn('[Stream] 流式响应结束但无内容，可能是 context 不足或 API 错误');
        // 在 UI 上显示错误提示
        let bubble = $('#streamBubble');
        if (bubble) {
            bubble.innerHTML = '<span style="color:#f87171;">⚠️ 未收到回复，可能原因：system prompt 过长超出模型 context window，请尝试减少世界书条目或缩短角色描述</span>';
        }
    }
    return { content: fullContent || '...', reasoning: reasoningContent || '' };
}

// ==================== Smart Scroll Helper ====================
function smartScrollToBottom(container) {
    if (!container) return;
    // 只有当用户已经在底部附近（距离底部 < 50px）时才自动滚动
    const threshold = 50;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

// ==================== Fallback Reply ====================
function getFallbackReply(role, userMessage) {
    const name = role.name;
    const replies = {
        "凌朔": [
            "……嗯。",
            "你说完了？",
            "……随你吧。",
            "别太在意我。",
            "……你总是这样。"
        ],
        "苏娅": [
            "哈哈，你真有趣～",
            "嗯嗯，我懂你的意思！",
            "你这么说让我好开心～",
            "哎呀，你总是这么体贴。",
            "有你在身边真好呢。"
        ],
        "林晚": [
            "嗯……谢谢你的关心。",
            "跳舞的时候我真的很开心呢。",
            "啊……你不会觉得我很奇怪吧？",
            "今天的排练好累，但听到你这么说又开心了。",
            "嗯，我会继续努力的！"
        ],
        "沈若": [
            "来，先吃点点心吧～",
            "你今天看起来有点累，要不要休息一下？",
            "嗯，我一直都在呢。",
            "你开心我就开心～",
            "别担心，有姐姐在呢。"
        ],
        "顾清": [
            "……嗯，继续说。",
            "这个观点倒是有点意思。",
            "别打扰我看书……但你可以待着。",
            "你……怎么总是来找我？",
            "哼，才不是因为想见你才来图书馆的。"
        ],
        "陆漫": [
            "深夜的声音，总是藏着最真实的心事呢。",
            "嗯，我听到了，继续说吧。",
            "你知道吗，每个失眠的夜晚都有一个故事。",
            "你的声音，和今晚的月光一样温柔。",
            "有些话，只有在深夜才说得出口。"
        ],
        "小鹿": [
            "哥哥哥哥！你说的对！",
            "嘿嘿，我就知道你会这么说～",
            "哼！不许看别的女生！",
            "哥哥最好了！",
            "我……我才没有吃醋呢！"
        ],
        "云织": [
            "哼！本小姐才不需要你教！……好吧，你继续说。",
            "这个世界的魔法真是奇怪……你们管它叫'科学'？",
            "啊！这个发光的盒子又响了！",
            "你……你是在关心本小姐吗？",
            "哼，看在你这么诚恳的份上，本小姐就勉强听你说吧。"
        ]
    };

    const roleReplies = replies[name] || ["嗯，我在听。", "继续说吧。", "我明白了。", "你说得有道理。", "嗯嗯。"];
    return roleReplies[Math.floor(Math.random() * roleReplies.length)];
}

// ==================== Retry Failed Message ====================
function retryLastMessage(roleId, userText) {
    // 删除当前的错误提示气泡
    const container = $('#chatMessages');
    if (container) {
        const errorMsg = container.querySelector('.message.ai:last-child');
        if (errorMsg && errorMsg.querySelector('#streamBubble')) {
            errorMsg.remove();
        }
    }

    // 重新发送消息
    sendMessage(true);  // 跳过输入检查
}

// ==================== Continue Generation ====================
async function continueGeneration(roleId) {
    const session = AppState.chatSessions[roleId];
    if (!session || session.messages.length === 0) return;

    // 清除可能残留的 swipe 生成标记，确保继续生成不会误触发 swipe 逻辑
    delete AppState._generatingSwipeFor;

    // 找到最后一条消息
    let lastMsg = session.messages[session.messages.length - 1];

    // 如果最后一条不是 AI 消息，说明需要生成新的 AI 回复
    if (lastMsg.role !== 'assistant') {
        // 直接调用 sendMessage 生成新回复
        showToast('正在生成回复...');
        sendMessage(true);
        return;
    }

    // 如果最后一条是 AI 消息，需要让 AI 续写
    // 策略：添加一个"请继续"的用户消息，然后生成新的 AI 回复（独立气泡）

    // 移除中断标记和按钮（如果有）
    const container = $('#chatMessages');
    if (container) {
        const lastAIMsg = container.querySelector('.message.ai:last-child');
        if (lastAIMsg) {
            const bubble = lastAIMsg.querySelector('.message-bubble');
            if (bubble) {
                // 移除"⚠️ 流中断"和"继续生成"按钮
                bubble.innerHTML = bubble.innerHTML.replace(/<br><span style="color:#f59e0b[^>]*>⚠️ 流中断<\/span>/g, '').replace(/<br><button onclick="continueGeneration[^>]*>.*?<\/button>/g, '');
            }
        }
    }

    // 临时添加"请继续"用户消息
    session.messages.push({
        role: 'user',
        content: '[继续上文]',
        time: new Date().toISOString()
    });

    session.lastTime = new Date().toISOString();
    saveState();
    renderMessages(roleId);

    showToast('正在继续生成...');

    // 调用 sendMessage 生成续写内容（会创建新的独立气泡）
    sendMessage(true);
}

// ==================== Chat List ====================
let chatBatchMode = false;
let chatSelectedIds = new Set();

function renderChatList() {
    const list = $('#chatList');
    const emptyEl = $('#chatListEmpty');
    const sessions = Object.values(AppState.chatSessions);

    if (sessions.length === 0) {
        list.style.display = 'none';
        emptyEl.style.display = 'flex';
        return;
    }

    list.style.display = 'block';
    emptyEl.style.display = 'none';

    // 按最后消息时间排序
    sessions.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    list.innerHTML = sessions.map(session => {
        const role = ROLES_DATA.find(r => r && String(r.id) === String(session.roleId));
        if (!role) return '';

        const lastMsg = session.messages[session.messages.length - 1];
        const preview = lastMsg ? lastMsg.content.substring(0, 30) + (lastMsg.content.length > 30 ? '...' : '') : '';
        const timeStr = formatTime(session.lastTime);
        const msgCount = session.messages.length;

        const checkboxHtml = chatBatchMode ? `<div class="chat-item-checkbox" data-role-id="${session.roleId}"></div>` : '';
        return `
            <div class="chat-list-item ${chatBatchMode ? 'batch-mode' : ''}" data-role-id="${session.roleId}">
                ${checkboxHtml}
                <div class="chat-list-item-avatar-placeholder">${role.emoji}</div>
                <div class="chat-list-item-content">
                    <div class="chat-list-item-title">${role.name}</div>
                    <div class="chat-list-item-preview">${preview}</div>
                </div>
                <div class="chat-list-item-meta">
                    <span class="chat-list-item-time">${timeStr}</span>
                    <span class="chat-list-item-status">${msgCount} 条</span>
                </div>
            </div>
        `;
    }).join('');

    // 点击进入对话
    $$('.chat-list-item').forEach(item => {
        let longPressTimer = null;
        let isLongPress = false;
        
        // 长按开始
        item.addEventListener('touchstart', (e) => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                // 震动反馈（如果支持）
                if (navigator.vibrate) navigator.vibrate(50);
                // 显示删除确认
                const roleId = String(item.dataset.roleId);
                const role = ROLES_DATA.find(r => r && String(r.id) === roleId);
                if (role && confirm(`确定删除与 ${role.name} 的聊天记录？`)) {
                    delete AppState.chatSessions[roleId];
                    saveState();
                    renderChatList();
                    updateChatBadge();
                }
            }, 500); // 500ms 长按
        });
        
        // 长按结束
        item.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });
        
        item.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });
        
        // 点击进入对话（非长按时）
        item.addEventListener('click', () => {
            if (isLongPress) return; // 长按后不触发点击
            const roleId = String(item.dataset.roleId);
            AppState.currentChat = roleId;
            showChatView(roleId);
        });
        
        // 右键菜单（桌面端，非批量模式）
        if (!chatBatchMode) {
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const roleId = String(item.dataset.roleId);
                const role = ROLES_DATA.find(r => r && String(r.id) === roleId);
                if (role && confirm(`确定删除与 ${role.name} 的聊天记录？`)) {
                    delete AppState.chatSessions[roleId];
                    saveState();
                    renderChatList();
                    updateChatBadge();
                }
            });
        }
        
        // 批量模式：点击复选框切换选中
        if (chatBatchMode) {
            const checkbox = item.querySelector('.chat-item-checkbox');
            if (checkbox) {
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const roleId = String(item.dataset.roleId);
                    if (chatSelectedIds.has(roleId)) {
                        chatSelectedIds.delete(roleId);
                        checkbox.classList.remove('checked');
                        item.classList.remove('selected');
                    } else {
                        chatSelectedIds.add(roleId);
                        checkbox.classList.add('checked');
                        item.classList.add('selected');
                    }
                    updateBatchCount();
                });
            }
            
            // 点击整行也切换选中
            item.addEventListener('click', (e) => {
                if (e.target.closest('.chat-item-checkbox')) return;
                const roleId = String(item.dataset.roleId);
                const checkbox = item.querySelector('.chat-item-checkbox');
                if (chatSelectedIds.has(roleId)) {
                    chatSelectedIds.delete(roleId);
                    if (checkbox) checkbox.classList.remove('checked');
                    item.classList.remove('selected');
                } else {
                    chatSelectedIds.add(roleId);
                    if (checkbox) checkbox.classList.add('checked');
                    item.classList.add('selected');
                }
                updateBatchCount();
            });
        }
    });
}

function updateBatchCount() {
    const countEl = $('#chatBatchCount');
    if (countEl) {
        countEl.textContent = `已选 ${chatSelectedIds.size} 项`;
    }
    const deleteBtn = $('#chatBatchDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = chatSelectedIds.size === 0;
    }
}

function enterBatchMode() {
    chatBatchMode = true;
    chatSelectedIds = new Set();
    $('#chatManageBtn').textContent = '取消';
    $('#chatBatchBar').classList.remove('hidden');
    renderChatList();
    updateBatchCount();
}

function exitBatchMode() {
    chatBatchMode = false;
    chatSelectedIds = new Set();
    $('#chatManageBtn').textContent = '管理';
    $('#chatBatchBar').classList.add('hidden');
    renderChatList();
}

function initBatchDelete() {
    // 管理按钮
    $('#chatManageBtn').addEventListener('click', () => {
        if (chatBatchMode) {
            exitBatchMode();
        } else {
            enterBatchMode();
        }
    });
    
    // 全选按钮
    $('#chatSelectAllBtn').addEventListener('click', () => {
        const sessions = Object.keys(AppState.chatSessions);
        if (chatSelectedIds.size === sessions.length) {
            // 已全选，取消全选
            chatSelectedIds = new Set();
        } else {
            // 全选
            chatSelectedIds = new Set(sessions);
        }
        // 更新 UI
        $$('.chat-item-checkbox').forEach(cb => {
            const roleId = String(cb.dataset.roleId);
            cb.classList.toggle('checked', chatSelectedIds.has(roleId));
            cb.closest('.chat-list-item').classList.toggle('selected', chatSelectedIds.has(roleId));
        });
        updateBatchCount();
    });
    
    // 删除选中按钮
    $('#chatBatchDeleteBtn').addEventListener('click', () => {
        if (chatSelectedIds.size === 0) return;
        if (!confirm(`确定删除选中的 ${chatSelectedIds.size} 条聊天记录？此操作不可恢复。`)) return;
        
        chatSelectedIds.forEach(roleId => {
            delete AppState.chatSessions[roleId];
        });
        chatSelectedIds = new Set();
        saveState();
        exitBatchMode();
        renderChatList();
        updateChatBadge();
    });
    
    // 取消按钮
    $('#chatBatchCancelBtn').addEventListener('click', () => {
        exitBatchMode();
    });
}

function formatTime(isoStr) {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function updateChatBadge() {
    const badge = $('#chatBadge');
    const count = Object.keys(AppState.chatSessions).length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ==================== Chat Settings Sidebar ====================
function openChatSettingsSidebar() {
    if (!AppState.currentChat) return;

    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    const sidebar = $('#chatSettingsSidebar');
    sidebar.classList.remove('hidden');
    setTimeout(() => sidebar.classList.add('active'), 10);

    // 填充角色信息
    $('#chatSettingsAvatar').src = role.image || '';
    $('#chatSettingsName').textContent = role.name || '';

    // 更新用户身份显示
    updateUserIdentityDisplay();

    // 更新世界书显示
    updateWorldbookDisplay();
}

function closeChatSettingsSidebar() {
    const sidebar = $('#chatSettingsSidebar');
    sidebar.classList.remove('active');
    setTimeout(() => sidebar.classList.add('hidden'), 300);
}

function updateUserIdentityDisplay() {
    const session = AppState.chatSessions[AppState.currentChat];
    const userName = (session && session.userName) || '';
    $('#userIdentityValue').textContent = userName || '未设置';
}

function updateWorldbookDisplay() {
    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role || !role.sourceData || !role.sourceData.characterBook) {
        $('#worldbookValue').textContent = '未设置';
        return;
    }

    const entries = role.sourceData.characterBook.entries || [];
    const enabledCount = entries.filter(e => e.enabled !== false).length;
    $('#worldbookValue').textContent = `${enabledCount}/${entries.length} 条`;
}

// 初始化聊天设置侧边栏事件
function initChatSettingsSidebar() {
    const overlay = $('#chatSettingsOverlay');
    const advancedToggle = $('#advancedToggle');
    const advancedSettings = $('#advancedSettings');

    // 点击遮罩层关闭
    overlay.addEventListener('click', closeChatSettingsSidebar);

    // 高级选项折叠
    advancedToggle.addEventListener('click', () => {
        advancedSettings.classList.toggle('collapsed');
        advancedToggle.textContent = advancedSettings.classList.contains('collapsed') ? '展开' : '收起';
    });

    // 情景设定
    $('#settingScenario').addEventListener('click', () => {
        openScenarioPanel();
    });

    // 用户身份
    $('#settingUserIdentity').addEventListener('click', () => {
        openUserIdentityPanel();
    });

    // 聊天主题
    $('#settingChatTheme').addEventListener('click', () => {
        openChatThemePanel();
    });

    // 提示词模板
    $('#settingPromptTemplate').addEventListener('click', () => {
        closeChatSettingsSidebar();
        openPromptTemplateModal();
    });

    // 世界书
    $('#settingWorldbook').addEventListener('click', () => {
        closeChatSettingsSidebar();
        openWorldbookManager();
    });

    // 导出聊天
    $('#settingExport').addEventListener('click', () => {
        closeChatSettingsSidebar();
        exportChatHistory();
    });

    // 清空记录
    $('#settingClearChat').addEventListener('click', () => {
        if (!AppState.currentChat) return;
        const session = AppState.chatSessions[AppState.currentChat];
        if (session && confirm('确定清空所有聊天记录？')) {
            session.messages = [];
            session.lastTime = new Date().toISOString();
            saveState();
            renderMessages(AppState.currentChat);
            renderChatList();
            closeChatSettingsSidebar();
            showToast('聊天记录已清空');
        }
    });

    // 删除对话
    $('#settingDeleteChat').addEventListener('click', () => {
        if (!AppState.currentChat) return;
        const roleId = AppState.currentChat;
        if (confirm('确定删除此对话？删除后无法恢复。')) {
            delete AppState.chatSessions[roleId];
            AppState.currentChat = null;
            saveState();
            closeChatSettingsSidebar();
            $('#chatMessages').innerHTML = '';
            showChatListView();
            renderChatList();
            updateChatBadge();
            showToast('对话已删除');
        }
    });
}

// ==================== 旧的菜单函数（保留以防万一）====================
function toggleChatMenu() {
    const existing = document.querySelector('.chat-menu-dropdown');
    if (existing) {
        existing.remove();
        return;
    }
    openChatSettingsSidebar();
}

function closeChatMenu() {
    const existing = document.querySelector('.chat-menu-dropdown');
    if (existing) existing.remove();
}

// ==================== Prompt Template System ====================
function openPromptTemplateModal() {
    const modal = document.createElement('div');
    modal.className = 'prompt-template-modal';
    modal.innerHTML = `
        <div class="prompt-template-overlay"></div>
        <div class="prompt-template-panel">
            <div class="prompt-template-header">
                <h3>提示词模板设置</h3>
                <button class="close-btn" onclick="closePromptTemplateModal()">×</button>
            </div>
            <div class="prompt-template-content">
                <div class="template-info">
                    <p>提示词模板用于控制消息的格式化方式。使用 <code>{{user}}</code> 表示用户消息，<code>{{char}}</code> 表示角色名称。</p>
                </div>

                <div class="template-selector">
                    <label>模板类型：</label>
                    <select id="templateTypeSelect" onchange="onTemplateTypeChange()">
                        <option value="default">默认格式</option>
                        <option value="alpaca">Alpaca 格式</option>
                        <option value="chatml">ChatML 格式</option>
                        <option value="vicuna">Vicuna 格式</option>
                        <option value="custom">自定义格式</option>
                    </select>
                </div>

                <div class="template-editor" id="templateEditor">
                    <label>用户消息模板：</label>
                    <textarea id="userTemplate" placeholder="例如：### Instruction:\n{{user}}\n\n"></textarea>

                    <label>助手消息模板：</label>
                    <textarea id="assistantTemplate" placeholder="例如：### Response:\n{{assistant}}\n\n"></textarea>

                    <label>系统消息模板：</label>
                    <textarea id="systemTemplate" placeholder="例如：### System:\n{{system}}\n\n"></textarea>
                </div>

                <div class="template-preview">
                    <label>预览：</label>
                    <pre id="templatePreview"></pre>
                </div>
            </div>
            <div class="prompt-template-actions">
                <button class="btn-secondary" onclick="closePromptTemplateModal()">取消</button>
                <button class="btn-primary" onclick="savePromptTemplate()">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 加载当前模板设置
    loadCurrentTemplate();
}

function closePromptTemplateModal() {
    const modal = $('.prompt-template-modal');
    if (modal) modal.remove();
}

function onTemplateTypeChange() {
    const type = $('#templateTypeSelect').value;
    const editor = $('#templateEditor');
    const userTemplate = $('#userTemplate');
    const assistantTemplate = $('#assistantTemplate');
    const systemTemplate = $('#systemTemplate');

    if (type === 'custom') {
        editor.style.display = 'block';
    } else {
        editor.style.display = 'none';

        // 设置预定义模板
        const templates = getTemplatePresets();
        const preset = templates[type];
        if (preset) {
            userTemplate.value = preset.user;
            assistantTemplate.value = preset.assistant;
            systemTemplate.value = preset.system;
        }
    }

    updateTemplatePreview();
}

function getTemplatePresets() {
    return {
        default: {
            user: '{{user}}',
            assistant: '{{assistant}}',
            system: '{{system}}'
        },
        alpaca: {
            user: '### Instruction:\n{{user}}\n\n',
            assistant: '### Response:\n{{assistant}}\n\n',
            system: '### System:\n{{system}}\n\n'
        },
        chatml: {
            user: '<|im_start|>user\n{{user}}<|im_end|>\n',
            assistant: '<|im_start|>assistant\n{{assistant}}<|im_end|>\n',
            system: '<|im_start|>system\n{{system}}<|im_end|>\n'
        },
        vicuna: {
            user: 'USER: {{user}}\n',
            assistant: 'ASSISTANT: {{assistant}}\n',
            system: 'SYSTEM: {{system}}\n'
        }
    };
}

function loadCurrentTemplate() {
    const settings = AppState.settings.promptTemplate || { type: 'default' };
    const select = $('#templateTypeSelect');
    select.value = settings.type || 'default';

    if (settings.type === 'custom' && settings.custom) {
        $('#userTemplate').value = settings.custom.user || '';
        $('#assistantTemplate').value = settings.custom.assistant || '';
        $('#systemTemplate').value = settings.custom.system || '';
        $('#templateEditor').style.display = 'block';
    } else {
        onTemplateTypeChange();
    }

    updateTemplatePreview();
}

function updateTemplatePreview() {
    const userTemplate = $('#userTemplate').value;
    const assistantTemplate = $('#assistantTemplate').value;
    const systemTemplate = $('#systemTemplate').value;

    const preview = $('#templatePreview');
    const exampleUser = userTemplate.replace('{{user}}', '你好！');
    const exampleAssistant = assistantTemplate.replace('{{assistant}}', '你好！有什么我可以帮助你的吗？');
    const exampleSystem = systemTemplate.replace('{{system}}', '你是一个有用的助手。');

    preview.textContent = exampleSystem + exampleUser + exampleAssistant;
}

function savePromptTemplate() {
    const type = $('#templateTypeSelect').value;

    if (!AppState.settings.promptTemplate) {
        AppState.settings.promptTemplate = {};
    }

    AppState.settings.promptTemplate.type = type;

    if (type === 'custom') {
        AppState.settings.promptTemplate.custom = {
            user: $('#userTemplate').value,
            assistant: $('#assistantTemplate').value,
            system: $('#systemTemplate').value
        };
    } else {
        const presets = getTemplatePresets();
        AppState.settings.promptTemplate.custom = presets[type];
    }

    saveState();
    showToast('提示词模板已保存');
    closePromptTemplateModal();
}

function applyPromptTemplate(messages) {
    const template = AppState.settings.promptTemplate;
    if (!template || !template.custom) return messages;

    return messages.map(msg => {
        if (msg.role === 'user') {
            return {
                ...msg,
                content: template.custom.user.replace('{{user}}', msg.content)
            };
        } else if (msg.role === 'assistant') {
            return {
                ...msg,
                content: template.custom.assistant.replace('{{assistant}}', msg.content)
            };
        } else if (msg.role === 'system') {
            return {
                ...msg,
                content: template.custom.system.replace('{{system}}', msg.content)
            };
        }
        return msg;
    });
}

// ==================== Export Chat History ====================
function exportChatHistory() {
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session || !session.messages.length) {
        showToast('没有可导出的聊天记录');
        return;
    }

    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    // 创建导出选项模态框
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
        <div class="export-overlay" onclick="closeExportModal()"></div>
        <div class="export-panel">
            <div class="export-header">
                <h3>导出聊天记录</h3>
                <button class="close-btn" onclick="closeExportModal()">×</button>
            </div>
            <div class="export-content">
                <label>导出格式：</label>
                <select id="exportFormat">
                    <option value="txt">纯文本 (.txt)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="markdown">Markdown (.md)</option>
                    <option value="html">HTML (.html)</option>
                </select>

                <label style="margin-top: 16px;">
                    <input type="checkbox" id="includeReasoning" checked>
                    包含思考过程
                </label>

                <label style="margin-top: 8px;">
                    <input type="checkbox" id="includeTimestamp" checked>
                    包含时间戳
                </label>
            </div>
            <div class="export-actions">
                <button class="btn-secondary" onclick="closeExportModal()">取消</button>
                <button class="btn-primary" onclick="confirmExport()">导出</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeExportModal() {
    const modal = $('.export-modal');
    if (modal) modal.remove();
}

function confirmExport() {
    const format = $('#exportFormat').value;
    const includeReasoning = $('#includeReasoning').checked;
    const includeTimestamp = $('#includeTimestamp').checked;

    const session = AppState.chatSessions[AppState.currentChat];
    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));

    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'txt') {
        content = exportAsTxt(session, role, includeReasoning, includeTimestamp);
        filename = `${role.name}_聊天记录_${new Date().toISOString().slice(0, 10)}.txt`;
        mimeType = 'text/plain';
    } else if (format === 'json') {
        content = exportAsJson(session, role, includeReasoning, includeTimestamp);
        filename = `${role.name}_聊天记录_${new Date().toISOString().slice(0, 10)}.json`;
        mimeType = 'application/json';
    } else if (format === 'markdown') {
        content = exportAsMarkdown(session, role, includeReasoning, includeTimestamp);
        filename = `${role.name}_聊天记录_${new Date().toISOString().slice(0, 10)}.md`;
        mimeType = 'text/markdown';
    } else if (format === 'html') {
        content = exportAsHtml(session, role, includeReasoning, includeTimestamp);
        filename = `${role.name}_聊天记录_${new Date().toISOString().slice(0, 10)}.html`;
        mimeType = 'text/html';
    }

    // 创建下载
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('聊天记录已导出');
    closeExportModal();
}

function exportAsTxt(session, role, includeReasoning, includeTimestamp) {
    let content = `${role.name} 聊天记录\n`;
    content += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
    content += `消息数量：${session.messages.length}\n`;
    content += '='.repeat(50) + '\n\n';

    session.messages.forEach(msg => {
        const speaker = msg.role === 'user' ? '用户' : role.name;
        const time = includeTimestamp ? ` [${new Date(msg.time).toLocaleString('zh-CN')}]` : '';

        content += `${speaker}${time}:\n`;

        if (includeReasoning && msg.reasoning) {
            content += `💭 思考过程：\n${msg.reasoning}\n\n`;
        }

        content += `${msg.content}\n`;
        content += '-'.repeat(50) + '\n\n';
    });

    return content;
}

function exportAsJson(session, role, includeReasoning, includeTimestamp) {
    const data = {
        role: role.name,
        roleId: role.id,
        exportTime: new Date().toISOString(),
        messageCount: session.messages.length,
        messages: session.messages.map(msg => {
            const item = {
                role: msg.role,
                content: msg.content
            };

            if (includeTimestamp) {
                item.time = msg.time;
            }

            if (includeReasoning && msg.reasoning) {
                item.reasoning = msg.reasoning;
            }

            return item;
        })
    };

    return JSON.stringify(data, null, 2);
}

function exportAsMarkdown(session, role, includeReasoning, includeTimestamp) {
    let content = `# ${role.name} 聊天记录\n\n`;
    content += `**导出时间**：${new Date().toLocaleString('zh-CN')}\n`;
    content += `**消息数量**：${session.messages.length}\n\n`;
    content += '---\n\n';

    session.messages.forEach(msg => {
        const speaker = msg.role === 'user' ? '**用户**' : `**${role.name}**`;
        const time = includeTimestamp ? ` *${new Date(msg.time).toLocaleString('zh-CN')}*` : '';

        content += `### ${speaker}${time}\n\n`;

        if (includeReasoning && msg.reasoning) {
            content += `> 💭 思考过程：\n> ${msg.reasoning.replace(/\n/g, '\n> ')}\n\n`;
        }

        content += `${msg.content}\n\n`;
    });

    return content;
}

function exportAsHtml(session, role, includeReasoning, includeTimestamp) {
    let content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${role.name} 聊天记录</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .message {
            background: white;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 12px;
        }
        .message.user {
            background: #e3f2fd;
        }
        .speaker {
            font-weight: bold;
            margin-bottom: 8px;
        }
        .time {
            color: #666;
            font-size: 0.85em;
            margin-left: 8px;
        }
        .reasoning {
            background: #f5f5f5;
            padding: 12px;
            border-left: 3px solid #999;
            margin: 8px 0;
            font-style: italic;
            color: #666;
        }
        .content {
            white-space: pre-wrap;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${role.name} 聊天记录</h1>
        <p>导出时间：${new Date().toLocaleString('zh-CN')}</p>
        <p>消息数量：${session.messages.length}</p>
    </div>
`;

    session.messages.forEach(msg => {
        const speaker = msg.role === 'user' ? '用户' : role.name;
        const time = includeTimestamp ? `<span class="time">${new Date(msg.time).toLocaleString('zh-CN')}</span>` : '';
        const messageClass = msg.role === 'user' ? 'message user' : 'message';

        content += `    <div class="${messageClass}">
        <div class="speaker">${speaker}${time}</div>
`;

        if (includeReasoning && msg.reasoning) {
            content += `        <div class="reasoning">💭 思考过程：${msg.reasoning}</div>
`;
        }

        content += `        <div class="content">${msg.content}</div>
    </div>
`;
    });

    content += `</body>
</html>`;

    return content;
}

// 快捷选项映射：根据角色标签生成专属快捷选项
const QUICK_REPLIES_MAP = {
    // 按标签映射
    tags: {
        "高冷": ["你今天心情怎么样？", "别装了，我知道你在乎我", "我想你了", "过来抱一下"],
        "反差": ["你真实的样子是什么？", "别逞强了", "让我看看你脆弱的一面", "你其实很温柔对吧"],
        "傲娇": ["你嘴硬心软", "才不信你说的", "你是不是喜欢我？", "别扭的样子好可爱"],
        "姐姐": ["姐姐帮我", "我可以住你那吗", "今晚有点冷", "你做的点心真好吃"],
        "温柔": ["今天好累", "抱抱我", "能一直陪着我吗", "你真好"],
        "校园": ["放学别走", "一起去图书馆吧", "帮我补习好不好", "教室里只有我们"],
        "治愈": ["我睡不着", "今天被骂了", "只有你懂我", "听你说话就安心了"],
        "病娇": ["你不会离开我吧？", "我只属于你", "让我把你锁起来", "你为什么看别人"],
        "魅魔": ["吸干我的精气吧", "你的尾巴好软", "再来一次", "我已经不行了"],
        "女王": ["遵命，主人", "请惩罚我", "我什么都听你的", "跪下求饶"],
        "女仆": ["主人请吩咐", "今晚需要特殊服务吗", "女仆什么都愿意做", "帮主人换衣服"],
        "萝莉": ["举高高！", "哥哥抱抱", "我最乖了对不对", "好吃的给我嘛"],
        "纯情": ["可以牵你的手吗", "第一次……好紧张", "我从来没这样过", "你轻一点"],
        "淫荡": ["继续，别停", "还不够", "用嘴帮我", "全部插进来"],
        "NTR": ["你老公知道吗", "在他面前做", "偷情好刺激", "你比她更棒"],
        "人妻": ["老公不在家", "这样做对不起他", "只有你不行的", "孩子睡了再来"],
        "调教": ["调教我吧", "我错了，惩罚我", "戴上项圈", "服从命令"],
        "恶堕": ["不要……但别停", "我已经堕落了吗", "再坏一点", "把我变成你的"],
        "催眠": ["你催眠了我吗", "我控制不了自己", "让我做什么都行", "意识好模糊"],
        "后宫": "custom",  // 特殊处理
        "地缚灵": "custom",
        "吸血鬼": ["让我看看你的獠牙", "咬我一口", "你会吸多少血", "永生是什么感觉"],
        "精灵": ["你的耳朵好尖", "教我精灵语", "你能活多久", "森林里有什么秘密"],
        "天使": ["你的翅膀好美", "天使也会堕落吗", "带我飞", "天堂是什么样的"],
        "恶魔": ["和我签契约吧", "你想要我的灵魂？", "地狱好玩吗", "堕落天使更迷人"],
        "古风": ["姑娘请留步", "在下仰慕已久", "共饮此杯如何", "月下独酌不如同醉"],
        "仙侠": ["仙子下凡辛苦了", "传授我仙法", "你修的是什么道", "长生不老是什么感觉"],
        "赛博": ["接入我的神经", "你的代码好美", "系统过载了", "数据流过身体的感觉"],
        "机甲": ["启动驾驶模式", "同步率多少？", "机甲也能有感情吗", "带我上太空"],
        "异世界": ["带我去你的世界", "这里有魔法吗", "你是哪个种族", "冒险伙伴找到了"],
        "暗月": "custom",
        "苍穹": "custom",
        "魅夜": "custom",
        "许渊": "custom",
    },
    // 角色专属快捷选项（按角色名）
    roles: {
        "小兔": ["你为什么被绑在这里？", "我来帮你解开", "地缚灵是什么感觉", "触碰你的锁链"],
        "莉莉丝": ["能量交融是什么", "吸我的精气吧", "你的翅膀好美", "恶魔的契约"],
        "暗月": ["今晚的月食开始了", "仪式需要什么", "暗月之力觉醒", "献上我的血液"],
        "苍穹": ["其他妃子又来了", "今晚只宠你", "后宫争宠真累", "朕只爱你一人"],
        "魅夜": ["我好像在做梦", "梦里什么都可以做吗", "别让我醒来", "梦境性交是什么感觉"],
        "许渊": ["这个实验是什么", "催眠我吧", "我的身体不受控制了", "实验数据记录好了"],
    },
    // 女性向专属快捷选项（让男性角色对用户执行，"你"=角色，"我"=用户）
    femaleOriented: [
        "用指尖画圈揉我的阴蒂",
        "帮我脱掉内裤慢慢抚摸下面",
        "用拇指按住我的阴蒂上下摩擦",
        "分开我的花瓣用指腹轻扫花核",
        "两根手指夹住我的阴蒂慢慢揉搓",
        "一边舔我的阴蒂一边把手指插进来",
        "把我的阴蒂含在嘴里吮吸",
        "手指沾湿后快速拨弄我的花核",
        "用指腹左右拨弄我的阴蒂",
        "一边揉我的阴蒂一边亲吻大腿内侧",
        "用舌尖从下往上舔我的花缝",
        "把手指弯起来找我的G点",
        "抱着我慢慢顶进来",
        "在我耳边说你想操我",
        "把我的腿架到你肩上舔我"
    ],
    // 男性向专属快捷选项（让女性角色对用户执行，"你"=角色，"我"=用户）
    maleOriented: [
        "用手握住我的阴茎慢慢撸动",
        "用舌尖绕我的龟头画圈",
        "把我的龟头含进嘴里吮吸",
        "用胸部夹住我的阴茎上下套弄",
        "用脚趾夹住我的阴茎撸动",
        "用大腿夹紧我的阴茎磨蹭",
        "坐上来自己动",
        "跪在我腿间帮我口交",
        "舔我的龟头同时用手撸动",
        "把我的阴茎塞进你的乳沟里",
        "专注用拇指摩擦我的龟头冠状沟",
        "把我带到射的边缘然后停下来",
        "深喉吞下我的整根",
        "骑在我脸上让我舔你",
        "转过身翘起屁股让我看"
    ],
    // 通用快捷选项（所有角色都有）
    common: [
        "你好", "今天想聊什么", "讲讲你自己", "我喜欢你"
    ]
};

function renderQuickReplies(roleId) {
    const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
    if (!role) return;

    const container = $('#quickReplies');
    container.innerHTML = '';

    const replies = [];

    // 0. 添加"常用语"按钮（放在最前面）
    const phrasesBtn = document.createElement('button');
    phrasesBtn.className = 'quick-reply-btn';
    phrasesBtn.textContent = '📝 常用语';
    phrasesBtn.style.background = 'rgba(139, 92, 246, 0.15)';
    phrasesBtn.style.borderColor = 'rgba(139, 92, 246, 0.3)';
    phrasesBtn.addEventListener('click', () => {
        openCommonPhrasesModal();
    });
    container.appendChild(phrasesBtn);

    // 1. 性向专属选项优先（根据角色性别判断）
    // 女性向 = 给女性用户看的男性角色 → 显示 femaleOriented
    // 男性向 = 给男性用户看的女性角色 → 显示 maleOriented
    const gender = role.gender || (role.tags && (
        role.tags.includes('Male') || role.tags.includes('male') || role.tags.includes('男性') || role.tags.includes('男性向') ? 'male' :
        (role.tags.includes('Female') || role.tags.includes('female') || role.tags.includes('女性') || role.tags.includes('女性向') ? 'female' : 'female')
    ));
    const isFemaleOriented = gender === 'male';  // 男性角色显示女性向快捷词
    const isMaleOriented = gender === 'female';  // 女性角色显示男性向快捷词

    if (isFemaleOriented && QUICK_REPLIES_MAP.femaleOriented) {
        // 随机选3-4条女性向选项
        const femaleOptions = [...QUICK_REPLIES_MAP.femaleOriented];
        const shuffled = femaleOptions.sort(() => Math.random() - 0.5);
        replies.push(...shuffled.slice(0, 4));
    }
    if (isMaleOriented && QUICK_REPLIES_MAP.maleOriented) {
        // 随机选3-4条男性向选项
        const maleOptions = [...QUICK_REPLIES_MAP.maleOriented];
        const shuffled = maleOptions.sort(() => Math.random() - 0.5);
        replies.push(...shuffled.slice(0, 4));
    }

    // 2. 角色专属选项
    if (QUICK_REPLIES_MAP.roles[role.name]) {
        replies.push(...QUICK_REPLIES_MAP.roles[role.name]);
    }

    // 3. 标签专属选项（去重，最多取6条）
    const tagReplies = [];
    for (const tag of role.tags) {
        const mapped = QUICK_REPLIES_MAP.tags[tag];
        if (mapped && mapped !== 'custom') {
            for (const r of mapped) {
                if (!tagReplies.includes(r) && !replies.includes(r)) {
                    tagReplies.push(r);
                }
            }
        }
        if (tagReplies.length >= 6) break;
    }
    replies.push(...tagReplies.slice(0, 6));

    // 3. 通用选项（去重，最多2条）
    let commonCount = 0;
    for (const r of QUICK_REPLIES_MAP.common) {
        if (!replies.includes(r) && commonCount < 2) {
            replies.push(r);
            commonCount++;
        }
    }

    // 最多显示10条
    const finalReplies = replies.slice(0, 10);

    // 渲染按钮
    finalReplies.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'quick-reply-btn';
        btn.textContent = text;
        btn.addEventListener('click', () => {
            // 拖拽滑动时不触发点击
            if (_qrDragMoved) return;

            // 填入输入框
            const input = $('#chatInput');
            input.value = text;

            // 手机端：不聚焦，避免弹出键盘
            // PC端：可以聚焦（但这里统一不聚焦，因为会自动发送）

            // 自动发送
            sendMessage();
        });
        container.appendChild(btn);
    });

    // PC鼠标拖拽滑动支持
    initQuickRepliesDrag(container);
}

// PC端鼠标拖拽滑动
let _qrDragMoved = false; // 标记是否发生了拖拽
function initQuickRepliesDrag(container) {
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    container.style.cursor = 'grab';

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        _qrDragMoved = false;
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        container.style.cursor = 'grabbing';
        container.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 5) _qrDragMoved = true;
        container.scrollLeft = scrollLeft - walk;
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
    });
}

// ==================== Common Phrases Management ====================
function getCommonPhrasesKey() {
    const user = getCurrentUser();
    return user ? `ai_chat_common_phrases_${user}` : 'ai_chat_common_phrases';
}

function loadCommonPhrases() {
    try {
        const phrases = JSON.parse(localStorage.getItem(getCommonPhrasesKey()) || '[]');
        return phrases;
    } catch (e) {
        console.warn('Failed to load common phrases:', e);
        return [];
    }
}

function saveCommonPhrases(phrases) {
    try {
        localStorage.setItem(getCommonPhrasesKey(), JSON.stringify(phrases));
    } catch (e) {
        console.warn('Failed to save common phrases:', e);
    }
}

function addCommonPhrase(text) {
    if (!text || !text.trim()) return;
    const phrases = loadCommonPhrases();
    // 去重
    if (phrases.includes(text)) {
        showToast('该常用语已存在');
        return;
    }
    phrases.push(text);
    saveCommonPhrases(phrases);
    showToast('已添加常用语');
}

function deleteCommonPhrase(index) {
    const phrases = loadCommonPhrases();
    phrases.splice(index, 1);
    saveCommonPhrases(phrases);
    renderCommonPhrasesList();
    showToast('已删除');
}

function openCommonPhrasesModal() {
    const modal = $('#commonPhrasesModal');
    modal.classList.remove('hidden');
    renderCommonPhrasesList();
}

function closeCommonPhrasesModal() {
    $('#commonPhrasesModal').classList.add('hidden');
}

function renderCommonPhrasesList() {
    const phrases = loadCommonPhrases();
    const list = $('#commonPhrasesList');
    const empty = $('#commonPhrasesEmpty');

    if (phrases.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = phrases.map((phrase, idx) => `
        <div class="common-phrase-item">
            <div class="common-phrase-text">${phrase}</div>
            <div class="common-phrase-actions">
                <button class="common-phrase-btn use" data-idx="${idx}" title="使用">✓</button>
                <button class="common-phrase-btn edit" data-idx="${idx}" title="编辑">编辑</button>
                <button class="common-phrase-btn delete" data-idx="${idx}" title="删除">✕</button>
            </div>
        </div>
    `).join('');

    // 绑定使用按钮
    list.querySelectorAll('.common-phrase-btn.use').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const phrase = phrases[idx];
            const chatInput = $('#chatInput');
            chatInput.value = phrase;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            // 手机端：不聚焦，避免弹出键盘（用户可以手动点击输入框）
            // chatInput.focus();
            closeCommonPhrasesModal();
        });
    });

    // 绑定编辑按钮
    list.querySelectorAll('.common-phrase-btn.edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const oldText = phrases[idx];

            // 使用app.js中的编辑对话框
            if (typeof openEditPhraseModal === 'function') {
                openEditPhraseModal(idx, 'chat', oldText);
            } else {
                // 降级到prompt
                const newText = prompt('编辑常用语:', oldText);

                if (newText !== null && newText.trim()) {
                    const trimmed = newText.trim();

                    // 检查是否与其他常用语重复
                    if (phrases.some((p, i) => i !== idx && p === trimmed)) {
                        showToast('该常用语已存在');
                        return;
                    }

                    phrases[idx] = trimmed;
                    saveCommonPhrases(phrases);
                    renderCommonPhrasesList();
                    showToast('修改成功');
                }
            }
        });
    });

    // 绑定删除按钮
    list.querySelectorAll('.common-phrase-btn.delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (confirm('确定删除这条常用语？')) {
                deleteCommonPhrase(idx);
            }
        });
    });
}

function initCommonPhrases() {
    const modal = $('#commonPhrasesModal');
    const closeBtn = $('#closeCommonPhrases');
    const overlay = modal.querySelector('.role-detail-overlay');
    const addBtn = $('#addPhraseBtn');
    const newPhraseInput = $('#newPhraseInput');

    if (!modal) return;

    // 关闭按钮
    [closeBtn, overlay].forEach(el => {
        el.addEventListener('click', () => {
            closeCommonPhrasesModal();
        });
    });

    // 添加按钮
    addBtn.addEventListener('click', () => {
        const text = newPhraseInput.value.trim();
        if (!text) {
            showToast('请输入常用语内容');
            return;
        }
        addCommonPhrase(text);
        newPhraseInput.value = '';
        renderCommonPhrasesList();
    });
}

// ==================== Worldbook Manager ====================
let currentEditingEntryIndex = null;

function openWorldbookManager() {
    if (!AppState.currentChat) return;

    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    // 确保角色有世界书数据结构
    if (!role.sourceData) role.sourceData = {};
    if (!role.sourceData.characterBook) {
        role.sourceData.characterBook = {
            name: `${role.name}的世界书`,
            entries: []
        };
    }

    const managerPanel = $('#worldbookManagerPanel');
    const chatView = $('#chatView');

    // 填充世界书名称
    $('#worldbookNameInput').value = role.sourceData.characterBook.name || `${role.name}的世界书`;

    // 渲染条目列表
    renderWorldbookEntriesList(role);

    chatView.classList.add('hidden');
    managerPanel.classList.remove('hidden');
}

function closeWorldbookManager() {
    const managerPanel = $('#worldbookManagerPanel');
    const chatView = $('#chatView');

    managerPanel.classList.add('hidden');
    chatView.classList.remove('hidden');

    // 清空搜索框
    $('#worldbookSearchInput').value = '';
}

function renderWorldbookEntriesList(role) {
    const container = $('#worldbookEntriesList');
    const emptyEl = $('#worldbookEmpty');
    const searchInput = $('#worldbookSearchInput');

    if (!role.sourceData || !role.sourceData.characterBook || !role.sourceData.characterBook.entries) {
        container.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
    }

    const entries = role.sourceData.characterBook.entries;
    const searchTerm = searchInput.value.toLowerCase();

    // 过滤搜索
    const filteredEntries = entries.filter(entry => {
        if (!searchTerm) return true;
        const name = (entry.name || '').toLowerCase();
        const content = (entry.content || '').toLowerCase();
        const keys = (entry.keys || []).join(',').toLowerCase();
        return name.includes(searchTerm) || content.includes(searchTerm) || keys.includes(searchTerm);
    });

    if (filteredEntries.length === 0) {
        container.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
    }

    emptyEl.classList.add('hidden');

    let html = '';
    filteredEntries.forEach((entry, idx) => {
        const originalIdx = entries.indexOf(entry);
        const isEnabled = entry.enabled !== false;
        const isConstant = entry.constant === true || (!entry.keys || entry.keys.length === 0);
        const keys = (entry.keys || []).filter(k => k.trim());
        const contentPreview = (entry.content || '').substring(0, 100).replace(/\n/g, ' ');
        const name = entry.name || `条目 ${originalIdx + 1}`;

        html += `
            <div class="wb-manager-entry ${isEnabled ? '' : 'disabled'}" data-idx="${originalIdx}">
                <div class="wb-manager-entry-header">
                    <div class="wb-manager-entry-left">
                        <span class="wb-manager-entry-name">${name}</span>
                        <span class="wb-manager-tag ${isConstant ? 'constant' : 'trigger'}">${isConstant ? '常驻' : '触发'}</span>
                    </div>
                    <div class="wb-manager-entry-actions">
                        <button class="wb-action-btn edit" data-idx="${originalIdx}" title="编辑">✏️</button>
                        <button class="wb-action-btn copy" data-idx="${originalIdx}" title="复制">📋</button>
                        <button class="wb-action-btn delete" data-idx="${originalIdx}" title="删除">🗑️</button>
                        <label class="wb-toggle">
                            <input type="checkbox" class="wb-toggle-switch" data-idx="${originalIdx}" ${isEnabled ? 'checked' : ''}>
                            <span class="wb-toggle-slider"></span>
                        </label>
                    </div>
                </div>
                ${keys.length > 0 ? `<div class="wb-manager-keys">${keys.map(k => `<span class="wb-key-tag">${k}</span>`).join('')}</div>` : ''}
                <div class="wb-manager-content">${contentPreview}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // 绑定事件
    attachWorldbookEntryEvents();
}

function attachWorldbookEntryEvents() {
    // 编辑按钮
    $$('.wb-action-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            openWorldbookEntryEditor(idx);
        });
    });

    // 复制按钮
    $$('.wb-action-btn.copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            copyWorldbookEntry(idx);
        });
    });

    // 删除按钮
    $$('.wb-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            deleteWorldbookEntry(idx);
        });
    });

    // 启用/禁用开关
    $$('.wb-toggle-switch').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const idx = parseInt(toggle.dataset.idx);
            toggleWorldbookEntry(idx, toggle.checked);
        });
    });

    // 点击条目打开编辑
    $$('.wb-manager-entry').forEach(entry => {
        entry.addEventListener('click', (e) => {
            // 如果点击的是按钮或开关，不触发
            if (e.target.closest('.wb-manager-entry-actions')) return;
            const idx = parseInt(entry.dataset.idx);
            openWorldbookEntryEditor(idx);
        });
    });
}

function openWorldbookEntryEditor(entryIdx = null) {
    currentEditingEntryIndex = entryIdx;

    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    const editorPanel = $('#worldbookEntryEditor');
    const managerPanel = $('#worldbookManagerPanel');
    const title = $('#worldbookEditorTitle');

    // 清空表单
    $('#entryNameInput').value = '';
    $('#entryKeysInput').value = '';
    $('#entryContentInput').value = '';
    $('#entryConstantSelect').value = 'false';
    $('#entryOrderInput').value = '100';
    $('#entryEnabledSwitch').checked = true;

    if (entryIdx !== null) {
        // 编辑模式
        title.textContent = '编辑条目';
        const entry = role.sourceData.characterBook.entries[entryIdx];
        if (entry) {
            $('#entryNameInput').value = entry.name || '';
            $('#entryKeysInput').value = (entry.keys || []).join(', ');
            $('#entryContentInput').value = entry.content || '';
            $('#entryConstantSelect').value = entry.constant === true ? 'true' : 'false';
            $('#entryOrderInput').value = entry.insertion_order || entry.priority || 100;
            $('#entryEnabledSwitch').checked = entry.enabled !== false;
        }
    } else {
        // 新建模式
        title.textContent = '新建条目';
    }

    managerPanel.classList.add('hidden');
    editorPanel.classList.remove('hidden');
}

function closeWorldbookEntryEditor() {
    const editorPanel = $('#worldbookEntryEditor');
    const managerPanel = $('#worldbookManagerPanel');

    editorPanel.classList.add('hidden');
    managerPanel.classList.remove('hidden');

    currentEditingEntryIndex = null;
}

function saveWorldbookEntry() {
    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    const name = $('#entryNameInput').value.trim();
    const keysStr = $('#entryKeysInput').value.trim();
    const content = $('#entryContentInput').value.trim();
    const constant = $('#entryConstantSelect').value === 'true';
    const insertionOrder = parseInt($('#entryOrderInput').value) || 100;
    const enabled = $('#entryEnabledSwitch').checked;

    if (!name) {
        showToast('请输入条目名称');
        return;
    }

    if (!content) {
        showToast('请输入条目内容');
        return;
    }

    const keys = keysStr ? keysStr.split(',').map(k => k.trim()).filter(k => k) : [];

    const entry = {
        name: name,
        keys: keys,
        content: content,
        constant: constant,
        insertion_order: insertionOrder,
        enabled: enabled
    };

    if (currentEditingEntryIndex !== null) {
        // 更新现有条目
        role.sourceData.characterBook.entries[currentEditingEntryIndex] = entry;
    } else {
        // 添加新条目
        if (!role.sourceData.characterBook.entries) {
            role.sourceData.characterBook.entries = [];
        }
        role.sourceData.characterBook.entries.push(entry);
    }

    // 保存到 localStorage
    saveRolesData();

    showToast(currentEditingEntryIndex !== null ? '条目已更新' : '条目已添加');
    closeWorldbookEntryEditor();
    renderWorldbookEntriesList(role);
}

function copyWorldbookEntry(idx) {
    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    const entry = role.sourceData.characterBook.entries[idx];
    if (!entry) return;

    const newEntry = JSON.parse(JSON.stringify(entry));
    newEntry.name = `${newEntry.name} (副本)`;

    role.sourceData.characterBook.entries.push(newEntry);
    saveRolesData();

    showToast('条目已复制');
    renderWorldbookEntriesList(role);
}

function deleteWorldbookEntry(idx) {
    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    if (!confirm('确定删除这个条目吗？')) return;

    role.sourceData.characterBook.entries.splice(idx, 1);
    saveRolesData();

    showToast('条目已删除');
    renderWorldbookEntriesList(role);
}

function toggleWorldbookEntry(idx, enabled) {
    const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
    if (!role) return;

    const entry = role.sourceData.characterBook.entries[idx];
    if (!entry) return;

    entry.enabled = enabled;
    saveRolesData();

    showToast(enabled ? '条目已启用' : '条目已禁用');
}

function saveRolesData() {
    // 保存角色数据到 localStorage
    // 只保存自定义角色和带有 sourceData 的内置角色的修改
    const customRolesKey = getCurrentUser() ? `ai_custom_roles_${getCurrentUser()}` : 'ai_custom_roles';
    const customRoles = ROLES_DATA.filter(r => r.isCustom);

    try {
        localStorage.setItem(customRolesKey, JSON.stringify(customRoles));

        // 对于内置角色的世界书修改，我们需要单独保存
        const worldbookOverrides = {};
        ROLES_DATA.forEach(role => {
            if (!role.isCustom && role.sourceData && role.sourceData.characterBook) {
                worldbookOverrides[role.id] = role.sourceData.characterBook;
            }
        });

        const worldbookKey = getCurrentUser() ? `ai_worldbook_overrides_${getCurrentUser()}` : 'ai_worldbook_overrides';
        localStorage.setItem(worldbookKey, JSON.stringify(worldbookOverrides));
    } catch (e) {
        console.error('Failed to save roles data:', e);
        showToast('保存失败：存储空间不足');
    }
}

// 初始化世界书管理器事件
function initWorldbookManager() {
    const backBtn = $('#worldbookManagerBackBtn');
    const addBtn = $('#addWorldbookEntryBtn');
    const searchInput = $('#worldbookSearchInput');
    const nameInput = $('#worldbookNameInput');

    backBtn.addEventListener('click', () => {
        // 保存世界书名称
        const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
        if (role && role.sourceData && role.sourceData.characterBook) {
            role.sourceData.characterBook.name = nameInput.value.trim();
            saveRolesData();
        }
        closeWorldbookManager();
    });

    addBtn.addEventListener('click', () => {
        openWorldbookEntryEditor(null);
    });

    searchInput.addEventListener('input', () => {
        const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
        if (role) renderWorldbookEntriesList(role);
    });
}

// 初始化世界书条目编辑器事件
function initWorldbookEntryEditor() {
    const backBtn = $('#worldbookEditorBackBtn');
    const saveBtn = $('#saveEntryBtn');
    const cancelBtn = $('#cancelEntryBtn');

    backBtn.addEventListener('click', closeWorldbookEntryEditor);
    cancelBtn.addEventListener('click', closeWorldbookEntryEditor);
    saveBtn.addEventListener('click', saveWorldbookEntry);
}

// ==================== Scenario Panel ====================
function openScenarioPanel() {
    const panel = $('#scenarioPanel');
    const sidebar = $('#chatSettingsSidebar');
    const backdrop = $('#panelBackdrop');

    // 加载当前情景
    const session = AppState.chatSessions[AppState.currentChat];
    $('#scenarioInput').value = (session && session.scenario) || '';

    backdrop.classList.add('active');
    sidebar.classList.add('hidden');
    panel.classList.remove('hidden');
}

function closeScenarioPanel() {
    const panel = $('#scenarioPanel');
    const sidebar = $('#chatSettingsSidebar');
    const backdrop = $('#panelBackdrop');

    backdrop.classList.remove('active');
    panel.classList.add('hidden');
    sidebar.classList.remove('hidden');
}

function initScenarioPanel() {
    const backBtn = $('#scenarioBackBtn');
    const saveBtn = $('#saveScenarioBtn');
    const backdrop = $('#panelBackdrop');

    backBtn.addEventListener('click', closeScenarioPanel);
    backdrop.addEventListener('click', () => {
        const panel = $('#scenarioPanel');
        if (!panel.classList.contains('hidden')) {
            closeScenarioPanel();
        }
    });

    saveBtn.addEventListener('click', () => {
        if (!AppState.currentChat) return;

        const session = AppState.chatSessions[AppState.currentChat];
        if (!session) return;

        session.scenario = $('#scenarioInput').value.trim();
        saveState();

        showToast('情景设定已保存');
        closeScenarioPanel();
    });
}

// ==================== User Identity Panel ====================
function openUserIdentityPanel() {
    const panel = $('#userIdentityPanel');
    const sidebar = $('#chatSettingsSidebar');
    const backdrop = $('#panelBackdrop');

    // 加载当前用户身份
    const session = AppState.chatSessions[AppState.currentChat];
    $('#userNameInput').value = (session && session.userName) || '';
    $('#userDescInput').value = (session && session.userDesc) || '';

    backdrop.classList.add('active');
    sidebar.classList.add('hidden');
    panel.classList.remove('hidden');
}

function closeUserIdentityPanel() {
    const panel = $('#userIdentityPanel');
    const sidebar = $('#chatSettingsSidebar');
    const backdrop = $('#panelBackdrop');

    backdrop.classList.remove('active');
    panel.classList.add('hidden');
    sidebar.classList.remove('hidden');
}

function initUserIdentityPanel() {
    const backBtn = $('#userIdentityBackBtn');
    const saveBtn = $('#saveUserIdentityBtn');
    const backdrop = $('#panelBackdrop');

    backBtn.addEventListener('click', closeUserIdentityPanel);
    backdrop.addEventListener('click', () => {
        const panel = $('#userIdentityPanel');
        if (!panel.classList.contains('hidden')) {
            closeUserIdentityPanel();
        }
    });

    saveBtn.addEventListener('click', () => {
        if (!AppState.currentChat) return;

        const session = AppState.chatSessions[AppState.currentChat];
        if (!session) return;

        session.userName = $('#userNameInput').value.trim();
        session.userDesc = $('#userDescInput').value.trim();
        saveState();

        updateUserIdentityDisplay();
        showToast('用户身份已保存');
        closeUserIdentityPanel();
    });
}

// ==================== Chat Theme Panel ====================
function openChatThemePanel() {
    const panel = $('#chatThemePanel');
    const sidebar = $('#chatSettingsSidebar');

    // 加载当前主题设置
    const session = AppState.chatSessions[AppState.currentChat];
    const theme = (session && session.chatTheme) || {
        bgType: 'role',
        bgColor: '#1a1a2e',
        bubbleOpacity: 50,
        fontSize: 15
    };

    $('#bgTypeSelect').value = theme.bgType || 'role';
    $('#bgColorInput').value = theme.bgColor || '#1a1a2e';
    $('#bubbleOpacityInput').value = theme.bubbleOpacity || 50;
    $('#fontSizeInput').value = theme.fontSize || 15;

    updateThemePreview();
    handleBgTypeChange();

    const backdrop = $('#panelBackdrop');
    backdrop.classList.add('active');
    sidebar.classList.add('hidden');
    panel.classList.remove('hidden');
}

function closeChatThemePanel() {
    const panel = $('#chatThemePanel');
    const sidebar = $('#chatSettingsSidebar');
    const backdrop = $('#panelBackdrop');

    backdrop.classList.remove('active');
    panel.classList.add('hidden');
    sidebar.classList.remove('hidden');
}

function handleBgTypeChange() {
    const bgType = $('#bgTypeSelect').value;
    const colorSetting = $('#bgColorSetting');
    const imageSetting = $('#bgImageSetting');

    if (bgType === 'color') {
        colorSetting.classList.remove('hidden');
        imageSetting.classList.add('hidden');
    } else if (bgType === 'image') {
        colorSetting.classList.add('hidden');
        imageSetting.classList.remove('hidden');
    } else if (bgType === 'role') {
        colorSetting.classList.add('hidden');
        imageSetting.classList.add('hidden');
    }
}

function updateThemePreview() {
    $('#bubbleOpacityValue').textContent = $('#bubbleOpacityInput').value + '%';
    $('#fontSizeValue').textContent = $('#fontSizeInput').value + 'px';
}

function applyChatTheme() {
    if (!AppState.currentChat) return;

    const session = AppState.chatSessions[AppState.currentChat];
    const theme = (session && session.chatTheme) || {
        bgType: 'role',
        bgColor: '#1a1a2e',
        bubbleOpacity: 50,
        fontSize: 15
    };
    const chatMessages = $('#chatMessages');

    // 重置样式
    chatMessages.style.backgroundImage = '';
    chatMessages.style.backgroundColor = '';
    chatMessages.style.fontSize = '';
    chatMessages.style.removeProperty('--bubble-ai-bg');
    chatMessages.style.removeProperty('--bubble-user-bg');

    if (theme.bgType === 'color') {
        chatMessages.style.backgroundColor = theme.bgColor || '#1a1a2e';
        chatMessages.classList.remove('has-bg-image');
    } else if (theme.bgType === 'image' && theme.bgImage) {
        chatMessages.style.backgroundImage = `url(${theme.bgImage})`;
        chatMessages.classList.add('has-bg-image');
    } else if (theme.bgType === 'role') {
        const role = ROLES_DATA.find(r => String(r.id) === String(AppState.currentChat));
        if (role && role.image) {
            chatMessages.style.backgroundImage = `url(${role.image})`;
            chatMessages.classList.add('has-bg-image');
        }
    }

    if (theme.fontSize) {
        chatMessages.style.fontSize = theme.fontSize + 'px';
    }

    // 应用气泡透明度
    if (theme.bubbleOpacity !== undefined) {
        const opacity = theme.bubbleOpacity / 100;
        chatMessages.style.setProperty('--bubble-ai-bg', `rgba(42, 42, 62, ${opacity})`);
        chatMessages.style.setProperty('--bubble-user-bg', `linear-gradient(135deg, rgba(139, 92, 246, ${opacity}), rgba(59, 130, 246, ${opacity}))`);
    }
}

function initChatThemePanel() {
    const backBtn = $('#chatThemeBackBtn');
    const saveBtn = $('#saveChatThemeBtn');
    const resetBtn = $('#resetChatThemeBtn');
    const bgTypeSelect = $('#bgTypeSelect');
    const bubbleOpacityInput = $('#bubbleOpacityInput');
    const fontSizeInput = $('#fontSizeInput');
    const uploadBgBtn = $('#uploadBgBtn');
    const bgImageInput = $('#bgImageInput');
    const backdrop = $('#panelBackdrop');

    backBtn.addEventListener('click', closeChatThemePanel);

    // 点击背景遮罩关闭面板
    backdrop.addEventListener('click', () => {
        const panel = $('#chatThemePanel');
        if (!panel.classList.contains('hidden')) {
            closeChatThemePanel();
        }
    });

    bgTypeSelect.addEventListener('change', handleBgTypeChange);

    bubbleOpacityInput.addEventListener('input', updateThemePreview);
    fontSizeInput.addEventListener('input', updateThemePreview);

    uploadBgBtn.addEventListener('click', () => {
        bgImageInput.click();
    });

    bgImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            // 临时保存图片数据
            bgImageInput.dataset.imageData = evt.target.result;
            showToast('图片已选择，点击保存后生效');
        };
        reader.readAsDataURL(file);
    });

    saveBtn.addEventListener('click', () => {
        if (!AppState.currentChat) return;

        const session = AppState.chatSessions[AppState.currentChat];
        if (!session) return;

        session.chatTheme = {
            bgType: $('#bgTypeSelect').value,
            bgColor: $('#bgColorInput').value,
            bubbleOpacity: parseInt($('#bubbleOpacityInput').value),
            fontSize: parseInt($('#fontSizeInput').value),
            bgImage: bgImageInput.dataset.imageData || (session.chatTheme && session.chatTheme.bgImage)
        };

        saveState();
        applyChatTheme();

        showToast('主题已保存');
        closeChatThemePanel();
    });

    resetBtn.addEventListener('click', () => {
        if (!AppState.currentChat) return;

        const session = AppState.chatSessions[AppState.currentChat];
        if (session) {
            session.chatTheme = null;
            saveState();
            applyChatTheme();
        }

        showToast('主题已重置');
        closeChatThemePanel();
    });
}

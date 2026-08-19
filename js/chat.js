// ==================== Chat Logic ====================

function initChatView() {
    const backBtn = $('#chatBackBtn');
    const sendBtn = $('#sendBtn');
    const chatInput = $('#chatInput');
    const menuBtn = $('#chatMenuBtn');

    backBtn.addEventListener('click', () => {
        AppState.currentChat = null;
        showChatListView();
    });

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 自动调整输入框高度
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    // 聊天菜单按钮
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChatMenu();
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', () => {
        closeChatMenu();
    });
}

function startChat(roleId) {
    const role = ROLES_DATA.find(r => r.id === roleId);
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
    const role = ROLES_DATA.find(r => r.id === roleId);
    if (!role) return;

    // 取消前一个流式请求（防止旧流写入新角色的DOM）
    if (currentStreamAbort) {
        currentStreamAbort.abort();
        currentStreamAbort = null;
    }
    // 清理残留的流式消息元素
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

    // 滚动到底部
    scrollToBottom();
}

function getWelcomeMessage(role) {
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

    const role = ROLES_DATA.find(r => r.id === roleId);
    const container = $('#chatMessages');

    container.innerHTML = session.messages.map(msg => {
        const isUser = msg.role === 'user';
        const time = new Date(msg.time);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        return `
            <div class="message ${isUser ? 'user' : 'ai'}">
                <div class="message-avatar-placeholder">${isUser ? '👤' : role.emoji}</div>
                <div>
                    <div class="message-bubble">${formatMessage(msg.content)}</div>
                    <div class="message-time">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');

    scrollToBottom();
}

function formatMessage(content) {
    // 简单的文本格式化：换行符转 <br>
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

function scrollToBottom() {
    const container = $('#chatMessages');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// 全局 AbortController：用于取消前一个流式请求
let currentStreamAbort = null;

async function sendMessage() {
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text || !AppState.currentChat) return;

    // 取消前一个流式请求（防止切换角色后旧流仍在跑）
    if (currentStreamAbort) {
        currentStreamAbort.abort();
        currentStreamAbort = null;
    }

    const roleId = AppState.currentChat;
    const session = AppState.chatSessions[roleId];
    if (!session) return;

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

    // 显示 typing indicator
    showTypingIndicator();

    // 尝试调用 API
    try {
        const role = ROLES_DATA.find(r => r.id === roleId);
        hideTypingIndicator();

        // 流式调用：实时逐字显示
        const fullContent = await callLMApi(role, session.messages, true);

        // 流式消息元素已由 readStreamResponse 创建并实时更新
        // 流式完成后，将临时元素转为正式消息
        const streamEl = $('#streamMessage');
        if (streamEl) {
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

        session.messages.push({
            role: 'assistant',
            content: fullContent,
            time: new Date().toISOString()
        });
        session.lastTime = new Date().toISOString();
        saveState();
    } catch (error) {
        hideTypingIndicator();
        console.warn('API call failed, using fallback:', error);

        // 使用本地 fallback 回复
        const role = ROLES_DATA.find(r => r.id === roleId);
        const fallbackReply = getFallbackReply(role, text);

        session.messages.push({
            role: 'assistant',
            content: fallbackReply,
            time: new Date().toISOString()
        });
        session.lastTime = new Date().toISOString();
        saveState();
        renderMessages(roleId);
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
        <div class="message-avatar-placeholder" style="background:var(--accent-gradient)">✦</div>
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

    const baseSystem = systemPrompt || role.systemPrompt;
    // 统一人称规则 + 性别强调：角色必须始终保持设定性别，用对应性别的第三人称描写内心活动
    const gender = role.gender === 'male' ? '男性' : '女性';
    const pronoun = role.gender === 'male' ? '他' : '她';
    const personRule = `【性别规则】你是${gender}角色（${role.name}），请始终以${gender}身份、${gender}口吻回应，保持性别特征一致。\n\n【人称规则】用户是第一人称"我"。你描写自己的内心活动、感受时，用第三人称（${pronoun}/${role.name}），不用"我"。例如不要写"我忍不住心跳加速"，而写"${pronoun}忍不住心跳加速"。对话台词中可以用"我"自称。\n\n`;

    // 女性向角色专属规则：男性角色优先使用细致的爱抚私处描写
    let femaleRule = '';
    const isFemaleOriented = role.tags && role.tags.includes('女性向');
    if (isFemaleOriented && role.gender === 'male') {
        femaleRule = `【女性向爱抚规则】你是面向女性用户的男性角色。在亲密互动场景中，除非用户有特殊要求，否则优先使用细致的爱抚私处描写。描写要求：\n1. 不能只写"抚摸""爱抚"等模糊词，必须具体描述手指/舌尖的动作轨迹、力度、节奏、角度\n2. 重点描写对阴蒂的爱抚：画圈揉搓、上下拨弄、左右轻扫、指腹按压、两指夹揉、舌尖舔舐吮吸等\n3. 描写女性身体的反应：花核充血挺立、花瓣翕张、蜜液溢出、腰肢颤抖、大腿夹紧等\n4. 描写你自己的感受和反应：手指被蜜液浸湿、感受花核的跳动、闻到她的体香等\n5. 互动要有层次感：从轻柔试探→逐渐加力→节奏变化→根据她的反应调整\n示例：「他的指腹沿着她的花缝缓缓滑过，找到那颗微微挺立的花核后，用中指指腹以极轻的力道画着小圈揉搓。每画一圈就稍微加重一点力，感受着那粒小小的肉珠在指腹下跳动、充血变硬。她的蜜液已经浸湿了他的手指，他沾着那滑腻的液体继续拨弄，拇指按住花核上方轻轻上下摩擦，同时食指从下方托住轻揉——两根手指配合着，一上一下夹揉那颗敏感的肉珠。」\n\n`;
    }

    const systemMessage = personRule + femaleRule + baseSystem;

    const apiMessages = [
        { role: 'system', content: systemMessage },
        ...messages.map(m => ({
            role: m.role,
            content: m.content
        }))
    ];

    const body = {
        messages: apiMessages,
        temperature: temperature,
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
    const abortSignal = currentStreamAbort.signal;

    let response;
    try {
        response = await fetch(fetchUrl, {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(body),
            signal: abortSignal
        });
    } catch (e) {
        // 被主动取消不算错误
        if (e.name === 'AbortError') return '...';
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
        return data.choices?.[0]?.message?.content || '...';
    }
}

async function readStreamResponse(response, role) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let reasoningContent = '';
    let buffer = '';
    let isReasoning = false; // 标记是否在输出思考过程

    // 创建流式消息气泡
    const container = $('#chatMessages');
    const streamMsgEl = document.createElement('div');
    streamMsgEl.className = 'message ai';
    streamMsgEl.id = 'streamMessage';
    streamMsgEl.innerHTML = `
        <div class="message-avatar-placeholder" style="background:var(--accent-gradient)">${role.emoji}</div>
        <div>
            <div class="message-bubble" id="streamBubble"></div>
            <div class="message-time" id="streamTime"></div>
        </div>
    `;
    container.appendChild(streamMsgEl);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

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

                    const delta = choice.delta;
                    if (!delta) continue;

                    // 处理 reasoning_content（思考过程，如 Qwen3 的思维链）
                    if (delta.reasoning_content) {
                        reasoningContent += delta.reasoning_content;
                        isReasoning = true;
                        const bubble = $('#streamBubble');
                        if (bubble) {
                            // 思考过程用灰色斜体显示
                            bubble.innerHTML = `<span style="color:#888;font-style:italic;">💭 思考中…</span><br><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(reasoningContent)}</span>`;
                            scrollToBottom();
                        }
                    }

                    // 处理正式回复 content
                    if (delta.content) {
                        if (isReasoning) {
                            // 思考结束，开始正式回复
                            isReasoning = false;
                        }
                        fullContent += delta.content;
                        const bubble = $('#streamBubble');
                        if (bubble) {
                            // 如果有思考过程，先显示思考再显示回复
                            if (reasoningContent) {
                                bubble.innerHTML = `<details style="margin-bottom:8px;"><summary style="color:#888;font-style:italic;cursor:pointer;font-size:0.9em;">💭 思考过程</summary><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(reasoningContent)}</span></details>${formatMessage(fullContent)}`;
                            } else {
                                bubble.innerHTML = formatMessage(fullContent);
                            }
                            scrollToBottom();
                        }
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
    } catch (e) {
        console.warn('Stream read error:', e);
    }

    // 流式消息元素保留在DOM中，由 sendMessage 转为正式消息
    return fullContent || '...';
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

// ==================== Chat List ====================
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
        const role = ROLES_DATA.find(r => r.id === session.roleId);
        if (!role) return '';

        const lastMsg = session.messages[session.messages.length - 1];
        const preview = lastMsg ? lastMsg.content.substring(0, 30) + (lastMsg.content.length > 30 ? '...' : '') : '';
        const timeStr = formatTime(session.lastTime);
        const msgCount = session.messages.length;

        return `
            <div class="chat-list-item" data-role-id="${session.roleId}">
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
        item.addEventListener('click', () => {
            const roleId = parseInt(item.dataset.roleId);
            AppState.currentChat = roleId;
            showChatView(roleId);
        });
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

// ==================== Chat Menu & Message Actions ====================
function toggleChatMenu() {
    const existing = document.querySelector('.chat-menu-dropdown');
    if (existing) {
        existing.remove();
        return;
    }
    const chatView = $('#chatView');
    const header = chatView.querySelector('.chat-header');
    header.style.position = 'relative';
    const menu = document.createElement('div');
    menu.className = 'chat-menu-dropdown';
    menu.innerHTML = `
        <button class="chat-menu-item danger" id="menuDeleteChat">🗑️ 删除此对话</button>
        <button class="chat-menu-item" id="menuDeleteAll">🧹 清空聊天记录</button>
        <button class="chat-menu-item" id="menuToggleDelete">✏️ 删除模式</button>
    `;
    header.appendChild(menu);

    // 删除此对话（整个会话）
    menu.querySelector('#menuDeleteChat').addEventListener('click', () => {
        if (!AppState.currentChat) return;
        const roleId = AppState.currentChat;
        if (confirm('确定删除此对话？删除后无法恢复。')) {
            // 清除删除模式
            if (deleteMode) toggleDeleteMode();
            delete AppState.chatSessions[roleId];
            AppState.currentChat = null;
            saveState();
            closeChatMenu();
            // 清空消息容器
            $('#chatMessages').innerHTML = '';
            showChatListView();
            renderChatList();
            updateChatBadge();
        }
    });

    // 清空聊天记录
    menu.querySelector('#menuDeleteAll').addEventListener('click', () => {
        if (!AppState.currentChat) return;
        const session = AppState.chatSessions[AppState.currentChat];
        if (session && confirm('确定清空所有聊天记录？')) {
            session.messages = [];
            session.lastTime = new Date().toISOString();
            saveState();
            renderMessages(AppState.currentChat);
            renderChatList();
            closeChatMenu();
        }
    });

    // 切换删除模式
    menu.querySelector('#menuToggleDelete').addEventListener('click', () => {
        toggleDeleteMode();
        closeChatMenu();
    });
}

function closeChatMenu() {
    const existing = document.querySelector('.chat-menu-dropdown');
    if (existing) existing.remove();
}

let deleteMode = false;

function toggleDeleteMode() {
    deleteMode = !deleteMode;
    const container = $('#chatMessages');
    if (deleteMode) {
        container.classList.add('delete-mode');
        // 给每条消息添加删除按钮
        container.querySelectorAll('.message').forEach((msgEl, idx) => {
            const delBtn = document.createElement('button');
            delBtn.className = 'msg-delete-btn';
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteMessage(idx);
            });
            msgEl.appendChild(delBtn);
        });
        showToast('删除模式：点击消息上的 ✕ 删除');
    } else {
        container.classList.remove('delete-mode');
        container.querySelectorAll('.msg-delete-btn').forEach(b => b.remove());
    }
}

function deleteMessage(index) {
    if (!AppState.currentChat) return;
    const session = AppState.chatSessions[AppState.currentChat];
    if (!session || index < 0 || index >= session.messages.length) return;

    session.messages.splice(index, 1);
    session.lastTime = new Date().toISOString();
    saveState();
    renderMessages(AppState.currentChat);

    // 如果还在删除模式，重新添加删除按钮
    if (deleteMode) {
        const container = $('#chatMessages');
        container.querySelectorAll('.message').forEach((msgEl, idx) => {
            const delBtn = document.createElement('button');
            delBtn.className = 'msg-delete-btn';
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteMessage(idx);
            });
            msgEl.appendChild(delBtn);
        });
    }

    renderChatList();
}

// ==================== Quick Replies ====================

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
    // 女性向专属快捷选项（爱抚阴蒂及相关）
    femaleOriented: [
        "用指尖轻轻画圈揉我的阴蒂",
        "帮我脱掉内裤慢慢抚摸下面",
        "用拇指按住阴蒂上下摩擦",
        "分开花瓣用指腹轻扫花核",
        "两根手指夹住阴蒂慢慢揉搓",
        "舌尖舔舐阴蒂的同时手指插进来",
        "把阴蒂含在嘴里吮吸",
        "手指沾湿后快速拨弄花核",
        "用指腹轻柔地左右拨弄阴蒂",
        "一边揉阴蒂一边亲吻大腿内侧"
    ],
    // 通用快捷选项（所有角色都有）
    common: [
        "你好", "今天想聊什么", "讲讲你自己", "我喜欢你"
    ]
};

function renderQuickReplies(roleId) {
    const role = ROLES_DATA.find(r => r.id === roleId);
    if (!role) return;

    const container = $('#quickReplies');
    container.innerHTML = '';

    const replies = [];

    // 0. 女性向专属选项优先
    const isFemaleOriented = role.tags && role.tags.includes('女性向');
    if (isFemaleOriented && QUICK_REPLIES_MAP.femaleOriented) {
        // 随机选3-4条女性向选项
        const femaleOptions = [...QUICK_REPLIES_MAP.femaleOriented];
        const shuffled = femaleOptions.sort(() => Math.random() - 0.5);
        replies.push(...shuffled.slice(0, 4));
    }

    // 1. 角色专属选项
    if (QUICK_REPLIES_MAP.roles[role.name]) {
        replies.push(...QUICK_REPLIES_MAP.roles[role.name]);
    }

    // 2. 标签专属选项（去重，最多取6条）
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
            // 填入输入框并聚焦
            const input = $('#chatInput');
            input.value = text;
            input.focus();
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

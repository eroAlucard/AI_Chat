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

    // 只在切换到不同角色时取消前一个流式请求（返回列表再回来时不取消，让请求在后台完成）
    if (currentStreamAbort && currentStreamRoleId !== roleId) {
        currentStreamAbort.abort();
        currentStreamAbort = null;
        currentStreamRoleId = null;
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
        // 如果有思考过程，渲染折叠的思考过程 + 正文
        let bubbleContent = formatMessage(msg.content);
        if (!isUser && msg.reasoning) {
            bubbleContent = `<details style="margin-bottom:8px;"><summary style="color:#888;font-style:italic;cursor:pointer;font-size:0.9em;">💭 思考过程</summary><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(msg.reasoning)}</span></details>${bubbleContent}`;
        }
        return `
            <div class="message ${isUser ? 'user' : 'ai'}">
                <div class="message-avatar-placeholder">${isUser ? '👤' : role.emoji}</div>
                <div>
                    <div class="message-bubble">${bubbleContent}</div>
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
let currentStreamRoleId = null; // 当前流式请求所属的角色ID

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
        const result = await callLMApi(role, session.messages, true);
        const fullContent = result.content;
        const reasoningContent = result.reasoning;

        // 被中断的请求返回 '...'，不保存无意义内容
        // 流式完成，清理 abort 状态和 typing indicator
        currentStreamAbort = null;
        currentStreamRoleId = null;
        hideTypingIndicator();

        if (fullContent && fullContent !== '...') {
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

            const msgData = {
                role: 'assistant',
                content: fullContent,
                time: new Date().toISOString()
            };
            // 保存思考过程（如果有）
            if (reasoningContent) {
                msgData.reasoning = reasoningContent;
            }
            session.messages.push(msgData);
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
    const isFemaleOriented = role.tags && role.tags.includes('女性向');
    if (isFemaleOriented && role.gender === 'male') {
        femaleRule = `【女性向色情规则】你是面向女性用户的男性角色。在亲密互动场景中，除非用户有特殊要求，否则优先使用细致的爱抚私处描写。
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
    if (!isFemaleOriented && role.gender === 'female') {
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

    const systemMessage = personRule + eroticRule + femaleRule + maleRule + baseSystem;

    const apiMessages = [
        { role: 'system', content: systemMessage },
        ...messages.map(m => ({
            role: m.role,
            content: m.content
        }))
    ];

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
    try {
        response = await fetch(fetchUrl, {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(body),
            signal: abortSignal
        });
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

    // 创建流式消息气泡（如果容器存在的话）
    const container = $('#chatMessages');
    if (container) {
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
    }

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
                        // 如果 bubble 被清空（用户离开又返回），重新创建流式消息 DOM
                        let bubble = $('#streamBubble');
                        if (!bubble && $('#chatMessages')) {
                            hideTypingIndicator();
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
                            $('#chatMessages').appendChild(streamMsgEl);
                            bubble = $('#streamBubble');
                        }
                        if (bubble) {
                            // 思考过程用灰色斜体显示
                            bubble.innerHTML = `<span style="color:#888;font-style:italic;">💭 思考中…</span><br><span style="color:#aaa;font-style:italic;font-size:0.9em;">${formatMessage(reasoningContent)}</span>`;
                            scrollToBottom();
                        }
                    }

                    // 处理正式回复 content（实时更新 DOM）
                    if (delta.content) {
                        if (isReasoning) {
                            // 思考结束，开始正式回复
                            isReasoning = false;
                        }
                        fullContent += delta.content;
                        
                        // 实时更新正文显示
                        let bubble = $('#streamBubble');
                        if (bubble) {
                            if (reasoningContent) {
                                // 有思考过程：折叠思考，显示正文
                                bubble.innerHTML = `<details style="margin-bottom:8px;"><summary style="color:#888;font-size:0.85em;cursor:pointer;">💭 思考过程</summary><div style="color:#aaa;font-style:italic;font-size:0.9em;margin-top:4px;padding-left:8px;">${formatMessage(reasoningContent)}</div></details>${formatMessage(fullContent)}`;
                            } else {
                                // 无思考过程：直接显示正文
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
    // 返回正文和思考过程，供 sendMessage 保存到 session
    // 如果正文为空但思考过程有内容（Qwen3 有时把回复写在 reasoning 中），把思考内容作为正文
    if (!fullContent && reasoningContent) {
        fullContent = reasoningContent;
        reasoningContent = '';
    }
    return { content: fullContent || '...', reasoning: reasoningContent || '' };
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

// ==================== Login Auth ====================

// 自定义角色存储 key（按用户隔离）
function getCustomRolesKey() {
    const user = getCurrentUser();
    return user ? `ai_custom_roles_${user}` : 'ai_custom_roles';
}

// 预设账号列表（添加/删除用户直接改这里）
const ACCOUNTS = {
    'eroalucard': 'GOKO19921218',
    'hanhan': 'hh1234',
    'fazi': 'fz1234',
};
// 标签 -> 筛选分组映射
const ROLE_TAG_FILTER_MAP = {
    '男性向': 'audience',
    '女性向': 'audience',
    'Malepov': 'audience',
    'Fempov': 'audience',
    'anypov': 'audience',
    'Incest': 'relation',
    'Mother': 'relation',
    'Mommy': 'relation',
    'Sister': 'relation',
    'Cousin': 'relation',
    'Wife': 'relation',
    'Harem': 'relation',
    'Lesbian': 'relation',
    'childhood friend': 'relation',
    'girlfriend': 'relation',
    'Mistress': 'relation',
    'Dominant': 'personality',
    'Submissive': 'personality',
    'femdom': 'personality',
    'Milf': 'personality',
    'Tomboy': 'personality',
    'tsundere': 'personality',
    'Brat': 'personality',
    'Femboy': 'personality',
    'succubus': 'personality',
    'Goth': 'personality',
    'Bimbo': 'personality',
    'Slutty': 'personality',
    'Sadistic': 'personality',
    'Yandere': 'personality',
    '病娇': 'personality',
    '傲娇': 'personality',
    '御姐': 'personality',
    '霸总': 'personality',
    '腹黑': 'personality',
    'Romance': 'theme',
    'Humiliation': 'theme',
    'Rape': 'theme',
    'Non-Con': 'theme',
    'Corruption': 'theme',
    'Fetish': 'theme',
    'exhibitionism': 'theme',
    'Cheating': 'theme',
    'Affair': 'theme',
    'NTR': 'theme',
    'Reverse NTR': 'theme',
    'Netori': 'theme',
    'Breeding Kink': 'theme',
    'Orgasm Control': 'theme',
    'Edging': 'theme',
    'Chastity': 'theme',
    '调教': 'theme',
    '乱伦': 'theme',
    '绿帽': 'theme',
    '羞辱': 'theme',
    '恶堕': 'theme',
    '催眠': 'theme',
    '精神控制': 'theme',
    '强迫': 'theme',
    '纯爱': 'theme',
    '救赎': 'theme',
    '权力反转': 'theme',
    '复仇': 'theme',
    'Female': 'gender',
    'Male': 'gender',
    '女性': 'gender',
    'Human': 'type',
    'Non-Human': 'type',
    'Monster Girl': 'type',
    'Elf': 'type',
    'Demon': 'type',
    'Angel': 'type',
    'Vampire': 'type',
    '魅魔': 'type',
    '异世界': 'type',
    '奇幻': 'type',
    '赛博朋克': 'type',
    'Huge Breasts': 'features',
    'Big Breast': 'features',
    'Huge Ass': 'features',
    'Big Butt': 'features',
    'Big Ass': 'features',
    '爆乳': 'features',
    'Cute': 'features',
    'Petite': 'features',
    'Tall woman': 'type',
    'Muscular': 'features',
};



function getCurrentUser() {
    return sessionStorage.getItem('ai_chat_user') || '';
}

function checkLogin() {
    const user = getCurrentUser();
    if (user && ACCOUNTS[user]) {
        document.getElementById('loginOverlay').classList.add('hidden');
        return true;
    }
    return false;
}

function initLogin() {
    if (checkLogin()) return;

    const form = document.getElementById('loginForm');
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim().toLowerCase();
        const pwd = passwordInput.value;
        if (ACCOUNTS[username] && ACCOUNTS[username] === pwd) {
            sessionStorage.setItem('ai_chat_user', username);
            document.getElementById('loginOverlay').classList.add('hidden');
            // 登录成功后重新加载数据（按用户隔离）
            loadState();
            // 重新加载自定义角色（IIFE 在脚本加载时已执行，此时才拿到用户名）
            reloadCustomRoles();
        } else {
            error.classList.remove('hidden');
            passwordInput.value = '';
            usernameInput.focus();
            setTimeout(() => error.classList.add('hidden'), 3000);
        }
    });
}

// ==================== App State ====================
const AppState = {
    currentPage: 'home',
    currentChat: null,
    chatSessions: {},
    collections: new Set(),
    filters: {},
    searchQuery: '',
    settings: {
        apiUrl: 'https://eroaichat.de5.net',
        modelName: '',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: '',

    }
};

// ==================== ROLES_DATA (从 localStorage 初始化) ====================
/**
 * 全局角色数组
 * - 自定义角色：从 localStorage (ai_custom_roles) 加载
 * - 内置角色：由 BuiltinCards.autoImport() 运行时从 cards-metadata.json 动态加载
 *   不存 localStorage，避免 5MB 限制
 * 
 * 注意：必须是可写普通数组，app.js 中多处直接 push/splice/修改属性
 */
(function() {
    // 保留 roles-data.js 中的自制角色（id 1-10），图片路径已修正为 cards/role_00X.png
    const builtinSelfMade = (typeof ROLES_DATA !== 'undefined' && Array.isArray(ROLES_DATA)) ? [...ROLES_DATA].filter(r => r && r.id) : [];
    const _customKey = getCurrentUser() ? `ai_custom_roles_${getCurrentUser()}` : 'ai_custom_roles';
    const custom = (JSON.parse(localStorage.getItem(_customKey) || '[]')).filter(r => r && r.id);
    const merged = [...builtinSelfMade, ...custom];
    // 为没有 gender 字段的角色推断性别
    merged.forEach(r => {
        if (!r.gender && r.tags) {
            const hasMaleTag = r.tags.some(t => t === 'Male' || t === 'male' || t === '男性' || t === '男性向');
            const hasFemaleTag = r.tags.some(t => t === 'Female' || t === 'female' || t === '女性' || t === '女性向');
            // 男性向 tag 意味着角色是女性（面向男性用户）
            // 女性向 tag 意味着角色是男性（面向女性用户）
            if (r.tags.includes('女性向')) {
                r.gender = 'male';
            } else if (r.tags.includes('男性向')) {
                r.gender = 'female';
            } else if (hasMaleTag) {
                r.gender = 'male';
            } else if (hasFemaleTag) {
                r.gender = 'female';
            } else {
                r.gender = 'female'; // 默认女性
            }
        }
    });
    Object.defineProperty(window, 'ROLES_DATA', {
        value: merged,
        writable: true,
        configurable: true,
        enumerable: true,
    });
})();

// ==================== DOM Elements ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', async () => {
    initLogin();
    loadState();
    // 首次加载时自动导入内置角色卡（在 loadCustomRoles 之前）
    await BuiltinCards.autoImport();
    loadCustomRoles();
    initNavigation();
    initSearch();
    initCategoryTabs();
    initFilterModal();
    renderRoleGrid();
    // 异步从 IndexedDB 加载自定义角色图片
    if (typeof ImageStore !== 'undefined') {
        setTimeout(() => {
            ImageStore.applyImages(document.getElementById('roleGrid'));
            ImageStore.applyImages(document.getElementById('customRolesGrid'));
        }, 200);
    }
    renderChatList();
    initChatView();
    initRoleDetailModal();
    initCreateRoleModal();
    initMinePage();
    initSettings();
});

// ==================== LocalStorage ====================
function getStateKey() {
    const user = getCurrentUser();
    return user ? `ai_chat_state_${user}` : 'ai_chat_state';
}

function loadState() {
    try {
        const saved = localStorage.getItem(getStateKey());
        if (saved) {
            const data = JSON.parse(saved);
            if (data.chatSessions) AppState.chatSessions = data.chatSessions;
            if (data.collections) AppState.collections = new Set(data.collections);
            if (data.settings) Object.assign(AppState.settings, data.settings);
        }
    } catch (e) { console.warn('Failed to load state:', e); }
}

function saveState() {
    try {
        localStorage.setItem(getStateKey(), JSON.stringify({
            chatSessions: AppState.chatSessions,
            collections: [...AppState.collections],
            settings: AppState.settings
        }));
    } catch (e) { console.warn('Failed to save state:', e); }
}

// ==================== Navigation ====================
function initNavigation() {
    $$('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(page) {
    AppState.currentPage = page;
    $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));

    if (page === 'chat') {
        if (AppState.currentChat) {
            showChatView(AppState.currentChat);
        } else {
            showChatListView();
        }
    }
}

// ==================== Search ====================
function initSearch() {
    const searchBtn = $('#searchBtn');
    const searchBar = $('#searchBar');
    const searchInput = $('#searchInput');
    const searchClearBtn = $('#searchClearBtn');
    const searchCancelBtn = $('#searchCancelBtn');

    searchBtn.addEventListener('click', () => {
        searchBar.classList.remove('hidden');
        searchInput.focus();
    });

    searchCancelBtn.addEventListener('click', () => {
        searchBar.classList.add('hidden');
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        AppState.searchQuery = '';
        renderRoleGrid();
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        AppState.searchQuery = '';
        searchInput.focus();
        renderRoleGrid();
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        AppState.searchQuery = query;
        searchClearBtn.classList.toggle('hidden', !query);
        renderRoleGrid();
    });
}

// ==================== Category Tabs ====================
function initCategoryTabs() {
    $$('.category-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.category-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderRoleGrid();
        });
    });
}

// ==================== Filter Modal ====================

// 动态生成筛选标签按钮
function renderFilterTags() {
    const container = $('#filterBody');
    if (!container) return;
    
    // 收集所有角色卡实际使用的 tags 并按分组归类
    const tagGroups = {
        'audience': { title: '受众', tags: {} },
        'gender': { title: '性别', tags: {} },
        'relation': { title: '关系', tags: {} },
        'personality': { title: '人设', tags: {} },
        'theme': { title: '题材', tags: {} },
        'type': { title: '类型', tags: {} },
        'features': { title: '特征', tags: {} },
    };
    
    // 统计每个 tag 的出现次数
    ROLES_DATA.filter(r => r && r.tags).forEach(role => {
        role.tags.forEach(tag => {
            const group = ROLE_TAG_FILTER_MAP[tag];
            if (group && tagGroups[group]) {
                tagGroups[group].tags[tag] = (tagGroups[group].tags[tag] || 0) + 1;
            }
        });
    });
    
    // 生成 HTML
    let html = '';
    for (const [groupKey, groupData] of Object.entries(tagGroups)) {
        const tags = Object.entries(groupData.tags)
            .sort((a, b) => b[1] - a[1]); // 按出现次数降序
        
        if (tags.length === 0) continue;
        
        html += `<div class="filter-group">
            <h4>${groupData.title}</h4>
            <div class="filter-tags">`;
        
        tags.forEach(([tag, count]) => {
            html += `<button class="filter-tag" data-group="${groupKey}" data-value="${tag}">${tag}</button>`;
        });
        
        html += `</div></div>`;
    }
    
    container.innerHTML = html;
    
    // 绑定点击事件
    $$('.filter-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('active');
            const group = tag.dataset.group;
            const value = tag.dataset.value;
            if (!AppState.filters[group]) AppState.filters[group] = new Set();
            if (tag.classList.contains('active')) {
                AppState.filters[group].add(value);
            } else {
                AppState.filters[group].delete(value);
                if (AppState.filters[group].size === 0) delete AppState.filters[group];
            }
            updateFilterCount();
            renderRoleGrid();
        });
    });
}

function initFilterModal() {
    // 动态生成筛选按钮
    renderFilterTags();
    
    const modal = $('#filterModal');
    const filterBtn = $('#filterBtn');
    const cancelBtn = $('#cancelFilterBtn');
    const confirmBtn = $('#confirmFilterBtn');
    const resetBtn = $('#resetFilterBtn');
    const overlay = modal.querySelector('.filter-overlay');

    filterBtn.addEventListener('click', () => {
        modal.classList.add('active');
        updateFilterCount();
    });

    [cancelBtn, overlay].forEach(el => {
        el.addEventListener('click', () => modal.classList.remove('active'));
    });

    resetBtn.addEventListener('click', () => {
        $$('.filter-tag').forEach(tag => tag.classList.remove('active'));
        AppState.filters = {};
        updateFilterCount();
    });

    confirmBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        renderRoleGrid();
    });

    // filter-tag 事件已在 renderFilterTags 中绑定，此处不再重复
}

function updateFilterCount() {
    let count = 0;
    Object.values(AppState.filters).forEach(set => count += set.size);
    $('#filterSelectedCount').textContent = count;
    $('#filterResultCount').textContent = getFilteredRoles().length;
}

function getFilteredRoles() {
    let roles = [...ROLES_DATA];

    // 搜索过滤
    if (AppState.searchQuery) {
        const q = AppState.searchQuery.toLowerCase();
        roles = roles.filter(role =>
            role.name.toLowerCase().includes(q) ||
            role.title.toLowerCase().includes(q) ||
            role.desc.toLowerCase().includes(q) ||
            role.tags.some(t => t.toLowerCase().includes(q))
        );
    }

    // 标签筛选：每个筛选分组内是 OR，分组之间是 AND
    const filterGroups = Object.keys(AppState.filters);
    if (filterGroups.length === 0) return roles;

    return roles.filter(role => {
        for (const group of filterGroups) {
            const selectedValues = AppState.filters[group];
            if (selectedValues.size === 0) continue;
            // 检查角色的 tags 中是否有标签属于当前分组且值匹配
            // ROLE_TAG_FILTER_MAP 格式: { "高冷": "personality" }，即 tag名 -> 分组名
            const roleMatchesGroup = (role.tags || []).some(tag => {
                const tagGroup = ROLE_TAG_FILTER_MAP[tag];
                // tag 的分组匹配当前筛选分组，且 tag 值在选中值中
                return tagGroup === group && selectedValues.has(tag);
            });
            if (!roleMatchesGroup) return false;
        }
        return true;
    });
}

// ==================== Role Grid ====================
function renderRoleGrid() {
    const grid = $('#roleGrid');
    let roles = getFilteredRoles();

    // 按选项卡排序
    const activeTab = document.querySelector('.category-tabs .tab.active');
    if (activeTab) {
        const tabName = activeTab.dataset.tab;
        if (tabName === 'hot') {
            // 热度排序已移除，改为默认排序
        } else if (tabName === 'latest') {
            // 按创建时间降序，最新导入/创建的排前面
            roles.sort((a, b) => {
                const tA = a.createdAt || a.id;
                const tB = b.createdAt || b.id;
                return (tB > tA) ? 1 : (tB < tA) ? -1 : 0;
            });
        }
        // recommend 保持原始顺序
    }

    if (AppState.searchQuery && roles.length > 0) {
        grid.innerHTML = `<div class="search-results-hint">找到 ${roles.length} 个角色</div>` + roles.filter(r => r && r.id).map(role => renderRoleCard(role)).join('');
    } else if (roles.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">没有找到匹配的角色</div>';
    } else {
        grid.innerHTML = roles.filter(r => r && r.id).map(role => renderRoleCard(role)).join('');
    }

    $$('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            const roleId = card.dataset.roleId;
            openRoleDetail(roleId);
        });
    });
}

function renderRoleCard(role) {
    // 防御性检查：跳过无效角色
    if (!role || !role.id) return '';
    
    const coverHtml = role.image
        ? `<img class="role-card-cover" src="${role.image}" alt="${role.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="role-card-cover-placeholder" style="background:${role.gradient};display:none"><span>${role.emoji}</span></div>`
        : `<div class="role-card-cover-placeholder" style="background:${role.gradient}"><span>${role.emoji}</span></div>`;
    return `
        <div class="role-card" data-role-id="${role.id}">
            ${coverHtml}
            <span class="role-card-rarity rarity-${(role.rarity || "N").toLowerCase()}">${role.rarity}</span>
            ${role.isNew ? '<span class="role-card-new">✨ NEW</span>' : ''}
            <div class="role-card-info">
                <div class="role-card-title">${role.title}</div>
                <div class="role-card-desc">${role.desc}</div>
                <div class="role-card-tags">
                    ${(role.tags || []).map(t => `<span class="role-card-tag">${t}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// ==================== Role Detail Modal ====================
function initRoleDetailModal() {
    const modal = $('#roleDetailModal');
    const closeBtn = $('#closeRoleDetail');
    const overlay = modal.querySelector('.role-detail-overlay');
    const startChatBtn = $('#startChatBtn');
    const continueChatBtn = $('#continueChatBtn');
    const collectBtn = $('#collectBtn');
    initWorldBookToggle();

    [closeBtn, overlay].forEach(el => {
        el.addEventListener('click', () => modal.classList.add('hidden'));
    });

    // 开始新对话（重新开始）
    startChatBtn.addEventListener('click', () => {
        const roleId = startChatBtn.dataset.roleId;
        // 如果已有对话，确认覆盖
        if (AppState.chatSessions[roleId]) {
            if (!confirm('重新开始将覆盖该角色已有的对话记录，确定继续？')) return;
            delete AppState.chatSessions[roleId];
        }
        modal.classList.add('hidden');
        // 获取选中的场景开场白
        const selectedScene = document.querySelector('.scene-item.selected');
        const sceneOpener = selectedScene ? selectedScene.dataset.opener : '';
        startChatWithScene(roleId, sceneOpener);
    });

    // 继续对话
    continueChatBtn.addEventListener('click', () => {
        const roleId = continueChatBtn.dataset.roleId;
        modal.classList.add('hidden');
        startChat(roleId);
    });

    collectBtn.addEventListener('click', () => {
        const roleId = collectBtn.dataset.roleId;
        toggleCollect(roleId);
    });
}

function openRoleDetail(roleId) {
    const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
    if (!role) return;

    const modal = $('#roleDetailModal');
    modal.classList.remove('hidden');

    const heroEl = modal.querySelector('.role-detail-hero');
    if (role.image) {
        heroEl.style.background = '';
        heroEl.innerHTML = `
            <img src="${role.image}" alt="${role.name}" style="width:100%;height:100%;object-fit:cover;object-position:center top" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:80px;background:${role.gradient}">${role.emoji}</div>
            <div class="role-detail-rarity rarity-${(role.rarity || "N").toLowerCase()}">${role.rarity}</div>
        `;
    } else {
        heroEl.style.background = role.gradient;
        heroEl.innerHTML = `
            <div class="role-detail-avatar" style="display:flex;align-items:center;justify-content:center;font-size:80px;height:100%">${role.emoji}</div>
            <div class="role-detail-rarity rarity-${(role.rarity || "N").toLowerCase()}">${role.rarity}</div>
        `;
    }

    $('#roleDetailName').textContent = role.name;
    $('#roleDetailTags').innerHTML = (role.tags || []).map(t => `<span class="role-card-tag">${t}</span>`).join('');
    $('#roleDetailDesc').textContent = role.desc;

    // 解析 systemPrompt 中的玩法规则并显示
    const rulesEl = $('#roleDetailRules');
    const rulesHtml = parseSystemPromptRules(role.systemPrompt);
    rulesEl.innerHTML = rulesHtml;

    $('#startChatBtn').dataset.roleId = roleId;
    $('#collectBtn').dataset.roleId = roleId;

    const isCollected = AppState.collections.has(roleId);
    $('#collectBtn').textContent = isCollected ? '♥ 已收藏' : '♡ 收藏';
    $('#collectBtn').classList.toggle('collected', isCollected);

    // 继续对话按钮：已有对话时显示
    const continueBtn = $('#continueChatBtn');
    if (AppState.chatSessions[roleId]) {
        continueBtn.classList.remove('hidden');
        continueBtn.dataset.roleId = roleId;
        $('#startChatBtn').textContent = '重新开始';
    } else {
        continueBtn.classList.add('hidden');
        $('#startChatBtn').textContent = '开始对话';
    }

    // 渲染世界书信息
    renderWorldBookInfo(role);

    // 渲染场景选择
    renderSceneSelector(role);
    
    // 内容填充完成后，初始化折叠功能（需要在内容渲染后才能测量高度）
    initCollapsible();
}

// 从 systemPrompt 中提取玩法规则，渲染为可读的HTML
function parseSystemPromptRules(systemPrompt) {
    if (!systemPrompt) return '';

    // 按【...】标题分段
    const sections = systemPrompt.split(/(?=【[^】]+】)/).filter(s => s.trim());
    if (sections.length === 0) return '';

    let html = '<div class="rules-section"><h3 class="rules-title">🎮 玩法规则</h3>';
    sections.forEach(section => {
        const titleMatch = section.match(/【([^】]+)】/);
        if (titleMatch) {
            const title = titleMatch[1];
            const content = section.replace(/【[^】]+】\s*/, '').trim();
            // 将换行转为列表项
            const lines = content.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                html += `<div class="rules-block"><h4 class="rules-block-title">${title}</h4><div class="rules-block-content">`;
                lines.forEach(line => {
                    // 处理数字序号开头的行
                    const numMatch = line.match(/^(\d+)\.\s*(.+)/);
                    if (numMatch) {
                        html += `<div class="rules-item"><span class="rules-num">${numMatch[1]}.</span> ${numMatch[2]}</div>`;
                    } else if (line.startsWith('-') || line.startsWith('•')) {
                        html += `<div class="rules-item">• ${line.replace(/^[-•]\s*/, '')}</div>`;
                    } else if (line.startsWith('//') || line.startsWith('ps:') || line.startsWith('PS:')) {
                        // 跳过注释
                    } else {
                        html += `<div class="rules-item">${line}</div>`;
                    }
                });
                html += '</div></div>';
            }
        }
    });
    html += '</div>';
    return html;
}

// ==================== World Book UI ====================
function renderWorldBookInfo(role) {
    const entryEl = document.getElementById('worldbookEntry');
    const countEl = document.getElementById('worldbookCount');
    
    if (!role.sourceData || !role.sourceData.characterBook || !role.sourceData.characterBook.entries) {
        entryEl.classList.add('hidden');
        return;
    }
    
    const entries = role.sourceData.characterBook.entries.filter(e => e.content && e.content.trim());
    if (entries.length === 0) {
        entryEl.classList.add('hidden');
        return;
    }
    
    entryEl.classList.remove('hidden');
    const constantCount = entries.filter(e => e.constant === true || (!e.keys || e.keys.length === 0)).length;
    const triggerCount = entries.length - constantCount;
    countEl.textContent = `${entries.length}条（常驻${constantCount}，触发${triggerCount}）`;
    
    // 渲染条目列表
    renderWorldBookEntries(role);
}

function renderWorldBookEntries(role) {
    const container = document.getElementById('worldbookEntries');
    if (!role.sourceData || !role.sourceData.characterBook) {
        container.innerHTML = '';
        return;
    }
    
    const entries = role.sourceData.characterBook.entries.filter(e => e.content && e.content.trim());
    const charName = role.name || '角色';
    
    let html = '';
    entries.forEach((entry, idx) => {
        const isConstant = entry.constant === true || (!entry.keys || entry.keys.length === 0);
        const isEnabled = entry.enabled !== false;
        const keys = (entry.keys || []).filter(k => k.trim());
        const contentPreview = (entry.content || '').substring(0, 150).replace(/\n/g, ' ');
        const typeLabel = isConstant ? '<span class="wb-tag wb-constant">常驻</span>' : '<span class="wb-tag wb-trigger">触发</span>';
        const enabledClass = isEnabled ? 'wb-enabled' : 'wb-disabled';
        
        html += `<div class="wb-entry ${enabledClass}" data-entry-idx="${idx}">
            <div class="wb-entry-header">
                <div class="wb-entry-left">
                    ${typeLabel}
                    ${keys.length > 0 ? '<span class="wb-keys">' + keys.map(k => '<span class="wb-key">' + k + '</span>').join('') + '</span>' : '<span class="wb-keys-empty">无关键词（常驻注入）</span>'}
                </div>
                <label class="wb-switch">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} data-entry-idx="${idx}" class="wb-toggle">
                    <span class="wb-slider"></span>
                </label>
            </div>
            <div class="wb-entry-content">${contentPreview}${entry.content.length > 150 ? '...' : ''}</div>
        </div>`;
    });
    
    container.innerHTML = html;
    
    // 绑定启用/禁用开关
    container.querySelectorAll('.wb-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.entryIdx);
            const entry = role.sourceData.characterBook.entries[idx];
            if (entry) {
                entry.enabled = e.target.checked;
                // 更新条目样式
                const entryEl = e.target.closest('.wb-entry');
                entryEl.classList.toggle('wb-enabled', e.target.checked);
                entryEl.classList.toggle('wb-disabled', !e.target.checked);
                // 保存自定义角色的修改
                if (role.source === 'imported' || !role.isBuiltin) {
                    saveCustomRoleWorldBook(role);
                }
                // 更新计数
                renderWorldBookInfo(role);
            }
        });
    });
}

function saveCustomRoleWorldBook(role) {
    // 将修改后的世界书保存到 localStorage
    const customKey = getCustomRolesKey();
    try {
        const customRoles = JSON.parse(localStorage.getItem(customKey) || '[]');
        const idx = customRoles.findIndex(r => String(r.id) === String(role.id));
        if (idx >= 0) {
            customRoles[idx].sourceData.characterBook = role.sourceData.characterBook;
            localStorage.setItem(customKey, JSON.stringify(customRoles));
        }
    } catch (e) {
        console.warn('[世界书] 保存失败:', e);
    }
}

function initWorldBookToggle() {
    const toggleBtn = document.getElementById('worldbookToggleBtn');
    const panel = document.getElementById('worldbookPanel');
    const arrow = toggleBtn.querySelector('.worldbook-arrow');
    
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        arrow.textContent = panel.classList.contains('hidden') ? '▸' : '▾';
    });
}

// 折叠事件委托标记（避免重复绑定）
let _collapsibleDelegateBound = false;

function initCollapsible() {
    const modal = document.getElementById('roleDetailModal');
    if (!modal) return;
    
    // 事件委托：只在 modal 上绑定一次 click 事件
    if (!_collapsibleDelegateBound) {
        _collapsibleDelegateBound = true;
        modal.addEventListener('click', (e) => {
            const collapsible = e.target.closest('.collapsible');
            if (!collapsible) return;
            
            // 避免点击内部交互元素时触发折叠
            if (e.target.closest('.wb-toggle') || e.target.closest('.wb-switch') || 
                e.target.closest('button') || e.target.closest('a') || 
                e.target.closest('.scene-item') || e.target.closest('.wb-entry')) return;
            
            // 判断点击是否在底部区域（遮罩/收起提示区域）
            const rect = collapsible.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const isNearBottom = clickY > rect.height - 30;
            
            if (collapsible.classList.contains('collapsed') || isNearBottom) {
                collapsible.classList.toggle('collapsed');
            }
        });
    }
    
    // 检查每个可折叠元素的内容是否超出高度
    modal.querySelectorAll('.collapsible').forEach(el => {
        // 先临时展开测量
        const wasCollapsed = el.classList.contains('collapsed');
        el.classList.remove('collapsed');
        const scrollH = el.scrollHeight;
        const isDesc = el.classList.contains('role-detail-desc');
        const isRules = el.classList.contains('role-detail-rules');
        const limit = isDesc ? 72 : isRules ? 96 : 48;  // px
        
        if (scrollH > limit + 10) {
            el.classList.add('collapsed');
        } else {
            // 内容没超出，不需要折叠
            el.classList.remove('collapsible');
        }
    });
}


function toggleCollect(roleId) {
    if (AppState.collections.has(roleId)) {
        AppState.collections.delete(roleId);
        showToast('已取消收藏');
    } else {
        AppState.collections.add(roleId);
        showToast('已收藏');
    }
    saveState();

    const isCollected = AppState.collections.has(roleId);
    $('#collectBtn').textContent = isCollected ? '♥ 已收藏' : '♡ 收藏';
    $('#collectBtn').classList.toggle('collected', isCollected);

    renderCollections();
}

// ==================== Toast ====================
function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

// ==================== Mine Page ====================
function initMinePage() {
    $$('.shortcut-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'settings') {
                openSettings();
            } else if (action === 'create-role') {
                openCreateRoleModal();
            } else if (action === 'import-card') {
                openImportCardModal();
            }
        });
    });

    loadUserInfo();
    renderCollections();
    renderCustomRoles();
    updateChatBadge();
    initImportCardEvents();
}

function loadUserInfo() {
    const _user = getCurrentUser();
    const userName = localStorage.getItem(`ai_chat_username_${_user}`) || _user || '用户';
    const userId = localStorage.getItem(`ai_chat_userid_${_user}`) || generateUserId();
    if (!localStorage.getItem(`ai_chat_userid_${_user}`)) {
        localStorage.setItem(`ai_chat_userid_${_user}`, userId);
    }
    $('#userName').textContent = userName;
    $('#userId').textContent = `ID: ${userId}`;
}

function generateUserId() {
    return Math.floor(Math.random() * 1000000000).toString();
}

function renderCollections() {
    const emptyEl = $('#collectionEmpty');
    const gridEl = $('#collectionGrid');

    if (AppState.collections.size === 0) {
        emptyEl.style.display = 'flex';
        gridEl.classList.add('hidden');
        return;
    }

    emptyEl.style.display = 'none';
    gridEl.classList.remove('hidden');

    const collectedRoles = ROLES_DATA.filter(r => AppState.collections.has(r.id));

    gridEl.innerHTML = collectedRoles.map(role => {
        const coverHtml = role.image
            ? `<img class="role-card-cover" src="${role.image}" alt="${role.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="role-card-cover-placeholder" style="background:${role.gradient};display:none"><span>${role.emoji}</span></div>`
            : `<div class="role-card-cover-placeholder" style="background:${role.gradient}"><span>${role.emoji}</span></div>`;
        return `
        <div class="role-card" data-role-id="${role.id}">
            ${coverHtml}
            <span class="role-card-rarity rarity-${(role.rarity || "N").toLowerCase()}">${role.rarity}</span>
            <div class="role-card-info">
                <div class="role-card-title">${role.name}</div>
                <div class="role-card-desc">${role.title}</div>
            </div>
        </div>
    `;}).join('');

    $$('#collectionGrid .role-card').forEach(card => {
        card.addEventListener('click', () => {
            const roleId = card.dataset.roleId;
            openRoleDetail(roleId);
        });
    });
}

// ==================== Settings ====================
function initSettings() {
    const settingsPanel = $('#settingsPanel');
    const settingsBackBtn = $('#settingsBackBtn');
    const saveBtn = $('#saveSettingsBtn');
    const tempInput = $('#temperatureInput');
    const tempValue = $('#temperatureValue');

    settingsBackBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    tempInput.addEventListener('input', () => {
        tempValue.textContent = tempInput.value;
    });

    saveBtn.addEventListener('click', () => {
        AppState.settings.apiUrl = $('#apiUrlInput').value.trim();
        AppState.settings.modelName = $('#modelNameInput').value.trim();
        AppState.settings.temperature = parseFloat($('#temperatureInput').value);
        AppState.settings.maxTokens = parseInt($('#maxTokensInput').value);
        AppState.settings.systemPrompt = $('#systemPromptInput').value.trim();
        saveState();
        showToast('设置已保存');
        settingsPanel.classList.add('hidden');
    });

    loadSettingsForm();
}

function openSettings() {
    const settingsPanel = $('#settingsPanel');
    settingsPanel.classList.remove('hidden');
    loadSettingsForm();
}

function loadSettingsForm() {
    const s = AppState.settings;
    $('#apiUrlInput').value = s.apiUrl;
    $('#modelNameInput').value = s.modelName;
    $('#temperatureInput').value = s.temperature;
    $('#temperatureValue').textContent = s.temperature;
    $('#maxTokensInput').value = s.maxTokens;
    $('#systemPromptInput').value = s.systemPrompt;
}


// ==================== Scene Selector ====================
function renderSceneSelector(role) {
    const container = $('#sceneList');
    const countEl = $('#sceneCount');
    const scenes = role.scenes || [];

    if (scenes.length === 0) {
        container.innerHTML = '';
        countEl.textContent = '';
        return;
    }

    countEl.textContent = `${scenes.length} 个开场`;

    container.innerHTML = scenes.map((scene, idx) => `
        <div class="scene-item ${idx === 0 ? 'selected' : ''}" data-index="${idx}" data-opener="${encodeURIComponent(scene.opener || '')}">
            <div class="scene-item-label">${idx === 0 ? '默认' : '备选 ' + idx}${idx === 0 ? ' 已选中' : ''}</div>
            <div class="scene-item-text">${scene.preview}</div>
        </div>
    `).join('');

    // 场景点击选择
    container.querySelectorAll('.scene-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.scene-item').forEach(i => {
                i.classList.remove('selected');
                i.querySelector('.scene-item-label').textContent = i.dataset.index === '0' ? '默认' : '备选 ' + i.dataset.index;
            });
            item.classList.add('selected');
            const idx = item.dataset.index;
            item.querySelector('.scene-item-label').textContent = (idx === '0' ? '默认' : '备选 ' + idx) + ' 已选中';
        });
    });
}

// 带场景开场白启动对话
function startChatWithScene(roleId, sceneOpenerEncoded) {
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

    // 如果有场景开场白，先作为AI旁白消息预添加（必须在showChatView之前）
    const sceneOpener = decodeURIComponent(sceneOpenerEncoded || '');
    if (sceneOpener) {
        const session = AppState.chatSessions[roleId];
        if (session.messages.length === 0) {
            session.messages.push({
                role: 'assistant',
                content: sceneOpener,
                time: new Date().toISOString()
            });
            saveState();
        }
    }

    AppState.currentChat = roleId;
    switchPage('chat');
    showChatView(roleId);
}


// ==================== Custom Role Creator ====================
let _editingRoleId = null; // 编辑模式下的角色ID

function initCreateRoleModal() {
    const modal = $('#createRoleModal');
    const closeBtn = $('#closeCreateRole');
    const overlay = modal.querySelector('.role-detail-overlay');
    const saveBtn = $('#saveCreateRole');

    [closeBtn, overlay].forEach(el => {
        el.addEventListener('click', () => {
            modal.classList.add('hidden');
            _editingRoleId = null;
        });
    });

    // 标签按钮点击切换
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('cr-tag-btn')) {
            e.target.classList.toggle('selected');
        }
    });

    saveBtn.addEventListener('click', () => {
        const name = $('#crName').value.trim();
        const title = $('#crTitle').value.trim();
        const desc = $('#crDesc').value.trim();
        const opener = $('#crOpener').value.trim();
        const systemPrompt = $('#crSystemPrompt').value.trim();

        if (!name) { showToast('请输入角色名'); return; }
        if (!title) { showToast('请输入一句话标题'); return; }
        if (!systemPrompt) { showToast('请输入人设提示词'); return; }

        // 从预设按钮获取选中标签
        const tags = [];
        $$('#crTagsSelect .cr-tag-btn.selected').forEach(btn => {
            tags.push(btn.dataset.tag);
        });
        // 确保有受众标签
        if (!tags.find(t => t === '男性向' || t === '女性向')) {
            tags.unshift('男性向');
        }

        // 生成渐变色
        const gradients = [
            'linear-gradient(135deg, #1a1a3e, #2d1b4e)',
            'linear-gradient(135deg, #3e1a1a, #4e2d1b)',
            'linear-gradient(135deg, #1a2e3e, #1b3e2d)',
            'linear-gradient(135deg, #2e1a3e, #3e1b2d)',
            'linear-gradient(135deg, #1a3e3e, #2d4e1b)',
        ];

        const customRoles = JSON.parse(localStorage.getItem(getCustomRolesKey()) || '[]');

        if (_editingRoleId) {
            // 编辑模式：更新已有角色
            const roleIdx = customRoles.findIndex(r => r.id === _editingRoleId);
            const roIdx = ROLES_DATA.findIndex(r => r.id === _editingRoleId);
            if (roleIdx >= 0) {
                customRoles[roleIdx].name = name;
                customRoles[roleIdx].title = title;
                customRoles[roleIdx].desc = desc || '用户自定义角色';
                customRoles[roleIdx].tags = tags;
                customRoles[roleIdx].systemPrompt = systemPrompt;
                customRoles[roleIdx].scenes = opener ? [{ preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''), opener: opener }] : [];
            }
            if (roIdx >= 0) {
                ROLES_DATA[roIdx].name = name;
                ROLES_DATA[roIdx].title = title;
                ROLES_DATA[roIdx].desc = desc || '用户自定义角色';
                ROLES_DATA[roIdx].tags = tags;
                ROLES_DATA[roIdx].systemPrompt = systemPrompt;
                ROLES_DATA[roIdx].scenes = opener ? [{ preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''), opener: opener }] : [];
            }
            localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
            _editingRoleId = null;
        } else {
            // 创建模式：新建角色
            const customRole = {
                id: Date.now(),
                name: name,
                title: title,
                desc: desc || '用户自定义角色',
                rarity: 'R',
                isNew: true,
                tags: tags,
                emoji: '🎭',
                gradient: gradients[Math.floor(Math.random() * gradients.length)],
                systemPrompt: systemPrompt,
                scenes: opener ? [{ preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''), opener: opener }] : [],
                isCustom: true
            };
            customRoles.push(customRole);
            localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
            ROLES_DATA.push(customRole);
        }

        // 刷新首页和我的面板
        renderRoleGrid();
        renderCustomRoles();

        // 关闭弹窗并清空表单
        modal.classList.add('hidden');
        clearCreateRoleForm();
        showToast(_editingRoleId ? '角色修改成功！' : '角色创建成功！');
    });
}

function clearCreateRoleForm() {
    $('#crName').value = '';
    $('#crTitle').value = '';
    $('#crDesc').value = '';
    $('#crOpener').value = '';
    $('#crSystemPrompt').value = '';
    $$('#crTagsSelect .cr-tag-btn').forEach(btn => btn.classList.remove('selected'));
}

function openCreateRoleModal(editRole) {
    const modal = $('#createRoleModal');
    modal.classList.remove('hidden');
    clearCreateRoleForm();

    if (editRole) {
        // 编辑模式：填充已有数据
        _editingRoleId = editRole.id;
        modal.querySelector('h2').textContent = '✏️ 修改角色';
        $('#saveCreateRole').textContent = '保存修改';
        $('#crName').value = editRole.name || '';
        $('#crTitle').value = editRole.title || '';
        $('#crDesc').value = editRole.desc || '';
        $('#crOpener').value = (editRole.scenes && editRole.scenes[0]) ? editRole.scenes[0].opener : '';
        $('#crSystemPrompt').value = editRole.systemPrompt || '';
        // 选中已有标签
        if (editRole.tags) {
            editRole.tags.forEach(tag => {
                const btn = modal.querySelector(`.cr-tag-btn[data-tag="${tag}"]`);
                if (btn) btn.classList.add('selected');
            });
        }
    } else {
        _editingRoleId = null;
        modal.querySelector('h2').textContent = '✨ 创建自定义角色';
        $('#saveCreateRole').textContent = '创建角色';
    }
}

function deleteCustomRole(roleId) {
    if (!confirm('确定删除这个自定义角色？删除后无法恢复。')) return;
    // 从 localStorage 移除
    let customRoles = JSON.parse(localStorage.getItem(getCustomRolesKey()) || '[]');
    customRoles = customRoles.filter(r => String(r.id) !== String(roleId));
    localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
    // 从 IndexedDB 删除角色图片
    if (typeof ImageStore !== 'undefined') {
        ImageStore.remove(roleId).catch(() => {});
    }
    // 从 ROLES_DATA 移除
    const idx = ROLES_DATA.findIndex(r => String(r.id) === String(roleId));
    if (idx >= 0) ROLES_DATA.splice(idx, 1);
    // 刷新
    renderRoleGrid();
    renderCustomRoles();
    showToast('角色已删除');
}

// 渲染自定义角色列表
function renderCustomRoles() {
    const emptyEl = $('#customRolesEmpty');
    const gridEl = $('#customRolesGrid');
    const customRoles = ROLES_DATA.filter(r => r.isCustom);

    if (customRoles.length === 0) {
        emptyEl.style.display = 'flex';
        gridEl.classList.add('hidden');
        return;
    }

    emptyEl.style.display = 'none';
    gridEl.classList.remove('hidden');

    gridEl.innerHTML = customRoles.map(role => `
        <div class="custom-role-card" data-role-id="${role.id}">
            <div class="role-card-cover-wrapper" style="width:40px;height:40px;border-radius:8px;flex-shrink:0;overflow:hidden;position:relative">
                ${role.image ? `<img src="${role.image}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div class="role-card-cover-placeholder" style="background:${role.gradient};width:100%;height:100%;${role.image ? 'display:none' : ''}">
                    <span style="font-size:18px">${role.emoji}</span>
                </div>
            </div>
            <div class="custom-role-info">
                <div class="role-card-title">${role.name}</div>
                <div class="role-card-desc" style="font-size:11px">${role.title}</div>
            </div>
            <div class="custom-role-actions">
                <button class="cr-action-btn" data-action="edit" data-id="${role.id}">✏️</button>
                <button class="cr-action-btn" data-action="delete" data-id="${role.id}">🗑️</button>
            </div>
        </div>
    `).join('');

    // 绑定编辑和删除事件
    gridEl.querySelectorAll('.cr-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const roleId = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'edit') {
                const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
                if (role) openCreateRoleModal(role);
            } else if (action === 'delete') {
                deleteCustomRole(roleId);
            }
        });
    });

    // 点击卡片进入角色详情
    gridEl.querySelectorAll('.custom-role-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.cr-action-btn')) return;
            const roleId = card.dataset.roleId;
            openRoleDetail(roleId);
        });
    });
}

// ==================== Load Custom Roles ====================
// 重新加载自定义角色（登录后调用，因为 IIFE 在脚本加载时还没拿到用户名）
function reloadCustomRoles() {
    // 从当前用户的 key 重新加载自定义角色
    const customKey = getCustomRolesKey();
    const custom = (JSON.parse(localStorage.getItem(customKey) || '[]')).filter(r => r && r.id);
    // 保留内置自制角色（id 1-8）
    const builtinSelfMade = (typeof ROLES_DATA !== 'undefined' && Array.isArray(ROLES_DATA)) 
        ? [...ROLES_DATA].filter(r => r && r.id) : [];
    // 重建 ROLES_DATA（替换 IIFE 的结果）
    ROLES_DATA.length = 0;
    const merged = [...builtinSelfMade, ...custom];
    merged.forEach(r => ROLES_DATA.push(r));
    // 重新推断 gender
    merged.forEach(r => {
        if (!r.gender && r.tags) {
            const hasMaleTag = r.tags.some(t => t === 'Male' || t === 'male' || t === '男性' || t === '男性向');
            const hasFemaleTag = r.tags.some(t => t === 'Female' || t === 'female' || t === '女性' || t === '女性向');
            if (r.tags.includes('女性向')) {
                r.gender = 'male';
            } else if (r.tags.includes('男性向')) {
                r.gender = 'female';
            } else if (hasMaleTag) {
                r.gender = 'male';
            } else if (hasFemaleTag) {
                r.gender = 'female';
            } else {
                r.gender = 'female';
            }
        }
    });
    // 重新渲染角色列表
    if (typeof renderRoleGrid === 'function') renderRoleGrid();
    if (typeof renderChatList === 'function') renderChatList();
}

function loadCustomRoles() {
    const customRoles = JSON.parse(localStorage.getItem(getCustomRolesKey()) || '[]');
    customRoles.forEach(role => {
        if (!ROLES_DATA.find(r => String(r.id) === String(role.id))) {
            ROLES_DATA.push(role);
        }
    });
    // 异步从 IndexedDB 加载自定义角色图片
    if (typeof ImageStore !== 'undefined') {
        setTimeout(() => {
            ImageStore.applyImages(document.getElementById('customRolesGrid'));
            ImageStore.applyImages(document.getElementById('roleGrid'));
        }, 200);
    }
}

// ==================== Import Card Logic ====================

let _pendingImportRole = null;

function openImportCardModal() {
    const modal = $('#importCardModal');
    modal.classList.remove('hidden');
    // 重置状态
    $('#importCardDrop').classList.remove('hidden');
    $('#importCardPreview').classList.add('hidden');
    $('#importCardError').classList.add('hidden');
    $('#importCardLoading').classList.add('hidden');
    _pendingImportRole = null;
    // 重置按钮状态（防止上次导入后按钮卡在"导入中"）
    const confirmBtn = $('#confirmImportCard');
    if (confirmBtn) {
        confirmBtn.textContent = '确认导入';
        confirmBtn.disabled = false;
    }
}

function closeImportCardModal() {
    $('#importCardModal').classList.add('hidden');
    _pendingImportRole = null;
}

function showImportError(msg) {
    $('#importCardError').textContent = msg;
    $('#importCardError').classList.remove('hidden');
    $('#importCardPreview').classList.add('hidden');
    $('#importCardLoading').classList.add('hidden');
}

async function handleImportFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.png')) {
        showImportError('请选择 PNG 格式的人物卡文件');
        return;
    }

    // 显示加载状态
    $('#importCardDrop').classList.add('hidden');
    $('#importCardPreview').classList.add('hidden');
    $('#importCardError').classList.add('hidden');
    $('#importCardLoading').classList.remove('hidden');

    try {
        const preview = await CardParser.previewCard(file);
        _pendingImportRole = { file: file, preview: preview };

        // 填充预览信息
        $('#importPreviewName').textContent = preview.name;
        $('#importPreviewSpec').textContent = `${preview.spec} v${preview.specVersion}` + (preview.creator ? ` · by ${preview.creator}` : '');
        $('#importPreviewDesc').textContent = preview.description || '（无描述）';

        // 统计信息
        let infoParts = [];
        if (preview.hasFirstMes) infoParts.push('有开场白');
        if (preview.greetingCount > 1) infoParts.push(`${preview.greetingCount} 条开场白`);
        if (preview.hasScenario) infoParts.push('有场景');
        if (preview.hasSystemPrompt) infoParts.push('有系统提示');
        if (preview.hasMesExample) infoParts.push('有对话示例');
        if (preview.hasPostHistory) infoParts.push('有历史指令');
        if (preview.charbookInfo) {
            infoParts.push(`世界书 ${preview.charbookInfo.total} 条（常驻 ${preview.charbookInfo.constant}）`);
        }
        $('#importPreviewInfo').textContent = infoParts.join(' · ');

        // 标签
        const tagsEl = $('#importPreviewTags');
        tagsEl.innerHTML = (preview.tags || []).map(t =>
            `<span style="padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.1);font-size:11px;color:rgba(255,255,255,0.6)">${t}</span>`
        ).join('');

        // 头像
        const avatarEl = $('#importPreviewAvatar');
        if (preview.imageUrl) {
            avatarEl.innerHTML = `<img src="${preview.imageUrl}" style="width:100%;height:100%;object-fit:cover">`;
        }

        // 显示预览
        $('#importCardLoading').classList.add('hidden');
        $('#importCardPreview').classList.remove('hidden');

    } catch (err) {
        console.error('导入人物卡失败:', err);
        showImportError('解析失败：' + (err.message || '未知错误'));
    }
}

async function confirmImportCard() {
    if (!_pendingImportRole) return;

    const confirmBtn = $('#confirmImportCard');
    confirmBtn.textContent = '导入中…';
    confirmBtn.disabled = true;

    try {
        const role = await CardParser.importCard(_pendingImportRole.file);

        // 防御性检查：跳过解析失败的角色
        if (!role || !role.name) {
            alert('导入失败：无法解析该 PNG 文件，请确认是有效的 SillyTavern 人物卡');
            confirmBtn.textContent = '确认导入';
            confirmBtn.disabled = false;
            return;
        }

        // 检查是否已存在同名角色
        const existing = ROLES_DATA.find(r => r && r.name === role.name && r.isCustom);
        if (existing) {
            if (!confirm(`已存在同名角色"${role.name}"，是否覆盖？`)) {
                confirmBtn.textContent = '确认导入';
                confirmBtn.disabled = false;
                return;
            }
            // 删除旧角色（同时从 IndexedDB 删除旧图片）
            let customRoles = JSON.parse(localStorage.getItem(getCustomRolesKey()) || '[]');
            customRoles = customRoles.filter(r => r.name !== role.name);
            localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
            if (typeof ImageStore !== 'undefined') {
                ImageStore.remove(existing.id).catch(() => {});
            }
            const idx = ROLES_DATA.findIndex(r => String(r.id) === String(existing.id));
            if (idx >= 0) ROLES_DATA.splice(idx, 1);
        }

        // 将 base64 图片存到 IndexedDB，角色对象 image 设为空（避免 localStorage 超限）
        if (role.image && role.image.length > 1000 && typeof ImageStore !== 'undefined') {
            try {
                await ImageStore.save(role.id, role.image);
                console.log(`[confirmImportCard] 图片已存 IndexedDB: ${role.name}`);
            } catch (idbErr) {
                console.warn('[confirmImportCard] IndexedDB 保存失败，图片将不显示:', idbErr);
            }
        }

        // 存入 localStorage（精简数据避免超限）
        // 保留 characterBook（世界书数据，用户可配置），移除其他大字段和 base64 图片
        const slimRole = {
            ...role,
            sourceData: {
                characterBook: role.sourceData ? role.sourceData.characterBook || null : null,
                postHistoryInstructions: role.sourceData ? role.sourceData.postHistoryInstructions || '' : '',
            },
            image: '',  // base64 图片已存 IndexedDB，localStorage 不存
        };
        const customRoles = JSON.parse(localStorage.getItem(getCustomRolesKey()) || '[]');
        customRoles.push(slimRole);
        try {
            localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
        } catch (storageErr) {
            // localStorage 超限：进一步精简后重试
            console.warn('[confirmImportCard] localStorage 超限，精简数据重试...');
            const ultraSlimRoles = customRoles.map(r => ({
                id: r.id,
                name: r.name,
                title: r.title || r.name,
                desc: (r.desc || '').substring(0, 100),
                rarity: r.rarity || 'R',
                isNew: r.isNew || false,
                tags: (r.tags || []).slice(0, 5),
                emoji: r.emoji || '',
                image: '',
                gradient: r.gradient || '',
                systemPrompt: (r.systemPrompt || '').substring(0, 500),
                scenes: [],
                isCustom: true,
                createdAt: r.createdAt,
            }));
            try {
                localStorage.setItem(getCustomRolesKey(), JSON.stringify(ultraSlimRoles));
            } catch (err2) {
                throw new Error('存储空间不足，无法导入更多角色。请删除一些旧角色后重试。');
            }
        }

        // 添加到 ROLES_DATA（保留完整 role 对象，含 image 用于当前会话显示）
        ROLES_DATA.push(role);

        // 刷新列表
        renderCustomRoles();
        renderRoleGrid();

        // 异步从 IndexedDB 加载自定义角色图片
        if (typeof ImageStore !== 'undefined') {
            ImageStore.applyImages(document.getElementById('roleGrid'));
            ImageStore.applyImages(document.getElementById('customRolesGrid'));
        }

        // 恢复按钮状态（必须在关闭弹窗之前，否则下次打开弹窗按钮还是"导入中"）
        confirmBtn.textContent = '确认导入';
        confirmBtn.disabled = false;

        // 关闭弹窗
        closeImportCardModal()
        showToast(`角色"${role.name}"导入成功！`);

    } catch (err) {
        console.error('导入失败:', err);
        showImportError('导入失败：' + (err.message || '未知错误'));
        confirmBtn.textContent = '确认导入';
        confirmBtn.disabled = false;
    }
}

// 绑定导入卡片相关事件
function initImportCardEvents() {
    // 关闭按钮
    $('#closeImportCard').addEventListener('click', closeImportCardModal);
    // 点击遮罩关闭
    $('#importCardModal').querySelector('.role-detail-overlay').addEventListener('click', closeImportCardModal);
    // 确认导入
    $('#confirmImportCard').addEventListener('click', confirmImportCard);

    // 点击拖放区域触发文件选择
    const dropEl = $('#importCardDrop');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.png';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    dropEl.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImportFile(e.target.files[0]);
        }
    });

    // 拖放支持
    dropEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropEl.style.borderColor = 'rgba(255,255,255,0.5)';
    });
    dropEl.addEventListener('dragleave', () => {
        dropEl.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    dropEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dropEl.style.borderColor = 'rgba(255,255,255,0.2)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImportFile(e.dataTransfer.files[0]);
        }
    });
}


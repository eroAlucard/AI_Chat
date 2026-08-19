// ==================== Login Auth ====================
const ACCESS_PASSWORD = 'hh1234';

function checkLogin() {
    const authed = sessionStorage.getItem('ai_chat_authed');
    if (authed === '1') {
        document.getElementById('loginOverlay').classList.add('hidden');
        return true;
    }
    return false;
}

function initLogin() {
    if (checkLogin()) return;

    const form = document.getElementById('loginForm');
    const input = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = input.value.trim();
        if (pwd === ACCESS_PASSWORD) {
            sessionStorage.setItem('ai_chat_authed', '1');
            document.getElementById('loginOverlay').classList.add('hidden');
        } else {
            error.classList.remove('hidden');
            input.value = '';
            input.focus();
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

// ==================== DOM Elements ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    loadState();
    loadCustomRoles();
    initNavigation();
    initSearch();
    initCategoryTabs();
    initFilterModal();
    renderRoleGrid();
    renderChatList();
    initChatView();
    initRoleDetailModal();
    initCreateRoleModal();
    initMinePage();
    initSettings();
});

// ==================== LocalStorage ====================
function loadState() {
    try {
        const saved = localStorage.getItem('ai_chat_state');
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
        localStorage.setItem('ai_chat_state', JSON.stringify({
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
function initFilterModal() {
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
            renderRoleGrid(); // 实时更新筛选结果
        });
    });
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
            const roleMatchesGroup = role.tags.some(tag => {
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
            roles.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        }
        // recommend 保持原始顺序
    }

    if (AppState.searchQuery && roles.length > 0) {
        grid.innerHTML = `<div class="search-results-hint">找到 ${roles.length} 个角色</div>` + roles.map(role => renderRoleCard(role)).join('');
    } else if (roles.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">没有找到匹配的角色</div>';
    } else {
        grid.innerHTML = roles.map(role => renderRoleCard(role)).join('');
    }

    $$('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            const roleId = parseInt(card.dataset.roleId);
            openRoleDetail(roleId);
        });
    });
}

function renderRoleCard(role) {
    const coverHtml = role.image
        ? `<img class="role-card-cover" src="${role.image}" alt="${role.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="role-card-cover-placeholder" style="background:${role.gradient};display:none"><span>${role.emoji}</span></div>`
        : `<div class="role-card-cover-placeholder" style="background:${role.gradient}"><span>${role.emoji}</span></div>`;
    return `
        <div class="role-card" data-role-id="${role.id}">
            ${coverHtml}
            <span class="role-card-rarity rarity-${role.rarity.toLowerCase()}">${role.rarity}</span>
            ${role.isNew ? '<span class="role-card-new">✨ NEW</span>' : ''}
            <div class="role-card-info">
                <div class="role-card-title">${role.title}</div>
                <div class="role-card-desc">${role.desc}</div>
                <div class="role-card-tags">
                    ${role.tags.map(t => `<span class="role-card-tag">${t}</span>`).join('')}
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

    [closeBtn, overlay].forEach(el => {
        el.addEventListener('click', () => modal.classList.add('hidden'));
    });

    // 开始新对话（重新开始）
    startChatBtn.addEventListener('click', () => {
        const roleId = parseInt(startChatBtn.dataset.roleId);
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
        const roleId = parseInt(continueChatBtn.dataset.roleId);
        modal.classList.add('hidden');
        startChat(roleId);
    });

    collectBtn.addEventListener('click', () => {
        const roleId = parseInt(collectBtn.dataset.roleId);
        toggleCollect(roleId);
    });
}

function openRoleDetail(roleId) {
    const role = ROLES_DATA.find(r => r.id === roleId);
    if (!role) return;

    const modal = $('#roleDetailModal');
    modal.classList.remove('hidden');

    const heroEl = modal.querySelector('.role-detail-hero');
    if (role.image) {
        heroEl.style.background = '';
        heroEl.innerHTML = `
            <img src="${role.image}" alt="${role.name}" style="width:100%;height:100%;object-fit:cover;object-position:center top" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:80px;background:${role.gradient}">${role.emoji}</div>
            <div class="role-detail-rarity rarity-${role.rarity.toLowerCase()}">${role.rarity}</div>
        `;
    } else {
        heroEl.style.background = role.gradient;
        heroEl.innerHTML = `
            <div class="role-detail-avatar" style="display:flex;align-items:center;justify-content:center;font-size:80px;height:100%">${role.emoji}</div>
            <div class="role-detail-rarity rarity-${role.rarity.toLowerCase()}">${role.rarity}</div>
        `;
    }

    $('#roleDetailName').textContent = role.name;
    $('#roleDetailTags').innerHTML = role.tags.map(t => `<span class="role-card-tag">${t}</span>`).join('');
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

    // 渲染场景选择
    renderSceneSelector(role);
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
            }
        });
    });

    loadUserInfo();
    renderCollections();
    renderCustomRoles();
    updateChatBadge();
}

function loadUserInfo() {
    const userName = localStorage.getItem('ai_chat_username') || '用户';
    const userId = localStorage.getItem('ai_chat_userid') || generateUserId();
    if (!localStorage.getItem('ai_chat_userid')) {
        localStorage.setItem('ai_chat_userid', userId);
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
            <span class="role-card-rarity rarity-${role.rarity.toLowerCase()}">${role.rarity}</span>
            <div class="role-card-info">
                <div class="role-card-title">${role.name}</div>
                <div class="role-card-desc">${role.title}</div>
            </div>
        </div>
    `;}).join('');

    $$('#collectionGrid .role-card').forEach(card => {
        card.addEventListener('click', () => {
            const roleId = parseInt(card.dataset.roleId);
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

        const customRoles = JSON.parse(localStorage.getItem('ai_custom_roles') || '[]');

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
            localStorage.setItem('ai_custom_roles', JSON.stringify(customRoles));
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
            localStorage.setItem('ai_custom_roles', JSON.stringify(customRoles));
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
    let customRoles = JSON.parse(localStorage.getItem('ai_custom_roles') || '[]');
    customRoles = customRoles.filter(r => r.id !== roleId);
    localStorage.setItem('ai_custom_roles', JSON.stringify(customRoles));
    // 从 ROLES_DATA 移除
    const idx = ROLES_DATA.findIndex(r => r.id === roleId);
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
            <div class="role-card-cover-placeholder" style="background:${role.gradient};width:40px;height:40px;border-radius:8px;flex-shrink:0">
                <span style="font-size:18px">${role.emoji}</span>
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
            const roleId = parseInt(btn.dataset.id);
            const action = btn.dataset.action;
            if (action === 'edit') {
                const role = ROLES_DATA.find(r => r.id === roleId);
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
            const roleId = parseInt(card.dataset.roleId);
            openRoleDetail(roleId);
        });
    });
}

// 加载自定义角色
function loadCustomRoles() {
    const customRoles = JSON.parse(localStorage.getItem('ai_custom_roles') || '[]');
    customRoles.forEach(role => {
        if (!ROLES_DATA.find(r => r.id === role.id)) {
            ROLES_DATA.push(role);
        }
    });
}

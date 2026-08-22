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

// ==================== User Behavior Tracking (智能推荐系统) ====================
const UserBehavior = {
    // 获取用户行为数据的localStorage key
    getStorageKey() {
        const user = getCurrentUser();
        return user ? `ai_user_behavior_${user}` : 'ai_user_behavior';
    },

    // 加载用户行为数据
    load() {
        try {
            const data = localStorage.getItem(this.getStorageKey());
            return data ? JSON.parse(data) : this.getDefaultData();
        } catch (e) {
            console.error('加载用户行为数据失败:', e);
            return this.getDefaultData();
        }
    },

    // 默认数据结构
    getDefaultData() {
        return {
            tagHistory: {}, // { "标签名": { views: 次数, searches: 次数, filters: 次数, lastTime: 时间戳 } }
            recentRoles: [], // 最近浏览的角色ID列表
            searchHistory: [], // 搜索历史
            version: 1
        };
    },

    // 保存用户行为数据
    save(data) {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
        } catch (e) {
            console.error('保存用户行为数据失败:', e);
        }
    },

    // 记录角色卡浏览（提取该卡的所有标签）
    trackRoleView(roleId) {
        const role = ROLES_DATA.find(r => r.id === roleId);
        if (!role || !role.tags) return;

        const data = this.load();
        const now = Date.now();

        // 记录最近浏览
        data.recentRoles = data.recentRoles || [];
        data.recentRoles = data.recentRoles.filter(id => id !== roleId);
        data.recentRoles.unshift(roleId);
        if (data.recentRoles.length > 50) {
            data.recentRoles = data.recentRoles.slice(0, 50);
        }

        // 记录标签浏览
        role.tags.forEach(tag => {
            if (!data.tagHistory[tag]) {
                data.tagHistory[tag] = { views: 0, searches: 0, filters: 0, lastTime: now };
            }
            data.tagHistory[tag].views += 1;
            data.tagHistory[tag].lastTime = now;
        });

        this.save(data);
    },

    // 记录搜索行为
    trackSearch(query) {
        if (!query || query.trim().length === 0) return;

        const data = this.load();
        const now = Date.now();

        // 记录搜索历史
        data.searchHistory = data.searchHistory || [];
        data.searchHistory = data.searchHistory.filter(s => s !== query);
        data.searchHistory.unshift(query);
        if (data.searchHistory.length > 20) {
            data.searchHistory = data.searchHistory.slice(0, 20);
        }

        // 尝试匹配搜索词到已知标签
        const allTags = new Set();
        ROLES_DATA.forEach(role => {
            if (role.tags) {
                role.tags.forEach(tag => allTags.add(tag));
            }
        });

        allTags.forEach(tag => {
            if (tag.toLowerCase().includes(query.toLowerCase()) ||
                query.toLowerCase().includes(tag.toLowerCase())) {
                if (!data.tagHistory[tag]) {
                    data.tagHistory[tag] = { views: 0, searches: 0, filters: 0, lastTime: now };
                }
                data.tagHistory[tag].searches += 1;
                data.tagHistory[tag].lastTime = now;
            }
        });

        this.save(data);
    },

    // 记录筛选器使用
    trackFilter(tag) {
        if (!tag) return;

        const data = this.load();
        const now = Date.now();

        if (!data.tagHistory[tag]) {
            data.tagHistory[tag] = { views: 0, searches: 0, filters: 0, lastTime: now };
        }
        data.tagHistory[tag].filters += 1;
        data.tagHistory[tag].lastTime = now;

        this.save(data);
    },

    // 计算标签推荐得分
    calculateScore(tagData, now) {
        const dayInMs = 24 * 60 * 60 * 1000;
        const timeDiff = now - tagData.lastTime;
        const daysDiff = timeDiff / dayInMs;

        // 时间衰减：30天内线性衰减，30天后固定0.3
        let timeDecay;
        if (daysDiff < 30) {
            timeDecay = 1 - (daysDiff / 30) * 0.7; // 从1衰减到0.3
        } else {
            timeDecay = 0.3;
        }

        // 权重配置：筛选 > 搜索 > 浏览
        const viewWeight = 1;
        const searchWeight = 2;
        const filterWeight = 3;

        const rawScore =
            tagData.views * viewWeight +
            tagData.searches * searchWeight +
            tagData.filters * filterWeight;

        return rawScore * timeDecay;
    },

    // 获取推荐标签（Top N）
    getRecommendedTags(limit = 8) {
        const data = this.load();
        const now = Date.now();

        // 计算所有标签的得分
        const tagScores = [];
        for (const [tag, tagData] of Object.entries(data.tagHistory)) {
            const score = this.calculateScore(tagData, now);
            if (score > 0) {
                tagScores.push({ tag, score, data: tagData });
            }
        }

        // 按得分降序排序
        tagScores.sort((a, b) => b.score - a.score);

        // 返回Top N标签，并映射到分组
        return tagScores.slice(0, limit).map(item => ({
            name: item.tag,
            group: ROLE_TAG_FILTER_MAP[item.tag] || 'features',
            score: item.score
        }));
    },

    // 获取热门标签（新用户冷启动）
    getPopularTags(limit = 8) {
        const tagCounts = {};

        ROLES_DATA.forEach(role => {
            if (role.tags) {
                role.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);

        return sortedTags.map(([tag]) => ({
            name: tag,
            group: ROLE_TAG_FILTER_MAP[tag] || 'features'
        }));
    },

    // 清除用户行为数据
    clear() {
        localStorage.removeItem(this.getStorageKey());
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
    initRecentViewed(); // 初始化最近浏览
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
        // 排除以 _ 开头的临时属性（如 _generatingSwipeFor），避免持久化临时标记
        localStorage.setItem(getStateKey(), JSON.stringify({
            chatSessions: AppState.chatSessions,
            collections: [...AppState.collections],
            settings: AppState.settings
            // 不保存 _generatingSwipeFor 等临时标记
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
const MAX_SEARCH_HISTORY = 10;

function getSearchHistoryKey() {
    const user = getCurrentUser();
    return user ? `ai_search_history_${user}` : 'ai_search_history';
}

function saveSearchHistory(query) {
    if (!query || !query.trim() || query.length < 2) return;

    try {
        const history = JSON.parse(localStorage.getItem(getSearchHistoryKey()) || '[]');

        // 去重
        const existingIndex = history.indexOf(query);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        // 添加到开头
        history.unshift(query);

        // 限制数量
        if (history.length > MAX_SEARCH_HISTORY) {
            history.splice(MAX_SEARCH_HISTORY);
        }

        localStorage.setItem(getSearchHistoryKey(), JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save search history:', e);
    }
}

function loadSearchHistory() {
    try {
        return JSON.parse(localStorage.getItem(getSearchHistoryKey()) || '[]');
    } catch (e) {
        return [];
    }
}

function clearSearchHistory() {
    try {
        localStorage.removeItem(getSearchHistoryKey());
    } catch (e) {
        console.warn('Failed to clear search history:', e);
    }
}

function initSearch() {
    const searchBtn = $('#searchBtn');
    const searchBar = $('#searchBar');
    const searchInput = $('#searchInput');
    const searchClearBtn = $('#searchClearBtn');
    const searchCancelBtn = $('#searchCancelBtn');

    searchBtn.addEventListener('click', () => {
        searchBar.classList.remove('hidden');
        searchInput.focus();
        renderSearchHistory();
    });

    searchCancelBtn.addEventListener('click', () => {
        searchBar.classList.add('hidden');
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        AppState.searchQuery = '';
        hideSearchHistory();
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

        if (query) {
            hideSearchHistory();
            // 记录搜索行为（用于智能推荐）
            UserBehavior.trackSearch(query);
        } else {
            renderSearchHistory();
        }

        renderRoleGrid();
    });

    // 搜索框获得焦点时显示历史
    searchInput.addEventListener('focus', () => {
        if (!searchInput.value.trim()) {
            renderSearchHistory();
        }
    });

    // 搜索框失去焦点时延迟隐藏历史（避免点击历史项时过早隐藏）
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            hideSearchHistory();
        }, 200);
    });
}

function renderSearchHistory() {
    const history = loadSearchHistory();
    if (history.length === 0) {
        hideSearchHistory();
        return;
    }

    let container = $('#searchHistoryContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'searchHistoryContainer';
        container.className = 'search-history-container';
        $('#searchBar').appendChild(container);
    }

    container.innerHTML = `
        <div class="search-history-header">
            <span>搜索历史</span>
            <button class="search-history-clear" id="searchHistoryClear">清空</button>
        </div>
        <div class="search-history-list">
            ${history.map(item => `
                <div class="search-history-item" data-query="${item}">
                    <span class="search-history-icon">🔍</span>
                    <span class="search-history-text">${item}</span>
                </div>
            `).join('')}
        </div>
    `;

    container.classList.remove('hidden');

    // 绑定历史项点击
    container.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
            const query = item.dataset.query;
            const searchInput = $('#searchInput');
            searchInput.value = query;
            AppState.searchQuery = query;
            $('#searchClearBtn').classList.remove('hidden');
            hideSearchHistory();
            renderRoleGrid();
            // 保存到历史（提升到最前）
            saveSearchHistory(query);
        });
    });

    // 绑定清空按钮
    const clearBtn = $('#searchHistoryClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('确定清空搜索历史？')) {
                clearSearchHistory();
                hideSearchHistory();
            }
        });
    }
}

function hideSearchHistory() {
    const container = $('#searchHistoryContainer');
    if (container) {
        container.classList.add('hidden');
    }
}

// 在搜索执行时保存历史
function performSearch(query) {
    if (query && query.trim()) {
        saveSearchHistory(query.trim());
    }
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

    // 初始化快捷筛选
    renderQuickFilters();
}

function renderQuickFilters() {
    const container = $('#quickFilters');
    if (!container) return;

    // 使用智能推荐算法获取标签
    let quickTags = UserBehavior.getRecommendedTags(8);

    // 如果用户行为数据不足（新用户或得分太低），使用热门标签
    if (quickTags.length < 4) {
        quickTags = UserBehavior.getPopularTags(8);
    }

    // 渲染标签
    container.innerHTML = quickTags.map(tag => {
        const isActive = AppState.filters[tag.group] && AppState.filters[tag.group].has(tag.name);
        return `<button class="quick-filter-chip ${isActive ? 'active' : ''}" data-group="${tag.group}" data-value="${tag.name}">${tag.name}</button>`;
    }).join('');

    // 绑定点击事件
    container.querySelectorAll('.quick-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const group = chip.dataset.group;
            const value = chip.dataset.value;

            if (!AppState.filters[group]) {
                AppState.filters[group] = new Set();
            }

            if (chip.classList.contains('active')) {
                // 取消选中
                chip.classList.remove('active');
                AppState.filters[group].delete(value);
                if (AppState.filters[group].size === 0) {
                    delete AppState.filters[group];
                }
            } else {
                // 选中
                chip.classList.add('active');
                AppState.filters[group].add(value);

                // 记录筛选行为
                UserBehavior.trackFilter(value);
            }

            renderRoleGrid();
        });
    });

    // PC端鼠标拖拽滑动支持
    initChipsDrag(container);
}

// PC端鼠标拖拽滑动（复制快捷回复的实现）
function initChipsDrag(container) {
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    container.style.cursor = 'grab';

    container.addEventListener('mousedown', (e) => {
        // 如果点击的是按钮，不启动拖拽
        if (e.target.classList.contains('quick-filter-chip')) {
            return;
        }
        isDragging = true;
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
        container.scrollLeft = scrollLeft - walk;
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
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
                // 记录筛选行为（用于智能推荐）
                UserBehavior.trackFilter(value);
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
        // 刷新智能chips（用户行为可能已更新）
        renderQuickFilters();
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
const MAX_RECENT_VIEWED = 10;

function getRecentViewedKey() {
    const user = getCurrentUser();
    return user ? `ai_recent_viewed_${user}` : 'ai_recent_viewed';
}

function addToRecentViewed(roleId) {
    try {
        const history = JSON.parse(localStorage.getItem(getRecentViewedKey()) || '[]');

        // 去重
        const existingIndex = history.indexOf(roleId);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        // 添加到开头
        history.unshift(roleId);

        // 限制数量
        if (history.length > MAX_RECENT_VIEWED) {
            history.splice(MAX_RECENT_VIEWED);
        }

        localStorage.setItem(getRecentViewedKey(), JSON.stringify(history));

        // 刷新最近浏览显示
        renderRecentViewed();
    } catch (e) {
        console.warn('Failed to add to recent viewed:', e);
    }
}

function loadRecentViewed() {
    try {
        const history = JSON.parse(localStorage.getItem(getRecentViewedKey()) || '[]');
        // 过滤掉不存在的角色
        return history.filter(id => ROLES_DATA.find(r => String(r.id) === String(id)));
    } catch (e) {
        return [];
    }
}

function clearRecentViewed() {
    try {
        localStorage.removeItem(getRecentViewedKey());
        renderRecentViewed();
    } catch (e) {
        console.warn('Failed to clear recent viewed:', e);
    }
}

function renderRecentViewed() {
    const history = loadRecentViewed();
    const section = $('#recentViewedSection');
    const list = $('#recentViewedList');

    if (!section || !list) return;

    if (history.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    list.innerHTML = history.map(roleId => {
        const role = ROLES_DATA.find(r => String(r.id) === String(roleId));
        if (!role) return '';

        const coverHtml = role.image
            ? `<img src="${role.image}" alt="${role.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="recent-viewed-placeholder" style="background:${role.gradient};display:none"><span>${role.emoji}</span></div>`
            : `<div class="recent-viewed-placeholder" style="background:${role.gradient}"><span>${role.emoji}</span></div>`;

        return `
            <div class="recent-viewed-item" data-role-id="${roleId}">
                <div class="recent-viewed-cover">${coverHtml}</div>
                <div class="recent-viewed-name">${role.name}</div>
            </div>
        `;
    }).join('');

    // 绑定点击事件
    list.querySelectorAll('.recent-viewed-item').forEach(item => {
        item.addEventListener('click', () => {
            const roleId = item.dataset.roleId;
            openRoleDetail(roleId);
        });
    });
}

function initRecentViewed() {
    const clearBtn = $('#recentViewedClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('确定清空最近浏览记录？')) {
                clearRecentViewed();
            }
        });
    }

    renderRecentViewed();
}

function initRoleDetailModal() {
    const modal = $('#roleDetailModal');
    const closeBtn = $('#closeRoleDetail');
    const overlay = modal.querySelector('.role-detail-overlay');
    const startChatBtn = $('#startChatBtn');
    const continueChatBtn = $('#continueChatBtn');
    const collectBtn = $('#collectBtn');
    initWorldBookToggle();

    [closeBtn, overlay].forEach(el => {
        el.addEventListener('click', () => {
            modal.classList.add('hidden');
            // 刷新智能chips（浏览行为已更新）
            renderQuickFilters();
        });
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

    // 添加到最近浏览
    addToRecentViewed(roleId);

    // 记录用户浏览行为（用于智能推荐）
    UserBehavior.trackRoleView(roleId);

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
function initCollapsible() {
    const modal = document.getElementById('roleDetailModal');
    if (!modal) return;

    // 用 requestAnimationFrame 确保 DOM 渲染完成后再测量高度
    requestAnimationFrame(() => {
        modal.querySelectorAll('.collapsible').forEach(el => {
            // 移除之前可能添加的 toggle 按钮和遮罩
            const oldToggle = el.nextElementSibling;
            if (oldToggle && oldToggle.classList.contains('collapse-toggle')) {
                oldToggle.remove();
            }
            el.querySelectorAll('.collapse-gradient').forEach(c => c.remove());

            // 先临时展开测量
            el.classList.remove('collapsed');
            const scrollH = el.scrollHeight;
            // rules 折叠阈值：13em ≈ 208px（8行）
            const limit = 208;

            if (scrollH <= limit + 20) {
                // 内容不超长，不需要折叠
                el.classList.remove('collapsible');
                return;
            }

            // 内容超长，启用折叠
            el.classList.add('collapsed');

            // 添加渐变遮罩
            const gradient = document.createElement('div');
            gradient.className = 'collapse-gradient';
            el.appendChild(gradient);

            // 添加展开/收起按钮
            const toggle = document.createElement('button');
            toggle.className = 'collapse-toggle';
            toggle.textContent = '展开 ▾';
            toggle.type = 'button';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = el.classList.contains('collapsed');
                if (isCollapsed) {
                    el.classList.remove('collapsed');
                    toggle.textContent = '收起 ▴';
                    gradient.style.display = 'none';
                } else {
                    el.classList.add('collapsed');
                    toggle.textContent = '展开 ▾';
                    gradient.style.display = '';
                }
            });
            el.parentNode.insertBefore(toggle, el.nextSibling);
        });
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
            } else if (action === 'view-behavior') {
                openBehaviorModal();
            } else if (action === 'quick-replies') {
                openQuickRepliesModal();
            } else if (action === 'data-manager') {
                openDataManager();
            }
        });
    });

    loadUserInfo();
    renderCollections();
    renderCustomRoles();
    updateChatBadge();
    initImportCardEvents();
}

// 打开用户偏好分析弹窗
function openBehaviorModal() {
    const modal = $('#behaviorModal');
    const content = $('#behaviorContent');

    const data = UserBehavior.load();
    const recommendedTags = UserBehavior.getRecommendedTags(20);
    const now = Date.now();

    let html = '<div style="margin-bottom:20px">';
    html += `<h3 style="margin-bottom:10px">🎯 为你推荐的标签</h3>`;

    if (recommendedTags.length === 0) {
        html += `<p style="color:var(--text-secondary)">暂无数据，多浏览、搜索和筛选角色卡后会自动生成个性化推荐</p>`;
    } else {
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">';
        recommendedTags.forEach(tag => {
            const tagData = data.tagHistory[tag.name];
            const score = UserBehavior.calculateScore(tagData, now);
            html += `<div style="padding:6px 12px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px;font-size:12px">
                ${tag.name} <span style="color:var(--text-muted)">(${score.toFixed(1)})</span>
            </div>`;
        });
        html += '</div>';
    }
    html += '</div>';

    // 统计数据
    const totalViews = Object.values(data.tagHistory).reduce((sum, t) => sum + t.views, 0);
    const totalSearches = Object.values(data.tagHistory).reduce((sum, t) => sum + t.searches, 0);
    const totalFilters = Object.values(data.tagHistory).reduce((sum, t) => sum + t.filters, 0);

    html += '<div style="margin-bottom:20px">';
    html += `<h3 style="margin-bottom:10px">📈 行为统计</h3>`;
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">`;
    html += `<div style="background:var(--bg-card);padding:15px;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:600;color:var(--accent-purple)">${data.recentRoles.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">浏览角色数</div>
    </div>`;
    html += `<div style="background:var(--bg-card);padding:15px;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:600;color:var(--accent-purple)">${data.searchHistory.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">搜索次数</div>
    </div>`;
    html += `<div style="background:var(--bg-card);padding:15px;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:600;color:var(--accent-purple)">${totalFilters}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">筛选次数</div>
    </div>`;
    html += `</div></div>`;

    // Top标签详情
    html += '<div>';
    html += `<h3 style="margin-bottom:10px">🏆 偏好标签详情</h3>`;
    if (Object.keys(data.tagHistory).length === 0) {
        html += `<p style="color:var(--text-secondary)">暂无标签数据</p>`;
    } else {
        html += '<div style="max-height:200px;overflow-y:auto">';
        const sortedTags = Object.entries(data.tagHistory)
            .sort((a, b) => {
                const scoreA = UserBehavior.calculateScore(a[1], now);
                const scoreB = UserBehavior.calculateScore(b[1], now);
                return scoreB - scoreA;
            })
            .slice(0, 15);

        sortedTags.forEach(([tag, tagData]) => {
            const daysDiff = Math.floor((now - tagData.lastTime) / (24 * 60 * 60 * 1000));
            html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color)">
                <span style="font-weight:500">${tag}</span>
                <span style="color:var(--text-muted);font-size:12px">
                    浏览${tagData.views} · 搜索${tagData.searches} · 筛选${tagData.filters} · ${daysDiff}天前
                </span>
            </div>`;
        });
        html += '</div>';
    }
    html += '</div>';

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

// ==================== Quick Replies Management ====================

// 当前正在编辑的常用语索引和来源
let currentEditingIndex = -1;
let currentEditingSource = ''; // 'app' 或 'chat'

// 获取常用语存储key（与chat.js中的key保持一致）
function getQuickRepliesKey() {
    const user = getCurrentUser();
    return user ? `ai_chat_common_phrases_${user}` : 'ai_chat_common_phrases';
}

// 加载常用语
function loadQuickRepliesData() {
    try {
        const data = localStorage.getItem(getQuickRepliesKey());
        return data ? JSON.parse(data) : [];  // 默认返回空数组
    } catch (e) {
        console.error('加载常用语失败:', e);
        return [];
    }
}

// 保存常用语
function saveQuickRepliesData(replies) {
    try {
        localStorage.setItem(getQuickRepliesKey(), JSON.stringify(replies));
        return true;
    } catch (e) {
        console.error('保存常用语失败:', e);
        showToast('保存失败，可能超出存储限制');
        return false;
    }
}

// 打开编辑对话框
function openEditPhraseModal(index, source, currentText) {
    currentEditingIndex = index;
    currentEditingSource = source;

    const modal = $('#editPhraseModal');
    const input = $('#editPhraseInput');
    input.value = currentText;
    modal.classList.remove('hidden');

    // 聚焦并选中文本
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
}

// 关闭编辑对话框
function closeEditPhraseModal() {
    const modal = $('#editPhraseModal');
    modal.classList.add('hidden');
    currentEditingIndex = -1;
    currentEditingSource = '';
}

// 保存编辑后的常用语
function saveEditedPhrase() {
    const input = $('#editPhraseInput');
    const newText = input.value.trim();

    if (!newText) {
        showToast('请输入常用语内容');
        return;
    }

    const replies = loadQuickRepliesData();

    // 检查是否与其他常用语重复
    if (replies.some((r, i) => i !== currentEditingIndex && r === newText)) {
        showToast('该常用语已存在');
        return;
    }

    replies[currentEditingIndex] = newText;

    if (saveQuickRepliesData(replies)) {
        closeEditPhraseModal();

        // 刷新对应的列表
        if (currentEditingSource === 'app') {
            renderQuickRepliesList();
        } else if (currentEditingSource === 'chat' && typeof renderCommonPhrasesList === 'function') {
            renderCommonPhrasesList();
        }

        showToast('修改成功');
    }
}

// 打开常用语管理弹窗
function openQuickRepliesModal() {
    const modal = $('#quickRepliesModal');
    renderQuickRepliesList();
    modal.classList.remove('hidden');
}

// 渲染常用语列表
function renderQuickRepliesList() {
    const content = $('#quickRepliesContent');
    const empty = $('#quickRepliesEmpty');
    const replies = loadQuickRepliesData();

    if (replies.length === 0) {
        content.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    let html = '';
    replies.forEach((reply, index) => {
        html += `
            <div class="common-phrase-item">
                <div class="common-phrase-text">${escapeHtml(reply)}</div>
                <div class="common-phrase-actions">
                    <button class="common-phrase-btn edit" onclick="editQuickReply(${index})" title="编辑">编辑</button>
                    <button class="common-phrase-btn delete" onclick="deleteQuickReply(${index})" title="删除">✕</button>
                </div>
            </div>
        `;
    });

    content.innerHTML = html;
}

// HTML转义（防止XSS）
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加新常用语
function addNewQuickReply() {
    const input = $('#newQuickReplyInput');
    const text = input.value.trim();

    if (!text) {
        showToast('请输入常用语内容');
        return;
    }

    const replies = loadQuickRepliesData();

    // 检查重复
    if (replies.includes(text)) {
        showToast('该常用语已存在');
        return;
    }

    replies.push(text);

    if (saveQuickRepliesData(replies)) {
        input.value = '';
        renderQuickRepliesList();
        showToast('添加成功');
    }
}

// 编辑常用语
function editQuickReply(index) {
    const replies = loadQuickRepliesData();
    const oldText = replies[index];
    openEditPhraseModal(index, 'app', oldText);
}

// 删除常用语
function deleteQuickReply(index) {
    const replies = loadQuickRepliesData();

    if (confirm('确定删除这条常用语吗？')) {
        replies.splice(index, 1);
        if (saveQuickRepliesData(replies)) {
            renderQuickRepliesList();
            showToast('删除成功');
        }
    }
}

// 导出常用语
function exportQuickReplies() {
    const replies = loadQuickRepliesData();
    const data = {
        version: 1,
        exportTime: new Date().toISOString(),
        user: getCurrentUser() || 'default',
        replies: replies
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `常用语备份_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('导出成功');
}

// 导入常用语
function importQuickReplies(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // 验证数据格式
            if (!data.replies || !Array.isArray(data.replies)) {
                throw new Error('无效的备份文件格式');
            }

            // 询问是否覆盖
            const currentReplies = loadQuickRepliesData();
            let mergeMode = 'replace';

            if (currentReplies.length > 0) {
                const choice = confirm('当前已有常用语，点击"确定"覆盖，点击"取消"合并（追加到现有列表）');
                mergeMode = choice ? 'replace' : 'merge';
            }

            let finalReplies;
            if (mergeMode === 'replace') {
                finalReplies = data.replies;
            } else {
                // 合并并去重
                finalReplies = [...new Set([...currentReplies, ...data.replies])];
            }

            if (saveQuickRepliesData(finalReplies)) {
                renderQuickRepliesList();
                showToast(`导入成功，共${data.replies.length}条常用语`);
            }

        } catch (e) {
            console.error('导入失败:', e);
            showToast('导入失败：' + e.message);
        }

        // 清空文件选择
        event.target.value = '';
    };

    reader.readAsText(file);
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

let _uploadedAvatarData = null; // 存储上传的头像数据

function initCreateRoleModal() {
    const modal = $('#createRoleModal');
    const closeBtn = $('#closeCreateRole');
    const backBtn = $('#createRoleBackBtn');
    const overlay = modal.querySelector('.role-detail-overlay');
    const saveBtn = $('#saveCreateRole');
    const avatarInput = $('#crAvatarInput');
    const avatarUploadBtn = $('#crAvatarUploadBtn');
    const avatarPreview = $('#crAvatarPreview');
    const avatarImg = $('#crAvatarImg');
    const avatarPlaceholder = $('#crAvatarPlaceholder');
    const advancedToggle = $('#crAdvancedToggle');
    const advancedContent = $('#crAdvancedContent');
    const toggleIcon = advancedToggle.querySelector('.cr-toggle-icon');

    [closeBtn, backBtn, overlay].forEach(el => {
        el.addEventListener('click', () => {
            modal.classList.add('hidden');
            _editingRoleId = null;
            _uploadedAvatarData = null;
            resetCreateRoleForm();
        });
    });

    // 高级定义折叠展开
    advancedToggle.addEventListener('click', () => {
        const isExpanded = advancedContent.style.display !== 'none';
        if (isExpanded) {
            advancedContent.style.display = 'none';
            toggleIcon.style.transform = 'rotate(0deg)';
        } else {
            advancedContent.style.display = 'block';
            toggleIcon.style.transform = 'rotate(180deg)';
        }
    });

    // 头像上传功能
    avatarUploadBtn.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarPreview.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            _uploadedAvatarData = imageData;
            avatarImg.src = imageData;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    });

    // 标签按钮点击切换
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('cr-tag-btn')) {
            e.target.classList.toggle('selected');
        }
    });

    saveBtn.addEventListener('click', () => {
        const name = $('#crName').value.trim();
        const desc = $('#crDesc').value.trim();
        const opener = $('#crOpener').value.trim();
        const personality = $('#crPersonality').value.trim();
        const scenario = $('#crScenario').value.trim();
        const example = $('#crExample').value.trim();

        if (!name) { showToast('请输入角色名字'); return; }
        if (!desc) { showToast('请输入角色设定'); return; }
        if (!opener) { showToast('请输入开场白'); return; }

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

        // 构建系统提示词（整合各个字段）
        let systemPrompt = desc;
        if (personality) {
            systemPrompt += `\n\n【性格特点】\n${personality}`;
        }
        if (scenario) {
            systemPrompt += `\n\n【情景设定】\n${scenario}`;
        }
        if (example) {
            systemPrompt += `\n\n【对话示例】\n${example}`;
        }

        const customRoles = JSON.parse(localStorage.getItem(getCustomRolesKey()) || '[]');

        if (_editingRoleId) {
            // 编辑模式：更新已有角色
            const roleIdx = customRoles.findIndex(r => r.id === _editingRoleId);
            const roIdx = ROLES_DATA.findIndex(r => r.id === _editingRoleId);
            if (roleIdx >= 0) {
                customRoles[roleIdx].name = name;
                customRoles[roleIdx].title = opener.substring(0, 60) + (opener.length > 60 ? '……' : '');
                customRoles[roleIdx].desc = desc;
                customRoles[roleIdx].tags = tags;
                customRoles[roleIdx].systemPrompt = systemPrompt;
                customRoles[roleIdx].personality = personality;
                customRoles[roleIdx].scenario = scenario;
                customRoles[roleIdx].example = example;
                customRoles[roleIdx].scenes = opener ? [{ preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''), opener: opener }] : [];
                if (_uploadedAvatarData) {
                    customRoles[roleIdx].image = _uploadedAvatarData;
                }
            }
            if (roIdx >= 0) {
                ROLES_DATA[roIdx].name = name;
                ROLES_DATA[roIdx].title = opener.substring(0, 60) + (opener.length > 60 ? '……' : '');
                ROLES_DATA[roIdx].desc = desc;
                ROLES_DATA[roIdx].tags = tags;
                ROLES_DATA[roIdx].systemPrompt = systemPrompt;
                ROLES_DATA[roIdx].personality = personality;
                ROLES_DATA[roIdx].scenario = scenario;
                ROLES_DATA[roIdx].example = example;
                ROLES_DATA[roIdx].scenes = opener ? [{ preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''), opener: opener }] : [];
                if (_uploadedAvatarData) {
                    ROLES_DATA[roIdx].image = _uploadedAvatarData;
                }
            }
            localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
            _editingRoleId = null;
        } else {
            // 创建模式：新建角色
            const customRole = {
                id: Date.now(),
                name: name,
                title: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''),
                desc: desc,
                rarity: 'R',
                isNew: true,
                tags: tags,
                emoji: '🎭',
                gradient: gradients[Math.floor(Math.random() * gradients.length)],
                systemPrompt: systemPrompt,
                personality: personality,
                scenario: scenario,
                example: example,
                scenes: opener ? [{ preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : ''), opener: opener }] : [],
                isCustom: true
            };

            // 如果上传了头像，添加到角色数据
            if (_uploadedAvatarData) {
                customRole.image = _uploadedAvatarData;
            }

            customRoles.push(customRole);
            localStorage.setItem(getCustomRolesKey(), JSON.stringify(customRoles));
            ROLES_DATA.push(customRole);
        }

        // 刷新首页和我的面板
        renderRoleGrid();
        renderCustomRoles();

        // 关闭弹窗并清空表单
        modal.classList.add('hidden');
        resetCreateRoleForm();
        _uploadedAvatarData = null;
        showToast(_editingRoleId ? '角色修改成功！' : '角色创建成功！');
    });
}

function resetCreateRoleForm() {
    $('#crName').value = '';
    $('#crDesc').value = '';
    $('#crOpener').value = '';
    $('#crPersonality').value = '';
    $('#crScenario').value = '';
    $('#crExample').value = '';
    $$('#crTagsSelect .cr-tag-btn').forEach(btn => btn.classList.remove('selected'));

    // 重置头像
    const avatarImg = $('#crAvatarImg');
    const avatarPlaceholder = $('#crAvatarPlaceholder');
    avatarImg.style.display = 'none';
    avatarImg.src = '';
    avatarPlaceholder.style.display = 'flex';
    _uploadedAvatarData = null;

    // 收起高级定义
    const advancedContent = $('#crAdvancedContent');
    const toggleIcon = $('#crAdvancedToggle').querySelector('.cr-toggle-icon');
    advancedContent.style.display = 'none';
    toggleIcon.style.transform = 'rotate(0deg)';
}

function openCreateRoleModal(editRole) {
    const modal = $('#createRoleModal');
    modal.classList.remove('hidden');
    resetCreateRoleForm();

    if (editRole) {
        // 编辑模式：填充已有数据
        _editingRoleId = editRole.id;
        modal.querySelector('h2').textContent = '修改角色';
        $('#saveCreateRole').textContent = '保存修改';
        $('#crName').value = editRole.name || '';
        $('#crDesc').value = editRole.desc || '';
        $('#crOpener').value = (editRole.scenes && editRole.scenes[0]) ? editRole.scenes[0].opener : '';
        $('#crPersonality').value = editRole.personality || '';
        $('#crScenario').value = editRole.scenario || '';
        $('#crExample').value = editRole.example || '';

        // 加载头像（编辑时保留原有头像）
        if (editRole.image) {
            _uploadedAvatarData = editRole.image;
            const avatarImg = $('#crAvatarImg');
            const avatarPlaceholder = $('#crAvatarPlaceholder');
            avatarImg.src = editRole.image;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            _uploadedAvatarData = null;
        }

        // 选中已有标签
        if (editRole.tags) {
            editRole.tags.forEach(tag => {
                const btn = modal.querySelector(`.cr-tag-btn[data-tag="${tag}"]`);
                if (btn) btn.classList.add('selected');
            });
        }
    } else {
        _editingRoleId = null;
        _uploadedAvatarData = null;
        modal.querySelector('h2').textContent = '新建角色';
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

    // 加载世界书覆盖数据
    const worldbookKey = getCurrentUser() ? `ai_worldbook_overrides_${getCurrentUser()}` : 'ai_worldbook_overrides';
    try {
        const worldbookOverrides = JSON.parse(localStorage.getItem(worldbookKey) || '{}');
        ROLES_DATA.forEach(role => {
            if (worldbookOverrides[role.id]) {
                if (!role.sourceData) role.sourceData = {};
                role.sourceData.characterBook = worldbookOverrides[role.id];
            }
        });
    } catch (e) {
        console.warn('Failed to load worldbook overrides:', e);
    }

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



// ==================== Data Manager ====================

// 打开数据管理
function openDataManager() {
    const modal = $('#dataManagerModal');
    modal.classList.remove('hidden');
    calculateStorageUsage();
}

// 关闭数据管理
function closeDataManager() {
    const modal = $('#dataManagerModal');
    modal.classList.add('hidden');
}

// 计算存储空间使用情况
function calculateStorageUsage() {
    const user = getCurrentUser();
    const dataTypes = [
        { key: `ai_chat_state_${user}`, name: '聊天记录', icon: '💬' },
        { key: `ai_custom_roles_${user}`, name: '自定义角色', icon: '✨' },
        { key: `ai_chat_common_phrases_${user}`, name: '常用语', icon: '📝' },
        { key: `user_behavior_${user}`, name: '行为数据', icon: '📊' },
        { key: `ai_search_history_${user}`, name: '搜索历史', icon: '🔍' },
        { key: `ai_recent_viewed_${user}`, name: '浏览记录', icon: '👁️' },
        { key: `ai_chat_drafts_${user}`, name: '输入草稿', icon: '📄' },
        { key: `ai_chat_input_history_${user}`, name: '输入历史', icon: '⌨️' },
    ];

    let totalSize = 0;
    const details = [];

    dataTypes.forEach(type => {
        const value = localStorage.getItem(type.key);
        const size = value ? new Blob([value]).size : 0;
        totalSize += size;
        if (size > 0) {
            details.push({
                name: type.name,
                icon: type.icon,
                size: size
            });
        }
    });

    // 探测实际可用的localStorage容量
    const maxSize = detectLocalStorageLimit();
    const percent = Math.min((totalSize / maxSize * 100), 100).toFixed(1);

    // 更新进度条
    $('#storageUsedBar').style.width = percent + '%';
    $('#storageUsedText').textContent = `已使用 ${formatBytes(totalSize)} / ${formatBytes(maxSize)}`;
    $('#storagePercent').textContent = percent + '%';

    // 显示实际探测到的容量提示
    if (maxSize >= 10 * 1024 * 1024) {
        $('#storagePercent').title = '当前浏览器支持约10MB存储';
    } else {
        $('#storagePercent').title = '当前浏览器支持约5MB存储';
    }

    // 更新详细列表
    const detailsContainer = $('#storageDetails');
    if (details.length === 0) {
        detailsContainer.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:12px">暂无数据</div>';
    } else {
        detailsContainer.innerHTML = details
            .sort((a, b) => b.size - a.size)
            .map(d => `
                <div class="storage-item">
                    <span class="storage-item-name">${d.icon} ${d.name}</span>
                    <span class="storage-item-size">${formatBytes(d.size)}</span>
                </div>
            `).join('');
    }
}

// 格式化字节大小
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i];
}

// 探测localStorage实际可用容量
let _cachedStorageLimit = null;
function detectLocalStorageLimit() {
    // 使用缓存结果，避免重复探测
    if (_cachedStorageLimit !== null) {
        return _cachedStorageLimit;
    }

    try {
        // 快速探测：尝试写入1MB数据
        const testKey = '__storage_test__';
        const oneMB = 1024 * 1024;
        const testData = 'x'.repeat(oneMB);

        // 尝试写入10次（10MB）
        let maxSize = 5 * oneMB; // 默认5MB
        for (let i = 1; i <= 10; i++) {
            try {
                localStorage.setItem(testKey, testData.repeat(i));
                maxSize = i * oneMB;
            } catch (e) {
                // 写入失败，说明超出限制
                break;
            }
        }

        // 清理测试数据
        localStorage.removeItem(testKey);

        // 缓存结果
        _cachedStorageLimit = maxSize;
        return maxSize;

    } catch (e) {
        // 探测失败，返回保守值5MB
        _cachedStorageLimit = 5 * 1024 * 1024;
        return _cachedStorageLimit;
    }
}

// 导出所有数据
async function exportAllData() {
    try {
        const user = getCurrentUser();
        const exportData = {
            version: 2,
            exportTime: new Date().toISOString(),
            user: user,
            data: {}
        };

        // 收集所有数据
        const keys = [
            `ai_chat_state_${user}`,
            `ai_custom_roles_${user}`,
            `ai_chat_common_phrases_${user}`,
            `user_behavior_${user}`,
            `ai_search_history_${user}`,
            `ai_recent_viewed_${user}`,
            `ai_chat_drafts_${user}`,
            `ai_chat_input_history_${user}`,
            `ai_chat_username_${user}`,
            `ai_chat_userid_${user}`
        ];

        keys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                exportData.data[key] = value;
            }
        });

        // IndexedDB 图片数据
        if (typeof ImageStore !== 'undefined') {
            try {
                const images = await ImageStore.getAll();
                if (images && images.length > 0) {
                    exportData.images = images;
                }
            } catch (e) {
                console.warn('导出图片数据失败:', e);
            }
        }

        // 下载文件
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai_chat_backup_${user}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert('✅ 备份导出成功！\n\n文件包含：\n• 所有聊天记录\n• 自定义角色\n• 常用语\n• 行为数据\n• 其他设置');
    } catch (e) {
        console.error('导出失败:', e);
        alert('❌ 导出失败：' + e.message);
    }
}

// 导入所有数据
function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            // 验证格式
            if (!importData.version || !importData.data) {
                throw new Error('备份文件格式不正确');
            }

            // 确认导入
            const confirmMsg = `确定要导入备份数据吗？\n\n备份信息：\n• 用户：${importData.user || '未知'}\n• 时间：${importData.exportTime ? new Date(importData.exportTime).toLocaleString() : '未知'}\n\n⚠️ 导入会覆盖当前数据！`;

            if (!confirm(confirmMsg)) return;

            // 导入 localStorage 数据
            Object.keys(importData.data).forEach(key => {
                localStorage.setItem(key, importData.data[key]);
            });

            // 导入 IndexedDB 图片
            if (importData.images && typeof ImageStore !== 'undefined') {
                try {
                    for (const img of importData.images) {
                        await ImageStore.save(img.id, img.data);
                    }
                } catch (e) {
                    console.warn('导入图片数据失败:', e);
                }
            }

            alert('✅ 数据导入成功！\n\n页面即将刷新以加载新数据...');
            setTimeout(() => location.reload(), 1000);

        } catch (e) {
            console.error('导入失败:', e);
            alert('❌ 导入失败：' + e.message);
        }
    };
    input.click();
}

// 清除搜索历史
function cleanSearchHistory() {
    if (!confirm('确定要清除所有搜索历史吗？')) return;

    try {
        localStorage.removeItem(getSearchHistoryKey());
        alert('✅ 搜索历史已清除');
        calculateStorageUsage();
    } catch (e) {
        alert('❌ 清除失败：' + e.message);
    }
}

// 清除浏览记录
function cleanRecentViewed() {
    if (!confirm('确定要清除所有浏览记录吗？')) return;

    try {
        localStorage.removeItem(getRecentViewedKey());
        alert('✅ 浏览记录已清除');
        calculateStorageUsage();
    } catch (e) {
        alert('❌ 清除失败：' + e.message);
    }
}

// 清除输入草稿
function cleanDrafts() {
    if (!confirm('确定要清除所有输入草稿吗？')) return;

    try {
        localStorage.removeItem(getDraftKey());
        alert('✅ 输入草稿已清除');
        calculateStorageUsage();
    } catch (e) {
        alert('❌ 清除失败：' + e.message);
    }
}

// 清除行为数据
function cleanBehaviorData() {
    if (!confirm('确定要清除所有行为数据吗？\n\n这将重置智能推荐功能。')) return;

    try {
        UserBehavior.clear();
        alert('✅ 行为数据已清除');
        calculateStorageUsage();
        renderQuickFilters(); // 刷新chips
    } catch (e) {
        alert('❌ 清除失败：' + e.message);
    }
}

// 清空所有数据
function clearAllData() {
    const confirmMsg = '⚠️ 警告：此操作将清空所有数据！\n\n包括：\n• 所有聊天记录\n• 自定义角色\n• 常用语\n• 行为数据\n• 所有设置\n\n此操作无法恢复，确定要继续吗？';

    if (!confirm(confirmMsg)) return;

    // 二次确认
    const finalConfirm = prompt('请输入"确认清空"来继续：');
    if (finalConfirm !== '确认清空') {
        alert('❌ 已取消操作');
        return;
    }

    try {
        const user = getCurrentUser();
        const keys = Object.keys(localStorage).filter(k => k.includes(user));
        keys.forEach(k => localStorage.removeItem(k));

        // 清除 IndexedDB
        if (typeof ImageStore !== 'undefined') {
            ImageStore.clear().catch(() => {});
        }

        alert('✅ 所有数据已清空\n\n页面即将刷新...');
        setTimeout(() => location.reload(), 1000);

    } catch (e) {
        alert('❌ 清除失败：' + e.message);
    }
}

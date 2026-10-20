/**
 * builtin-cards.js — 内置角色卡运行时加载（轻量索引 + 每卡按需详情）
 *
 * 数据结构（JS 格式，通过动态 <script> 注入加载）：
 *   cards/cards-index.js — 轻量索引（~100KB）：window.__CARDS_INDEX__
 *   cards/data/*.js      — 单卡完整数据：window.__CARDS_DETAILS__[roleId]
 *
 * 为什么用 JS 而不是 JSON：<script> 标签在 file:// 协议下也能正常加载，
 * 因此双击 index.html 直开、localhost、Cloudflare 部署三种环境全兼容，
 * 无需 fetch（file:// 下被浏览器禁止）。
 *
 * 加载策略：
 *   1. 首屏只注入索引脚本，立即构建轻量角色对象（网格/筛选/搜索/聊天列表全部可用）
 *   2. 打开角色详情 / 进入聊天 / 操作世界书时，通过 ensureDetails(role) 按需注入单卡详情
 *   3. 详情请求去重（并发调用共享同一 Promise），失败时下次调用自动重试
 *
 * 只有自定义角色才存 localStorage。
 */

const BuiltinCards = (function() {

    const STORAGE_KEY = 'ai_builtin_cards_imported';
    const INDEX_FILE = 'cards/cards-index.js';

    // 内存缓存：轻量角色列表
    let _builtinRolesCache = null;
    // 进行中的详情请求：roleId -> Promise（并发去重）
    const _detailsInflight = new Map();

    // ==================== 基础加载 ====================

    /**
     * 动态注入 <script> 加载数据文件（file:// 与 http(s) 全兼容）
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.charset = 'utf-8';
            s.async = true;
            s.onload = () => { s.remove(); resolve(); };
            s.onerror = () => { s.remove(); reject(new Error('脚本加载失败: ' + url)); };
            (document.head || document.documentElement).appendChild(s);
        });
    }

    /**
     * 数据文件加载失败时的可见提示（控制台日志用户看不到，必须页面提示）
     */
    function showLoadErrorHint() {
        if (document.getElementById('builtinLoadErrorHint')) return;
        const box = document.createElement('div');
        box.id = 'builtinLoadErrorHint';
        box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(10,10,26,.9);backdrop-filter:blur(10px);padding:24px;';
        box.innerHTML = `
            <div style="max-width:420px;width:100%;background:rgba(30,30,60,.95);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px 24px;color:#e8e8f0;font-size:14px;line-height:1.8;box-shadow:0 20px 60px rgba(0,0,0,.5);">
                <div style="font-size:17px;font-weight:700;margin-bottom:12px;">⚠️ 无法加载内置角色卡数据</div>
                <div style="color:#a8a8c0;">请确认以下文件完整存在：</div>
                <div style="margin-top:8px;padding:12px;background:rgba(0,0,0,.35);border-radius:10px;font-family:monospace;font-size:13px;color:#9be89b;">
                    cards/cards-index.js<br>
                    cards/data/*.js（186 个详情文件）
                </div>
                <div style="margin-top:12px;color:#a8a8c0;">如文件缺失，请在项目目录运行 <code style="color:#c0a8ff;">update-cards.bat</code> 重新生成。</div>
                <button id="builtinLoadErrorCloseBtn" style="margin-top:16px;width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#7c5cff,#a855f7);color:#fff;font-size:14px;cursor:pointer;">知道了（仅使用自定义角色）</button>
            </div>`;
        document.body.appendChild(box);
        document.getElementById('builtinLoadErrorCloseBtn').onclick = () => box.remove();
    }

    async function loadIndex() {
        try {
            await loadScript(INDEX_FILE);
            const index = window.__CARDS_INDEX__;
            if (Array.isArray(index) && index.length > 0) {
                console.log(`[BuiltinCards] 索引加载成功：${index.length} 张角色卡`);
                return index;
            }
            console.error('[BuiltinCards] 索引数据为空或格式错误');
        } catch (e) {
            console.error('[BuiltinCards] 索引加载失败:', e.message);
        }
        showLoadErrorHint();
        return [];
    }

    // ==================== 角色构建 ====================

    /**
     * 随机生成渐变色
     */
    function getRandomGradient() {
        const gradients = [
            'linear-gradient(135deg, #1a1a3e, #2d1b4e)',
            'linear-gradient(135deg, #3e1a1a, #4e2d1b)',
            'linear-gradient(135deg, #1a2e3e, #1b3e2d)',
            'linear-gradient(135deg, #2e1a3e, #3e1b2d)',
            'linear-gradient(135deg, #1a3e3e, #2d4e1b)',
        ];
        return gradients[Math.floor(Math.random() * gradients.length)];
    }

    /**
     * 从索引构建轻量角色对象（详情字段留空，由 ensureDetails 按需填充）
     */
    function buildRolesFromIndex(indexList) {
        const roles = [];
        indexList.forEach((entry, i) => {
            try {
                // pov 来自 cards/ 子目录（MalePOV=男性向，FemalePOV=女性向），
                // 是受众视角的权威信号（优先于标签推断）
                const pov = entry.pov || '';
                const tags = entry.tags || [];
                const hasMaleTag = tags.some(t => t === 'Male' || t === 'male' || t === '男性' || t === '男性向');
                const hasFemaleTag = tags.some(t => t === 'Female' || t === 'female' || t === '女性' || t === '女性向');

                // POV 逻辑：MalePOV(male) → 女性角色 → gender='female'
                //          FemalePOV(female) → 男性角色 → gender='male'
                const inferredGender = pov === 'male' ? 'female'
                    : pov === 'female' ? 'male'
                    : hasMaleTag ? 'male'
                    : hasFemaleTag ? 'female'
                    : 'female';  // 无法判断时默认 female

                roles.push({
                    id: entry.id || ('builtin_' + i),
                    name: entry.name,
                    title: entry.name,
                    desc: entry.desc || '',
                    rarity: 'SSR',
                    isNew: true,
                    tags: tags,
                    gender: inferredGender,
                    pov: pov,
                    emoji: '',
                    // filename 可能含子目录（如 MalePOV/xxx.png），逐段编码保留 /
                    image: 'cards/' + String(entry.filename).split('/').map(encodeURIComponent).join('/'),
                    gradient: getRandomGradient(),
                    isBuiltin: true,
                    _sourceFile: entry.filename,
                    _dataFile: entry.data || '',
                    _detailsLoaded: false,
                    // 索引携带的统计标志（供世界书/正则组总览面板在详情未加载时列出条目）
                    _meta: {
                        greetings: entry.greetings || 0,
                        hasBook: !!entry.hasBook,
                        bookCount: entry.bookCount || 0,
                        hasRegex: !!entry.hasRegex,
                        regexCount: entry.regexCount || 0,
                    },
                    // 详情字段（ensureDetails 填充）
                    systemPrompt: '',
                    scenes: [],
                    sourceData: null,
                });
            } catch (err) {
                console.warn(`[BuiltinCards] 构建 ${entry.filename} 失败:`, err.message);
            }
        });
        return roles;
    }

    // ==================== 详情按需加载 ====================

    /**
     * 从 metadata 构建 systemPrompt
     */
    function buildSystemPrompt(meta) {
        let prompt = '';
        if (meta.system_prompt) prompt += meta.system_prompt + '\n\n';
        if (meta.description) prompt += meta.description + '\n\n';
        if (meta.personality) prompt += '【性格】' + meta.personality + '\n\n';
        if (meta.scenario) prompt += '【场景】' + meta.scenario + '\n\n';
        // 世界书常驻条目（constant=true 或 keys 为空）
        if (meta.character_book && meta.character_book.entries) {
            const constantEntries = meta.character_book.entries
                .filter(e => e.enabled !== false && (e.constant === true || (!e.keys || e.keys.length === 0)))
                .sort((a, b) => (a.insertion_order || 100) - (b.insertion_order || 100));
            for (const entry of constantEntries) {
                if (entry.content && entry.content.trim()) {
                    prompt += entry.content + '\n\n';
                }
            }
        }
        return prompt.trim();
    }

    /**
     * 从 metadata 构建开场白数组（first_mes + alternate_greetings）
     */
    function buildScenes(meta) {
        const scenes = [];
        if (meta.first_mes) {
            scenes.push({
                opener: meta.first_mes,
                preview: meta.first_mes.substring(0, 60) + (meta.first_mes.length > 60 ? '……' : '')
            });
        }
        if (meta.alternate_greetings && Array.isArray(meta.alternate_greetings)) {
            for (const greeting of meta.alternate_greetings) {
                if (greeting && greeting.trim()) {
                    scenes.push({
                        opener: greeting,
                        preview: greeting.substring(0, 60) + (greeting.length > 60 ? '……' : '')
                    });
                }
            }
        }
        return scenes;
    }

    /**
     * 应用世界书覆盖数据（用户在角色详情中编辑过的世界书存于 localStorage，
     * 详情水合后需要重新覆盖，与 app.js loadCustomRoles 的逻辑保持一致）
     */
    function applyWorldbookOverride(role) {
        try {
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : '';
            const key = user ? `ai_worldbook_overrides_${user}` : 'ai_worldbook_overrides';
            const overrides = JSON.parse(localStorage.getItem(key) || '{}');
            if (overrides[role.id]) {
                if (!role.sourceData) role.sourceData = {};
                role.sourceData.characterBook = overrides[role.id];
            }
        } catch (e) { /* 忽略覆盖数据读取失败 */ }
    }

    /**
     * 确保角色详情已加载（幂等；并发调用共享同一请求；失败时下次调用重试）
     * 自定义角色（非 isBuiltin）数据本就完整，直接返回。
     * @param {object} role - ROLES_DATA 中的角色对象（原地水合）
     * @returns {Promise<object>} role
     */
    async function ensureDetails(role) {
        if (!role || !role.isBuiltin || role._detailsLoaded || !role._dataFile) {
            return role;
        }
        if (_detailsInflight.has(role.id)) {
            return _detailsInflight.get(role.id);
        }
        const p = (async () => {
            try {
                // 已加载过的详情直接读全局缓存（二次打开无需重新注入脚本）
                let meta = window.__CARDS_DETAILS__ && window.__CARDS_DETAILS__[role.id];
                if (!meta) {
                    await loadScript('cards/' + role._dataFile);
                    meta = window.__CARDS_DETAILS__ && window.__CARDS_DETAILS__[role.id];
                }
                if (!meta) throw new Error('详情数据缺失: ' + role._dataFile);
                role.systemPrompt = buildSystemPrompt(meta);
                role.scenes = buildScenes(meta);
                role.sourceData = {
                    // 深拷贝：会话内的编辑（增删改/导入合并）不得污染 __CARDS_DETAILS__ 缓存，
                    // 「恢复原书」依赖缓存始终为卡片原始数据
                    characterBook: meta.character_book ? JSON.parse(JSON.stringify(meta.character_book)) : null,
                    postHistoryInstructions: meta.post_history_instructions || '',
                    alternateGreetings: meta.alternate_greetings ? JSON.parse(JSON.stringify(meta.alternate_greetings)) : [],
                    regexScripts: meta.regex_scripts ? JSON.parse(JSON.stringify(meta.regex_scripts)) : [],
                };
                applyWorldbookOverride(role);
                // 尊重会话内删除标记（删除仅本次会话有效，与旧行为一致；页面重载后恢复）
                if (role._bookDeleted) role.sourceData.characterBook = null;
                if (role._regexDeleted) role.sourceData.regexScripts = [];
                role._detailsLoaded = true;
            } catch (e) {
                console.warn(`[BuiltinCards] 加载角色详情失败 ${role.name}:`, e.message);
            } finally {
                _detailsInflight.delete(role.id);
            }
            return role;
        })();
        _detailsInflight.set(role.id, p);
        return p;
    }

    // ==================== 导入流程 ====================

    /**
     * 加载内置角色（结果缓存在内存）
     */
    async function loadBuiltinRoles() {
        if (_builtinRolesCache) {
            return _builtinRolesCache;
        }

        const indexList = await loadIndex();
        if (indexList.length === 0) {
            return [];
        }

        const roles = buildRolesFromIndex(indexList);
        _builtinRolesCache = roles;
        return roles;
    }

    /**
     * 自动导入（每次页面加载都执行，内置角色不存 localStorage）
     */
    async function autoImport() {
        const builtinRoles = await loadBuiltinRoles();
        if (builtinRoles.length === 0) return 0;

        // 将内置角色合并到 ROLES_DATA（去重）
        if (typeof ROLES_DATA !== 'undefined') {
            const existingNames = new Set(ROLES_DATA.filter(r => r && r.name).map(r => r.name));
            let added = 0;
            for (const role of builtinRoles) {
                if (!existingNames.has(role.name)) {
                    ROLES_DATA.push(role);
                    existingNames.add(role.name);
                    added++;
                }
            }
            console.log(`[BuiltinCards] ✅ 已加载 ${added} 个内置角色到 ROLES_DATA（详情按需加载）`);
        }

        markImported();
        return builtinRoles.length;
    }

    function isImported() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    function markImported() {
        localStorage.setItem(STORAGE_KEY, 'true');
    }
    function resetImport() {
        localStorage.removeItem(STORAGE_KEY);
        _builtinRolesCache = null;
    }

    // ==================== 世界书库（cards/世界书/ 转换生成） ====================

    const WB_INDEX_FILE = 'cards/worldbooks-index.js';
    let _worldbooksCache = null;
    const _wbInflight = new Map();

    /**
     * 获取世界书库索引，首次调用时注入索引脚本
     * 返回 [{id, name, entries, constant, trigger, data}]
     */
    async function getWorldbooks() {
        if (_worldbooksCache) return _worldbooksCache;
        try {
            await loadScript(WB_INDEX_FILE);
            const idx = window.__WORLDBOOKS_INDEX__;
            _worldbooksCache = Array.isArray(idx) ? idx : [];
        } catch (e) {
            console.warn('[BuiltinCards] 世界书索引加载失败:', e.message);
            _worldbooksCache = [];
        }
        return _worldbooksCache;
    }

    /**
     * 按需加载单本世界书完整数据，返回 {id, name, entries}（失败返回 null）
     */
    async function ensureWorldbookDetails(wb) {
        if (!wb) return null;
        if (wb._details) return wb._details;
        if (_wbInflight.has(wb.id)) return _wbInflight.get(wb.id);
        const p = (async () => {
            try {
                let data = window.__WORLDBOOKS_DETAILS__ && window.__WORLDBOOKS_DETAILS__[wb.id];
                if (!data) {
                    await loadScript('cards/' + wb.data);
                    data = window.__WORLDBOOKS_DETAILS__ && window.__WORLDBOOKS_DETAILS__[wb.id];
                }
                if (!data) throw new Error('世界书数据缺失: ' + wb.data);
                wb._details = data;
                return data;
            } catch (e) {
                console.warn(`[BuiltinCards] 世界书加载失败 ${wb.name}:`, e.message);
                return null;
            } finally {
                _wbInflight.delete(wb.id);
            }
        })();
        _wbInflight.set(wb.id, p);
        return p;
    }

    return {
        isImported,
        markImported,
        resetImport,
        autoImport,
        loadBuiltinRoles,
        ensureDetails,
        getWorldbooks,
        ensureWorldbookDetails,
    };
})();

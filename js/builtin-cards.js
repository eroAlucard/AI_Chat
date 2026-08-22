/**
 * builtin-cards.js — 内置角色卡运行时加载
 * 
 * 内置角色数据从 cards-metadata.json 动态加载，不存入 localStorage（避免 5MB 限制）。
 * 加载策略（按优先级）：
 *   1. 全局变量 CARDS_METADATA（由 js/cards-metadata.js 通过 <script> 标签加载）
 *   2. fetch（HTTP 服务器环境）
 *   3. XMLHttpRequest 回退（兼容部分 file:// 环境）
 * 只有自定义角色才存 localStorage。
 */

const BuiltinCards = (function() {

    const STORAGE_KEY = 'ai_builtin_cards_imported';

    // 缓存：内存中的内置角色列表
    let _builtinRolesCache = null;

    /**
     * 加载 metadata JSON（三级回退策略）
     */
    async function loadMetadata() {
        // 优先级 1：全局变量（由 <script src="js/cards-metadata.js"> 加载，file:// 安全）
        if (typeof window.CARDS_METADATA !== 'undefined' && Array.isArray(window.CARDS_METADATA) && window.CARDS_METADATA.length > 0) {
            console.log(`[BuiltinCards] 从全局变量 CARDS_METADATA 加载 ${window.CARDS_METADATA.length} 张角色卡`);
            return window.CARDS_METADATA;
        }

        // 优先级 2：fetch（HTTP 服务器环境）
        try {
            const resp = await fetch('cards/cards-metadata.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data && data.length > 0) {
                console.log(`[BuiltinCards] 从 fetch 加载 ${data.length} 张角色卡`);
                return data;
            }
        } catch (fetchErr) {
            console.log('[BuiltinCards] fetch 失败:', fetchErr.message);
        }

        // 优先级 3：XMLHttpRequest 回退
        try {
            const data = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'cards/cards-metadata.json', true);
                xhr.responseType = 'json';
                xhr.onload = () => {
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error('网络错误'));
                xhr.send();
            });
            if (data && data.length > 0) {
                console.log(`[BuiltinCards] 从 XHR 加载 ${data.length} 张角色卡`);
                return data;
            }
        } catch (xhrErr) {
            console.log('[BuiltinCards] XHR 也失败:', xhrErr.message);
        }

        console.error('[BuiltinCards] 所有加载方式均失败，无法加载内置角色');
        return [];
    }

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
     * 从 metadata 构建角色对象数组
     */
    function buildRolesFromMetadata(metadataList) {
        const roles = [];
        for (let i = 0; i < metadataList.length; i++) {
            const meta = metadataList[i];
            try {
                // 从 tags 推断性别
                const tags = meta.tags || [];
                const hasMaleTag = tags.some(t => t === 'Male' || t === 'male' || t === '男性' || t === '男性向');
                const hasFemaleTag = tags.some(t => t === 'Female' || t === 'female' || t === '女性' || t === '女性向');
                const inferredGender = hasMaleTag ? 'male' : (hasFemaleTag ? 'female' : 'female');
                
                // 构建开场白数组（包含 first_mes 和 alternate_greetings）
                const scenes = [];
                if (meta.first_mes) {
                    scenes.push({
                        opener: meta.first_mes,
                        preview: meta.first_mes.substring(0, 60) + (meta.first_mes.length > 60 ? '……' : '')
                    });
                }
                // 添加备选开场白
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

                const role = {
                    id: 'builtin_' + i,
                    name: meta.name,
                    title: meta.name,
                    desc: (meta.description || '').substring(0, 200),
                    rarity: 'SSR',
                    isNew: true,
                    tags: tags,
                    gender: inferredGender,
                    emoji: '',
                    image: `cards/${encodeURIComponent(meta.filename)}`,
                    gradient: getRandomGradient(),
                    systemPrompt: buildSystemPrompt(meta),
                    scenes: scenes,
                    isBuiltin: true,
                    _sourceFile: meta.filename,
                    sourceData: {
                        characterBook: meta.character_book || null,
                        postHistoryInstructions: meta.post_history_instructions || '',
                        alternateGreetings: meta.alternate_greetings || [],
                    },
                };
                roles.push(role);
            } catch (err) {
                console.warn(`[BuiltinCards] 构建 ${meta.filename} 失败:`, err.message);
            }
        }
        return roles;
    }

    /**
     * 加载内置角色（结果缓存在内存）
     */
    async function loadBuiltinRoles() {
        if (_builtinRolesCache) {
            return _builtinRolesCache;
        }

        const metadataList = await loadMetadata();
        if (metadataList.length === 0) {
            return [];
        }

        const roles = buildRolesFromMetadata(metadataList);
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
            console.log(`[BuiltinCards] ✅ 已加载 ${added} 个内置角色到 ROLES_DATA`);
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

    return {
        isImported,
        markImported,
        resetImport,
        autoImport,
        loadBuiltinRoles,
    };
})();

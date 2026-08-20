/**
 * builtin-cards.js — 内置角色卡自动导入
 * 
 * 首次加载时（localStorage 中没有 ai_builtin_cards_imported 标记），
 * 自动从 cards/ 目录读取 manifest.json，逐个导入 PNG 角色卡。
 * 
 * 导入完成后设置标记，后续不再重复导入。
 * 用户可以在设置中清除标记来重新导入。
 */

const BuiltinCards = (function() {

    const STORAGE_KEY = 'ai_builtin_cards_imported';
    const MANIFEST_PATH = 'cards/manifest.json';

    /**
     * 检查是否已导入内置角色卡
     */
    function isImported() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    /**
     * 标记已导入
     */
    function markImported() {
        localStorage.setItem(STORAGE_KEY, 'true');
    }

    /**
     * 清除导入标记（用于重新导入）
     */
    function resetImport() {
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * 用 XMLHttpRequest 加载资源（绕过 file:// 协议的 CORS 限制）
     * @param {string} url
     * @param {string} responseType - 'json' | 'blob'
     * @returns {Promise<any>}
     */
    function loadResource(url, responseType) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = responseType;
            
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${url}`));
                }
            };
            
            xhr.onerror = () => reject(new Error(`网络错误: ${url}`));
            xhr.ontimeout = () => reject(new Error(`请求超时: ${url}`));
            
            xhr.send();
        });
    }

    /**
     * 自动导入内置角色卡（基于预生成的 metadata JSON，不再逐个解析 PNG）
     * @returns {Promise<number>} 成功导入的角色数量
     */
    async function autoImport() {
        if (isImported()) {
            console.log('[BuiltinCards] 已导入过内置角色卡，跳过');
            return 0;
        }

        console.log('[BuiltinCards] 首次加载，开始自动导入内置角色卡…');

        try {
            // 1. 直接 fetch 预生成的 metadata JSON（一次请求，不再逐个解析 PNG）
            let metadataList;
            try {
                const resp = await fetch('cards/cards-metadata.json');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                metadataList = await resp.json();
            } catch (err) {
                console.error('[BuiltinCards] 无法加载 cards-metadata.json:', err.message);
                console.error('[BuiltinCards] 提示: 请先运行 tmp/generate-card-metadata.py 生成元数据');
                return 0;
            }

            if (!metadataList || metadataList.length === 0) {
                console.log('[BuiltinCards] metadata 中无角色卡');
                return 0;
            }

            console.log(`[BuiltinCards] 找到 ${metadataList.length} 张角色卡`);

            // 2. 获取已有内置角色名列表（避免重复导入）
            const existingNames = new Set(
                (JSON.parse(localStorage.getItem('ai_builtin_roles') || '[]')).map(r => r.name)
            );

            let imported = 0;
            const builtinRoles = JSON.parse(localStorage.getItem('ai_builtin_roles') || '[]');

            // 3. 逐个构建角色对象（不再解析 PNG，直接用 metadata）
            for (let i = 0; i < metadataList.length; i++) {
                const meta = metadataList[i];
                
                // 每处理 5 张就让出主线程，避免卡顿
                if (i > 0 && i % 5 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }

                try {
                    // 检查是否已存在
                    if (existingNames.has(meta.name)) {
                        console.log(`[BuiltinCards] 跳过已存在的角色: ${meta.name}`);
                        continue;
                    }

                    // 构建角色对象（与 CardParser.mapCardToRole 输出格式一致）
                    const role = {
                        id: Date.now() + i,
                        name: meta.name,
                        title: meta.name,
                        desc: meta.description || '',
                        rarity: 'SSR',
                        isNew: true,
                        tags: meta.tags || [],
                        emoji: '',
                        image: `cards/${encodeURIComponent(meta.filename)}`,  // 直接用路径，不转base64
                        gradient: getRandomGradient(),
                        systemPrompt: buildSystemPrompt(meta),
                        scenes: meta.first_mes ? [{
                            opener: meta.first_mes,
                            preview: meta.first_mes.substring(0, 60) + (meta.first_mes.length > 60 ? '……' : '')
                        }] : [],
                        isBuiltin: true,
                        _sourceFile: meta.filename,
                    };

                    // 存入内置角色列表
                    builtinRoles.push(role);
                    existingNames.add(meta.name);

                    // 添加到 ROLES_DATA（用于前端展示）
                    if (typeof ROLES_DATA !== 'undefined') {
                        ROLES_DATA.push(role);
                    }

                    imported++;
                    console.log(`[BuiltinCards] [${i+1}/${metadataList.length}] 导入成功: ${meta.name}`);

                } catch (err) {
                    console.warn(`[BuiltinCards] [${i+1}/${metadataList.length}] 导入 ${meta.filename} 失败:`, err.message);
                }
            }

            // 4. 保存到独立的 localStorage key
            if (imported > 0) {
                localStorage.setItem('ai_builtin_roles', JSON.stringify(builtinRoles));
                console.log(`[BuiltinCards] 已保存 ${builtinRoles.length} 个内置角色到 ai_builtin_roles`);
            }

            // 5. 标记已导入
            markImported();

            console.log(`[BuiltinCards] ✅ 自动导入完成，成功 ${imported}/${metadataList.length} 张`);
            return imported;

        } catch (err) {
            console.error('[BuiltinCards] ❌ 自动导入失败:', err);
            return 0;
        }
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

    return {
        isImported,
        markImported,
        resetImport,
        autoImport,
    };
})();

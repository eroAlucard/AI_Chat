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
     * 自动导入内置角色卡
     * @returns {Promise<number>} 成功导入的角色数量
     */
    async function autoImport() {
        if (isImported()) {
            console.log('[BuiltinCards] 已导入过内置角色卡，跳过');
            return 0;
        }

        console.log('[BuiltinCards] 首次加载，开始自动导入内置角色卡…');
        console.log(`[BuiltinCards] 当前协议: ${window.location.protocol}`);

        try {
            // 1. 获取 manifest（使用 XMLHttpRequest 绕过 file:// CORS）
            let manifest;
            try {
                const manifestData = await loadResource(MANIFEST_PATH, 'json');
                manifest = manifestData;
            } catch (err) {
                console.error('[BuiltinCards] 无法加载 manifest.json:', err.message);
                console.error('[BuiltinCards] 提示: 如果使用 file:// 协议打开网页，请改用本地服务器（如 Live Server 或 python -m http.server）');
                return 0;
            }

            const cardFiles = manifest.cards || [];
            if (cardFiles.length === 0) {
                console.log('[BuiltinCards] manifest 中无角色卡');
                return 0;
            }

            console.log(`[BuiltinCards] 找到 ${cardFiles.length} 张角色卡`);

            // 2. 获取已有内置角色名列表（避免重复导入）
            const existingNames = new Set(
                (JSON.parse(localStorage.getItem('ai_builtin_roles') || '[]')).map(r => r.name)
            );

            let imported = 0;
            const builtinRoles = JSON.parse(localStorage.getItem('ai_builtin_roles') || '[]');

            // 3. 逐个导入
            for (let i = 0; i < cardFiles.length; i++) {
                const filename = cardFiles[i];
                try {
                    const cardUrl = `cards/${encodeURIComponent(filename)}`;
                    
                    // 使用 XMLHttpRequest 加载 PNG
                    const blob = await loadResource(cardUrl, 'blob');
                    const file = new File([blob], filename, { type: 'image/png' });

                    // 用 CardParser 解析（内置角色保留原始路径，不转base64）
                    const role = await CardParser.importCard(file, true, cardUrl);

                    // 标记为内置角色
                    role.isBuiltin = true;

                    // 检查是否已存在
                    if (existingNames.has(role.name)) {
                        console.log(`[BuiltinCards] 跳过已存在的角色: ${role.name}`);
                        continue;
                    }

                    // 存入内置角色列表
                    builtinRoles.push(role);
                    existingNames.add(role.name);

                    // 添加到 ROLES_DATA（用于前端展示）
                    if (typeof ROLES_DATA !== 'undefined') {
                        ROLES_DATA.push(role);
                    }

                    imported++;
                    console.log(`[BuiltinCards] [${i+1}/${cardFiles.length}] 导入成功: ${role.name}`);

                } catch (err) {
                    console.warn(`[BuiltinCards] [${i+1}/${cardFiles.length}] 导入 ${filename} 失败:`, err.message);
                }
            }

            // 4. 保存到独立的 localStorage key
            if (imported > 0) {
                localStorage.setItem('ai_builtin_roles', JSON.stringify(builtinRoles));
                console.log(`[BuiltinCards] 已保存 ${builtinRoles.length} 个内置角色到 ai_builtin_roles`);
            }

            // 5. 标记已导入
            markImported();

            console.log(`[BuiltinCards] ✅ 自动导入完成，成功 ${imported}/${cardFiles.length} 张`);
            return imported;

        } catch (err) {
            console.error('[BuiltinCards] ❌ 自动导入失败:', err);
            return 0;
        }
    }

    return {
        isImported,
        markImported,
        resetImport,
        autoImport,
    };
})();

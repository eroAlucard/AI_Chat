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
     * 自动导入内置角色卡
     * @returns {Promise<number>} 成功导入的角色数量
     */
    async function autoImport() {
        if (isImported()) {
            console.log('[BuiltinCards] 已导入过内置角色卡，跳过');
            return 0;
        }

        console.log('[BuiltinCards] 首次加载，开始自动导入内置角色卡…');

        try {
            // 1. 获取 manifest
            const resp = await fetch(MANIFEST_PATH);
            if (!resp.ok) {
                console.warn('[BuiltinCards] 无法获取 manifest.json，跳过自动导入');
                return 0;
            }
            const manifest = await resp.json();
            const cardFiles = manifest.cards || [];

            if (cardFiles.length === 0) {
                console.log('[BuiltinCards] manifest 中无角色卡');
                return 0;
            }

            // 2. 获取已有角色名列表（避免重复导入）
            const existingNames = new Set(
                (JSON.parse(localStorage.getItem('ai_custom_roles') || '[]')).map(r => r.name)
            );

            let imported = 0;
            const customRoles = JSON.parse(localStorage.getItem('ai_custom_roles') || '[]');

            // 3. 逐个导入
            for (const filename of cardFiles) {
                try {
                    const cardUrl = `cards/${encodeURIComponent(filename)}`;
                    const cardResp = await fetch(cardUrl);
                    if (!cardResp.ok) {
                        console.warn(`[BuiltinCards] 无法加载 ${filename}: ${cardResp.status}`);
                        continue;
                    }

                    const blob = await cardResp.blob();
                    const file = new File([blob], filename, { type: 'image/png' });

                    // 用 CardParser 解析
                    const role = await CardParser.importCard(file);

                    // 检查是否已存在
                    if (existingNames.has(role.name)) {
                        console.log(`[BuiltinCards] 跳过已存在的角色: ${role.name}`);
                        continue;
                    }

                    // 存入 localStorage
                    customRoles.push(role);
                    existingNames.add(role.name);

                    // 添加到 ROLES_DATA
                    if (typeof ROLES_DATA !== 'undefined') {
                        ROLES_DATA.push(role);
                    }

                    imported++;
                    console.log(`[BuiltinCards] 导入成功: ${role.name}`);

                } catch (err) {
                    console.warn(`[BuiltinCards] 导入 ${filename} 失败:`, err.message);
                }
            }

            // 4. 保存到 localStorage
            if (imported > 0) {
                localStorage.setItem('ai_custom_roles', JSON.stringify(customRoles));
            }

            // 5. 标记已导入
            markImported();

            console.log(`[BuiltinCards] 自动导入完成，成功 ${imported}/${cardFiles.length} 张`);
            return imported;

        } catch (err) {
            console.error('[BuiltinCards] 自动导入失败:', err);
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

/**
 * builtin-cards.js — 内置角色卡自动导入（增强版）
 * 
 * 首次加载时（localStorage 中没有 ai_builtin_cards_imported 标记），
 * 自动从以下两个目录导入角色卡：
 *   1. cards/ — 基于预生成的 manifest.json（SillyTavern 标准卡）
 *   2. images/ — 逐个解析 PNG 文件的 tEXt chara chunk（自包含角色卡）
 * 
 * 导入完成后设置标记，后续不再重复导入。
 * 用户可以在设置中清除标记来重新导入。
 */

const BuiltinCards = (function() {

    const STORAGE_KEY = 'ai_builtin_cards_imported';
    const MANIFEST_PATH = 'cards/manifest.json';
    const IMAGES_DIR = 'images/';

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
     * 从 metadata 构建 systemPrompt（cards/ 目录用）
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
            // 获取已有内置角色名列表（避免重复导入）
            const existingNames = new Set(
                (JSON.parse(localStorage.getItem('ai_builtin_roles') || '[]')).map(r => r.name)
            );

            let imported = 0;
            const builtinRoles = JSON.parse(localStorage.getItem('ai_builtin_roles') || '[]');

            // ========== 第一部分：导入 cards/ 目录（基于 manifest.json）==========
            console.log('[BuiltinCards]  扫描 cards/ 目录...');
            try {
                const resp = await loadResource(MANIFEST_PATH, 'json');
                const metadataList = resp;

                if (metadataList && metadataList.length > 0) {
                    console.log(`[BuiltinCards] 找到 ${metadataList.length} 张 cards/ 角色卡`);

                    for (let i = 0; i < metadataList.length; i++) {
                        const meta = metadataList[i];
                        
                        if (i > 0 && i % 5 === 0) {
                            await new Promise(r => setTimeout(r, 0));
                        }

                        try {
                            if (existingNames.has(meta.name)) {
                                continue;
                            }

                            const role = {
                                id: Date.now() + i,
                                name: meta.name,
                                title: meta.name,
                                desc: meta.description || '',
                                rarity: 'SSR',
                                isNew: true,
                                tags: meta.tags || [],
                                emoji: '',
                                image: `cards/${encodeURIComponent(meta.filename)}`,
                                gradient: getRandomGradient(),
                                systemPrompt: buildSystemPrompt(meta),
                                scenes: meta.first_mes ? [{
                                    opener: meta.first_mes,
                                    preview: meta.first_mes.substring(0, 60) + (meta.first_mes.length > 60 ? '……' : '')
                                }] : [],
                                isBuiltin: true,
                                _sourceFile: meta.filename,
                            };

                            builtinRoles.push(role);
                            existingNames.add(meta.name);
                            imported++;
                            console.log(`[BuiltinCards] [cards] [${i+1}/${metadataList.length}] ✓ ${meta.name}`);

                        } catch (err) {
                            console.warn(`[BuiltinCards] [cards] [${i+1}/${metadataList.length}] ✗ ${meta.filename}:`, err.message);
                        }
                    }
                }
            } catch (err) {
                console.error('[BuiltinCards] cards/ 导入失败:', err.message);
                console.error('[BuiltinCards] 提示: 请先运行 tmp/generate-card-metadata.py 生成元数据');
            }

            // ========== 第二部分：导入 images/ 目录（逐个解析 PNG）==========
            console.log('[BuiltinCards]  扫描 images/ 目录...');
            try {
                // 列出 images/ 下所有 PNG 文件
                const pngFiles = await listDirectory(IMAGES_DIR);
                const imagePngs = pngFiles.filter(f => f.toLowerCase().endsWith('.png'));

                if (imagePngs.length > 0) {
                    console.log(`[BuiltinCards] 找到 ${imagePngs.length} 张 images/ 角色卡`);

                    for (let i = 0; i < imagePngs.length; i++) {
                        const filename = imagePngs[i];
                        
                        if (i > 0 && i % 3 === 0) {
                            await new Promise(r => setTimeout(r, 0));
                        }

                        try {
                            // 用 CardParser 解析 PNG 文件
                            const blob = await loadResource(IMAGES_DIR + filename, 'blob');
                            const file = new File([blob], filename, { type: 'image/png' });
                            
                            const role = await CardParser.importCard(file, true, IMAGES_DIR + filename);

                            // 去重检查
                            if (existingNames.has(role.name)) {
                                console.log(`[BuiltinCards] [images] 跳过已存在: ${role.name}`);
                                continue;
                            }

                            role.isBuiltin = true;
                            role._sourceFile = filename;
                            role.id = Date.now() + 10000 + i; // 避免与 cards/ ID 冲突

                            builtinRoles.push(role);
                            existingNames.add(role.name);
                            imported++;
                            console.log(`[BuiltinCards] [images] [${i+1}/${imagePngs.length}] ✓ ${role.name}`);

                        } catch (err) {
                            console.warn(`[BuiltinCards] [images] [${i+1}/${imagePngs.length}] ✗ ${filename}:`, err.message);
                        }
                    }
                } else {
                    console.log('[BuiltinCards] images/ 目录下没有 PNG 文件');
                }
            } catch (err) {
                console.error('[BuiltinCards] images/ 导入失败:', err.message);
            }

            // ========== 保存并标记完成 ==========
            if (imported > 0) {
                localStorage.setItem('ai_builtin_roles', JSON.stringify(builtinRoles));
                console.log(`[BuiltinCards] 已保存 ${builtinRoles.length} 个内置角色到 ai_builtin_roles`);
            }

            markImported();
            console.log(`[BuiltinCards] ✅ 自动导入完成，共成功 ${imported} 张`);
            return imported;

        } catch (err) {
            console.error('[BuiltinCards] ❌ 自动导入失败:', err);
            return 0;
        }
    }

    /**
     * 列出目录下的文件名（通过 fetch 目录索引或使用预定义列表）
     * 注意：file:// 协议下无法直接列目录，这里使用回退策略
     * @param {string} dirPath
     * @returns {Promise<string[]>}
     */
    async function listDirectory(dirPath) {
        // 策略：尝试 fetch 一个预定义的索引文件，如果不存在则返回空数组
        // 对于 images/ 目录，我们硬编码已知文件列表作为回退
        const FALLBACK_IMAGES = [
            'role_001.png', 'role_002.png', 'role_003.png', 'role_004.png', 'role_005.png',
            'role_006.png', 'role_007.png', 'role_008.png', 'role_009.png', 'role_010.png',
        ];

        try {
            // 先尝试 fetch 目录（某些服务器支持目录索引）
            const resp = await fetch(dirPath);
            if (resp.ok && resp.headers.get('content-type')?.includes('text/html')) {
                // 解析 HTML 目录索引，提取文件名
                const html = await resp.text();
                const matches = html.match(/href=["']([^"']+\.png)["']/gi);
                if (matches) {
                    return matches.map(m => m.replace(/href=["']/i, '').replace(/["']/g, ''));
                }
            }
        } catch (e) {
            // fetch 目录失败，使用回退列表
        }

        // 回退：验证每个文件是否存在
        const existing = [];
        for (const fname of FALLBACK_IMAGES) {
            try {
                const resp = await fetch(dirPath + fname, { method: 'HEAD' });
                if (resp.ok) {
                    existing.push(fname);
                }
            } catch (e) {
                // 文件不存在，跳过
            }
        }

        return existing;
    }

    return {
        isImported,
        markImported,
        resetImport,
        autoImport,
    };
})();

/**
 * 状态面板模块 - 解析 JSONPatch 变量并渲染角色状态面板
 * 
 * 工作原理：
 * 1. 每次收到 AI 回复时，从 <UpdateVariable><JSONPatch> 中提取变量更新
 * 2. 将 JSONPatch 操作应用到全局状态对象 statData
 * 3. 渲染状态面板 HTML（角色列表 + 属性进度条 + 头像）
 * 4. 替换 <StatusPlaceHolderImpl/> 为状态面板 HTML
 */
const StatusPanel = (function() {
    'use strict';

    // ==================== 全局状态 ====================
    let statData = {};  // 所有变量数据，结构如 { 皇帝: { 觉醒度: 0 }, 李克: { 警惕度: 0 }, ... }
    let charDefs = [];  // 角色定义（从角色卡 regex_scripts 解析）
    let listImgMap = {};  // 角色列表头像映射
    let detailImgMap = {}; // 角色详情立绘映射

    // ==================== JSONPatch 解析 ====================
    
    /**
     * 解析 JSONPatch 数组并应用到状态对象
     * @param {Array} patches - JSONPatch 操作数组
     * @param {Object} target - 目标状态对象
     */
    function applyJSONPatch(patches, target) {
        if (!Array.isArray(patches)) return target;
        for (const patch of patches) {
            if (!patch || !patch.path) continue;
            // 将 /李克/警惕度 转为 ['李克', '警惕度']
            const keys = patch.path.split('/').filter(k => k.length > 0);
            if (keys.length === 0) continue;

            switch (patch.op) {
                case 'replace':
                case 'add':
                    setNestedValue(target, keys, patch.value);
                    break;
                case 'remove':
                    deleteNestedValue(target, keys);
                    break;
            }
        }
        return target;
    }

    /**
     * 设置嵌套对象的值
     */
    function setNestedValue(obj, keys, value) {
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }

    /**
     * 删除嵌套对象的值
     */
    function deleteNestedValue(obj, keys) {
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined) return;
            current = current[key];
        }
        delete current[keys[keys.length - 1]];
    }

    /**
     * 从消息文本中提取 <UpdateVariable><JSONPatch> 数据
     * @param {string} text - AI 回复文本
     * @returns {Array} JSONPatch 数组（可能为空）
     */
    function extractPatches(text) {
        const patches = [];
        // 匹配所有 <UpdateVariable><JSONPatch>...</JSONPatch></UpdateVariable>
        const regex = /<UpdateVariable>\s*<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>\s*<\/UpdateVariable>/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const json = JSON.parse(match[1]);
                if (Array.isArray(json)) {
                    patches.push(...json);
                }
            } catch (e) {
                console.warn('[StatusPanel] JSONPatch 解析失败:', e);
            }
        }
        return patches;
    }

    /**
     * 处理一条 AI 回复：提取变量更新并应用到全局状态
     * @param {string} text - AI 回复文本
     */
    function processMessage(text) {
        if (!text) return;
        const patches = extractPatches(text);
        if (patches.length > 0) {
            applyJSONPatch(patches, statData);
        }
    }

    // ==================== 角色定义解析 ====================

    /**
     * 从角色卡的 regex_scripts 解析角色定义和图片映射
     * @param {Array} regexScripts - 角色卡的 extensions.regex_scripts
     */
    function loadCharDefs(regexScripts) {
        if (!Array.isArray(regexScripts)) return;
        
        for (const rs of regexScripts) {
            if (rs.scriptName === '状态栏美化' || rs.scriptName === '状态栏2') {
                const repl = rs.replaceString || rs.repl || '';
                
                // 解析 LIST_IMG
                const listImgMatch = repl.match(/LIST_IMG\s*=\s*\{([\s\S]*?)\}/);
                if (listImgMatch) {
                    const imgStr = listImgMatch[1];
                    const imgRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
                    let m;
                    while ((m = imgRegex.exec(imgStr)) !== null) {
                        listImgMap[m[1]] = m[2];
                    }
                }

                // 解析 DETAIL_IMG（简化：只取 min:0 的图片作为默认图）
                const detailImgMatch = repl.match(/DETAIL_IMG\s*=\s*\{([\s\S]*?)\};/);
                if (detailImgMatch) {
                    const detStr = detailImgMatch[1];
                    // 按角色名分段
                    const charBlocks = detStr.match(/['"]([^'"]+)['"]\s*:\s*\[([\s\S]*?)\]/g);
                    if (charBlocks) {
                        for (const block of charBlocks) {
                            const nameMatch = block.match(/^['"]([^'"]+)['"]/);
                            if (!nameMatch) continue;
                            const charName = nameMatch[1];
                            detailImgMap[charName] = [];
                            // 提取所有 { min: N, url: '...' }
                            const items = block.match(/\{\s*min\s*:\s*(\d+)\s*,\s*url\s*:\s*['"]([^'"]+)['"]\s*\}/g);
                            if (items) {
                                for (const item of items) {
                                    const m2 = item.match(/min\s*:\s*(\d+)\s*,\s*url\s*:\s*['"]([^'"]+)['"]/);
                                    if (m2) {
                                        detailImgMap[charName].push({ min: parseInt(m2[1]), url: m2[2] });
                                    }
                                }
                            }
                        }
                    }
                }

                // 解析 CHARS 数组
                const charsMatch = repl.match(/CHARS\s*=\s*\[([\s\S]*?)\];/);
                if (charsMatch) {
                    const charsStr = charsMatch[1];
                    // 匹配每个角色对象 { n: "...", c: "...", sk: "...", th: "...", role: "...", label: "...", path: "...", ... }
                    const charRegex = /\{\s*n\s*:\s*["']([^"']+)["']\s*,\s*c\s*:\s*["']([^"']+)["']\s*,\s*sk\s*:\s*["']([^"']+)["']\s*,\s*th\s*:\s*["']([^"']+)["']\s*,\s*role\s*:\s*["']([^"']+)["']\s*,\s*label\s*:\s*["']([^"']+)["']\s*,\s*path\s*:\s*["']([^"']+)["']\s*(?:,\s*label2\s*:\s*["']([^"']*)["']\s*)?(?:,\s*path2\s*:\s*["']([^"']*)["']\s*)?(?:,\s*imgPath\s*:\s*["']([^"']*)["']\s*)?\}/g;
                    let cm;
                    while ((cm = charRegex.exec(charsStr)) !== null) {
                        charDefs.push({
                            n: cm[1],     // 角色名
                            c: cm[2],     // 主题色
                            sk: cm[3],    // 变量键名
                            th: cm[4],    // 主题类名
                            role: cm[5],  // 身份
                            label: cm[6], // 属性1标签
                            path: cm[7],  // 属性1路径
                            label2: cm[8] || '', // 属性2标签
                            path2: cm[9] || '',  // 属性2路径
                            imgPath: cm[10] || cm[7], // 换图路径
                        });
                    }
                }
            }
        }

        // 如果没有从角色卡解析到定义，使用默认定义
        if (charDefs.length === 0) {
            charDefs = [
                { n: '李克', c: 'rgba(100,30,30,0.75)', sk: '李克', th: 'theme-lk', role: '丞相', label: '警惕度', path: '警惕度', label2: '', path2: '', imgPath: '警惕度' },
                { n: '柳妃', c: 'rgba(120,100,50,0.7)', sk: '柳妃', th: 'theme-lf', role: '太后', label: '母子情分', path: '母子情分', label2: '', path2: '', imgPath: '母子情分' },
                { n: '林婉茹', c: 'rgba(50,90,70,0.7)', sk: '林婉茹', th: 'theme-lwr', role: '御医', label: '忠诚度', path: '忠诚度', label2: '', path2: '', imgPath: '忠诚度' },
                { n: '苏锦儿', c: 'rgba(140,50,60,0.7)', sk: '苏锦儿', th: 'theme-sjr', role: '御女营花魁', label: '可策反度', path: '可策反度', label2: '', path2: '', imgPath: '可策反度' },
                { n: '沈清芷', c: 'rgba(40,60,90,0.7)', sk: '沈清芷', th: 'theme-sqz', role: '将门之女', label: '复仇决心', path: '复仇决心', label2: '身体抗药', path2: '身体抗药', imgPath: '身体抗药' },
                { n: '赵嫣', c: 'rgba(80,50,100,0.7)', sk: '赵嫣', th: 'theme-zy', role: '尚宫局主事', label: '暗恋强度', path: '暗恋强度', label2: '压抑临界', path2: '压抑临界', imgPath: '压抑临界' },
            ];
        }
    }

    // ==================== 状态面板渲染 ====================

    /**
     * 获取角色列表头像 URL
     */
    function getListImg(name) {
        return listImgMap[name] || '';
    }

    /**
     * 获取角色详情立绘 URL（根据数值切换）
     */
    function getDetailImg(name, val) {
        val = val || 0;
        const imgs = detailImgMap[name];
        if (!imgs || !Array.isArray(imgs) || imgs.length === 0) return listImgMap[name] || '';
        let matched = imgs[0].url;
        for (const item of imgs) {
            if (val >= item.min && item.url) matched = item.url;
        }
        return matched;
    }

    /**
     * 从 statData 读取变量值
     */
    function getStat(path, def) {
        const keys = path.split('.');
        let current = statData;
        for (const key of keys) {
            if (current === undefined || current === null) return def;
            current = current[key];
        }
        return current !== undefined ? current : def;
    }

    /**
     * 渲染进度条 HTML
     */
    function renderBar(label, val, color) {
        const pct = Math.min(100, Math.max(0, val));
        return `<div class="sp-bar-row">
            <div class="sp-bar-label">${label}</div>
            <div class="sp-bar-track">
                <div class="sp-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="sp-bar-value" style="color:${color}">${val}</div>
        </div>`;
    }

    /**
     * 渲染角色行
     */
    function renderCharRow(charDef) {
        const val1 = getStat(`${charDef.sk}.${charDef.path}`, 0);
        const val2 = charDef.path2 ? getStat(`${charDef.sk}.${charDef.path2}`, 0) : undefined;
        const thought = getStat(`${charDef.sk}.内心想法`, '');
        const imgUrl = getListImg(charDef.n);
        const imgVal = getStat(`${charDef.sk}.${charDef.imgPath}`, 0);
        const detailUrl = getDetailImg(charDef.n, imgVal);

        const avatar = imgUrl
            ? `<div class="sp-avatar" data-detail="${detailUrl}" data-name="${charDef.n}"><img src="${imgUrl}" alt="${charDef.n}" loading="lazy"></div>`
            : `<div class="sp-avatar-text" style="--c:${charDef.c}">${charDef.n[0]}</div>`;

        let bars = renderBar(charDef.label, val1, charDef.c);
        if (val2 !== undefined) {
            bars += renderBar(charDef.label2, val2, charDef.c);
        }

        const thoughtHtml = thought
            ? `<div class="sp-thought">「${thought}」</div>`
            : '';

        return `<div class="sp-char-row" data-char="${charDef.n}" style="--c:${charDef.c}">
            ${avatar}
            <div class="sp-char-info">
                <div class="sp-char-name">${charDef.n}<span class="sp-char-role">${charDef.role}</span></div>
                ${bars}
                ${thoughtHtml}
            </div>
        </div>`;
    }

    /**
     * 渲染完整状态面板
     * @returns {string} HTML 字符串
     */
    function render() {
        if (charDefs.length === 0) return '';

        // 获取觉醒度
        const awakening = getStat('皇帝.觉醒度', 0);
        let actName = '第一幕·沉沦';
        if (awakening >= 76) actName = '第四幕·破局';
        else if (awakening >= 51) actName = '第三幕·暗流';
        else if (awakening >= 26) actName = '第二幕·裂痕';

        // 获取在场角色
        const activeChars = getStat('世界.在场角色', []);
        const activeSet = new Set(Array.isArray(activeChars) ? activeChars : []);

        // 排序：在场角色优先
        const sorted = [...charDefs].sort((a, b) => {
            const aActive = activeSet.has(a.n);
            const bActive = activeSet.has(b.n);
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return 0;
        });

        const charRows = sorted.map(c => renderCharRow(c)).join('');

        return `<div class="sp-panel">
            <div class="sp-char-list">
                ${charRows}
            </div>
        </div>`;
    }

    // ==================== DOM 更新 ====================

    /**
     * 将状态面板渲染到指定的 DOM 容器中
     * @param {string|HTMLElement} container - 容器元素或选择器
     */
    function update(container) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;

        const html = render();
        if (html) {
            el.innerHTML = html;
            // 绑定角色行点击事件（展开立绘大图）
            el.querySelectorAll('.sp-char-row').forEach(row => {
                row.addEventListener('click', () => {
                    const name = row.dataset.char;
                    const val = getStat(charDefs.find(c => c.n === name)?.path || name, 0);
                    const img = getDetailImg(name, val);
                    if (img) showDetailImage(img, name);
                });
            });
        }
    }

    /**
     * 显示角色立绘大图弹窗
     */
    function showDetailImage(url, name) {
        // 移除已有弹窗
        const existing = document.getElementById('spDetailOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'spDetailOverlay';
        overlay.className = 'sp-detail-overlay';
        overlay.innerHTML = `
            <div class="sp-detail-backdrop"></div>
            <div class="sp-detail-content">
                <img class="sp-detail-img" src="${url}" alt="${name}" onerror="this.style.display='none'">
                <div class="sp-detail-name">${name}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.sp-detail-backdrop').addEventListener('click', () => overlay.remove());
    }

    /**
     * 重置所有状态数据（切换角色时调用）
     */
    function reset() {
        statData = {};
        charDefs = [];
        listImgMap = {};
        detailImgMap = {};
    }

    // ==================== 公开 API ====================
    return {
        processMessage,   // 处理 AI 回复（提取变量更新）
        loadCharDefs,     // 加载角色定义（从角色卡 regex_scripts）
        render,           // 渲染状态面板 HTML
        update,           // 渲染状态面板到 DOM 容器
        reset,            // 重置状态数据
        getStat,          // 读取变量值
        get statData() { return statData; },  // 访问完整状态
    };
})();

/**
 * markdown-renderer.js — AI Chat 高级渲染引擎
 * 
 * 支持：
 * 1. Markdown 基础语法（斜体 *text*、粗体 **text**、粗斜体 ***text***）
 * 2. SillyTavern 自定义标签：
 *    - ☞...☜ 时间地点头部
 *    - <UpdateVariable>/<JSONPatch> 状态块（隐藏或折叠显示）
 *    - <StatusPlaceHolderImpl/> 状态占位符
 * 3. 引用块 > text
 * 4. 分隔线 ---
 * 5. 行内代码 `code`
 * 6. 代码块 ```lang ... ```
 * 7. 有序/无序列表
 * 8. 对话引号渲染
 * 9. XML/HTML 自定义标签渲染（角色卡中的自定义结构）
 */

const MarkdownRenderer = (function() {

    // ==================== 配置 ====================
    const config = {
        // 是否隐藏 UpdateVariable/JSONPatch 块（true=隐藏，false=折叠显示）
        hideStateBlocks: true,
        // 是否渲染 ☞...☜ 时间地点头
        renderTimeLocationHeader: true,
        // 是否渲染斜体/粗体
        renderMarkdown: true,
    };

    // ==================== 工具函数 ====================

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 安全地还原已被转义的 HTML 标签
     * 仅还原白名单中的标签
     */
    function unescapeAllowedTags(text) {
        // 还原允许的 HTML 标签
        const allowedTags = ['div','span','table','tr','td','th','ul','ol','li',
            'details','summary','style','img','svg','progress','meter','section',
            'article','header','footer','nav','form','input','button','select',
            'option','textarea','label','fieldset','legend','datalist','output',
            'canvas','video','audio','source','picture','br','hr','em','strong',
            'b','i','u','s','mark','small','sub','sup','pre','code','blockquote',
            'a','p','h1','h2','h3','h4','h5','h6'];
        
        // 这个函数暂时不用，我们在处理流程中控制转义时机
        return text;
    }

    // ==================== 预处理：提取并保护特殊块 ====================

    /**
     * 提取代码块，防止内部内容被 Markdown 处理
     * 返回 { protected: Map<placeholder, original>, text: 处理后的文本 }
     */
    function protectCodeBlocks(text) {
        const protectedBlocks = new Map();
        let counter = 0;

        // 保护 ```代码块```
        text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `\x00CODEBLOCK_${counter++}\x00`;
            const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
            protectedBlocks.set(placeholder, `<pre class="md-code-block"><code${langAttr}>${escapeHtml(code.trimEnd())}</code></pre>`);
            return placeholder;
        });

        // 保护行内代码 `code`
        text = text.replace(/`([^`\n]+)`/g, (match, code) => {
            const placeholder = `\x00CODEBLOCK_${counter++}\x00`;
            protectedBlocks.set(placeholder, `<code class="md-inline-code">${escapeHtml(code)}</code>`);
            return placeholder;
        });

        // 保护 Markdown 图片 ![alt](url) — 防止 URL 中的 & 被 escapeHtml 转义
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            const placeholder = `\x00CODEBLOCK_${counter++}\x00`;
            protectedBlocks.set(placeholder, `<img class="md-image" src="${url}" alt="${escapeHtml(alt)}" loading="lazy">`);
            return placeholder;
        });

        // 保护 Markdown 链接 [text](url) — 防止 URL 中的 & 被 escapeHtml 转义
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
            const placeholder = `\x00CODEBLOCK_${counter++}\x00`;
            protectedBlocks.set(placeholder, `<a class="md-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(linkText)}</a>`);
            return placeholder;
        });

        return { protectedBlocks, text };
    }

    /**
     * 还原被保护的代码块
     */
    function restoreProtectedBlocks(text, protectedBlocks) {
        for (const [placeholder, html] of protectedBlocks) {
            text = text.replace(placeholder, html);
        }
        return text;
    }

    // ==================== SillyTavern 自定义标签渲染 ====================

    /**
     * 渲染 ☞...☜ 时间地点头部
     * 格式：☞承平三年-二月初七-月明风清-子时-皇帝寝宫-烛火摇曳☜
     * 渲染为：带图标的时间地点标签栏
     */
    function renderTimeLocationHeader(text) {
        if (!config.renderTimeLocationHeader) return text;

        return text.replace(/☞([^☞☜]+)☜/g, (match, content) => {
            const parts = content.split('-').map(p => p.trim()).filter(p => p);
            if (parts.length === 0) return match;

            // 智能分类：时间、地点、天气、氛围
            const timeKeywords = ['子时','丑时','寅时','卯时','辰时','巳时','午时','未时','申时','酉时','戌时','亥时',
                '凌晨','清晨','上午','中午','下午','傍晚','黄昏','夜晚','深夜','午夜',
                '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
            const weatherKeywords = ['月明风清','晴','阴','雨','雪','风','雾','雷','月圆如盘',
                '月明','风清','暴雨','细雨','大雪','微风','狂风','冰雹'];
            const atmosphereKeywords = ['烛火摇曳','药香弥漫','灯火通明','寂静无声','人声鼎沸',
                '香气四溢','寒气逼人','暖意融融','阴森恐怖','金碧辉煌'];

            let yearPart = '';
            let timePart = '';
            let locationPart = '';
            let weatherPart = '';
            let atmospherePart = '';

            parts.forEach(part => {
                // 优先级1：检测氛围（最具体的关键词）
                if (atmosphereKeywords.some(k => part.includes(k))) {
                    atmospherePart = part;
                }
                // 优先级2：检测天气
                else if (weatherKeywords.some(k => part.includes(k))) {
                    weatherPart = part;
                }
                // 优先级3：检测时辰（精确匹配，仅匹配纯时辰词，不含"年""月"的日期词）
                else if (timeKeywords.some(k => part === k) && !/年|月|日/.test(part)) {
                    timePart = part;
                }
                // 优先级4：检测年份/日期（含"年""月""日"等，通常是较长的词）
                else if (/年|月|日|朝|代|国|世纪|纪元|初/.test(part)) {
                    yearPart = yearPart ? yearPart + ' ' + part : part;
                }
                // 默认为地点
                else {
                    locationPart = locationPart ? locationPart + ' ' + part : part;
                }
            });

            // 构建 HTML
            let html = '<div class="md-scene-header">';
            
            // 第一行：时间 + 地点
            if (yearPart || timePart || locationPart) {
                html += '<div class="md-scene-row">';
                if (yearPart) html += `<span class="md-scene-date">📅 ${escapeHtml(yearPart)}</span>`;
                if (timePart) html += `<span class="md-scene-time">🕐 ${escapeHtml(timePart)}</span>`;
                if (locationPart) html += `<span class="md-scene-location">📍 ${escapeHtml(locationPart)}</span>`;
                html += '</div>';
            }
            
            // 第二行：天气 + 氛围
            if (weatherPart || atmospherePart) {
                html += '<div class="md-scene-row md-scene-row-sub">';
                if (weatherPart) html += `<span class="md-scene-weather">🌙 ${escapeHtml(weatherPart)}</span>`;
                if (atmospherePart) html += `<span class="md-scene-atmosphere">✨ ${escapeHtml(atmospherePart)}</span>`;
                html += '</div>';
            }

            html += '</div>';
            return html;
        });
    }

    /**
     * 处理 <UpdateVariable>/<JSONPatch> 状态块
     * 选项1：完全隐藏（默认）
     * 选项2：折叠显示
     */
    function processStateBlocks(text) {
        if (config.hideStateBlocks) {
            // 完全隐藏 UpdateVariable + JSONPatch 块
            // 匹配 <UpdateVariable>...</UpdateVariable> 及其内部所有内容
            text = text.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '');
            // 也处理没有闭合标签的情况（某些角色卡格式不规范）
            text = text.replace(/<UpdateVariable\s*\/?>/gi, '');
        } else {
            // 折叠显示
            text = text.replace(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/gi, (match, content) => {
                return `<details class="md-state-block"><summary class="md-state-summary">📊 状态更新</summary><div class="md-state-content">${escapeHtml(content.trim())}</div></details>`;
            });
        }

        // 处理 <StatusPlaceHolderImpl/> 或 <StatusPlaceHolderImpl />
        // 替换为状态面板 HTML（如果 StatusPanel 模块已加载且有数据）
        text = text.replace(/<StatusPlaceHolderImpl\s*\/?>/gi, (match) => {
            if (typeof StatusPanel !== 'undefined' && StatusPanel.render) {
                const panelHtml = StatusPanel.render();
                return panelHtml || '';
            }
            return '';
        });

        // 处理独立的 <JSONPatch>...</JSONPatch>（不在 UpdateVariable 内的）
        if (config.hideStateBlocks) {
            text = text.replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/gi, '');
            text = text.replace(/<JSONPatch\s*\/?>/gi, '');
        } else {
            text = text.replace(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/gi, (match, content) => {
                return `<details class="md-state-block"><summary class="md-state-summary">📋 JSON Patch</summary><div class="md-state-content"><pre>${escapeHtml(content.trim())}</pre></div></details>`;
            });
        }

        return text;
    }

    // ==================== Markdown 基础渲染 ====================

    /**
     * 渲染粗斜体、粗体、斜体
     * 顺序很重要：先处理 ***text***，再 **text**，最后 *text*
     */
    function renderBoldItalic(text) {
        if (!config.renderMarkdown) return text;

        // 粗斜体 ***text*** 或 ___text___
        text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        
        // 粗体 **text** 或 __text__
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // 斜体 *text* 或 _text_
        // 注意：避免匹配列表项前的 * 和数字列表
        // 只匹配行内 *text*（前后不能是 *）
        text = text.replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');
        text = text.replace(/(?<!_)_(?!\s)(.+?)(?<!\s)_(?!_)/g, '<em>$1</em>');

        // 删除线 ~~text~~
        text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

        return text;
    }

    /**
     * 渲染分隔线
     */
    function renderHorizontalRule(text) {
        // --- 或 *** 或 ___ 独占一行
        text = text.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr class="md-hr">');
        return text;
    }

    /**
     * 渲染引用块 > text
     */
    function renderBlockquotes(text) {
        // 匹配连续的 > 开头行
        const lines = text.split('\n');
        let result = [];
        let inQuote = false;
        let quoteLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/^&gt;\s?/)) {
                // 引用行
                inQuote = true;
                quoteLines.push(line.replace(/^&gt;\s?/, ''));
            } else {
                if (inQuote) {
                    // 结束引用块
                    result.push(`<blockquote class="md-quote">${quoteLines.join('<br>')}</blockquote>`);
                    quoteLines = [];
                    inQuote = false;
                }
                result.push(line);
            }
        }
        // 处理末尾引用
        if (inQuote) {
            result.push(`<blockquote class="md-quote">${quoteLines.join('<br>')}</blockquote>`);
        }

        return result.join('\n');
    }

    /**
     * 渲染列表
     */
    function renderLists(text) {
        const lines = text.split('\n');
        let result = [];
        let inUl = false;
        let inOl = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 无序列表：- 或 * 开头
            const ulMatch = line.match(/^[\s]*(?:[-*])\s+(.+)/);
            // 有序列表：1. 开头
            const olMatch = line.match(/^[\s]*\d+\.\s+(.+)/);

            if (ulMatch) {
                if (!inUl) {
                    if (inOl) { result.push('</ol>'); inOl = false; }
                    result.push('<ul class="md-list">');
                    inUl = true;
                }
                result.push(`<li>${ulMatch[1]}</li>`);
            } else if (olMatch) {
                if (!inOl) {
                    if (inUl) { result.push('</ul>'); inUl = false; }
                    result.push('<ol class="md-list">');
                    inOl = true;
                }
                result.push(`<li>${olMatch[1]}</li>`);
            } else {
                if (inUl) { result.push('</ul>'); inUl = false; }
                if (inOl) { result.push('</ol>'); inOl = false; }
                result.push(line);
            }
        }
        if (inUl) result.push('</ul>');
        if (inOl) result.push('</ol>');

        return result.join('\n');
    }

    /**
     * 渲染对话引号
     * 中文引号 "" 包裹的内容渲染为对话样式
     */
    function renderDialogue(text) {
        // 中文引号对话
        text = text.replace(/"([^"]+)"/g, '<span class="md-dialogue">"$1"</span>');
        // 日式引号「」
        text = text.replace(/「([^」]+)」/g, '<span class="md-dialogue">「$1」</span>');
        // 英文引号（仅在明确是对话场景时）
        // text = text.replace(/"([^"]+)"/g, '<span class="md-dialogue">"$1"</span>');
        return text;
    }

    /**
     * 渲染标题（可选，部分角色卡使用 # 标题）
     */
    function renderHeadings(text) {
        text = text.replace(/^####\s+(.+)$/gm, '<h4 class="md-heading">$1</h4>');
        text = text.replace(/^###\s+(.+)$/gm, '<h3 class="md-heading">$1</h3>');
        text = text.replace(/^##\s+(.+)$/gm, '<h2 class="md-heading">$1</h2>');
        text = text.replace(/^#\s+(.+)$/gm, '<h1 class="md-heading">$1</h1>');
        return text;
    }

    /**
     * 渲染链接和图片
     */
    function renderLinks(text) {
        // 图片 ![alt](url)
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="md-image" src="$2" alt="$1" loading="lazy">');
        // 链接 [text](url)
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');
        return text;
    }

    // ==================== 主渲染函数 ====================

    /**
     * 高级渲染主入口
     * @param {string} content - 原始消息文本
     * @param {object} options - 渲染选项（覆盖默认配置）
     * @returns {string} 渲染后的 HTML
     */
    function render(content, options = {}) {
        // 合并配置
        const cfg = { ...config, ...options };

        if (!content) return '';

        // ---- 第 1 步：处理 SillyTavern 自定义标签（在转义前） ----
        
        // 处理 UpdateVariable/JSONPatch 状态块（需要在转义前处理 XML 标签）
        content = processStateBlocks(content);

        // 1.5 在渲染场景头部之前检测 HTML 标签（避免自身生成的标签误判）
        const hasHtmlTags = /<(div|span|table|tr|td|th|ul|ol|li|details|summary|style|img|svg|progress|meter|section|article|header|footer|nav|form|input|button|select|option|textarea|label|fieldset|legend|datalist|output|canvas|video|audio|source|picture)\b/i.test(content);

        // 渲染 ☞...☜ 时间地点头部（需要在转义前处理）
        content = renderTimeLocationHeader(content);

        // 1.6 保护场景头部 HTML（防止被 escapeHtml 转义）
        const sceneProtectedBlocks = new Map();
        content = content.replace(/<div class="md-scene-header">[\s\S]*?<\/div>\s*<\/div>/g, (match) => {
            const placeholder = `\x00SCENE_${sceneProtectedBlocks.size}\x00`;
            sceneProtectedBlocks.set(placeholder, match);
            return placeholder;
        });

        if (hasHtmlTags) {
            // 包含 HTML 标签：安全过滤后直接渲染
            let safe = content
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<script\b[^>]*\/?>/gi, '')
                .replace(/<(iframe|embed|object|link|meta|base)\b[^>]*>/gi, '')
                .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
                .replace(/\bid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
                .replace(/javascript:/gi, 'blocked:')
                .replace(/data:\s*text\/html/gi, 'blocked:');
            
            // 对 HTML 内容也做 Markdown 渲染（斜体/粗体等）
            if (cfg.renderMarkdown) {
                safe = renderBoldItalic(safe);
            }
            
            safe = safe.replace(/\n/g, '<br>');
            // 还原场景头部
            safe = restoreProtectedBlocks(safe, sceneProtectedBlocks);
            return safe;
        }

        // ---- 第 3 步：纯文本内容，执行完整 Markdown 渲染 ----

        // 3.1 保护代码块（防止被后续处理破坏）
        const { protectedBlocks, text: protected } = protectCodeBlocks(content);

        // 3.2 HTML 转义（代码块已被保护，不会被转义）
        let text = escapeHtml(protected);

        // 3.3 渲染 Markdown 元素（注意顺序）
        if (cfg.renderMarkdown) {
            text = renderHeadings(text);
            text = renderHorizontalRule(text);
            text = renderBlockquotes(text);  // 引用块（在 > 被转义为 &gt; 后处理）
            text = renderLists(text);
            text = renderBoldItalic(text);
            text = renderLinks(text);
            text = renderDialogue(text);
        }

        // 3.4 处理换行
        // 保留段落：连续空行分段
        text = text.replace(/\n{2,}/g, '</p><p class="md-paragraph">');
        // 单换行 → <br>
        text = text.replace(/\n/g, '<br>');
        // 包裹在段落中
        text = `<p class="md-paragraph">${text}</p>`;
        // 清理空段落
        text = text.replace(/<p class="md-paragraph">\s*<\/p>/g, '');
        // 清理段落内的 blockquote/hr/list 标签产生的多余 <p>
        text = text.replace(/<p class="md-paragraph">(<(?:blockquote|hr|ul|ol|h[1-6])[^>]*>)/g, '$1');
        text = text.replace(/(<\/(?:blockquote|ul|ol|h[1-6])>)<\/p>/g, '$1');

        // 3.5 还原被保护的代码块
        text = restoreProtectedBlocks(text, protectedBlocks);

        // 3.6 还原场景头部 HTML
        text = restoreProtectedBlocks(text, sceneProtectedBlocks);

        // 3.7 清理场景头部周围的段落标签（场景头部是块级元素，不应被 <p> 包裹）
        text = text.replace(/<p class="md-paragraph">\s*(<div class="md-scene-header">)/g, '$1');
        text = text.replace(/(<\/div>)\s*<\/p>/g, '$1');

        // 3.8 清理残留的空标签
        text = text.replace(/<br>\s*<br>\s*<br>/g, '<br><br>');

        return text;
    }

    // ==================== 流式渲染 ====================

    /**
     * 流式渲染：用于 AI 逐字输出时的实时渲染
     * 与 render() 的区别：
     * 1. 对不完整的 Markdown 标记做容错处理（如单个 * 不渲染为斜体开始）
     * 2. 性能优化：跳过较重的列表/引用块解析
     * 3. 对 UpdateVariable/JSONPatch 块在流式过程中也隐藏
     */
    function renderStream(content, options = {}) {
        if (!content) return '';

        const cfg = { ...config, ...options };

        // 1. 处理 UpdateVariable/JSONPatch（即使流式中也要隐藏）
        content = processStateBlocks(content);

        // 2. 在渲染场景头部之前检测 HTML 标签（避免自身生成的标签误判）
        const hasHtmlTags = /<(div|span|table|tr|td|th|ul|ol|li|details|summary|style|img|svg|progress|meter|section|article|header|footer|nav)\b/i.test(content);

        // 3. 渲染 ☞...☜ 时间地点头部
        content = renderTimeLocationHeader(content);

        // 3.5 保护场景头部 HTML（防止被 escapeHtml 转义）
        const sceneProtectedBlocks = new Map();
        content = content.replace(/<div class="md-scene-header">[\s\S]*?<\/div>\s*<\/div>/g, (match) => {
            const placeholder = `\x00SCENE_${sceneProtectedBlocks.size}\x00`;
            sceneProtectedBlocks.set(placeholder, match);
            return placeholder;
        });

        if (hasHtmlTags) {
            let safe = content
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<script\b[^>]*\/?>/gi, '')
                .replace(/<(iframe|embed|object|link|meta|base)\b[^>]*>/gi, '')
                .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
                .replace(/\bid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
                .replace(/javascript:/gi, 'blocked:')
                .replace(/data:\s*text\/html/gi, 'blocked:');
            safe = safe.replace(/\n/g, '<br>');
            // 还原场景头部
            safe = restoreProtectedBlocks(safe, sceneProtectedBlocks);
            return safe;
        }

        // 4. 保护代码块
        const { protectedBlocks, text: protected } = protectCodeBlocks(content);

        // 5. HTML 转义
        let text = escapeHtml(protected);

        // 6. 流式安全的 Markdown 渲染
        if (cfg.renderMarkdown) {
            text = renderHeadings(text);
            text = renderHorizontalRule(text);
            // 流式模式：使用更安全的斜体/粗体正则，避免半截标记被错误渲染
            text = renderBoldItalicStreamSafe(text);
            text = renderLinks(text);
            text = renderDialogue(text);
        }

        // 7. 换行
        text = text.replace(/\n/g, '<br>');

        // 8. 还原代码块
        text = restoreProtectedBlocks(text, protectedBlocks);

        // 9. 还原场景头部 HTML
        text = restoreProtectedBlocks(text, sceneProtectedBlocks);

        return text;
    }

    /**
     * 流式安全的粗斜体渲染
     * 只渲染成对的标记，未闭合的标记保持原样
     */
    function renderBoldItalicStreamSafe(text) {
        // 粗斜体 ***text***
        text = text.replace(/\*\*\*([^*]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        // 粗体 **text**
        text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
        // 斜体 *text* — 流式安全：只匹配行内成对的 *，且内容不含换行
        text = text.replace(/(?<!\*)\*(?!\s)([^\n*]+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');
        // 删除线
        text = text.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
        return text;
    }

    // ==================== 公开 API ====================
    return {
        render,
        renderStream,
        config,
        // 单独暴露各渲染函数，供外部灵活使用
        renderTimeLocationHeader,
        processStateBlocks,
        renderBoldItalic,
        renderBlockquotes,
        renderLists,
        renderDialogue,
        renderHeadings,
    };
})();

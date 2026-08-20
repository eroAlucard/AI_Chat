/**
 * card-parser.js — SillyTavern PNG 人物卡解析模块
 * 支持 V2 (chara_card_v2) 和 V3 (chara_card_v3) 规范
 * 
 * 功能：
 * 1. 从 PNG 文件的 tEXt chunk 中提取 base64 编码的角色数据
 * 2. 解析 JSON 并映射为应用内部角色数据格式
 * 3. 处理 {{user}} / {{char}} 模板变量替换
 * 4. 将 character_book 常驻 entries 合并到 systemPrompt
 */

const CardParser = (function() {

    /**
     * 从 PNG ArrayBuffer 中提取 tEXt chunk
     * @param {ArrayBuffer} buffer
     * @returns {Object} { chara: string|null, ccv3: string|null }
     */
    function extractTextChunks(buffer) {
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);
        
        // 验证 PNG 签名
        const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
        for (let i = 0; i < 8; i++) {
            if (view.getUint8(i) !== PNG_SIGNATURE[i]) {
                throw new Error('不是有效的 PNG 文件');
            }
        }
        
        let offset = 8;
        const chunks = { chara: null, ccv3: null };
        
        while (offset < buffer.byteLength) {
            const length = view.getUint32(offset);
            const type = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7)
            );
            
            if (type === 'tEXt') {
                // tEXt 格式: keyword\0text
                const dataStart = offset + 8;
                let nullPos = dataStart;
                while (nullPos < dataStart + length && uint8[nullPos] !== 0) {
                    nullPos++;
                }
                
                const keyword = new TextDecoder('iso-8859-1').decode(uint8.slice(dataStart, nullPos));
                const textData = uint8.slice(nullPos + 1, dataStart + length);
                const textStr = new TextDecoder('iso-8859-1').decode(textData);
                
                if (keyword === 'chara') {
                    chunks.chara = textStr;
                } else if (keyword === 'ccv3') {
                    chunks.ccv3 = textStr;
                }
            }
            
            // 前进到下一个 chunk: 4(len) + 4(type) + length + 4(crc)
            offset += 12 + length;
            
            if (type === 'IEND') break;
        }
        
        return chunks;
    }

    /**
     * Base64 解码为 UTF-8 字符串
     * @param {string} base64Str
     * @returns {string}
     */
    function base64ToUtf8(base64Str) {
        const binaryStr = atob(base64Str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    }

    /**
     * 替换 SillyTavern 模板变量
     * {{user}} → 用户名, {{char}} → 角色名
     * @param {string} text
     * @param {string} charName
     * @param {string} [userName='用户']
     * @returns {string}
     */
    function replaceTemplateVars(text, charName, userName = '用户') {
        if (!text) return '';
        return text
            .replace(/\{\{user\}\}/g, userName)
            .replace(/\{\{char\}\}/g, charName);
    }

    /**
     * 解析 PNG 人物卡文件
     * @param {File} file — 用户选择的 PNG 文件
     * @returns {Promise<Object>} 解析后的角色数据
     */
    async function parseCard(file) {
        const buffer = await file.arrayBuffer();
        const chunks = extractTextChunks(buffer);
        
        if (!chunks.chara) {
            throw new Error('该 PNG 文件不包含 SillyTavern 人物卡数据（未找到 chara tEXt chunk）');
        }
        
        // Base64 解码 → JSON 解析
        const jsonStr = base64ToUtf8(chunks.chara);
        const cardData = JSON.parse(jsonStr);
        
        return cardData;
    }

    /**
     * 将 SillyTavern 卡片数据映射为应用内部角色格式
     * @param {Object} cardData — 解析后的 chara JSON
     * @param {File} file — 原始 PNG 文件（用于生成图片 blob URL）
     * @returns {Promise<Object>} 内部角色数据对象
     */
    async function mapCardToRole(cardData, file) {
        const spec = cardData.spec || 'chara_card_v2';
        const specVersion = cardData.spec_version || '2.0';
        
        // V2 和 V3 都把角色数据放在 data 字段中
        const data = cardData.data || {};
        
        const charName = data.name || cardData.name || '未命名角色';
        const userName = '用户';
        
        // === 构建 systemPrompt ===
        let systemPrompt = '';
        
        // 1. system_prompt（SillyTavern 原始系统提示词）
        if (data.system_prompt) {
            systemPrompt += replaceTemplateVars(data.system_prompt, charName, userName) + '\n\n';
        }
        
        // 2. description（人设描述，88%的卡都有，是最核心的字段）
        if (data.description) {
            systemPrompt += replaceTemplateVars(data.description, charName, userName) + '\n\n';
        }
        
        // 3. personality
        if (data.personality) {
            systemPrompt += '【性格】' + replaceTemplateVars(data.personality, charName, userName) + '\n\n';
        }
        
        // 4. scenario
        if (data.scenario) {
            systemPrompt += '【场景】' + replaceTemplateVars(data.scenario, charName, userName) + '\n\n';
        }
        
        // 5. character_book 常驻 entries
        if (data.character_book && data.character_book.entries) {
            const enabledEntries = data.character_book.entries
                .filter(e => e.enabled !== false && e.constant === true)
                .sort((a, b) => (a.insertion_order || 100) - (b.insertion_order || 100));
            
            for (const entry of enabledEntries) {
                if (entry.content) {
                    systemPrompt += replaceTemplateVars(entry.content, charName, userName) + '\n\n';
                }
            }
        }
        
        // 6. mes_example（对话示例）
        if (data.mes_example) {
            systemPrompt += '【对话示例】\n' + replaceTemplateVars(data.mes_example, charName, userName) + '\n\n';
        }
        
        systemPrompt = systemPrompt.trim();
        
        // === 开场白 ===
        const scenes = [];
        if (data.first_mes) {
            const opener = replaceTemplateVars(data.first_mes, charName, userName);
            scenes.push({
                opener: opener,
                preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : '')
            });
        }
        
        // 备选开场白
        if (data.alternate_greetings && data.alternate_greetings.length > 0) {
            for (const g of data.alternate_greetings) {
                if (g && g.trim()) {
                    const opener = replaceTemplateVars(g, charName, userName);
                    scenes.push({
                        opener: opener,
                        preview: opener.substring(0, 60) + (opener.length > 60 ? '……' : '')
                    });
                }
            }
        }
        
        // === 标签 ===
        const tags = (data.tags || []).slice(0, 10);
        
        // === 图片（转为 base64 data URL 以持久化到 localStorage）===
        let imageUrl = '';
        try {
            imageUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('FileReader 读取失败'));
                reader.readAsDataURL(file);
            });
        } catch (e) {
            console.warn('无法将图片转为 base64:', e);
        }
        
        // === 生成渐变色 ===
        const gradients = [
            'linear-gradient(135deg, #1a1a3e, #2d1b4e)',
            'linear-gradient(135deg, #3e1a1a, #4e2d1b)',
            'linear-gradient(135deg, #1a2e3e, #1b3e2d)',
            'linear-gradient(135deg, #2e1a3e, #3e1b2d)',
            'linear-gradient(135deg, #1a3e3e, #2d4e1b)',
        ];
        
        // === 构建角色对象 ===
        const role = {
            id: Date.now(),
            name: charName,
            title: charName,
            desc: data.description
                ? replaceTemplateVars(data.description, charName, userName).substring(0, 100)
                : '',
            rarity: 'R',
            isNew: true,
            tags: tags,
            emoji: '🎭',
            image: imageUrl,
            gradient: gradients[Math.floor(Math.random() * gradients.length)],
            systemPrompt: systemPrompt,
            scenes: scenes,
            source: 'imported',
            sourceData: {
                spec: spec,
                specVersion: specVersion,
                characterBook: data.character_book || null,
                systemPrompt: data.system_prompt || '',
                postHistoryInstructions: data.post_history_instructions || '',
                alternateGreetings: data.alternate_greetings || [],
                creator: data.creator || '',
                characterVersion: data.character_version || '',
                creatorNotes: data.creator_notes || data.creatorcomment || '',
                createData: cardData.create_date || '',
            },
            isCustom: true,
            createdAt: Date.now(),
        };
        
        return role;
    }

    /**
     * 一站式：解析 PNG 文件并映射为角色数据
     * @param {File} file
     * @returns {Promise<Object>} 角色数据
     */
    async function importCard(file) {
        if (!file || !file.name.toLowerCase().endsWith('.png')) {
            throw new Error('请选择 PNG 格式的人物卡文件');
        }
        
        const cardData = await parseCard(file);
        const role = await mapCardToRole(cardData, file);
        
        return role;
    }

    /**
     * 获取卡片的预览信息（不完整映射，用于导入前预览）
     * @param {File} file
     * @returns {Promise<Object>} 预览信息
     */
    async function previewCard(file) {
        const cardData = await parseCard(file);
        const data = cardData.data || {};
        const charName = data.name || cardData.name || '未命名角色';
        
        // character_book 统计
        let charbookInfo = null;
        if (data.character_book && data.character_book.entries) {
            const entries = data.character_book.entries;
            charbookInfo = {
                total: entries.length,
                constant: entries.filter(e => e.constant).length,
                keyed: entries.filter(e => e.keys && e.keys.length > 0).length,
                totalContentChars: entries.reduce((sum, e) => sum + (e.content || '').length, 0),
            };
        }
        
        return {
            name: charName,
            description: (data.description || '').substring(0, 200),
            hasScenario: !!data.scenario,
            hasFirstMes: !!data.first_mes,
            hasMesExample: !!data.mes_example,
            hasSystemPrompt: !!data.system_prompt,
            hasPostHistory: !!data.post_history_instructions,
            tags: data.tags || [],
            charbookInfo: charbookInfo,
            greetingCount: 1 + (data.alternate_greetings || []).length,
            spec: cardData.spec || 'chara_card_v2',
            specVersion: cardData.spec_version || '2.0',
            creator: data.creator || '',
            imageUrl: await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('FileReader 读取失败'));
                reader.readAsDataURL(file);
            }),
        };
    }

    // 公开 API
    return {
        parseCard,
        mapCardToRole,
        importCard,
        previewCard,
        replaceTemplateVars,
    };
})();

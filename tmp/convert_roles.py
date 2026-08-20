#!/usr/bin/env python3
"""
将 tmp/roles/ 目录下的 8 个新角色转换为 roles-data.js 格式，
替换旧的 63 个角色。
"""
import os
import json
import re

ROLES_DIR = r'D:\Work\AI_Web\AI_Chat\tmp\roles'
OUTPUT_FILE = r'D:\Work\AI_Web\AI_Chat\js\roles-data.js'

# 读取所有 .md 文件
md_files = sorted([f for f in os.listdir(ROLES_DIR) if f.endswith('.md')])
print(f"Found {len(md_files)} role files: {md_files}")

def parse_role_md(filepath):
    """解析 Markdown 文件，提取 description, systemPrompt, first_mes"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取标题（第一行）
    title_line = content.split('\n')[0].strip().lstrip('# ')
    name = title_line.split(' — ')[0].strip()
    subtitle = title_line.split(' — ')[1].strip() if ' — ' in title_line else ''
    
    # 提取描述部分（## 角色描述 到 ## System Prompt 之间）
    desc_match = re.search(r'## 角色描述.*?\n\n(.*?)\n\n## System Prompt', content, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else ''
    
    # 提取 systemPrompt 部分
    sys_match = re.search(r'## System Prompt.*?\n\n(.*?)\n\n## 开场白', content, re.DOTALL)
    system_prompt = sys_match.group(1).strip() if sys_match else ''
    
    # 提取开场白部分
    opener_match = re.search(r'## 开场白.*?\n\n(.*?)$', content, re.DOTALL)
    first_mes = opener_match.group(1).strip() if opener_match else ''
    
    return {
        'name': name,
        'subtitle': subtitle,
        'description': description,
        'system_prompt': system_prompt,
        'first_mes': first_mes,
    }

roles = []
for md_file in md_files:
    filepath = os.path.join(ROLES_DIR, md_file)
    role_data = parse_role_md(filepath)
    roles.append(role_data)
    print(f"Parsed: {role_data['name']} - desc:{len(role_data['description'])} chars, sys:{len(role_data['system_prompt'])} chars, opener:{len(role_data['first_mes'])} chars")

# 生成新的 roles-data.js
lines = []
lines.append('// ==================== 角色数据（全新重写版）====================')
lines.append('// 基于 SillyTavern 角色卡质量标准重新设计')
lines.append('// 每个角色包含：详细人设 + 独特互动机制 + 沉浸式开场白')
lines.append('const ROLES_DATA = [')

for i, role in enumerate(roles):
    is_male = any(kw in role['subtitle'] for kw in ['军师', '医生', '将军', '佣兵'])
    gender_tag = '男性向' if is_male else '女性向'
    
    # 根据副标题生成标签
    tags = [gender_tag]
    if '腹黑' in role['subtitle']: tags.extend(['腹黑', '权谋', '慢热'])
    elif '禁欲' in role['subtitle']: tags.extend(['禁欲', '医生', '权力反转'])
    elif '战损' in role['subtitle']: tags.extend(['军旅', '囚徒', '权力反转'])
    elif '赛博' in role['subtitle']: tags.extend(['赛博朋克', '佣兵', '义体'])
    elif '失忆' in role['subtitle']: tags.extend(['杀手', '失忆', '双面人设'])
    elif '魅魔' in role['subtitle']: tags.extend(['异世界', '魅魔', '混血'])
    elif '破产' in role['subtitle']: tags.extend(['豪门', '落难', '复仇'])
    elif '精灵' in role['subtitle']: tags.extend(['奇幻', '学者', '禁忌知识'])
    
    emoji_map = {
        '沉渊': '♟️', '傅言深': '🩺', '赫连烬': '⚔️', '萨林·布莱克': '🤖',
        '芷烟': '🥀', '铃音': '🦋', '宁晚棠': '🌹', '艾薇拉·星芒': '✨'
    }
    emoji = emoji_map.get(role['name'], '⭐')
    
    gradient_map = {
        '蔺沉渊': 'linear-gradient(135deg, #1a1a3e, #2d1b4e)',
        '傅言深': 'linear-gradient(135deg, #1a2e3e, #0a1a2e)',
        '赫连烬': 'linear-gradient(135deg, #3e1a1a, #4e2d1b)',
        '萨林·布莱克': 'linear-gradient(135deg, #0a1a2e, #1a0a3e)',
        '芷烟': 'linear-gradient(135deg, #2e1a1a, #3e1a2e)',
        '铃音': 'linear-gradient(135deg, #2e1a3e, #1a0a3e)',
        '宁晚棠': 'linear-gradient(135deg, #3e1a2e, #2e1a1a)',
        '艾薇拉·星芒': 'linear-gradient(135deg, #1a0a3e, #0a2e3e)',
    }
    gradient = gradient_map.get(role['name'], 'linear-gradient(135deg, #1a1a2e, #2e1a1a)')
    
    # 转义字符串中的特殊字符
    def escape_js_string(s):
        return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\t', '\\t')
    
    lines.append(f'    {{')
    lines.append(f'        id: {i+1}, name: "{role["name"]}", title: "{role["subtitle"]}",')
    lines.append(f'        desc: "{escape_js_string(role["description"][:200])}…",')
    lines.append(f'        rarity: "SSR", isNew: true,')
    lines.append(f'        tags: {json.dumps(tags, ensure_ascii=False)},')
    lines.append(f'        emoji: "{emoji}",')
    lines.append(f'        image: "images/role_{i+1}.jpg",')
    lines.append(f'        gradient: "{gradient}",')
    lines.append(f'        systemPrompt: "{escape_js_string(role["system_prompt"])}",')
    lines.append(f'        scenes: [{{"opener":"{escape_js_string(role["first_mes"][:300])}…","preview":"{escape_js_string(role["first_mes"][:100])}…"}}]')
    lines.append(f'    }},')

lines.append('];')
lines.append('')
lines.append('// 导出')
lines.append('if (typeof module !== "undefined" && module.exports) {')
lines.append('    module.exports = { ROLES_DATA };')
lines.append('}')

output = '\n'.join(lines)
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(output)

print(f"\n✅ Written {len(roles)} roles to {OUTPUT_FILE}")
print(f"Total size: {len(output)} bytes")

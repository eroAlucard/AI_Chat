#!/usr/bin/env python3
"""
批量解析 cards/ 目录下的 PNG 角色卡，提取关键内容用于参考
"""
import struct
import base64
import json
import os
import sys

def extract_chara_chunk(filepath):
    """从 PNG 文件中提取 chara tEXt chunk 的 base64 数据"""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # 验证 PNG 签名
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    
    offset = 8
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset+4])[0]
        chunk_type = data[offset+4:offset+8].decode('ascii', errors='replace')
        
        if chunk_type == 'tEXt':
            chunk_data = data[offset+8:offset+8+length]
            null_pos = chunk_data.index(0)
            keyword = chunk_data[:null_pos].decode('iso-8859-1')
            if keyword == 'chara':
                text_data = chunk_data[null_pos+1:]
                return text_data.decode('iso-8859-1')
        
        offset += 12 + length
        if chunk_type == 'IEND':
            break
    
    return None

def parse_card(filepath):
    """解析 PNG 角色卡，返回角色数据"""
    chara_b64 = extract_chara_chunk(filepath)
    if not chara_b64:
        return None
    
    json_str = base64.b64decode(chara_b64).decode('utf-8')
    card_data = json.loads(json_str)
    data = card_data.get('data', card_data)
    return data

cards_dir = r'D:\Work\AI_Web\AI_Chat\cards'
results = []

for filename in sorted(os.listdir(cards_dir)):
    if not filename.lower().endswith('.png'):
        continue
    
    filepath = os.path.join(cards_dir, filename)
    try:
        data = parse_card(filepath)
        if not data:
            continue
        
        name = data.get('name', '未知')
        desc_len = len(data.get('description', ''))
        personality = data.get('personality', '')
        scenario = data.get('scenario', '')
        first_mes = data.get('first_mes', '')
        first_mes_len = len(first_mes)
        tags = data.get('tags', [])
        system_prompt = data.get('system_prompt', '')
        mes_example = data.get('mes_example', '')
        charbook = data.get('character_book', {})
        charbook_count = len(charbook.get('entries', [])) if charbook else 0
        
        results.append({
            'name': name,
            'desc_len': desc_len,
            'personality': personality[:80] if personality else '',
            'scenario': scenario[:80] if scenario else '',
            'first_mes_preview': first_mes[:150].replace('\n', ' ') if first_mes else '',
            'first_mes_len': first_mes_len,
            'tags': tags,
            'has_system_prompt': bool(system_prompt),
            'has_mes_example': bool(mes_example),
            'charbook_count': charbook_count,
        })
    except Exception as e:
        print(f"ERROR: {filename}: {e}", file=sys.stderr)

# 输出分析结果
for r in results:
    print(f"\n{'='*60}")
    print(f"角色: {r['name']}")
    print(f"描述长度: {r['desc_len']} 字符")
    print(f"性格: {r['personality'] or '(无)'}")
    print(f"场景: {r['scenario'] or '(无)'}")
    print(f"开场白({r['first_mes_len']}字): {r['first_mes_preview']}…")
    print(f"标签: {', '.join(r['tags']) if r['tags'] else '(无)'}")
    print(f"系统提示: {'有' if r['has_system_prompt'] else '无'} | 对话示例: {'有' if r['has_mes_example'] else '无'} | 世界书: {r['charbook_count']}条")

print(f"\n\n总计: {len(results)} 张角色卡")

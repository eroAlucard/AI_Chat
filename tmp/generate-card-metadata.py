#!/usr/bin/env python3
"""
1. 扫描 cards/ 目录所有 PNG（含 MalePOV/FemalePOV 子目录），提取元数据
2. 生成每卡独立详情文件 cards/data/NNN-slug.js（完整数据：first_mes/system_prompt/character_book 等）
   - ID 稳定性：读取旧 cards-index.js，已有卡片保持原 builtin_N ID 与详情文件名，
     新卡追加到末尾分配新 ID（避免中间插入导致旧聊天记录引用的角色错位）
3. 生成轻量索引 cards/cards-index.js（~100KB：id/名称/简介/标签/世界书标志/详情文件路径）
   - 运行时首屏只动态注入索引脚本，详情由 builtin-cards.js 在打开角色/聊天时按需注入
   - 采用 JS 而非 JSON：通过 <script> 标签加载，file:// 双击直开、localhost、Cloudflare 部署全兼容
4. 世界书库：扫描 cards/世界书/*.json（SillyTavern lorebook 导出格式），转换为应用条目格式，
   生成 cards/worldbooks-index.js + cards/worldbooks/*.js，供世界书管理器「导入世界书」使用
5. 更新 manifest.json

注意：不再生成合并大文件（cards-metadata-female/male.json 已废弃并自动删除）；
旧版 JSON 产物（cards-index.json / data/*.json）会自动清理。
"""
import json, os, glob, re, struct, sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

CARDS_DIR = r'D:\Work\AI_Web\AI_Chat\cards'
MANIFEST_PATH = os.path.join(CARDS_DIR, 'manifest.json')

def extract_png_text_chunks(png_path):
    chunks = {}
    try:
        with open(png_path, 'rb') as f:
            f.read(8)
            while True:
                length_bytes = f.read(4)
                if len(length_bytes) < 4:
                    break
                length = struct.unpack('>I', length_bytes)[0]
                chunk_type = f.read(4).decode('ascii', errors='ignore')
                data = f.read(length)
                f.read(4)
                if chunk_type == 'tEXt':
                    null_pos = data.index(b'\x00')
                    key = data[:null_pos].decode('utf-8', errors='ignore')
                    value = data[null_pos+1:].decode('utf-8', errors='ignore')
                    chunks[key] = value
                elif chunk_type == 'iTXt':
                    parts = data.split(b'\x00', 5)
                    if len(parts) >= 6:
                        key = parts[0].decode('utf-8', errors='ignore')
                        value = parts[5].decode('utf-8', errors='ignore')
                        chunks[key] = value
                if chunk_type == 'IEND':
                    break
    except Exception as e:
        print(f"  警告 解析 {os.path.basename(png_path)} 失败: {e}")
    return chunks

def extract_card_metadata(chunks):
    import base64
    chara_json_str = chunks.get('chara', '')
    if not chara_json_str:
        return None
    try:
        chara_data = json.loads(base64.b64decode(chara_json_str).decode('utf-8'))
    except:
        return None
    data = chara_data.get('data', chara_data)
    return {
        'filename': '',
        'name': data.get('name', '未命名角色'),
        'description': data.get('description', ''),
        'first_mes': data.get('first_mes', ''),
        'system_prompt': data.get('system_prompt', ''),
        'scenario': data.get('scenario', ''),
        'personality': data.get('personality', ''),
        'tags': data.get('tags', []),
        'creator': data.get('creator', ''),
        'character_book': data.get('character_book'),
        'post_history_instructions': data.get('post_history_instructions', ''),
        'alternate_greetings': data.get('alternate_greetings', []),
        'spec': chara_data.get('spec', 'chara_card_v2'),
        'spec_version': chara_data.get('spec_version', '2.0'),
    }

# ==================== 1. 扫描并生成 metadata ====================
png_files = sorted(glob.glob(os.path.join(CARDS_DIR, '**', '*.png'), recursive=True))
print(f"找到 {len(png_files)} 张 PNG 卡片")

POV_DIR_MAP = {'malepov': 'male', 'femalepov': 'female'}

metadata_list = []
for i, png_path in enumerate(png_files):
    rel_path = os.path.relpath(png_path, CARDS_DIR).replace('\\', '/')
    print(f"  [{i+1}/{len(png_files)}] 解析 {rel_path}...")
    chunks = extract_png_text_chunks(png_path)
    meta = extract_card_metadata(chunks)
    if meta:
        meta['filename'] = rel_path
        top_dir = rel_path.split('/')[0].lower() if '/' in rel_path else ''
        pov = POV_DIR_MAP.get(top_dir, '')
        meta['pov'] = pov
        meta['tags'] = [t for t in meta['tags'] if t not in ('男性向', '女性向')]
        if pov == 'male':
            meta['tags'].append('男性向')
        elif pov == 'female':
            meta['tags'].append('女性向')
        metadata_list.append(meta)
    else:
        print(f"    警告 无法提取元数据，跳过")

print(f"\n成功提取 {len(metadata_list)} 个角色的元数据")

# ==================== 2. 按 POV 拆分 ====================
female_meta = [m for m in metadata_list if m.get('pov') == 'female']
male_meta = [m for m in metadata_list if m.get('pov') != 'female']

print(f"  FemalePOV: {len(female_meta)} 个")
print(f"  MalePOV:   {len(male_meta)} 个")

# ==================== 3. 生成每卡详情文件 + 轻量索引（JS 格式，兼容 file://） ====================
DATA_DIR = os.path.join(CARDS_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def slugify(filename):
    """MalePOV/1.3.png -> malepov-1-3；【侍奉世界书】v4.1.json -> 侍奉世界书-v4-1；保留中文字符"""
    s = filename.lower()
    s = re.sub(r'\.(png|json)$', '', s)
    s = re.sub(r'[^0-9a-z\u4e00-\u9fff]+', '-', s)
    s = s.strip('-')
    return s[:50] or 'card'

def js_safe(json_str):
    """JSON 是合法的 JS 字面量，但需防止 </script> 截断标签，并转义 U+2028/U+2029"""
    return json_str.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')

def dump_js(obj):
    return js_safe(json.dumps(obj, ensure_ascii=False, separators=(',', ':')))

# ---- ID 稳定性：旧卡保持原 builtin_N ID 与详情文件名，新卡追加到末尾 ----
# 聊天记录通过 builtin_N 引用角色；若按扫描顺序重新编号，新增/删除卡片会使
# 中间位置之后的所有 ID 错位，导致旧会话串角色。因此：
#   1) 解析旧索引，已有卡片（按 filename 识别）沿用旧 id 与旧 data 路径、保持旧顺序
#   2) 新卡片以 female 在前 + male 在后追加，从 max(旧编号)+1 开始分配新 id
old_index = []
INDEX_PATH = os.path.join(CARDS_DIR, 'cards-index.js')
if os.path.exists(INDEX_PATH):
    try:
        with open(INDEX_PATH, 'r', encoding='utf-8') as f:
            idx_content = f.read()
        m = re.search(r'window\.__CARDS_INDEX__\s*=\s*(\[.*\])\s*;?\s*$', idx_content, re.S)
        if m:
            old_index = json.loads(m.group(1))
    except Exception as e:
        print(f"  警告: 旧索引解析失败（{e}），本次按全新生成处理")

old_by_filename = {}
old_pos = {}
max_old_num = -1
for pos, e in enumerate(old_index):
    fn = e.get('filename')
    if fn:
        old_by_filename[fn] = e
        old_pos[fn] = pos
    m2 = re.match(r'builtin_(\d+)$', str(e.get('id', '')))
    if m2:
        max_old_num = max(max_old_num, int(m2.group(1)))

existing_meta = [m for m in metadata_list if m['filename'] in old_by_filename]
new_meta = [m for m in metadata_list if m['filename'] not in old_by_filename]
existing_meta.sort(key=lambda m: old_pos[m['filename']])
new_meta.sort(key=lambda m: (0 if m.get('pov') == 'female' else 1, m['filename']))

ordered = []  # (card_id, data_rel, meta)
for m in existing_meta:
    old_e = old_by_filename[m['filename']]
    data_rel = old_e.get('data', '')
    if not data_rel.endswith('.js'):  # 防御：更早版本的 .json 路径
        num = int(str(old_e['id']).split('_')[1])
        data_rel = f"data/{num:03d}-{slugify(m['filename'])}.js"
    ordered.append((old_e['id'], data_rel, m))
next_num = max_old_num + 1
for m in new_meta:
    card_id = f'builtin_{next_num}'
    ordered.append((card_id, f"data/{next_num:03d}-{slugify(m['filename'])}.js", m))
    next_num += 1

if new_meta:
    print(f"  新增 {len(new_meta)} 张卡（追加到末尾，ID 从 builtin_{max_old_num + 1} 起，旧卡 ID 不变）")

# 清理旧的详情文件（删卡后残留的孤儿文件；重写时按上面规划的文件名落盘）
for pattern in ('*.js', '*.json'):
    for old in glob.glob(os.path.join(DATA_DIR, pattern)):
        os.remove(old)

index_list = []
for card_id, data_rel, meta in ordered:
    with open(os.path.join(DATA_DIR, os.path.basename(data_rel)), 'w', encoding='utf-8') as f:
        f.write(f'/* 自动生成（{meta["filename"]}）请勿手动编辑 */\n')
        f.write('window.__CARDS_DETAILS__ = window.__CARDS_DETAILS__ || {};\n')
        f.write(f'window.__CARDS_DETAILS__[{json.dumps(card_id)}] = {dump_js(meta)};\n')

    book = meta.get('character_book') or {}
    book_entries = [e for e in (book.get('entries') or []) if e.get('content') and str(e.get('content')).strip()]
    greetings = (1 if meta.get('first_mes') else 0) + len([g for g in (meta.get('alternate_greetings') or []) if g and str(g).strip()])
    regex_scripts = meta.get('regex_scripts') or []

    index_list.append({
        'id': card_id,
        'data': data_rel,
        'filename': meta['filename'],
        'name': meta['name'],
        'desc': (meta.get('description') or '')[:200],
        'tags': meta.get('tags') or [],
        'pov': meta.get('pov') or '',
        'creator': meta.get('creator') or '',
        'greetings': greetings,
        'hasBook': len(book_entries) > 0,
        'bookCount': len(book_entries),
        'hasRegex': len(regex_scripts) > 0,
        'regexCount': len(regex_scripts),
    })

index_path = os.path.join(CARDS_DIR, 'cards-index.js')
with open(index_path, 'w', encoding='utf-8') as f:
    f.write('/* 自动生成于 tmp/generate-card-metadata.py 请勿手动编辑 */\n')
    f.write(f'window.__CARDS_INDEX__ = {dump_js(index_list)};\n')

idx_size = os.path.getsize(index_path)
data_size = sum(os.path.getsize(os.path.join(DATA_DIR, f)) for f in os.listdir(DATA_DIR))
print(f"  cards-index.js: {idx_size/1024:.1f} KB ({len(index_list)} 张卡)")
print(f"  data/*.js:      {data_size/(1024*1024):.2f} MiB ({len(index_list)} 个文件)")

# 删除旧的产物（废弃合并大文件 + 上一版 JSON 产物）
for old_name in ['cards-metadata-female.json', 'cards-metadata-male.json', 'cards-index.json']:
    p = os.path.join(CARDS_DIR, old_name)
    if os.path.exists(p):
        os.remove(p)
        print(f"  已删除废弃文件: {old_name}")

# ==================== 4. 世界书库（cards/世界书/*.json → JS 数据文件） ====================
# 源文件为 SillyTavern lorebook 导出格式（entries[].key/comment/disable/order/...），
# 转换为应用的 character_book 条目格式（keys/name/enabled/constant/insertion_order），
# 供世界书管理器「导入世界书」功能按需注入到角色。
WB_SRC_DIR = os.path.join(CARDS_DIR, '世界书')
WB_OUT_DIR = os.path.join(CARDS_DIR, 'worldbooks')
os.makedirs(WB_OUT_DIR, exist_ok=True)

for old in glob.glob(os.path.join(WB_OUT_DIR, '*.js')):
    os.remove(old)

def convert_worldbook_entry(e, idx):
    """SillyTavern lorebook 条目 → 应用 character_book 条目"""
    keys = e.get('key', e.get('keys', []))
    if isinstance(keys, str):
        keys = [keys]
    keys = [str(k).strip() for k in (keys or []) if str(k).strip()]
    if 'disable' in e:
        enabled = not e.get('disable')
    else:
        enabled = e.get('enabled', True)
    return {
        'name': e.get('comment') or e.get('name') or f'条目 {idx + 1}',
        'keys': keys,
        'content': e.get('content', ''),
        'enabled': bool(enabled),
        'constant': bool(e.get('constant', False)),
        'insertion_order': e.get('order', e.get('insertion_order', 100)),
    }

wb_index = []
if os.path.isdir(WB_SRC_DIR):
    for i, wb_path in enumerate(sorted(glob.glob(os.path.join(WB_SRC_DIR, '*.json')))):
        fname = os.path.basename(wb_path)
        try:
            with open(wb_path, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except Exception as e:
            print(f"  警告: 世界书 {fname} 解析失败，跳过: {e}")
            continue
        entries_raw = raw.get('entries') or []
        if isinstance(entries_raw, dict):  # 部分导出格式的 entries 是对象而非数组
            entries_raw = list(entries_raw.values())
        entries = [convert_worldbook_entry(e, idx) for idx, e in enumerate(entries_raw)]
        entries = [e for e in entries if e['content'] and e['content'].strip()]
        wb_id = f'wb_{i}'
        wb_name = re.sub(r'\.json$', '', fname, flags=re.I)
        slug = f"{i:03d}-{slugify(fname)}"
        data_rel = f"worldbooks/{slug}.js"
        with open(os.path.join(WB_OUT_DIR, slug + '.js'), 'w', encoding='utf-8') as f:
            f.write(f'/* 自动生成（世界书/{fname}）请勿手动编辑 */\n')
            f.write('window.__WORLDBOOKS_DETAILS__ = window.__WORLDBOOKS_DETAILS__ || {};\n')
            f.write(f'window.__WORLDBOOKS_DETAILS__[{json.dumps(wb_id)}] = '
                    f'{dump_js({"id": wb_id, "name": wb_name, "entries": entries})};\n')
        const_count = sum(1 for e in entries if e['constant'] or not e['keys'])
        wb_index.append({
            'id': wb_id,
            'name': wb_name,
            'data': data_rel,
            'entries': len(entries),
            'constant': const_count,
            'trigger': len(entries) - const_count,
        })
        print(f"  世界书: {wb_name} → {len(entries)} 条（常驻 {const_count} / 触发 {len(entries) - const_count}）")
else:
    print("  未找到 cards/世界书/ 目录，跳过世界书库生成")

wb_index_path = os.path.join(CARDS_DIR, 'worldbooks-index.js')
with open(wb_index_path, 'w', encoding='utf-8') as f:
    f.write('/* 自动生成于 tmp/generate-card-metadata.py 请勿手动编辑 */\n')
    f.write(f'window.__WORLDBOOKS_INDEX__ = {dump_js(wb_index)};\n')
print(f"  worldbooks-index.js: {len(wb_index)} 本世界书")

# ==================== 5. 更新 manifest.json ====================
manifest = {
    "version": 1,
    "description": "内置 SillyTavern PNG 人物卡",
    "cards": [os.path.relpath(f, CARDS_DIR).replace('\\', '/') for f in png_files]
}
with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print(f"已更新: {MANIFEST_PATH} ({len(manifest['cards'])} 张)")

print(f"\n全部完成！")
print(f"  - 索引: cards-index.js ({len(index_list)} 张卡)")
print(f"  - 详情: cards/data/*.js ({len(index_list)} 个文件)")
print(f"  - 世界书: worldbooks-index.js ({len(wb_index)} 本) + worldbooks/*.js")
print(f"  - manifest.json: {len(manifest['cards'])} 张")

# AI Web 项目开发文档

> 最后更新：2026-08-18 | 项目路径：`D:\Work\AI_Web\AI_Chat`

## 一、项目概述

Web 端 AI 成人聊天软件，参考小程序"香草 AI | 我的賽博後宮"原型截图开发。纯前端 SPA，深色主题，移动端优先（max-width: 480px）。私人使用，无充值/金币系统。

**技术栈**：HTML + CSS + JavaScript（无框架），LocalStorage 持久化，LM Studio API（兼容 OpenAI 格式）

**LM Studio 地址**：`http://localhost:1234`（本地）或 Cloudflare Tunnel URL（公网）

---

## 〇、公网部署指南（Cloudflare Pages + Tunnel）

### 前置条件
- GitHub 仓库：`https://github.com/eroAlucard/AI_Chat`
- Cloudflare Pages 已部署（静态网站）
- LM Studio 已安装并加载模型

### 步骤1：网页已部署到 Cloudflare Pages
网页通过 GitHub 仓库自动部署，推送代码后 Cloudflare 自动构建。

### 步骤2：安装 cloudflared（在运行 LM Studio 的电脑上）

**Windows（推荐 winget）：**
```cmd
winget install Cloudflare.cloudflared
```

**或下载便携版：**
```powershell
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
```

**Mac：**
```bash
brew install cloudflared
```

**Linux：**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
```

### 步骤3：确认 LM Studio 在运行

打开浏览器访问 `http://localhost:1234/v1/models`，应返回模型列表 JSON。

### 步骤4：启动 Cloudflare Tunnel

打开 CMD / PowerShell / Terminal，运行：
```cmd
cloudflared tunnel --url http://localhost:1234
```

等待几秒，输出类似：
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:                                         |
|  https://xxxx-xxxx-xxxx.trycloudflare.com                                                 |
+--------------------------------------------------------------------------------------------+
```

**复制这个 URL**，这是你的 LM Studio 公网地址。

> ⚠️ Tunnel 窗口必须保持打开，关闭则公网访问断开
> ⚠️ 每次重启 Tunnel 会生成新的 URL，需要在网页设置中更新

### 步骤5：配置网页 API 地址

1. 打开 AI Chat 网页
2. 输入登录密码
3. 点击底部"我的" → 设置
4. **API 地址**：粘贴 Tunnel URL（如 `https://xxxx-xxxx-xxxx.trycloudflare.com`），不带末尾斜杠
5. 点击保存

### 步骤6：验证

在聊天界面发送消息，如果 AI 正常回复则配置成功。

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| cloudflared 运行无输出 | 网络无法连接 Cloudflare 服务器（如公司内网拦截） | 换到非受限网络环境运行 |
| API 调用报 CORS 错误 | LM Studio 未开启 CORS | 在 LM Studio 设置中开启 CORS |
| Tunnel URL 失效 | Tunnel 窗口被关闭或网络中断 | 重新启动 cloudflared，获取新 URL |
| 密码错误 | 首次访问需输入登录密码 | 密码在 `js/app.js` 的 `ACCESS_PASSWORD` 常量中 |

---

## 二、项目结构

```
D:\Work\AI_Web\
├── index.html              # 单页应用主文件（306行）
├── css/style.css           # 深色主题样式系统（519行）
├── js/app.js               # 主逻辑：导航/筛选/搜索/角色详情/收藏/设置（519行）
├── js/chat.js              # 聊天逻辑：消息/API调用/流式输出/菜单/删除（610行）
├── js/roles-data.js        # 角色数据：63个角色 + 筛选映射（602行）
├── server.js               # Node.js CORS 代理 + 静态文件服务（112行）
├── 小程序原型参考/          # 参考截图（IMG_4212~4231，共16张）
└── tmp/                     # 临时脚本（语法检查等，可忽略）
```

**总代码量**：约 2668 行

---

## 三、已完成功能

### 3.1 首页
- 角色卡片网格展示（2列）
- 分类标签：猜你喜欢 / 热门 / 最新
- 筛选弹窗：4个分组（受众/关系/人设/题材剧情），共35个标签
- 搜索功能：实时过滤角色名/描述
- 角色稀有度标识（R/SR/SSR）

### 3.2 筛选系统（核心，已修复）
- **筛选逻辑**：分组内 OR，分组间 AND
- **关键约束**：
  - HTML `data-value` 必须与角色 `tags` 值完全一致（中文）
  - HTML `data-group` 必须与 `ROLE_TAG_FILTER_MAP` 分组名一致
  - **男性向/女性向是父标签**（audience分组），每个角色必须归属其中之一
- 筛选标签点击后立即调用 `renderRoleGrid()` 刷新

### 3.3 角色详情
- 点击角色卡片弹出详情面板（max-height: 60vh，可滚动）
- 显示：名称、标签、作者、热度、描述
- **玩法规则区域**：自动解析 systemPrompt 中的 `【标题】` 格式，渲染为可读的规则卡片
- 收藏按钮、开始对话按钮

### 3.4 聊天功能
- 消息列表、对话界面
- **流式 API 调用（SSE）**：逐字输出 + typing 动画
- 非流式 fallback
- 本地 fallback 回复（8个角色有专属回复池）
- **聊天菜单**（点击 `⋯` 按钮）：
  - 删除此对话：删除整个会话
  - 清空聊天记录：保留会话但清空消息
  - 删除模式：逐条删除消息（每条消息出现红色 ✕ 按钮）

### 3.5 个人中心
- 用户信息展示
- 收藏列表（网格展示）
- 设置面板：API 地址/模型/温度/最大回复长度/系统提示词

### 3.6 CORS 代理
- `server.js`：Node.js 服务器，端口 3000
- `/api/*` → LM Studio 代理（支持流式转发）
- 静态文件服务
- 如果 LM Studio 开启了 CORS，可直接从浏览器调用

---

## 四、数据结构

### 4.1 角色数据格式（roles-data.js）

```javascript
{
    id: 1,                    // 唯一ID
    name: "凌朔",             // 角色名
    title: "冷艳的美少女",     // 简短标题
    desc: "凌朔外表冷淡...",   // 详情描述
    rarity: "SR",             // 稀有度：R / SR / SSR
    isNew: true,              // 是否新角色
    tags: ["男性向", "高冷", "反差"],  // 标签数组，第一个必须是"男性向"或"女性向"
    author: "@Nadia Bany",    // 创作者
    heat: "55k",              // 热度
    emoji: "🧊",              // 头像emoji
    gradient: "linear-gradient(135deg, #1a1a3e, #2d1b4e)",  // 背景渐变
    systemPrompt: "你是凌朔..."  // 完整人设提示词，含【标题】格式的玩法规则
}
```

### 4.2 筛选标签映射

```javascript
FILTER_LABELS = {
    audience:   ["男性向", "女性向"],
    relation:   ["妈妈", "妹妹", "姐姐", "母子", "人妻", "青梅竹马", "后宫", "百合"],
    personality: ["熟女", "御姐", "处女", "仙子", "魅魔", "女S", "男娘", "傲娇", "高冷", "反差", "爆乳"],
    theme:      ["调教", "乱伦", "绿帽", "NTR", "NTL", "逆NTR", "羞辱", "恶堕", "催眠", "精神控制", "隐奸", "强迫", "纯爱", "救赎"]
};

ROLE_TAG_FILTER_MAP = {
    "男性向": "audience", "女性向": "audience",
    "妈妈": "relation", "妹妹": "relation", ...  // 每个标签值 → 分组名
};
```

### 4.3 AppState（LocalStorage 持久化）

```javascript
AppState = {
    currentPage: 'home',
    currentChat: null,           // 当前聊天角色ID
    chatSessions: {},            // { roleId: { roleId, messages[], lastTime } }
    collections: new Set(),      // 收藏的角色ID集合
    filters: {},                 // { groupName: Set(values) }
    searchQuery: '',
    settings: {
        apiUrl: 'http://30.178.33.14:1234',
        modelName: '',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: ''
    }
};
```

---

## 五、CSS 设计系统

### 5.1 变量体系

| 类别 | 变量 | 值 |
|------|------|----|
| 背景色 | `--bg-primary` | `#0a0a0f` |
| | `--bg-secondary` | `#12121a` |
| | `--bg-card` | `#1a1a28` |
| | `--bg-input` | `#1e1e2e` |
| 文字色 | `--text-primary` | `#e8e8f0` |
| | `--text-secondary` | `#9898b0` |
| | `--text-muted` | `#686880` |
| 强调色 | `--accent-purple` | `#8b5cf6` |
| | `--accent-pink` | `#ec4899` |
| | `--accent-gradient` | `linear-gradient(135deg, #8b5cf6, #ec4899)` |
| 稀有度 | `--rarity-r` | `#a0a0b8` |
| | `--rarity-sr` | `#f0b040` |
| | `--rarity-ssr` | 彩虹渐变 |

### 5.2 布局约束
- 移动端优先，`max-width: 480px`，居中显示
- 底部导航栏 4 个 tab：首页/聊天/绘图/我的
- 角色详情面板：`max-height: 60vh`，可滚动
- 筛选弹窗：底部弹出式，`max-height: 70vh`

---

## 六、角色统计

| 分类 | 数量 | 说明 |
|------|------|------|
| 总计 | 63 | |
| 男性向 | 47 | 原有角色为主 |
| 女性向 | 16 | 借鉴乙游人设（恋与制作人/光与夜之恋/未定事件簿等） |

### 女性向角色列表（id 47-62）
- 沈夜（冷面霸总）、周弈（阳光偶像）、白凛（特警守护）、许渊（天才科学家）
- 夏彦（温柔律师）、萧逸（赛车手）、陆景和（音乐天才）、莫弈（画家）
- 齐司礼（千年狐仙）、查理苏（天才医生）、左然（检察官）、子轩（钢琴家）
- 霍凛（军人）、温言（学长）、夜澜（暗夜王子）、暖阳（温柔霸总）

---

## 七、API 调用流程

```
浏览器 → fetch POST → LM Studio /v1/chat/completions
                     ↓ (stream: true)
              SSE 逐字输出 → 实时渲染到聊天气泡
                     ↓ (stream: false)
              JSON 响应 → 直接显示

如果 CORS 阻止：
浏览器 → fetch POST → server.js:3000/api/v1/chat/completions
                     → 代理转发 → LM Studio:1234/v1/chat/completions
```

请求体格式（兼容 OpenAI）：
```json
{
    "model": "可选，留空用默认",
    "messages": [
        {"role": "system", "content": "角色systemPrompt"},
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."}
    ],
    "temperature": 0.7,
    "max_tokens": 2048,
    "stream": true
}
```

---

## 八、关键函数索引

### app.js
| 函数 | 说明 |
|------|------|
| `loadState()` / `saveState()` | LocalStorage 读写 |
| `switchPage(page)` | 页面切换（home/chat/draw/mine） |
| `initFilterModal()` | 筛选弹窗事件绑定 |
| `getFilteredRoles()` | 核心筛选逻辑：分组内OR，分组间AND |
| `renderRoleGrid()` | 渲染角色卡片网格 |
| `openRoleDetail(roleId)` | 打开角色详情面板 |
| `parseSystemPromptRules()` | 解析 systemPrompt 中【标题】格式的玩法规则 |
| `toggleCollect(roleId)` | 收藏切换 |
| `initSettings()` / `openSettings()` | 设置面板 |

### chat.js
| 函数 | 说明 |
|------|------|
| `initChatView()` | 聊天界面初始化（含菜单按钮） |
| `startChat(roleId)` | 开始/继续聊天 |
| `renderMessages(roleId)` | 渲染消息列表 |
| `sendMessage()` | 发送消息 + API调用 |
| `callLMApi(role, messages, useStream)` | LM Studio API 调用 |
| `readStreamResponse(response, role)` | SSE 流式读取 |
| `getFallbackReply(role, userMessage)` | 本地 fallback 回复 |
| `toggleChatMenu()` | 聊天菜单（删除对话/清空记录/删除模式） |
| `deleteMessage(index)` | 删除单条消息 |
| `renderChatList()` | 聊天列表渲染 |

---

## 九、待开发/可改进

### 高优先级
1. **绘图页**：当前仅占位，需开发 AI 绘图功能
2. **角色详情页增强**：参考原型截图，增加"角色相册"、"多开场场景选择"
3. **更多女性向角色**：当前16个，可继续扩充（乙游/GB向/病娇向等）
4. **聊天记忆优化**：长对话时截断早期消息，避免 token 超限

### 中优先级
5. **角色卡片封面图**：当前用 emoji + 渐变背景，可替换为真实图片
6. **消息长按菜单**：复制/转发/回复引用
7. **角色详情页多开场**：部分角色支持选择不同开场剧情
8. **好感度系统 UI**：在聊天界面显示当前好感度数值
9. **聊天背景自定义**：每个角色可设置不同聊天背景

### 低优先级
10. **消息撤回**：发送后短时间内可撤回
11. **角色排序**：按热度/最新/收藏数排序
12. **数据导出**：导出聊天记录为文本
13. **PWA 支持**：离线缓存、添加到主屏幕

---

## 十、踩坑记录

1. **筛选标签对照关系**：HTML `data-value` 用英文（`male`），角色 `tags` 用中文（`男性向`），永远匹配不上。已修复为统一中文。
2. **分组名不一致**：HTML 用 `persona`/`genre`，JS 用 `personality`/`theme`。已统一为后者。
3. **roles-data.js 写入截断**：文件极长，必须分段 `append=true` 写入，每段约150行以内。
4. **const 在 eval 中无法提升**：用 `new Function()` 包装验证，而非直接 `eval()`。
5. **流式响应解析**：SSE 格式需按 `\n` 分行，处理 `data: [DONE]` 结束标记。
6. **男性向/女性向父标签**：每个角色的 `tags[0]` 必须是"男性向"或"女性向"，否则筛选时 audience 分组无法匹配。

---

## 十一、运行方式

```bash
# 方式1：直接打开（需 LM Studio 开启 CORS）
# 浏览器打开 index.html

# 方式2：通过代理服务器（推荐）
cd D:\Work\AI_Web
node server.js
# 浏览器打开 http://localhost:3000
# 设置中 API 地址填：http://localhost:3000/api
```

---

## 十二、原型参考

`小程序原型参考/` 目录下有 16 张截图（IMG_4212~4231），展示了参考小程序的：
- 首页角色卡片布局
- 筛选标签分组
- 角色详情页（创作者备注、标签、相册、热度/收藏）
- 高质量角色卡设计模式（详细开场、好感度阶段、特殊玩法）
- 多开场场景选择

开发新功能时建议先查看这些截图获取设计灵感。

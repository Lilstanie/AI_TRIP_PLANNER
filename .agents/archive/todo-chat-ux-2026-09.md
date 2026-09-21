# 待办：聊天输入、语言与工作区

执行清单。基线 `2c445258`。行号会漂移，**以函数名为准**。

原本有 5 项 + 1 项未排期。现在 **3 项已完成、1 项已砍、1 项待做**。

| # | 项 | 状态 | 落点 |
| - | -- | ---- | ---- |
| 1 | 日期输入放宽 | ✅ PR [#20](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/20)（**待合并**） | 见下 |
| 2 | 货币与地区格式化 | ❌ **已砍** | 见「已砍」 |
| 3 | 侧边栏 ⋮ 菜单 | ✅ PR #18 | `workspace-ui.md:35-38` |
| 4 | New chat 重复点击 | ✅ 已合入 | `workspace-ui.md:64-67` |
| 5 | Agent 输出语言 | ⬜ **唯一待做** | 本节 |
| — | 界面 i18n | ⬜ 未排期（有意） | 见「未排期」 |

已完成的 1、3、4 项的结论均已并入 `architecture.md` / `workspace-ui.md`，因此本文不再复述叙事。

---

## 1. 待做：Agent 输出语言

### 现状：语言是三个独立问题，机制不能混

| 层 | 现状 | 证据 |
| -- | ---- | ---- |
| **A. 对话回复** | ✅ 已做对 | `chat.ts` `replyPrompt` 已含 `Detect the language of the traveler's latest message and reply in that exact same language` |
| **B. 计划内容**（卡片 `summary`/`detail`、HITL checkpoint） | ❌ 英文硬编码 | 5 个 specialist 的 `systemPrompt` 无语言指令；确定性兜底约 **48 处**英文拼装 |
| **C. 界面文案** | ❌ 无 i18n | 见「未排期」 |

所以 Language 弹窗那句 `You can chat in your preferred language` 目前**只对回复成立，对计划内容不成立**。

### 为什么只能靠模型，不能靠字典

计划内容是模型生成的，文案空间无限。唯一正确做法是让模型用目标语言输出。

### 契约：加 `locale`，但**不进 `TripBrief`**

`locale` 是请求级偏好，必须传给服务端。`ChatRequest`（`shared/src/chat.ts`）在 PR #20 里刚新增了
可选 `known`，**先例已建立**，再加一个可选 `locale` 是同一模式。

| 设计 | 做法 | 取舍 |
| ---- | ---- | ---- |
| 1. 服务端从消息推测语言 | 复用 `replyPrompt` 的检测思路 | `shared` 零改动，但**没有真正的设置**——用户设了中文却用英文提问就变英文 |
| 2. 显式传 `locale` | `ChatRequest` 加可选字段 | 动 `shared`，但只是新增可选字段，不碰 `TripBrief` / `estCost` / `pricePerNightUsd` |

**推荐 2 + 1 兜底**：传了 `locale` 用它，没传（旧客户端）回退到消息语言检测。

### 改动清单

| 文件 | 改动 |
| ---- | ---- |
| `shared/src/chat.ts` | `ChatRequest` 加可选 `locale`（如 `z.enum(["en","zh"]).optional()`） |
| `apps/web/components/Workspace.tsx` | 发 `/api/chat` 时带上 `PanelLayout.locale` |
| `apps/web/app/api/chat/route.ts` | 校验通过后转交 `runTripChat` |
| `orchestrator/src/chat.ts` | `TripChatOptions` / `runTripChat` 接收并透传 |
| `orchestrator/src/workflow.ts` | `OrchestratorOptions` 加可选 `locale`，传入 `AgentContext` 或 prompt 构造 |
| `agents/src/{itinerary,destination-guide,dining,transport,accommodation}/index.ts` | `systemPrompt` 注入「Output all traveler-facing text in {language}」 |
| `orchestrator/src/supervisor.ts:162`、`:202` | 同上 |
| `orchestrator/src/chat.ts` `replyPrompt` | **保留**现有检测；传了 `locale` 时改为「用 {language} 回复」 |

### 必须记录的限制

无 API key 或模型失败时走确定性兜底，那约 48 处文案仍是英文。这是**可接受的降级**，写进
`architecture.md`，否则会被当 bug 反复排查。

### 检查

- 传 `locale` 后 specialist / `replyPrompt` 含目标语言指令；不传时行为不变
- `ChatRequest` 不带 `locale` 仍校验通过（向后兼容）
- `Workspace` 请求体带上当前 `locale`
- **不要**引入真实模型调用
- `TripBrief`、`estCost` 规则、`pricePerNightUsd` 零改动

---

## 已砍：货币与地区格式化

原计划：14 个 `money()` 调用点 + packages 里 24 处 `USD ` 文案 + 约 20 条服务端
`summary`/`detail` 必须去掉单位（否则同一张卡片显示 `¥10,800` 而 detail 写 `USD 1480.00`）+
currency 透传进 6 个组件 + catalog schema 版本化。

**砍掉理由**：这是一个**显示偏好**，而产品当前是**单用户**（README Scope 与
`workspace-ui.md` 的 Out of scope 都已写明）。成本是大型机械改动，收益接近零。原本给 i18n 写的
「收益/成本比最低，纯机械劳动」逐字适用于它，而且它更糟——多一个服务端文案自相矛盾的问题。

**何时重新考虑**：出现多用户/多币种需求，或用户明确抱怨无法按本币看预算时。届时方案见本节原始
记录（已被本次重写删除，可从 git 历史 `2c445258:docs/todo-chat-ux.md` 取回）。

---

## 未排期：界面 i18n

**建议先不做。** 理由与将来要做时的方案记在这里，避免重新调研。

### 为什么不现在做

- 纯机械劳动；产品是单用户
- Agent 输出语言（第 1 项）能带来实际价值（中文用户拿到中文计划），界面 i18n 只是换按钮文字

### 规模（已实测）

| 项 | 数量 |
| -- | ---- |
| JSX 正文文案 | 43 |
| `aria-label` / `title` / `placeholder` | 25 |
| 现有 i18n 依赖 | **0** |

### 方案：手写字典，不引 next-intl

```ts
// apps/web/lib/i18n.ts
export const messages = {
  en: { newChat: "New chat" /* ... */ },
  zh: { newChat: "新对话" /* ... */ },
} as const;
export type Locale = keyof typeof messages;
```

- **不要路由**：语言是设置项不是 URL 段，不需要 `/en/`、`/zh/`。next-intl 的价值在路由、
  pluralization、规模化日期本地化，这里都用不上
- 2 个语言约 70 个 key → 手写约 60 行，`keyof` 保证类型安全，**零依赖**
- `locale` 存进 `PanelLayout`，与货币同一个模式

### ⚠️ 必须提前决定：113 处测试按英文无障碍名查询

`apps/web/components/*.test.tsx` 里有 **113 处** `getByRole("button", { name: "New chat" })` 这类查询。

| 方案 | 评价 |
| ---- | ---- |
| **(a) 测试固定 `locale: "en"`** | ✅ **推荐**：改 1 处 setup，113 处不动 |
| (b) 测试也走 `t()` | 更真实但改动不成比例 |
| (c) 改用 `data-testid` | ❌ 削弱 a11y 测试价值 |

### 容易漏的地方

- `WorkspaceSidebar.tsx` 的 `aria-label="Language: English"` 与侧边栏 `EN` 标签都是硬编码
- `Workspace.tsx` 的 Language 弹窗要从占位文案变成真正的选择器，并删掉
  `interface translation is not available yet`

---

## 全局约定

- **`packages/shared` 的变更分两类**：第 1 项的 `ChatRequest.locale` 是**新增可选字段**（请求契约，
  风险低，但要在 `docs/api.md` 记录并知会团队）；`TripBrief` / `estCost` /
  `pricePerNightUsd` 是冻结契约，**任何一项都不许动**
- **`locale` 与货币相互独立**：不要从语言推导货币（中文界面 + 美元预算完全合理）——若将来重启货币项
- 每个分支跑通 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- `apps/web` 的 test 脚本是 `NODE_OPTIONS=... vitest run`，POSIX 语法，Windows 需 WSL / Git Bash
- 第 1 项落地后，本文件只剩「未排期」一节，应移入 `docs/archive/`，并把语言层的结论并入
  `architecture.md`

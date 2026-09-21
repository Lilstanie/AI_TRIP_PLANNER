# 待办：Agent 层与对话层硬化

执行清单。行号会漂移，**以函数名为准**。
范围：`packages/agents`、`packages/orchestrator`、`packages/tools`、`apps/web`。

本文件经过一次 ponytail 审查（梯子 + 已读代码）。被砍掉的方案列在末节，附「何时加回」条件。
**最后更新 2026-09-20**，基线 `4b2f7c9`。§1、§2、§5、§7 已完成，§3 暂缓，§4 已取消。
只剩 §6。

## 已完成

| 项                              | 落地于               | 做法                                                                 |
| ------------------------------- | -------------------- | -------------------------------------------------------------------- |
| itinerary 的 40% 限额不再手写   | `5c510f2`            | prompt 插值 `${MODEL_ACTIVITY_BUDGET_SHARE * 100}`，漂移结构上不可能 |
| **§1 对话意图改为 tool choice** | `e02780d`            | 见下节的完成记录                                                     |
| **币种：AUD 基准 + 入口折算**   | `ba5e81e`、`175a1cf` | 不在原清单里，见 §7                                                  |
| **§5 supervisor 漏选不报错**    | `2c4188d`            | `DEFAULT_REQUIRED_AGENTS`，缺失即抛；workflow 回落到全量派发         |
| **§7 汇率填入**                 | `2c4188d`            | 两位有效数字的约数，注释写明不是报价                                 |
| **§2 模型承重**                 | `4b2f7c9`            | 见下节的完成记录                                                     |

### §1 完成记录（2026-09-20）

`chat.ts` 436 → 332 行，硬约束达成。`REQUIRED_START_FIELDS`、`followUpPrompt`、
`incompleteBriefError`、`createReplyGenerator`、`replyPrompt`、`ModelPatchSchema`、
`extractionPrompt`、`createModelExtractor` 全部删除；正则兜底移入 `chat-offline.ts`，
patch 形状移入 `brief.ts`（不拆会与 `chat.ts` 形成循环导入）。

**三处偏离原方案，都是刻意的：**

| 偏离                                                           | 原因                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2 个 tool 而非 3 个**，砍掉 `answer_question`                | agent 的最终消息本身就是回答，多一个只回显文本的 tool 白费一次往返                                                                                                                                                  |
| **`shared/src/chat.ts` 非零改动**：`ChatRequest` 加可选 `plan` | 原方案要求「纯提问返回当前 plan」，但服务端是无状态的、手里没有 plan，而 `readPlanStream` 要求每个 `complete` 帧都带 plan。加一个可选字段是唯一同时满足「提问只花 1 次模型调用」与「`readPlanStream` 零改动」的做法 |
| 新增 `brief.ts`                                                | 避免 `chat.ts` ↔ `chat-offline.ts` 循环导入                                                                                                                                                                         |

**必须记住的坑**：tool schema **不能含 `z.preprocess`**。LangChain 要把它序列化成 JSON Schema
发给 provider，transform 表示不了，整个工具不可用 —— 而 `FakeToolCallingModel` 从不做这步序列化，
所以 15 个单测会全绿、真实调用一调就挂。现在 wire schema 保持宽松可序列化，严格校验放进 tool body，
并有 `z.toJSONSchema(BriefUpdate)` 的断言钉住。

**四个缺陷已对真实 DeepSeek 逐条验证消除**：日期歧义规则误杀 `10.6-10.9`、抽取时硬传
`undefined` 丢上下文、schema 拒绝字符串 `"null"` 后静默回落、正则把 `3000 人民币` 读成 3000 人。

**已知软肋**：空白会话先发 `10.6-10.9`、再发 `10月6日到10月9日`，agent 确认了日期含义但未记入
brief，连同缺失的目的地再问一轮。会收敛，多花一轮。有完整上下文时正常。

### §2 完成记录（2026-09-20）

两个 specialist 都改成「搜索 → 交出候选（带 id 与真实数值）→ 模型选 → 代码组装」。选择 schema 里
**没有任何金额字段**，幻觉出的价格无处落地 —— 比「让它编出来再丢弃」结构上更严密。

删掉的启发式：J3（靠 carrier 名含 `flex` 选航班）、J1（按行程长度均分定 hop 日期）、J2（恒定
09:00）、J6（`rating>=8 && freeCancellation ?? options[0]` 选酒店）。J4/J5 保留 —— summary 模板与
revision 正则仍在确定性路径上，模型只覆盖其中的「选择」部分。

**整份选择先解析完再使用**：半懂的回答整体回落，不会把模型对甲城的选择与启发式对乙城的选择混起来。

**无 key 路径按构造不变**：gather / assemble 是从原 builder 里拆出来的，确定性选择器就是原来那段代码。

**活体探针抓到、假模型抓不到的**：hop 被改派到别的日期后，detail 里仍打印搜索时的日期。已修。

**已知近似**：day 与 startTime 是路由查询的**输入**，所以搜索用确定性默认值、模型之后重排。mock 与
OSRM 的时长不随出发时刻变化，真实公交 provider 会变 —— 这是「搜索后再排期」的代价，已写进注释。

**conflicts.ts 的决策**：维持「撞上 itinerary 就只让 itinerary 改」。以前 transport 恒定 09:00 不会
主动撞，现在会，所以这条非对称规则已写进注释并由 `workflow.test.ts` 的两条测试锁定。改成对称会让
双方互相避让，在 `maxRounds` 内震荡。

## 要做的

| #   | 项                          | 类型             | 分支                         | 依赖            |
| --- | --------------------------- | ---------------- | ---------------------------- | --------------- |
| 6   | 4 个 agent 的降级不告诉用户 | 真 bug（不一致） | `fix/degraded-visibility`    | 无              |
| 3   | 天气能力                    | 用户请求的功能   | `feature/weather-capability` | 需先定 provider |

§3 按用户决策**暂缓**（2026-09-20：要接 Google 的 API，先不做）。§6 独立且很小。

## 已取消

| #   | 项                 | 取消原因                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | 对话 prompt 注入面 | **用户决策（2026-09-20）：现阶段一律不考虑安全问题。** 另外它点名的三处位置（`extractionPrompt`、`replyPrompt`、`followUpPrompt`）与 `createReplyGenerator` 直调 `model.invoke(prompt)` 的路径，已在 §1 中全部删除；现在指令走 `systemPrompt`，用户消息与历史各自是独立 message，结构上本就分离。真要重启，剩下的只是补一条断言测试 |

---

## 1. 对话意图：tool choice，不是枚举 ✅ 已完成（`e02780d`）

完成记录与三处刻意偏离见本文件开头的「§1 完成记录」。原始设计方案与两次失败尝试的分析
（63 行正则、`intent` 枚举分类）保留在 git 历史 `175a1cf~1:docs/todo-agent-hardening.md`。

## 2. transport / accommodation：模型做裁量 ✅ 已完成（`4b2f7c9`）

完成记录见开头的「§2 完成记录」。下面是执行时依据的原始分析，保留作为背景。

产品前提（已确定）：5 个 agent 共同规划，每个都要有真实贡献。所以是**让模型输出承重**，不是删调用。

### 现状

| 位置                         | 现状                                               |
| ---------------------------- | -------------------------------------------------- |
| `transport/index.ts:239`     | `return evidence` —— 模型输出 100% 被丢弃          |
| `accommodation/index.ts:192` | 只采纳 `summary` / `assumptions` / `conflictsWith` |

病根不是「模型没用」，是 **calculator 把本该模型做的判断写成了启发式**：

| #   | 硬编码裁决            | 位置                                                                                         | 为什么是判断                 |
| --- | --------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| J1  | 航段落在第几天        | `transport:62`、`:64` `Math.floor((days*(i+1))/destinations.length)+1`                       | 纯比例均分，与行程无关       |
| J2  | 出发时刻              | `:57`、`:70` `scheduleRevision ? "06:00" : "09:00"`                                          | 恒 09:00，夜车/早班不考虑    |
| J3  | 选哪个航班            | `:119` `/flex/i.test(carrier) ?? [0]`                                                        | 靠 carrier 名里有没有 "flex" |
| J4  | summary / assumptions | `:175`、`:177-184`                                                                           | 模板串 + 五条一字不差        |
| J5  | revision 想干什么     | `:52-54` 两个正则                                                                            | 猜意图                       |
| J6  | 选哪家酒店            | `accommodation/planning.ts:111` `find(o => o.rating>=8 && o.freeCancellation) ?? options[0]` | 占位启发式                   |

### 方案：模型输出「引用」，calculator 输出「数值」

**关键性质：模型 schema 里没有金额字段，只能引用 id。** 结构上无法编造价格——比现在
「先让它编、再丢弃」更严密。且契约早已支持：`StaySelection` 有 `selectedId` + `candidates`
（`contracts.ts`），`ProposalItem.id` 是可选字段，accommodation 现在就在发 `stay-1-0`
（`accommodation/index.ts:120-126`）。

**1 个 tool，不是 2 个**（梯子第 6 级：现有已是 1 个）：

```
tool  search_transport_evidence              → 候选事实（带 id + 真实数值）
model responseFormat                         → { flightId, assignments[{legId, day, startTime}], summary, guidance[] }
      重新充实（~15 行，读 evidence 取价）    → items + 合计 + 可行性校验
```

校验：`day ∈ [1…days]`、每条 leg 恰好分配一次、单日 ≤ 1440 分钟、id 必须存在。失败 → 一次
corrective → 再失败走既有 `buildTransportProposal` 兜底（**无 key 时的行为与今天逐字段一致**，这是回归基线）。

### 改动清单

| 文件                               | 位置                                                             | 改动                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `transport/index.ts`               | `:189-245`                                                       | `calculate_transport_options` 改为返回候选+id；`:216` `responseFormat` 改为无金额的 `TransportSelection`；`:239` 改为组装 |
| 同上                               | `:52-54`、`:57`、`:62`、`:64`、`:70`、`:119`、`:175`、`:177-184` | 删除 J1–J5，改为模型输入                                                                                                  |
| 同上                               | `:212`、`:216`                                                   | `createAgent` 保留；`systemPrompt` 重写为「模型拥有哪 4 项裁量 + 禁止输出金额、必须引用 id」                              |
| `accommodation/index.ts`           | `:165-192`                                                       | `responseFormat` 增加 `selectedId`；`:192` 用模型选的 id 从 `options` 取回，不再覆盖回 `evidence.items`                   |
| `transport/model-boundary.test.ts` | `:1-82`                                                          | 语义升级：从「模型篡改被丢弃」改为「模型**无法注入金额**」                                                                |
| `orchestrator/src/conflicts.ts`    | `:54-58`                                                         | **需决策**，见下                                                                                                          |

### 需先决策：冲突策略偏袒 itinerary

```ts
// conflicts.ts:54-58
const targets =
  left.agent === "itinerary" || right.agent === "itinerary"
    ? (["itinerary"] as const) // ← 只要撞上 itinerary，永远只让 itinerary 改
    : ([left.agent, right.agent] as const);
```

今天无害（transport 时刻硬编码 09:00，不会主动撞）。**把 day/时刻交给模型后就会被触发。**
推荐**维持偏向**（航班比活动刚性），但**必须加一条测试锁定语义**，否则以后有人「顺手修对称性」
就会引入 `maxRounds=3` 内的震荡。

### 检查

- 模型返回不存在的 `legId` / `flightId` → 回落，不产生零价 item
- 模型 payload 带金额 → schema 拒绝（`TransportSelection` 无该字段）
- `day > planningDays`、同一 `legId` 分配两天 → 拒绝
- accommodation：模型选 `selectedId` → `estCost` 等于该候选的 `stayCost(...)`
- 无 key 时 5 个 agent 输出与改动前逐字段一致

---

## 3. 天气能力 ⏸ 暂缓（需先定 provider）

用户请求的功能。**不是单纯加 API——它会推翻一条现有护栏**，所以单列。

### 现状：天气被硬写成「只能是月度背景」

| 位置                             | 内容                                                  |
| -------------------------------- | ----------------------------------------------------- |
| `destination-guide/index.ts:140` | `Treat weather as monthly context, never a forecast.` |
| 同上 `:61`                       | `travelMonth()`，注释 `(not a weather forecast)`      |
| 同上 `:110`、`:221`              | 兜底文案 + 兜底 assumption 均声明「不是预报」         |

今天这条是对的（没数据源就不能声称预报）。接入后它变成过度保守：用户问「下周去东京要带伞吗」，
模型被 prompt 禁止回答。**四处必须一起改**，否则有数据时给预报、无数据时说「不是预报」，自相矛盾。

### 设计：按距出发天数分流

| 距出发  | 能说什么                                  | 数据源                 |
| ------- | ----------------------------------------- | ---------------------- |
| ≤ 14 天 | **预报**，带 `observedAt` / `validUntil`  | Weather provider       |
| > 14 天 | **气候常态**（多年平均），不得叫 forecast | Climate/historical API |

与现有 freshness 纪律一致（`contracts.ts:142` 的 `AgentProposal.source.freshness`）。

### 实现：一个文件，不是两个

`packages/tools/src/maps.ts:12-13` 的既有模式是**同文件内分支**：

```ts
const mockEnabled = () => process.env.USE_MOCK_TOOLS !== "false";
const provider = () => process.env.MAPS_PROVIDER || (process.env.MAPS_API_KEY ? "google" : "osm");
```

所以 weather 也应是 `packages/tools/src/weather.ts` **一个文件**，内含 mock fixture 与真实 provider 分支。
建 `weather.mock.ts` 是照搬一个**本项目不存在**的模式。

| 文件                                        | 改动                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `shared/src/ports.ts:70`                    | `ToolGateway` 增 `weather: WeatherPort` —— **这是本文件唯一必需的 `packages/shared` 改动，1 行** |
| `tools/src/weather.ts`                      | 新增。内部分支：`USE_MOCK_TOOLS` → fixture；否则 provider                                        |
| `tools/src/gateway.ts:10-21`                | `createToolGateway` 接入 weather                                                                 |
| `agents/src/destination-guide/index.ts:140` | `never a forecast` → 「≤14 天可给预报须标时效；更长只给气候常态」                                |
| 同上 `:61`                                  | `travelMonth()` 旁增 `daysUntil(date)` 分流                                                      |
| 同上 `:110`、`:221`                         | 有 provider 时改为带时效的表述；无 provider 保留现文案                                           |
| 同上                                        | 新增 `read_weather_evidence` tool，与 `read_destination_evidence` 并列                           |
| `.env.example`                              | 新增 `WEATHER_PROVIDER` / 对应 key                                                               |

**provider 选型未定，需核对**：Google Maps Platform 的 Weather API（与现有 `MAPS_API_KEY` 同套鉴权，
但**确切产品名、字段与定价需对着官方文档核对**）vs Open-Meteo（免费、无需 key、有 forecast +
climate 两套 API）。建议沿用地图双轨：有 Google key 用之，否则 Open-Meteo。

### 检查

- fixture 在 `daysUntil` 5 与 60 下分别返回 forecast / climate
- 距出发 60 天时 items **不含** forecast 字样
- provider 抛错 → 回退到今天行为，不报错
- **护栏回归**：断言 prompt 不再含 `never a forecast`（否则 W2 又被推翻）
- `USE_MOCK_TOOLS` 默认时**不发起网络请求**

---

## 4. 对话 prompt 注入面 ❌ 已取消

**用户决策（2026-09-20）：现阶段一律不考虑安全问题。** 原方案见 git 历史
`175a1cf~1:docs/todo-agent-hardening.md`。

§1 完成后这一项的大半已不复存在：它点名的三处拼接位置和 `createReplyGenerator` 直调
`model.invoke(prompt)` 的路径都随重构删除了，现在指令走 `systemPrompt`、用户消息与历史各自是
独立 message。真要重启，剩下的只是补一条「用户消息不进指令字符串」的结构断言。

## 5. supervisor 漏选不报错 ✅ 已完成（`2c4188d`）

`supervisor.ts:178` 只校验「至少选了一个」：

```ts
if (proposals.size === 0)
  throw new Error("Supervisor completed without delegating to a specialist.");
```

prompt（`:163`）只说 `consider day planning, inter-city transport, ...`。模型选 3 个就返回，
**不报错**，plan 会平静地少两个 section。

改动：把「至少一个」升级为「覆盖 `requiredAgents`（默认 `["itinerary"]`）」，缺失即抛。

**不做**：`{selected, total}` 度量指标。它回答的是「该不该留 supervisor 这层」，而 §6 的日志本来就会
顺带回答。为回答一个待定问题而埋点，是把问题变成代码。

**检查**：fake supervisor 只调 1 个非 itinerary tool → 抛错；调了 itinerary → 通过。

---

## 6. 4 个 agent 的降级不告诉用户（真 bug：不一致）

| agent             | 降级时                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| itinerary         | ✅ `assumptions` 含 `"Planner source: deterministic fallback..."`（`:314`） |
| transport         | ❌ 只 `console.warn`（`:244`）                                              |
| accommodation     | ❌ 只 `console.warn`（`:195`）                                              |
| destination-guide | ❌ 只 `console.warn`（`:191`）                                              |
| dining            | ❌ 只 `console.warn`（`:246`）                                              |

**复用 `itinerary` 已建立的模式**：降级时往 `assumptions` 推一条用户可读的说明。一行一个 agent，
零契约改动，零 UI 改动。

**不做**：`plan.degraded` 字段、UI 角标、`BaseCallbackHandler` 遥测框架、`AGENT_TRACE` 开关。
用户可见性由 `assumptions` 解决（itinerary 已经这么做了）；结构化日志是另一件事，等真的需要排查时再加。

**检查**：对每个 agent 各注入一次失败的 generator，断言 `assumptions` 里出现降级说明。

---

## 7. 币种：AUD 基准 ✅ 已完成

不在原清单里。起因是页面单位写 USD、而用户输入人民币。

### 已完成（`ba5e81e`、`175a1cf`）

| 决策                                  | 结果                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| 四个币种 AUD（默认）/ CNY / USD / JPY | `shared/src/money.ts`                                                          |
| **静态**汇率，不接实时                | `AUD_PER` + `RATES_AS_OF`                                                      |
| 入口折算，内部恒为 AUD                | 折算在 `update_trip_brief` 的 tool body 内，用 `toAud()`                       |
| 币种仅由聊天自然语言识别              | 不加表单下拉，不加全局切换                                                     |
| 标识符改中性名                        | `pricePerNightUsd`→`pricePerNight`、`priceUsd`→`price`、`sumUsd`→`sumMoney` 等 |
| 旧快照接受失效                        | snapshot→v3、catalog→v4，**干净拒绝**不迁移                                    |
| mock 价格不动                         | 见下「虚构经济」                                                               |

**设计上最重要的一条**：`update_trip_brief` 的 schema 里**没有「已折算金额」字段**。模型只能报出
币种枚举，折算由代码完成。模型权重里的汇率是陈旧知识，会静默污染 `overrunPct` 与 itinerary 的
40% 活动预算上限且无处报错 —— schema 让幻觉出的折算结果无处落地。

### 虚构经济必须整体平移

demo 预算（4000）、mock 供应商价格（房价 100/240、机票 310/420、路线 90）、以及 dining /
itinerary 的支出常量（75 / 50 / 30），**要么一起改，要么都不动**。

原计划要把三个支出常量按 ×1.5 重定价。实测后撤回：只给一边重定价会让 demo 从「round 2 干净收敛」
退化成「round 3 触发升级」—— 预算和 mock 价格保持原数字改读作 AUD（购买力缩水 1.5 倍），
支出常量却上调 1.5 倍，两头对冲成 2.25 倍挤压。理由已写在 `dining/index.ts` 的常量注释里。

**已知后果**：用户说「3000 人民币」得到 A$630 预算，两人三天对着未缩放的 mock 价格会频繁超支、
频繁触发 HITL 升级。行为正确（那个预算确实紧），已是明确决策。

### 汇率（`2c4188d`）

`AUD_PER` 现在是 `CNY 0.21 / USD 1.5 / JPY 0.01`。**这些是约数，不是在 `RATES_AS_OF` 当天对着
市场核过的报价** —— 刻意只给两位有效数字，免得看起来比实际精确。够用来估一次假期预算，别拿它做
别的。`RATES_AS_OF` 显得旧了、或者某次折算的结果旅行者会说不对，就该复核。

测试**从汇率表推导**换算结果，不写死乘积：复核汇率不该表现为测试失败，那只会训练人把数字改到
变绿为止。另有一条数量级测试兜住「推导测不出来」的情形——汇率写反了也满足它自己的算术。

---

## 被砍掉的（及何时加回）

| 原方案                                             | 砍掉的理由                                                  | 加回条件                         |
| -------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| §1 抽 `prompts/` 目录（5 文件 + index + 插值函数） | 为复用 3 句重复文案建 7 个文件。重复 3 句比一个共享模块便宜 | 重复段超过 8 处，或需要多语言时  |
| §1 全量 prompt 快照 digest                         | 让每次改 prompt 都要人工确认                                | 出现一次 prompt 静默回归事故后   |
| §4 `CHAT_TEMPERATURE` env + 范围校验               | 没人要这个配置项                                            | 有人真的需要按环境调温度         |
| §4 `chat` task key 独立选模型                      | （保留 key，它顺带白得）                                    | —                                |
| §5 E2 progress event 新类型（改 shared）           | 为一条警告消息改共享契约                                    | 前端真的需要展示「正在重新规划」 |
| §6 `plan.degraded` + UI 角标                       | 产品需求，不是硬化需求；`assumptions` 已解决可见性          | 产品要求角标时（进 roadmap）     |
| §6 遥测框架 / `AGENT_TRACE`                        | 7 个降级点配一整套框架。先要日志，再要框架                  | 需要跨请求追踪或接 LangSmith 时  |
| §7 C3 `createAgent` 复用                           | 要改 tool 的输入注入方式，是行为变更不是重构，且收益未量测  | profiler 证明构造耗时占比 >10%   |
| §10 `weather.mock.ts` 独立文件                     | 本项目模式是**同文件内分支**（`maps.ts:12-13`）             | —                                |
| §10 `TravelSelection` 新建 schema                  | `estCost` 本就是 optional，模型 payload 不带它即可          | —                                |

**关于 `packages/shared`**：唯一必要的改动是 §3 的 `ToolGateway` 增一个 `weather` 成员（1 行）。
其余三条（progress event、`plan.degraded`、`ChatResponse.plan` 可选）都已消除。按
`team-workflow.md`，改 `ports.ts` 仍需知会团队并在 `docs/api.md` 记录，但这是**遵既有 port 模式**
（`ports.ts` 头部即写明「agents depend only on the interface」），不是新增抽象。

## 全局约定

- **§2 是行为变更，不是等价重构**：验证双向——无 key 时逐字段一致（回归基线）；有 key 时证明模型的
  选择进入了 `items`（人为让模型选非启发式项，断言结果跟随）
- **不要再试第三次枚举**（§1 已犯过两次：63 行正则、`intent` 分类）
- **§3 改 `never a forecast` 必须同时改 `:110`、`:221`**，否则用户看到自相矛盾
- **§3 provider 选型需先核对官方文档**，本文不对 Google Weather API 的名称/定价做断言
- 每项都要留下**一个可运行的检查**（见各节「检查」）。不引入框架与 fixture
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 四项 CI 门禁

### 从 §1 / §7 学到的，适用于后续每一项

- **tool schema 不能含 `z.preprocess` 或任何 transform**。LangChain 要序列化成 JSON Schema 发给
  provider，表示不了就整个工具不可用。宽松 wire schema + tool body 内严格校验
- **`FakeToolCallingModel` 不序列化 schema，也不产生真实回复**（它的最终消息是前序消息用 `-` 连接）。
  它能验证 tool loop 的编排，**证伪不了 prompt 行为和 schema 兼容性**。§2、§3 都动 prompt 与
  responseFormat，**必须补一次真实模型手测**
- **改虚构经济的任一个数字前，先看它和另外两组的耦合**（见 §7）
- 动持久化 schema 字段名前先查它在不在 `TripPlan` 里 —— 在的话就是一次 storage 版本升位

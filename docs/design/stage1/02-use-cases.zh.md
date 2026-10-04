<a id="2-use-cases"></a>

# 2. 用例

[English](02-use-cases.md) | 中文

<a id="21-overall-use-case-diagram"></a>

## 2.1 总体用例图

组级用例图见 [`../diagrams/use-case-diagram.svg`](../diagrams/use-case-diagram.svg)。
参与者：**Traveler**（主参与者），以及三个外部系统：**Maps / Routes API**（Google、OpenStreetMap）、**Hotel / Flight Search**（SerpApi、Google Places）和 **Weather API**（Google、Open-Meteo）。

| 用例 | 负责人 | 关系 |
| --- | --- | --- |
| Set Preferences (Filter) | E | — |
| Submit Requirement (Chat) | E | — |
| Generate Itinerary | A | «include» Arrange Transportation、Arrange Accommodation、Manage Budget |
| Edit Itinerary (Timeline / Map) | E | «extend» Generate Itinerary [旅行者编辑计划] |
| Arrange Transportation | B | «include» Maps / Routes API |
| Arrange Accommodation (Individual / Group) | C | «include» Hotel / Flight Search |
| Manage Budget | C | «extend» Edit Itinerary [重新检查路线和预算] |
| View Weather-based Clothing Recommendation | D | «include» Weather API |
| View Food / Cuisine Recommendation | D | — |
| View Itinerary Output | E | «alternative» Timeline / Map |

<a id="22-use-case-specifications-member-c"></a>

## 2.2 用例规格：成员 C

<a id="uc-c1-arrange-accommodation"></a>

### UC-C1 Arrange Accommodation

| 字段 | 内容 |
| --- | --- |
| **编号 / 名称** | UC-C1 Arrange Accommodation (Individual / Group) |
| **来源** | AH-C1；R-C1、R-C2、R-C3、R-C7、R-C9、R-C10 |
| **主参与者** | Traveler |
| **次参与者** | Hotel / Flight Search（SerpApi Google Hotels、Google Places）、Orchestrator（系统角色） |
| **目标** | 行程的每一晚都有住处，既符合旅行者的分房和品质规则，又放得进交通之后剩下的钱。 |
| **触发** | 规划看板上 Transport 完成后，Orchestrator 的 `dispatch_specialists` 节点委派给 Accommodation agent。 |
| **前置条件** | 1. 存在有效的 `TripBrief`（目的地、每个城市至少一晚的日期、`groupSize` ≥ 1、`budgetTotal`）。2. Transport 的提案已在看板上，因此可以算出住宿分配额。 |
| **后置条件（成功）** | 看板上有一份 `accommodation` 的 `AgentProposal`，每个城市一个 `StaySelection`，带费用、`floorCost`（最便宜的合格总价）和数据来源标签。 |
| **后置条件（失败）** | 没有提案；运行停止，并指明失败的是住宿 specialist。不会编造住处。 |

**主成功场景**

1. Orchestrator 调用 Accommodation agent，传入行程需求、看板和住宿分配额（交通之后剩余预算的 40%）。
2. Agent 读取旅行者的住宿偏好：分房方式、最低评分、免费取消。
3. Agent 计算房间数：*individual* 每位住客一间，*shared* 为 ⌈住客数 / 2⌉。
4. Agent 按 Transport 安排的城市间换乘，把行程拆成每个城市的住宿段。
5. 对每个住宿段，agent 通过预订端口搜索该城市、该日期的住处。
6. Agent 去掉格式错误和不符合偏好的候选，其余按价格从低到高排序。
7. 模型为每个住宿段选一个候选 id，对照分配额权衡评分、取消政策和总价。
8. Agent 用候选列表校验所选结果，并以“房间数 × 晚数 × 每晚价格”按分计价。
9. Agent 把最便宜的合格总价记为 `floorCost`，把提案交回看板。
10. Orchestrator 把住宿区段纳入冲突检测（UC-C2）。

**扩展**

- 2a. *旅行者已经订好住处*（设置了 `bookedStay`）：agent 原样返回该住处，不定价，`floorCost` 为 0，并跳过步骤 3–9。
- 4a. *Transport 没有可用的换乘安排*：晚数在各城市间平均分配，多出的晚数给靠前的城市。
- 5a. *实时搜索不可用*：改用 Google Places 估算，提案标为“estimated”，并写明失败的数据提供方。
- 6a. *没有候选通过筛选*：agent 抛出错误，运行停止；不会放宽已确认的偏好。
- 7a. *没有配置模型，或模型返回未知 id 或不符合 schema 的输出*：确定性规则在分配额内选评分 ≥ 8 且可免费取消的最便宜候选（否则选最便宜的），标为“Local fallback”。
- 7b. *首选超出分配额*：改选分配额内最好的住处，都放不下就选最便宜的，并在提案中说明原因。
- *任一步骤*。*收到修订请求*（来自 UC-C2）：见 UC-C2 第 6 步。

**特殊需求**：R-C8（按分计算）、R-C9（不编造酒店）、R-C10（回退）。

<a id="uc-c2-manage-budget"></a>

### UC-C2 Manage Budget

| 字段 | 内容 |
| --- | --- |
| **编号 / 名称** | UC-C2 Manage Budget |
| **来源** | AH-C1；R-C4、R-C5、R-C6、R-C11 |
| **主参与者** | Traveler |
| **次参与者** | Orchestrator，以及五个 specialist agent |
| **目标** | 旅行者拿到的计划在预算之内，或者明确说出差多少。 |
| **触发** | 所有被派出的 specialist 都已把提案放上看板（`detect_conflicts`），或旅行者编辑了计划。 |
| **前置条件** | `budgetTotal` ≥ AUD 0.01；至少存在一个提案。 |
| **后置条件（成功）** | `TripPlan.estTotal` ≤ `budgetTotal`；不再有预算冲突。 |
| **后置条件（部分成功）** | 返回找到的最低总价的计划；仍被修订请求指向的每个区段标为 `needs_you`，`conflicts` 列出剩下的问题。 |

**主成功场景**

1. Orchestrator 以澳分为单位汇总每个提案的条目费用，并计算 `overrunPct`。
2. 总价在预算之内：不产生预算冲突。
3. Orchestrator 构建计划，把每个区段标为 `draft`，连同 `estTotal` 和 `overrunPct` 一起返回。

**扩展**

- 2a. *总价超出预算，但各区段底价之和放得下*：
  1. Orchestrator 计算每个区段可削减的空间（其费用减去 `floorCost`）。
  2. 把超支按比例分摊到这些区段，为每个区段生成一个带 `targetSaving` 的 `RevisionRequest`。
  3. Orchestrator 只对这些 agent 运行 `revise_conflicts`，给每个 agent 它上一版的提案和新的分配额（上次费用减去应省金额）。
  4. 住宿在预算修订时保留已确认的偏好，在新的分配额内选最便宜的合格住处。
  5. Orchestrator 重新检测，计算规划评分（超出预算的澳元数 + 每个其他冲突计预算的 10%）。
  6. 评分改善：保留这一轮，回到主场景第 1 步。评分没有改善：丢弃这一轮，转到 2c。
- 2b. *各区段底价之和已经超出预算*：Orchestrator 产生一个写明最低金额的 `infeasible budget` 冲突，停止修订，回复中告诉旅行者把预算提高到至少这个金额，或者更改日期、出发地或目的地。
- 2c. *达到三轮，或没有改善*：返回目前最好的计划；仍被指向的区段为 `needs_you`。
- *旅行者编辑计划*：在编辑器里重新核算费用，任何未定价的改动都会显示 `price_unverified` 问题。

**特殊需求**：R-C8；超支百分比不经四舍五入直接比较。

<a id="23-use-case-specifications-member-a"></a>

## 2.3 用例规格：成员 A

<a id="uc-a1-generate-itinerary"></a>

### UC-A1 Generate Itinerary

| 字段 | 内容 |
| --- | --- |
| **编号 / 名称** | UC-A1 Generate Itinerary |
| **来源** | AH-A1；R-A1 … R-A12 |
| **主参与者** | Traveler |
| **次参与者** | 作为协调器、supervisor 和回复撰写者的 LLM（DeepSeek）；五个专家代理；经由专家访问的 Maps / Routes、Hotel / Flight Search 与 Weather API |
| **目标** | 一条自由文本消息变成一份已校验、自洽的 `TripPlan`，或者变成一句关于"还缺什么 / 为何办不到"的明话。 |
| **触发** | 旅行者向 `POST /api/chat` 发送一条聊天消息。 |
| **前置条件** | 消息非空，或带有附件。此外别无要求：摘要里缺失的事实正是这个用例要解决的东西。 |
| **后置条件（成功）** | 存在一份 `TripPlan`，含五个区块，各为 `draft` 或 `needs_you`，已算出 `estTotal` 与 `overrunPct`，回复指明旅行者仍需决定什么。每一项带价的条目都来自某个专家的证据。 |
| **后置条件（部分）** | 返回 `needs_info` 或 `ask_user` 帧，附上目前已理解的事实，不编造计划。 |
| **后置条件（失败）** | 返回指名失败专家的错误帧。不会把残缺的东西当作计划呈现。 |

**主成功场景**

1. 协调器把这条消息并到此前回合已陈述的事实（`known`）之上。
2. LLM 读取合并后的上下文，调用 `update_trip_brief`，只填这条消息陈述过的事实。
3. 协调器经 `BriefPatchSchema` 校验该 patch，用 `applyBriefPatch` 应用，并把结果解析为 `TripBrief`；日期必须真实且有序，每座城市至少一晚。
4. 协调器用已校验的摘要启动 LangGraph 工作流。
5. `dispatch_specialists` 询问 supervisor 该调用哪些专家；supervisor 为每个专家写一句具体目标，点明它必须遵守的出行事实。
6. 每个专家规划自己的区块，并把 `AgentProposal` 贴到分阶段的规划看板上；工作过程中每个专家各推送一条进度事件到浏览器。
7. `detect_conflicts` 汇总费用并收集每份提案的冲突（成员 C 的 `detectConflicts`）。
8. 没有冲突残留：`build_plan` 组装计划，把每个区块标为 `draft`。
9. 协调器构建计划摘要，LLM 据此撰写回复，最终帧同时带上回复与计划。

**扩展**

- 2a. *未配置模型，或输出不合 schema*：不应用任何 patch；该回合以已陈述的事实继续，回复由 `fallbackReplyFor` 写出（R-A11）。
- 3a. *仍缺必填事实*（目的地、日期、人数或预算）：该回合以 `IncompleteBriefError` 结束并指明缺失字段，同时带回 `known`，使旅行者无需重复其余内容。不取任何默认值（R-A2）。
- 3b. *日期不真实、前后颠倒，或短于"每城一晚"*：摘要连同原因一起被拒，规划不会启动。
- 3c. *旅行者陈述了长期偏好、某段交通方式或已订住宿*：记录到摘要上（`learnedPreferences`、`legModes`、`bookedStay`），并据此重新规划。
- 4a. *旅行者问的问题现有计划已能回答*：协调器直接从计划作答，不重新规划。
- 5a. *协调器宁可问也不猜*：调用 `ask_user_question`，给 2–4 个用旅行者语言书写的选项、推荐项在前，该回合就此结束；其后不再运行任何工具（R-A3）。
- 5b. *supervisor 不可用或输出不合 schema*：确定性地派发全部五个专家；行程专家永不被跳过（R-A11）。
- 6a. *某个专家抛出异常*：运行中止，错误帧指名该专家；不返回残缺计划。
- 7a. *仍有冲突、还剩轮次，且都不是 `infeasible budget`*：`revise_conflicts` 只重新调用被定向的专家，各自带上它上一轮的提案和可能的 `targetSaving`，随后回到第 7 步（R-A6）。
- 7b. *修订后 `planScore` 没有改善*：丢弃该轮，保留此前的提案，置 `stalled` 并转到第 8 步 —— 一次修订永远不会让计划变差（R-A7）。
- 7c. *已跑满三轮且仍有冲突*：照常构建计划，仍被定向的区块标为 `needs_you`，`conflicts` 列出未解决的部分（R-A9）。
- 7d. *`infeasible budget`*：整个修订循环被跳过，回复写明所需的最低预算（见成员 C 的 UC-C2 扩展 2b）。

**特殊需求**：R-A10（模型提出的改动在触发任何规划前都会被重新校验）、R-A11（每个 LLM 步骤都有确定性回退）、R-A12（上述行为会在 `agent-lab` 中于注入故障下被重放）。

<a id="24-template-for-the-other-members"></a>

## 2.4 其他成员的模板

每人至少复制一份写一个用例；全组共需 5–10 个。

| 字段 | 内容 |
| --- | --- |
| **编号 / 名称** | |
| **来源** | 你的 AH-x 和 R-x 编号 |
| **主参与者** | |
| **次参与者** | |
| **目标** | |
| **触发** | |
| **前置条件** | |
| **后置条件（成功 / 失败）** | |

**主成功场景**：编号步骤。

**扩展**：`<step><letter>. <condition>: <steps>`。

**特殊需求**：适用的非功能需求。

从现有用例图中建议的用例：A，Generate Itinerary；B，Arrange Transportation；D，View Weather-based Clothing Recommendation；E，Edit Itinerary (Timeline / Map)。

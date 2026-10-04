<a id="2-use-cases"></a>

# 2. 用例

[English](02-use-cases.md) | 中文

<a id="21-overall-use-case-diagram"></a>

## 2.1 总体用例图

组级用例图见 [`../diagrams/use-case-diagram.svg`](../diagrams/use-case-diagram.svg)。
参与者：**Traveler**（主参与者），以及三个外部系统：**Maps / Routes API**（Google、OpenStreetMap）、**Hotel / Flight Search**（SerpApi、Google Places）和 **Weather API**（Google、Open-Meteo）。

| 用例                                       | 负责人 | 关系                                                                   |
| ------------------------------------------ | ------ | ---------------------------------------------------------------------- |
| Set Preferences (Filter)                   | E      | —                                                                      |
| Submit Requirement (Chat)                  | E      | —                                                                      |
| Generate Itinerary                         | A      | «include» Arrange Transportation、Arrange Accommodation、Manage Budget |
| Edit Itinerary (Timeline / Map)            | E      | «extend» Generate Itinerary [旅行者编辑计划]                           |
| Arrange Transportation                     | B      | «include» Maps / Routes API                                            |
| Arrange Accommodation (Individual / Group) | C      | «include» Hotel / Flight Search                                        |
| Manage Budget                              | C      | «extend» Edit Itinerary [重新检查路线和预算]                           |
| View Weather-based Clothing Recommendation | D      | «include» Weather API                                                  |
| View Food / Cuisine Recommendation         | D      | —                                                                      |
| View Itinerary Output                      | E      | «alternative» Timeline / Map                                           |

<a id="22-use-case-specifications-member-c"></a>

## 2.2 用例规格：成员 C

<a id="uc-c1-arrange-accommodation"></a>

### UC-C1 Arrange Accommodation

| 字段                 | 内容                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **编号 / 名称**      | UC-C1 Arrange Accommodation (Individual / Group)                                                                                                     |
| **来源**             | AH-C1；R-C1、R-C2、R-C3、R-C7、R-C9、R-C10                                                                                                           |
| **主参与者**         | Traveler                                                                                                                                             |
| **次参与者**         | Hotel / Flight Search（SerpApi Google Hotels、Google Places）、Orchestrator（系统角色）                                                              |
| **目标**             | 行程的每一晚都有住处，既符合旅行者的分房和品质规则，又放得进交通之后剩下的钱。                                                                       |
| **触发**             | 规划看板上 Transport 完成后，Orchestrator 的 `dispatch_specialists` 节点委派给 Accommodation agent。                                                 |
| **前置条件**         | 1. 存在有效的 `TripBrief`（目的地、每个城市至少一晚的日期、`groupSize` ≥ 1、`budgetTotal`）。2. Transport 的提案已在看板上，因此可以算出住宿分配额。 |
| **后置条件（成功）** | 看板上有一份 `accommodation` 的 `AgentProposal`，每个城市一个 `StaySelection`，带费用、`floorCost`（最便宜的合格总价）和数据来源标签。               |
| **后置条件（失败）** | 没有提案；运行停止，并指明失败的是住宿 specialist。不会编造住处。                                                                                    |

**主成功场景**

1. Orchestrator 调用 Accommodation agent，传入行程需求、看板和住宿分配额（交通之后剩余预算的 40%）。
2. Agent 读取旅行者的住宿偏好：分房方式、最低评分、免费取消。
3. Agent 计算房间数：_individual_ 每位住客一间，_shared_ 为 ⌈住客数 / 2⌉。
4. Agent 按 Transport 安排的城市间换乘，把行程拆成每个城市的住宿段。
5. 对每个住宿段，agent 通过预订端口搜索该城市、该日期的住处。
6. Agent 去掉格式错误和不符合偏好的候选，其余按价格从低到高排序。
7. 模型为每个住宿段选一个候选 id，对照分配额权衡评分、取消政策和总价。
8. Agent 用候选列表校验所选结果，并以“房间数 × 晚数 × 每晚价格”按分计价。
9. Agent 把最便宜的合格总价记为 `floorCost`，把提案交回看板。
10. Orchestrator 把住宿区段纳入冲突检测（UC-C2）。

**扩展**

- 2a. _旅行者已经订好住处_（设置了 `bookedStay`）：agent 原样返回该住处，不定价，`floorCost` 为 0，并跳过步骤 3–9。
- 4a. _Transport 没有可用的换乘安排_：晚数在各城市间平均分配，多出的晚数给靠前的城市。
- 5a. _实时搜索不可用_：改用 Google Places 估算，提案标为“estimated”，并写明失败的数据提供方。
- 6a. _没有候选通过筛选_：agent 抛出错误，运行停止；不会放宽已确认的偏好。
- 7a. _没有配置模型，或模型返回未知 id 或不符合 schema 的输出_：确定性规则在分配额内选评分 ≥ 8 且可免费取消的最便宜候选（否则选最便宜的），标为“Local fallback”。
- 7b. _首选超出分配额_：改选分配额内最好的住处，都放不下就选最便宜的，并在提案中说明原因。
- _任一步骤_。_收到修订请求_（来自 UC-C2）：见 UC-C2 第 6 步。

**特殊需求**：R-C8（按分计算）、R-C9（不编造酒店）、R-C10（回退）。

<a id="uc-c2-manage-budget"></a>

### UC-C2 Manage Budget

| 字段                     | 内容                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| **编号 / 名称**          | UC-C2 Manage Budget                                                                                |
| **来源**                 | AH-C1；R-C4、R-C5、R-C6、R-C11                                                                     |
| **主参与者**             | Traveler                                                                                           |
| **次参与者**             | Orchestrator，以及五个 specialist agent                                                            |
| **目标**                 | 旅行者拿到的计划在预算之内，或者明确说出差多少。                                                   |
| **触发**                 | 所有被派出的 specialist 都已把提案放上看板（`detect_conflicts`），或旅行者编辑了计划。             |
| **前置条件**             | `budgetTotal` ≥ AUD 0.01；至少存在一个提案。                                                       |
| **后置条件（成功）**     | `TripPlan.estTotal` ≤ `budgetTotal`；不再有预算冲突。                                              |
| **后置条件（部分成功）** | 返回找到的最低总价的计划；仍被修订请求指向的每个区段标为 `needs_you`，`conflicts` 列出剩下的问题。 |

**主成功场景**

1. Orchestrator 以澳分为单位汇总每个提案的条目费用，并计算 `overrunPct`。
2. 总价在预算之内：不产生预算冲突。
3. Orchestrator 构建计划，把每个区段标为 `draft`，连同 `estTotal` 和 `overrunPct` 一起返回。

**扩展**

- 2a. _总价超出预算，但各区段底价之和放得下_：
  1. Orchestrator 计算每个区段可削减的空间（其费用减去 `floorCost`）。
  2. 把超支按比例分摊到这些区段，为每个区段生成一个带 `targetSaving` 的 `RevisionRequest`。
  3. Orchestrator 只对这些 agent 运行 `revise_conflicts`，给每个 agent 它上一版的提案和新的分配额（上次费用减去应省金额）。
  4. 住宿在预算修订时保留已确认的偏好，在新的分配额内选最便宜的合格住处。
  5. Orchestrator 重新检测，计算规划评分（超出预算的澳元数 + 每个其他冲突计预算的 10%）。
  6. 评分改善：保留这一轮，回到主场景第 1 步。评分没有改善：丢弃这一轮，转到 2c。
- 2b. _各区段底价之和已经超出预算_：Orchestrator 产生一个写明最低金额的 `infeasible budget` 冲突，停止修订，回复中告诉旅行者把预算提高到至少这个金额，或者更改日期、出发地或目的地。
- 2c. _达到三轮，或没有改善_：返回目前最好的计划；仍被指向的区段为 `needs_you`。
- _旅行者编辑计划_：在编辑器里重新核算费用，任何未定价的改动都会显示 `price_unverified` 问题。

**特殊需求**：R-C8；超支百分比不经四舍五入直接比较。

<a id="23-template-for-the-other-members"></a>

## 2.3 其他成员的模板

每人至少复制一份写一个用例；全组共需 5–10 个。

| 字段                        | 内容                  |
| --------------------------- | --------------------- |
| **编号 / 名称**             |                       |
| **来源**                    | 你的 AH-x 和 R-x 编号 |
| **主参与者**                |                       |
| **次参与者**                |                       |
| **目标**                    |                       |
| **触发**                    |                       |
| **前置条件**                |                       |
| **后置条件（成功 / 失败）** |                       |

**主成功场景**：编号步骤。

**扩展**：`<step><letter>. <condition>: <steps>`。

**特殊需求**：适用的非功能需求。

从现有用例图中建议的用例：A，Generate Itinerary；B，Arrange Transportation；D，View Weather-based Clothing Recommendation；E，Edit Itinerary (Timeline / Map)。

<a id="24-uc-b1-arrange-transportation"></a>

## 2.4 UC-B1 安排交通

| 字段             | 内容                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 编号 / 名称      | UC-B1 Arrange Transportation                                                                                                                                                            |
| 来源             | AH-B1；R-B1–R-B6                                                                                                                                                                        |
| 主参与者         | Traveler                                                                                                                                                                                |
| 次要外部参与者   | 航班搜索数据提供方；Maps / Routes 数据提供方；已配置时的模型服务                                                                                                                        |
| 内部协作角色     | 工作流 / supervisor、Transport specialist、规划看板、Itinerary specialist、冲突策略。这些是系统内部角色，不是额外的人类参与者。                                                         |
| 目标             | 获得基于证据、与每日日程协调的交通建议，并明确已知价格及尚未解决的可用性、时间或预算问题。                                                                                              |
| 触发             | 旅行者请求旅行计划或交通相关变更；工作流派发 Transport，或向其发送定向修订请求。                                                                                                        |
| 前置条件         | 存在符合 schema 的 TripBrief，包含有效且有序的 ISO 日期、目的地、正数人数和预算。Maps、Booking 和 Memory 端口已注入。可用模型为可选项。正常场景明确提供出发地。                         |
| 成功后置条件     | 符合 schema 的交通提案包含基于数据提供方的票价选择和已排程地面行程段，可供下游规划读取，并纳入 TripPlan。没有尚未解决且指向交通的请求。相关活动已根据路线证据检查。不会进行预订或付款。 |
| 部分成功后置条件 | 保留的最佳提案保存已知价格、未定价警告、不可用选项和/或冲突。只有尚未解决的请求指向交通时，交通才为 `needs_you`；否则为 `draft`，包括地面票价未知的情况。                               |
| 失败后置条件     | 无效输入、取消或无法恢复的错误使运行停止；不宣称生成了成功的计划。仅模型输出无效时，通常回退而不是失败。                                                                                |

<a id="main-success-scenario"></a>

### 主成功场景

1. 旅行者提供出发地、目的地、日期、人数、预算及任何分段交通方式选择。聊天输入在本用例上游生成已验证的行程需求。
2. 工作流通过 specialist 边界和规划看板调用 `transportAgent.invoke`，并注入工具与记忆。
3. Transport 验证日期，生成有序行程，并读取相关出发地偏好。它收集可选航班票价和地面路线；端口支持时，也收集备选路线。
4. 配置了模型时，Transport LLM 调用 `search_transport_evidence`，再选择可选航班 ID，并为每个有路线的行程段选择规划日和当地出发时间。模型不提供价格或时长。
5. 确定性代码根据证据解析所选 ID，要求每个有票价候选的行程段恰好选择一个票价，并检查必需行程段覆盖、规划日边界和 HH:mm 语法。它检查路线有效性，以及每段已排程行程能否在其规划日内完成。
6. 代码依据数据提供方的价格和时长组装提案，采用受支持的交通方式偏好，并记录假设、费用下限、可用备选航班和来源标签。超出分配额时，将所选航班替换为返回的最便宜票价。
7. 工作流验证提案 schema；规划看板保存提案。在分阶段的首轮中，如果交通和住宿依赖已被派发，日程规划可读取其提案。它以证据支撑活动安排，验证草案，并用路线时长加 15 分钟缓冲检查衔接。
8. 收齐已派发的提案后，确定性冲突策略检查已知预算总额、已报告的路线问题及排程条目的时间重叠。
9. 没有未解决的冲突时，工作流组装计划，将交通以 `draft` 返回，同时附上已知估价和来源信息。旅行者可在聊天或编辑器中查看或修改。

<a id="extensions"></a>

### 扩展

- **1a — 无效输入：** schema/日期校验拒绝无效行程需求或顺序错误的日期。应修正输入，不宣称计划有效。
- **3a — 未提供出发地：** 当前解析顺序为行程需求中的出发地、`transport.origin` 记忆、最后是悉尼。提案说明解析出的出发地；此回退不是用户确认步骤。
- **3b — 旅行者自行安排航班：** `excludeFlights` 跳过航班搜索和定价，不会为这些自行安排的航班产生票价缺失冲突。
- **3c — 必需航班不可用或结果为空：** 保留航班缺失冲突和不完整估价；绝不编造回退票价。
- **3d — 无可用地面路线或路线无法排入：** 省略无效的已排程行程段，并记录地理/时间冲突。对于未明确选择交通方式且耗时过长的城际地面行程段，证据收集可能先寻找替代航班；不会因此悄然覆盖明确指定的地面交通方式。
- **4a/5a — 无模型、模型失败或选择无效：** 根据已收集证据生成确定性计划（需要时先收集证据）。模型错误后的回退标为 `Local fallback`；无模型路径使用正常证据来源信息。回退不能生成数据提供方未提供的证据。
- **6a — 地面票价不可用：** 省略 `estCost`，统计未定价行程段，并将已知估价描述为下限。这本身不会触发冲突或修订。
- **6b — 所选地面交通方式不可用：** 保留数据提供方的路线，并明确说明请求的方式不可用。这本身是警告，不是修订请求。
- **8a — 可解决的冲突：** 只调用被定向请求且支持修订的 specialist，传入先前提案、修订约束，以及适用时的分配额。重复证据收集、选择和验证。活动时间重叠指向日程，使其围绕交通调整，而不是强制两者同时改变。只有 `planScore` 严格改善时才保留该轮，随后重新检查。
- **8b — 预算不可行：** 停止修订，报告基于证据的最低费用。冲突指向费用最高的区段；不一定是交通。
- **8c — 达到默认第三轮或评分未改善：** 返回保留的最佳计划；只有仍被请求指向的区段标为 `needs_you`。评分未改善的轮次被丢弃。
- **任一步骤 — 取消/无法恢复的失败：** 停止并报告失败，允许之后重试。后续聊天或编辑会开启新交互；本用例没有 `confirmed` 或 `booked` 状态。

**特殊需求：** R-B4–R-B6。旅行日期使用当前不包含结束日的规划区间。交通估价以澳元计，并非预订。地面数据提供方的时长在模型排程前收集；修改所选出发时间不会自动重新查询随时间变化的公共交通时刻表。可用性缺口必须持续可见；`draft` 不保证价格完整。

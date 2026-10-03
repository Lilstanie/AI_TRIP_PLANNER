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

<a id="23-template-for-the-other-members"></a>

## 2.3 其他成员的模板

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

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

## 2.2 用例规格：成员 C 和 D

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

<a id="uc-d1-view-weather-based-clothing-recommendation"></a>

### UC-D1 View Weather-based Clothing Recommendation

| 字段                     | 内容                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **编号 / 名称**          | UC-D1 View Weather-based Clothing Recommendation                                                                                                 |
| **来源**                 | AH-D1；R-D1–R-D5                                                                                                                                 |
| **主参与者**             | Traveler                                                                                                                                         |
| **次参与者**             | Orchestrator（系统角色）、Maps / Places API、Weather API（Google Weather API 或 Open-Meteo）、长期偏好存储                                       |
| **目标**                 | 旅行者收到目的地与天气相关的行李建议，以及参考已确认饮食偏好的地图餐厅候选；系统清楚说明证据的限制。                                             |
| **触发**                 | 旅行者提交行程需求后，Orchestrator 为有效的 `TripBrief` 分派 specialist。                                                                        |
| **前置条件**             | 1. 存在有效的 `TripBrief`，包含目的地、出行日期、人数和用户 id。2. 已注入 MapsPort、WeatherPort 和 memory port；坐标和已保存的饮食偏好可以缺失。 |
| **后置条件（成功）**     | 目的地指南和餐饮 `AgentProposal` 都加入最终 `TripPlan`；景点和餐厅名称与地图候选相符，且天气时间范围和来源已说明。                               |
| **后置条件（部分成功）** | 如果坐标、预报数据或模型不可用，计划仍包含可用的确定性建议，并将天气标为气候背景或不可用，而非天气预报。                                         |
| **后置条件（失败）**     | 如果必要的地图或记忆数据读取失败，受影响的 specialist 运行失败，工作流会报告该 specialist；不会编造地点证据。                                    |

**主成功场景**

1. 旅行者提交目的地、日期、出行人数和饮食要求，例如吃素和花生过敏。
2. Orchestrator 将经过验证的 `TripBrief` 以及已注入的地图、天气和记忆端口分派给 Destination Guide 和 Dining。
3. Destination Guide 验证行程日期，然后并行检索景点、博物馆候选和已保存偏好。
4. 它删除重复地图候选，并使用候选地点的坐标请求首个出行日期的天气信息。
5. 天气适配器根据日期选择预报或气候数据来源，并连同结果返回时间范围和来源信息。
6. 已配置的 LLM 通过只读证据工具读取已验证的行程需求、月份、地点候选和偏好，然后起草目的地与行李建议。
7. 确定性代码把草稿适配到输出 schema、拒绝没有地图依据的景点名称，并删除重复候选；无效输出改用本地回退。
8. Dining 检索餐厅候选和已保存偏好，只筛选饮食相关偏好，并计算每人餐费上限。
9. 已配置的 LLM 根据证据工具起草餐厅建议。确定性代码检查预算和候选名称；提案会说明菜单与过敏适配性需要向餐厅确认。
10. Orchestrator 在图边界验证这些提案、组装 `TripPlan`，再把天气行李建议和餐饮区段返回给旅行者。

**扩展**

- 4a. _没有候选地点包含坐标，或没有 WeatherPort_：跳过天气请求，使用按月份提供的规划背景；不得将其描述为预报。
- 5a. _出行日期在 14 天以后_：返回历史气候背景，并明确它不是天气预报。模拟模式的天气 fixture 也遵循相同的时间范围区分。
- 5b. _天气提供方失败_：使用按月份提供的背景并标明天气提供方不可用；不能只因天气失败就让目的地指南失败。
- 7a. _未配置模型、模型调用失败、草稿无效或景点名称没有地图依据_：根据现有地图证据返回确定性指南，并将提案标记为回退。
- 8a. _没有餐厅候选_：只返回餐饮预算额度，不提供餐厅名称。
- 9a. _没有已保存的饮食偏好_：生成一般的、有地图依据的候选，并说明没有找到已确认饮食偏好。
- 9b. _旅行者报告过敏_：不得保证某家餐厅安全；提醒旅行者直接向餐厅确认食材和交叉接触控制。

**特殊需求**：R-D2（预报时间范围和来源）、R-D4（名称依据与饮食安全）、R-D5（明确降级状态和回退）。

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

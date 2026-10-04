<a id="4-behaviour-models-member-e-whw0591-chat-workspace-timeline-and-map-editing"></a>

# 4. 行为模型：成员 E（`@WhW0591`，聊天工作区、时间线与地图编辑）

[English](04-member-e-behaviour.md) | 中文

这些模型源自[需求](01-requirements.zh.md#member-e-ah-e1)中的 **AH-E1 / R-E1–R-E6** 和[用例](02-use-cases.zh.md#uc-e1-edit-itinerary-timeline--map)中的
**UC-E1 Edit Itinerary (Timeline / Map)**。聊天协调者可以更新行程简报或重新规划，但没有编辑工具；时间线和地图的编辑路径从预览到本地应用全程是确定性的。

<a id="41-activity-diagram-edit-itinerary-uc-e1"></a>

## 4.1 活动图：Edit Itinerary（UC-E1）

![UC-E1 活动图](../diagrams/member-e/e-activity.png)

活动图把当前的聊天路径和已实现的时间线/地图编辑路径分开。聊天协调者可以更新行程简报或重新规划，但不会生成 `EditRequest`。编辑路径从预览到本地应用全程是确定性的。

<a id="42-sequence-diagram-timelinemap-edit-with-preview-and-version-check-uc-e1"></a>

## 4.2 时序图：带预览和版本检查的时间线/地图编辑（UC-E1）

![UC-E1 时序图](../diagrams/member-e/e-sequence.png)

时序图展示已实现的时间线/地图路径，并把聊天标为另一条协调者路径。关键控制点是浏览器端比较 `preview.baseVersion` 与当前计划版本；保存只在本地进行，没有服务端的原子提交。

<a id="43-state-machine-timelinemap-edit-lifecycle-uc-e1"></a>

## 4.3 状态机：时间线/地图编辑的生命周期（UC-E1）

![UC-E1 状态机](../diagrams/member-e/e-state.png)

状态机描述已实现的时间线/地图编辑生命周期。它不包含聊天解析，因为当前聊天协调者没有编辑工具。预览要么被阻断、要么被取消、要么在客户端版本检查通过后被应用；应用后的计划随后保存在本地。

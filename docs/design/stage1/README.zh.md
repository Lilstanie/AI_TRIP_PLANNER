<a id="elec5620-stage-1-design-model"></a>

# ELEC5620 Stage 1 设计模型

[English](README.md) | 中文

这是 Stage 1 报告的目录：列出每个评分项以及覆盖它的页面。模型依据 `main` 上的代码绘制，因此与实现一致，而不是沿用早期 Google Doc 中的方案。主要区别是，已上线的产品**没有审批检查点**：旅行者在聊天或编辑器中修改计划（`packages/shared/src/plan.ts`）。

<a id="marking-items"></a>

## 评分项

\* 表示个人项：每位成员各写自己的。

| 评分项                               | 分值 | 位置                                                                                                                                                                                                                                                             |
| ------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ad hoc 需求\*                        | 0.5  | [01-requirements.md §1.2](01-requirements.zh.md#12-ad-hoc-requirements-individual-at-least-one-per-member)                                                                                                                                                       |
| 特征图（含非功能需求）               | 1    | [01-requirements.md §1.4](01-requirements.zh.md#14-feature-diagram-group)                                                                                                                                                                                        |
| 总体用例图                           | 1    | [use-case-diagram.svg](../diagrams/use-case-diagram.svg)                                                                                                                                                                                                         |
| 用例规格\*                           | 2    | [02-use-cases.md](02-use-cases.zh.md)                                                                                                                                                                                                                            |
| 类图：泛化、组合、聚合、接口、多重性 | 3    | [class-diagram.md](../class-diagram.zh.md) 图 1–5，以及 [03-structure.md §3.1](03-structure.zh.md#31-elementary-structure-generalisation-added-to-the-class-model) 中的图 6                                                                                      |
| 对象图、协作、结构化类               | 3    | [03-structure.md §3.2–3.4](03-structure.zh.md#32-object-diagram)                                                                                                                                                                                                 |
| 活动图\*                             | 1.5  | 成员 C：[04-member-c-behaviour.md §4.1](04-member-c-behaviour.zh.md#41-activity-diagram-arrange-accommodation-uc-c1)；成员 D：[04-member-d-behaviour.md §4.1](04-member-d-behaviour.zh.md#41-activity-diagram-weather-and-dietary-guidance-uc-d1)                |
| 时序图\*                             | 1.5  | 成员 C：[§4.2](04-member-c-behaviour.zh.md#42-sequence-diagram-budget-overrun-and-targeted-revision-uc-c2-extension-2a)；成员 D：[04-member-d-behaviour.md §4.2](04-member-d-behaviour.zh.md#42-sequence-diagram-weather-based-packing-and-dietary-dining-uc-d1) |
| 状态机图\*                           | 1.5  | 成员 C：[§4.3](04-member-c-behaviour.zh.md#43-state-machine-accommodation-section-within-a-planning-turn-uc-c1-and-uc-c2)；成员 D：[04-member-d-behaviour.md §4.3](04-member-d-behaviour.zh.md#43-state-machine-destination-guide-weather-and-packing-section)   |
| 架构视图（可选）                     | —    | [架构图](../../architecture-diagrams.zh.md)：系统概览、agent 协作、聊天流时序、行程区段生命周期、存储同步                                                                                                                                                        |

需求图和结构图的 SVG 和 PNG 渲染文件在 [`../diagrams/`](../diagrams/)。成员 C 的活动图、时序图和状态机图以 Archify 视图形式渲染，放在 [`../../architecture-diagrams/stage1-member-c/`](../../architecture-diagrams.zh.md#elec5620-stage-1-member-c-behaviour)。

<a id="what-each-other-member-still-has-to-write"></a>

## 其他成员还需要写的内容

每位成员的活动图、时序图和状态机图必须来自**自己的** ad hoc 需求和用例规格。A、B、E 每人还需补充：

1. 在 [01-requirements.md §1.2](01-requirements.zh.md#12-ad-hoc-requirements-individual-at-least-one-per-member) 中写一条 ad hoc 需求。
2. 按 §2.3 的模板，在 [02-use-cases.md](02-use-cases.zh.md) 中写至少一个用例规格。
3. 基于该用例画一张活动图、一张时序图和一张状态机图，放在新的
   `04-member-<x>-behaviour.md` 页面中。

<a id="contribution-table-fill-in-before-submitting"></a>

## 贡献表（提交前填写）

| 项目                     | A   | B   | C   | D   | E   |
| ------------------------ | --- | --- | --- | --- | --- |
| 特征图                   |     |     |     |     |     |
| 用例图                   |     |     |     |     |     |
| 类图                     |     |     |     |     |     |
| 对象图 / 协作 / 结构化类 |     |     |     |     |     |

<a id="generative-ai-acknowledgement"></a>

## 生成式 AI 使用声明

这些页面的部分内容由 AI 助手根据仓库代码起草。Canvas 的合规声明要求注明任何生成式 AI 的使用，所以请在报告中写明。每位成员也应能在第 11/12 周的面试中讲清楚自己的图。

<a id="architecture-diagrams"></a>

# 架构流程图

[English](architecture-diagrams.md) | 中文

以下图表描述当前运行时和浏览器工作流程。每个链接都会打开独立的 Archify HTML 查看器；可编辑 JSON 源文件和浏览器检查证据分别存放。

## 文件分类

- `architecture-diagrams/specs/` — 可编辑的 Archify JSON 图表源文件。
- `architecture-diagrams/rendered/` — 独立 HTML 查看器。
- `architecture-diagrams/evidence/` — visual-check 报告、联系表和截图。

每项都提供查看器、源文件和视觉检查联系表链接。

## 系统结构与信任边界

- [项目架构](architecture-diagrams/rendered/project-overview.html)（[源文件](architecture-diagrams/specs/project-overview.architecture.json)，[证据](architecture-diagrams/evidence/project-overview.visual-check.html)）—— Next.js 请求主链路、LangGraph 工作流、专家 agents、LangChain 模型调用和工具 Gateway。
- [Agent、依据与信任边界](architecture-diagrams/rendered/agent-trust-boundaries.html)（[源文件](architecture-diagrams/specs/agent-trust-boundaries.architecture.json)，[证据](architecture-diagrams/evidence/agent-trust-boundaries.visual-check.html)）—— 旅行者输入、仅协调器可见的附件、注入给 agent 的能力，以及外部数据提供方。
- [共享契约](architecture-diagrams/rendered/contracts-flow.html)（[源文件](architecture-diagrams/specs/contracts-flow.workflow.json)，[证据](architecture-diagrams/evidence/contracts-flow.visual-check.html)）—— `ChatRequest`、`TripBrief`、`AgentProposal` 和 `TripPlan` 如何跨 package 边界传递。

## 对话与规划

- [对话与 LangChain](architecture-diagrams/rendered/chat-langchain.html)（[源文件](architecture-diagrams/specs/chat-langchain.workflow.json)，[证据](architecture-diagrams/evidence/chat-langchain.visual-check.html)）—— 协调器工具、需求不完整时的追问、无模型路径，以及交给 LangGraph 的规划请求。
- [聊天请求与 NDJSON 流](architecture-diagrams/rendered/chat-stream.html)（[源文件](architecture-diagrams/specs/chat-stream.sequence.json)，[证据](architecture-diagrams/evidence/chat-stream.visual-check.html)）—— 请求校验、进度帧、最终响应、持久化和非规划结果。
- [Agent 协作](architecture-diagrams/rendered/agent-collaboration.html)（[源文件](architecture-diagrams/specs/agent-collaboration.workflow.json)，[证据](architecture-diagrams/evidence/agent-collaboration.visual-check.html)）—— 专家分派、共享 planning board、冲突检查、定向修订和停止条件。
- [计划区段生命周期](architecture-diagrams/rendered/plan-lifecycle.html)（[源文件](architecture-diagrams/specs/plan-lifecycle.lifecycle.json)，[证据](architecture-diagrams/evidence/plan-lifecycle.visual-check.html)）—— 区段何时成为 `draft` 或 `needs_you`，以及旅行者如何继续处理。

## 数据、存储与服务

- [ToolGateway 与数据提供方](architecture-diagrams/rendered/tool-gateway.html)（[源文件](architecture-diagrams/specs/tool-gateway.workflow.json)，[证据](architecture-diagrams/evidence/tool-gateway.visual-check.html)）—— 请求级 mock/live 模式、提供方 adapter，以及返回给 agent 的依据。
- [存储与账号同步](architecture-diagrams/rendered/storage-sync.html)（[源文件](architecture-diagrams/specs/storage-sync.workflow.json)，[证据](architecture-diagrams/evidence/storage-sync.visual-check.html)）—— 浏览器目录、登录账号同步、`MemoryStore`、`tripStore` 和持久化回退。
- [本地与账号同步时序](architecture-diagrams/rendered/account-sync.html)（[源文件](architecture-diagrams/specs/account-sync.sequence.json)，[证据](architecture-diagrams/evidence/account-sync.visual-check.html)）—— 逐记录时间戳合并、删除 tombstone、延迟推送和离线保留。

## 工作区行为

- [行程编辑](architecture-diagrams/rendered/trip-edit.html)（[源文件](architecture-diagrams/specs/trip-edit.workflow.json)，[证据](architecture-diagrams/evidence/trip-edit.visual-check.html)）—— 地点搜索、编辑预览、路线/预算/冲突重算，以及带版本校验的应用操作。
- [地图浏览](architecture-diagrams/rendered/map-exploration.html)（[源文件](architecture-diagrams/specs/map-exploration.workflow.json)，[证据](architecture-diagrams/evidence/map-exploration.visual-check.html)）—— 地点查询和旅行者当前位置路线会显示在地图上，且不会重新运行 planner。

## 项目中的 LangChain 用法

LangGraph（`@langchain/langgraph`）拥有确定性的规划状态机，决定何时分派专家、检测冲突、修订指定提案、组装 `TripPlan` 或停止。LangChain 不负责选择图的下一状态。

LangChain JS（`langchain`）通过 `createAgent` 提供对话协调器、分派与修订 supervisor，以及五个职责型 agent。对话协调器通过带类型的工具暴露 `update_trip_brief`、`ask_user_question` 和 `replan_trip`。各专家使用边界明确的依据工具；结构化结果按照共享 Zod 契约解析校验。

`packages/agents/src/models.ts` 集中通过 OpenAI 兼容的 DeepSeek adapter 路由模型。项目有 MiniMax 配置，但当前没有将它接入模型路由。模型或工具调用失败时，系统通过已校验的确定性回退继续规划。Agent 通过 `AgentContext` 注入 `ToolGateway` 和 `MemoryStore`，不直接导入数据提供方或 service 单例。

运行时细节见[架构](architecture.zh.md)，请求/响应契约见 [API](api.zh.md)，当前界面行为见[工作区 UI](workspace-ui.zh.md)。

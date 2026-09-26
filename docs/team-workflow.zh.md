<a id="team-and-git-workflow"></a>

# 团队与 Git 工作流

[English](team-workflow.md) | 中文

本项目只有一个可部署单元，因此按模块划分职责，而非按前端/后端层划分。

| 领域         | 负责人 | GitHub            | 职责                                    |
| ------------ | ------ | ----------------- | --------------------------------------- |
| 编排与集成   | A      | `@Lilstanie`      | 图状态、supervisor、约定、冲突策略和 CI |
| 行程与交通   | B      | `@fonever2`       | 日程、路线可行性和地图适配器            |
| 住宿与预算   | C      | `@HeadmasterEggy` | 住宿适配器、费用汇总和预算策略          |
| 目的地与餐饮 | D      | `@jbia0391`       | 有事实依据的指南、习俗、餐饮和饮食约束  |
| Web 与记忆   | E      | `@WhW0591`        | 聊天、筛选器、计划 UI、偏好记忆和持久化 |

<a id="who-owns-which-paths"></a>

## 路径职责划分

| 路径                                                                                     | 负责人 | 职责                                                 |
| ---------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| `packages/shared/src/**`                                                                 | A      | 共享约定；更改需要 Agent Note，并通知团队            |
| `packages/orchestrator/**`                                                               | A      | LangGraph 工作流、supervisor、聊天输入处理和冲突策略 |
| `apps/web/app/api/**`                                                                    | A      | 路由处理器                                           |
| `packages/tools/src/gateway.ts`, `data-mode.ts`, `mock-server.mjs`                       | A      | mock 与实时数据的路由选择                            |
| `packages/agents/src/itinerary/**`, `packages/agents/src/transport/**`                   | B      | 每日计划、旅程路段、路线和票价                       |
| `packages/tools/src/maps.ts`, `route-options.ts`, `airports.ts`                          | B      | 地图、Places 和路线适配器                            |
| `packages/agents/src/accommodation/**`                                                   | C      | 住宿搜索和房间分配                                   |
| `packages/tools/src/booking.ts`, `serpapi.ts`, `google-places.ts`                        | C      | 酒店和航班价格适配器                                 |
| `packages/orchestrator` 中的 `rollUpCost` 和 `detectConflicts`                           | C      | 预算汇总和超支阈值                                   |
| `packages/agents/src/destination-guide/**`, `packages/agents/src/dining/**`              | D      | 有事实依据的景点、习俗、天气指南和餐饮               |
| `packages/tools/src/weather.ts`                                                          | D      | 天气预报和气候适配器                                 |
| `apps/web/components/**`, `apps/web/lib/**`, `apps/web/app/styles/**`, `app/globals.css` | E      | 工作区 UI                                            |
| `packages/services/**`                                                                   | E      | 记忆、旅行存储、通知和身份验证                       |

待完成的工作见[路线图](roadmap.zh.md)和代码中的 `TODO(<owner>)` 注释。
各部分如何协作见[架构](architecture.zh.md)；已退役的模块交接文档位于
[`.agents/archive/`](../.agents/archive/)。

<a id="branches-and-commits"></a>

## 分支与提交

使用标准的分支类型前缀，例如 `feature/<module>-<short-desc>`、`fix/<short-desc>`、
`refactor/<short-desc>` 或 `docs/<short-desc>`。分支名称与创建分支的工具或助手无关。
使用 Conventional Commits 前缀：`feat:`、`fix:`、`docs:`、`refactor:`、`test:` 和 `chore:`。

向 `main` 提交 PR（Pull Request），在 CI 通过后自行合并。不会要求或自动请求评审；
跨模块更改时，请自行邀请队友。不要强制推送或删除 `main`
（[原因](../.agents/notes/implemented/process/2026-09-22-no-review-requests.md)）。

每个 PR 都合并到 `main`。更改依赖尚未合并的 PR 时，以该分支为基础，但先合并下层 PR，
再将后续 PR 的目标调整为 `main` 后合并；绝不将 PR 合并到另一条功能分支
（[原因](../.agents/notes/implemented/process/2026-09-21-merge-into-main-only.md)）。

不要在未通知团队的情况下修改 `packages/shared`；每个包都依赖它。

<a id="protected-files-and-decisions"></a>

## 受保护文件与决策

`AGENTS.md` 的[受保护文件](../AGENTS.md#protected-files)一节列出了任何人或 AI（人工智能）
都不得随意修改的内容。如果 PR 修改、重命名或删除冻结的历史内容
（`.agents/archive/`、带日期的会话日志、被拒绝及已归档的 Agent Notes），
或者更改 `packages/shared/src` 却没有在同一 PR 中新增或更新
[Agent Note](../.agents/notes/README.md)，`protected-files` CI 作业就会失败。
会话日志描述一次会话，不作出决策。

<a id="session-logs"></a>

## 会话日志

每次 AI 辅助编码会话都在 `.agents/session-logs/` 中新增一份简洁记录，
以 `YYYY-MM-DD-<topic>.md` 命名，并基于 [`TEMPLATE.md`](../.agents/session-logs/TEMPLATE.md)。
一次会话对应一个新文件，因此两人同时写入也不会冲突。
写作规则见[会话日志 README](../.agents/session-logs/README.md)。

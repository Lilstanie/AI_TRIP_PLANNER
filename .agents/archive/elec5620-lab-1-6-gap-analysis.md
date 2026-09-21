# ELEC5620 Lab 1–6 实现状态与差距分析

> 已归档的时点审计（2026-09-14）。文中提到的 README 与文档漂移已在 2026-09-17 修正；当前架构见 [`architecture.md`](../architecture.md)，文中的文件路径描述的是审计当时的仓库。

> 审计日期：2026-09-14  
> 审计对象：当前 `main` checkout（`2c1a49b`）  
> 对照基线：`ELEC5620-Lab-Notes-1-6-Summary.md`  
> 判断原则：以当前源码和可执行验证为事实，不把 README、旧设计图或 roadmap 中的计划能力当作已实现能力。

## 1. 结论

AI Trip Planner 的技术方向总体正确，运行时核心已经比较完整：系统具备五个职责不同的 specialist、LangChain supervisor、LangGraph 编排、typed ports、Zod 契约校验、预算与时间冲突检测、定向 revision、确定性 fallback，以及能够消费 streaming NDJSON 的 Next.js UI。

当前主要风险不是“代码不能运行”，而是课程要求的建模链没有完整闭合：

```text
真实问题
→ Project Requirements
→ Ad-Hoc Requirements
→ Feature Model
→ Use Cases
→ Design Principles / Viewpoints
→ Architecture / Class Model
→ Runtime Object Model
```

仓库目前在架构和运行时实现方面明显领先，但在 Ad-Hoc requirements、Feature Model、完整 use case specifications、viewpoint analysis、源码一致的 class model，以及 Lab 6 object diagram 方面仍有较大缺口。因此，项目已经是一个较强的工程原型，但还不是一套完整、可追踪的 Model-Based Software Engineering 交付物。

粗略判断：

- 运行时核心完成度约为 **75–85%**。
- 按 Lab 1–6 的完整证据链计算，完成度约为 **50–60%**。

以上比例用于安排优先级，不代表课程正式评分。

## 2. Lab 1–6 对照

| Lab | 当前仓库证据 | 状态 | 主要缺口 |
| --- | --- | --- | --- |
| Lab 1：问题、用户、团队与范围 | README 描述了旅行规划场景；`team-workflow.md` 给出模块责任 | 部分完成 | 缺少正式 company brief、候选题比较、清晰的目标用户与行业价值、成员姓名、团队约定和冲突处理记录 |
| Lab 2：AI 角色与功能规模 | 五个 specialist 已实现，并存在真实 delegation、proposal 合并和定向 revision | 技术实现较强，课程证据不足 | 缺少 pitch/tutor 反馈记录；缺少“每位成员至少 2 个 core + 1 个 optional feature”的责任矩阵 |
| Lab 3：三类需求建模 | 已有 use-case diagram，并将十个 use case trace 到部分设计类 | 明显不完整 | 没有找到 Ad-Hoc requirements、Feature Model；没有完整 textual use cases |
| Lab 4：Checkpoint、原则与视点 | 文档中体现了 separate control from function、central orchestration、dependency injection、ports/adapters | 部分完成 | 没有 checkpoint 结果；缺少正式 Design Principles 清单、4+1/viewpoint analysis，以及带 main/alternative/exception flow 的 use cases |
| Lab 5：架构模式与类图 | 有架构图、五组类图、interfaces、relationships、multiplicity 和 rationale | 基本完成，但存在漂移 | 部分类和能力属于未来设计，不是当前源码事实；pattern 的 problem/application/benefit/limitation/trade-off 论证仍不完整 |
| Lab 6：对象图与运行时协作 | 已有 architecture、workflow、sequence、dataflow 等运行时图 | 未完成 | 没有符合 UML Object Diagram 要求的具体对象、属性值、links 和场景快照 |

## 3. 当前真实实现

### 3.1 五个 specialist 与职责分离

`packages/agents/src/index.ts` 注册了五个稳定 specialist：

- `itinerary`
- `transport`
- `accommodation`
- `destination-guide`
- `dining`

这五个角色不是同一聊天机器人简单换名。它们具有不同输入证据、规划规则、输出内容和 revision 能力，满足“至少三个不同 AI 角色”的技术方向。

其中：

- `itinerary`、`destination-guide`、`dining` 使用模型和受约束的 evidence tools，并提供无模型或 provider 失败时的 deterministic fallback。
- `transport`、`accommodation` 使用 calculator-backed 逻辑。模型只能围绕 typed calculator 结果组织输出，不能自由编造路线、价格、酒店或可用性。

源码证据：

- `packages/agents/src/index.ts:14-20`
- `packages/agents/src/models.ts:15-54`
- `packages/agents/src/itinerary/index.ts`
- `packages/agents/src/transport/index.ts`
- `packages/agents/src/accommodation/index.ts`
- `packages/agents/src/destination-guide/index.ts`
- `packages/agents/src/dining/index.ts`

### 3.2 Supervisor–Worker 与确定性 LangGraph 控制

生产路径使用名为 `trip_planning_supervisor` 的 LangChain agent，通过 typed delegation tools 选择 specialist。Supervisor 不能修改已经校验的 `TripBrief`，也不能替 specialist 完成领域工作。

LangGraph 负责确定性控制：

```text
START
→ dispatch_specialists
→ detect_conflicts
→ revise_conflicts（仅在有冲突且 round < maxRounds 时）
→ detect_conflicts
→ build_plan
→ END
```

默认 `maxRounds = 3`。当 supervisor 不可用，或者测试通过依赖注入提供 specialist 时，workflow 使用 deterministic dispatch。Revision 只重新运行被 `RevisionRequest.targetAgent` 指向且支持 revision 的 specialist。

源码证据：

- `packages/orchestrator/src/supervisor.ts:36-40`
- `packages/orchestrator/src/supervisor.ts:142-179`
- `packages/orchestrator/src/supervisor.ts:182-220`
- `packages/orchestrator/src/workflow.ts:188-220`
- `packages/orchestrator/src/workflow.ts:257-335`
- `packages/orchestrator/src/workflow.ts:357-377`

### 3.3 契约、校验与 conflict policy

`packages/shared` 提供 `TripBrief`、`AgentProposal`、`RevisionRequest`、`TripPlan`、`Specialist`、`ToolGateway` 和 `MemoryStore` 等公共契约。

当前结构化边界包括：

- `/api/chat` 使用 `ChatRequest.safeParse()` 校验用户请求。
- `chat.ts` 把用户明确说出的内容提取为 `BriefPatch`，再合并并校验为 `TripBrief`。
- 每个 specialist 输出进入 workflow 时都经过 `AgentProposalSchema.parse()`。
- `buildPlan` 的最终结果经过 `TripPlanSchema.parse()`。

冲突检测包含：

- 总预算超支；
- specialist 自声明的 `conflictsWith`；
- 不同 specialist 在同一天的时间重叠。

仍未解决的冲突在 round limit 后被转换为 pending HITL / escalation，而不是被静默接受。

源码证据：

- `apps/web/app/api/chat/route.ts:5-10`
- `packages/shared/src/contracts.ts:20-97`
- `packages/shared/src/plan.ts:19-39`
- `packages/orchestrator/src/workflow.ts:50-139`
- `packages/orchestrator/src/workflow.ts:233-255`
- `packages/orchestrator/src/workflow.ts:338-354`

### 3.4 Next.js UI 与 streaming response

当前 Web UI 已经能够：

- 向 `POST /api/chat` 发送 `ChatRequest`；
- 读取 newline-delimited JSON stream；
- 展示 agent queued/running/completed/failed 状态；
- 接收最终 `ChatResponse` 并替换当前 `TripPlan`；
- 显示总预算、超支状态、pending HITL banner；
- 展开每个 specialist 的 proposal items、时间、地点、成本和 assumptions。

`POST /api/chat` 返回的实际媒体类型是：

```text
application/x-ndjson; charset=utf-8
```

流中包括 `agent_started`、`agent_completed`、`agent_failed`、`complete` 和 `error` 事件。

源码证据：

- `apps/web/app/api/chat/route.ts:12-45`
- `apps/web/components/ChatPanel.tsx:69-169`
- `apps/web/components/TripPanel.tsx`
- `apps/web/components/TripSection.tsx`

### 3.5 Typed ports、mock 与 live adapter

`AgentContext` 向 specialist 注入 `ToolGateway` 和 `MemoryStore`。Specialist 依赖接口而不是具体 adapter，因此可以在测试中注入 fake，并在运行时切换 mock/live provider。

当前 adapter 状态：

- Maps/Places 支持 deterministic fixture、OpenStreetMap/OSRM 和 Google Maps 分支。
- Booking/Price 只有 deterministic fictional fixtures。
- Booking 不提供真实报价、真实库存、预订写入或支付。
- Weather 没有独立 `WeatherPort` 或 live forecast provider；destination guide 只提供月份级 planning context。

源码证据：

- `packages/shared/src/agent.ts:4-43`
- `packages/shared/src/ports.ts:8-79`
- `packages/tools/src/gateway.ts:10-19`
- `packages/tools/src/maps.ts:11-141`
- `packages/tools/src/booking.ts:1-96`
- `packages/agents/src/destination-guide/index.ts:56-66`

## 4. 尚未完成的运行时能力

### 4.1 可执行 HITL

当前系统可以生成和显示 `HitlCheckpoint`，但用户不能真正 approve、reject 或 resume workflow。

- `TripPanel` 的按钮只把焦点移回聊天输入框。
- `ChatPanel` 明确保留了 inline HITL cards TODO。
- 仓库没有 `POST /api/hitl`。
- workflow 没有持久化 checkpointer 或跨请求 resume 路径。

因此，当前状态应描述为“生成 HITL 决策点并提示用户”，不能描述为“已实现完整 HITL workflow”。

### 4.2 可编辑 preference/filter

`FiltersPanel` 当前所有字段均为 `readOnly`。旅行信息只能通过 chat 修改，filter 尚未写入 `PreferenceMemoryService`。

缺少：

- editable controlled fields；
- nationality、trip style、住宿类型、rating、amenities 等字段；
- preference confirmation；
- long-term preference persistence。

### 4.3 持久化、saved trip 与用户身份

当前 `MemoryStore` 使用进程内 `Map`：

- 进程重启后数据丢失；
- serverless 实例之间不共享；
- `promote()` 是空实现；
- 没有 saved-trip repository；
- 没有重新打开行程的 API；
- auth 固定返回 `demo-user`；
- notification 只执行 `console.log`。

这意味着“durable memory”“plan persistence”“saved trips reopen after refresh”都尚未实现。

### 4.4 真实 provider 与产品闭环

仍缺少：

- 真实 flight/stay 搜索和 freshness labels；
- 真实 booking hand-off；
- live weather forecast；
- opening hours 等更丰富的 Places 证据；
- timeline/map 编辑；
- 编辑后重新执行 route/time/budget validation；
- 新建、保存、恢复旅行的完整单用户闭环。

支付、退款和 booking fulfilment 当前在 roadmap 中属于 out of scope，不应为了增加表面复杂度而提前实现。

## 5. 课程建模缺口

### 5.1 Lab 1–2 项目与团队证据

仓库现有材料不足以确认：

- 是否比较过 1–2 个候选题；
- 是否完成三分钟 pitch；
- tutor 对可行性和范围给出的反馈；
- 3–5 位成员的姓名和职责；
- 每位成员是否拥有至少 2 个 core features 和 1 个 optional feature；
- 团队沟通和冲突解决约定。

`docs/team-workflow.md` 的模块 ownership 是一个良好起点，但还不能代替课程要求的成员—功能责任矩阵。

### 5.2 Lab 3 需求模型

当前已有 use-case diagram，但没有找到：

- Ad-Hoc requirements；
- Feature Model；
- 三类模型之间的映射表。

建议每条关键需求至少能够回答：

```text
它来自哪个真实问题？
→ 属于哪个 feature？
→ 由哪个 use case 实现？
```

### 5.3 Lab 4 Use Case 与 Viewpoint

当前 use case 主要以图和 trace table 表达，缺少完整规格：

- actor；
- trigger；
- preconditions；
- main flow；
- alternative/exception flows；
- postconditions；
- 可验证 acceptance criteria。

设计 rationale 已经体现部分原则，但尚未形成正式 viewpoint analysis。建议至少补充：

- Logical view：领域数据、specialist 职责、共享契约；
- Process view：LangGraph round、并发 dispatch、revision 和 streaming；
- Development view：monorepo packages、dependency direction、团队 ownership；
- Physical view：当前 Next.js runtime、外部 model/maps provider，以及明确不存在的数据库/支付/booking fulfilment；
- Scenarios：用 Submit Requirement、Manage Budget、Confirm Key Itinerary 等 use cases 验证其他视点。

### 5.4 Lab 5 类图与源码一致性

`docs/class-diagram.md` 是 design model，其中包含一些未实现或不以同名 class 存在的元素：

- `TripOrchestrator`；
- `TripOrchestrator.resume()`；
- `SpecialistRegistry`；
- `ConflictDetector`；
- `CostAggregator`；
- `RealBookingAdapter`。

当前源码主要使用 functions、module-level registry、Zod values、TypeScript interfaces 和 compiled `StateGraph`。提交时应采取以下两种方式之一：

1. 把类图更新为当前源码事实；或
2. 清楚区分 `implemented` 与 `planned/design-only`，并解释 TypeScript module/function 如何实现这些设计职责。

否则，类图虽然完整，但无法可靠支撑 Lab 6 的实例化和 traceability。

### 5.5 Lab 6 Object Diagram

仓库当前没有真正的 UML Object Diagram。Architecture、workflow、sequence 和 dataflow 图可以解释系统，但不能替代对象图所要求的“某个时刻的具体实例快照”。

建议选择一个代表性场景：

> 用户提交 Tokyo 行程；round 1 产生五份 proposal；预算超支并出现时间冲突；系统创建定向 `RevisionRequest`；round 2 后仍有一项 pending human decision。

对象图可以包括：

```text
request42:ChatRequest
briefTokyo:TripBrief
graphRun42:OrchestratorState
supervisor42:TripPlanningSupervisor
itineraryP1:AgentProposal
transportP1:AgentProposal
stayP1:AgentProposal
guideP1:AgentProposal
diningP1:AgentProposal
budgetRevision:RevisionRequest
plan42:TripPlan
decision42:HitlCheckpoint
```

每个对象应包含具体值，例如 destination、dates、budget、round、estimated cost、targetAgent 和 status；对象 links 必须符合更新后的 class diagram association 与 multiplicity。

## 6. 文档与源码漂移

### 6.1 LangChain migration 状态矛盾

当前 Git 状态表明 migration 已经 merge 到 `main`，但文档仍同时出现以下冲突描述：

- README 前部说 migration 已落到 `main`；
- README 后部又说 refactor branch 尚未合并；
- `docs/agent-architecture.md` 也写着 “not yet merged into main”。

应统一为当前事实，并把真正尚未完成的部分写成：persistent checkpoints、durable storage、executable HITL 和更细粒度 tool-loop streaming。

### 6.2 Durable state / persistence 表述过强

README 和 architecture 文档多处将 LangGraph state、memory、HITL、plan persistence 描述为 durable，但当前实现：

- 每次请求创建并 invoke 一个 compiled graph；
- 没有 LangGraph checkpointer；
- MemoryStore 是进程内 Map；
- 没有保存和恢复 TripPlan 的 API。

因此应改称“请求内 workflow state”“进程内 memory”和“生成 HITL checkpoints”。

### 6.3 API 文档落后

`docs/api.md` 把 `/api/chat` 描述为普通 JSON response `{ reply, plan }`，实际实现是 streaming NDJSON；最终 `complete` frame 中才携带 `ChatResponse`。

### 6.4 Use Case 和架构图包含未实现能力

现有 use-case/combined architecture 图中出现：

- Booking and Payment Service；
- Weather Service；
- 可执行 Confirm Key Itinerary；
- mind-map 输出；
- preference filter 写入；
- real booking adapter。

这些都不是当前运行时事实。建议：

- 将 `Arrange Transportation` 改为 `Generate / Compare Transport Options`；
- 将 `Arrange Accommodation` 改为 `Generate / Compare Accommodation Options`；
- 将天气 use case 改为 `Provide Seasonal Packing Guidance`，除非实现 `WeatherPort`；
- 把 HITL 标记为 `checkpoint displayed, action pending`；
- 删除 Payment Service 和真实 booking 写入；
- 删除 mind-map alternative，或实现后再恢复。

### 6.5 Scaffold 与实际 provider routing 不一致

`docs/scaffold.md` 仍称 itinerary 使用 DeepSeek、destination guide 和 dining 使用 MiniMax；当前 `MODEL_ROUTING` 已把五个任务全部路由到 DeepSeek。该文档也写着 streaming 可以以后添加，但 streaming NDJSON 已经实现。

## 7. 技术方向判断

以下方向是合理的，建议继续保持：

- **Supervisor–Worker**：职责清楚，delegation 可观察；
- **确定性 LangGraph workflow**：冲突策略、预算红线和停止条件不由模型自由决定；
- **控制与功能分离**：orchestrator 管控制，specialist 管领域提案；
- **Typed ports / dependency injection**：核心代码不直接绑定外部 provider；
- **Zod validation boundary**：模型和工具输出在进入最终计划前受结构化约束；
- **Calculator-backed transport/accommodation**：避免价格、路线和住宿幻觉；
- **Deterministic fallback**：无 key 或 provider 失败时仍可演示和测试；
- **渐进式单用户范围**：暂不加入支付、退款、多用户协作和 booking fulfilment。

需要调整的是投入顺序。当前继续增加 provider 或生产基础设施，对 Lab 1–6 的边际收益低于补齐模型、traceability 和对象图。

## 8. 建议优先级

### P0：先补齐课程证据链

1. 编写 project/company brief 和成员责任矩阵。
2. 补充 Ad-Hoc requirements。
3. 创建 Feature Model。
4. 为核心 use cases 编写完整 textual specifications。
5. 创建 `Requirement → Feature → Use Case → Principle → Component/Class → Runtime Object` traceability matrix。
6. 补充 Design Principles 和 4+1 viewpoint analysis。
7. 更新 class/use-case/architecture 文档，使其与当前源码一致。
8. 创建 Lab 6 Object Diagram。

### P1：完成一个真正的端到端闭环

建议优先实现：

```text
生成 pending HITL
→ 用户 approve / reject
→ 持久化 decision
→ resume / rebuild plan
→ 刷新后仍能恢复
```

这个闭环能同时增强 use case、behavior model、object diagram 和最终演示，比增加另一个外部 API 更有课程价值。

### P2：改善交互与证据质量

- editable filters；
- confirmed preferences；
- timeline/map editing；
- edit 后重新运行 time/route/budget validation；
- live Places/opening-hours evidence；
- provider freshness labels。

### P3：工程维护

当前验证命令还会输出以下维护警告：

- `next lint` 将在 Next.js 16 移除，应迁移到 ESLint CLI；
- 存在多个 lockfile，Next.js 对 workspace root 的推断可能不正确；
- 当前 pnpm 提示 `package.json` 中的 `pnpm.overrides` 未被读取，应确认 override 的实际配置位置。

这些问题不阻塞当前构建，但应在提交前清理，以免 CI 或依赖审计结果与预期不一致。

## 9. 当前验证结果

审计期间按顺序执行了非缓存验证：

```text
pnpm turbo run typecheck --force
pnpm turbo run test --force
pnpm turbo run lint --force
pnpm turbo run build --force
```

结果：

- 6/6 packages TypeScript typecheck 通过；
- 92/92 tests 通过；
- ESLint 无 warning/error；
- Next.js 15.5.25 production build 成功；
- `/` 和 `/api/chat` 均成功生成对应 dynamic route。

测试中的 supervisor warning 是预期的无 provider-key fallback 路径，不是测试失败。

## 10. 提交前完成定义

如果目标是完成 Lab 1–6，而不是完成整个产品 roadmap，建议使用以下 Definition of Done：

- [ ] 真实问题、目标用户、价值和范围有正式说明
- [ ] 至少三个职责不同的 AI 角色有业务理由和协作路径
- [ ] 每位成员的 2 core + 1 optional feature 有明确归属
- [ ] Ad-Hoc、Feature Model 和 Use Cases 相互映射
- [ ] 核心 use cases 有 main、alternative、exception flow 和 postconditions
- [ ] Design Principles 能对应到实际架构决策
- [ ] 4+1/viewpoint analysis 与 stakeholder concerns 对齐
- [ ] 每个架构模式有 problem、application、benefit、limitation 和 rationale
- [ ] 类图明确区分源码事实与 planned design
- [ ] Use Case 到 class/module 的 trace 与当前代码一致
- [ ] Object Diagram 使用具体实例、属性值和 links
- [ ] Object links 符合 class diagram association 和 multiplicity
- [ ] README、API、架构图和当前源码不再互相矛盾
- [ ] 测试、typecheck、lint 和 production build 全部通过


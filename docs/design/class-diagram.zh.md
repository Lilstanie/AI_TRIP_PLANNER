<a id="class-model"></a>

# 类模型

[English](class-diagram.md) | 中文

ELEC5620 Lab 4 Part 2。本文以 5 张共享同一命名空间的 UML 2.5 类图描述 `AI_TRIP_PLANNER` 的静态结构，依据 `main` 上的代码绘制。渲染后的图位于 [`diagrams/`](diagrams/)（从 [`combined-architecture-map.svg`](diagrams/combined-architecture-map.svg) 开始查看）；关系、多重性、接口和设计理由表见下文。

导出函数而非类的 TypeScript 模块以带 `«module»` 构造型的类表示，React 组件和钩子分别使用 `«component»` 和 `«hook»`。当代码返回 `Promise` 时，操作为异步操作；图中展示的是解析后的类型。签名中使用但未展开的辅助类型包括：`Date`（ISO `YYYY-MM-DD` 字符串）、`Money`（AUD 金额）、`AbortSignal`、`BaseChatModel`、`TravelMode`，以及查询 DTO `RouteQuery`、`PlaceQuery`、`StayQuery`、`FlightQuery` 和 `WeatherQuery`。

<a id="notation"></a>

## 记法

| 标记           | 关系 | 含义                                               |
| -------------- | ---- | -------------------------------------------------- |
| 实线、空心三角 | 泛化 | 子类 → 父类（「是一种」）                          |
| 虚线、空心三角 | 实现 | 类 → 接口（「实现」）                              |
| 实线、实心菱形 | 组合 | 整体 ◆ 部分；部分的生命周期不能超过整体            |
| 实线、空心菱形 | 聚合 | 整体 ◇ 部分，共享；部分拥有独立生命周期            |
| 实线、开放箭头 | 关联 | 源持有指向目标的已存储引用                         |
| 虚线、开放箭头 | 依赖 | 仅临时使用（参数、返回值、局部变量）；没有存储字段 |

---

<a id="diagram-1--structural-spine"></a>

## 图 1 — 结构主干

跨越各层的核心类：持有计划状态的浏览器工作区、聊天路由、聊天请求入口与规划图、专职 agent（智能体）注册表，以及注入每个专职 agent 的两个接口。

```mermaid
classDiagram
  direction TB
  class WorkspaceView {
    <<component>>
  }
  class WorkspaceController {
    <<hook>>
    -plan: TripPlan?
    -draft: TripBrief
    -messages: Message[]
    -dataMode: DataMode
  }
  class WorkspaceTransport {
    <<hook>>
    +send(override: String?) void
    +submit() void
  }
  class WorkspaceStorage {
    <<hook>>
    +flushSave() void
  }
  class TripFactChips {
    <<component>>
  }
  class ChatPanel {
    <<component>>
  }
  class TripPanel {
    <<component>>
  }
  class TripEditor {
    <<component>>
  }
  class TripMapCanvas {
    <<component>>
  }
  class DataModeToggle {
    <<component>>
  }
  class ChatRoute {
    +POST(req: ChatRequest) NDJSON stream
  }
  class TripChat {
    <<module>>
    +runTripChat(request: ChatRequest, options: TripChatOptions) ChatResponse
  }
  class OrchestratorGraph {
    <<module>>
    +runOrchestrator(brief: TripBrief, options: OrchestratorOptions) TripPlan
    +createOrchestratorGraph(options: OrchestratorOptions) CompiledGraph
  }
  class SpecialistRegistry {
    <<module>>
    +allSpecialists: Specialist[]
  }
  class Specialist {
    <<interface>>
    +name: AgentName
    +label: String
    +supportsRevision: boolean
    +invoke(request: SpecialistRequest) AgentProposal
  }
  class ToolGateway {
    <<interface>>
  }
  class MemoryStore {
    <<interface>>
  }
  class TripStore {
    <<module>>
    +get(tripId: String) TripPlan
    +set(plan: TripPlan) void
  }

  WorkspaceView "1" --> "1" WorkspaceController : state
  WorkspaceView "1" *-- "1" TripFactChips : contains
  WorkspaceView "1" *-- "1" ChatPanel : contains
  WorkspaceView "1" *-- "1" TripPanel : contains
  WorkspaceView "1" *-- "1" TripEditor : contains
  WorkspaceView "1" *-- "1" TripMapCanvas : contains
  WorkspaceView "1" *-- "1" DataModeToggle : contains
  WorkspaceController "1" --> "0..1" TripPlan : holds
  WorkspaceController "1" *-- "1" WorkspaceTransport : requests
  WorkspaceController "1" *-- "1" WorkspaceStorage : localStorage
  WorkspaceTransport ..> ChatRequest : sends
  TripFactChips ..> TripBrief : edits
  TripPanel ..> TripPlan : renders

  ChatRoute ..> ChatRequest : validates
  ChatRoute ..> TripChat : calls
  ChatRoute ..> TripStore : saves plan
  TripChat ..> OrchestratorGraph : plans with
  TripChat ..> MemoryStore : chat turns
  TripChat ..> ChatResponse : returns
  OrchestratorGraph ..> SpecialistRegistry : specialists
  OrchestratorGraph ..> ToolGateway : creates
  OrchestratorGraph ..> TripPlan : produces
  SpecialistRegistry "1" o-- "5" Specialist : registers
```

---

<a id="diagram-2--domain-model"></a>

## 图 2 — 领域模型

在浏览器、聊天路由、规划图和专职 agent 之间传递的值类型。每种类型都是 `packages/shared` 中的 Zod schema，并在每个边界进行验证。

```mermaid
classDiagram
  direction TB
  class TripBrief {
    +tripId: String
    +userId: String
    +destination: String
    +origin: String?
    +dates: Date[2]
    +groupSize: int
    +budgetTotal: Money
    +budgetSource: BudgetSource?
    +nationality: String?
    +preferences: String[]?
  }
  class AccommodationPreferences {
    +roomAllocation: RoomAllocation
    +minRating: float
    +freeCancellation: boolean
  }
  class BudgetSource {
    +amount: float
    +currency: Currency
  }
  class AgentProposal {
    +agent: AgentName
    +summary: String
    +assumptions: String[]
    +conflictsWith: String[]
  }
  class ProposalItem {
    +id: String?
    +kind: String
    +detail: String
    +estCost: Money?
    +day: int?
    +startTime: String?
    +endTime: String?
    +location: String?
    +placeId: String?
  }
  class AgentProposalSource {
    +kind: SourceKind
    +label: String
    +freshness: String
  }
  class StaySelection {
    +city: String
    +checkIn: Date
    +checkOut: Date
    +nights: int
    +rooms: int
    +selectedId: String
  }
  class StayCandidate {
    +name: String
    +area: String
    +pricePerNight: Money
    +rating: float
    +freeCancellation: boolean
    +grounded: boolean?
  }
  class RevisionRequest {
    +tripId: String
    +targetAgent: AgentName
    +reason: String
    +constraints: String[]
  }
  class TripSection {
    +id: AgentName
    +label: String
    +summary: String
    +status: SectionStatus
    +estCost: Money
  }
  class TripPlan {
    +tripId: String
    +editVersion: int?
    +round: int
    +budgetTotal: Money
    +estTotal: Money
    +overrunPct: float
  }
  class EditIssue {
    +code: EditIssueCode
    +message: String
    +activityIds: String[]
  }
  class ChatRequest {
    +tripId: String
    +message: String
    +mode: ChatMode?
  }
  class PartialTripBrief
  class ChatResponse {
    +reply: String
  }
  class AgentName {
    <<enumeration>>
    ITINERARY
    TRANSPORT
    ACCOMMODATION
    DESTINATION_GUIDE
    DINING
  }
  class SectionStatus {
    <<enumeration>>
    PLANNING
    DRAFT
    NEEDS_YOU
    CONFIRMED
  }
  class SourceKind {
    <<enumeration>>
    LIVE
    ESTIMATED
    MOCK
    FALLBACK
    UNAVAILABLE
  }
  class ChatMode {
    <<enumeration>>
    CHAT
    PLAN
    START
  }
  class Currency {
    <<enumeration>>
    AUD
    CNY
    USD
    JPY
  }

  TripPlan "1" *-- "1" TripBrief : brief
  TripPlan "1" *-- "0..*" TripSection : sections
  TripPlan "1" *-- "0..*" RevisionRequest : conflicts
  TripPlan "1" *-- "0..*" EditIssue : editIssues
  TripSection "1" *-- "0..1" AgentProposal : proposal
  AgentProposal "1" *-- "0..*" ProposalItem : items
  AgentProposal "1" *-- "0..1" AgentProposalSource : source
  AgentProposal "1" *-- "0..*" StaySelection : stays
  StaySelection "1" *-- "1..*" StayCandidate : candidates
  TripBrief "1" *-- "0..1" AccommodationPreferences : accommodation
  TripBrief "1" *-- "0..1" BudgetSource : budgetSource
  ChatRequest "1" *-- "0..1" TripBrief : brief
  ChatRequest "1" *-- "0..1" TripPlan : plan
  ChatRequest "1" *-- "0..1" PartialTripBrief : known
  ChatResponse "1" *-- "1" TripPlan : plan
  AgentProposal ..> AgentName
  RevisionRequest ..> AgentName
  TripSection ..> SectionStatus
  AgentProposalSource ..> SourceKind
  ChatRequest ..> ChatMode
  BudgetSource ..> Currency
```

---

<a id="diagram-3--specialists--orchestration"></a>

## 图 3 — 专职 agent 与编排

`OrchestratorGraph` 是编译后的 LangGraph `StateGraph`：节点派发专职 agent、检测冲突、针对指定专职 agent 执行最多 `maxRounds` 轮修订，并构建计划。它以函数形式调用冲突检测和预算策略，supervisor 辅助函数决定调用哪些专职 agent。每个专职 agent 通过 `AgentContext` 接收依赖，且仅通过共享路由模块调用模型。

```mermaid
classDiagram
  direction TB
  class Specialist {
    <<interface>>
    +name: AgentName
    +label: String
    +supportsRevision: boolean
    +invoke(request: SpecialistRequest) AgentProposal
  }
  class SpecialistRequest {
    +brief: TripBrief
    +context: AgentContext
    +revision: RevisionRequest?
  }
  class AgentContext {
    +tripId: String
    +round: int
    +tools: ToolGateway
    +mem: MemoryStore
    +signal: AbortSignal?
  }
  class ItineraryAgent {
    +supportsRevision: true
    +invoke(request: SpecialistRequest) AgentProposal
  }
  class TransportAgent {
    +supportsRevision: true
    +invoke(request: SpecialistRequest) AgentProposal
    -journeyLegs(brief: TripBrief) JourneyLeg[]
    -legMode(leg: JourneyLeg) TravelMode
  }
  class AccommodationAgent {
    +supportsRevision: true
    +invoke(request: SpecialistRequest) AgentProposal
  }
  class DestinationGuideAgent {
    +supportsRevision: false
    +invoke(request: SpecialistRequest) AgentProposal
  }
  class DiningAgent {
    +supportsRevision: true
    +invoke(request: SpecialistRequest) AgentProposal
  }
  class ModelRouting {
    <<module>>
    +MODEL_ROUTING: Map
    +createRoutedChatModel(task, options) BaseChatModel?
    +createRoutedStructuredInvoker(task, schema, name) Invoker?
  }
  class SpecialistRegistry {
    <<module>>
    +allSpecialists: Specialist[]
  }
  class TripChat {
    <<module>>
    +runTripChat(request: ChatRequest, options: TripChatOptions) ChatResponse
    -runConversationAgent(...) ChatResponse
    -runOffline(...) ChatResponse
  }
  class IncompleteBriefError {
    +missing: String[]
    +known: PartialTripBrief
  }
  class BriefExtractor {
    <<interface>>
    +extract(message: String, current: TripBrief) BriefPatch
  }
  class OrchestratorGraph {
    <<module>>
    -maxRounds: int = 3
    +runOrchestrator(brief: TripBrief, options: OrchestratorOptions) TripPlan
    -dispatch_specialists(state) State
    -detect_conflicts(state) State
    -revise_conflicts(state) State
    -build_plan(state) State
  }
  class Supervisor {
    <<module>>
    +dispatchWithSupervisor(options: SupervisorDispatchOptions) AgentProposal[]
    +reviseWithSupervisor(options: SupervisorRevisionOptions) AgentProposal[]
  }
  class ConflictDetection {
    <<module>>
    +detectConflicts(proposals: AgentProposal[], brief: TripBrief) RevisionRequest[]
  }
  class BudgetPolicy {
    <<module>>
    +ESCALATION_OVERRUN_PCT: float = 10
    +rollUpCost(sections: TripSection[], budgetTotal: Money) CostSummary
  }
  class CostSummary {
    +estTotal: Money
    +overrunPct: float
  }

  Specialist <|.. ItineraryAgent
  Specialist <|.. TransportAgent
  Specialist <|.. AccommodationAgent
  Specialist <|.. DestinationGuideAgent
  Specialist <|.. DiningAgent
  Specialist ..> SpecialistRequest : consumes
  Specialist ..> AgentProposal : returns
  SpecialistRequest "1" *-- "1" AgentContext : context
  AgentContext "1" --> "1" ToolGateway : tools
  AgentContext "1" --> "1" MemoryStore : mem

  ItineraryAgent ..> ModelRouting
  TransportAgent ..> ModelRouting
  AccommodationAgent ..> ModelRouting
  DestinationGuideAgent ..> ModelRouting
  DiningAgent ..> ModelRouting

  SpecialistRegistry "1" o-- "5" Specialist : registers
  TripChat ..> BriefExtractor : extracts with
  TripChat ..> IncompleteBriefError : throws
  TripChat ..> OrchestratorGraph : plans with
  OrchestratorGraph ..> SpecialistRegistry : specialists
  OrchestratorGraph ..> Supervisor : delegates
  OrchestratorGraph ..> ConflictDetection : detects
  OrchestratorGraph ..> BudgetPolicy : rolls up
  OrchestratorGraph ..> AgentContext : creates
  OrchestratorGraph ..> RevisionRequest : emits
  BudgetPolicy ..> CostSummary : returns
```

---

<a id="diagram-4--ports-adapters--infrastructure"></a>

## 图 4 — 端口、适配器与基础设施

六边形架构边界。端口位于 `packages/shared`；`packages/tools` 中的适配器模块实现这些端口，并根据每次请求的数据模式选择 fixture（测试前置数据）或实时提供方。服务端状态统一通过一个键值存储访问；配置 Redis REST API 时使用它，否则使用进程内存。

```mermaid
classDiagram
  direction TB
  class ToolGateway {
    <<interface>>
    +maps: MapsPort
    +booking: BookingPort
    +weather: WeatherPort?
  }
  class MapsPort {
    <<interface>>
    +route(q: RouteQuery) RouteLeg[]
    +places(q: PlaceQuery) Place[]
    +routeOptions(q: RouteQuery) RouteOption[]
  }
  class BookingPort {
    <<interface>>
    +searchStays(q: StayQuery) StayOption[]
    +searchFlights(q: FlightQuery) FlightOption[]
  }
  class WeatherPort {
    <<interface>>
    +forecast(q: WeatherQuery) WeatherResult
  }
  class ToolGatewayFactory {
    <<module>>
    +createToolGateway() ToolGateway
  }
  class DataMode {
    <<module>>
    +mockEnabled() boolean
    +runWithDataMode(mode: Mode, fn) T
    +parseDataMode(value: String) Mode
  }
  class MapsAdapter {
    <<module>>
    -provider: fixture | osm | google
    +route(q) RouteLeg[]
    +places(q) Place[]
    +routeOptions(q) RouteOption[]
  }
  class BookingAdapter {
    <<module>>
    +searchStays(q) StayOption[]
    +searchFlights(q) FlightOption[]
  }
  class SerpApiClient {
    <<module>>
    -MONTHLY_LIMIT: int = 230
    +searchHotelsSerpApi(q) StayOption[]
    +searchFlightsSerpApi(q) FlightOption[]
  }
  class GooglePlacesSearch {
    <<module>>
    +searchGooglePlacesText(query) Place[]
  }
  class WeatherAdapter {
    <<module>>
    +forecast(q) WeatherResult
  }
  class StayOption {
    +name: String
    +area: String
    +pricePerNight: Money
    +rating: float
    +freeCancellation: boolean
    +grounded: boolean?
  }
  class FlightOption {
    +carrier: String
    +price: Money
    +stops: int?
    +durationMin: int?
  }
  class ProviderProvenance {
    +kind: live | estimated | mock
    +provider: String
    +queriedAt: String?
    +fallbackFrom: String?
  }
  class WeatherResult {
    +horizon: forecast | climate
    +summary: String
    +observedAt: String
    +provider: String
  }
  class MemoryStore {
    <<interface>>
    +getShortTerm(tripId: String) ChatTurn[]
    +appendShortTerm(tripId: String, turn: ChatTurn) void
    +getLongTerm(userId: String) UserPreference[]
    +setLongTerm(userId: String, pref: UserPreference) void
    +promote(tripId: String, userId: String, key: String) void
  }
  class PreferenceMemoryService {
    <<module>>
  }
  class TripStore {
    <<module>>
    +get(tripId: String) TripPlan
    +set(plan: TripPlan) void
  }
  class JsonStore {
    <<interface>>
    +get(key: String) T
    +set(key: String, value: T) void
    +increment(key: String) int
    +decrement(key: String) int
  }
  class RedisRestOrLocalStore {
    -url: String?
    -token: String?
  }
  class ChatTurn {
    +role: user | assistant
    +content: String
  }
  class UserPreference {
    +key: String
    +value: String
    +source: filter | chat_confirmed
  }
  class NotificationService {
    <<module>>
    +send(userId: String, message: String) void
  }
  class AuthService {
    <<module>>
    +currentUser() SessionUser
  }

  ToolGatewayFactory ..> ToolGateway : creates
  ToolGatewayFactory ..> DataMode : reads
  ToolGateway "1" o-- "1" MapsPort : maps
  ToolGateway "1" o-- "1" BookingPort : booking
  ToolGateway "1" o-- "0..1" WeatherPort : weather
  MapsPort <|.. MapsAdapter
  BookingPort <|.. BookingAdapter
  WeatherPort <|.. WeatherAdapter
  MapsAdapter ..> DataMode
  BookingAdapter ..> DataMode
  WeatherAdapter ..> DataMode
  MapsAdapter ..> GooglePlacesSearch
  BookingAdapter ..> SerpApiClient : first tier
  BookingAdapter ..> GooglePlacesSearch : estimate tier
  SerpApiClient ..> JsonStore : quota and cache
  BookingPort ..> StayOption : returns
  BookingPort ..> FlightOption : returns
  StayOption "1" *-- "0..1" ProviderProvenance : provenance
  FlightOption "1" *-- "0..1" ProviderProvenance : provenance
  WeatherPort ..> WeatherResult : returns

  MemoryStore <|.. PreferenceMemoryService
  PreferenceMemoryService ..> JsonStore
  TripStore ..> JsonStore
  JsonStore <|.. RedisRestOrLocalStore
  PreferenceMemoryService ..> ChatTurn
  PreferenceMemoryService ..> UserPreference
```

---

<a id="diagram-5--use-cases-traced-onto-the-model"></a>

## 图 5 — 用例在模型中的追踪关系

用例模型中的 10 个 `«use case»`：参与者 `Traveler` 与每个用例关联；用例之间存在 `«include»` / `«extend»` 关系；每个用例通过 `«trace»` 依赖指向实现它的类或模块。成员省略，见图 1–4。

```mermaid
classDiagram
  direction LR

  class Traveler {
    <<actor>>
  }
  namespace UseCases {
    class UC1["Set Preferences (Filter)"] {
      <<use case>>
    }
    class UC2["Submit Requirement (Chat)"] {
      <<use case>>
    }
    class UC3["Generate Itinerary"] {
      <<use case>>
    }
    class UC7["Edit Itinerary (Timeline / Map)"] {
      <<use case>>
    }
    class UC6["Manage Budget"] {
      <<use case>>
    }
    class UC4["Arrange Transportation"] {
      <<use case>>
    }
    class UC5["Arrange Accommodation (Individual / Group)"] {
      <<use case>>
    }
    class UC8["View Weather-based Clothing Recommendation"] {
      <<use case>>
    }
    class UC9["View Food / Cuisine Recommendation"] {
      <<use case>>
    }
    class UC10["View Itinerary Output"] {
      <<use case>>
    }
  }

  Traveler --> UC1
  Traveler --> UC2
  Traveler --> UC3
  Traveler --> UC7
  Traveler --> UC6
  Traveler --> UC4
  Traveler --> UC5
  Traveler --> UC8
  Traveler --> UC9
  Traveler --> UC10

  UC3 ..> UC1 : «include»
  UC3 ..> UC2 : «include»
  UC7 ..> UC3 : «extend»
  UC7 ..> UC6 : «include»

  class TripFactChips {
    <<component>>
  }
  class TripChat {
    <<module>>
  }
  class OrchestratorGraph {
    <<module>>
  }
  class TripEditor {
    <<component>>
  }
  class BudgetPolicy {
    <<module>>
  }
  class TransportAgent
  class AccommodationAgent
  class DestinationGuideAgent
  class WeatherPort {
    <<interface>>
  }
  class DiningAgent
  class TripPlan

  UC1 ..> TripFactChips : «trace»
  UC2 ..> TripChat : «trace»
  UC3 ..> OrchestratorGraph : «trace»
  UC7 ..> TripEditor : «trace»
  UC6 ..> BudgetPolicy : «trace»
  UC4 ..> TransportAgent : «trace»
  UC5 ..> AccommodationAgent : «trace»
  UC8 ..> DestinationGuideAgent : «trace»
  UC9 ..> DiningAgent : «trace»
  UC10 ..> TripPlan : «trace»
  DestinationGuideAgent ..> WeatherPort : forecast
```

| 用例                      | «trace» → 类                                                                    | 负责人 |
| ------------------------- | ------------------------------------------------------------------------------- | ------ |
| 设置偏好（筛选）          | `TripFactChips`（编辑随下一次请求发送的 `TripBrief`）                           | E      |
| 提交需求（聊天）          | `TripChat.runTripChat`（从消息中提取 brief 更新）                               | E      |
| 生成行程                  | `OrchestratorGraph`                                                             | A      |
| 编辑行程（时间线 / 地图） | `TripEditor` 配合 `previewEdit`（`/api/trip/preview-edit`），重新检查路线与预算 | E      |
| 管理预算                  | `BudgetPolicy.rollUpCost`                                                       | C      |
| 安排交通                  | `TransportAgent`                                                                | B      |
| 安排住宿                  | `AccommodationAgent`                                                            | C      |
| 查看基于天气的穿衣建议    | `DestinationGuideAgent`，使用 `WeatherPort`                                     | D      |
| 查看餐饮 / 美食建议       | `DiningAgent`                                                                   | D      |
| 查看行程输出              | `TripPlan`（由 `TripPanel` 和 `TripMapCanvas` 渲染）                            | E      |

---

<a id="key-associations--multiplicity"></a>

## 主要关联与多重性

按 _源 → 目标_ 阅读。

| 源                                      | 目标                                              | 类型 | 多重性         | 含义                                                |
| --------------------------------------- | ------------------------------------------------- | ---- | -------------- | --------------------------------------------------- |
| `WorkspaceView`                         | 面板、编辑器、地图、数据模式开关                  | 组合 | 1 → 1          | 工作区各渲染一个视图                                |
| `WorkspaceController`                   | `TripPlan`                                        | 关联 | 1 → 0..1       | 持有当前计划；首次生成计划前为空                    |
| `WorkspaceController`                   | `WorkspaceTransport` / `WorkspaceStorage`         | 组合 | 1 → 1          | 仅由该控制器使用的请求与 `localStorage` 钩子        |
| `ChatRoute`                             | `TripChat`, `TripStore`                           | 依赖 | —              | 处理一次请求，然后保存生成的计划                    |
| `ChatResponse`                          | `TripPlan`                                        | 组合 | 1 → 1          | 响应携带完整计划                                    |
| `ChatRequest`                           | `TripBrief` / `TripPlan` / `PartialTripBrief`     | 组合 | 1 → 0..1       | 浏览器随每条消息发送其当前状态                      |
| `OrchestratorGraph`                     | `Supervisor`, `ConflictDetection`, `BudgetPolicy` | 依赖 | —              | 从图节点调用的函数                                  |
| `SpecialistRegistry`                    | `Specialist`                                      | 聚合 | 1 → 5          | 引用模块级 agent；不拥有其生命周期                  |
| `SpecialistRequest`                     | `AgentContext`                                    | 组合 | 1 → 1          | 每次调用携带自己的上下文                            |
| `AgentContext`                          | `ToolGateway` / `MemoryStore`                     | 关联 | 1 → 1          | 通过注入提供，是专职 agent 访问工具与记忆的唯一途径 |
| `TripPlan`                              | `TripBrief`                                       | 组合 | 1 → 1          | 内嵌该计划所回应的 brief                            |
| `TripPlan`                              | `TripSection`                                     | 组合 | 1 → 0..*       | 每个返回提案的专职 agent 对应一个分节               |
| `TripPlan`                              | `RevisionRequest`                                 | 组合 | 1 → 0..*       | 最后一轮后仍未解决的冲突                            |
| `TripSection`                           | `AgentProposal`                                   | 组合 | 1 → 0..1       | 用于构建该分节的提案，可展开查看                    |
| `AgentProposal`                         | `ProposalItem`                                    | 组合 | 1 → 0..*       | 提案由其明细项列表组成                              |
| `AgentProposal`                         | `AgentProposalSource`                             | 组合 | 1 → 0..1       | 数据来源：实时、估算、mock、回退、不可用            |
| `StaySelection`                         | `StayCandidate`                                   | 组合 | 1 → 1..*       | 选定住宿及其备选项                                  |
| `ToolGateway`                           | `MapsPort` / `BookingPort` / `WeatherPort`        | 聚合 | 1 → 1, 1, 0..1 | 每种端口各一个；天气端口可选                        |
| `StayOption` / `FlightOption`           | `ProviderProvenance`                              | 组合 | 1 → 0..1       | 哪个提供方作出响应，以及是否使用了回退              |
| `PreferenceMemoryService` / `TripStore` | `JsonStore`                                       | 依赖 | —              | 所有读写都通过该存储                                |

<a id="interfaces--realisation"></a>

## 接口与实现

| 接口             | 实现方                                                                                           | 说明                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Specialist`     | `ItineraryAgent`, `TransportAgent`, `AccommodationAgent`, `DestinationGuideAgent`, `DiningAgent` | 一个 `invoke(SpecialistRequest)`；只有目的地指南不能修订                    |
| `ToolGateway`    | `createToolGateway()` 返回的对象                                                                 | 每次规划运行一个                                                            |
| `MapsPort`       | `MapsAdapter`（`maps.ts`）                                                                       | 负责人 B；fixture、OpenStreetMap 或 Google                                  |
| `BookingPort`    | `BookingAdapter`（`booking.ts`）                                                                 | 负责人 C；先用 SerpApi，再用 Google Places 估算，或使用 fixture；不涉及支付 |
| `WeatherPort`    | `WeatherAdapter`（`weather.ts`）                                                                 | 负责人 D；Google Weather、Open-Meteo 或气候上下文                           |
| `MemoryStore`    | `PreferenceMemoryService`（`memory`）                                                            | 负责人 E                                                                    |
| `JsonStore`      | `RedisRestOrLocalStore`（`createJsonStore()`）                                                   | 负责人 E；配置后使用 Redis REST，否则使用进程内存                           |
| `BriefExtractor` | `chat.ts` 中的模型提取器，或无密钥时的 `extractBriefPatchLocally`                                | 负责人 A                                                                    |

`NotificationService` 和 `AuthService` 是桩实现：通知仅写入日志，每次请求均使用演示用户。

<a id="design-rationale"></a>

## 设计理由

- **`Specialist` 是与框架无关的接口** — 图遍历 `Specialist[]` 并调用 `invoke(SpecialistRequest)`，无需了解具体 agent 或其是否使用模型。决策见 [LangGraph 说明](../../.agents/notes/implemented/architecture/2026-09-08-langgraph-orchestration.md)。
- **控制与功能分离** — 图负责状态、轮次和顺序；冲突检测和预算策略是它调用的普通函数，可脱离图测试。
- **`SpecialistRegistry → Specialist` 是聚合** — agent 是模块级值；注册表列出它们，但不拥有其生命周期。
- **依赖通过 `AgentContext` 注入** — 专职 agent 从不导入具体服务，因此单元测试可传入假的 `ToolGateway` 或 `MemoryStore`。
- **端口位于 `packages/shared`（六边形架构）** — 核心不引用具体适配器，因此可更换提供方而无需修改专职 agent 或图的代码。每次请求由 `DataMode` 选择 mock 或实时模式（[说明](../../.agents/notes/implemented/feature/2026-09-21-request-scoped-data-mode.md)）。
- **来源信息随数据传递** — 工具结果上的 `ProviderProvenance` 转换为提案上的 `AgentProposalSource`，使 UI 可说明价格是实时、估算还是 mock（[说明](../../.agents/notes/implemented/bug-fix/2026-09-21-proposal-source-kind.md)）。
- **`TripPlan` 组合一个 `TripBrief` 快照** — 一个计划回应一个 brief；之后编辑 brief，不能悄悄改变已有计划的声明。
- **旅行者编辑，而非批准** — 没有需要确认的检查点；修改通过聊天或 `TripEditor` 完成，其预览重新执行路线与预算检查（[说明](../../.agents/notes/implemented/simplification/2026-09-22-remove-hitl-decisions.md)）。

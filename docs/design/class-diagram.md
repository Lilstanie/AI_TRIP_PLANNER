# Class model

ELEC5620 Lab 4 Part 2. Static structure of `AI_TRIP_PLANNER` as five UML 2.5 class diagrams that
share one namespace, drawn from the code on `main`. Rendered diagrams are in
[`diagrams/`](diagrams/) (start with
[`combined-architecture-map.svg`](diagrams/combined-architecture-map.svg)); the relationship,
multiplicity, interface and rationale tables are below.

TypeScript modules that export functions rather than classes appear as classes with the `«module»`
stereotype, and React components and hooks as `«component»` and `«hook»`. Operations are
asynchronous where the code returns a `Promise`; the diagrams show the resolved type. Supporting
types used in signatures but not expanded: `Date` (an ISO `YYYY-MM-DD` string), `Money` (an AUD
amount), `AbortSignal`, `BaseChatModel`, `TravelMode`, and the query DTOs `RouteQuery`, `PlaceQuery`,
`StayQuery`, `FlightQuery` and `WeatherQuery`.

## Notation

| Mark                         | Relationship   | Meaning                                                        |
| ---------------------------- | -------------- | -------------------------------------------------------------- |
| solid line, hollow triangle  | generalisation | subclass → superclass ("is a kind of")                         |
| dashed line, hollow triangle | realisation    | class → interface ("implements")                               |
| solid line, filled diamond   | composition    | whole ◆ part; part cannot outlive the whole                    |
| solid line, hollow diamond   | aggregation    | whole ◇ part, shared; part has an independent lifetime         |
| solid line, open arrow       | association    | source holds a stored reference to the target                  |
| dashed line, open arrow      | dependency     | transient use only (parameter, return, local); no stored field |

---

## Diagram 1 — Structural spine

Load-bearing classes across every layer: the browser workspace that holds plan state, the chat route,
the chat intake and planning graph, the specialist registry, and the two interfaces injected into
every specialist.

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
    +save() void
    +loadSaved() void
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

## Diagram 2 — Domain model

The value types carried between the browser, the chat route, the planning graph and the
specialists. Every type is a Zod schema in `packages/shared`, validated at each boundary.

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

## Diagram 3 — Specialists & orchestration

`OrchestratorGraph` is a compiled LangGraph `StateGraph` whose nodes dispatch the specialists, detect
conflicts, revise the targeted specialists for up to `maxRounds` rounds and build the plan. It calls
conflict detection and the budget policy as functions, and the supervisor helpers choose which
specialists to call. Each specialist receives its dependencies through `AgentContext` and calls
models only through the shared routing module.

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

## Diagram 4 — Ports, adapters & infrastructure

The hexagonal boundary. Ports live in `packages/shared`; the adapter modules in `packages/tools`
implement them, choosing fixtures or live providers per request through the data mode. Server state
goes through one key-value store that uses a Redis REST API when configured and process memory
otherwise.

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

## Diagram 5 — Use cases traced onto the model

The ten `«use case»` from the use case model: the actor `Traveler` is associated with every use case;
`«include»` / `«extend»` hold between use cases; and a `«trace»` dependency runs from each use case to
the class or module that realises it. Members are omitted; they are in diagrams 1–4.

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

| Use case                                   | «trace» → class                                                                          | Owner |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | ----- |
| Set Preferences (Filter)                   | `TripFactChips` (edits the `TripBrief` sent with the next request)                       | E     |
| Submit Requirement (Chat)                  | `TripChat.runTripChat` (extracts brief updates from the message)                         | E     |
| Generate Itinerary                         | `OrchestratorGraph`                                                                      | A     |
| Edit Itinerary (Timeline / Map)            | `TripEditor` with `previewEdit` (`/api/trip/preview-edit`), re-checking route and budget | E     |
| Manage Budget                              | `BudgetPolicy.rollUpCost`                                                                | C     |
| Arrange Transportation                     | `TransportAgent`                                                                         | B     |
| Arrange Accommodation                      | `AccommodationAgent`                                                                     | C     |
| View Weather-based Clothing Recommendation | `DestinationGuideAgent`, using `WeatherPort`                                             | D     |
| View Food / Cuisine Recommendation         | `DiningAgent`                                                                            | D     |
| View Itinerary Output                      | `TripPlan` (rendered by `TripPanel` and `TripMapCanvas`)                                 | E     |

---

## Key associations & multiplicity

Read _source → target_.

| Source                                  | Target                                            | Type        | Mult.          | Meaning                                                                |
| --------------------------------------- | ------------------------------------------------- | ----------- | -------------- | ---------------------------------------------------------------------- |
| `WorkspaceView`                         | panels, editor, map, data-mode toggle             | composition | 1 → 1          | the workspace renders one of each view                                 |
| `WorkspaceController`                   | `TripPlan`                                        | association | 1 → 0..1       | holds the current plan; none before the first plan                     |
| `WorkspaceController`                   | `WorkspaceTransport` / `WorkspaceStorage`         | composition | 1 → 1          | request and `localStorage` hooks used only by this controller          |
| `ChatRoute`                             | `TripChat`, `TripStore`                           | dependency  | —              | handles one request, then saves the resulting plan                     |
| `ChatResponse`                          | `TripPlan`                                        | composition | 1 → 1          | a response carries a full plan                                         |
| `ChatRequest`                           | `TripBrief` / `TripPlan` / `PartialTripBrief`     | composition | 1 → 0..1       | the browser sends its current state with each message                  |
| `OrchestratorGraph`                     | `Supervisor`, `ConflictDetection`, `BudgetPolicy` | dependency  | —              | functions called from graph nodes                                      |
| `SpecialistRegistry`                    | `Specialist`                                      | aggregation | 1 → 5          | references module-level agents; no lifecycle ownership                 |
| `SpecialistRequest`                     | `AgentContext`                                    | composition | 1 → 1          | each call carries its own context                                      |
| `AgentContext`                          | `ToolGateway` / `MemoryStore`                     | association | 1 → 1          | injected — the specialist's only route to tools and memory             |
| `TripPlan`                              | `TripBrief`                                       | composition | 1 → 1          | embeds the brief it answers                                            |
| `TripPlan`                              | `TripSection`                                     | composition | 1 → 0..*       | one section per specialist that returned a proposal                    |
| `TripPlan`                              | `RevisionRequest`                                 | composition | 1 → 0..*       | conflicts still unresolved after the last round                        |
| `TripSection`                           | `AgentProposal`                                   | composition | 1 → 0..1       | the proposal the section was built from, for drill-down                |
| `AgentProposal`                         | `ProposalItem`                                    | composition | 1 → 0..*       | a proposal is its list of line items                                   |
| `AgentProposal`                         | `AgentProposalSource`                             | composition | 1 → 0..1       | where the data came from: live, estimated, mock, fallback, unavailable |
| `StaySelection`                         | `StayCandidate`                                   | composition | 1 → 1..*       | the chosen stay and its alternatives                                   |
| `ToolGateway`                           | `MapsPort` / `BookingPort` / `WeatherPort`        | aggregation | 1 → 1, 1, 0..1 | one port of each kind; weather is optional                             |
| `StayOption` / `FlightOption`           | `ProviderProvenance`                              | composition | 1 → 0..1       | which provider answered and whether it was a fallback                  |
| `PreferenceMemoryService` / `TripStore` | `JsonStore`                                       | dependency  | —              | every read and write goes through the store                            |

## Interfaces & realisation

| Interface        | Realised by                                                                                      | Note                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `Specialist`     | `ItineraryAgent`, `TransportAgent`, `AccommodationAgent`, `DestinationGuideAgent`, `DiningAgent` | one `invoke(SpecialistRequest)`; only the destination guide cannot revise |
| `ToolGateway`    | object returned by `createToolGateway()`                                                         | one per planning run                                                      |
| `MapsPort`       | `MapsAdapter` (`maps.ts`)                                                                        | owner B; fixtures, OpenStreetMap or Google                                |
| `BookingPort`    | `BookingAdapter` (`booking.ts`)                                                                  | owner C; SerpApi, then Google Places estimate, or fixtures; no payment    |
| `WeatherPort`    | `WeatherAdapter` (`weather.ts`)                                                                  | owner D; Google Weather, Open-Meteo or climate context                    |
| `MemoryStore`    | `PreferenceMemoryService` (`memory`)                                                             | owner E                                                                   |
| `JsonStore`      | `RedisRestOrLocalStore` (`createJsonStore()`)                                                    | owner E; Redis REST when configured, process memory otherwise             |
| `BriefExtractor` | model extractor in `chat.ts`, or `extractBriefPatchLocally` without a key                        | owner A                                                                   |

`NotificationService` and `AuthService` are stubs: notifications are logged, and every request is the
demo user.

## Design rationale

- **`Specialist` is the framework-neutral interface** — the graph iterates `Specialist[]` and calls
  `invoke(SpecialistRequest)` without knowing the concrete agent or whether it uses a model. The
  decision is in the [LangGraph note](../../.agents/notes/implemented/architecture/2026-09-08-langgraph-orchestration.md).
- **Control and function are separate** — the graph owns state, rounds and ordering; conflict
  detection and the budget policy are plain functions it calls, testable without the graph.
- **`SpecialistRegistry → Specialist` is aggregation** — agents are module-level values; the registry
  lists them but does not own their lifecycle.
- **Dependencies are injected through `AgentContext`** — specialists never import concrete services,
  so a unit test passes a fake `ToolGateway` or `MemoryStore`.
- **Ports in `packages/shared` (hexagonal)** — the core never names a concrete adapter, so providers
  can change without touching specialist or graph code. Mock or live is chosen per request by
  `DataMode` ([note](../../.agents/notes/implemented/feature/2026-09-21-request-scoped-data-mode.md)).
- **Provenance travels with the data** — `ProviderProvenance` on tool results becomes
  `AgentProposalSource` on proposals, so the UI can say whether a price is live, estimated or mock
  ([note](../../.agents/notes/implemented/bug-fix/2026-09-21-proposal-source-kind.md)).
- **`TripPlan` composes a `TripBrief` snapshot** — a plan answers one brief; a later edit to the brief
  cannot silently change what an existing plan claims.
- **The traveller edits rather than approves** — there is no checkpoint to confirm; changes are made
  in chat or through `TripEditor`, whose previews re-run route and budget checks
  ([note](../../.agents/notes/implemented/simplification/2026-09-22-remove-hitl-decisions.md)).

<a id="architecture-diagrams"></a>

# Architecture diagrams

English | [中文](architecture-diagrams.zh.md)

These diagrams describe the current runtime and browser flows. Each opens as a standalone Archify HTML viewer; its editable JSON source and browser evidence are stored separately.

## File layout

- `system/`, `agent-workflows/`, `data-and-storage/`, and `workspace/` group diagrams by project area; `stage1-member-c/` holds the ELEC5620 Stage 1 behaviour diagrams.
- Each area contains `specs/` (editable Archify JSON), `rendered/` (standalone HTML), and `evidence/` (visual-check reports, contact sheets, and screenshots).

Each entry links to the viewer, source, and visual-check contact sheet.

## System structure and trust boundaries

- [Project architecture](architecture-diagrams/system/rendered/project-overview.html) ([source](architecture-diagrams/system/specs/project-overview.architecture.json), [evidence](architecture-diagrams/system/evidence/project-overview.visual-check.html)) — Next.js request path, LangGraph workflow, specialists, LangChain model calls, and the tool gateway.
- [Agent and evidence trust boundaries](architecture-diagrams/agent-workflows/rendered/agent-trust-boundaries.html) ([source](architecture-diagrams/agent-workflows/specs/agent-trust-boundaries.architecture.json), [evidence](architecture-diagrams/agent-workflows/evidence/agent-trust-boundaries.visual-check.html)) — traveller input, coordinator-only attachments, injected agent capabilities, and external providers.
- [Shared contracts](architecture-diagrams/system/rendered/contracts-flow.html) ([source](architecture-diagrams/system/specs/contracts-flow.workflow.json), [evidence](architecture-diagrams/system/evidence/contracts-flow.visual-check.html)) — how `ChatRequest`, `TripBrief`, `AgentProposal`, and `TripPlan` cross package boundaries.

## Chat and planning

- [Chat and LangChain](architecture-diagrams/agent-workflows/rendered/chat-langchain.html) ([source](architecture-diagrams/agent-workflows/specs/chat-langchain.workflow.json), [evidence](architecture-diagrams/agent-workflows/evidence/chat-langchain.visual-check.html)) — coordinator tools, incomplete-brief questions, the no-model path, and the handoff to LangGraph.
- [Chat request and NDJSON stream](architecture-diagrams/agent-workflows/rendered/chat-stream.html) ([source](architecture-diagrams/agent-workflows/specs/chat-stream.sequence.json), [evidence](architecture-diagrams/agent-workflows/evidence/chat-stream.visual-check.html)) — request validation, progress frames, final response, persistence, and non-plan outcomes.
- [Agent collaboration](architecture-diagrams/agent-workflows/rendered/agent-collaboration.html) ([source](architecture-diagrams/agent-workflows/specs/agent-collaboration.workflow.json), [evidence](architecture-diagrams/agent-workflows/evidence/agent-collaboration.visual-check.html)) — specialist dispatch, the shared planning board, conflict checks, targeted revisions, and stop conditions.
- [Plan-section lifecycle](architecture-diagrams/agent-workflows/rendered/plan-lifecycle.html) ([source](architecture-diagrams/agent-workflows/specs/plan-lifecycle.lifecycle.json), [evidence](architecture-diagrams/agent-workflows/evidence/plan-lifecycle.visual-check.html)) — when a section becomes `draft` or `needs_you`, and how the traveller continues.

## Data, storage and services

- [ToolGateway and providers](architecture-diagrams/data-and-storage/rendered/tool-gateway.html) ([source](architecture-diagrams/data-and-storage/specs/tool-gateway.workflow.json), [evidence](architecture-diagrams/data-and-storage/evidence/tool-gateway.visual-check.html)) — request-scoped mock/live mode, provider adapters, and evidence returned to agents.
- [Storage and account sync](architecture-diagrams/data-and-storage/rendered/storage-sync.html) ([source](architecture-diagrams/data-and-storage/specs/storage-sync.workflow.json), [evidence](architecture-diagrams/data-and-storage/evidence/storage-sync.visual-check.html)) — browser catalog, signed-in account sync, `MemoryStore`, `tripStore`, and durable-store fallback.
- [Local and account sync sequence](architecture-diagrams/data-and-storage/rendered/account-sync.html) ([source](architecture-diagrams/data-and-storage/specs/account-sync.sequence.json), [evidence](architecture-diagrams/data-and-storage/evidence/account-sync.visual-check.html)) — per-record timestamp merge, deletion tombstones, delayed pushes, and offline retention.

## Workspace behavior

- [Trip editing](architecture-diagrams/workspace/rendered/trip-edit.html) ([source](architecture-diagrams/workspace/specs/trip-edit.workflow.json), [evidence](architecture-diagrams/workspace/evidence/trip-edit.visual-check.html)) — place search, edit preview, route/budget/conflict recomputation, and version-checked apply.
- [Map exploration](architecture-diagrams/workspace/rendered/map-exploration.html) ([source](architecture-diagrams/workspace/specs/map-exploration.workflow.json), [evidence](architecture-diagrams/workspace/evidence/map-exploration.visual-check.html)) — Places queries and traveller-location routes appear on the map without rerunning the planner.

## ELEC5620 Stage 1: member C behaviour

The full rendered versions of the activity, sequence and state machine diagrams in [Stage 1 behaviour models](design/stage1/04-member-c-behaviour.md). The Mermaid blocks on that page are their text source. These views can be taller than one screen.

- [Arrange Accommodation activity (UC-C1)](architecture-diagrams/stage1-member-c/rendered/c-activity.html) ([source](architecture-diagrams/stage1-member-c/specs/c-activity.workflow.json), [evidence](architecture-diagrams/stage1-member-c/evidence/c-activity.visual-check.html)) — booked-stay shortcut, room and segment preparation, live search with the Places fallback, the single LLM choice and the deterministic guards before pricing.
- [Budget overrun and targeted revision (UC-C2)](architecture-diagrams/stage1-member-c/rendered/c-sequence.html) ([source](architecture-diagrams/stage1-member-c/specs/c-sequence.sequence.json), [evidence](architecture-diagrams/stage1-member-c/evidence/c-sequence.visual-check.html)) — first round, `detectConflicts`, the revision loop with `targetSaving`, and the reply; the infeasible-budget extension is in the card.
- [Accommodation section state machine](architecture-diagrams/stage1-member-c/rendered/c-state.html) ([source](architecture-diagrams/stage1-member-c/specs/c-state.workflow.json), [evidence](architecture-diagrams/stage1-member-c/evidence/c-state.visual-check.html)) — internal states behind the `planning`, `draft` and `needs_you` statuses, with every guard and the revision loop.

## How LangChain is used

LangGraph (`@langchain/langgraph`) owns the deterministic planning state machine. It decides when to dispatch specialists, detect conflicts, revise targeted proposals, and build or stop at a `TripPlan`. LangChain does not choose the graph's next state.

LangChain JS (`langchain`) provides `createAgent` for the conversation coordinator, dispatch and revision supervisors, and five role-specific agents. The coordinator exposes `update_trip_brief`, `ask_user_question`, and `replan_trip` as typed tools. Specialists use bounded evidence tools; structured results are parsed against shared Zod contracts.

`packages/agents/src/models.ts` centralizes model routing through the OpenAI-compatible DeepSeek adapter. MiniMax is configured but not routed. Model or tool failures keep planning available through validated deterministic fallbacks. Agents receive `ToolGateway` and `MemoryStore` through `AgentContext`; they do not import provider or service singletons.

See [Architecture](architecture.md) for runtime details, [API](api.md) for request/response contracts, and [Workspace UI](workspace-ui.md) for current interface behavior.

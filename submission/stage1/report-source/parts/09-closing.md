# 9. Relationships between key components and future development

| Component                                                          | Depends on                                   | Extension point for future work                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts (`TripBrief`, `AgentProposal`, `TripPlan`, ports) | nothing                                      | A new field is added once, validated by Zod everywhere; a contract change needs an Agent Note, so every owner sees it.                                    |
| `Specialist` interface and registry                                | contracts                                    | A sixth specialist (for example, events or visas) implements `invoke` and joins the registry; the graph and board need no change beyond its budget share. |
| LangGraph workflow                                                 | `Specialist`, conflict policy, budget policy | New conflict types plug into `detectConflicts`; the loop, round limit and scoring stay the same.                                                          |
| Planning board                                                     | specialist proposals                         | Stage order and budget shares live in one table, so a new dependency between agents is one row.                                                           |
| `ToolGateway` and ports                                            | provider adapters                            | A new provider is a new adapter behind an existing port, with mock mode, typed failures and provenance kept.                                              |
| `MemoryStore` and stores                                           | Redis REST or process memory                 | Another store realises the same interface without touching agents.                                                                                        |
| Workspace UI                                                       | `ChatResponse`, `TripPlan`, NDJSON events    | Reads only contracts, so new sections render through the same card and timeline components.                                                               |
| Agent Lab                                                          | the real workflow and specialists            | New scenarios and faults are registered values, so each design change can be measured before it ships.                                                    |

Planned work that these relationships support: verifying live providers end to end, an on-trip mode,
flight status through a dedicated provider, and booking links through an affiliate provider.

# 10. Design rationale and discarded choices

| Decision                     | Chosen                                                                                                         | Discarded and why                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who drives the planning loop | A deterministic LangGraph state machine; models act only inside nodes                                          | _Hand-written loop_: revision targeting and round limits were scattered. _Let a model drive the loop_: round limits, conflict detection and cost roll-up must be deterministic and testable.                                                                                        |
| How agents collaborate       | A staged planning board: transport, then accommodation, then itinerary and dining, each with a budget share    | _More rounds only_: every round saw the same inputs and blind budget shares overran. _Fully sequential_: destination and dining do not constrain each other, so it only adds latency. _Free model-to-model negotiation_: moves control flow into model output and cannot be tested. |
| Human in the loop            | The traveller edits the plan in chat or the editor; sections still in conflict are marked `needs_you`          | _Approval checkpoints_ (the early design's "confirm key itinerary"): removed because confirming applied nothing downstream; a real checkpoint needs a booking action the product does not have.                                                                                     |
| LLM provider                 | DeepSeek for every model step                                                                                  | _MiniMax_: comparable drafts but 15 to 25 s per structured call; full pages took 37 to 81 s against 15 to 23 s. Kept wired as a backup.                                                                                                                                             |
| Prices and places            | Only from tools, with provenance on every proposal; transport and accommodation wrap deterministic calculators | _Let the model estimate prices_: invents hotels and fares.                                                                                                                                                                                                                          |
| Data mode                    | Mock by default, live chosen per request                                                                       | _Deploy-time only_: comparing mock and live needed a redeploy. _Per-request environment variable_: leaks between concurrent serverless requests.                                                                                                                                    |
| Server state                 | Redis REST store with in-process fallback                                                                      | _Process memory_: lost on serverless cold starts. _A relational database for everything_: the data is small JSON by key.                                                                                                                                                            |
| Money                        | AUD in integer cents                                                                                           | Floating-point totals drift.                                                                                                                                                                                                                                                        |
| Evaluation                   | Agent Lab runs the real workflow against a single-agent baseline                                               | _A separate simpler planner as baseline_: differences would reflect its code, not specialisation.                                                                                                                                                                                   |

# 11. Change assessment and acceptance

**Assessing a change.** Every proposed change starts as a GitHub issue triaged with one of five
labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). The owner of
the affected package (§5.3) assesses it against three questions:

1. Which requirement (§2) and use case (§4) does it trace to? A change with no trace is either
   rejected or added to the requirements first.
2. Does it touch a shared contract in `packages/shared`? If so, it needs an Agent Note in the same
   pull request and every package owner is told, because all packages depend on it.
3. Does it reverse an implemented decision (§10)? If so, a superseding note is written; a decision
   is never reversed silently.

**Accepting a change.** A pull request is accepted when:

- CI passes on its head: typecheck, lint, unit and workflow tests, production build, documentation
  link and pairing checks, and the protected-files check.
- Complex behaviour has an end-to-end test that leaves a repeatable artifact (for agent behaviour, an
  Agent Lab run artifact).
- The affected use case's postconditions still hold, for example `estTotal` ≤ `budgetTotal` or an
  explicit `infeasible budget` conflict for UC-C2.
- The documentation and design model describing the change are updated in the same pull request,
  in English and Chinese.
- The MVP definition of done still holds: grounded and labelled data, visible conflicts after edits,
  saved trips reopen, and provider failures degrade visibly without fictional prices.

# 12. Design assumptions

1. One traveller plans one trip at a time; there is no multi-user collaboration.
2. All amounts are stored and compared in AUD. A budget stated in CNY, USD or JPY is converted once,
   with static rates, when it is read from the traveller's message.
3. Prices are estimates for planning; the system never books or takes payment.
4. Flights are paid first, so accommodation, itinerary and dining share the money left after
   transport (40%, 40% and 20%).
5. Two guests share a room unless the traveller asks for individual rooms.
6. A model call can fail, time out or return off-schema output at any time, so every model step has
   a validated deterministic fallback.
7. Providers can be unavailable or over quota; the system then labels estimates or mock data rather
   than hiding the failure.
8. Three revision rounds are enough for convergence on realistic trips; beyond that the traveller
   decides.
9. Weather is a forecast only within 14 days; beyond that the guide gives climate context.
10. The traveller can read English or Chinese, and writes dates in any common form.

# 13. Contributions and use of generative AI

## 13.1 Individual contributions to group tasks

The group shared every group task equally.

| Group task                                            | A   | B   | C   | D   | E   |
| ----------------------------------------------------- | --- | --- | --- | --- | --- |
| Project requirements and classification (§1–2)        | 20% | 20% | 20% | 20% | 20% |
| Feature diagram (§3)                                  | 20% | 20% | 20% | 20% | 20% |
| Overall use case diagram (§4.1)                       | 20% | 20% | 20% | 20% | 20% |
| Architecture, package and deployment (§5)             | 20% | 20% | 20% | 20% | 20% |
| Class model (§6)                                      | 20% | 20% | 20% | 20% | 20% |
| Object diagram, collaboration, structured class (§7)  | 20% | 20% | 20% | 20% | 20% |
| Relationships, rationale, change, assumptions (§9–12) | 20% | 20% | 20% | 20% | 20% |
| Video presentation                                    | 20% | 20% | 20% | 20% | 20% |

## 13.2 Individual tasks

| Member | Ad hoc requirement | Use case specification | Activity | Sequence | State machine |
| ------ | ------------------ | ---------------------- | -------- | -------- | ------------- |
| A      | AH-A1 (§2.3.1)     | UC-A1                  | §8.1.1   | §8.1.2   | §8.1.3        |
| B      | AH-B1 (§2.3.2)     | UC-B1                  | §8.2.1   | §8.2.2   | §8.2.3        |
| C      | AH-C1 (§2.3.3)     | UC-C1, UC-C2           | §8.3.1   | §8.3.2   | §8.3.3        |
| D      | AH-D1 (§2.3.4)     | UC-D1                  | §8.4.1   | §8.4.2   | §8.4.3        |
| E      | AH-E1 (§2.3.5)     | UC-E1                  | §8.5.1   | §8.5.2   | §8.5.3        |

## 13.3 Use of generative AI

Parts of this report were drafted with Claude (Anthropic) from the group's repository and design
notes, and then reviewed by the group. The models were checked against the code on `main`, and each
member can explain their own diagrams.

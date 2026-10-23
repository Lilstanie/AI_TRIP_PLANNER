# Think disclosure failure inventory

Issue #548 reports that streamed orchestration reasoning appears under the collapsed Think row while a budget revision is running. Before changing production code, this inventory records the paths that could reproduce or accidentally broaden the regression.

| Failure mode                                                        | Required behavior                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The latest `agent_reasoning` delta is the newest turn event         | Collapsed Think shows the existing traveller-facing live status, not the raw last line. |
| A running subagent has a streamed reasoning block                   | Its collapsed row does not expose the raw summary.                                      |
| Think is expanded but a subagent remains collapsed                  | The subagent summary remains safe; expanding Think alone does not disclose reasoning.   |
| A subagent is expanded but its reasoning row remains collapsed      | The reasoning summary remains safe until that row is opened.                            |
| The reasoning row is explicitly expanded                            | The complete streamed text remains available to the reader.                             |
| A tool/lifecycle event follows a reasoning delta                    | The turn still shows the existing live tool/subagent progress.                          |
| The turn completes                                                  | Existing count summary and completed state remain intact.                               |
| The turn fails                                                      | Existing localized error and error state remain intact.                                 |
| Interface language is Chinese                                       | Safe progress copy remains localized; internal orchestration phrases are absent.        |
| Phone viewport is narrow                                            | The disclosure remains reachable without horizontal page overflow.                      |
| The deterministic debug fixture is mistaken for a live provider run | Evidence labels it simulated; it does not claim model/provider behavior.                |

The browser regression will use `/debug/thinking`, which renders the public `ThinkingProcess` UI from deterministic streamed-event fixtures. It verifies presentation and disclosure behavior only; it does not exercise a live planner or model.

# Agent Note: Agent Lab public release

Status: implemented
Owner: A (@Lilstanie)

## Problem

Agent Lab had grown by slices: a run view, a comparison, the Failure Lab, a live gate. Each worked, but a visitor
met four unrelated surfaces. The views were named differently, the explanation of why the planner is built this
way sat in two short paragraphs at the foot of the page, and the way a run ended was worded only in the Failure
Lab. Nothing proved that the whole flow held together in dark mode, on a phone, with reduced motion or by keyboard.

## Decision

The public lab is four views in one navigation group: Run, Compare, Failures and Architecture. The current one is
marked pressed, Compare is unavailable only until a run exists, and every view opens by keyboard. The group stays a
set of toggle buttons: it is already operable, and the full tab pattern with arrow keys would add behaviour without
adding access.

The footer notes become the Architecture view. It states who owns what (LangGraph the workflow state, order,
conflict detection, revision routing and stopping; LangChain agents the bounded reasoning), the five capability
boundaries with each one's goal, tools, output and way of failing, why budgeting, conflict detection, state
transitions, maps and weather are nodes or tools and not agents, why five is not a fixed number, and how to read the
results, including fixture and live and the outcome words.

One outcome word describes how any run ended, from `fault-outcome.ts` and one badge component, in Run, Compare and
Failures. It reads the artifact alone, so a live run, a download and a replay read the same. A run that finished with
conflicts left says so in its headline, and an infeasible budget says the budget cannot be met, instead of both
reading as having completed without a failure.

The release evidence is one end-to-end script, `agent-lab-release.e2e.mjs`. It walks a normal comparison, the
infeasible and multi-city benchmarks, the representative `provider-empty-result` fault, download and offline replay, then proves a layout matrix
(light and dark, 1440, 390 and 320 wide, reduced motion, every view): no horizontal overflow, clipped or overlapping
control, every control named, text contrast at AA, and no motion under reduced motion. It also proves the flow
touches no storage and calls only the run endpoint, that the ordinary workspace still loads with no lab content, and
that no stream, artifact or report carries a credential, prompt, reasoning, stack or payload. Contrast is measured
from a screenshot of each element with its text made transparent, so gradients and translucent surfaces are
measured, not guessed.

The probe found real misses in the light theme: secondary text, the status line and the primary button measured
4.1 to 4.4 on the lab's tinted surfaces. They are strengthened inside `.agent-lab` only.

## Alternatives considered

- **Change the shared colour tokens.** Rejected: they belong to the whole workspace, and the lab must not change the
  ordinary workspace. The lab overrides the secondary text and the primary button inside its own scope.
- **A full tab pattern (`role=tablist`, arrow keys).** Not built: the buttons are already reachable and operable by
  keyboard, and renaming roles would break working tests for no gain in access.
- **Keep the short notes at the foot of every view.** Rejected: they could not carry the ownership boundary, the
  capability table and the reading guide, and they pushed the evidence down the page.
- **Resolve contrast from computed styles.** Rejected: the lab sits on gradients and translucent glass, where that
  guesses; sampling the pixels behind the text measures what a reader sees.

## Consequences

A visitor reads one lab with one vocabulary, and a reviewer can reproduce the evidence with one command. The release
script exercises benchmark scenarios and every theme. The complete five-profile fault matrix and Run all sequencing,
cancellation, download and replay checks belong to `agent-lab-failures.e2e.mjs`; release smoke retains one fault
for cross-view integration. This coverage split partly supersedes the original release test scope; see the
[simplification decision](../simplification/2026-10-10-repository-surface-reduction.md). The contrast probe depends on
element screenshots, so it needs a real browser, not a headless unit test. The workspace's own end-to-end scripts are
not part of this evidence and were not changed.

## Sources

- [Agent Lab strategy and run artifacts](../architecture/2026-10-01-agent-lab-run-artifacts.md)
- [Failure Lab](../architecture/2026-10-02-agent-lab-failure-lab.md)
- [Live gate](../architecture/2026-10-02-agent-lab-live-gate.md)
- [Release E2E](../../../../apps/web/tests/e2e/agent-lab-release.e2e.mjs)

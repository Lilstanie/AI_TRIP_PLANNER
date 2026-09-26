---
name: diagnosing-bugs
description: Diagnose hard bugs, regressions, and performance problems in AI_TRIP_PLANNER with reproducible evidence before changing code. Use when a behavior is broken, wrong, flaky, or slow and the cause is unclear.
---

# Diagnose bugs with evidence

For an obvious, directly reproducible defect, use judgment and keep the loop lightweight. For hard bugs, follow the phases below and explain any skipped phase.

## 1. Establish the symptom and feedback loop

- Read the relevant local context, docs, implemented notes, implementation, and existing validation before forming a fix.
- State the user's exact symptom and the expected behavior. Redact secrets from logs, requests, screenshots, and artifacts.
- Prefer a repeatable E2E path for user-visible behavior. Use the existing browser or API harness when it reaches the defect; capture a report, trace, or other reviewable artifact when practical.
- Tighten the signal: it should detect this symptom, be repeatable, and avoid unrelated setup. Pin fixtures, mode, time, or provider responses where needed. Never consume live provider quota just to make a repro when a deterministic mock can exercise the same path.
- If a useful automated loop is unavailable, gather the strongest safe evidence available (request, log, screenshot, trace, or manual reproduction) and state its limits. Do not claim a repro or test passed unless it ran.

## 2. Reproduce and narrow

- Confirm that the evidence shows the reported defect, not a nearby failure.
- Reduce inputs and steps one at a time while keeping the failure. Retain the original scenario for final verification.
- For intermittent defects, repeat the trigger and record how often it reproduces; do not label it deterministic when it is not.

## 3. Form and test explanations

- For a non-obvious defect, list a few ranked, falsifiable explanations and the observation that would distinguish them. Share them when that would help the user redirect the investigation; continue gathering independent evidence without waiting.
- Change one diagnostic variable at a time. Prefer a debugger or targeted boundary inspection over broad logging.
- Tag temporary logs and instrumentation clearly, avoid logging credentials or personal data, and remove temporary instrumentation before completion.
- For slow behavior, establish a comparable baseline and profile or bisect before changing the implementation.

## 4. Fix and verify at the right boundary

- Follow [end-to-end-feature-wiring](../end-to-end-feature-wiring/SKILL.md) when data crosses packages, adapters, orchestration, persistence, streaming, or UI.
- Prefer the complete E2E user path as the behavioral check. If an isolated check is necessary, first enumerate the ways the system can fail and derive the check from that list. Follow the project rule never to write unit tests after implementation code.
- Apply the smallest fix that explains the evidence. Re-run the narrowed check and the original scenario; verify adjacent failure and fallback paths when relevant.
- For visible changes, use [ui-verification](../ui-verification/SKILL.md). Select other validation through [pre-push-checks](../pre-push-checks/SKILL.md) when preparing a push.

## 5. Close the loop

Report the reproduced symptom, confirmed cause or remaining uncertainty, the change made, and commands or artifacts actually produced. Remove temporary harnesses and logs unless the user requested a retained artifact. Add a session log under the project rules.

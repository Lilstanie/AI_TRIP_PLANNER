---
date: 2026-10-26
author: Codex
branch: feature/TP-102-trip-workspace-redesign
pr: 726
area: apps/web, docs
contract-impact: api
---

# Integrate the Trip workspace redesign

## What changed

- Integrated daily timeline/map layout, compact Agent Team, budget issues and on-demand tips.
- Added direct Stop edits, additions, Undo and per-Trip recoverable drafts.
- Required explicit rebase for stale drafts; documented accepted decisions in [TP-102](../notes/implemented/feature/2026-10-26-trip-redesign.md).
- Luna 6 high implementers and independent Spec/Standards reviewers completed their assigned slices.

## Why

The expanded summary displaced daily Stops, and the full Team strip crowded narrower headers.
Draft ownership must survive day/tab/viewport changes without overwriting a newer Plan.

## Validation

- At `1aee8ff2`: layout E2E 42/42 (including real Chrome zoom), budget issues 32/32, phone editing 39/39, Team phone 95/95.
- At `afe2326e`: production phone-shell E2E 597/597; deliberate overflow trips its geometry assertion.
- At `40850a98`: AddStop E2E 20/20; formatting and comment-policy checks passed.
- At `e74df7cb`: trip-drafts E2E 34/34, including same-page stale replan/rebase and three phone/tablet restore cycles.
- At `afe2326e`: build/type/lint and existing web tests (642 across 57 files) passed; formatting failure corrected in `40850a98`.
- Parent production display walk at `1aee8ff2`: 7/7 light/dark/reduced-motion/overflow checks.
- Independent Spec and Standards review: no confirmed code findings; parent closed pending phone restore verification.

## Notes for the next person

- No production source changed after `1aee8ff2`; later commits strengthen E2E fixtures/readiness/diagnostics.
- Earlier malformed OSM fixture corrected. Original reply geometry failure lacked coordinates; historical cause remains unresolved.
- Restore failures came from reading the old inline surface before phone render; tests now await phone state, restore entry/modal and focus.
- Browser evidence uses fixtures/mock mode and Chrome; live providers, hosted Clerk and physical phone keyboards remain unverified.
- Raw Trip browser E2Es are local evidence, not automatically selected by the CI CLI plan.
- Retained screenshots/logs live outside the checkout under the current task visualization directory. Do not merge or delete branches without user approval.

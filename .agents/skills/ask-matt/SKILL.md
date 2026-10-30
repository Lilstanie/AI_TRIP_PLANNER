---
name: "ask-matt"
description: "Use when the user explicitly asks (/ask-matt) which skill or flow fits their situation. A router over the Matt Pocock skills kept in this repository and the project skills that replace the rest."
---

# Ask Matt

You don't remember every skill, so ask. This copy routes only to skills that exist in `.agents/skills/`, so every tool that reads the repository can follow it. The full upstream router, with skills such as `/grill-with-docs`, `/handoff`, `/prototype` and `/wayfinder`, stays an account skill.

## The main flow: idea → ship

1. **Sharpen the idea.** Interview the user until every question is settled, using the vocabulary in `GLOSSARY.md` and the decisions in `.agents/notes/implemented/`. Record a lasting decision with [agent-notes](../agent-notes/SKILL.md).
2. **Is this a multi-session build?**
   - **Yes** → [to-spec](../to-spec/SKILL.md) turns the thread into a spec, then [to-tickets](../to-tickets/SKILL.md) splits it into tracer-bullet tickets with **blocking edges**. Work them one at a time, or run [implement-spec](../implement-spec/SKILL.md) for the whole spec on one **integration branch**.
   - **No** → build it here.

   Either way, build with [tdd](../tdd/SKILL.md), one red-green slice at a time. In this repository each slice is an E2E scenario with its failure modes written first. Review with [review-trip-planner](../review-trip-planner/SKILL.md).

3. **Ship.** [trip-planner-pr-delivery](../trip-planner-pr-delivery/SKILL.md) owns the branch, checks, PR body, Jira story and merge. Check selection is [pre-push-checks](../pre-push-checks/SKILL.md); visible changes need [ui-verification](../ui-verification/SKILL.md).
4. **Close the loop.** [retro](../retro/SKILL.md) looks back over the session and suggests changes to the agent's environment: navigation pointers, automated checks, review rules, steering files and tooling. Mechanical mistakes become deterministic checks; judgement calls become review rules.

## Context hygiene

Keep steps 1 and 2 in one unbroken context window, so the interview, spec and tickets build on the same thinking. Each ticket then starts fresh, working from the ticket. Run `/retro` in the session it looks back on, before you clear it.

## Off the main flow

- **Something's broken** → reproduce it and name the cause before fixing it ([root causes](../../../docs/development.md#fix-root-causes)). A failing or flaky test is [e2e-maintenance](../e2e-maintenance/SKILL.md).
- **Upkeep** → [find-simplifications](../find-simplifications/SKILL.md) for code, [skill-maintenance](../skill-maintenance/SKILL.md) for skills.
- **Writing for agents** → [prose-standard](../prose-standard/SKILL.md) and [agent-experience](../agent-experience/SKILL.md).

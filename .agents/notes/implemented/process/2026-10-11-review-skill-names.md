# Agent Note: Name review skills by scope

Status: implemented

## Problem

The project risk checklist and the global Standards/Spec workflow both used the name code-review. A user could not reliably distinguish their scope when selecting a skill.

## Decision

The project skill is named `review-trip-planner`; its directory, frontmatter and current consumers use that name. Its repository-specific checks remain unchanged.

The user-installed global skill is named `review-standards-spec`, with the display name Review Standards & Spec. Global ask-matt, implement, implement-spec and tdd references use the new workflow name where present. Global files live outside this repository and are not delivered by a repository pull request.

OCR plugin skills retain their distinct `open-code-review` and `open-code-review-delegate` names. Their package-managed cache is not edited. Frozen historical session logs and archives preserve the names used at the time.

This changes names and navigation only. It preserves the workflow ownership in [repository workflow skills](2026-09-22-repository-workflow-skills.md) and the checks in [review-trip-planner](../../../skills/review-trip-planner/SKILL.md); it supersedes no review or testing decision.

## Alternatives considered

- Keep both code-review names: leaves the selection ambiguity unresolved.
- Merge both workflows during the rename: changes review responsibilities beyond the requested naming change.
- Rename OCR cache entries: plugin updates can overwrite those local edits.

## Consequences

- Current consumers call the new names; the old skill entrypoints are removed rather than duplicated as aliases.
- Reinstalling an upstream global skill may restore its original name and requires reconciling local naming and consumers.
- A running client may need to refresh its skill catalog to display the renamed entrypoints.

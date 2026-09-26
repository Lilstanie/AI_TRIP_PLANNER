# Agent Note: Project-local Libraries.dev skill and skill navigation

Status: implemented

## Problem

The globally installed Libraries.dev skill is not part of the repository's shared instructions.
Its generic effect placement rules can conflict with the workspace's Liquid Glass contract, and its
install examples do not scope dependencies to the pnpm web package. Related project skills also need
a clear navigation grouping without losing their focused invocation boundaries.

## Decision

Install [libraries-dev](../../../skills/libraries-dev/SKILL.md) directly under `.agents/skills` from
upstream commit `f20116327f4e3b28d0fb70b04437dfd092bf88fe`. Preserve the seven reference snapshots and
MIT licence; adapt the entrypoint to the design contract, real application state, web workspace
installation, accessibility and existing validation workflows.

Group all project skills by purpose in [development](../../../../docs/development.md#agent-workflows).
Keep each skill's existing path and discovery entrypoint. `better-ui` links to Libraries.dev for
specific requested effects; it retains ownership of general visual polish. `ui-verification` remains
the browser acceptance workflow. This extends the
[interface skills decision](2026-09-24-interface-skills.md); it does not replace its adapted skills
or relax the UI design contract.

## Alternatives considered

**Copy the generic entrypoint unchanged.** Its wait-duration rules would prescribe effects even
where decoration is inappropriate, and root install commands would target the wrong package.

**Merge all UI skills into one entrypoint.** General layout, accessibility, package-specific props
and browser acceptance have distinct triggers. Combining them would load unrelated instructions.

**Move skills into category directories.** Navigation in the owning development document provides
the grouping without changing existing discovery paths, validator expectations or inbound links.

## Consequences

The project shares a pinned effect skill with focused references. Upstream updates require comparison
and preservation of local constraints. Installing instructions does not add runtime packages or
change the visible interface. A requested effect implementation still needs appropriate design fit,
documentation and repeatable browser evidence.

## Sources

- [Official skill](https://libraries.dev/skill).
- [Pinned upstream source](https://github.com/Jakubantalik/Libraries.dev/tree/f20116327f4e3b28d0fb70b04437dfd092bf88fe/skills/libraries-dev).
- [Attribution and MIT licence](../../../skills/THIRD_PARTY_NOTICES.md).

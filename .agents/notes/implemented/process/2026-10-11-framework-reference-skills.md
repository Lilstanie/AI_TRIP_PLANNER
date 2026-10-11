# Agent Note: Project-local React and Playwright reference skills

Status: implemented

## Problem

The project skills cover feature boundaries and browser acceptance, but do not provide a broad
reference for React performance or Playwright locator, waiting and debugging techniques. Generic
skills also prescribe test-type choices and runner commands that differ from the project's E2E-first
policy and custom CLI.

## Decision

Two reference skills are installed under `.agents/skills/`, shared through the existing
`.claude/skills` symlink:

- `vercel-react-best-practices`, from `vercel-labs/agent-skills` at
  `063bee94c3f4df8453406c830b0a7df0f2860278`.
- `playwright-best-practices`, from `currents-dev/playwright-best-practices-skill` at
  `283d5cbc5d11aac1abda058b16ad22c317d54dc0`.

Project instructions own test strategy, execution commands and evidence requirements. These skills
provide technical guidance within that scope. The React entrypoint requires checking installed
versions and preserving package boundaries and the design contract. The Playwright entrypoint
preserves the E2E-first policy and the existing CLI; examples using `@playwright/test` describe APIs
that would require a separately scoped migration. Its generic test-type matrix does not replace
project policy.

Supporting Markdown lives under each skill's `references/`. The entrypoints link directly to it;
supporting-file links to other references point to the pinned upstream revision to preserve the
project's one-level loading convention. The React compiled guide is omitted because it duplicates
the individual rules. Source metadata and licence notices accompany both skills.

This decision adds instructions and references. A future browser runner migration is evaluated
separately, including how to retain credential isolation, per-invocation evidence and failure
reporting from the current CLI.

## Alternatives considered

- **Install globally:** the user selected project scope so the same instructions are available to
  contributors and agents working in this repository.
- **Use the upstream Playwright workflow as the project workflow:** not selected because its test
  selection and execution assumptions differ from the installed harness and accepted policy.
- **Migrate the runner with the installation:** deferred so migration can account for existing
  scenarios and CLI guarantees rather than being an incidental effect of adding instructions.

## Consequences

- Agents gain on-demand framework references while project acceptance remains explicit.
- These are adapted, pinned copies. Upstream updates require comparing against the recorded commits,
  preserving project context, and rechecking links, formatting and documentation pairs. Re-running
  a generic installer or updater over them can erase those adaptations.
- The framework examples can contain APIs unavailable in the installed dependency versions. Their
  applicability must be checked before implementation.
- No npm dependencies or test infrastructure are added by this installation.

## Sources

- [Development workflows](../../../../docs/development.md#agent-workflows).
- [E2E-first policy](../testing/2026-09-25-e2e-first-testing.md).
- [Existing interface skill adaptation](2026-09-24-interface-skills.md).
- [Local E2E CLI](../../../../docs/local-test-cli.md).
- [Third-party notices](../../../skills/THIRD_PARTY_NOTICES.md).

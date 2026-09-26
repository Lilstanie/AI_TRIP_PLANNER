# Agent Note: Bilingual documentation and agent experience

Status: implemented

## Problem

The owner requests Chinese project documentation and synchronized updates rather than independent
summaries. The project also defines model-facing specialist tools and prompts whose discoverability
and context delivery are not covered by prose editing alone.

## Decision

Adapt [agent-experience](../../../skills/agent-experience/SKILL.md) and
[translate-docs](../../../skills/translate-docs/SKILL.md) from DeepSeek Harness for this project.
Ordinary Markdown under `docs/` has full English and Chinese counterparts. Instruction entrypoints,
root and package READMEs, Agent Notes, skills and frozen logs are outside mandatory pairing.

Agents editing either language synchronize its counterpart in the same task. The project translation
skill is automatically discoverable for documentation work; DSH's explicit-only extended workflow
is not imported unchanged. A standalone local checker discovers pairs, compares structural content
and links, and requires current hashes for both reviewed files in `.agents/translation-pairs.json`.
Only explicit reviewed paths can be recorded. The checker neither translates nor proves fidelity.

The workflow extends the [repository skills decision](2026-09-22-repository-workflow-skills.md) and
the [simplification/prose adaptation](2026-09-26-simplification-prose-skills.md). Their other choices
remain in force. The new translation requirement is justified by the owner's bilingual scope.

## Alternatives considered

**Install DSH's translation skill unchanged.** Rejected: its pairing sidecars, briefing generator,
line-alignment rules and documentation gates do not exist here.

**Translate only summaries or leave counterpart updates manual and unchecked.** Not chosen: this
would leave Chinese readers with different technical content and make stale translations invisible.

**Add model-based translation on every file save or change protected CI scripts.** Not adopted:
the user requests synchronized documentation, not a background API integration; protected root
configuration remains unchanged. Workflow instructions require the standalone local check.

## Consequences

The Chinese entrypoint is [docs/README.zh.md](../../../../docs/README.zh.md). Full translations double
the prose maintenance cost. Updating either file invalidates the review hashes; structural checks
do not detect a fluent mistranslation, so semantic review precedes recording. Code blocks stay
unchanged and Chinese headings retain English fragment anchors.

No watcher or automatic translation service runs. Existing `pnpm verify:docs` and CI do not enforce
pair freshness yet; the new check is explicitly required by documentation and pre-push workflows.
Root or CI integration would need explicit authorization for the protected files.

## Sources

- DSH checkout `477b4f420553e8a52c2fbccc464d7561b239c443`:
  [agent experience](https://github.com/deepseek-ai/deepseek-harness/blob/477b4f420553e8a52c2fbccc464d7561b239c443/.agents/skills/agent-experience/SKILL.md)
  and [translation workflow](https://github.com/deepseek-ai/deepseek-harness/blob/477b4f420553e8a52c2fbccc464d7561b239c443/.agents/skills/dsh-translate-docs/SKILL.md).
- [Pairing guide](../../../../docs/i18n.md) and
  [MIT attribution](../../../skills/THIRD_PARTY_NOTICES.md).

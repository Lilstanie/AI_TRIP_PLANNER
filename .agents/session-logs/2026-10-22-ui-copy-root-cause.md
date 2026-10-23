---
date: 2026-10-22
author: Claude (project thread, for Joey)
branch: docs/ui-copy-and-root-cause
pr: 586
area: docs, apps/web (skill tooling only)
contract-impact: none
---

# Add UI copy and root-cause rules, with a copy check

## What changed

- `AGENTS.md`: two Working rules. Fix a bug at its cause; let the layout explain (no repeated helper copy).
- `.agents/skills/better-ui/SKILL.md`: "Copy and labels" section, plus a "Check before pushing" bullet.
- `.agents/skills/better-ui/scripts/check-ui-copy.mjs`: lists added helper-copy classes against origin/main.
- `.agents/skills/better-ui/references/ui-copy-allowlist.txt`: empty allowlist for justified exceptions.
- `docs/design/ui-guidelines.md` and `.zh.md`: Do's and Don'ts item 6.
- `docs/development.md` and `.zh.md`: "Fix root causes" at the end of Agent workflows.

## Why

Joey asked for the first-principles ideas in an X thread to be applied to the repo, then agreed to all
suggestions. The copy check is diff-based so existing copy does not fail; it only catches additions.
It is a skill script, not a CI gate, because wiring it into `package.json` or `.github/**` needs an
explicit request for those protected files.

## Validation

- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs --stdin` on five fixture diffs: an added
  `panel-hint` and `stop-editor__hint` exit 1; `hinted`, a `.md` file and a removed-only hunk exit 0;
  an added `settings-hint` exits 1 without the allowlist and 0 with it.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` on origin/main...HEAD: "No added helper-copy classes."
- `pnpm verify:docs`: "Agent Notes, skills and Markdown links are valid."
- `pnpm verify:protected`: "Protected-file rules hold relative to origin/main."
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: "Checked 28 documentation pairs against origin/main."

## Notes for the next person

- Wire `check-ui-copy.mjs` into CI or `pnpm verify:*` only with an explicit request, since that touches
  protected root and `.github/**` files. The current check has no CI gate.
- It matches class names only, so it misses helper copy in plain elements and in `className={...}`
  expressions. Count of existing helper-class uses in `apps/web/components` is about 21.
- The CI run on the first push failed the pair check. Fixed in c70808b with the Chinese counterparts.

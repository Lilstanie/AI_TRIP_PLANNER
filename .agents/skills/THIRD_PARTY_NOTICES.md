# Third-party notices

## Vercel React Best Practices

`vercel-react-best-practices` is adapted from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices)
at commit `063bee94c3f4df8453406c830b0a7df0f2860278`. Upstream declares the MIT licence in
`SKILL.md`; this revision supplies no separate licence file. Its 72 rule and supporting Markdown
files live under `references/`. The entrypoint adds project boundaries and direct reference links;
the redundant compiled guide is omitted. Cross-reference links in supporting files point to the
pinned upstream revision so local references stay one level deep.

## Currents Playwright Best Practices

`playwright-best-practices` is adapted from
[currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill/tree/283d5cbc5d11aac1abda058b16ad22c317d54dc0/playwright-best-practices)
at commit `283d5cbc5d11aac1abda058b16ad22c317d54dc0`. Its 58 supporting Markdown files live
under `references/`, preserving upstream categories. The entrypoint uses the project's execution and
acceptance rules; supporting-file cross-references point to the pinned upstream revision. Copyright
2026 Currents Software Inc.; the upstream MIT licence is preserved unchanged in
[playwright-best-practices/LICENSE](playwright-best-practices/LICENSE).

## DeepSeek Harness

`find-simplifications`, `prose-standard`, `agent-experience` and `translate-docs` are adapted from
[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), first at commit
`477b4f420553e8a52c2fbccc464d7561b239c443` and compared again at
`d743267388641bc76f17c45ce8b4c231aed1d32c` (upstream `dsh-` prefixed directories), where the
upstream changes were DSH-specific and none applied. Their instructions and references are rewritten for
AI_TRIP_PLANNER; DSH-specific architecture, commands and documentation requirements are not imported.

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Jakub Krehel skills

The `better-accessibility`, `better-layout`, `better-ui`, `better-writing` and `break` skills are
adapted from [jakubkrehel/skills](https://github.com/jakubkrehel/skills) at commit
`4c66b1fa86e9ab70187b43d7da9b6fdb29f2ef63` (2026-10-12), first adapted at
`267330e1adfc66a718fb65fa6918c1f06d0a689e` (2026-08-29). Their `SKILL.md` files and
`break/references/scenarios.md` are rewritten for this project, `better-ui/references/glass.md`
is new, and `better-writing/references/patterns.md` keeps only the destructive-flow and status-copy
patterns with project examples. The remaining reference files are three-way merged with upstream,
keeping project lines where the workspace depends on them: the global reduced-motion fallback, the
fixed workspace breakpoints and the `base.css` tabular-figure rule. Upstream mentions of
`better-typography` and `better-colors`, which are not adapted, are replaced. All of them sit under
each skill's `references/` directory. The upstream licence follows.

```text
MIT License

Copyright (c) 2026 Jakub Krehel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Libraries.dev

`libraries-dev` is adapted from
[Jakubantalik/Libraries.dev](https://github.com/Jakubantalik/Libraries.dev/tree/a27566557b4def79bcdcedc71858c0fb28020b6d/skills/libraries-dev)
at commit `a27566557b4def79bcdcedc71858c0fb28020b6d` (2026-10-13), first adapted at
`f20116327f4e3b28d0fb70b04437dfd092bf88fe`. Its entrypoint is rewritten for this workspace's UI
contract, pnpm package scope and validation. The seven reference files are copied unchanged, except
that the four updated at the current commit carry the repository's Prettier formatting.
Copyright (c) 2026 Jakub Antalik; the complete MIT licence is preserved in
[libraries-dev/LICENSE](libraries-dev/LICENSE).

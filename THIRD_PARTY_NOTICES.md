# Third-party notices

This repository is licensed under the MIT licence (see [LICENSE](LICENSE)). It contains the third-party
code listed below. Each entry gives the upstream project, its licence, its copyright line and the files in
this repository that contain it. Ported files also keep their own header notice.

Contributors: when you vendor or port code from another project, add an entry here in the same pull request.

## DeepSeek Harness

- Upstream: <https://github.com/deepseek-ai/deepseek-harness> (`deepseek-ai/deepseek-harness`)
- Licence: MIT
- Copyright: Copyright (c) 2026 DeepSeek
- Files in this repository: the skills `.agents/skills/find-simplifications/`, `.agents/skills/prose-standard/`,
  `.agents/skills/agent-experience/` and `.agents/skills/translate-docs/` are adapted from upstream commit
  `477b4f420553e8a52c2fbccc464d7561b239c443`; [.agents/skills/THIRD_PARTY_NOTICES.md](.agents/skills/THIRD_PARTY_NOTICES.md)
  records the details. The Trajectory tab (#668) copies the files in `apps/web/components/trajectory/` that
  carry the header, from upstream commit `687f282e86`: the ledger table, timeline, toolbar, record
  types, search index and their styles and layout code, with imports replaced by `shim.tsx`. The Agent
  Lab Trace view (#218, #220) borrows only the idea of a lane overview and was written from scratch,
  so it contains no DeepSeek Harness code.

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

## Vercel React Best Practices

`vercel-react-best-practices` is adapted from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices)
at commit `063bee94c3f4df8453406c830b0a7df0f2860278`. Upstream declares the MIT licence in
`SKILL.md`; this revision supplies no separate licence file. Its 72 rule and supporting Markdown
files live under `.agents/skills/vercel-react-best-practices/references/`. The entrypoint adds project boundaries and direct reference links;
the redundant compiled guide is omitted. Cross-reference links in supporting files point to the
pinned upstream revision so local references stay one level deep.

## Currents Playwright Best Practices

`playwright-best-practices` is adapted from
[currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill/tree/283d5cbc5d11aac1abda058b16ad22c317d54dc0/playwright-best-practices)
at commit `283d5cbc5d11aac1abda058b16ad22c317d54dc0`. Its 58 supporting Markdown files live
under `.agents/skills/playwright-best-practices/references/`, preserving upstream categories. The entrypoint uses the project's execution and
acceptance rules; supporting-file cross-references point to the pinned upstream revision. Copyright
2026 Currents Software Inc.; the upstream MIT licence is preserved unchanged in
[playwright-best-practices/LICENSE](.agents/skills/playwright-best-practices/LICENSE).

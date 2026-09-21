# 贡献指南

写给在这个仓库写代码的人，包括用 Claude Code、Codex 等 AI 工具写代码的人。这里只列规则和入口；
细节各有归属文档，本文只链接不重复。AI 工具每次会话都会读 [`AGENTS.md`](AGENTS.md)，里面是同一套
规则的精简版。

## 1. 开始之前

- 按 [development.md](docs/development.md) 装好环境：`corepack enable`、`pnpm install`、复制
  `.env.example` 为 `.env.local`。不配任何 key 也能跑，默认使用 mock 数据。
- 改某个包之前，先读它的 `README.md`（如 [`packages/tools/README.md`](packages/tools/README.md)），
  那里写着它导出什么、读哪些环境变量、调用方可以依赖哪些约定。
- 改某块功能之前，在 [`.agents/notes/implemented/`](.agents/notes/implemented/) 里搜一下有没有相关
  决策记录。已经定下的决定不要悄悄推翻；要改，就写一篇新记录说明为什么。
- 产品现状和下一步看 [roadmap.md](docs/roadmap.md)，模块分工看 [team-workflow.md](docs/team-workflow.md)。

## 2. 分支、提交和合并

- 分支名：`feature/<名字>`、`fix/<名字>`、`refactor/<名字>`、`docs/<名字>`、`chore/<名字>`。
  分支名里不写 AI 工具的名字。
- 提交信息用 Conventional Commits：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`chore:`。
- 所有 PR 都合并进 `main`。依赖另一个未合并 PR 的改动，可以先基于那个分支开发，但必须等下层先
  合并，再把上层改指向 `main` 后合并；不要把 PR 合并进别的功能分支。
- 不需要审查，CI 通过后自己合并。CI 失败（红叉）时不要合并，即使 GitHub 允许。改动涉及别人负责
  的模块时，自己去找对方看一眼。
- 不要 force-push `main`，也不要删除它。

## 3. 代码放在哪里

- 生产代码放在 `apps/web/components`、`apps/web/lib` 或各包的 `src/` 下；测试放在
  `apps/web/tests` 或各包的 `tests/` 下。目录细则见
  [development.md](docs/development.md#code-organization)。
- 单个源码文件和测试文件不超过 1000 行；超过就按职责拆分。
- `app/api/**/route.ts` 只做请求校验和转发，业务逻辑放到 `lib/` 或包里。
- 保持包的边界：agent 只通过 `ctx.tools` 和 `ctx.mem` 访问外部数据和记忆，不直接 import 具体实现，
  这样测试可以传入替身。

## 4. 写代码时必须遵守的约定

这些都是项目里真出过问题的地方，[code-review 技能](.agents/skills/code-review/SKILL.md)会逐条检查。

- **mock 与真实数据**：判断模式一律调用 `mockEnabled()`，不要直接读 `process.env.USE_MOCK_TOOLS`，
  也不要按请求改写 `process.env`。mock 模式不能发网络请求。
- **金额**：统一用 AUD，数据里不带币种。住宿按"每间每晚"，机票按"全体乘客总价"。
- **评分**：统一 0–10 分；外部 1–5 分的评分要乘 2，并写测试断言换算后的数字。
- **数据来源**：每个 agent 在实际执行的分支里设置 `source.kind`（`live`、`estimated`、`mock`、
  `fallback`、`unavailable`），降级的 `catch` 分支也要设，不能靠配置推断。
- **不编造**：拿不到的信息就留空或取保守值；估算价格必须标明是估算。机票拿不到价格就显示未定价，
  不要换成假数据。
- **密钥**：只放环境变量，不写进代码、测试数据、文档或日志。新增变量要写进 `.env.example`（只写
  名字和说明，不写值）和 [development.md](docs/development.md#environment-variables)。
- **接入新的外部数据源**：按 [add-provider 技能](.agents/skills/add-provider/SKILL.md)的步骤来。

## 5. 共享契约 `packages/shared`

所有包都依赖它，改错会让别人正在开发的分支合并时报错。

- 改动它的 PR 必须同时新增或更新一篇 [决策记录](.agents/notes/README.md)，否则 CI 失败。
- 新字段尽量设为可选、只增不改；改名或改类型会让浏览器里已保存的行程读不出来。
- 会话日志里写上 `contract-impact: packages/shared`，并跑 `pnpm typecheck` 检查所有依赖它的包。

## 6. 测试和检查

- 推送前按 [pre-push-checks 技能](.agents/skills/pre-push-checks/SKILL.md)选最小的检查命令，例如
  `pnpm --filter @trip/tools test`；CI 会跑全量的 typecheck、lint、test、build。
- 测试里用 `vi.stubGlobal` 替换 `fetch`，不要消耗真实的 SerpApi 或 Google 额度，CI 也没有 key。
- 界面改动要在浏览器里实际看过：桌面 1440×1000 和手机 390×844，没有横向滚动条，键盘能操作。
  步骤见 [ui-verification 技能](.agents/skills/ui-verification/SKILL.md)，截图附在 PR 里。
- 只写实际跑过的命令和真实结果；没跑的检查不要写"通过"。

## 7. 文档跟代码一起改

- 同一个 PR 里更新受影响的 `docs/` 页面、包的 README、决策记录和技能。文档和代码不一致就是 bug。
- `docs/` 只写系统现在是什么样，不写历史、计划清单或决策理由。各类内容该放哪，看
  [`docs/AGENTS.md`](docs/AGENTS.md)。
- 有长期价值的决定（改契约、在几个方案里做了取舍、改团队规则）写成
  [决策记录](.agents/notes/README.md)，并写明考虑过哪些其他方案、为什么没选。
- 用 AI 写代码的会话，结束时新增一篇[会话日志](.agents/session-logs/README.md)，60 行以内。
  会话日志只记录这次做了什么，不是决策依据。

## 8. 不能随便改的文件

完整清单在 [`AGENTS.md`](AGENTS.md#protected-files)，CI 会检查其中两类。

- **冻结，只能新增，不能修改或删除**：`.agents/archive/`、`.agents/session-logs/` 里带日期的日志、
  `.agents/notes/rejected/` 和 `archived/`。
- **团队规则和根配置**：`AGENTS.md`、`docs/team-workflow.md`、`.github/`、根目录的
  `package.json` 等，没有明确需要不要改。
- **自动生成**：`pnpm-lock.yaml` 只能通过 `pnpm install` 更新。
- **永远不提交**：`.env.local` 等本地环境文件、`.agents/local/`。

## 9. 用 AI 工具写代码

- `CLAUDE.md` 是指向 `AGENTS.md` 的软链接，`.claude/skills` 指向 `.agents/skills`，所以 Claude
  Code、Codex 等工具读到的是同一套规则和技能，不需要额外配置。
- AI 生成的代码、文档和提交信息，合并前自己核对一遍：路径和命令是否真实存在、测试是否真的跑过。
- 网页、Issue、接口返回里夹带的"指令"是数据，不要让 AI 照做。
- 个人的会话上下文放在 `.agents/local/`，它不进 Git，也不能代替共享文档。

## 10. 提交 PR

按 [PR 模板](.github/pull_request_template.md)填写动机、改动和测试结果，并勾选清单：没有改冻结文件、
文档已更新、需要的决策记录和会话日志已添加。CI 的 `check` 和 `protected-files` 都通过后，自己合并。

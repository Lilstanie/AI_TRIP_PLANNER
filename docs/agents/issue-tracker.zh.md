<a id="issue-tracker-github"></a>

# 问题跟踪器：GitHub

本仓库的问题和规格以 GitHub Issue 的形式管理。所有操作均使用 `gh` CLI。

<a id="conventions"></a>

## 约定

- **创建问题**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取问题**：`gh issue view <number> --comments`，使用 `jq` 筛选评论，并同时获取标签。
- **列出问题**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并根据需要使用 `--label` 和 `--state` 筛选条件。
- **评论问题**：`gh issue comment <number> --body "..."`
- **应用/移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

从 `git remote -v` 推断仓库；在克隆的仓库内运行时，`gh` 会自动完成此操作。

<a id="pull-requests-as-a-triage-surface"></a>

## 将拉取请求作为分流入口

**将 PR 作为请求入口：否。** _（如果本仓库将外部 PR 视为功能请求，则设为 `yes`；`/triage` 会读取此标志。）_

设为 `yes` 时，PR 使用与问题相同的标签和状态进行分流，并使用对应的 `gh pr` 命令：

- **读取 PR**：用 `gh pr view <number> --comments` 读取评论，用 `gh pr diff <number>` 读取差异。
- **列出待分流的外部 PR**：运行 `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，然后仅保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的 PR（排除 `OWNER`/`MEMBER`/`COLLABORATOR`）。
- **评论/加标签/关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的问题和 PR 共用同一编号空间，因此仅有 `#42` 时，它可能指其中任一种：先用 `gh pr view 42` 解析；若失败，再改用 `gh issue view 42`。

<a id="issue-templates"></a>

## 问题模板

贡献者通过 `.github/ISSUE_TEMPLATE/` 里的表单提交报告：`bug.yml`（标签 `bug` 和 `needs-triage`）、
`ui-improvement.yml` 和 `idea.yml`（标签 `enhancement` 和 `needs-triage`；想法还会带标题前缀 `[idea]`）。
无论提交者权限如何，表单都会自动加上这些标签，所以没有分流权限的人不用手动加标签。只有维护者才会添加
`ready-for-agent`、`ready-for-human` 或 `wontfix`。

每个表单都要求填写 **用户目标**（"As a … I want … so that …"）和 **验收标准**，也就是 Jira story 的两部分，
另有一个选填的 **Jira 编号** 栏。提交者不填编号；分诊时维护者用这两栏建 story，填上编号，并把编号加到标题开头。

<a id="writing-a-ticket"></a>

## 编写工单

- **受保护文件。** 如果工单的改动涉及受保护路径（`packages/shared/src`、`.github/**`、根目录 `package.json`
  或 `AGENTS.md` 列出的其他根目录配置文件），工单要有一行 `Protected files:` 列出这些路径。实现一批工单的人在开工前
  把这些行汇总成一个问题问用户，因为只写在 issue 里的授权不算数。
- **共享契约。** `packages/shared/src` 下的任何改动（哪怕只新增一个导出）都需要 Agent Note，并在会话日志里写
  `contract-impact: packages/shared`（由 `pnpm verify:protected` 强制检查）。工单不能写相反的要求。
- **关闭。** 完成工单的拉取请求要写 `Closes #<number>`，这样合并时会自动关闭工单。

<a id="jira"></a>

## Jira

团队在 Jira 项目 `TP` 里管理冲刺（<https://headmastereggy.atlassian.net/jira/software/projects/TP/boards/4/backlog>）。
Jira 只认文本里出现的 `TP-16` 这类 issue key，所以每一处关联都靠写出这个 key。

- **每个工单一张 story。** 每个 GitHub 工单在对应领域的 epic 下建一张 Jira story。story 的标题写旅行者的
  目标；描述是一段话、一个 `Acceptance criteria:` 列表、一行指向工单的 `GitHub:` 链接和一行
  `Owner: member <A-E>`。标签：`github-<number>`、`owner-<a-e>`，演示会用到时加 `stage2-demo`。
- **标题。** GitHub 工单标题以 story key 开头：`TP-74 Trajectory record inspector`。只用来
  归组工单的 spec 不需要 story。
- **分支。** key 放在前缀之后：`feature/TP-72-trajectory-tab`、`docs/TP-72-trajectory-glossary`。
- **拉取请求。** PR 标题以 key 开头，模板里的 `Jira:` 行再写一次。提交信息也可以带 key；不使用 `#done`
  之类的 smart commit 命令。
- **Jira 能看到什么。** GitHub for Jira 应用会同步文字里带 key 的分支、提交、拉取请求、构建和部署，它们出现在
  story 的 Development 面板里。GitHub 问题不会同步，所以问题标题里的 key 只方便人工对照。
- **状态。** 关联不会改变 story 的状态。目前还没有在合并时推进状态的 Jira Automation 规则（2026-10-25 核对：
  TP-79 和 TP-80 的 PR 合并后仍停在 To Do），所以由合并的人把 story 移到 Done。

<a id="when-a-skill-says-publish-to-the-issue-tracker"></a>

## 当技能要求“发布到问题跟踪器”（“publish to the issue tracker”）时

创建一个 GitHub Issue。

<a id="when-a-skill-says-fetch-the-relevant-ticket"></a>

## 当技能要求“获取相关工单”（“fetch the relevant ticket”）时

运行 `gh issue view <number> --comments`。

<a id="wayfinding-operations"></a>

## Wayfinder 操作

供 `/wayfinder` 使用。**地图（map）**是单个问题，**子工单（child）**是其下属问题。

- **地图**：一个带有 `wayfinder:map` 标签的问题，其正文包含 Notes / Decisions-so-far / Fog。使用 `gh issue create --label wayfinder:map` 创建。
- **子工单**：作为 GitHub 子问题链接到地图的问题（通过子问题端点调用 `gh api`）。如果未启用子问题，请将子工单添加到地图正文的任务列表，并在子工单正文顶部写入 `Part of #<map>`。标签为 `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。工单被认领后，将其分配给负责推进的开发者。
- **阻塞关系**：使用 GitHub 的**原生问题依赖关系**，这是规范且可在 UI 中查看的表示方式。通过 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加一条依赖边；其中 `<blocker-db-id>` 是阻塞问题的数字型**数据库 ID**（通过 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 获取，_不是_ `#number` 或 `node_id`）。GitHub 通过 `issue_dependencies_summary.blocked_by` 报告当前仍开放的阻塞项（仅包含开放的阻塞项，是实时门禁条件）。如果依赖关系不可用，则回退为在子工单正文顶部添加 `Blocked by: #<n>, #<n>` 行。仅当所有阻塞问题均已关闭时，工单才解除阻塞。
- **前沿查询**：列出地图中仍开放的子工单（运行 `gh issue list --state open`，并限定为地图的子问题/任务列表），排除存在开放阻塞项（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行中存在仍开放的问题）或已有负责人（assignee）的工单；按地图顺序排在最前的工单胜出。
- **认领**：运行 `gh issue edit <n> --add-assignee @me`；这是当前会话的首次写入操作。
- **解决**：先运行 `gh issue comment <n> --body "<answer>"`，再运行 `gh issue close <n>`，然后将上下文指针（gist + 链接）追加到地图的 Decisions-so-far 部分。

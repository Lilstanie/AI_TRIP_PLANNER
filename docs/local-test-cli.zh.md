# 本地 E2E 命令行工具

[English](local-test-cli.md) | 中文

现有 E2E 入口新增了隔离的 `run` 命令。不指定行程名称时会运行精选 smoke；可以指定一个或多个支持的行程，或使用
`--all` 运行所有支持的本地行程：

```bash
pnpm --filter @trip/web e2e run
pnpm --filter @trip/web e2e run agent-lab-single-agent agent-lab-replay
pnpm --filter @trip/web e2e run --all
pnpm --filter @trip/web e2e run agent-lab-single-agent --dev
pnpm --silent --filter @trip/web e2e run --all --json
```

命令会在空闲的本机回环端口启动自己拥有的服务器。默认先构建生产版本再启动；`--dev` 显式选择 Next
开发模式。命令会忽略继承的 `BASE_URL`。每次运行都会在 `output/e2e/local-test-cli/` 下创建独立目录，保存
`summary.json`、构建/服务器/行程日志，以及每个行程的截图、API 流和 artifact。摘要记录选择模式、准确的行程列表、每个行程的结果、复现
命令、服务器模式、保留的构建目录和证据路径。多行程运行会为每个行程使用独立的证据子目录。

JSON 模式只向标准输出写入一个 JSON 对象；子进程输出保存在本次运行的日志文件中。使用 pnpm 的 `--silent`
选项，避免 pnpm 自己的包信息出现在 JSON 对象前。对象包含 `outcome`、`requested`、各行程的 `results`、
`summaryFile` 和 `evidenceDirectory`。`passed` 返回零退出码；`unsupported`、`blocked`、`failed`、
`startup_failed`、`timed_out` 和 `interrupted` 都返回非零退出码。

本地进程只接收基本运行环境设置。已知的模型、供应商、数据库、KV 和认证凭据会在构建和运行时清空，包括 Next
读取应用目录本地 dotenv 文件的情况；命令会启用 mock 数据并禁用 Agent Lab 实时运行。Next 会使用本次调用专属的
临时 TypeScript 配置，因此构建不会把临时输出目录写进共享的 `apps/web/tsconfig.json`。构建目录会保留，并作为
本次拥有的资源记录在摘要中。这能隔离仓库当前使用的这些集成，但不构成通用网络出口防火墙。新增凭据名称时，必须
先加入命令的屏蔽列表，才能纳入此隔离保证。

支持的行程是 `agent-lab-single-agent` 和 `agent-lab-replay`。Smoke 只运行 `agent-lab-single-agent`：它会在桌面和手机视口
完整运行已注册的 Agent Lab fixture，断言覆盖 fixture 来源、已完成的 API artifact、渲染后的计划、键盘访问、工作区存储未改变以及浏览器错误。
`agent-lab-replay` 会运行紧预算 fixture，并检查 artifact 下载、回放、比较、无效 artifact 处理，以及对应界面和状态。
`agent-lab-live-gate` 仍不受支持，因为它需要额外两个服务器，而且服务器不可用时会在脚本内部跳过。其他行程要先验证完整 fixture 流程和服务器要求后才能支持。
显式选择不支持的行程，以及任何失败、超时或阻塞的行程，都会让整个集合返回非零；其他行程通过也不能抹掉失败结果。原始命令仍可使用：

```bash
pnpm --filter @trip/web e2e agent-lab-single-agent
pnpm --filter @trip/web e2e agent-lab-replay
```

原始脚本保留既有环境变量和复用服务器的行为。需要 fixture 隔离和每次运行独立证据时，请使用新的 `run` 命令。

<a id="repeat-runs"></a>

## 串行重复运行

使用正整数按顺序重复执行受支持的选择：

```bash
pnpm --filter @trip/web e2e run agent-lab-single-agent --repeat 3
pnpm --filter @trip/web e2e run agent-lab-single-agent --dev --repeat 3
pnpm --silent --filter @trip/web e2e run agent-lab-single-agent --repeat 3 --json
```

每次运行都会启动全新的本地 CLI 调用，并使用独立构建、服务器、浏览器进程、fixture 执行和证据目录。重复运行摘要会记录
请求次数、每次已启动运行的结果、复现命令、子调用摘要和证据路径。如果某次运行失败、受阻、不受支持、超时或被中断，后续
运行即使成功，整体结果仍返回非零状态码。请求的运行次数会按顺序执行；这不是自动重试。无效次数会在启动调用前被拒绝。
如果重复运行命令收到中断信号，已完成的摘要和现有证据会保留，当前子调用会收到清理请求，摘要会记录还有多少次请求的运行尚未开始。

JSON 输出除常规摘要路径外，还包含 `requestedRepeatCount`、`attempts` 和 `results`。不使用 `--json` 时，命令会输出易读的结果和摘要路径。每次子调用仍会在 `output/e2e/local-test-cli/` 下写入自己的摘要和证据。

## 检查环境并查看支持范围 {#check-readiness-and-discover-support}

可以从同一入口运行离线 doctor 和 list 命令：

```bash
pnpm --filter @trip/web e2e doctor
pnpm --silent --filter @trip/web e2e doctor --json
pnpm --filter @trip/web e2e list
pnpm --silent --filter @trip/web e2e list --json
```

如果系统中没有 pnpm，可以在仓库根目录运行 `node apps/web/tests/e2e/run.mjs doctor --json`，查看被阻断的
package-manager 检查。

`doctor` 会检查 Node.js 和仓库固定的 pnpm 版本、Web 应用的 Next.js 可执行文件、Playwright 及其 Chromium
可执行文件，并报告应用目录是否存在 dotenv 文件。它不会启动应用或测试服务器，不会联系服务供应商，也不会读取或更改
dotenv 文件内容。本地 fixture 模式不需要供应商凭据。缺少必要工具时会报告 `blocked`、给出修复方法并返回非零状态码。
JSON 输出为单个对象，包含 `schemaVersion`、`command`、`outcome` 和 `checks`；每项检查包含 id、状态和摘要，若被
阻断则附带修复方法。

`list` 会列出所有原始 E2E 脚本、支持状态、已知前置条件和排除原因。支持 `agent-lab-single-agent` 和
`agent-lab-replay`。Replay 覆盖紧预算 fixture、artifact 下载和回放、比较、无效 artifact，以及对应界面和状态；Smoke
只运行 single-agent 行程。`leg-mode-choice` 暂不支持，因为其中一个依赖模型的场景可能被跳过，但整个脚本仍可能返回成功。`agent-lab-live-gate`
和 `map-provider-http` 需要多个服务器。`plan-quality` 和 `conversation-scope` 默认使用 live 数据，并需要
`DEEPSEEK_API_KEY`。尚未审核是否能完整使用本地 fixture 执行并隔离状态的脚本也会保持不支持，同时会标明尚未核实的前置条件。
JSON 对象包含 `supported`、不支持脚本的数量和 `scripts` 数组。脚本出现在列表中并不表示其断言已经通过。

## 检查已保存的调用 {#inspect-a-saved-invocation}

可以通过调用 ID 或保存的 `summaryFile` 路径查看一次已完成的本地运行或重复运行：

```bash
pnpm --filter @trip/web e2e report <invocation-id>
pnpm --silent --filter @trip/web e2e report <summaryFile> --json
```

报告会读取已保存的记录，并检查证据目录是否仍然存在。它不会重新运行检查、启动服务器，也不会修改摘要或证据。JSON 中的
`reportOutcome: "reported"` 表示报告读取成功；`recordedOutcome` 才是测试结果。即使记录的测试失败，报告仍可成功读取，命令本身
返回成功。如果摘要不完整或证据缺失，`recordStatus` 会显示 `incomplete`。

重复运行报告会按顺序保留每次尝试，包括后续通过之前发生的失败。缺少子摘要、中断的尝试和缺失的证据会标记为不完整，不会被
描述成已通过的覆盖。未知 ID、格式错误的摘要，以及指向已保存本地 CLI 记录目录之外的路径都会返回非零状态；JSON 错误不会包含
摘要文件内容。

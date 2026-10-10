# 本地 E2E 命令行工具

[English](local-test-cli.md) | 中文

现有 E2E 入口新增了 `run` 命令，目前支持首个本地 fixture 行程：

```bash
pnpm --filter @trip/web e2e run agent-lab-single-agent
pnpm --filter @trip/web e2e run agent-lab-single-agent --dev
pnpm --silent --filter @trip/web e2e run agent-lab-single-agent --json
```

命令会在空闲的本机回环端口启动自己拥有的服务器。默认先构建生产版本再启动；`--dev` 显式选择 Next
开发模式。命令会忽略继承的 `BASE_URL`。每次运行都会在 `output/e2e/local-test-cli/` 下创建独立目录，保存
`summary.json`、构建/服务器/行程日志，以及该行程的截图、API 流和 artifact。摘要记录请求的脚本、最终状态、复现
命令、服务器模式、保留的构建目录和证据路径。

JSON 模式只向标准输出写入一个 JSON 对象；子进程输出保存在本次运行的日志文件中。使用 pnpm 的 `--silent`
选项，避免 pnpm 自己的包信息出现在 JSON 对象前。对象包含 `outcome`、`requested`、各脚本的 `results`、
`summaryFile` 和 `evidenceDirectory`。`passed` 返回零退出码；`unsupported`、`blocked`、`failed`、
`startup_failed`、`timed_out` 和 `interrupted` 都返回非零退出码。

本地进程只接收基本运行环境设置。已知的模型、供应商、数据库、KV 和认证凭据会在构建和运行时清空，包括 Next
读取应用目录本地 dotenv 文件的情况；命令会启用 mock 数据并禁用 Agent Lab 实时运行。Next 会使用本次调用专属的
临时 TypeScript 配置，因此构建不会把临时输出目录写进共享的 `apps/web/tsconfig.json`。构建目录会保留，并作为
本次拥有的资源记录在摘要中。这能隔离仓库当前使用的这些集成，但不构成通用网络出口防火墙。新增凭据名称时，必须
先加入命令的屏蔽列表，才能纳入此隔离保证。

首个支持的行程是 `agent-lab-single-agent`，会在桌面和手机视口完整运行已注册的 Agent Lab fixture。断言覆盖
fixture 来源、已完成的 API artifact、渲染后的计划、键盘访问、工作区存储未改变以及浏览器错误。原始命令仍可使用：

```bash
pnpm --filter @trip/web e2e agent-lab-single-agent
```

原始脚本保留既有环境变量和复用服务器的行为。需要 fixture 隔离和每次运行独立证据时，请使用新的 `run` 命令。

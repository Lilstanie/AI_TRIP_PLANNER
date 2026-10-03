<a id="development-environment"></a>

# 开发环境

[English](development.md) | 中文

<a id="prerequisites"></a>

## 前置条件

- Node.js 22 或更新版本
- pnpm 9.15.0，由 `packageManager` 固定版本；`corepack enable` 会选择该版本
- 本地开发不一定需要 API 密钥：默认启用 mock 工具和确定性的回退逻辑。

<a id="local-setup"></a>

## 本地配置

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev                     # http://localhost:3000
```

把真实凭据保存在 `.env.local` 中，绝不提交。只使用 `pnpm`，以保持工作区锁文件一致。

<a id="code-organization"></a>

## 代码组织

Web 应用按职责分组，不把所有组件和辅助函数放在一个平铺目录中。新增 UI 应放到 `apps/web/components/` 下最接近的功能目录：`workspace`、`chat`、`trip`、`map`、`preferences`，或用于共享基础组件的 `ui`。可在浏览器中安全运行的领域逻辑放在 `apps/web/lib/` 下对应的目录；外部客户端放在 `apps/web/lib/integrations/`。所有 Web 测试放在 `apps/web/tests/` 下，镜像 `app`、`components` 和 `lib` 的功能分组；共享 fixture（测试前置数据）放在 `apps/web/tests/fixtures/`，初始化配置放在 `apps/web/tests/setup.ts`。各包目录遵循同样的规则：生产代码放在 `src/` 下，测试放在各包的 `tests/` 目录下。

功能跨越多个目录时，把公开约定保留在领域模块中，并从那里导入，不另建根级便捷文件。目录边界变化时，同步更新本节和 API 文档。

Web UI 使用 Tailwind CSS v4 和由项目源码维护的 shadcn 基础组件。Tailwind 通过 `apps/web/postcss.config.mjs` 配置，由 `apps/web/app/globals.css` 导入；本项目中的 v4 不使用传统的 `tailwind.config.js`。`apps/web/components.json` 配置 shadcn CLI（命令行界面），生成的基础组件位于 `apps/web/components/ui/`，并从 `@/lib/utils` 使用 `cn()`。保留现有语义 token，逐步将领域 CSS 迁移到 `apps/web/app/styles/` 下；替换自定义焦点管理的 Dialog 或 Drawer 时，必须保留其键盘和焦点行为。

<a id="file-size-and-style-boundaries"></a>

### 文件大小和样式边界

生产源码和测试文件应不超过 1000 行代码。文件超过这一阈值时，按职责拆分，不继续在同一文件中增加章节。CSS 文件应使用领域名称，例如 `workspace-navigation.css`、`workspace-layout.css`、`workspace-drawers.css` 和 `workspace-responsive.css`；汇总文件可以保持很小，只包含有序的 `@import` 语句。拆分基础规则、覆盖层和响应式覆盖规则时，保留导入顺序。已经超出阈值的现有文件，在下次修改其领域时逐步迁移；新增或大幅修改的文件，若未记录例外，不得超出阈值。

Next.js API 端点保留框架要求的 `route.ts` 文件名。目录路径就是路由命名空间，因此 `app/api/chat/route.ts` 对应 `/api/chat`，不会与 `app/api/places/search/route.ts` 冲突。这些文件应作为轻量的 Route Handler 适配器，把可复用业务逻辑移入 `apps/web/lib/` 或包的 `src/` 模块。不要仅为保证文件名唯一而重命名 `route.ts`。

Next.js 只读取其运行目录（`apps/web`）下的 `.env*` 文件，绝不读取 monorepo 根目录；该查找行为没有可用于重定向的配置选项，开发服务器自身的文件监听器还会重新应用它，因此从 `next.config.mjs` 指向其他位置无法在 `next
dev` 中持续生效。`pnpm install` 会在 `postinstall` 阶段运行 `scripts/link-env.mjs`：当应用中的文件尚不存在时，创建 `apps/web/.env.local`，将其作为指向根目录 `.env.local` 的符号链接。脚本有意不覆盖现有普通文件；若保留该文件，所有运行时凭据必须在其中配置。Windows 上需要开发者模式或提权后的 shell；无法创建符号链接时，可以手动创建：

```bash
ln -s ../../.env.local apps/web/.env.local
```

<a id="environment-variables"></a>

## 环境变量

`.env.example` 描述了所有变量。主要变量如下：

| 配置                                                                | 用途                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`                                                  | 从聊天中提取行程需求，支持全部五个 specialist、supervisor 和聊天回复。未配置时，本地规则解析器负责提取，agent（智能体）使用确定性回退逻辑。                                                                                                             |
| `USE_MOCK_TOOLS=true`（默认）                                       | 进程内的地图和预订 fixture；不调用外部服务。                                                                                                                                                                                                            |
| `USE_MOCK_TOOLS=false`                                              | 由 `MAPS_PROVIDER`（`google` 或 `osm`）选择真实地图适配器。未设置时，若配置了 `MAPS_API_KEY` 就使用 Google，否则使用 OpenStreetMap；`.env.example` 设置为 `osm`。配置 `SERPAPI_KEY` 后，预订功能使用 SerpApi，酒店回退仍采用现有的 Google Places 估价。 |
| `OSM_USER_AGENT`                                                    | Nominatim 要求提供的联系信息字符串。产生真实流量前替换 `contact@example.com` 占位值，否则可能触发限流。                                                                                                                                                 |
| `MAPS_API_KEY`                                                      | 服务端 Google Places、Routes 和 Time Zone，用于工作区地图和编辑预览。                                                                                                                                                                                   |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`、`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | 浏览器中的 Google Maps JavaScript 地图。未配置时，工作区显示地图回退界面，行程仍可使用。                                                                                                                                                                |
| `SERPAPI_KEY`                                                       | Google Hotels、Google Flights 和城际 Google Maps 公共交通搜索共享的 SerpApi 密钥。仅在 `USE_MOCK_TOOLS=false` 时使用；不替代 Google Maps、Places、Routes 或 Weather API。                                                                               |
| `WEATHER_API_KEY`                                                   | Google Weather 提供第 0–10 天的天气预报；未配置时回退到 `MAPS_API_KEY`。第 11–14 天由 Open-Meteo 提供，无需密钥。                                                                                                                                       |
| `KV_REST_API_URL`、`KV_REST_API_TOKEN`                              | 用于聊天轮次、偏好、方案和 SerpApi 用量／缓存的持久化 Redis REST 存储。未配置时，状态保存在进程内存中。                                                                                                                                                 |

账号是可选功能，只在 `.env.local` 中配置（这些名称不在 `.env.example` 中）：

| 设置                                                    | 用途                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` | Clerk 登录。没有 publishable key 时，工作区为单用户本地模式，账号路由返回 503。`clerk init` 还会写入登录路由变量。 |
| `DATABASE_URL`                                          | Neon Postgres（pooled 连接串），保存已登录用户的设置、行程和聊天。本地使用开发分支；生产环境由 owner 的集成提供。  |

用 `pnpm --filter @trip/web db:migrate` 建表（它会加载 `.env.local`）；修改 `apps/web/lib/db/schema.ts`
后，用 `pnpm --filter @trip/web db:generate` 生成迁移并提交到 `apps/web/drizzle/`。在 Vercel 上，Clerk
和 Neon 的 Marketplace 集成会注入相同名称的变量。

Agent Lab 的实时运行默认关闭，除非部署启用它（这些名称不在 `.env.example` 中）：

| 设置                               | 用途                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `AGENT_LAB_LIVE_ENABLED`           | 恰为 `true` 时，`/agent-lab` 才提供实时运行，它使用上面的模型和提供方密钥。其他任何值都保持实时关闭；fixture 数据从不受影响。 |
| `AGENT_LAB_LIVE_MAX_CONCURRENT`    | 同时进行的实时运行数。默认 `1`；`0` 表示不允许；上限 `20`。                                                                   |
| `AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR` | 滚动一小时内可开始的实时运行数。默认 `6`；`0` 表示不允许；上限 `1000`。                                                       |

无法使用的值会回退为默认值，绝不会变成无限制。计数保存在单个服务进程中，因此运行多个实例的部署会对每个实例分别应用限额；设置时请考虑这一点。

Google 密钥限制和地图行为见[工作区 UI](workspace-ui.zh.md#google-maps-configuration)。模型路由和回退逻辑见[架构](architecture.zh.md#agents-and-models)。

<a id="external-data-provider-plan"></a>

<a id="location-lookup"></a>

## 定位地址查询

即使规划使用 mock 模式，明确点击定位按钮也会使用 Nominatim。
通过 `NOMINATIM_BASE_URL` 切换服务，并将 `OSM_USER_AGENT` 设为包含真实联系信息的应用标识。
没有可用配置时，适配器以项目 GitHub URL 标识应用。不需要 API 密钥，也不提供输入自动补全。
共享进程限流器使 Nominatim 请求至少间隔 1.1 秒，并缓存最多 100 条响应，保留 24 小时。
公共 Nominatim 要求整个部署每秒最多一个请求：多实例部署需使用单进程、共享限流或其他提供方。
仅点击按钮并获得浏览器权限后发送坐标；用户须核对地址，查询失败时可手动填写。
遵守[使用政策](https://operations.osmfoundation.org/policies/nominatim/)。

## 外部数据提供方方案

使用项目的 [api-scout skill（技能）](../.agents/skills/api-scout/SKILL.md)，从 [public-apis 目录](https://github.com/public-apis/public-apis) 中发现候选提供方。只把该仓库视为持续变化的索引：在把提供方加入下表或实现适配器之前，必须通过其官方文档核实访问方式、价格、配额、数据使用权、新鲜度和地域覆盖。

SerpApi 是项目当前酒店和航班搜索层的提供方。一个 `SERPAPI_KEY` 可用于两个 SerpApi 引擎，但这不意味着 SerpApi 是通用旅行后端：

| 能力                                      | 提供方                                                                                               | 状态和边界                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 酒店搜索和参考价格                        | [SerpApi Google Hotels](https://serpapi.com/google-hotels-api)                                       | 配置后返回实时搜索结果；结果是规划数据，不代表预订或保证有效的报价。                                          |
| 航班搜索和参考票价                        | [SerpApi Google Flights](https://serpapi.com/google-flights-api)                                     | 提供搜索结果和票价；不预订机票，也不提供完整的运行状态数据流。                                                |
| 交互地图                                  | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)   | 使用 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 在浏览器端渲染地图。                                                   |
| 地点搜索和详情                            | [Google Places API](https://developers.google.com/maps/documentation/places/web-service/op-overview) | 使用 `MAPS_API_KEY` 在服务端核实地点；地点照片通过 `/api/places/photo` 获取，按图片计费且仅在实时模式下使用。 |
| 路线和出行时间                            | [Google Routes API](https://developers.google.com/maps/documentation/routes)                         | 对行程编辑进行路线和距离检查。                                                                                |
| Routes 无公共交通数据时的城际铁路（日本） | [SerpApi Google Maps Directions](https://serpapi.com/google-maps-directions-api)                     | 仅用于交通部分的城际路段；提供时长、班次和每人票价，换算成整组旅客的 AUD 费用；回退到驾车。                   |
| 时区                                      | [Google Time Zone API](https://developers.google.com/maps/documentation/timezone/overview)           | 计算目的地本地时间。                                                                                          |
| 天气预报                                  | Google Weather API（第 0–10 天）、Open-Meteo（第 11–14 天）、第 14 天之后使用 Open-Meteo 历史归档    | 已在工具网关实现，明确标记预报／气候数据来源；不把通用 SerpApi 网页结果视为天气数据。                         |
| 航班延误、登机口和运行状态                | Aviationstack 或其他航空状态提供方                                                                   | 可选的未来能力；酒店／航班价格搜索不需要它。                                                                  |
| 聊天、偏好、行程方案和 SerpApi 用量／缓存 | 兼容 Upstash 的 Redis REST 存储                                                                      | 部署时配置 `KV_REST_API_URL` + `KV_REST_API_TOKEN`；本地／离线运行采用进程内回退。                            |

因此，当前 MVP 不需要 Travelpayouts 和 Aviationstack。只有产品需要联盟库存／预订流程或航班运行状态数据时才添加它们。SerpApi 也不替代持久化应用存储。

密钥必须设置在 Next.js 读取的环境中，通常是 `apps/web/.env.local`（工作区符号链接存在时，也可以是仓库根目录 `.env.local`）。只复制到 `Downloads/dp.txt` 的密钥属于盘点记录，应用不会加载。使用真实提供方流量时，配置如下：

```env
USE_MOCK_TOOLS=false
SERPAPI_KEY=your-serpapi-key
```

真实凭据不得进入 Git，也不得进入已提交的文档。

需要部署后的持久性时，为 Vercel 项目配置 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`（也接受等价名称 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`）。共享 Redis REST 存储支撑聊天轮次、偏好、生成的行程方案以及 SerpApi 用量／缓存状态。没有这些变量时，本地测试和离线开发使用进程内回退，不应视为生产部署检查。

<a id="mock-server"></a>

## Mock 服务器

`pnpm mock-server` 在 4000 端口启动一个可选的 stub HTTP 服务器。应用从不调用它：mock 工具在进程内运行。该服务器保留用于适配器实验，并由 Docker Compose 启动。

<a id="docker"></a>

## Docker

```bash
docker compose up
```

Compose 文件在 3000 端口启动 Web 应用（读取 `.env.local`），在 4000 端口启动 stub mock 服务器。Redis 是可选的，目前被注释掉。

<a id="agent-workflows"></a>

## Agent 工作流

项目 skill 直接位于 `.agents/skills/<name>/SKILL.md`。下表按用途组织导航；每个 skill 保留独立的可发现入口，并按需加载参考文件。

| 领域                 | Skills                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 界面设计与动效       | [better-layout](../.agents/skills/better-layout/SKILL.md), [better-ui](../.agents/skills/better-ui/SKILL.md), [better-accessibility](../.agents/skills/better-accessibility/SKILL.md), [better-writing](../.agents/skills/better-writing/SKILL.md), [libraries-dev](../.agents/skills/libraries-dev/SKILL.md) |
| 功能与数据提供方实现 | [end-to-end-feature-wiring](../.agents/skills/end-to-end-feature-wiring/SKILL.md), [api-scout](../.agents/skills/api-scout/SKILL.md), [add-provider](../.agents/skills/add-provider/SKILL.md), [agent-experience](../.agents/skills/agent-experience/SKILL.md)                                                |
| 审查与验证           | [code-review](../.agents/skills/code-review/SKILL.md), [find-simplifications](../.agents/skills/find-simplifications/SKILL.md), [break](../.agents/skills/break/SKILL.md), [ui-verification](../.agents/skills/ui-verification/SKILL.md), [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md)       |
| 文档与决策           | [prose-standard](../.agents/skills/prose-standard/SKILL.md), [translate-docs](../.agents/skills/translate-docs/SKILL.md), [agent-notes](../.agents/skills/agent-notes/SKILL.md), [session-log](../.agents/skills/session-log/SKILL.md)                                                                        |

`pnpm verify:docs` 还会用 `scripts/skill-rules.mjs` 检查每个 skill，分为两级。下列规则会使检查失败：`name` 为小写
kebab-case 且与文件夹一致（最多 64 个字符）；`description` 不超过 1,024 个字符，并同时说明 skill 做什么和何时使用
（“Use when …”）；`compatibility` 字段不超过 500 个字符；辅助文件只放在 `references/`、`scripts/` 和 `assets/` 下（另可有
许可证文件）；参考文件不得链接到其他参考文件，也不得链接到其他 skill 的参考文件。它们来自
[Agent Skills 规范](https://agentskills.io/specification)和本项目的目录约定。下列只是提示，会打印但不会使检查失败：
`SKILL.md` 超过 500 行（规范建议不超过）、name、description 和 `when_to_use` 合计超过 1,536 个字符（Claude Code 为每个 skill
显示的触发预算），以及脚本不认识的前置字段。`pnpm test:scripts` 运行这些规则的测试，CI 会在 `pnpm test` 之后运行它。

Libraries.dev skill 支持 `libraries reveal`、`libraries review` 和 `libraries apply`。它在[工作区设计约定](design/ui-guidelines.zh.md)内选择具体动效；`better-ui` 负责通用视觉打磨，`ui-verification` 负责浏览器验收。安装 skill 添加的是指令和参考文件；只有已授权实现具体动效时才添加 npm 包。[整合决策](../.agents/notes/implemented/process/2026-09-26-libraries-dev-project-skill.md)记录了来源和分类理由。

使用 [find-simplifications](../.agents/skills/find-simplifications/SKILL.md) 提出有证据支持的移除建议，并执行已授权的清理。使用 [prose-standard](../.agents/skills/prose-standard/SKILL.md) 编辑技术文档和注释，同时保留行为和失败保证；[better-writing](../.agents/skills/better-writing/SKILL.md) 负责界面语气和术语。这些工作流遵循项目现有的保护与验证规则。适配情况记录在 [Agent Note](../.agents/notes/implemented/process/2026-09-26-simplification-prose-skills.md) 中。

[agent-experience](../.agents/skills/agent-experience/SKILL.md) 指导面向模型的工具定义和上下文交付。[translate-docs](../.agents/skills/translate-docs/SKILL.md) 维护[中英文文档配对](i18n.zh.md)；修改任何一种语言时，都要在同一任务中更新对侧文件。

<a id="verification"></a>

## 验证

文档变化还需在审查并记录已修改的配对后，运行本地配对检查。这项检查独立于 `pnpm verify:docs`，CI 会在拉取请求中运行它：

```bash
node .agents/skills/translate-docs/scripts/check-pairs.mjs
```

<a id="testing-approach"></a>

### 测试方式

复杂功能应优先只用端到端（E2E）测试验证行为：走完整用户路径，并留下可复现、可审查的产物，例如报告、trace 或截图。记录复现所需的命令、步骤或 fixture。绝不在编写实现代码之后再编写单元测试。如果必须隔离测试一个系统，先列举它所有可能的失败方式，再编写代码，并从这份清单推导隔离检查。

这是新工作的首选方式。CI 通过 `pnpm test` 运行 Vitest 测试套件，通过 `pnpm test:scripts` 运行仓库脚本测试（`scripts/*.test.mjs`）。CI 不运行 E2E 脚本，因此推送前应自行运行相关脚本。

E2E 脚本位于 `apps/web/tests/e2e/`，需手动对运行中的开发服务器执行：

```bash
pnpm --filter @trip/web dev            # in another terminal
node apps/web/tests/e2e/<name>.e2e.mjs
```

- **API 脚本**（`plan-quality`、`conversation-scope`）向 `/api/chat` 发请求，`DATA_MODE=live` 为默认值，也可设为 `mock`。`plan-quality` 提交三个固定行程需求，并检查预算、未解决冲突、行程来源、重复停靠点和泛化停靠点；实时模型输出会变化，因此应比较多次运行。每次运行把 NDJSON 流、方案和 `summary.json` 写入 `output/e2e/<name>/<run>/`。
- **浏览器脚本**（其余所有脚本，包括八个 `agent-lab-*`）用 Playwright 在桌面和手机宽度下运行，并把截图写入 `output/playwright/<name>/`；Agent Lab 的脚本还会写入原始 NDJSON 和 artifact。`CHANNEL=chrome` 与 `PLAYWRIGHT=<path>` 用于选择浏览器和 Playwright 包；服务器不在 `http://localhost:3000` 时用 `BASE_URL` 指定。

`output/e2e/` 和 `output/playwright/` 已被 Git 忽略。每个脚本的文件头列出它所依据的失败清单和所需的服务器环境，fixture 运行与部署的密钥和默认数据模式相互隔离，因此无论环境中有什么，Agent Lab 的脚本都能通过；`agent-lab-live-gate` 还会使用两个启用了实时运行的服务（见其文件头）。`agent-lab-release` 走完整个公开流程并写出发布证据：原始 NDJSON、带版本的产物、对比摘要、报告，以及一组截图矩阵（浅色与深色、桌面与窄屏、减少动态效果）。

`apps/web/tests/e2e/leg-mode-choice.e2e.mjs` 检查：旅行者为某一程选择的出行方式（`TripBrief.legModes`）确实是计划所采用的方式，或者被如实报告为不可用，绝不会被悄悄替换。四个场景不需要模型（选择通过简报传入），一个需要模型（旅行者在聊天中说出）；没有模型密钥时，这一个会报告 `skip` 而不是失败。产物写入 `output/e2e/leg-mode-choice/<run>/`。

```bash
pnpm --filter @trip/web dev          # in another terminal
DATA_MODE=mock node apps/web/tests/e2e/leg-mode-choice.e2e.mjs
```

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:scripts
pnpm build
```

CI（`.github/workflows/ci.yml`）在拉取请求和推送到 `main` 时，用 Node 22 运行这五条命令。

使用 `pnpm --filter @trip/agents test`、`pnpm --filter @trip/orchestrator test` 或 `pnpm --filter @trip/web test` 针对特定包运行测试。Web 测试脚本使用 POSIX shell 语法设置 `NODE_OPTIONS`；Windows 上应从 WSL 或 Git Bash 运行。

如果在 `pnpm dev` 运行时执行 `pnpm build`，启动开发服务器时应设置 `NEXT_DIST_DIR=.next-dev`，避免二者共用 `.next` 输出目录。

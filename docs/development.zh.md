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

| 配置                                                                | 用途                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEEPSEEK_API_KEY`                                                  | 从聊天中提取行程需求，支持全部五个 specialist、supervisor 和聊天回复。未配置时，本地规则解析器负责提取，agent（智能体）使用确定性回退逻辑。                                                                                                                                    |
| `USE_MOCK_TOOLS=true`（默认）                                       | 进程内的地图和预订 fixture；不调用外部服务。                                                                                                                                                                                                                                   |
| `USE_MOCK_TOOLS=false`                                              | 由 `MAPS_PROVIDER`（`google` 或 `osm`）选择真实地图适配器。未设置时，若配置了 `MAPS_API_KEY` 就使用 Google，否则使用 OpenStreetMap；`.env.example` 设置为 `osm`。配置 `SERPAPI_KEY` 后，预订功能使用 SerpApi，酒店仅在选择 Google Maps 且配置密钥时回退到 Google Places 估价。 |
| `OSM_USER_AGENT`                                                    | Nominatim 要求提供的联系信息字符串。产生真实流量前替换 `contact@example.com` 占位值，否则可能触发限流。                                                                                                                                                                        |
| `MAPS_API_KEY`                                                      | 服务端 Google Places、Routes 和 Time Zone，用于工作区地图和编辑预览。                                                                                                                                                                                                          |
| `WEB_MAPS_PROVIDER`                                                 | 工作区的地图提供方：`google-with-fallback`（默认；优先使用 Google，Google 无法应答时使用 OpenStreetMap）、`google`（绝不回退）或 `osm`。与 agent 的 `MAPS_PROVIDER` 相互独立。见 [Web 地图提供方](architecture.zh.md#web-map-providers)。                                      |
| `GOOGLE_MAPS_COOLDOWN_SECONDS`                                      | 发生访问被拒或配额失败后，工作区跳过 Google 的时长（默认 300 秒）。                                                                                                                                                                                                            |
| `OSRM_FOOT_BASE_URL`                                                | 免费回退路径中步行路段使用的 OSRM 基础 URL（默认 `https://routing.openstreetmap.de/routed-foot`，即 FOSSGIS 步行实例）。演示服务器只提供汽车路线，因此步行需要步行配置。                                                                                                       |
| `OSRM_BIKE_BASE_URL`                                                | 骑行使用的 OSRM 基础 URL（默认 `https://routing.openstreetmap.de/routed-bike`）；绝不使用汽车实例。                                                                                                                                                                            |
| `OSRM_BASE_URL`                                                     | 免费回退路径中驾车路段使用的 OSRM 基础 URL（默认 `https://router.project-osrm.org`，即只提供汽车路线的公共演示服务器）。智能体的 `MAPS_PROVIDER=osm` 也读取它。                                                                                                                |
| `MOCK_GOOGLE_MAPS=unavailable`                                      | 测试开关：模拟数据模式下，工作区不调用 Google 而直接视其为不可用，供 E2E 走回退路径。实时模式下忽略。                                                                                                                                                                          |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`、`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | 浏览器中的 Google Maps JavaScript 地图。未配置时，工作区显示地图回退界面，行程仍可使用。                                                                                                                                                                                       |
| `SERPAPI_KEY`                                                       | Google Hotels、Google Flights 和城际 Google Maps 公共交通搜索共享的 SerpApi 密钥。仅在 `USE_MOCK_TOOLS=false` 时使用；不替代 Google Maps、Places、Routes 或 Weather API。                                                                                                      |
| `WEATHER_API_KEY`                                                   | Google Weather 提供第 0–9 天的天气预报；未配置时回退到 `MAPS_API_KEY`。第 10–14 天由 Open-Meteo 提供，无需密钥。                                                                                                                                                               |
| `KV_REST_API_URL`、`KV_REST_API_TOKEN`                              | 用于聊天轮次、偏好、方案和 SerpApi 用量／缓存的持久化 Redis REST 存储。未配置时，状态保存在进程内存中。                                                                                                                                                                        |

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

## 外部数据提供方方案

使用项目的 [api-scout skill（技能）](../.agents/skills/api-scout/SKILL.md)，从 [public-apis 目录](https://github.com/public-apis/public-apis) 中发现候选提供方。只把该仓库视为持续变化的索引：在把提供方加入下表或实现适配器之前，必须通过其官方文档核实访问方式、价格、配额、数据使用权、新鲜度和地域覆盖。

SerpApi 是项目当前酒店和航班搜索层的提供方。一个 `SERPAPI_KEY` 可用于两个 SerpApi 引擎，但这不意味着 SerpApi 是通用旅行后端：

| 能力                                      | 提供方                                                                                                                                    | 状态和边界                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 酒店搜索和参考价格                        | [SerpApi Google Hotels](https://serpapi.com/google-hotels-api)                                                                            | 配置后返回实时搜索结果；结果是规划数据，不代表预订或保证有效的报价。                                          |
| 航班搜索和参考票价                        | [SerpApi Google Flights](https://serpapi.com/google-flights-api)                                                                          | 提供搜索结果和票价；不预订机票，也不提供完整的运行状态数据流。                                                |
| 交互地图                                  | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)                                        | 使用 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 在浏览器端渲染地图。                                                   |
| 地点搜索和详情                            | [Google Places API](https://developers.google.com/maps/documentation/places/web-service/op-overview)                                      | 使用 `MAPS_API_KEY` 在服务端核实地点；地点照片通过 `/api/places/photo` 获取，按图片计费且仅在实时模式下使用。 |
| 路线和出行时间                            | [Google Routes API](https://developers.google.com/maps/documentation/routes)                                                              | 对行程编辑进行路线和距离检查。                                                                                |
| 步行和驾车回退                            | [OSRM](https://project-osrm.org/)，FOSSGIS（`routing.openstreetmap.de`）与演示服务器（`router.project-osrm.org`）                         | Google Routes 无法应答时使用；见 [Web 地图提供方](architecture.zh.md#web-map-providers)。                     |
| Routes 无公共交通数据时的城际铁路（日本） | [SerpApi Google Maps Directions](https://serpapi.com/google-maps-directions-api)                                                          | 仅用于交通部分的城际路段；提供时长、班次和每人票价，换算成整组旅客的 AUD 费用；回退到驾车。                   |
| 时区                                      | [Google Time Zone API](https://developers.google.com/maps/documentation/timezone/overview)，失败时离线查询（`@photostructure/tz-lookup`） | 计算目的地本地时间。                                                                                          |
| 天气预报                                  | Google Weather API（第 0–9 天）、Open-Meteo（第 10–14 天）、第 14 天之后使用 Open-Meteo 历史归档                                          | 已在工具网关实现，明确标记预报／气候数据来源；不把通用 SerpApi 网页结果视为天气数据。                         |
| 航班延误、登机口和运行状态                | Aviationstack 或其他航空状态提供方                                                                                                        | 可选的未来能力；酒店／航班价格搜索不需要它。                                                                  |
| 聊天、偏好、行程方案和 SerpApi 用量／缓存 | 兼容 Upstash 的 Redis REST 存储                                                                                                           | 部署时配置 `KV_REST_API_URL` + `KV_REST_API_TOKEN`；本地／离线运行采用进程内回退。                            |

因此，当前 MVP 不需要 Travelpayouts 和 Aviationstack。只有产品需要联盟库存／预订流程或航班运行状态数据时才添加它们。SerpApi 也不替代持久化应用存储。

密钥必须设置在 Next.js 读取的环境中，通常是 `apps/web/.env.local`（工作区符号链接存在时，也可以是仓库根目录 `.env.local`）。只复制到 `Downloads/dp.txt` 的密钥属于盘点记录，应用不会加载。使用真实提供方流量时，配置如下：

```env
USE_MOCK_TOOLS=false
SERPAPI_KEY=your-serpapi-key
```

真实凭据不得进入 Git，也不得进入已提交的文档。

需要部署后的持久性时，为 Vercel 项目配置 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`（也接受等价名称 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`）。共享 Redis REST 存储支撑聊天轮次、偏好、生成的行程方案以及 SerpApi 用量／缓存状态。没有这些变量时，本地测试和离线开发使用进程内回退，不应视为生产部署检查。Redis 命令通过 POST 请求体中的 JSON 数组发送，包括较大的方案；请求有五秒截止时间。短期聊天历史保留最近 20 条轮次。完成的聊天方案先通过流发送，再保存可选的持久副本；流最多等待五秒，持久化失败与规划失败分别记录。

<a id="mock-server"></a>

## Mock 服务器

`pnpm mock-server` 在 4000 端口启动一个可选的 stub HTTP 服务器。应用从不调用它：mock 工具在进程内运行。该服务器保留用于适配器实验，并由 Docker Compose 启动。

<a id="docker"></a>

## Docker

```bash
docker compose up
```

Compose 文件在 3000 端口启动 Web 应用（读取 `.env.local`），在 4000 端口启动 stub mock 服务器。Redis 是可选的，目前被注释掉。

<a id="installable-app"></a>

## 可安装应用

网站是一个 PWA（渐进式 Web 应用），所以同一个部署可以安装到所有设备上；原因见
[Agent Note](../.agents/notes/implemented/feature/2026-10-05-installable-app.md)。

- **电脑**：Chrome 或 Edge 地址栏会出现"安装"按钮。
- **iPhone**：Safari 的分享菜单，选择"添加到主屏幕"。
- **Android**：Chrome 菜单，选择“安装应用”。

网站这一侧是 `apps/web/app/manifest.ts`、`apps/web/public/icons/` 里的图标和 `apps/web/public/sw.js`
（页面导航失败时回退到 `public/offline.html`，不缓存任何动态内容）。Service worker 只在生产构建中注册。用生产服务器检查可安装性：

```bash
pnpm --filter @trip/web e2e installable-app --prod
```

它把截图和 `summary.json` 写到 `output/playwright/installable-app/`。Chrome 的可安装性检查在完整
Chromium（`CHANNEL=chrome` 时改用 Chrome）和一个用完即删的持久化配置文件中运行，并确认它能报告移除了
manifest 链接的页面。

<a id="licence-and-third-party-code"></a>

## 许可与第三方代码

仓库采用 MIT 许可（见 [LICENSE](../LICENSE)），每个 `package.json` 都声明 `"license": "MIT"`。引入或移植其他项目的代码时，请保留其文件头声明，并在同一个拉取请求中记录到 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)：名称、上游 URL、许可、版权行以及包含该代码的文件。

<a id="agent-workflows"></a>

## Agent 工作流

项目 skill 直接位于 `.agents/skills/<name>/SKILL.md`。下表按用途组织导航；每个 skill 保留独立的可发现入口，并按需加载参考文件。

`vercel-react-best-practices` 提供 React 与 Next.js 性能参考；`playwright-best-practices` 提供浏览器测试实现与调试参考。两个技能均安装在当前项目中，按需加载相关参考文件。项目指令负责测试策略、运行命令和验收证据；上游示例是在这些规则内使用的技术指导。现有 E2E 运行器仍是执行入口。安装这两个技能不会新增 npm 依赖，也不会配置 `@playwright/test`。来源版本、本地适配和更新规则记录在[整合决策](../.agents/notes/implemented/process/2026-10-11-framework-reference-skills.md)中。

用 `review-trip-planner` 检查本库特有风险；全局 `code-review-standards-spec` 负责 Standards（规范）与 Spec（规格）双轴审查流程。OCR 插件保留各自的 `open-code-review` 和 `open-code-review-delegate` 名称。

[review-trip-planner](../.agents/skills/review-trip-planner/SKILL.md) 负责审查交接材料和新增注释检查。
其参考文档说明 CLI、显式文件范围、有理由的例外，以及独立验收的证据。
独立的 [Comment policy workflow](../.github/workflows/comment-policy.yml) 在 PR 和 main 推送时调用同一检查器。
PR 检查 merge-base 到 head；推送检查上一个分支 tip 到 head。
仅选择改动的 JS/TS 路径，检测到重命名时保留未变的注释。
没有适用路径时明确跳过；历史缺失、配置无效和检查器错误均失败。
版本化的精确例外清单随代码审查；文本匹配不能证明理由合理。
报告和回归摘要保留七天。任务安装依赖时不执行生命周期脚本，也不需要浏览器。
必需检查设置单独配置。
其验收覆盖 JSX 文本边界，以及暂存删除后重新创建的文件。

| 领域                   | Skills                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 与浏览器测试参考 | [vercel-react-best-practices](../.agents/skills/vercel-react-best-practices/SKILL.md), [playwright-best-practices](../.agents/skills/playwright-best-practices/SKILL.md)                                                                                                                                                                                                               |
| 界面设计与动效         | [better-layout](../.agents/skills/better-layout/SKILL.md), [better-ui](../.agents/skills/better-ui/SKILL.md), [better-accessibility](../.agents/skills/better-accessibility/SKILL.md), [better-writing](../.agents/skills/better-writing/SKILL.md), [libraries-dev](../.agents/skills/libraries-dev/SKILL.md)                                                                          |
| 功能与数据提供方实现   | [end-to-end-feature-wiring](../.agents/skills/end-to-end-feature-wiring/SKILL.md), [api-scout](../.agents/skills/api-scout/SKILL.md), [add-provider](../.agents/skills/add-provider/SKILL.md), [agent-experience](../.agents/skills/agent-experience/SKILL.md)                                                                                                                         |
| 审查与验证             | [review-trip-planner](../.agents/skills/review-trip-planner/SKILL.md), [find-simplifications](../.agents/skills/find-simplifications/SKILL.md), [break](../.agents/skills/break/SKILL.md), [ui-verification](../.agents/skills/ui-verification/SKILL.md), [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md), [e2e-maintenance](../.agents/skills/e2e-maintenance/SKILL.md) |
| 文档与决策             | [prose-standard](../.agents/skills/prose-standard/SKILL.md), [translate-docs](../.agents/skills/translate-docs/SKILL.md), [agent-notes](../.agents/skills/agent-notes/SKILL.md), [session-log](../.agents/skills/session-log/SKILL.md), [skill-maintenance](../.agents/skills/skill-maintenance/SKILL.md)                                                                              |

诊断或修复测试本身时，使用 [e2e-maintenance](../.agents/skills/e2e-maintenance/SKILL.md)。它通过现有运行器对比条件相同的基线与当前分支运行，核对断言和进程结果，并保留成功对照与故意失败对照。应用界面验收仍使用 [ui-verification](../.agents/skills/ui-verification/SKILL.md)，推送前的检查选择仍使用 [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md)。

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

这是新工作的首选方式。CI 通过 `pnpm test` 运行 Vitest 测试套件，通过 `pnpm test:scripts` 运行仓库脚本测试（`scripts/*.test.mjs`）。CLI 验收采用[变更选择和隔离 CI worker](#cli-acceptance-in-ci)，包括其中的 fixture 浏览器旅程；即使失败，也保留日志、摘要和浏览器证据七天。其余原始浏览器脚本仍在本地执行，推送前应运行相关脚本；`main` 上的已知失败列在 [e2e-known-failures.zh.md](e2e-known-failures.zh.md) 中。不过 CI 会运行 `pnpm verify:e2e-selectors`：如果某个 E2E 脚本选择的 CSS 类（如 `.section__row`）在 `apps/web` 下已没有任何组件、页面或库文件渲染，它就会失败；只留在样式表里的规则不算。它不需要服务器，不到一秒即可完成。专门检查某个已删除的类不再出现的那一行，末尾加上 `// e2e-selectors: absent`；只由第三方库设置的类写进 `scripts/verify-e2e-selectors.mjs` 的 `ALLOWED`，并注明原因。

E2E 脚本位于 `apps/web/tests/e2e/`。需要 fixture 隔离、由命令启动并拥有服务器，以及每次运行独立证据时，请使用[本地 E2E 命令行工具](local-test-cli.zh.md)。其他情况可通过运行器执行脚本：它在空闲端口上启动服务器，从仓库根目录依次对其运行指定脚本，结束后只停止它自己启动的服务器：

```bash
pnpm --filter @trip/web e2e timeline display-currency     # names without .e2e.mjs; 'phone-*' works
pnpm --filter @trip/web e2e phone-shell --prod            # next build + next start, for scripts that ask for it
BASE_URL=http://localhost:3000 pnpm --filter @trip/web e2e settings   # against a server already running
```

环境变量会同时传给服务器和脚本，因此请按各脚本头部的说明设置 `DATA_MODE` 和数据源变量。每次调用分配唯一的 `apps/web/.next-e2e-<random>` 目录和独占的临时 TypeScript 配置，并发运行与 `pnpm dev` 不共享构建输出，也不改写共享 TypeScript 配置。运行器退出时会删除自己的目录，无论运行通过、失败还是被中断；设置 `E2E_KEEP_DIST=1` 可保留该目录供检查。继承的 `NEXT_TSCONFIG_PATH` 仍是显式覆盖配置。任一脚本失败时运行器以非零状态退出，并把摘要写入 `output/e2e/runner/<time>.json`。每个脚本有 `E2E_SCRIPT_TIMEOUT_MS`（默认 600000，即十分钟）的时间完成；超时仍在运行的脚本会连同它启动的浏览器一起被停止，在摘要中显示为 `TIME`（JSON 中为 `"timedOut": true`），然后继续运行下一个脚本。超时同样会让运行以非零状态退出。Playwright 是 `apps/web` 的开发依赖；在新机器上先运行一次 `pnpm --filter @trip/web exec playwright install chromium`。需要两个服务器的脚本（`agent-lab-live-gate`）仍按其头部说明手动运行。`pnpm dev` 和 `pnpm start` 默认使用 3000 端口，设置 `PORT` 可更改。

缺少密钥就无法运行的脚本在文件头（代码之前）声明：`// requires-env: DEEPSEEK_API_KEY`（多个密钥用逗号分隔）。所列变量未设置或为空时，运行器不会运行该脚本，而是报告 `skipped: needs DEEPSEEK_API_KEY`，把跳过记录到摘要中；若没有其他失败，仍以 0 退出；实际运行后失败的脚本仍使退出码非零。若所有指定脚本都被跳过，则不会启动服务器。`plan-quality` 和 `conversation-scope` 声明了 `DEEPSEEK_API_KEY`，因为它们检查的是模型的产出，在规则回退下会失败。格式错误的 `requires-env` 行会让运行器报错退出，而不是运行该脚本。

- **API 脚本**（`plan-quality`、`conversation-scope`）向 `/api/chat` 发请求，`DATA_MODE=live` 为默认值，也可设为 `mock`。`plan-quality` 提交三个固定行程需求，并检查预算、未解决冲突、行程来源、重复停靠点和泛化停靠点，任一检查失败或规划出错时以非零状态退出；实时模型输出会变化，因此应比较多次运行。每次运行把 NDJSON 流、方案和 `summary.json` 写入 `output/e2e/<name>/<run>/`。
- **浏览器脚本**（其余所有脚本，包括八个 `agent-lab-*`）用 Playwright 在桌面和手机宽度下运行，并把截图写入 `output/playwright/<name>/`；Agent Lab 的脚本还会写入原始 NDJSON 和 artifact。`CHANNEL=chrome` 与 `PLAYWRIGHT=<path>` 用于选择浏览器和 Playwright 包。

`output/`、`apps/web/output/`、`tmp/` 和 `.scratch/` 是被 Git 忽略的临时目录，其中 `output/` 会增长到数 GB。证据已写进 PR 描述后，运行 `pnpm clean:output` 删除它们；先运行 `pnpm clean:output --dry-run` 可只看各目录大小。只要这些目录下有已跟踪的文件，它就会拒绝执行。每个脚本的文件头列出它所依据的失败清单和所需的服务器环境，fixture 运行与部署的密钥和默认数据模式相互隔离，因此无论环境中有什么，Agent Lab 的脚本都能通过；`agent-lab-live-gate` 还会使用两个启用了实时运行的服务（见其文件头）。`agent-lab-release` 走完整个公开流程并写出发布证据：原始 NDJSON、带版本的产物、对比摘要、报告，以及一组截图矩阵（浅色与深色、桌面与窄屏、减少动态效果）。发布冒烟测试保留 `provider-empty-result` 作为有代表性的故障路径；`agent-lab-failures` 负责全部五个已注册故障 profile 的结果、下载、离线回放，以及 Run all 的顺序和取消。修改 Failure Lab 行为时应运行这两个脚本。

`auto-save-places`、`plan-revision` 和 `check-entry-point` 只通过 `apps/web/tests/e2e/trip-setup.mjs` 共用地点 fixture、工作区启动、按天数据到计划的转换和轮询。每个脚本仍负责自己的场景断言、请求拦截、挂起响应和截图；并发与取消的设置留在它们验证的场景旁。[覆盖归属说明](../.agents/notes/implemented/simplification/2026-10-10-repository-surface-reduction.md)记录了断言合并的边界。

`apps/web/tests/e2e/leg-mode-choice.e2e.mjs` 检查：旅行者为某一程选择的出行方式（`TripBrief.legModes`）确实是计划所采用的方式，或者被如实报告为不可用，绝不会被悄悄替换。四个场景不需要模型（选择通过简报传入），一个需要模型（旅行者在聊天中说出）；没有模型密钥时，这一个会报告 `skip` 而不是失败。产物写入 `output/e2e/leg-mode-choice/<run>/`。

```bash
DATA_MODE=mock pnpm --filter @trip/web e2e leg-mode-choice
```

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:scripts
pnpm build
```

CI（`.github/workflows/ci.yml`）在拉取请求和推送到 `main` 时，用 Node 22 运行这五条命令，在此之前先运行 `pnpm verify:e2e-selectors`。

`pnpm lint` 覆盖 `apps/web`（`next lint`，配置在 `apps/web/.eslintrc.json`）以及 `packages/` 下的每个包（使用仓库根目录的共享 flat 配置 `eslint.config.mjs` 运行 ESLint）。与 `apps/web` 不同，各包不禁止 `.toFixed(2)`，因为该规则指向的是 Web 的 Money 模块。

CI 还会运行 `node scripts/format-check-changed.mjs <base>`（即 `pnpm format:check-changed`），只检查相对拉取请求基线（推送时为上一个提交）发生变化的文件的 Prettier 格式。仓库中仍有从未格式化的文件，所以请只对你修改的文件运行 Prettier（`npx prettier --write <file>`），不要对目录运行，也不要使用 `pnpm format`。`pnpm install` 会让 Git 使用 `.githooks/`（通过 `scripts/install-git-hooks.mjs` 设置 `core.hooksPath`），其中的 `pre-push` 钩子以 `origin/main` 为基线运行同一检查，有未格式化文件时拒绝推送。`git push --no-verify` 可以跳过一次。在 CI 中或不在 Git 仓库里时安装脚本什么也不做；如果已为其他工具设置了钩子路径，它也不会覆盖。

在拉取请求上，`protected-files` 任务会运行 `node scripts/verify-protected-files.mjs`、`node scripts/verify-docs.mjs`、配对检查，以及 `node scripts/verify-branch-name.mjs <head-branch>`。分支名检查会在源分支不以 `feature/`、`fix/`、`refactor/`、`docs/`、`chore/` 或 `test/` 开头，或包含 AI 工具名时失败；Dependabot 分支不受限制。

使用 `pnpm --filter @trip/agents test`、`pnpm --filter @trip/orchestrator test` 或 `pnpm --filter @trip/web test` 针对特定包运行测试。Web 测试脚本使用 POSIX shell 语法设置 `NODE_OPTIONS`；Windows 上应从 WSL 或 Git Bash 运行。

如果在 `pnpm dev` 运行时执行 `pnpm build`，启动开发服务器时应设置 `NEXT_DIST_DIR=.next-dev`，避免二者共用 `.next` 输出目录。

免费地图端点可通过 `PHOTON_BASE_URL`（默认 `https://photon.komoot.io`）、`NOMINATIM_BASE_URL`（默认 `https://nominatim.openstreetmap.org`）和 `TRANSITOUS_BASE_URL`（默认 `https://api.transitous.org`）配置。将 `OSM_USER_AGENT` 设为真实项目联系方式。公共服务限制和部署边界见[架构说明](architecture.zh.md#free-services-limits-and-terms)。

通过 `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS=unavailable pnpm --filter @trip/web e2e map-fallback` 重跑回退界面检查。本地测试时清空模型、Maps 和 Clerk 密钥变量。截图和摘要位于 `output/playwright/map-fallback/after`。`map-provider-http` 使用本地上游测试真实 API 处理器：将 `MAP_STUB_PORT` 设为空闲端口，将上述三个基础 URL 设为 `http://127.0.0.1:$MAP_STUB_PORT`，并设 `WEB_MAPS_PROVIDER=osm`；限流时间戳、缓存命中、语言、范围和公交解析记录在 `output/e2e/map-provider-http/summary.json`。

`RUN_LIVE_MAP_CHECK=1 WEB_MAPS_PROVIDER=osm CHANNEL=chrome USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e map-fallback-live` 显式启用真实免费服务检查。只有聊天回复使用固定数据；地点查询、瓦片和步行路线均为实时请求。结果及桌面／手机截图位于 `output/playwright/map-fallback-live/after`。这不代表公共交通覆盖所有目的地。

<a id="cli-acceptance-in-ci"></a>

#### CI 中的 CLI 验收

仅使用 Node 内置模块的 `cli-acceptance-plan` 任务检出完整 Git 历史，从显式 PR base/head SHA 的 merge base 比较到 PR head。选择范围包含 PR 的全部提交、新增、删除，以及重命名两端的路径。事件 SHA 通过环境变量进入固定命令。JSON 计划记录变更路径、匹配规则、发现的脚本清单、选中脚本和分片分配；worker 通过 artifact 接收同一份计划。

- 只有每条变更路径都符合规则且脚本清单已审核时，普通文档才可跳过 CLI 验收。技能和仓库指令不属于通用文档豁免。已审核的基础设施脚本清单包括 `ci-integration.e2e.mjs`。
- 已审核的依赖规则选取对应脚本的并集。共享基础设施、未知路径、未分类的验收脚本或缺失的预期脚本都要求完整覆盖。历史缺失、无效 revision 和比较失败也会退回完整覆盖，并记录原因。
- 空清单或不安全清单属于规划失败。每次推送到 `main` 都在该次检出的提交上选择当前完整清单，包括合并后的交付内容。

`cli-acceptance-workers` 只在计划成功且不是 skip 时启动。动态矩阵包含一至三个非空分片，每个分片使用独立 runner，具有自己的检出目录、依赖树和浏览器配置。分片内部保持串行，因为 fixture 会临时替换依赖入口。一个分片失败不会取消其他分片。每个选中脚本恰好分配一次；耗时估计只影响分配，不承诺 CI 总时长。

稳定的 `cli-acceptance` 汇总任务始终运行。它验证计划，并要求满足以下一种情况：显式 skip、worker 全部跳过且没有 worker 回执；或 worker 成功，且每个计划分片恰有一份成功回执，并通过摘要绑定到传输的计划。规划失败、缺失计划或回执、worker 失败或取消，以及格式错误的计划都不能通过。真实的文档跳过避免安装依赖和浏览器；现有文档和受保护文件检查仍运行。计划、worker 结果和证据 artifact 的名称包含运行 ID、重试次数，以及 planner／分片标识，保留七天。上传前，`node apps/web/tests/cli-e2e/package-evidence.mjs` 只将 `output/e2e/` 和 `output/playwright/` 归档到 `output/cli-evidence/evidence.tar.gz`，包括部分失败证据和隐藏的 fixture 文件。内部文件名和字节保持原样；安全的外层文件名避开 artifact 服务的文件名限制。嵌套符号链接会保留，不跟随其目标。任一证据树存在即可归档；两者都缺失则明确失败，只有成功完成后才发布归档。归档或上传失败仍会使 worker 和汇总任务失败；旧归档或部分归档不能替代当前尝试。下载后使用 `tar -xzf evidence.tar.gz` 提取证据。

复现选择时，在环境变量中提供 PR 的显式 base/head SHA。可根据计划运行一个分片，或使用保持兼容的无参数命令运行完整本地套件：

```bash
node apps/web/tests/cli-e2e/select.mjs --event pull_request --base "$BASE_SHA" --head "$HEAD_SHA" --output output/e2e/cli-plan/plan.json
node apps/web/tests/cli-e2e/run.mjs --plan output/e2e/cli-plan/plan.json --shard 1
node apps/web/tests/cli-e2e/run.mjs
```

使用 `--event push` 复现 main 的完整选择。skip 计划由 CI 处理，worker 命令拒绝执行。分片摘要保留计划、复现命令、逐脚本日志，以及通过、失败、中断或未运行的结果。定向子进程验收使用 `node apps/web/tests/cli-e2e/ci-integration.e2e.mjs`；复制的 fixture 和命令／结果 JSON 保留在 `output/e2e/ci-integration-*/` 下。这证明本地命令行为，不证明 GitHub 调度已执行。

相关 ticket 默认使用一个集成分支和 PR。若依赖交付使用独立 PR，必须在合并前验证它们的组合集成状态；各自通过选择的检查并不能证明组合状态。完整 main 结果是绑定到准确 main SHA 的合并后回归证据，不能承诺合并前执行全部检查，也不能复用旧 SHA 的结果。[CI 选择决策](../.agents/notes/implemented/process/2026-10-12-cli-acceptance-ci.md)记录调度理由和保留的串行执行边界。

<a id="workspace-performance-acceptance"></a>

#### 工作区性能验收

```bash
node apps/web/tests/e2e/run-performance.mjs
```

这条本地命令复用 CLI 的 fixture 环境，由旧运行器独占 production 构建、服务器和临时 TypeScript 配置。它清空已知集成凭证，强制使用 mock 工具，禁用 Agent Lab 实时运行，并提供合成的浏览器 Maps key `map-animation-fixture`。CLI 验收会临时修改依赖入口，请与它分开执行。

工作区 journey 测量桌面上的 10 条、200 条消息，以及手机上的 200 条消息。它检查一次稳定输入保存只写一次 catalog，并覆盖刷新、存储配额错误重试、切换前 flush、重命名、布局保存、已规划行程的快照镜像和旧标签页存储保护。第二个标签页直接写入 revision 协议，不覆盖计划编辑 API。地图 journey 用 Google 兼容 SDK stub 控制可见性与动画 frame，并使用真实 MapLibre 的空白样式。它覆盖隐藏面板、后台页面、减少动态效果、视角与选择保留及卸载，不调用 Google，也不验证实时地图服务。

每次命令分配新 label。日志和总摘要位于 `output/e2e/performance-acceptance/<label>/`；截图、工作区 trace、CPU profile 和 JSON 位于 `output/playwright/{workspace-performance,map-animation-lifecycle}/<label>/`。MessageItem 计数是输入与保存或合成 stream 测量窗口内的 V8 函数调用次数，不是 React commit 或 DOM 变化次数。耗时包含防抖和 profile 开销；这些 fixture 不能证明真实用户 Core Web Vitals 或速度提升。比较其他版本时，先单独构建该版本，再用 `BASE_URL=<owned-server> LABEL=before-<unique-label>` 运行工作区脚本；`before-` label 记录基线写入次数，不要求满足优化后的次数。保留失败尝试。

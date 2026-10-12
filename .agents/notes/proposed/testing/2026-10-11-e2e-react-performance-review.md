# Agent Note: E2E reliability and React performance review

Status: proposed

## Problem

2026-10-11 对当前工作区的静态审查使用项目的 Playwright 与 Vercel React 技能。
本记录保留初次审查基线和后续候选。用户已批准第一批 T1–T3、R1–R2、R3 测量，
以及 `.github/workflows/ci.yml` 的串行 CLI 验收；后续性能重构仍待选择。

### 初次审查基线与证据边界

- 实际安装：Next.js 15.5.25、React / React DOM 19.2.8、Playwright 1.56.1。
  当前使用 Playwright library 与项目 CLI，未安装 `@playwright/test`。
- 浏览器目录有 43 个 `.e2e.mjs` 文件；CLI 验收目录有 5 个 `.e2e.mjs`，另有
  `report-cli.mjs`。应用与包合计有 83 个 `.test.ts` 和 18 个 `.test.tsx`。
  这些是文件数量，不是测试用例数，也不表示它们均已通过。
- `node apps/web/tests/e2e/run.mjs list --json`：隔离 CLI 支持 2 个 Agent Lab journey，
  其余 41 个明确列为不支持。它们仍可属于旧 runner；不能据此说它们都失败了。
- `node apps/web/tests/e2e/run.mjs doctor --json`：退出 1，`outcome: blocked`。
  Playwright Chromium 缺失或不可访问；诊断没有读取环境文件内容。
- 初次静态审查时没有运行测试套件、构建、真实 provider 或性能采样；表中的成本来自代码推断。
  批准后的执行结果见下文，不能将初次 doctor 状态当作当前状态。

### 测试工具发现

| 编号          | 发现与触发条件                                                                                            | 代码证据                                                                                                   | 建议                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T1 / P2       | 旧 runner 超时后安排的 SIGKILL 读取可变 `current`，原测试子进程退出并开始下一条后，旧定时器可能杀死新测试 | [legacy-runner](../../../../apps/web/tests/e2e/legacy-runner.mjs)，174–196 行，尤其 189 行                 | 捕获原测试子进程身份，并在退出时取消升级终止定时器                                            |
| T2 / P2       | 两个旧 runner 同时读空锁，都能写入并占用同一 `.next-e2e` 构建目录                                         | [legacy-runner](../../../../apps/web/tests/e2e/legacy-runner.mjs)，100–108 行                              | 原子占锁并验证过期锁恢复，或复用每次调用独占目录的方式                                        |
| T3 / P2       | 保存完整的中断结果且证据非空时，报告只排除 `running` / `incomplete`，可能把中断的覆盖标为 `complete`      | [report-cli](../../../../apps/web/tests/e2e/report-cli.mjs)，131–141、180–188 行                           | 显式把中断覆盖归为 incomplete；保留原始 outcome。此问题没有把 interrupted outcome 改成 passed |
| T4 / 覆盖缺口 | CI 运行 Vitest 与 `scripts/*.test.mjs`，没有执行 CLI 验收或浏览器 journey；runner 回归可能不影响 CI 结果  | [CI](../../../../.github/workflows/ci.yml)，31–37 行；[Vitest 配置](../../../../apps/web/vitest.config.ts) | 单独评估一个串行 CLI 验收任务及产物留存；浏览器 smoke 另列执行成本                            |

T3 与 [当前报告契约](../../../../docs/local-test-cli.md#inspect-a-saved-invocation) 中
“interrupted attempts 标为 incomplete”不一致。T4 是已明确记录的现状，不是违规配置。

43 个浏览器文件中，静态统计到 22 个文件含 41 处 `waitForTimeout`，11 个文件含
17 处 `networkidle`，未发现直接的 `.tracing.` 调用。这只是后续逐项审查的线索：
观察“某段时间内不应发生事件”的等待可能合理，不应机械删除。
已有截图、JSON、console error 等证据；trace 可补充失败时的操作、DOM 和网络上下文。
Playwright library 的 [BrowserContext tracing](https://playwright.dev/docs/api/class-tracing)
可用于当前 harness，但不记录测试断言，不等价于 Playwright Test 的完整 trace。

现有隔离 CLI 已有凭证隔离、独占 server/build 资源、失败与超时传播、重复执行保留早期失败等优点。
缺 key 时旧 runner 的跳过语义、report 成功读取失败记录时退出 0，均不应误报为缺陷。

### React / Next.js 发现

| 编号            | 触发与代码路径                                                                                               | 改进方向                                                                                                                                                                                                                                                                                                                                                                          | 后续测量                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R1 / 优先       | 自动保存先写 catalog 再 `setCatalog`，后一个 effect 再写同一 catalog；每次 serialize 还会全量 parse          | [useWorkspaceStorage](../../../../apps/web/components/workspace/useWorkspaceStorage.ts)，85–87、103–113 行；[serializeCatalog](../../../../apps/web/lib/workspace/catalog.ts)，286–287 行。统一持久化所有者，保留同步 flush、快照镜像和错误处理                                                                                                                                   | 一次稳定保存的 catalog 写入次数；随历史长度变化的序列化与写入耗时          |
| R2 / 优先       | 手机切到 Chat / Trip / Mine 后地图仍挂载；路线动画持续请求 frame，OSM 的 setOptions 为空实现                 | [WorkspaceView](../../../../apps/web/components/workspace/WorkspaceView.tsx)，168–175、502 行；[map-layers](../../../../apps/web/components/map/map-layers.ts)，161–170 行；[startFlow](../../../../apps/web/lib/map/itinerary-route.ts)，65–74 行；[LibreLine](../../../../apps/web/components/map/maplibre-renderer.ts)，210 行。隐藏时暂停，没有动画能力的 renderer 不启动循环 | Map 显示与隐藏时的 frame 回调、线更新次数与空闲 CPU；分别检查 Google / OSM |
| R3 / 测量后优先 | 输入与 stream progress 更新顶层 session，ChatPanel 再遍历历史 MessageItem，进入 Markdown / Thinking 渲染路径 | [session](../../../../apps/web/lib/workspace/session.ts)，178 行起；[ChatPanel](../../../../apps/web/components/chat/ChatPanel.tsx)，119–121 行；[MessageItem](../../../../apps/web/components/chat/MessageItem.tsx)。利用稳定历史消息 identity 建立局部渲染边界，或隔离 transcript 与 composer                                                                                   | 短/长对话下，输入与流事件期间历史消息的 React commit、render 次数与耗时    |
| R4 / 第二批     | 每次 activity 数组追加都会重新生成 counts、groups、summary，折叠 Think 时也计算详细分组                      | [ThinkingProcess](../../../../apps/web/components/chat/ThinkingProcess.tsx)，55–61 行；[thinking-model](../../../../apps/web/components/chat/thinking-model.ts)，490、528 行起。先考虑展开时才生成详细模型，再评估增量模型                                                                                                                                                        | 不同事件长度、折叠/展开状态下模型计算时间，区分事件数与 React commit 数    |
| R5 / 第二批     | 只改 stop note 也克隆 plan，导致 itinerary / mapped 更新，marker effect 清理并重建所有 marker                | [item-actions](../../../../apps/web/lib/trip/item-actions.ts)，34 行；[useTripPlaces](../../../../apps/web/components/map/useTripPlaces.ts)，242 行；[TripMap](../../../../apps/web/components/map/TripMap.tsx)，295–331 行。按地点身份与可见字段协调更新，保持几何输入不变时的路线                                                                                               | 一次备注编辑前后的 marker / overlay 创建删除次数，选择和焦点行为           |

R1、R2 的重复工作有明确路径；未测量用户设备上的实际收益。
R3–R5 的排序要由 profile 决定，不能把静态推断写成已验证瓶颈。

已有优化应保留：TripMap 用 `next/dynamic`，MapLibre 按需 import，日历动态加载，
账号同步 GET 与导出查询已 `Promise.all`。没有发现足以支持大规模 RSC 重写的证据。
账号同步 POST 的两个表写入目前顺序执行，是可测量候选；先确认写入顺序与失败语义再并行。
设置面板等懒加载候选应先测初始 chunk，不能凭依赖名断言包体积收益。

## Proposal

批准的第一批修 T1–T3，补对应失败场景；处理 R1、R2；测量 R3 再决定改法。
使用现有 CLI，保留测试断言与隔离边界。T4 已获受保护的 `.github` 文件修改授权。
后续逐条把核心 workspace journey 接入隔离执行，准确保留 unsupported 原因；不承诺一次接入 41 条。

性能证据用固定 fixture、相同浏览器与 production build，保存输入规模、重现命令、trace / profile、
计数和原始数据。先写可能失败的方式，再实现与验收，不在实现之后补写 unit tests。
本轮没有确定绝对耗时门槛；先得到基线，再讨论适合本项目的性能预算。

上游性能参考包含旧 FID、`networkidle` 与“指标存在才断言”的示例，不能直接复制成验收。
当前 Core Web Vitals 是 LCP、INP、CLS；缺测量应明确标为缺失，不能自动通过。
一次本地 browser 采样不代表真实用户 p75 达标；见 [Google Web Vitals](https://web.dev/articles/vitals)。
条件等待与 locator 原则参照 [Playwright 官方指南](https://playwright.dev/docs/best-practices)，
局部 memo 先检查 props/context 与实际耗时，参照 [React memo](https://react.dev/reference/react/memo)。

## Alternatives considered

- 立即迁移 `@playwright/test`：待讨论。它可提供 fixtures、reporters 与断言支持，但迁移必须保留
  当前 CLI 的凭证隔离、资源所有权与证据契约；不是修复 T1–T3 的必要前提。
- 全面加 memo / cache / dynamic import：不推荐作为本轮方案；每项应有对应成本与验证方法。
- 第一批同时加入 CI：用户已采用；独立 job 安装 Chromium 与 lsof，串行运行 CLI 验收及其 fixture browser journey。

## Acceptance criteria

第一批实施前，失败清单至少覆盖：

1. 前一条超时但很快退出，下一条运行超过旧升级定时器期限；下一条不被误杀。
2. 同时启动两个旧 runner，以及占锁进程死亡后的恢复；不共享活跃构建目录或释放别人的锁。
3. 已落盘的 interrupted child + 非空证据 + 后续 passed attempt；覆盖仍 incomplete，保留所有 outcome。
4. 自动保存、主动 flush、切换会话、storage quota、旧 tab revision；数据与错误提示保持正确。
5. 手机隐藏/返回地图、Google / OSM、reduced motion、后台页面、卸载；动画停止与恢复可验证。
6. 本批测量长对话输入与 stream；如果后续改变渲染边界，再验证语言切换、消息揭示动画和时间显示。
7. 每个已执行场景保留重现命令、实际状态、失败尝试和证据路径。

## Risks

- 持久化所有权调整可能影响 flush 和多 tab 保护，不能只删除一个 effect。
- 地图隐藏时直接卸载可能丢失视角与选择，暂停动画应保留用户状态。
- memo 边界可能遗漏语言、动画或时间相关更新；不能只按文本比较。
- 追踪与 profile 本身有开销，计数与耗时采样应区分。
- 此记录补充现有设计；不替换 [隔离执行决策](../../implemented/testing/2026-10-10-local-test-cli.md)、
  [E2E-first 决策](../../implemented/testing/2026-09-25-e2e-first-testing.md) 或
  [技能接入决策](../../implemented/process/2026-10-11-framework-reference-skills.md)。

## Approved tranche and measured follow-up

- T1–T3 已落实到旧 runner 与报告；构建目录改为每次独占，不再依赖固定槽位锁。
- R1 的稳定输入保存，桌面 10 / 200 条和手机 200 条消息均从两次 catalog 写入降为一次。
  已规划快照仍分别写镜像与 catalog；flush、quota retry、catalog-only 和旧 tab 保护有浏览器证据。
- R2 在隐藏面板、后台页面与 reduced motion 下暂停；Google 兼容 stub 保留视角、选择与图层；
  实际 MapLibre 空白样式不启动无效 dash 循环。这不表示真实 Google 服务已验证。
- R3 暂未修改：基线和修改后，输入/保存窗口的 MessageItem V8 函数调用为
  30（桌面 10 条）、600（桌面 200 条）、600（手机 200 条）；合成 stream 为 44 / 804 / 804。
  这些不是 React commit 或 DOM 更新计数；耗时含 debounce 和 profiler 开销，不宣称速度收益。
- 可重复运行 `node apps/web/tests/e2e/run-performance.mjs`，命令与边界见
  [development](../../../../docs/development.md#workspace-performance-acceptance)。
- CI 配置已加入串行 CLI 验收与失败产物留存；GitHub 上的任务尚未运行。
- Chromium 已安装；本地 doctor 当前返回 `ready`，不再是初次审查时的浏览器缺失状态。
- R3 渲染优化、R4 Think 分组、R5 marker 协调和其余 raw journey 接入继续保留为后续候选。
  第一批实施决策见 [reliability and performance acceptance](../../implemented/testing/2026-10-11-e2e-performance-acceptance.md)。

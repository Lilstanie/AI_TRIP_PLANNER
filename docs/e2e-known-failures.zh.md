<a id="e2e-scripts-that-fail-on-main"></a>

# 在 main 上失败的 E2E 脚本

[English](e2e-known-failures.md) | 中文

这里列出的原始浏览器脚本不在 CI 中运行；独立的 CLI 验收任务覆盖其注册的 fixture 旅程，因此原始脚本仍可能在 `main` 上失败一段时间才被发现。判断一个失败的脚本是不是你引入的回归之前，先看这份清单；发现某个脚本在 `main` 上失败，或修好了一个，请更新它。每一项都写明最后检查的日期和失败的内容。

| 脚本           | 在 `main` 上检查 | 失败内容                                                                                                               | Issue |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| `thinking-orb` | 2026-10-09       | 1440 浅色下 "running subagents show orbs (0)"：没有出现 `.thinking-row__leading canvas.thinking-orb`，随后的等待超时。 | 暂无  |

以下失败也在未修改的基线 `42fded7` 上复现（2026-10-10）：使用生产服务器，设置 `DATA_MODE=mock`、`USE_MOCK_TOOLS=true`，并清空 `MOCK_GOOGLE_MAPS`、模型和 Clerk 变量：

| 脚本       | 失败内容                                                                                                                                                          | Issue |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `timeline` | fare-decimals 控制台检查记录四个 fixture 地点详情的 404 响应。fixture 使用占位地点 ID，但未模拟其详情；JPY/AUD/KRW 票价和路线检查全部通过（总计 99/100 项通过）。 | 暂无  |

以下脚本也在未修改的 `main` `c8ebd9b`（2026-10-27）上失败：在干净的 worktree 中以
`pnpm --filter @trip/web e2e <script> --prod` 运行，不设置额外环境变量。它们在 Mindtrip 行程分支上的失败方式相同，
因此不是行程相关工单造成的。多数脚本是为已被更平静的工作区（#740）取代的行程抽屉编写的。

| 脚本                 | 失败内容                                                                        | Issue |
| -------------------- | ------------------------------------------------------------------------------- | ----- |
| `timeline`           | 第一项检查后，截图一直等待不再渲染的 `.workspace-drawer--trip`。                | 暂无  |
| `auto-save-places`   | 通过 35 项检查后，“the priced stop raises the estimate” 失败：估算仍为空。      | 暂无  |
| `drawer-walkthrough` | 规划后等待 `.workspace-drawer--trip .trip-editor`，随后超时。                   | 暂无  |
| `itinerary`          | “Day 1 timeline is shown” 失败，且在 `.workspace-drawer--trip` 下找不到站点行。 | 暂无  |
| `settle-path`        | “the trip has an estimated total” 读到 0，其后所有总额检查都失败。              | 暂无  |
| `check-entry-point`  | 通过 28 项检查后等待文本框 “Message AI Trip Planner”，随后超时。                | 暂无  |
| `notice-keys`        | 规划后等待 `.workspace-drawer--trip .trip-editor`，随后超时。                   | 暂无  |
| `narrow-time-editor` | 在 1001 px 等待按钮 “Close your trip”，随后超时。                               | 暂无  |

以下脚本在安静行程面板工作的未修改基线（2026-10-28）上失败，由各工单实现者在干净 worktree 中以 `pnpm --filter @trip/web e2e <script> --prod` 运行发现。它们不是安静面板工单造成的；各自的原因尚未调查。

| 脚本                            | 检查日期   |
| ------------------------------- | ---------- |
| `reply-cost-line`               | 2026-10-28 |
| `open-in-maps`                  | 2026-10-28 |
| `workspace-performance`         | 2026-10-28 |
| `trajectory-timeline`           | 2026-10-28 |
| `cross-day-drag`                | 2026-10-28 |
| `itinerary-walkthrough`         | 2026-10-28 |
| `trip-workspace-layout`         | 2026-10-28 |
| `stop-menu`                     | 2026-10-28 |
| `drag-in-day`                   | 2026-10-28 |

`phone-state` 的重新加载现在能恢复 Map：脚本在恢复循环前重新加载一次，因为陈旧编辑段落会让布局持久化暂停直到重新加载。这一暂停是产品缺口，记录在 `apps/web/tests/e2e/phone-state.failures.md`。

<a id="covered-regressions"></a>

## 已有回归覆盖

- `main` `8e168ba` 上的 `triage-accessibility`（2026-10-22）等待
  `getByText("No matching chats.", { exact: true })`，它同时匹配 sr-only 的聊天搜索状态和可见的 `.history-empty` 行，
  因此在 1280 宽度下 strict 模式抛错，Who、预算和地图检查都没有运行。现在的等待按类名限定可见行；
  `DATA_MODE=mock pnpm --filter @trip/web e2e triage-accessibility` 的所有检查均通过。

- 基线 `2e0f506b` 上的 `phone-map`（2026-10-19，#367）在默认无 key 地图已成功加载 OSM 时，
  仍查找仅在渲染器出错时显示的地点列表，导致 390px 的三个重复地点检查失败，并在桌面步骤超时，未运行到 360px。
  旅程现等待地图中具名的地点控件及其选中站点、详情，保留两种提供方的覆盖。
  清空模型、Maps 和 Clerk 密钥后运行
  `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e phone-map`，
  再设置 `WEB_MAPS_PROVIDER=google` 重跑无 key 错误列表场景；两种模式分别明确检查默认 OSM
  画布已就绪，以及 Google-only 错误列表。
  每次覆盖 390×844、360×800 及桌面切换；通过 `LABEL=<attempt>` 将各次结果分别保存在
  `output/playwright/phone-map/<attempt>/`。

- `trip-initial-scroll` 覆盖 #375：基线 `2e0f506` 的桌面 Trip 首次打开时 scrollTop 为 163，预算被遮住。日期条现只横向滚动。浏览器检查覆盖桌面与手机端首次打开、重开、保存对话重载、主动滚动位置恢复及日期键盘导航。

- PR #308 的 head `501af35` 上，`agent-lab-replay` 可能在键盘按 Enter 后错过文件选择框（2026-10-11）：
  按键事件先执行完，Chromium 随后才确认文件选择框拦截已开启。旅程通过 Replay 按钮的 locator
  保留键盘激活，并对这个边界施加 16 倍 CPU 限速，完成后恢复正常速度。重现命令为
  `pnpm --filter @trip/web e2e run agent-lab-replay --dev`；原来的全局键盘调用即使等待 30 秒也会失败。
  这是测试驱动的竞态，不是 replay API 故障。

- `liquid-glass` 和 `glass-calibration` 曾等待渐进式空工作区不再显示的语言按钮和 When 芯片（2026-10-27，#731）。两个脚本现在先规划行程，在 1440x1000 和 390x844、浅色和深色下运行，并通过
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e liquid-glass --prod`
  以及对 `glass-calibration` 的同样命令。

- `team-panel-desktop`、`team-thinking` 和 `trajectory-demo` 在 `main` 上就已失败（2026-10-27，#734），与玻璃和待处理项票据无关。渐进式空工作区把团队控件移到顶栏左侧分组，因此“按钮在 Trip 左侧”无从检查；弹出层名为“专家团队”而非 Agent Team；规划期间按钮的无障碍名称带有“, N working”，精确名称定位器因此超时；点击信息流左上角会落在已固定的面板上；轨迹 Tab 的选中状态和筛选标签在点击后晚一帧才出现；手机上名册位于模态框内折叠的区域，模态框关闭后仍留在 DOM 中。脚本现已改用当前的前提，并通过
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e <script> --prod`。

- `trajectory-tab` 的“轨迹 Tab 上到达的回复在返回对话时可见”在 `main` `629cf2a` 上就已失败（2026-10-27，#740）：Tab 按钮移到了工作区顶栏，顶栏直接设置聊天视图，聊天面板因此从未记录信息流的滚动位置，新回复留在可视区域之下（1440 下差 365 px）。面板现在无论由谁切换视图，都会自行记录信息流的滚动位置和上次显示的消息。
  `phone-map-empty-hint` 已按 #737 的决定检查 1440 下空地图区域隐藏；六次运行中失败一次，原因是 `locator.evaluate` 读取的节点已被水合替换（返回空字符串），现改为读取当前节点。`sidebar-entries` 属于侧栏相关票据，在集成分支上通过；两者均无需条目。

- `activities-not-costed`、`trip-ui-triage`、`budget-source-replacement`、`trip-display-currency`、
  `display-currency`、`workspace-control-overflow`、`workspace-chinese`、`stop-progress` 和 `settings`
  在未修改的 `main`（2026-10-28）上就已失败，因为它们操作的控件已被更平静的工作区（#740）、渐进显示的空工作区
  和行程主页（#765）移动或移除。它们现在按当前前提运行：界面语言在设置中切换（`setPhoneLanguage`、
  `setDesktopLanguage`）；桌面上行程视图会盖住对话，脚本在输入前切回“对话”标签或收起行程开关（`aria-expanded`）；
  打开行程会进入行程主页，因此走 `openTripWorkspace`；空白行程没有预算芯片，预算改在第一条消息里说明，
  空白行程的币种从存储的目录读取；站点通过点击其行打开，而不是“编辑详情”；手机把换算金额提示显示在工作区提示区，
  而不是行程面板；中文消息得到中文回复，预算回复检查因此接受中文；未定价文案为 “unpriced costs not counted”。
  分别用 `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e <script> --prod` 运行。

<a id="not-failures"></a>

## 不算失败

- `installable-app` 在 `next dev` 下会一直等待，因为 service worker 只在生产构建中注册。请按脚本头部的说明运行 `pnpm --filter @trip/web e2e installable-app --prod`，安装完整 Chromium 后，22 项检查全部通过（2026-10-14）。

<a id="how-to-check"></a>

## 如何检查

```bash
git worktree add ../main-check origin/main && cd ../main-check && pnpm install
DATA_MODE=mock pnpm --filter @trip/web e2e <script>
```

运行器会停止超过 `E2E_SCRIPT_TIMEOUT_MS` 仍在运行的脚本，并报告为 `TIME`；见 [development.md](development.zh.md#testing-approach)。

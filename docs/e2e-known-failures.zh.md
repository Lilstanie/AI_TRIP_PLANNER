<a id="e2e-scripts-that-fail-on-main"></a>

# 在 main 上失败的 E2E 脚本

[English](e2e-known-failures.md) | 中文

这里列出的原始浏览器脚本不在 CI 中运行；独立的 CLI 验收任务覆盖其注册的 fixture 旅程，因此原始脚本仍可能在 `main` 上失败一段时间才被发现。判断一个失败的脚本是不是你引入的回归之前，先看这份清单；发现某个脚本在 `main` 上失败，或修好了一个，请更新它。每一项都写明最后检查的日期和失败的内容。

TP-165（2026-10-30）删除了 136 个原始脚本：它们在 `main` 上本就失败、只守护一次旧修复，或与保留的旅程重复；对应的失败清单和不再使用的 fixture 一并删除。它们的旧条目已从本页移除；只有在说明需要它的理由后，才从 Git 历史恢复脚本。

issue 线程在 `main` `fb21e61`（2026-10-30）上用 `pnpm --filter @trip/web e2e <script> --prod`、不加额外环境变量重跑了下面两个脚本。PR #782 会修改这两个脚本。

| 脚本                    | 失败内容                                                                    | Issue |
| ----------------------- | --------------------------------------------------------------------------- | ----- |
| `workspace-performance` | `runPlannedStorage` 在 `page.waitForFunction` 处超时，尚未记录任何耗时。    | #781  |
| `trip-workspace-layout` | 脚本启动 `chrome` channel，需要安装 Google Chrome；没有安装时启动立即失败。 | #781  |

`trajectory-tab` 在 `main` `ec70e0d` 上也会失败（2026-10-30，TP-167），命令为
`pnpm --filter @trip/web e2e trajectory-tab`：`en-1440` 通过 59 项检查后，刷新步骤从“聊天”重新打开
“Tokyo from Sydney”，在 `page.waitForFunction` 处等待三条 `.msg-item--agent` 消息时超时。

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

- PR #308 的 head `501af35` 上，`agent-lab-replay` 可能在键盘按 Enter 后错过文件选择框（2026-10-11）：
  按键事件先执行完，Chromium 随后才确认文件选择框拦截已开启。旅程通过 Replay 按钮的 locator
  保留键盘激活，并对这个边界施加 16 倍 CPU 限速，完成后恢复正常速度。重现命令为
  `pnpm --filter @trip/web e2e run agent-lab-replay --dev`；原来的全局键盘调用即使等待 30 秒也会失败。
  这是测试驱动的竞态，不是 replay API 故障。

- `liquid-glass` 曾等待渐进式空工作区不再显示的语言按钮和 When 芯片（2026-10-27，#731）。脚本现在先规划行程，在 1440x1000 和 390x844、浅色和深色下运行，并通过
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e liquid-glass --prod`。

- `trajectory-demo` 在 `main` 上就已失败（2026-10-27，#734）：弹出层名为“专家团队”而非 Agent Team，规划期间按钮的无障碍名称带有“, N working”。脚本现已改用这些前提，并通过
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e trajectory-demo --prod`。

- `trajectory-tab` 的“轨迹 Tab 上到达的回复在返回对话时可见”在 `main` `629cf2a` 上就已失败（2026-10-27，#740）：Tab 按钮移到了工作区顶栏，顶栏直接设置聊天视图，聊天面板因此从未记录信息流的滚动位置，新回复留在可视区域之下（1440 下差 365 px）。面板现在无论由谁切换视图，都会自行记录信息流的滚动位置和上次显示的消息。

- `trip-display-currency` 和 `settings` 在未修改的 `main`（2026-10-28）上就已失败，因为它们操作的控件已被更平静的工作区（#740）、渐进显示的空工作区和行程主页（#765）移动或移除。它们现在在设置中切换界面语言（`setPhoneLanguage`、`setDesktopLanguage`），经 `openTripWorkspace` 打开行程，在第一条消息里说明预算，并从存储的目录读取空白行程的币种。分别用 `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e <script> --prod` 运行。

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

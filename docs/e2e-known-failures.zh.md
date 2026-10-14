# 在 main 上失败的 E2E 脚本

[English](e2e-known-failures.md) | 中文

这里列出的原始浏览器脚本不在 CI 中运行；独立的 CLI 验收任务覆盖其注册的 fixture 旅程，因此原始脚本仍可能在 `main` 上失败一段时间才被发现。判断一个失败的脚本是不是你引入的回归之前，先看这份清单；发现某个脚本在 `main` 上失败，或修好了一个，请更新它。每一项都写明最后检查的日期和失败的内容。

| 脚本           | 在 `main` 上检查 | 失败内容                                                                                                                                    | Issue |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `liquid-glass` | 2026-10-09       | 手机宽度下点击 Chat 标签超时：开发服务器出错后，Next.js 的开发浮层（`nextjs-portal`）挡住了它。用 `--prod` 运行可以区分真实失败和浮层问题。 | 暂无  |
| `thinking-orb` | 2026-10-09       | 1440 浅色下 "running subagents show orbs (0)"：没有出现 `.thinking-row__leading canvas.thinking-orb`，随后的等待超时。                      | 暂无  |

以下失败也在未修改的基线 `42fded7` 上复现（2026-10-10）：使用生产服务器，设置 `DATA_MODE=mock`、`USE_MOCK_TOOLS=true`，并清空 `MOCK_GOOGLE_MAPS`、模型和 Clerk 变量：

| 脚本          | 失败内容                                                                                                                                                          | Issue |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `timeline`    | fare-decimals 控制台检查记录四个 fixture 地点详情的 404 响应。fixture 使用占位地点 ID，但未模拟其详情；JPY/AUD/KRW 票价和路线检查全部通过（总计 99/100 项通过）。 | 暂无  |
| `phone-state` | 在 390×844 和 360×800 下，重新加载未恢复 Map。Trip、Mine 和 Chat 的重新加载检查通过。                                                                             | 暂无  |

## 已有回归覆盖

- PR #308 的 head `501af35` 上，`agent-lab-replay` 可能在键盘按 Enter 后错过文件选择框（2026-10-11）：
  按键事件先执行完，Chromium 随后才确认文件选择框拦截已开启。旅程通过 Replay 按钮的 locator
  保留键盘激活，并对这个边界施加 16 倍 CPU 限速，完成后恢复正常速度。重现命令为
  `pnpm --filter @trip/web e2e run agent-lab-replay --dev`；原来的全局键盘调用即使等待 30 秒也会失败。
  这是测试驱动的竞态，不是 replay API 故障。

## 不算失败

- `installable-app` 在 `next dev` 下会一直等待，因为 service worker 只在生产构建中注册。请按脚本头部的说明运行 `pnpm --filter @trip/web e2e installable-app --prod`，安装完整 Chromium 后，22 项检查全部通过（2026-10-14）。

## 如何检查

```bash
git worktree add ../main-check origin/main && cd ../main-check && pnpm install
DATA_MODE=mock pnpm --filter @trip/web e2e <script>
```

运行器会停止超过 `E2E_SCRIPT_TIMEOUT_MS` 仍在运行的脚本，并报告为 `TIME`；见 [development.md](development.zh.md#testing-approach)。

# 在 main 上失败的 E2E 脚本

[English](e2e-known-failures.md) | 中文

CI 不运行 E2E 脚本，所以某个脚本可能在 `main` 上失败了一段时间都没人发现。判断一个失败的脚本是不是你引入的回归之前，先看这份清单；发现某个脚本在 `main` 上失败，或修好了一个，请更新它。每一项都写明最后检查的日期和失败的内容。

| 脚本           | 在 `main` 上检查 | 失败内容                                                                                                                                    | Issue |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `liquid-glass` | 2026-10-09       | 手机宽度下点击 Chat 标签超时：开发服务器出错后，Next.js 的开发浮层（`nextjs-portal`）挡住了它。用 `--prod` 运行可以区分真实失败和浮层问题。 | 暂无  |
| `thinking-orb` | 2026-10-09       | 1440 浅色下 "running subagents show orbs (0)"：没有出现 `.thinking-row__leading canvas.thinking-orb`，随后的等待超时。                      | 暂无  |

以下失败也在未修改的基线 `42fded7` 上复现（2026-10-10）：使用生产服务器，设置 `DATA_MODE=mock`、`USE_MOCK_TOOLS=true`，并清空 `MOCK_GOOGLE_MAPS`、模型和 Clerk 变量：

| 脚本          | 失败内容                                                                                                                                                          | Issue |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `timeline`    | fare-decimals 控制台检查记录四个 fixture 地点详情的 404 响应。fixture 使用占位地点 ID，但未模拟其详情；JPY/AUD/KRW 票价和路线检查全部通过（总计 99/100 项通过）。 | 暂无  |
| `phone-state` | 在 390×844 和 360×800 下，重新加载未恢复 Map。Trip、Mine 和 Chat 的重新加载检查通过。                                                                             | 暂无  |

## 不算失败

- `installable-app` 在 `next dev` 下会一直等待，因为 service worker 只在生产构建中注册。请按脚本头部的说明运行 `pnpm --filter @trip/web e2e installable-app --prod`，安装完整 Chromium 后，24 项检查全部通过（2026-10-10）。

## 如何检查

```bash
git worktree add ../main-check origin/main && cd ../main-check && pnpm install
DATA_MODE=mock pnpm --filter @trip/web e2e <script>
```

运行器会停止超过 `E2E_SCRIPT_TIMEOUT_MS` 仍在运行的脚本，并报告为 `TIME`；见 [development.md](development.zh.md#testing-approach)。

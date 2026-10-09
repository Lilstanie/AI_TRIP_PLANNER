# 在 main 上失败的 E2E 脚本

[English](e2e-known-failures.md) | 中文

CI 不运行 E2E 脚本，所以某个脚本可能在 `main` 上失败了一段时间都没人发现。判断一个失败的脚本是不是你引入的回归之前，先看这份清单；发现某个脚本在 `main` 上失败，或修好了一个，请更新它。每一项都写明最后检查的日期和失败的内容。

| 脚本           | 在 `main` 上检查 | 失败内容                                                                                                                                    | Issue |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `liquid-glass` | 2026-10-09       | 手机宽度下点击 Chat 标签超时：开发服务器出错后，Next.js 的开发浮层（`nextjs-portal`）挡住了它。用 `--prod` 运行可以区分真实失败和浮层问题。 | 暂无  |
| `thinking-orb` | 2026-10-09       | 1440 浅色下 "running subagents show orbs (0)"：没有出现 `.thinking-row__leading canvas.thinking-orb`，随后的等待超时。                      | 暂无  |

## 不算失败

- `installable-app` 在 `next dev` 下会一直等待，因为 service worker 只在生产构建中注册。请按脚本头部的说明运行 `pnpm --filter @trip/web e2e installable-app --prod`，它能通过（2026-10-09）。

## 如何检查

```bash
git worktree add ../main-check origin/main && cd ../main-check && pnpm install
DATA_MODE=mock pnpm --filter @trip/web e2e <script>
```

运行器会停止超过 `E2E_SCRIPT_TIMEOUT_MS` 仍在运行的脚本，并报告为 `TIME`；见 [development.md](development.zh.md#testing-approach)。

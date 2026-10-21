<a id="demo-runbook"></a>

# 演示运行手册

[English](demo-runbook.md) | 中文

如何在一台什么都没准备的笔记本上构建并运行本应用，以及 Week 13 演示期间网络或某个服务商出问题时该怎么做。
环境变量的完整说明见[开发指南](development.zh.md)；本页只列演示用得上的部分。

<a id="toolchain"></a>

## 工具链

| 工具 | 版本                                                             |
| ---- | ---------------------------------------------------------------- |
| Node | 24.14.1（`package.json` 要求 `>=22`）                            |
| pnpm | 9.15.0（由 `packageManager` 锁定；更高版本会提示升级，但仍可用） |
| Git  | 2.39.5                                                           |

<a id="build-from-a-clean-copy"></a>

## 从干净副本构建

```bash
pnpm install
pnpm build
pnpm --filter @trip/web start -p 3000
```

构建**完全不需要任何环境变量**，也不会产生警告。安装完成后，构建约需 30 秒，启动不到 1 秒。

只有当 pnpm store 中已有这些包时，`pnpm install` 才会在几秒内完成。在一台从未构建过本项目的笔记本上，
同一步骤需要下载约 830 MB，完成后连同 `.next` 约占 1.3 GB。**请在出发前安装，不要到现场才装。**

<a id="environment-variables"></a>

## 环境变量

只列名称。切勿把密钥粘贴到本页、提交记录、测试前置数据或聊天消息中。

| 变量                                                    | 缺少时的表现                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DEEPSEEK_API_KEY`                                      | 行程、餐饮与目的地指南退回确定性的本地方案，并显示 `fallback` 来源标记。计划仍会完整生成。 |
| `SERPAPI_KEY`                                           | 没有实时航班与酒店价格；`hotelsAndFlights` 报告为 false。                                  |
| `MAPS_API_KEY`                                          | 地点、路线与时区改用免费的 OpenStreetMap 服务。                                            |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                       | 工作区地图改用 OpenStreetMap 瓦片。需限制为演示所用的域名。                                |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` | 无法登录。缺少它们的部署只提供示例数据，因此不会消耗服务商额度。                           |
| `DATABASE_URL`                                          | 账号相关路由返回 503。可以登录，但什么都存不下。                                           |
| `USE_MOCK_TOOLS`                                        | 默认为示例数据。需要实时服务商时，必须精确设为 `false`。                                   |

对演示而言，唯一会改变观众所见内容的密钥是 `DEEPSEEK_API_KEY`。示例数据能替代服务商，但替代不了模型。

<a id="falling-back-to-mock-data"></a>

## 退回示例数据

示例模式是自包含的：不需要网络、密钥或账号。

- **整个部署：** 不设置 `USE_MOCK_TOOLS`，或将其设为 `false` 以外的任何值。
- **单次请求：** 顶栏的数据模式开关会为该请求发送 `x-trip-data-mode: mock`。对于无权消耗额度的访客，
  该开关处于禁用状态，实时模式会被拒绝。
- **确认服务端实际会怎么做：** `curl http://localhost:3000/api/data-mode` 会报告 `configured`、
  `liveAvailable` 以及已配置了哪些服务商。

在未配置任何密钥的示例模式下，五个 agent 的完整计划仍能跑完。如上表所述，没有模型密钥时会有三个章节
带上 `fallback` 标记。

该响应中的 `maps: true` 表示存在可用的地图服务商，其中包含免费的 OpenStreetMap 后备方案，
并不代表已设置 `MAPS_API_KEY`。

<a id="if-something-fails-on-the-day"></a>

## 当天出问题怎么办

| 现象                         | 处理                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| 会场没有网络                 | 无需处理：示例模式是默认值，且不需要网络。                        |
| 某个服务商报错或超出额度     | 该章节会降级并在来源标记中说明，继续演示即可。                    |
| Google 返回 `REQUEST_DENIED` | 密钥有误、已被删除，或相关 API 未启用。把那台笔记本切到示例模式。 |
| 端口 3000 被占用             | `pnpm --filter @trip/web start -p 3100`。                         |
| 这台机器从未构建过           | 停下。现场安装要花几分钟，不是几秒。                              |

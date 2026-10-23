<a id="demo-runbook"></a>

# 演示运行手册

[English](demo-runbook.md) | 中文

如何在一台什么都没准备的笔记本上构建并运行本应用，以及 Week 13 演示期间网络或某个服务商出问题时该怎么做。
环境变量的完整说明见[开发指南](development.zh.md)；本页只列演示用得上的部分。

<a id="toolchain"></a>

## 工具链

| 工具 | 版本                                           |
| ---- | ---------------------------------------------- |
| Node | 24.14.1（`package.json` 要求 `>=22`）          |
| pnpm | 9.15.0（由 `packageManager` 锁定；使用该版本） |
| Git  | 2.39.5                                         |

<a id="build-from-a-clean-copy"></a>

## 从干净副本构建

```bash
pnpm install
pnpm build
pnpm --filter @trip/web start -p 3000
```

原始彩排在 macOS 14.6.1 上使用上述工具链，未设置环境变量，构建约需 30 秒，启动不到 1 秒，构建没有警告。
请在每台演示机器上彩排；耗时和警告可能不同。

只有当 pnpm store 中已有这些包时，`pnpm install` 才会在几秒内完成。彩排测得
安装后的依赖占 829 MB，`.next` 输出占 481 MB，合计约 1.3 GB。这些是磁盘占用；尚未测量冷缓存下的下载量和安装耗时。**请在出发前安装，不要到现场才装。**

<a id="environment-variables"></a>

## 环境变量

只列名称。切勿把密钥粘贴到本页、提交记录、测试前置数据或聊天消息中。

| 变量                                                    | 缺少时的表现                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DEEPSEEK_API_KEY`                                      | 行程、餐饮与目的地指南退回确定性的本地方案，并显示 `fallback` 来源标记。计划仍会完整生成。 |
| `SERPAPI_KEY`                                           | 没有实时航班与酒店价格；`hotelsAndFlights` 报告为 false。                                  |
| `MAPS_API_KEY`                                          | 使用默认网页地图服务商时，地点和路线改用免费服务；时区通过坐标离线解析。                   |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                       | 工作区地图使用免费后备方案。如配置浏览器密钥，应限制为演示所用的域名。                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` | 无法登录。Vercel 部署缺少认证配置时，数据服务商仅使用示例数据；模型调用另由模型密钥决定。  |
| `DATABASE_URL`                                          | 账号路由返回 503，无法进行账号同步；浏览器本地聊天和行程仍会保存。登录仍需配置 Clerk。     |
| `USE_MOCK_TOOLS`                                        | 默认为示例数据。需要实时服务商时，必须精确设为 `false`。                                   |

`DEEPSEEK_API_KEY` 决定演示使用模型还是确定性的本地方案。示例数据能替代服务商，但替代不了模型。

<a id="falling-back-to-mock-data"></a>

## 退回示例数据

示例数据服务商使用本地前置数据。若要彩排无需模型网络调用的确定性规划，还需取消设置 `DEEPSEEK_API_KEY`
以及其他模型凭据。浏览器地图瓦片和已配置的登录仍可能需要网络；示例模式不代表整个应用可离线使用。

- **整个部署：** 不设置 `USE_MOCK_TOOLS`，或将其设为 `false` 以外的任何值。
- **单次请求：** 顶栏的数据模式开关会为该请求发送 `x-trip-data-mode: mock`。对于无权消耗额度的访客，
  该开关处于禁用状态，实时模式会被拒绝。
- **确认服务端实际会怎么做：** `curl http://localhost:3000/api/data-mode` 会报告 `configured`、
  `liveAvailable` 以及已配置了哪些服务商。

在未配置任何密钥的示例模式下，五个 agent 的完整计划仍能跑完。如上表所述，没有模型密钥时会有三个章节
带上 `fallback` 标记。

该响应中的 `maps: true` 反映配置：已设置 Google 密钥，或网页地图服务商允许免费后备方案。
它不检查连通性，也不证明 `MAPS_API_KEY` 有效。

<a id="assistants-walkthrough"></a>

## 助手演示流程

第二阶段的助手演示在示例模式下无需任何密钥即可运行，支持中英文，桌面和手机均可。
在聊天框里逐条输入；`@` 加助手名称，或点击消息框上方的芯片，即可提及该助手。

1. 规划悉尼出发去东京，2027-02-01 至 2027-02-04，2 位成人，预算 AUD 6000。协调员和五位 specialist 带着各自图标出现。
2. `@Stay find a cheaper stay`。只有住宿 specialist 工作，只有它的部分会变。
3. 把预算降到方案超支，再重复第 2 步。冲突、修订得分和停止消息以朴素的规则行显示。
4. `@Stay @Getting around find cheaper options`。恰好这两位 specialist 在同一轮工作。
5. `@Stay recommend a restaurant`。Stay 婉拒并指出 Food & dining，协调员分发，Food & dining 作答。
6. Settings → Personalization → Assistant names：给 Stay 改名，再用新名称提及它。
7. 清除浏览器数据后发送 `@Stay when are hotels cheapest?`。specialist 作答，不创建方案，协调员继续询问行程信息。

`CHANNEL=chromium DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e assistants-demo` 会在 1440 px 和 390 px、两种语言下重复全部七步，每一步保存截图，并把 `output/playwright/assistants-demo/result.json` 作为演示记录。

<a id="if-something-fails-on-the-day"></a>

## 当天出问题怎么办

| 现象                         | 处理                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| 会场没有网络                 | 使用已构建并彩排的示例数据与确定性的本地后备方案；离线时地图瓦片和已配置的登录可能不可用。 |
| 某个服务商报错或超出额度     | 该章节会降级并在来源标记中说明，继续演示即可。                                             |
| Google 返回 `REQUEST_DENIED` | 密钥有误、已被删除，或相关 API 未启用。把那台笔记本切到示例模式。                          |
| 端口 3000 被占用             | `pnpm --filter @trip/web start -p 3100`。                                                  |
| 这台机器从未构建过           | 停下。现场安装要花几分钟，不是几秒。                                                       |

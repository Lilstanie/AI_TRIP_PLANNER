<a id="api-entry-points"></a>

# API 入口

[English](api.md) | 中文

Next.js 路由处理器位于 `apps/web/app/api/`。`/api/data-mode` 和 `/api/places/photo` 是
`GET` 处理器，其余五个是 `POST` 处理器。请求体使用 Zod 验证，规划输出按照
`packages/shared/src/` 中的共享约定验证。

| 路径                                                        | 用途                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| [`/api/chat`](#post-apichat)                                | 提取行程需求更新或规划提交的需求，并以流式方式报告进度 |
| [`/api/data-mode`](#get-apidata-mode)                       | 返回默认数据模式，以及是否配置了实时提供方密钥         |
| [`/api/places/search`](#post-apiplacessearch)               | Google Places 文本搜索                                 |
| [`/api/places/details`](#post-apiplacesdetails)             | 按地点 ID 获取 Google 地点详情                         |
| [`/api/places/photo`](#get-apiplacesphoto)                  | 重定向到一张 Google 地点照片                           |
| [`/api/routes/from-location`](#post-apiroutesfrom-location) | 从用户授权提供的位置到地点的路线                       |
| [`/api/trip/preview-edit`](#post-apitrippreview-edit)       | 预览行程编辑，并检查路线和预算                         |

浏览器在每次请求中发送当前计划或行程需求，并将工作区保存在本地存储中。服务端的
`packages/services` 在配置了 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 时，将聊天轮次、
偏好和生成的计划记录到 Redis REST 存储中；否则记录到进程内存中。

<a id="post-apichat"></a>

## `POST /api/chat`

约定：`packages/shared/src/chat.ts` 中的 `ChatRequest`、`ChatResponse` 和 `AgentProgressEvent`。

```json
{
  "tripId": "trip-123",
  "message": "Make the budget 2500",
  "brief": {
    "tripId": "trip-123",
    "userId": "demo-user",
    "destination": "Tokyo",
    "dates": ["2026-10-01", "2026-10-04"],
    "groupSize": 2,
    "budgetTotal": 3000
  }
}
```

`brief.preferences` 和 `known.preferences` 是可选字段，保存旅行者自己的旅行偏好
（“素食”“不要太早开始”）。最多包含 `MAX_TRIP_PREFERENCES`（12）条，每条在去除首尾空白后为
1 到 `MAX_TRIP_PREFERENCE_LENGTH`（200）个字符；这两个常量都位于
`packages/shared/src/contracts.ts`。这些偏好只来自旅行偏好编辑器，协调器从不写入它们，
每个 specialist 和 supervisor 都会随行程需求一起接收它们。`nationality` 和 `accommodation`
仍可接收并继续传递，但当前没有界面设置它们。

`brief.party` 和 `known.party` 也是可选字段，格式为 `{ adults, children, infants, seniors, pets }`，
各项为 0 到 99 的整数（`packages/shared/src/contracts.ts` 中的 `TravellerParty`），
由 Who 编辑器的步进控件设置。它们细分 `groupSize` 并补充宠物数量；宠物不计入其中。
所有费用仍以 `groupSize` 为准，specialist 会收到指令：如果 party 中的人数之和与它不符，就忽略 party。

可选的 `attachments`：旅行者附加到这条消息的文件，最多 4 个。

```json
{
  "attachments": [
    { "name": "hotel.png", "mediaType": "image/png", "kind": "image", "data": "iVBORw0KGgo=" },
    {
      "name": "booking.txt",
      "mediaType": "text/plain",
      "kind": "text",
      "data": "Confirmation 12345"
    }
  ]
}
```

对于 `kind: "image"`，`data` 是文件字节的 base64 编码（不带 `data:` 前缀）；
对于 `kind: "text"`，它是解码后的 UTF-8 文本本身。以下限制以具名常量定义在
`packages/shared/src/chat.ts` 中：

| 常量                          | 限制                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `MAX_ATTACHMENTS_PER_MESSAGE` | 每条消息 4 个附件                                             |
| `MAX_IMAGE_BASE64_LENGTH`     | 每张图片 1,500,000 个 base64 字符（约 1.1 MB 文件）           |
| `MAX_TEXT_ATTACHMENT_BYTES`   | 每个文本文件 32,768 个 UTF-8 字节                             |
| `IMAGE_MEDIA_TYPES`           | `image/png`, `image/jpeg`, `image/webp`, `image/gif`          |
| `TEXT_MEDIA_TYPES`            | `text/plain`, `text/markdown`, `text/csv`, `application/json` |

媒体类型不在该类别的允许列表中、文件过大或图片不是无前缀 base64 时，请求会在调用任何提供方之前
被拒绝，返回 HTTP 400 和 `{ "error": "Attachment rejected: …" }`。
整个请求体仍受平台限制：Vercel serverless function 在处理器运行之前，就会以自己的 413 响应
拒绝超过 4.5 MB 的请求体。因此，无论上面的单文件限制如何，一条消息实际最多可包含三张达到最大尺寸的图片。

只有协调器能看到附件：图片以 OpenAI 风格的 `image_url` 内容块传入，文本文件则内联到消息中，
使用注明文件名的分隔符；specialist 的输入不变。没有提供方密钥时，图片被忽略，内联文本仍会被读取。

可选的 `mode` 值：

- `"chat"`（默认）：从 `message` 提取明确的更新，并应用到 `brief`。没有行程需求时，
  以编排器旧有的 `DEMO_BRIEF` 为基准；Web 工作区始终发送行程需求，或使用 `"start"`。
- `"plan"`：必须提供 `brief`，按提交的内容规划，不执行提取。
- `"start"`：空白对话。省略 `brief`，目的地、日期、旅行者人数和总预算必须全部在 `message` 中说明。
  缺失字段会通过 `error` 帧报告（例如“要开始规划，请提供开始和结束日期……”），
  绝不会从示例或先前的旅行中借用。

响应为 `application/x-ndjson`，每行一个 JSON 对象：

- `type` 为 `coordinator`、`agent_started`、`agent_completed` 或 `agent_failed` 的进度事件；
- 最终帧 `{ "type": "complete", "response": { "reply": "…", "plan": { … } } }`；
- 或带有面向用户消息的 `{ "type": "error", "error": "…" }`。

无效请求体会在流式响应开始前返回 HTTP 400 JSON。

可选的 `x-trip-data-mode` 请求头值为 `mock` 或 `live`，仅为本次请求选择 fixture（测试前置数据）
或实时提供方；其他值或未提供请求头时，使用部署默认值。

<a id="get-apidata-mode"></a>

## `GET /api/data-mode`

```json
{ "configured": "mock", "providers": { "hotelsAndFlights": false, "maps": true } }
```

`configured` 是部署默认值（只有 `USE_MOCK_TOOLS=false` 时才为 `live`）。
`providers` 报告是否设置了 `SERPAPI_KEY` 和 `MAPS_API_KEY`，绝不返回它们的值。响应不缓存。

<a id="post-apiplacessearch"></a>

## `POST /api/places/search`

实现：`apps/web/lib/integrations/google.ts` 中的 `searchPlaces`（需要服务端的 `MAPS_API_KEY`）。

```json
{ "text": "To-ji Temple", "destination": "Kyoto" }
```

`destination` 是可选字段；查找城市本身时省略它。响应为 `{ "places": GooglePlace[] }`。
工作区只发送保存的地点名称、明确的活动位置或本身就是地点名称的标题
（`apps/web/lib/map/place-query.ts`），绝不发送描述性的活动文本。
错误：400 表示输入无效，429 表示 Google 限流，502 表示其他上游失败。
错误消息不包含查询内容或提供方详情。

<a id="post-apiplacesdetails"></a>

## `POST /api/places/details`

```json
{ "placeId": "ChIJ…" }
```

返回 `{ "place": GooglePlace }`。错误：400 表示输入无效，404 表示地点 ID 已不可用，
429 表示限流，502 表示其他上游失败。

这两个路由返回的 `GooglePlace.photos` 都包含 Google 照片名称和作者署名。
它们只保留在浏览器内存中，绝不写入计划，因为 Google 禁止缓存这些数据。

<a id="get-apiplacesphoto"></a>

## `GET /api/places/photo`

实现：`apps/web/lib/integrations/google.ts` 中的 `placePhotoUri`。

```text
/api/places/photo?name=places/ChIJ…/photos/Aa…&width=400
```

`name` 必须是从最新查询中获得的 `places/{id}/photos/{id}` 名称，`width` 为 160、400 或 800。
路由向 Google 请求图片 URL，再以 `302` 响应重定向到 `googleusercontent.com` URL，
并设置 `Cache-Control: no-store`，因此 `<img>` 可以指向它，而不会让服务端密钥进入浏览器。
每次调用都是一次计费的 Google 照片请求。错误：400 表示输入无效，404 表示照片已过期或未知，
429 表示限流，502 表示其他上游失败或缺少密钥。

<a id="post-apiroutesfrom-location"></a>

## `POST /api/routes/from-location`

```json
{ "latitude": -33.86, "longitude": 151.21, "placeId": "ChIJ…", "mode": "WALK" }
```

返回 `RouteResult`（`status` 为 `ok` 时带有 `durationMin` 和 `distanceMeters`，
为 `unavailable` 时带有 `error`）。只有用户请求获取自身位置后才会发送坐标；
坐标不会被存储，也不会写入计划。输入无效时返回 400。

<a id="post-apitrippreview-edit"></a>

## `POST /api/trip/preview-edit`

约定：`apps/web/lib/trip/trip-edit.ts` 中的 `EditRequest` 和 `EditPreview`。

```json
{
  "plan": { "…": "current TripPlan" },
  "baseVersion": 3,
  "mode": "WALK",
  "operation": { "kind": "time", "id": "activity-id", "startTime": "10:00", "endTime": "12:00" }
}
```

`operation.kind` 为 `verify`（检查某一天的路线）、`move`、`time`、`place` 或 `undo`。
响应为 `{ plan, baseVersion, routes, differences, blockers }`。它只是预览：
客户端在用户确认后才应用它，若 `baseVersion` 已不匹配则拒绝应用。无效编辑返回 400。

<a id="related-contracts"></a>

## 相关约定

- 聊天请求/响应和进度事件：`packages/shared/src/chat.ts`
- 行程需求、提案和端口：`packages/shared/src/contracts.ts`、`packages/shared/src/ports.ts`
- 旅行计划及其未解决冲突：`packages/shared/src/plan.ts`
- Specialist 约定：`packages/shared/src/agent.ts`

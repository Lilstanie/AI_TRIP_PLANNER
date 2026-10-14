<a id="api-entry-points"></a>

# API 入口

[English](api.md) | 中文

Next.js 路由处理器位于 `apps/web/app/api/`。`/api/data-mode` 和 `/api/places/photo` 是
`GET` 处理器；其余路由使用下表所示的方法。请求体使用 Zod 验证，规划输出按照
`packages/shared/src/` 中的共享约定验证。

| 路径                                                        | 用途                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| [`/api/chat`](#post-apichat)                                | 提取行程需求更新或规划提交的需求，并以流式方式报告进度 |
| [`/api/agent-lab/runs`](#post-apiagent-labruns)             | 运行已注册、可检查的 fixture 实验                      |
| [`/api/data-mode`](#get-apidata-mode)                       | 返回默认数据模式，以及是否配置了实时提供方密钥         |
| [`/api/places/search`](#post-apiplacessearch)               | Google Places 文本搜索                                 |
| [`/api/places/details`](#post-apiplacesdetails)             | 按地点 ID 获取 Google 地点详情                         |
| [`/api/places/photo`](#get-apiplacesphoto)                  | 重定向到一张 Google 地点照片                           |
| [`/api/routes/from-location`](#post-apiroutesfrom-location) | 从用户授权提供的位置到地点的路线                       |
| [`/api/trip/preview-edit`](#post-apitrippreview-edit)       | 预览行程编辑，并检查路线和预算                         |
| [`/api/account/settings`](#get-and-put-apiaccountsettings)  | 读取或保存已登录旅客的设置                             |
| [`/api/account/sync`](#get-and-post-apiaccountsync)         | 拉取或推送已登录旅客的行程和聊天                       |
| [`/api/account/export`](#get-apiaccountexport)              | 以 JSON 下载账号保存的全部数据                         |
| [`/api/account`](#delete-apiaccount)                        | 删除账号及其数据                                       |

浏览器在每次请求中发送当前计划或行程需求，并将工作区保存在本地存储中。服务端的
`packages/services` 在配置了 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 时，将聊天轮次、
偏好和生成的计划记录到 Redis REST 存储中；否则记录到进程内存中。

<a id="failure-bodies"></a>

应用自身路由（`/api/chat`、地点路由、`/api/routes/from-location`、`/api/trip/preview-edit` 和账号路由）
的失败响应体为 `{ error, notice }`。`error` 是供日志和旧版客户端读取的英文句子；`notice` 是同一失败的
`Notice`，界面以所选语言显示：应用自身的措辞为 `{ key, params }`，按原样转交的文本为 `{ raw }`
（`apps/web/lib/i18n/notice.ts`）。Agent Lab 保留自己的错误格式。

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

`brief` 和 `known` 上另有三个可选字段，来自对话：

- `learnedPreferences` 的限制与 `preferences` 相同，保存协调器在聊天中听到的愿望。specialist
  收到的是追加在 `preferences` 之后的列表。
- `excludeFlights: true` 表示旅行者自行安排航班。此时飞行航段是未计价的“arranged by you”条目，
  没有票价，也没有 `flights` 选择。
- `bookedStay: { name, note? }` 是旅行者已预订的住宿。住宿部分只有这一条未计价条目，没有
  `stays` 候选。

旅行者可以在 Trip preferences 中移除这些字段，客户端随后发送的行程需求不再包含它们。

`brief.displayCurrency` 和 `known.displayCurrency` 同样是可选字段：取 `AUD`、`CNY`、`USD` 或 `JPY` 之一
（`packages/shared/src/money.ts` 中的 `Currency`），表示旅行者最近一次为该行程指定的币种，无论连同预算还是单独说出。
协调器的 `update_trip_brief` 工具以 `displayCurrency` 接收它，可以不带金额；没有密钥时，离线提取器会把消息中检测到的任何币种
（无论是否带预算）写入该字段。后一次指定会替换前一次，指定 AUD 就是 AUD，没有指定币种的消息则保持原值。它只用于显示：
规划仍使用 AUD，`budgetSource` 不会被改写。在指定币种之前以及该字段出现之前保存的行程中，它都不存在；此时客户端读取
`effectiveCurrency(brief, settings.displayCurrency)`，先回退到 `budgetSource.currency`，再回退到设置中的币种。
行程从不写入设置。

请求本身还有可选的 `displayCurrency`：取 `AUD`、`CNY`、`USD` 或 `JPY` 之一，即设置中的显示币种。网页端与 `interfaceLanguage`
一样，在每次聊天请求中发送它。服务器只把它用作同一条 `effectiveCurrency` 规则的最后一步（排在 `brief.displayCurrency` 和
`brief.budgetSource.currency` 之后），用来书写服务器生成文字中的金额：specialist 摘要、冲突原因和约束、进度行、预算分配依据以及回复。
不传该字段时回退为 AUD，旧客户端得到的文字与以前一致；不支持的币种代码会返回 400。服务器从不写入设置。
规划金额、预算检查、冲突检测和规划评分仍为 AUD，提供方票价保留提供方币种。

`brief.party` 和 `known.party` 也是可选字段，格式为 `{ adults, children, infants, seniors, pets }`，
各项为 0 到 99 的整数（`packages/shared/src/contracts.ts` 中的 `TravellerParty`），
由 Who 编辑器的步进控件设置。它们细分 `groupSize` 并补充宠物数量；宠物不计入其中。
所有费用仍以 `groupSize` 为准，specialist 会收到指令：如果 party 中的人数之和与它不符，就忽略 party。

可选的 `assistant`：来自 Settings → Personalization 的 `{ style, memory }`（`packages/shared/src/chat.ts` 中的
`AssistantSettings`）。

- `style` 取 `neutral`、`friendly`、`concise` 或 `detailed`，决定协调器的语气。
- `memory: false` 时，服务器从 `brief` 和 `known` 中去掉 `learnedPreferences`，协调器也不再记录。

不传该字段时，行为等同于 `neutral` 且开启记忆。

可选的 `interfaceLanguage`：`en` 或 `zh`（`packages/shared/src/chat.ts` 中的 `InterfaceLanguage`），
即旅行者界面当前显示的语言。网页端在每次聊天请求中发送当前的界面语言。协调器始终使用旅行者最新一条消息的语言回复；
只有当这条消息看不出语言时（例如只有地名、日期或数字），才由该字段决定回复语言。它不会改变界面语言。
不传该字段时，协调器没有回退语言，仍像以前一样跟随最新消息的语言。specialist 不会收到该字段。

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
被拒绝，返回 HTTP 400 和
`{ "error": "Attachment rejected: …", "notice": { "key": "Attachment rejected: {reason}", … } }`。
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
- 或 `{ "type": "error", "error": "…", "notice": { … } }`，即
  [`{ error, notice }`](#failure-bodies) 形式的失败。

请求体无效，或 `mode: "plan"` 却没有行程需求时，会在流式响应开始前返回 HTTP 400 和
`{ "error": "The request was invalid. Please retry.", "notice": { … } }`。

可选的 `x-trip-data-mode` 请求头值为 `mock` 或 `live`，仅为本次请求选择 fixture（测试前置数据）
或实时提供方；其他值或未提供请求头时，使用部署默认值。

<a id="post-apiagent-labruns"></a>

## `POST /api/agent-lab/runs`

约定：`packages/shared/src/agent-lab.ts` 中的 `AgentLabRunRequest`、`AgentLabRunEvent`、
`AgentLabStreamFrame` 和 `AgentLabRunArtifact`。

```json
{
  "scenarioId": "tokyo-couple",
  "strategyId": "single-agent-baseline",
  "dataMode": "fixture"
}
```

`scenarioId` 为 `tokyo-couple`、`tokyo-couple-tight-budget`（同一趟旅行、同一份证据，预算为 A$2,300，
因此第一版计划会超支）、`paris-family-infeasible`（四位旅行者、A$3,000，而受支持的最低成本为 A$3,880，
因此没有任何计划放得下）或 `tokyo-kyoto-multi-city`（两座城市共七晚）。`strategyId` 为 `single-agent-baseline`、`multi-agent-no-revision` 或
`multi-agent-targeted-revision`。第二个通过 LangGraph 工作流用五个已注册 specialist 运行一轮，因此其计划为
`round: 1`，所有冲突都保持未解决。第三个运行既有的循环，最多三轮：把每个冲突交给它所点名的 specialist，
修订未改善计划时保留已知最佳提案，预算不可行时提前停止。`multi-agent-with-revision` 未注册，会被拒绝。

可选的 `faultProfileId` 请求一个已注册的故障：`provider-timeout`、`provider-empty-result`、
`invalid-agent-output`、`supervisor-failure` 或 `stalled-revision`。每个故障只绑定它所设计的那一个场景和策略
（见 [architecture](architecture.zh.md#agent-lab)）；对其他组合的请求，与未知 id、自行定义故障的对象或多余属性一样，得到相同的 400。
访客只能选择档案，绝不能自行定义故障。产物在 `faultProfileId` 中记录它（普通运行以及故障出现之前记录的产物为 `null`），
轨迹以 `lab_fault_injected` 开头。故障还可能增加 `lab_agent_output_rejected`（只列出被拒绝的字段路径）和 `lab_supervisor_fallback`。

请求采用严格校验：未知值或额外属性会返回 HTTP 400 和
`{ "error": "Invalid Agent Lab request" }`。有效请求以 NDJSON 流返回帧。事件帧格式为
`{ "type": "event", "event": { ... } }`，最后一帧格式为
`{ "type": "complete", "artifact": { ... } }`。产物包含经过校验的计划、有序事件、
确定性指标，以及明确的 fixture／评估器版本。`metrics.checks` 逐项列出按场景规则衡量的具名检查
（`id`、`label`、`passed`）；计划超出预算时 `budgetHeadroom` 为负数。若场景的证据表明没有任何计划放得下，则用 `evidence-floor`（估算不低于受支持的最便宜选项）和 `infeasibility-reported`（计划指出受支持的最低成本）取代 `budget` 和 `no-conflicts`；多城市场景再增加 `hop-date`、`itinerary-by-city`、`stay-transition`、`trip-dates` 和 `total-consistent`。`versions.evaluator` 为 `scenario-rules-v2`，`versions.fixture` 指明场景的 fixture。对比数据 `rounds`、`toolCalls`、`fallbacks`、`failedAgents` 和
`unresolvedConflicts` 由轨迹和计划统计得出；`latencyMs` 是不含显示节奏延迟的运行耗时（`durationMs` 含该延迟），
在 fixture 模式下仅衡量编排开销。产物还记录 `groundedSections`、`duplicateStops`、`genericStops`、
`multiCityConsistent`（单城市旅行为 `null`）、`stopReason`（没有循环的策略为 `null`）和 `usage`；fixture 运行不调用
模型，所以 `usage` 为 `{ "status": "unavailable" }`：缺失的用量绝不会被当作 0。除 `durationMs` 和 `latencyMs` 外，
每个指标都能仅凭最终计划和轨迹重新计算，不需要模型来评判。修订运行会增加轨迹事件 `lab_conflict_detected`、
`lab_revision_started`、`lab_revision_scored` 和 `lab_loop_stopped`。客户端取消请求会中止运行，不发送完成帧。
运行失败时（包括被故障终止的运行），会发送 `error` 帧；其中包含不敏感的消息，以及记录失败前事件的结构化
`failed` 产物。当某个 specialist 报告无法完成时，`failure.code` 为 `agent_failed`，`failure.agent` 指明该 specialist；
其他情况为 `run_failed`；两种消息都不含堆栈、校验器消息或提供方载荷。

`dataMode` 为 `fixture`（默认）或 `live`。fixture 运行对该请求使用 mock 工具且不使用模型，因此无论部署持有什么密钥、默认数据模式是什么，
它都不发起外部调用、不消耗额度。它不需要任何凭据，并且它和实时运行都不会持久化聊天、行程或实验结果。

实时运行使用部署自己的模型和提供方，且只在部署设置了 `AGENT_LAB_LIVE_ENABLED=true` 时存在（见 [development](development.zh.md)）。只有两个 specialist 策略有实时实现；
单 agent 基线回放的是一份录制结果，因此请求它的实时运行会被拒绝。无法开始的请求只会收到一个带类型的 `rejected` 帧，没有运行，也绝不会有产物：
503 `live_disabled`、400 `live_unsupported`，或带有 `Retry-After` 头和 `retryAfterSeconds` 的 429 `concurrency_limit` / `rate_limit`。
这些都不是实验的失败，且消息不会点出任何设置或限额。实时产物的 `dataMode`，以及每个事件上的同名字段，都是 `live`。
它的 `metrics.usage` 仅当提供方为每次模型调用都返回了用量时才是带有输入、输出和总 token 数的 `{ "status": "measured", ... }`，否则是
`{ "status": "unavailable", "reason": ... }`，绝不会是 0 或部分合计。模型成本从不报告，轨迹也从不包含模型自己的推理。

<a id="get-apidata-mode"></a>

## `GET /api/data-mode`

```json
{ "configured": "mock", "providers": { "hotelsAndFlights": false, "maps": true } }
```

`configured` 是部署默认值（只有 `USE_MOCK_TOOLS=false` 时才为 `live`）。
`providers` 报告是否设置了 `SERPAPI_KEY` 和 `MAPS_API_KEY`，绝不返回它们的值。响应不缓存。

<a id="post-apiplacessearch"></a>

## `POST /api/places/search`

实现：`apps/web/lib/map-provider/` 中的 `MapProvider.searchPlaces`（默认先 Google，失败时免费回退）。

```json
{ "text": "To-ji Temple", "destination": "Kyoto" }
```

`destination` 是可选字段；查找城市本身时省略它。响应为 `{ "places": GooglePlace[], "source": "google" | "osm" }`。
工作区只发送保存的地点名称、明确的活动位置或本身就是地点名称的标题
（`apps/web/lib/map/place-query.ts`），绝不发送描述性的活动文本。
错误：400 表示输入无效，429 表示 Google 限流，502 表示其他上游失败，503 表示所选服务不可用或仅 Google 模式未配置密钥，
响应体均为 [`{ error, notice }`](#failure-bodies)。错误消息不包含查询内容或提供方详情。

<a id="post-apiplacesdetails"></a>

## `POST /api/places/details`

```json
{ "placeId": "ChIJ…", "language": "zh" }
```

返回 `{ "place": GooglePlace, "source": "google" | "osm" }`。错误：400 表示输入无效，404 表示地点 ID 已不可用，
429 表示限流，502 表示其他上游失败，503 表示所选服务不可用或仅 Google 模式未配置密钥，响应体均为 [`{ error, notice }`](#failure-bodies)。

这两个路由返回的 `GooglePlace.photos` 都包含 Google 照片名称和作者署名。
它们只保留在浏览器内存中，绝不写入计划，因为 Google 禁止缓存这些数据。

<a id="get-apiplacesphoto"></a>

## `GET /api/places/photo`

实现：`apps/web/lib/integrations/google.ts` 中的 `placePhotoUri`。

```text
/api/places/photo?name=places/ChIJ…/photos/Aa…&width=400
```

Google `name` 必须是从最新查询中获得的 `places/{id}/photos/{id}` 名称，`width` 为 160、400 或 800。
路由向 Google 请求图片 URL，再以 `302` 响应重定向到 `googleusercontent.com` URL，
并设置 `Cache-Control: no-store`，因此 `<img>` 可以指向它，而不会让服务端密钥进入浏览器。
每次 Google 照片调用均计费。OSM 照片使用 `osm:commons/{encoded filename}` 并重定向到经过验证的 Wikimedia 主机；模拟名称 `osm:fixture/Toji` 返回本地 SVG。Commons 照片必须注明作者和许可，不产生 Google 费用。错误：400 表示输入无效，404 表示照片已过期或未知，
429 表示限流，502 表示其他上游失败，503 表示所选服务不可用或仅 Google 模式未配置密钥，响应体均为 [`{ error, notice }`](#failure-bodies)。

<a id="post-apiroutesfrom-location"></a>

## `POST /api/routes/from-location`

```json
{ "latitude": -33.86, "longitude": 151.21, "placeId": "ChIJ…", "mode": "WALK" }
```

返回 `RouteResult`（`status` 为 `ok` 时带有 `durationMin` 和 `distanceMeters`，
为 `unavailable` 时带有 `error`）。只有用户请求获取自身位置后才会发送坐标；
坐标不会被存储，也不会写入计划。输入无效或查询失败时返回 400 和
[`{ error, notice }`](#failure-bodies)：输入无效时为“Route lookup failed.”，应用自身的拒绝原因保留其键，
其他错误以 `{ raw }` 原样转交。

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

`operation.kind` 为 `verify`（检查某一天的路线）、`move`（拖动：`day` 和 `index`）、`time`、`place`、`leg`、`choose`、`undo`，或时间线菜单发出的四种停靠点操作之一：`remove`（`id`）、`idea`（`id`，将停靠点移出其日期）、`schedule`（`id`、`day`：放到该天末尾）和 `swap`（`id`、`direction` 为 -1 或 1：箭头移动）。停靠点操作与浏览器中的停靠点操作使用同一变换，随后检查其所涉及的日期。`move` 遇到任何阻碍项即被拒绝，`schedule` 遇到除未确认地点以外的阻碍项即被拒绝。`swap` 保留其交换后的开始时间，只因站点超过午夜而被拒绝；不合这些时间的路段以通知显示在其停靠点上。只有带日期的活动会被规划路线和重新排时；ideas（没有日期的活动）原样保留。
响应为 `{ plan, baseVersion, routes, differences, blockers, blockerNotices }`。每条 difference 是数值对象
`{ stop, days?: { from, to }, before, after, placeChanged }`，由界面按所选语言组织文字。`blockerNotices` 以 Notice
列出阻止此修改的原因（应用自身的措辞为 `{ key, params }`，路线服务商的文字为 `{ raw }`），界面按所选语言显示；
`blockers` 以英文句子重复同样内容，供旧版客户端使用。它只是预览：客户端立即应用有效修改并提供撤销，拒绝过时结果。`baseVersion` 检查提交的计划，并非权威服务端版本。同一浏览器的标签页共用 Web Lock 和持久化计划指纹；旧标签页不能编辑或自动保存覆盖新计划。这不提供跨设备并发控制。无效编辑返回 400 和 `{ error, notice }`：`error` 是旧版客户端读取的英文句子，`notice`
是同一拒绝原因的 Notice；不属于应用自身拒绝原因的错误（例如格式错误的请求体）以 `{ raw }` 返回。

`choose` 接收 `{ section: "accommodation" | "transport", selectionId, candidateId }`，把住宿或机票换成专员已经找到的另一个候选。
系统按 `selectionId` 找到对应条目，用与专员相同的措辞重新定价和描述，并像其他修改一样重新计算费用、冲突和版本号。
界面会直接应用 `choose` 的预览而不先询问，因为变化的只是旅行者刚看到的价格。条目带有 `selectionId` 之前保存的方案会被拒绝，不会去猜。

请求可以携带 `displayCurrency`（`AUD`、`CNY`、`USD` 或 `JPY`），即设置中的显示币种；浏览器在每次编辑时都会发送。
它是 `effectiveCurrency` 的最后一步，排在行程自身的 `displayCurrency` 和 `budgetSource` 币种之后，缺省视为 AUD。
它只决定编辑所重写的句子如何书写金额（换掉的住宿描述、重新计算的冲突、`differences` 中的前后对比）；方案本身仍以 AUD 计。

<a id="related-contracts"></a>

## 账号路由

所有账号路由都需要 Clerk 会话，没有会话时返回 401；未配置 Clerk 或 `DATABASE_URL` 时返回 503。所有失败响应体（包括 400 和下文的 502）
均为 [`{ error, notice }`](#failure-bodies)。查询使用会话中的用户
id，绝不使用请求体中的 id。约定：`apps/web/lib/account/settings.ts` 中的 `UserSettings`，
`apps/web/lib/account/sync.ts` 中的 `SyncedRecord` 和 `SyncPush`。

### `GET` and `PUT /api/account/settings`

`GET` 返回 `{ settings }`；账号从未保存过设置时返回 `{ settings: null }`。`PUT` 接收 `UserSettings`
请求体并保存，除非账号中已有 `updatedAt` 更新的副本；无论是否写入，都返回账号当前保存的副本。请求体无效时返回 400。

### `GET` and `POST /api/account/sync`

`GET` 返回 `{ trips, conversations }`：账号保存的每条记录，形如 `{ id, updatedAt, record }`，已删除的记录为
`{ id, updatedAt, deleted: true }`。`POST` 接收相同结构（每类最多 500 条，每条记录的 JSON 最多 2,000,000 个字符），
仅当某条记录的 `updatedAt` 比已保存的更新时才写入。客户端使用工作区 catalog 自身的解析器合并并校验记录。

### `GET /api/account/export`

以 JSON 附件返回账号的设置、行程和对话。

### `DELETE /api/account`

先删除账号的数据行，再删除 Clerk 用户。如果数据行已删除但 Clerk 删除失败，返回 502 并说明情况。

## 相关约定

- 聊天请求/响应和进度事件：`packages/shared/src/chat.ts`
- 行程需求、提案和端口：`packages/shared/src/contracts.ts`、`packages/shared/src/ports.ts`
- 旅行计划及其未解决冲突：`packages/shared/src/plan.ts`
- Specialist 约定：`packages/shared/src/agent.ts`

地点搜索接受 `autocomplete: true` 表示输入建议。免费提供方只使用 Photon；不支持的语言或 Photon 故障返回空列表，绝不访问 Nominatim。显式提交的搜索不传此标志。

地点搜索和详情接受可选的 `language: "en" | "zh"`；OSM 详情默认使用英语，并按语言分别缓存。路段编辑接受 `mode: "cycle"`，保存为 `arriveBy.mode: "cycle"`，对应路线方式 `BICYCLE`。OSM 卡片不含评分；可选的 `source`、`osmUri`、`websiteUri`、`phone`、`openingHours` 和照片许可字段属于网页详情。活动只持久化 `savedPlace` 的名称、地址和坐标。OSM 路线的 `source` 标注 OSRM 或 Transitous；`no_route` 和 `unavailable` 都不产生虚构公交时长。`/api/data-mode` 的 `providers.maps` 包含免费回退；`webMapsProvider` 和 `mockGoogleUnavailable` 让浏览器遵循部署选择，且不暴露密钥。

`/api/routes/from-location` 接受已保存目的地的可选 `toLocation: { latitude, longitude }`。这些坐标让 OSM 能为 Google 保存的站点规划路线，而不查询其 ID。

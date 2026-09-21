# Google Maps P3 implementation

> Archived plan (2026-09-17). Current behaviour and editing rules are in [`workspace-ui.md`](../workspace-ui.md). Paths and baselines below describe the repository at the time.

## Baseline and scope

Merge `origin/main` (19a1bff) into `codex/ui-improvements`, preserving 2fd3030 and its P0–P2 work. Keep asynchronous `/api/demo`, local restore precedence, HITL and request cancellation. (Superseded on 2026-09-17: `/api/demo` was removed and the workspace now opens blank; see `docs/workspace-ui.md`.) No database, payment, real booking, or cross-city transport editing.

## Delivery slices

- P3.0: stable activity IDs, independent edit version, typed route results, version 1 → 2 local snapshot migration.
- P3.1: lazy Google Maps, day timeline, marker selection, Places search/details. Mock hotels remain explicitly simulated and unmapped.
- P3.2: Routes and Time Zone APIs, actual local departure date, 15-minute buffer, fixed transport conflicts.
- P3.3: reorder/time/place/day edits, deterministic preview, apply/cancel/undo, stale preview protection. No LLM calls for edits.
- P3.4: persistence, failures, responsive and keyboard verification, separate live Google smoke test.

## Contracts and interaction

Activities receive IDs once, retained on reorder and restore. `editVersion` is independent of orchestrator round. Persist user schedule and place IDs; provider coordinates, details and polylines remain runtime state. Browser key: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; map ID: `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`; server key: `MAPS_API_KEY`. Restrict browser key by referrer and server key by API. Map loading must not delay initial render.

`POST /api/places/search` accepts text/destination. `POST /api/places/details` accepts placeId. `POST /api/trip/preview-edit` accepts current plan, base version, activity operation and WALK/TRANSIT mode; returns candidate plan, differences, routes and conflicts. `POST /api/routes/from-location` accepts a user-approved runtime coordinate, selected placeId and mode, and returns a Google-verified duration/distance without storing or applying the location to the plan. Validate all input. Never silently fall back to another provider or mode.

Preserve activity duration. Starting at the affected slot, use the later of the original start and previous end + route duration + 15 minutes. Empty target days start 09:00 local. Move only within the same lodging destination segment. Unknown route blocks automatic shifting; users can adjust time or mode. Overflow beyond the day blocks apply. Fixed transport remains read-only; overlaps remain visible in review. Apply only previews matching the current plan version. Undo revalidates rather than restoring old approvals.

Replace-place edits mark the previous activity price unverified. Route fares are separate estimates, never added twice to transport. Unknown fare is not zero. Invalidate itinerary/final confirmation and regenerate conflicts while retaining unaffected brief and hotel decisions. Chat replanning replaces manual activities and requires pending preview resolution.

## Google API evidence

- [Advanced Markers requirements](https://developers.google.com/maps/documentation/javascript/advanced-markers/start): Maps JavaScript API, key and map ID.
- [Security guidance](https://developers.google.com/maps/api-security-best-practices): separate keys and restrictions.
- [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) and [place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id): place IDs may be retained; do not serialize provider details indiscriminately.
- [Routes transit](https://developers.google.com/maps/documentation/routes/transit-route): query consecutive legs, no intermediate transit waypoints; supported departure window is seven days past to 100 days future. Unknown fares remain unknown.
- [Compute routes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes): explicit field masks and departure timestamps.
- [Time Zone API](https://developers.google.com/maps/documentation/timezone/overview): coordinates and timestamp resolve local timezone. Ambiguous/nonexistent DST wall times must be rejected.

## Acceptance

Run typecheck, lint, test and build. Fixed provider responses cover IDs, migration, dates/DST, buffer, unknown route/fare, 429/timeout, stale preview and confirmation invalidation. Browser checks cover desktop/mobile, keyboard, apply/cancel/undo and save/restore. Live Google smoke is reported separately and never inferred from mocks. Each slice has a session log; UI checklist items are checked only after implementation and verification.

## 实施结果（2026-09-17）

合并提交为 `f889824`，日期校验回归修正为 `0dc7d9d`。双方历史保留；P3 独立提交。前端新增 `TripEditor` / `TripMap`，后端新增上述三个接口与可注入依赖的确定性编辑器。概览与宽编辑视图可切换；手机可使用上下移动按钮和时间表单。

Google 项目已有四个所需 API。已创建项目专用向量 Map ID 和独立浏览器 key；用户在确认时明确要求不设来源限制，因此实际配置保留无应用限制及控制台默认 Maps API 范围。所有 key 只保存在被 Git 忽略的本地环境文件。

### 本地运行

配置 `apps/web/.env.local` 中的 `MAPS_API_KEY`、`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`、`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`。使用 `NEXT_DIST_DIR=.next-dev pnpm --filter @trip/web dev` 可让开发服务与生产构建使用不同目录，避免并发构建破坏开发缓存。默认 `pnpm build` 仍使用 `.next`。

### 已验证及边界

- 真实搜索 Sydney Opera House、Sensō-ji、Ueno Park；地图、标记和地点详情正常。
- 真实步行路线约 29 分钟；重排将后续活动安排在 11:44（11:00 + 29 + 15），撤销重新核验并恢复 09:00 / 13:30。
- Google 供应商结果只存于当前页面内存，刷新后重新查询详情；路线通过 Verify day routes 按需重新核验。离线仍保留活动、时间与地点引用。
- 未匹配的旧活动保持可读；用户可先绑定地点作为待核验草稿，再验证路线。自动重排遇到未知路线阻止应用；手动时间和选点允许进入 review。
- 实际公共交通成功班次未做 live smoke；自动测试覆盖日期窗和未知票价。酒店/航班仍保持现有模拟契约，不产生预订。
- 新版编辑器使用真实当地时间；旧 specialist 的日期级路由契约保持兼容，并未重写其编排架构。

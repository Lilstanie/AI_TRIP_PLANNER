<a id="map-renderer-lifecycle"></a>

# 地图渲染器生命周期

`TripMap` 先清理标记、路线图层、观察器、动画帧和待执行回调，再销毁渲染器。
每个渲染器独占地图表面中一个铺满高度的子元素。Google 构造失败时先移除该子元素再回退；
地图卸载后，迟到的 SDK 响应不能创建地图。Google 授权订阅保留已有的宿主回调，
分发前快照监听器，最后一个所有者离开时恢复宿主回调。

回退状态属于当前挂载的地图。重新挂载时再次遵循配置的供应商，不缓存失败的 Trip 身份。
严格 Google 模式保留已保存地点并提供明确的重试操作，不会静默切换供应商。
OSM 禁用卫星控件。手机 Trip 首页地图固定为 340px 高，让渲染器能够填满有确定高度的容器。

<a id="browser-fixture"></a>

## 浏览器夹具

从仓库根目录执行，并清空真实凭据：

```bash
env -u BASE_URL LABEL=map-lifecycle-check \
  DEEPSEEK_API_KEY= MINIMAX_API_KEY= MAPS_API_KEY= \
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=fixture-only NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID= \
  SERPAPI_KEY= WEATHER_API_KEY= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= \
  DATABASE_URL= KV_REST_API_URL= KV_REST_API_TOKEN= \
  UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= \
  DATA_MODE=mock USE_MOCK_TOOLS=true E2E_SCRIPT_TIMEOUT_MS=420000 \
  pnpm --filter @trip/web e2e map-renderer-lifecycle --prod
```

现有 raw runner 管理隔离的生产构建和服务。Google SDK 使用本地浏览器夹具；MapLibre 是真实
渲染器，使用空的本地样式。浏览器外部 HTTP 请求均被拦截。合成浏览器密钥不是凭据。
场景涵盖 SDK、构造和授权失败、严格模式重试、Google 成功渲染、卸载后的延迟加载、
键盘打开标记详情，以及中英文界面下的 520/521 断点切换。

截图和断言保存在 `output/playwright/map-renderer-lifecycle/<LABEL>/`；runner 结果保存在
`output/e2e/runner/`。换标签重跑时保留红色证据。这些夹具不验证真实 Google 服务、
生产登录、物理设备或路线时长准确性。

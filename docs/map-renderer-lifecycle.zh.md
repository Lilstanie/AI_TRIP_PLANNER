<a id="map-renderer-lifecycle"></a>

# 地图渲染器生命周期

`TripMap` 先清理标记、路线图层、观察器、动画帧和待执行回调，再销毁渲染器。
每个渲染器独占地图表面中一个铺满高度的子元素。Google 构造失败时先移除该子元素再回退；
地图卸载后，迟到的 SDK 响应不能创建地图。Google 授权订阅保留已有的宿主回调，
分发前快照监听器，最后一个所有者离开时恢复宿主回调。模块级集合仅登记活动地图，
销毁后为空，不是失败 Trip 的缓存。Google 拒绝密钥后，SDK 的 `map.addListener` 返回 `undefined`；
渲染器不保留这样的句柄，因此销毁该地图不会抛错。被拒绝的地图也失去了容器，此时设置 `marker.map = null`
会抛错。`MapRuntime.removeMarker` 是摘除 marker 的唯一入口：Google 已拒绝密钥时它只移除元素，让失败处理
走完，回退地图才能挂载。

回退状态属于当前挂载的地图。重新挂载时再次遵循配置的供应商，不缓存失败的 Trip 身份。Google 每个页面只报告一次密钥被拒，因此 `google-maps-sdk.ts` 在页面内保留这一事实，之后的渲染器不再创建 Google 地图，直接挂载 OSM；严格 Google 模式下则显示地图不可用。
严格 Google 模式保留已保存地点并提供明确的重试操作，不会静默切换供应商。
OSM 禁用卫星控件。手机 Trip 首页地图固定为 340px 高，让渲染器能够填满有确定高度的容器。

<a id="browser-fixture"></a>

<a id="stop-hover"></a>

## 站点悬停

`lib/trip/stop-hover.ts` 保存当前悬停的活动 id。行程行和地图标记只在鼠标指针下写入它，`TripMap`
直接更新标记的类名，不触发 React 渲染。同一地点去两次时只有一个标记，属于第一站，所以后一站不会高亮标记。

<a id="browser-fixture"></a>

## 浏览器夹具

`trip-home-action-panels` 使用本地 Google SDK 夹具（`google-renderer-fixture.mjs`），验证操作面板在地图旁打开时保留同一个渲染器。它还在地图上有 marker 时像 Google 一样拒绝密钥，检查地图和 marker 都已移除且失败处理没有报错，并两次离开、重新打开 Trip home，不产生浏览器错误。SDK 和构造失败没有专门的浏览器脚本。该夹具不验证真实 Google 服务、生产登录、物理设备或路线时长准确性。

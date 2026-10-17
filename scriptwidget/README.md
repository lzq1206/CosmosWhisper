# ScriptWidget packages

- `exports/visible-sky.swt` — 可见天区版
- `exports/active-planisphere.swt` — 活动星盘版

可见天区版沿用网页首页投影，活动星盘版沿用网页 Watch 极轴投影；两者使用相应网页样式、配色与外圈。组件中的圆盘接近方形边缘，比例参考你提供的截图。它们按设备坐标与本地时间重新计算，不使用北京静态底图，也不向外发送定位；中心三针随尺寸缩放，秒针使用 ScriptWidget 原生时钟动画。

星盘与天体按 WidgetKit 刷新时重新计算。首次使用前，请在 ScriptWidget 中授权定位并刷新定位缓存。当地城市名优先使用设备提供的地名，缺失时从内置城市表匹配附近城市。

用 `npm run generate:scriptwidget` 重新生成。通过 iOS 分享菜单导入 `.swt` 文件并选择 ScriptWidget。

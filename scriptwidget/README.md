# ScriptWidget packages

- exports/visible-sky.swt — 可见天区版
- exports/active-planisphere.swt — 活动星盘版

星盘底图直接使用对应网页城市页面的截图。截图在网页画布加载后等待 5 秒，并每 15 分钟更新每个城市的可见天区和 Watch 星盘图片。小组件按设备定位选择最近城市，只额外绘制中央三针；指针以自定义时钟动画周期转动，秒针 60 秒一周、分针 1 小时一周、时针 12 小时一周，并指定本地时区和表盘中心锚点。底部时间使用 date 组件显示系统当前时间。底图不再外扩，横向小组件适配完整圆盘，确保圆环不越过边界。

导入时需要允许 ScriptWidget 访问定位和 raw.githubusercontent.com 网络图片。截图发布计划为每 15 分钟一次，WidgetKit 对组件本身的刷新由 ScriptWidget 和系统调度，不保证严格每 15 分钟显示刷新。

用 npm run generate:scriptwidget 重新生成两个项目目录和 SWT 文件。也可以把 projects/visible-sky 或 projects/active-planisphere 作为文件夹放进 ScriptWidget Scripts 目录。

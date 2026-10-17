# ScriptWidget packages

- exports/visible-sky.swt — 可见天区版
- exports/active-planisphere.swt — 活动星盘版

星盘底图直接使用对应网页城市页面的截图，按填充模式铺满小组件并外扩以覆盖系统内容边距。GitHub Actions 在页面画布加载后等待 5 秒，并每 15 分钟更新每个城市的可见天区和 Watch 星盘图片。小组件按设备定位选择最近城市，只额外绘制中央三针；指针使用 ScriptWidget 原生 clockHour、clockMinute、clockSecond 动画，并围绕表盘中心旋转。

导入时需要允许 ScriptWidget 访问定位和 raw.githubusercontent.com 网络图片。截图发布计划为每 15 分钟一次，WidgetKit 对组件本身的刷新由 ScriptWidget 和系统调度，不保证严格每 15 分钟显示刷新。

用 npm run generate:scriptwidget 重新生成两个项目目录和 SWT 文件。也可以把 projects/visible-sky 或 projects/active-planisphere 作为文件夹放进 ScriptWidget Scripts 目录。

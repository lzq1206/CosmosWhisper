# ScriptWidget packages

- exports/visible-sky.swt — 可见天区版
- exports/active-planisphere.swt — 活动星盘版

星盘底图来自对应网页城市页面的截图；网页画布加载后等待 5 秒，按设备像素导出适配大尺寸小组件的 1024×1090 高分辨率图片。GitHub Actions 每 3 小时检查未来 12 小时的 15 分钟时刻，只生成缺少的图片，并清理已过期图片。ScriptWidget 根据设备定位，在 12 个区域代表城市中选择最近城市；邻近省会共用该城市的截图，并按当前时间使用最近时刻的快照。小组件只显示星盘底图，不叠加指针或数字时间。小尺寸方形组件填满显示；中尺寸等比适配完整星盘。

导入时需要允许 ScriptWidget 访问定位和 raw.githubusercontent.com 网络图片。图片计划每 3 小时补齐未来 12 小时；WidgetKit 对小组件本身的刷新由 ScriptWidget 和系统调度。

用 npm run generate:scriptwidget 重新生成两个项目目录和 SWT 文件。也可以把 projects/visible-sky 或 projects/active-planisphere 作为文件夹放进 ScriptWidget Scripts 目录。

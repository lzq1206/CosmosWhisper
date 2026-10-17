# ScriptWidget packages

- exports/visible-sky.swt — 可见天区版
- exports/active-planisphere.swt — 活动星盘版

星盘底图直接使用对应网页城市页面的截图，按设备像素导出 1024×1024 高分辨率图片。大尺寸另生成适配竖向组件的扩展底图，通过增加同色背景铺满组件且不拉伸或裁切圆形星盘。截图在网页画布加载后等待 5 秒，并每 15 分钟更新每个城市的可见天区和 Watch 星盘图片。小组件按设备定位选择最近城市，只显示星盘底图，不叠加指针或数字时间。小尺寸方形组件填满显示；中尺寸等比适配完整星盘。

导入时需要允许 ScriptWidget 访问定位和 raw.githubusercontent.com 网络图片。截图发布计划为每 15 分钟一次，WidgetKit 对组件本身的刷新由 ScriptWidget 和系统调度，不保证严格每 15 分钟显示刷新。

用 npm run generate:scriptwidget 重新生成两个项目目录和 SWT 文件。也可以把 projects/visible-sky 或 projects/active-planisphere 作为文件夹放进 ScriptWidget Scripts 目录。

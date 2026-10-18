# CosmosWhisper · 活动星盘 · 北京

这是固定使用北京星图的版本。城市在网页下载时匹配或手动选择；组件运行时不再请求定位。

星图来自对应网页城市画布截图，截图在页面绘制完成 5 秒后生成，图像为适配大尺寸小组件比例的 1024×1090 底图。快照每 15 分钟一个时刻，由 GitHub Actions 每 3 小时补齐未来 12 小时。小组件读取最近时刻的图片，优先使用 GitHub Pages，失败时回退到 cosmos.rainywhisper.com。

小尺寸方形组件填满显示；大尺寸等比适配完整星盘。该包只显示星盘底图，不叠加指针或数字时间。ScriptWidget 只需要网络权限。

在 iCloud ScriptWidget Scripts 中使用文件夹形式时，可直接放入此项目目录；入口文件是 main.jsx，widget.json 是导入清单，不要把它当作脚本运行。

# CosmosWhisper · 可见天区

可见天区版以 CosmosWhisper 城市页面截图作为完整底图，按设备位置选择最近城市，并在表盘中心叠加按当前时间自转的时针、分针和扫秒秒针。

截图在网页画布加载后等待 5 秒再生成，GitHub Actions 每 15 分钟更新一次城市图片。底图不再使用负边距外扩；正方形小组件填满显示，横向小组件按完整星盘适配，避免圆环越界。三根指针使用 ScriptWidget 官方 clockSecond、clockMinute、clockHour 动画；底部以系统 date 组件显示当前时间。

小组件需要定位和网络权限。定位结果会匹配仓库内最近的城市页面；网络权限用于读取该城市的截图。系统实际刷新小组件的时间由 ScriptWidget 和 WidgetKit 管理。

导入文件：scriptwidget/exports/visible-sky.swt

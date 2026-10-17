# CosmosWhisper · 可见天区

可见天区版以 CosmosWhisper 城市页面截图作为完整底图，按设备位置选择最近城市，并在表盘中心叠加动态时针、分针和秒针。

截图在网页画布加载后等待 5 秒再生成，GitHub Actions 每 15 分钟更新一次城市图片。小组件只叠加三根以表盘中心为旋转轴的指针，秒针使用 ScriptWidget 的原生时钟动画。

小组件需要定位和网络权限。定位结果会匹配仓库内最近的城市页面；网络权限用于读取该城市的截图。系统实际刷新小组件的时间由 ScriptWidget 和 WidgetKit 管理。

导入文件：scriptwidget/exports/visible-sky.swt

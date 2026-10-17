# CosmosWhisper · 活动星盘

活动星盘版以 CosmosWhisper Watch 城市页面截图作为完整底图，并按设备位置选择最近城市。

截图在网页画布加载后等待 5 秒再生成，GitHub Actions 每 15 分钟更新一次城市图片。底图不再使用负边距外扩；正方形小组件填满显示，横向小组件按完整星盘适配，避免圆环越界。小组件只显示星盘底图，不叠加指针或数字时间。

小组件需要定位和网络权限。定位结果会匹配仓库内最近的城市页面；网络权限用于读取该城市的截图。系统实际刷新小组件的时间由 ScriptWidget 和 WidgetKit 管理。

导入文件：scriptwidget/exports/active-planisphere.swt

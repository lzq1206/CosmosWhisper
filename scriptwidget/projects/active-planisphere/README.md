# CosmosWhisper · 活动星盘

活动星盘版以 CosmosWhisper Watch 城市页面截图作为完整底图，并按设备位置选择最近城市。

截图在网页画布加载后等待 5 秒再生成，按设备像素导出 1024×1024 高分辨率底图，GitHub Actions 每 15 分钟更新一次城市图片。小尺寸方形组件填满显示；中、大尺寸使用等比适配，保留完整星盘且不裁切。小组件只显示星盘底图，不叠加指针或数字时间。

小组件需要定位和网络权限。定位结果会匹配仓库内最近的城市页面；网络权限用于读取该城市的截图。系统实际刷新小组件的时间由 ScriptWidget 和 WidgetKit 管理。

导入文件：scriptwidget/exports/active-planisphere.swt

# CosmosWhisper · 活动星盘

活动星盘版以 CosmosWhisper Watch 城市页面截图作为完整底图，并按设备位置选择最近城市。

网页画布加载后等待 5 秒再截图，生成适配大尺寸小组件比例的 1024×1090 高分辨率底图。GitHub Actions 每 3 小时检查未来 12 小时的 15 分钟时刻，只生成缺少的图片；小组件按当前时间选取最近时刻的快照。邻近省会共用 12 个区域代表城市的星图底图，并按设备位置选择最近的一座。小尺寸方形组件填满显示；中尺寸等比适配且保留完整星盘。小组件只显示星盘底图，不叠加指针或数字时间。

小组件需要定位和网络权限。定位结果会匹配仓库内最近的代表城市；网络权限用于读取该城市的截图。优先从 GitHub Pages 下载图片；失败时自动改用 cosmos.rainywhisper.com。系统实际刷新小组件的时间由 ScriptWidget 和 WidgetKit 管理。

导入文件：scriptwidget/exports/active-planisphere.swt

# CosmosWhisper · Apple Watch / Clockology

- `CosmosWhisper-Apple-Watch.clock2` 是 Clockology 原生表盘文件，采用二进制 plist 封装；星盘底图、时针、分针、秒针和轴心图都已嵌入。将文件保存到 iPhone 或 iCloud Drive 后，从“文件”分享并在 Clockology 中打开，再同步到 Apple Watch。
- `CosmosWhisper-Apple-Watch.ocs` 是 OpenClockStandard 交换格式的备份版本；Clockology 原生交付文件请使用上面的 `.clock2`。
- 运行 `python build_clock2.py` 可从 `.ocs` 内嵌的图片素材重新生成 `.clock2` 文件。
- 使用 Apple Watch 画布 199 × 242；圆盘贴近左右边缘，双外环收紧。刻度与日夜指示针都限制在各自环带内，为中心星盘留下更多面积。
- Clockology 底图中所有可见文字统一使用最小字号（4 px）；隐藏星座名称、星座分割线和连线，并移除 0h、6h、12h、18h、月照、无月及东北、西北、西南、东南文字。网页 watch 版的星座显示保持不变。
- 中央时针、分针、秒针是独立动态图层；指针纤细、长短有别，秒针设置为平滑扫动。北极中心仅保留指针轴心点，不绘制额外同心圈。星图和天象外圈本身为静态快照。
- `CosmosWhisper-Apple-Watch-preview.png` 是 10:10:30 的示意预览，不代表导入后的当前时间。

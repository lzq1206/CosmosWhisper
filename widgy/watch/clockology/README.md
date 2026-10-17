# CosmosWhisper · Apple Watch / Clockology

- `CosmosWhisper-Apple-Watch.ocs` 是自包含的 Clockology / OpenClockStandard 表盘文件，底图与指针 PNG 均已嵌入。将文件保存到 iPhone 后，可从文件分享菜单交给 Clockology 导入。
- Apple Watch 规格画布为 199 × 242。星图、文字、刻度和指针均按相同比例缩小并保持居中；外圈带宽已收窄。
- 仅保留基本方位；移除了 0h、6h、12h、18h、月照、无月及东北、西北、西南、东南文字。北极中心不叠加同心轴圈。
- 星图与天象外圈是网页 watch 版生成的静态底图；时、分、秒针为 Clockology 动态图层，秒针使用平滑扫动。
- `CosmosWhisper-Apple-Watch-preview.png` 是 10:10:30 的示意预览，不代表导入后的当前时间。

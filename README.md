CosmosWhisper
=============

一个在浏览器本地运行的全屏天空观测盘。页面只保留星图本身：星点、星座线、银河、黄道、天球坐标网格、地平线方位与时间/晨昏环都在同一张 Canvas 上绘制。

## 运行

仓库不需要构建工具或依赖安装。由于浏览器会限制从 `file://` 加载 ES module，请在仓库根目录启动任意静态 HTTP server：

```bash
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

## 观测参数

- 页面使用当前设备时间，每秒更新单一外圈状态环和 `|` 形时间指针；同一环按标准显示标准晨昏（−0.833°）、民用（−6°）、航海（−12°）和天文（−18°）晨昏区间，以及白昼/月照夜/无月夜，没有中心时针或额外面板。
- 首次打开会以低精度请求浏览器定位；成功后坐标四舍五入到 0.1°，只保存在本机 `localStorage`，不会上传服务器。
- 定位被拒绝或不可用时使用默认地平线，页面仍然可以正常观测。
- 在星图上点击恒星可选中；滚轮或 `+` / `-` 只改变缩放，不改变真实方位，N/E/S/W 始终固定。`S/C/B/M/E/G/L` 切换对应图层，`P` 重新请求位置，`R` 重置视野。

## 图层

星点覆盖离线星表中视星等 `≤ 5.0` 的恒星（约 1,627 颗），大小按亮度映射，亮星带有柔和光晕。页面使用完整 88 个 IAU 星座的标准分界、每个星座独立的连线、连续银河带、太阳/月亮和七颗可见行星、黄道、赤道/赤纬网格、地平线方位和状态时间环。地球是观测者参考，不在天空中绘制。

星图不支持直接拖动旋转：天体位置由观测时间与地点重新计算，避免人为转动表盘导致方向错误。太阳系天体为界面级低精度位置，地球只作为观测参考，不在天空中绘制。标准数据来源与转换说明见 [`src/data/SOURCES.md`](src/data/SOURCES.md)。

## Widgy 城市索引

全国省会、直辖市、港澳台和主要城市索引：

```text
https://lzq1206.github.io/CosmosWhisper/widgy/
```

城市链接会打开同一套自适应方形星盘，并按 URL 城市参数切换坐标。

## Widgy 北京预设

推荐直接使用 Widgy 专用的自适应方形网页地址：

```text
https://lzq1206.github.io/CosmosWhisper/widgy/beijing.html
```

在 Widgy 的 Web URL、网页截图或 JavaScript 图层中使用这个地址。页面会强制使用北京坐标，方形尺寸自动取视口短边，并从左上角开始绘制，避免固定 1600 页面只显示左上角。

另外也保留 [`widgy/cosmoswhisper-beijing.widgy.json`](widgy/cosmoswhisper-beijing.widgy.json) 导入文件。Widgy 中选择 **Import Widget → Import JSON** 时，需要粘贴完整 JSON 内容，而不是只粘贴文件网址。

RSS 图片接入地址：

```text
https://lzq1206.github.io/CosmosWhisper/widgy/beijing.xml
```

固定 PNG 地址：

```text
https://lzq1206.github.io/CosmosWhisper/widgy/beijing-sky.png
```

GitHub Actions 每 30 分钟生成一次北京 PNG/RSS；实际刷新还会受 Actions 排队、Pages/CDN 缓存和 Widgy/iOS 调度影响，不保证精确到点。

## GitHub Pages

`.github/workflows/pages.yml` 会在 `main` 分支推送后使用 GitHub Pages Actions 发布根目录静态文件。首次使用时，在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。

预期地址：`https://lzq1206.github.io/CosmosWhisper/`

## License

界面代码以 MIT License 发布；星名与数据来源说明见 [`src/data/SOURCES.md`](src/data/SOURCES.md)。

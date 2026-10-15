CosmosWhisper
=============

一个在浏览器本地运行的全屏天空观测盘。页面只保留星图本身：星点、星座线、银河、黄道、天球坐标网格、地平线方位与恒星时针都在同一张 Canvas 上绘制。

## 运行

仓库不需要构建工具或依赖安装。由于浏览器会限制从 `file://` 加载 ES module，请在仓库根目录启动任意静态 HTTP server：

```bash
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

## 观测参数

- 页面使用当前设备时间，每秒更新恒星时；没有额外的面板或控件。
- 首次打开会以低精度请求浏览器定位；成功后坐标四舍五入到 0.1°，只保存在本机 `localStorage`，不会上传服务器。
- 定位被拒绝或不可用时使用默认地平线，页面仍然可以正常观测。
- 在星图上拖动可旋转视野，滚轮或 `+` / `-` 可缩放；`S/C/B/M/E/G/L` 切换对应图层，`P` 重新请求位置，`R` 重置视野。

## 图层

星点的大小按近似视星等映射，亮星带有柔和光晕。页面同时绘制星座连线、简化星座边界、银河光带、黄道、赤道/赤纬网格、地平线方位和恒星时针。

坐标与亮星数据是用于教育和观测入门的离线近似值，不是导航或精密天文软件。详情见 [`src/data/SOURCES.md`](src/data/SOURCES.md)。

## GitHub Pages

`.github/workflows/pages.yml` 会在 `main` 分支推送后使用 GitHub Pages Actions 发布根目录静态文件。首次使用时，在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。

预期地址：`https://lzq1206.github.io/CosmosWhisper/`

## License

界面代码以 MIT License 发布；星名与数据来源说明见 [`src/data/SOURCES.md`](src/data/SOURCES.md)。

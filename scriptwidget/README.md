# ScriptWidget packages

下载文件按 `visible-sky-{city}.swt`、`active-planisphere-{city}.swt` 命名。首页可请求浏览器定位并匹配最近的区域代表城市，也可以手动选择；浏览器不允许定位时默认北京。

组件不再请求定位，避免把定位延迟挤进 ScriptWidget 的 5 秒运行限制。每个下载包的城市已固定；运行时只检查 GitHub Pages 和备用站点上的图片。两次图片检查各最多等待 2 秒。

每天的快照按 15 分钟间隔滚动生成，GitHub Actions 每 3 小时检查并补齐未来 12 小时的缺图；网页版截图在页面绘制完成 5 秒后采集。优先读取 GitHub Pages，失败时回退 cosmos.rainywhisper.com。

文件夹形式的北京版：`projects/visible-sky` 和 `projects/active-planisphere`。复制这两个项目文件夹到 ScriptWidget 的 Scripts 目录即可；脚本入口是 `main.jsx`，不要直接运行 `widget.json`。

# 离线数据说明

CosmosWhisper 将公开星图数据在构建阶段转换为静态 ES modules；GitHub Pages 运行时不访问 CDN、API 或其他远程服务。

## 恒星

- 上游项目：[`ofrohn/d3-celestial`](https://github.com/ofrohn/d3-celestial)，BSD-3-Clause；项目版本快照：`master`，commit `7e720a3de062059d4c5400a379146a601d9010e0`。
- 输入文件：[`data/stars.6.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json)，文件 SHA `e427a4dfd5e59dabfa6428944064d988eaae30f4`；[`data/starnames.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.json)，文件 SHA `4aab1cab22ef3fc519a97120cfd0cbeace60d34b`；[`data/starnames.cn.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.cn.json)，文件 SHA `037aed36e58fc1ebc24462fe75e3c07400fb2685`。
- `stars.6.json` 中筛选视星等 `mag <= 5.0`，得到约 1,627 颗恒星；坐标由 GeoJSON 赤经度转换为赤经小时，保留赤纬和 B−V 色指数。运行时再进行 J2000 岁差与地平坐标转换。
- 转换脚本：[`scripts/generate-celestial-data.mjs`](../../scripts/generate-celestial-data.mjs)。

## 星座

- 输入文件：[`data/constellations.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json)，文件 SHA `632b8accc471d0220041273c4ab1c668a9fb4ce9`；[`data/constellations.bounds.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.bounds.json)，文件 SHA `bf72662e5e36f2b5c209aac114004ad731dea671`；[`data/constellations.lines.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json)，文件 SHA `ce64cf3c18b627f4d9749b9076cd4693b777697e`。
- 标准目录、边界和连线合并为 88 个唯一 IAU 缩写；巨蛇座在上游以两个边界记录出现，转换为同一星座记录下的多个 `boundaryParts`。
- 边界和连线输入为 GeoJSON 赤经度/赤纬度，转换为本项目使用的赤经小时/赤纬度。边界来源是 IAU 星座分区数据；连线是 d3-celestial 的独立星座图形，不把连线误当作 IAU 边界。

## 银河

- 输入文件：[`data/mw.json`](https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/mw.json)，文件 SHA `ce06eaa01d80a4eed149c538d2d162c919b58a84`，来自同一 BSD-3-Clause 项目快照。
- 数据由 Jose R. Vieira 的银河轮廓目录提供五档 MultiPolygon；本项目取 `ol1` 的外环，按 RA=0/24 周期展开后转换为赤经小时/赤纬，作为一条连续视觉包络填充，不把五档中心线串联，也不保留内部暗云孔洞。它是连续视觉带，不是精密银河边界测量。
- 银河带在 Canvas 内统一填充为白色半透明面，地平线外部分通过圆形裁剪隐藏。

## 太阳系天体

- 行星轨道采用 Paul Schlyter 的低精度公开计算方法（[Planetary positions](https://stjarnhimlen.se/comp/ppcomp.html)）和其公开的轨道根数形式；太阳/月亮位置用于界面级方位、月相和夜间照明判断，不用于望远镜指向。
- 地球只作为地心观测参考，不绘制为天空中的行星；画面绘制太阳、月亮和水星至海王星的地平坐标。行星位置会随日期/地点更新，近地月球模型未加入完整视差、章动和摄动修正。

## 限制

这些数据用于教育、界面可视化和裸眼观测方向提示，不是天文导航或精密望远镜指向数据。当前计算未加入光行差、章动和大气折射修正；恒星时、岁差和地平坐标仍按离线近似实现。

代码使用本仓库的 MIT License；上游数据的 BSD-3-Clause 归属与许可不因代码许可证改变。

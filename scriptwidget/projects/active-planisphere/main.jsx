/**
 * CosmosWhisper · 网页 Watch 风格 ScriptWidget 星盘
 *
 * 严格遵循 everettjf/ScriptWidget (Package 2.0 / JSX -> SwiftUI) 规范：
 * - 零外部网络依赖：星盘按设备当前位置和本地时间实时历算。
 * - 星图布局与配色直接沿用 CosmosWhisper 网页 Watch 的当地天空投影。
 * - 星盘尺寸按方形小组件布局，边缘包含节气圈和日照/昏影时间圈。
 * - 全面适配 systemSmall / systemMedium / systemLarge 以及锁屏/手表复杂功能 (accessoryCircular / accessoryRectangular / accessoryInline)。
 */

// ==================== 1. 基础天文常数与工具 ====================
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const TAU = Math.PI * 2;
const PACKAGE_KIND = "active-planisphere";
const WATCH_ROTATION = 90 * DEG;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function mod(v, m) {
  return ((v % m) + m) % m;
}

function pad2(n) {
  return String(Math.floor(n)).padStart(2, "0");
}

// ScriptWidget 主 App 授权并缓存当前位置；WidgetKit 扩展只读取缓存坐标。
async function getCurrentLocation() {
  try {
    if (typeof $location === "undefined" || !$location.isAvailable()) return null;
    const status = $location.authorizationStatus();
    let authorized = status === "authorizedWhenInUse" || status === "authorizedAlways";
    if (!authorized) authorized = await $location.requestAuthorization({ timeout: 10 });
    if (!authorized) return null;
    const value = await $location.current({
      timeout: 10,
      maxAge: 86400,
      accuracy: "reduced",
      purposeKey: "ScriptWidgetLocation"
    });
    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return null;
    return value;
  } catch (error) {
    return null;
  }
}

const currentLocation = await getCurrentLocation();
const CITY = currentLocation
  ? {
      name: currentLocation.locality || currentLocation.city || currentLocation.name || "",
      enName: "LOCAL",
      lat: currentLocation.latitude,
      lon: currentLocation.longitude
    }
  : null;

if (!CITY) {
  $render(
    <vstack frame="max" background="#030817" alignment="center" spacing="6" padding="16">
      <icon systemName="location.slash" size="24" color="#f5d68c" />
      <text font="headline" color="#f5f0df">需要当前位置</text>
      <text font="caption" color="#9ba9bf">请在 ScriptWidget 主 App 中授权定位，然后刷新小组件。</text>
    </vstack>
  );
} else {

// ==================== 2. 二十四节气表 ====================
const SOLAR_TERMS = [
  { lon: 0, name: "春分" }, { lon: 15, name: "清明" }, { lon: 30, name: "谷雨" }, { lon: 45, name: "立夏" },
  { lon: 60, name: "小满" }, { lon: 75, name: "芒种" }, { lon: 90, name: "夏至" }, { lon: 105, name: "小暑" },
  { lon: 120, name: "大暑" }, { lon: 135, name: "立秋" }, { lon: 150, name: "处暑" }, { lon: 165, name: "白露" },
  { lon: 180, name: "秋分" }, { lon: 195, name: "寒露" }, { lon: 210, name: "霜降" }, { lon: 225, name: "立冬" },
  { lon: 240, name: "小雪" }, { lon: 255, name: "大雪" }, { lon: 270, name: "冬至" }, { lon: 285, name: "小寒" },
  { lon: 300, name: "大寒" }, { lon: 315, name: "立春" }, { lon: 330, name: "雨水" }, { lon: 345, name: "惊蛰" }
];

// Star, constellation and galaxy geometry is bundled from the website's source data.
const STARS = [{"ra":6.7525,"dec":-16.7161,"magnitude":-1.44,"name":"天狼","tone":"blue"},{"ra":6.3992,"dec":-52.6957,"magnitude":-0.62,"name":"老人","tone":"blue"},{"ra":14.261,"dec":19.1824,"magnitude":-0.05,"name":"大角","tone":"warm"},{"ra":14.6601,"dec":-60.834,"magnitude":-0.01,"name":"南门二","tone":"white"},{"ra":18.6156,"dec":38.7837,"magnitude":0.03,"name":"织女","tone":"blue"},{"ra":5.2782,"dec":45.998,"magnitude":0.08,"name":"五车二","tone":"white"},{"ra":5.2423,"dec":-8.2016,"magnitude":0.18,"name":"参宿七","tone":"blue"},{"ra":7.655,"dec":5.225,"magnitude":0.4,"name":"南河三","tone":"white"},{"ra":1.6286,"dec":-57.2368,"magnitude":0.45,"name":"水委一","tone":"blue"},{"ra":5.9195,"dec":7.4071,"magnitude":0.45,"name":"参宿四","tone":"warm"},{"ra":14.0637,"dec":-60.373,"magnitude":0.61,"name":"马腹一","tone":"blue"},{"ra":19.8464,"dec":8.8683,"magnitude":0.76,"name":"牛郎","tone":"white"},{"ra":12.4433,"dec":-63.0991,"magnitude":0.77,"name":"十字架二","tone":"blue"},{"ra":4.5987,"dec":16.5093,"magnitude":0.87,"name":"毕宿五","tone":"warm"},{"ra":13.4199,"dec":-11.1613,"magnitude":0.98,"name":"角宿一","tone":"blue"},{"ra":16.4901,"dec":-26.432,"magnitude":1.06,"name":"大火","tone":"warm"},{"ra":7.7553,"dec":28.0262,"magnitude":1.16,"name":"北河三","tone":"white"},{"ra":22.9608,"dec":-29.6222,"magnitude":1.17,"name":"北落师门","tone":"blue"},{"ra":12.7954,"dec":-59.6888,"magnitude":1.25,"name":"十字架三","tone":"blue"},{"ra":20.6905,"dec":45.2803,"magnitude":1.25,"name":"天津四","tone":"blue"},{"ra":14.6597,"dec":-60.8372,"magnitude":1.35,"name":"Toliman","tone":"white"},{"ra":10.1395,"dec":11.9672,"magnitude":1.36,"name":"轩辕十四","tone":"blue"},{"ra":6.9771,"dec":-28.9721,"magnitude":1.5,"name":"弧矢七","tone":"blue"},{"ra":7.5766,"dec":31.8883,"magnitude":1.58,"name":"北河二","tone":"blue"},{"ra":12.5194,"dec":-57.1132,"magnitude":1.59,"name":"十字架一","tone":"warm"},{"ra":17.5601,"dec":-37.1038,"magnitude":1.62,"name":"尾宿八","tone":"blue"},{"ra":5.4189,"dec":6.3497,"magnitude":1.64,"name":"参宿五","tone":"blue"},{"ra":5.4382,"dec":28.6075,"magnitude":1.65,"name":"五车五","tone":"blue"},{"ra":9.22,"dec":-69.7172,"magnitude":1.67,"name":"南船五","tone":"blue"},{"ra":5.6036,"dec":-1.2019,"magnitude":1.69,"name":"参宿二","tone":"blue"},{"ra":22.1372,"dec":-46.961,"magnitude":1.73,"name":"鹤一","tone":"blue"},{"ra":5.6793,"dec":-1.9426,"magnitude":1.74,"name":"参宿一","tone":"blue"},{"ra":8.1589,"dec":-47.3366,"magnitude":1.75,"name":"天社一","tone":"blue"},{"ra":12.9005,"dec":55.9598,"magnitude":1.76,"name":"玉衡","tone":"blue"},{"ra":3.4054,"dec":49.8612,"magnitude":1.79,"name":"天船三","tone":"white"},{"ra":18.4029,"dec":-34.3846,"magnitude":1.79,"name":"箕宿三","tone":"blue"},{"ra":11.0621,"dec":61.751,"magnitude":1.81,"name":"天枢","tone":"white"},{"ra":7.1399,"dec":-26.3932,"magnitude":1.83,"name":"弧矢一","tone":"white"},{"ra":13.7923,"dec":49.3133,"magnitude":1.85,"name":"摇光","tone":"blue"},{"ra":8.3752,"dec":-59.5095,"magnitude":1.86,"name":"海石一","tone":"warm"},{"ra":17.622,"dec":-42.9978,"magnitude":1.86,"name":"尾宿五","tone":"white"},{"ra":5.9921,"dec":44.9474,"magnitude":1.9,"name":"五车三","tone":"blue"},{"ra":16.8111,"dec":-69.0277,"magnitude":1.91,"name":"三角形三","tone":"warm"},{"ra":6.6285,"dec":16.3993,"magnitude":1.93,"name":"井宿三","tone":"blue"},{"ra":8.7451,"dec":-54.7088,"magnitude":1.93,"name":"天社三","tone":"blue"},{"ra":20.4275,"dec":-56.7351,"magnitude":1.94,"name":"孔雀十一","tone":"blue"},{"ra":2.5303,"dec":89.2641,"magnitude":1.97,"name":"北极星","tone":"white"},{"ra":6.3783,"dec":-17.9559,"magnitude":1.98,"name":"军市一","tone":"blue"},{"ra":9.4598,"dec":-8.6586,"magnitude":1.99,"name":"星宿一","tone":"warm"},{"ra":2.1196,"dec":23.4624,"magnitude":2.01,"name":"娄宿三","tone":"warm"},{"ra":10.3329,"dec":19.8415,"magnitude":2.01,"name":"轩辕十二","tone":"white"},{"ra":0.7265,"dec":-17.9866,"magnitude":2.04,"name":"土司空","tone":"white"},{"ra":18.9211,"dec":-26.2967,"magnitude":2.05,"name":"斗宿四","tone":"blue"},{"ra":14.1114,"dec":-36.37,"magnitude":2.06,"name":"库楼三","tone":"white"},{"ra":0.1398,"dec":29.0904,"magnitude":2.07,"name":"壁宿二","tone":"blue"},{"ra":1.1622,"dec":35.6206,"magnitude":2.07,"name":"奎宿九","tone":"warm"},{"ra":5.7959,"dec":-9.6696,"magnitude":2.07,"name":"参宿六","tone":"blue"},{"ra":14.8451,"dec":74.1555,"magnitude":2.07,"name":"帝","tone":"warm"},{"ra":22.7111,"dec":-46.8846,"magnitude":2.07,"name":"鹤二","tone":"warm"},{"ra":17.5822,"dec":12.56,"magnitude":2.08,"name":"候","tone":"blue"},{"ra":3.1361,"dec":40.9556,"magnitude":2.09,"name":"大陵五","tone":"blue"},{"ra":2.065,"dec":42.3297,"magnitude":2.1,"name":"天大将军一","tone":"warm"},{"ra":11.8177,"dec":14.5721,"magnitude":2.14,"name":"五帝座一","tone":"blue"},{"ra":0.9451,"dec":60.7167,"magnitude":2.15,"name":"策","tone":"blue"},{"ra":12.692,"dec":-48.9599,"magnitude":2.2,"name":"库楼七","tone":"blue"},{"ra":8.0597,"dec":-40.0031,"magnitude":2.21,"name":"弧矢增廿二","tone":"blue"},{"ra":9.2848,"dec":-59.2752,"magnitude":2.21,"name":"海石二","tone":"blue"},{"ra":15.5781,"dec":26.7147,"magnitude":2.22,"name":"贯索四","tone":"blue"},{"ra":9.1333,"dec":-43.4326,"magnitude":2.23,"name":"天记","tone":"warm"},{"ra":13.3988,"dec":54.9254,"magnitude":2.23,"name":"开阳","tone":"blue"},{"ra":20.3705,"dec":40.2567,"magnitude":2.23,"name":"天津一","tone":"white"},{"ra":0.6751,"dec":56.5373,"magnitude":2.24,"name":"王良四","tone":"warm"},{"ra":17.9434,"dec":51.4889,"magnitude":2.24,"name":"天棓四","tone":"warm"},{"ra":5.5334,"dec":-0.2991,"magnitude":2.25,"name":"参宿三","tone":"blue"},{"ra":0.153,"dec":59.1498,"magnitude":2.28,"name":"王良一","tone":"white"},{"ra":13.6648,"dec":-53.4664,"magnitude":2.29,"name":"南门一","tone":"blue"},{"ra":16.0056,"dec":-22.6217,"magnitude":2.29,"name":"房宿三","tone":"blue"},{"ra":16.8361,"dec":-34.2932,"magnitude":2.29,"name":"尾宿二","tone":"white"},{"ra":14.6988,"dec":-47.3882,"magnitude":2.3,"name":"骑官十","tone":"blue"},{"ra":14.5918,"dec":-42.1578,"magnitude":2.33,"name":"库楼二","tone":"blue"},{"ra":11.0307,"dec":56.3824,"magnitude":2.34,"name":"天璇","tone":"blue"},{"ra":14.7498,"dec":27.0742,"magnitude":2.35,"name":"梗河一","tone":"white"},{"ra":21.7364,"dec":9.875,"magnitude":2.38,"name":"危宿三","tone":"warm"},{"ra":17.7081,"dec":-39.03,"magnitude":2.39,"name":"尾宿七","tone":"blue"},{"ra":0.4381,"dec":-42.306,"magnitude":2.4,"name":"火鸟六","tone":"white"},{"ra":11.8972,"dec":53.6948,"magnitude":2.41,"name":"天玑","tone":"blue"},{"ra":17.173,"dec":-15.7249,"magnitude":2.43,"name":"宋","tone":"blue"},{"ra":23.0629,"dec":28.0828,"magnitude":2.44,"name":"室宿二","tone":"warm"},{"ra":7.4016,"dec":-29.3031,"magnitude":2.45,"name":"弧矢二","tone":"blue"},{"ra":21.3097,"dec":62.5856,"magnitude":2.45,"name":"天钩五","tone":"white"},{"ra":9.3686,"dec":-55.0107,"magnitude":2.47,"name":"天社五","tone":"blue"},{"ra":20.7702,"dec":33.9703,"magnitude":2.48,"name":"天津九","tone":"white"},{"ra":23.0793,"dec":15.2053,"magnitude":2.49,"name":"室宿一","tone":"blue"},{"ra":3.038,"dec":4.0897,"magnitude":2.54,"name":"天囷一","tone":"warm"},{"ra":16.6193,"dec":-10.5671,"magnitude":2.54,"name":"韩","tone":"blue"},{"ra":13.9257,"dec":-47.2884,"magnitude":2.55,"name":"库楼一","tone":"blue"},{"ra":11.2351,"dec":20.5237,"magnitude":2.56,"name":"西上相","tone":"blue"},{"ra":16.0906,"dec":-19.8055,"magnitude":2.56,"name":"房宿四","tone":"blue"},{"ra":5.5455,"dec":-17.8223,"magnitude":2.58,"name":"厕一","tone":"white"},{"ra":12.1393,"dec":-50.7224,"magnitude":2.58,"name":"马尾三","tone":"blue"},{"ra":12.2634,"dec":-17.5419,"magnitude":2.58,"name":"轸宿一","tone":"blue"},{"ra":19.0435,"dec":-29.8801,"magnitude":2.6,"name":"斗宿六","tone":"blue"},{"ra":15.2834,"dec":-9.3829,"magnitude":2.61,"name":"氐宿四","tone":"blue"},{"ra":15.7378,"dec":6.4256,"magnitude":2.63,"name":"蜀","tone":"warm"},{"ra":1.9107,"dec":20.808,"magnitude":2.64,"name":"娄宿一","tone":"blue"},{"ra":5.6608,"dec":-34.0741,"magnitude":2.65,"name":"丈人一","tone":"blue"},{"ra":5.9954,"dec":37.2126,"magnitude":2.65,"name":"五车四","tone":"blue"},{"ra":12.5731,"dec":-23.3968,"magnitude":2.65,"name":"轸宿四","tone":"white"},{"ra":1.4303,"dec":60.2353,"magnitude":2.66,"name":"阁道三","tone":"blue"},{"ra":13.9114,"dec":18.3977,"magnitude":2.68,"name":"右摄提一","tone":"white"},{"ra":14.9755,"dec":-43.134,"magnitude":2.68,"name":"骑官四","tone":"blue"},{"ra":4.9499,"dec":33.1661,"magnitude":2.69,"name":"五车一","tone":"warm"},{"ra":10.7795,"dec":-49.4203,"magnitude":2.69,"name":"海山增二","tone":"white"},{"ra":12.6197,"dec":-69.1356,"magnitude":2.69,"name":"蜜蜂三","tone":"blue"},{"ra":17.5127,"dec":-37.2958,"magnitude":2.7,"name":"尾宿九","tone":"blue"},{"ra":7.2857,"dec":-37.0975,"magnitude":2.71,"name":"弧矢九","tone":"warm"},{"ra":18.3499,"dec":-29.8281,"magnitude":2.72,"name":"箕宿二","tone":"warm"},{"ra":19.771,"dec":10.6133,"magnitude":2.72,"name":"河鼓三","tone":"warm"},{"ra":16.2391,"dec":-3.6943,"magnitude":2.73,"name":"梁","tone":"warm"},{"ra":16.3999,"dec":61.5142,"magnitude":2.73,"name":"少宰","tone":"white"},{"ra":10.7159,"dec":-64.3945,"magnitude":2.74,"name":"南船三","tone":"blue"},{"ra":12.6943,"dec":-1.4494,"magnitude":2.74,"name":"东上相","tone":"white"},{"ra":5.5906,"dec":-5.9099,"magnitude":2.75,"name":"伐三","tone":"blue"},{"ra":13.3433,"dec":-36.7123,"magnitude":2.75,"name":"柱十一[角宿]","tone":"blue"},{"ra":14.848,"dec":-16.0418,"magnitude":2.75,"name":"氐宿一","tone":"blue"},{"ra":17.7245,"dec":4.5673,"magnitude":2.76,"name":"宗正一","tone":"warm"},{"ra":5.1308,"dec":-5.0864,"magnitude":2.78,"name":"玉井三","tone":"blue"},{"ra":16.5037,"dec":21.4896,"magnitude":2.78,"name":"河中","tone":"white"},{"ra":17.2441,"dec":14.3903,"magnitude":2.78,"name":"帝座","tone":"warm"},{"ra":12.2524,"dec":-58.7489,"magnitude":2.79,"name":"十字架四","tone":"blue"},{"ra":17.5072,"dec":52.3014,"magnitude":2.79,"name":"天棓三","tone":"white"},{"ra":15.5857,"dec":-41.1668,"magnitude":2.8,"name":"骑官一","tone":"blue"},{"ra":5.4708,"dec":-20.7594,"magnitude":2.81,"name":"厕二","tone":"white"},{"ra":16.6881,"dec":31.6027,"magnitude":2.81,"name":"天纪二","tone":"white"},{"ra":0.4292,"dec":-77.2542,"magnitude":2.82,"name":"蛇尾一","tone":"white"},{"ra":16.598,"dec":-28.216,"magnitude":2.82,"name":"心宿三","tone":"blue"},{"ra":18.4662,"dec":-25.4217,"magnitude":2.82,"name":"斗宿二","tone":"white"},{"ra":0.2206,"dec":15.1836,"magnitude":2.83,"name":"壁宿一","tone":"blue"},{"ra":8.1257,"dec":-24.3043,"magnitude":2.83,"name":"弧矢增卅二","tone":"white"},{"ra":15.919,"dec":-63.4307,"magnitude":2.83,"name":"三角形二","tone":"white"},{"ra":3.9022,"dec":31.8836,"magnitude":2.84,"name":"卷舌四","tone":"white"},{"ra":17.4217,"dec":-55.5299,"magnitude":2.84,"name":"杵三[箕宿]","tone":"warm"},{"ra":17.5307,"dec":-49.8761,"magnitude":2.84,"name":"杵二[箕宿]","tone":"blue"},{"ra":3.7914,"dec":24.1051,"magnitude":2.85,"name":"昴宿六","tone":"blue"},{"ra":13.0363,"dec":10.9592,"magnitude":2.85,"name":"东次将","tone":"white"},{"ra":21.784,"dec":-16.1273,"magnitude":2.85,"name":"垒壁阵四","tone":"blue"},{"ra":1.9795,"dec":-61.5699,"magnitude":2.86,"name":"蛇首一","tone":"white"},{"ra":19.7496,"dec":45.1308,"magnitude":2.86,"name":"天津二","tone":"blue"},{"ra":6.3827,"dec":22.5136,"magnitude":2.87,"name":"井宿一","tone":"warm"},{"ra":15.3152,"dec":-68.6795,"magnitude":2.87,"name":"三角形一","tone":"blue"},{"ra":22.3084,"dec":-60.2596,"magnitude":2.87,"name":"鸟喙一","tone":"warm"},{"ra":2.971,"dec":-40.3047,"magnitude":2.88,"name":"天园六","tone":"blue"},{"ra":19.1627,"dec":-21.0236,"magnitude":2.88,"name":"建三","tone":"white"},{"ra":7.4525,"dec":8.2893,"magnitude":2.89,"name":"南河二","tone":"blue"},{"ra":12.9338,"dec":38.3184,"magnitude":2.89,"name":"常陈一","tone":"blue"},{"ra":15.9809,"dec":-26.1141,"magnitude":2.89,"name":"房宿一","tone":"blue"},{"ra":3.9642,"dec":40.0102,"magnitude":2.9,"name":"卷舌二","tone":"blue"},{"ra":16.3531,"dec":-25.5928,"magnitude":2.9,"name":"心宿一","tone":"white"},{"ra":21.526,"dec":-5.5712,"magnitude":2.9,"name":"虚宿一","tone":"white"},{"ra":3.0799,"dec":53.5064,"magnitude":2.91,"name":"天船二","tone":"white"},{"ra":9.785,"dec":-65.072,"magnitude":2.92,"name":"海石五","tone":"white"},{"ra":22.7167,"dec":30.2212,"magnitude":2.93,"name":"离宫四","tone":"white"},{"ra":6.8323,"dec":-50.6146,"magnitude":2.94,"name":"老人增一","tone":"warm"},{"ra":12.4977,"dec":-16.5154,"magnitude":2.94,"name":"轸宿三","tone":"blue"},{"ra":22.0964,"dec":-0.3199,"magnitude":2.95,"name":"危宿一","tone":"white"},{"ra":3.9672,"dec":-13.5085,"magnitude":2.97,"name":"天苑一","tone":"warm"},{"ra":5.6274,"dec":21.1425,"magnitude":2.97,"name":"天关","tone":"blue"},{"ra":9.7642,"dec":23.7743,"magnitude":2.97,"name":"轩辕九","tone":"white"},{"ra":18.0968,"dec":-30.4241,"magnitude":2.98,"name":"箕宿一","tone":"white"},{"ra":13.3154,"dec":-23.1715,"magnitude":2.99,"name":"平一","tone":"white"},{"ra":17.7931,"dec":-40.127,"magnitude":2.99,"name":"尾宿六","tone":"white"},{"ra":19.0902,"dec":13.8635,"magnitude":2.99,"name":"吴越","tone":"blue"},{"ra":2.1591,"dec":34.9873,"magnitude":3,"name":"天大将军九","tone":"blue"},{"ra":11.1611,"dec":44.4985,"magnitude":3,"name":"太尊","tone":"white"},{"ra":15.3455,"dec":71.834,"magnitude":3,"name":"太子","tone":"blue"},{"ra":16.8645,"dec":-38.0474,"magnitude":3,"name":"尾宿一","tone":"blue"},{"ra":21.8988,"dec":-37.3649,"magnitude":3,"name":"败臼一","tone":"blue"},{"ra":3.7154,"dec":47.7876,"magnitude":3.01,"name":"天船五","tone":"blue"},{"ra":6.3386,"dec":-30.0634,"magnitude":3.02,"name":"孙增一","tone":"blue"},{"ra":7.0504,"dec":-23.8333,"magnitude":3.02,"name":"军市增五","tone":"blue"},{"ra":12.1687,"dec":-22.6198,"magnitude":3.02,"name":"轸宿二","tone":"warm"},{"ra":5.0328,"dec":43.8233,"magnitude":3.03,"name":"柱一[毕宿]","tone":"white"},{"ra":12.7713,"dec":-68.1081,"magnitude":3.04,"name":"蜜蜂一","tone":"blue"},{"ra":14.5346,"dec":38.3083,"magnitude":3.04,"name":"招摇","tone":"blue"},{"ra":19.512,"dec":27.9597,"magnitude":3.05,"name":"辇道增七","tone":"white"},{"ra":20.3502,"dec":-14.7814,"magnitude":3.05,"name":"牛宿一","tone":"white"},{"ra":6.7322,"dec":25.1311,"magnitude":3.06,"name":"井宿五","tone":"warm"},{"ra":10.3722,"dec":41.4995,"magnitude":3.06,"name":"中台二","tone":"warm"},{"ra":19.2093,"dec":67.6615,"magnitude":3.07,"name":"天厨一","tone":"white"},{"ra":18.2938,"dec":-36.7617,"magnitude":3.1,"name":"箕宿四","tone":"warm"},{"ra":8.9232,"dec":5.9456,"magnitude":3.11,"name":"柳宿六","tone":"white"},{"ra":10.8271,"dec":-16.1936,"magnitude":3.11,"name":"翼宿五","tone":"warm"},{"ra":11.5964,"dec":-63.0198,"magnitude":3.11,"name":"海山五","tone":"blue"},{"ra":20.6261,"dec":-47.2915,"magnitude":3.11,"name":"波斯二","tone":"white"},{"ra":5.8493,"dec":-35.7683,"magnitude":3.12,"name":"子二","tone":"white"},{"ra":8.9868,"dec":48.0418,"magnitude":3.12,"name":"上台一","tone":"white"},{"ra":16.977,"dec":-55.9901,"magnitude":3.12,"name":"龟五","tone":"warm"},{"ra":17.2505,"dec":24.8392,"magnitude":3.12,"name":"魏","tone":"blue"},{"ra":14.986,"dec":-42.1042,"magnitude":3.13,"name":"骑官三","tone":"blue"},{"ra":9.3509,"dec":34.3926,"magnitude":3.14,"name":"轩辕四","tone":"warm"},{"ra":9.5204,"dec":-57.0344,"magnitude":3.16,"name":"天社六","tone":"warm"},{"ra":17.2508,"dec":36.8092,"magnitude":3.16,"name":"女床一","tone":"warm"},{"ra":6.6294,"dec":-43.1959,"magnitude":3.17,"name":"老人增二","tone":"blue"},{"ra":9.5476,"dec":51.6773,"magnitude":3.17,"name":"文昌四","tone":"white"},{"ra":17.1464,"dec":65.7147,"magnitude":3.17,"name":"上弼","tone":"blue"},{"ra":18.7609,"dec":-26.9908,"magnitude":3.17,"name":"斗宿一","tone":"blue"},{"ra":5.1086,"dec":41.2345,"magnitude":3.18,"name":"柱三[毕宿]","tone":"blue"},{"ra":14.7084,"dec":-64.9751,"magnitude":3.18,"name":"南门增二","tone":"white"},{"ra":4.8307,"dec":6.9613,"magnitude":3.19,"name":"参旗六","tone":"white"},{"ra":5.091,"dec":-22.371,"magnitude":3.19,"name":"屏二","tone":"warm"},{"ra":16.9611,"dec":9.375,"magnitude":3.19,"name":"斛二","tone":"warm"},{"ra":17.831,"dec":-37.0433,"magnitude":3.19,"name":"傅说","tone":"warm"},{"ra":21.2156,"dec":30.2269,"magnitude":3.21,"name":"天津八","tone":"white"},{"ra":23.6558,"dec":77.6323,"magnitude":3.21,"name":"少卫增八","tone":"white"},{"ra":15.3562,"dec":-40.6475,"magnitude":3.22,"name":"骑官二","tone":"blue"},{"ra":16.3054,"dec":-4.6925,"magnitude":3.23,"name":"楚","tone":"white"},{"ra":18.3552,"dec":-2.8988,"magnitude":3.23,"name":"东海","tone":"white"},{"ra":21.4777,"dec":70.5607,"magnitude":3.23,"name":"上卫增一","tone":"blue"},{"ra":6.8032,"dec":-61.9414,"magnitude":3.24,"name":"金鱼增一","tone":"white"},{"ra":20.1884,"dec":-0.8215,"magnitude":3.24,"name":"天桴一","tone":"blue"},{"ra":7.4872,"dec":-43.3014,"magnitude":3.25,"name":"弧矢增廿四","tone":"warm"},{"ra":14.1062,"dec":-26.6824,"magnitude":3.25,"name":"平二","tone":"white"},{"ra":15.0678,"dec":-25.282,"magnitude":3.25,"name":"折威七","tone":"warm"},{"ra":18.9824,"dec":32.6896,"magnitude":3.25,"name":"渐台三","tone":"blue"},{"ra":3.7873,"dec":-74.239,"magnitude":3.26,"name":"附白一","tone":"warm"},{"ra":0.6555,"dec":30.861,"magnitude":3.27,"name":"奎宿五","tone":"warm"},{"ra":17.3668,"dec":-24.9995,"magnitude":3.27,"name":"天江三","tone":"blue"},{"ra":22.9108,"dec":-15.8208,"magnitude":3.27,"name":"羽林军廿六","tone":"blue"},{"ra":5.2155,"dec":-16.2055,"magnitude":3.29,"name":"屏一","tone":"blue"},{"ra":10.2289,"dec":-70.0379,"magnitude":3.29,"name":"南船四","tone":"blue"},{"ra":15.4155,"dec":58.9661,"magnitude":3.29,"name":"左枢","tone":"warm"},{"ra":4.5666,"dec":-55.045,"magnitude":3.3,"name":"金鱼二","tone":"blue"},{"ra":10.5337,"dec":-61.6853,"magnitude":3.3,"name":"南船二","tone":"blue"},{"ra":6.248,"dec":22.5068,"magnitude":3.31,"name":"钺","tone":"warm"},{"ra":17.4232,"dec":-56.3777,"magnitude":3.31,"name":"龟二","tone":"blue"},{"ra":1.1014,"dec":-46.7184,"magnitude":3.32,"name":"火鸟九","tone":"white"},{"ra":3.0863,"dec":38.8403,"magnitude":3.32,"name":"大陵六","tone":"warm"},{"ra":12.2571,"dec":57.0326,"magnitude":3.32,"name":"天权","tone":"blue"},{"ra":17.2026,"dec":-43.2392,"magnitude":3.32,"name":"尾宿四","tone":"white"},{"ra":17.9838,"dec":-9.7736,"magnitude":3.32,"name":"燕","tone":"white"},{"ra":19.1157,"dec":-27.6704,"magnitude":3.32,"name":"斗宿五","tone":"warm"},{"ra":4.2404,"dec":-62.4739,"magnitude":3.33,"name":"夹白二","tone":"white"},{"ra":11.2373,"dec":15.4296,"magnitude":3.33,"name":"西次相","tone":"blue"},{"ra":7.8216,"dec":-24.8598,"magnitude":3.34,"name":"弧矢增十七","tone":"warm"},{"ra":1.9066,"dec":63.6701,"magnitude":3.35,"name":"阁道二","tone":"blue"},{"ra":5.4079,"dec":-2.3971,"magnitude":3.35,"name":"参宿增三","tone":"blue"},{"ra":6.7548,"dec":12.8956,"magnitude":3.35,"name":"井宿增十九","tone":"white"},{"ra":8.5044,"dec":60.7182,"magnitude":3.35,"name":"内阶一","tone":"white"},{"ra":19.425,"dec":3.1148,"magnitude":3.36,"name":"右旗三","tone":"white"},{"ra":15.378,"dec":-44.6896,"magnitude":3.37,"name":"骑官六","tone":"blue"},{"ra":8.7796,"dec":6.4188,"magnitude":3.38,"name":"柳宿五","tone":"white"},{"ra":13.5782,"dec":-0.5958,"magnitude":3.38,"name":"角宿二","tone":"blue"},{"ra":5.5856,"dec":9.9342,"magnitude":3.39,"name":"觜宿一","tone":"blue"},{"ra":10.2847,"dec":-61.3323,"magnitude":3.39,"name":"南船一","tone":"warm"},{"ra":12.9267,"dec":3.3975,"magnitude":3.39,"name":"东次相","tone":"warm"},{"ra":22.1809,"dec":58.2013,"magnitude":3.39,"name":"造父二","tone":"warm"},{"ra":4.4777,"dec":15.8709,"magnitude":3.4,"name":"毕宿增十三","tone":"blue"},{"ra":1.4728,"dec":-43.3182,"magnitude":3.41,"name":"火鸟十","tone":"warm"},{"ra":4.0113,"dec":12.4903,"magnitude":3.41,"name":"毕宿八","tone":"blue"},{"ra":13.8251,"dec":-41.6877,"magnitude":3.41,"name":"衡一","tone":"blue"},{"ra":15.2047,"dec":-52.0992,"magnitude":3.41,"name":"车骑一","tone":"white"},{"ra":20.7548,"dec":61.8388,"magnitude":3.41,"name":"天钩四","tone":"white"},{"ra":22.691,"dec":10.8314,"magnitude":3.41,"name":"雷电一","tone":"blue"},{"ra":1.8847,"dec":29.5788,"magnitude":3.42,"name":"娄宿增六","tone":"white"},{"ra":16.002,"dec":-38.3967,"magnitude":3.42,"name":"积卒增一","tone":"blue"},{"ra":17.7743,"dec":27.7207,"magnitude":3.42,"name":"九河","tone":"white"},{"ra":20.7493,"dec":-66.2032,"magnitude":3.42,"name":"孔雀七","tone":"blue"},{"ra":9.1828,"dec":-58.9669,"magnitude":3.43,"name":"海石增一","tone":"blue"},{"ra":10.2782,"dec":23.4173,"magnitude":3.43,"name":"轩辕十一","tone":"white"},{"ra":19.1041,"dec":-4.8826,"magnitude":3.43,"name":"天弁七","tone":"blue"},{"ra":10.2849,"dec":42.9144,"magnitude":3.45,"name":"中台一","tone":"blue"},{"ra":0.8184,"dec":57.8152,"magnitude":3.46,"name":"王良三","tone":"white"},{"ra":1.1432,"dec":-10.1823,"magnitude":3.46,"name":"天仓二","tone":"warm"},{"ra":7.9463,"dec":-52.9824,"magnitude":3.46,"name":"天社增一","tone":"blue"},{"ra":15.2584,"dec":33.3148,"magnitude":3.46,"name":"七公七","tone":"white"},{"ra":2.7217,"dec":3.2358,"magnitude":3.47,"name":"天囷八","tone":"blue"},{"ra":13.8269,"dec":-42.4737,"magnitude":3.47,"name":"衡二","tone":"blue"},{"ra":10.1222,"dec":16.7627,"magnitude":3.48,"name":"轩辕十三","tone":"blue"},{"ra":16.7149,"dec":38.9223,"magnitude":3.48,"name":"天纪增一","tone":"white"},{"ra":1.7345,"dec":-15.9375,"magnitude":3.49,"name":"天仓五","tone":"white"},{"ra":7.0287,"dec":-27.9348,"magnitude":3.49,"name":"弧矢增二","tone":"warm"},{"ra":11.308,"dec":33.0943,"magnitude":3.49,"name":"下台一","tone":"warm"},{"ra":15.0324,"dec":40.3906,"magnitude":3.49,"name":"七公增五","tone":"white"},{"ra":18.4496,"dec":-45.9685,"magnitude":3.49,"name":"鳖一","tone":"blue"},{"ra":22.8092,"dec":-51.3169,"magnitude":3.49,"name":"鹤三","tone":"blue"},{"ra":6.8307,"dec":-32.5085,"magnitude":3.5,"name":"弧矢八","tone":"blue"},{"ra":7.3354,"dec":21.9823,"magnitude":3.5,"name":"天樽二","tone":"white"},{"ra":22.828,"dec":66.2004,"magnitude":3.5,"name":"天钩八","tone":"white"},{"ra":19.9793,"dec":19.4921,"magnitude":3.51,"name":"左旗五","tone":"warm"},{"ra":22.8334,"dec":24.6016,"magnitude":3.51,"name":"离宫二","tone":"white"},{"ra":3.7208,"dec":-9.7634,"magnitude":3.52,"name":"天苑三","tone":"white"},{"ra":9.6858,"dec":9.8923,"magnitude":3.52,"name":"轩辕增五九","tone":"white"},{"ra":9.9477,"dec":-54.5678,"magnitude":3.52,"name":"φ","tone":"blue"},{"ra":18.8347,"dec":33.3627,"magnitude":3.52,"name":"渐台二","tone":"blue"},{"ra":18.9622,"dec":-21.1067,"magnitude":3.52,"name":"建一","tone":"warm"},{"ra":22.17,"dec":6.1979,"magnitude":3.52,"name":"危宿二","tone":"blue"},{"ra":4.4769,"dec":19.1804,"magnitude":3.53,"name":"毕宿一","tone":"white"},{"ra":8.2753,"dec":9.1855,"magnitude":3.53,"name":"柳宿增十","tone":"warm"},{"ra":11.55,"dec":-31.8576,"magnitude":3.54,"name":"青丘五","tone":"white"},{"ra":15.827,"dec":-3.4302,"magnitude":3.54,"name":"天乳","tone":"blue"},{"ra":17.6264,"dec":-15.3986,"magnitude":3.54,"name":"南海","tone":"white"},{"ra":4.2982,"dec":-33.7983,"magnitude":3.55,"name":"天园十","tone":"blue"},{"ra":5.7826,"dec":-14.822,"magnitude":3.55,"name":"厕增七","tone":"blue"},{"ra":14.3234,"dec":-46.0581,"magnitude":3.55,"name":"柱三[角宿]","tone":"blue"},{"ra":18.3509,"dec":72.7328,"magnitude":3.55,"name":"御女四","tone":"white"},{"ra":20.1454,"dec":-66.1821,"magnitude":3.55,"name":"孔雀六","tone":"white"},{"ra":0.3238,"dec":-8.8239,"magnitude":3.56,"name":"天仓一","tone":"warm"},{"ra":2.2752,"dec":-51.5122,"magnitude":3.56,"name":"天园三","tone":"blue"},{"ra":11.3223,"dec":-14.7785,"magnitude":3.56,"name":"翼宿七","tone":"white"},{"ra":16.8723,"dec":-38.0175,"magnitude":3.56,"name":"尾宿增二","tone":"blue"},{"ra":7.7408,"dec":24.398,"magnitude":3.57,"name":"积薪","tone":"white"},{"ra":9.0604,"dec":47.1565,"magnitude":3.57,"name":"上台二","tone":"blue"},{"ra":14.5305,"dec":30.3714,"magnitude":3.57,"name":"梗河三","tone":"warm"},{"ra":15.3634,"dec":-36.2614,"magnitude":3.57,"name":"顿顽一","tone":"warm"},{"ra":7.3015,"dec":16.5404,"magnitude":3.58,"name":"井宿八","tone":"blue"},{"ra":20.3009,"dec":-12.5449,"magnitude":3.58,"name":"牛宿二","tone":"white"},{"ra":1.6332,"dec":48.6282,"magnitude":3.59,"name":"天大将军三","tone":"warm"},{"ra":5.2934,"dec":-6.8444,"magnitude":3.59,"name":"参宿增卅八","tone":"blue"},{"ra":5.7411,"dec":-22.4484,"magnitude":3.59,"name":"厕三","tone":"white"},{"ra":11.8449,"dec":1.7647,"magnitude":3.59,"name":"右执法","tone":"white"},{"ra":12.356,"dec":-60.4011,"magnitude":3.59,"name":"Ginan","tone":"warm"},{"ra":1.4004,"dec":-8.1833,"magnitude":3.6,"name":"天仓三","tone":"white"},{"ra":6.8798,"dec":33.9613,"magnitude":3.6,"name":"五诸侯一[井宿]","tone":"blue"},{"ra":8.6716,"dec":-52.9219,"magnitude":3.6,"name":"ο","tone":"blue"},{"ra":9.5117,"dec":-40.4668,"magnitude":3.6,"name":"天记增一","tone":"white"},{"ra":15.6171,"dec":-28.1351,"magnitude":3.6,"name":"天辐一","tone":"warm"},{"ra":17.5183,"dec":-60.6838,"magnitude":3.6,"name":"龟三","tone":"blue"},{"ra":2.8331,"dec":27.2605,"magnitude":3.61,"name":"胃宿三","tone":"blue"},{"ra":3.4136,"dec":9.0289,"magnitude":3.61,"name":"天廪四","tone":"white"},{"ra":10.1765,"dec":-12.3541,"magnitude":3.61,"name":"张宿二","tone":"white"},{"ra":13.0379,"dec":-71.5489,"magnitude":3.61,"name":"蜜蜂四*","tone":"warm"},{"ra":17.7622,"dec":-64.7239,"magnitude":3.61,"name":"孔雀一","tone":"warm"},{"ra":1.5247,"dec":15.3458,"magnitude":3.62,"name":"右更二","tone":"white"},{"ra":3.8194,"dec":24.0534,"magnitude":3.62,"name":"昴宿七","tone":"blue"},{"ra":7.7542,"dec":-37.9686,"magnitude":3.62,"name":"弧矢三","tone":"warm"},{"ra":16.9097,"dec":-42.3613,"magnitude":3.62,"name":"Grafias","tone":"warm"},{"ra":23.032,"dec":42.326,"magnitude":3.62,"name":"车府增廿","tone":"blue"},{"ra":11.7601,"dec":-66.7288,"magnitude":3.63,"name":"海山六","tone":"blue"},{"ra":20.6258,"dec":14.5951,"magnitude":3.64,"name":"瓠瓜四","tone":"white"},{"ra":4.3299,"dec":15.6276,"magnitude":3.65,"name":"毕宿四","tone":"white"},{"ra":9.5255,"dec":63.0619,"magnitude":3.65,"name":"内阶四","tone":"white"},{"ra":15.7698,"dec":15.4218,"magnitude":3.65,"name":"周","tone":"blue"},{"ra":18.1105,"dec":-50.0915,"magnitude":3.65,"name":"杵增一[箕宿]","tone":"blue"},{"ra":22.4805,"dec":-0.02,"magnitude":3.65,"name":"坟墓一","tone":"white"},{"ra":15.4638,"dec":29.1057,"magnitude":3.66,"name":"贯索三","tone":"white"},{"ra":15.6443,"dec":-29.7778,"magnitude":3.66,"name":"天辐二","tone":"blue"},{"ra":14.0732,"dec":64.3759,"magnitude":3.67,"name":"右枢","tone":"blue"},{"ra":20.9135,"dec":-58.4542,"magnitude":3.67,"name":"孔雀增四","tone":"warm"},{"ra":4.8534,"dec":5.6051,"magnitude":3.68,"name":"参旗七","tone":"blue"},{"ra":8.7265,"dec":-33.1864,"magnitude":3.68,"name":"天狗五","tone":"blue"},{"ra":19.7898,"dec":18.5343,"magnitude":3.68,"name":"左旗三","tone":"warm"},{"ra":23.1574,"dec":-21.1724,"magnitude":3.68,"name":"羽林军廿八","tone":"warm"},{"ra":0.6162,"dec":53.8969,"magnitude":3.69,"name":"附路","tone":"blue"},{"ra":1.9326,"dec":-51.6089,"magnitude":3.69,"name":"天园二","tone":"white"},{"ra":5.0413,"dec":41.0758,"magnitude":3.69,"name":"柱二[毕宿]","tone":"warm"},{"ra":9.7541,"dec":-62.5079,"magnitude":3.69,"name":"海石四","tone":"white"},{"ra":11.7675,"dec":47.7794,"magnitude":3.69,"name":"太阳守","tone":"warm"},{"ra":21.6682,"dec":-16.6623,"magnitude":3.69,"name":"垒壁阵三","tone":"white"},{"ra":3.3253,"dec":-21.7579,"magnitude":3.7,"name":"天苑十一","tone":"warm"},{"ra":17.9627,"dec":29.2479,"magnitude":3.7,"name":"中山增一","tone":"white"},{"ra":23.2861,"dec":3.2823,"magnitude":3.7,"name":"霹雳二","tone":"white"},{"ra":4.9042,"dec":2.4407,"magnitude":3.71,"name":"参旗增十二","tone":"blue"},{"ra":5.9401,"dec":-14.1677,"magnitude":3.71,"name":"厕增六","tone":"white"},{"ra":7.8703,"dec":-40.5758,"magnitude":3.71,"name":"弧矢增廿三","tone":"white"},{"ra":15.8469,"dec":4.4777,"magnitude":3.71,"name":"巴","tone":"blue"},{"ra":18.1225,"dec":9.5638,"magnitude":3.71,"name":"宗人增一","tone":"blue"},{"ra":19.9219,"dec":6.4068,"magnitude":3.71,"name":"河鼓一","tone":"white"},{"ra":3.5488,"dec":-9.4583,"magnitude":3.72,"name":"天苑四","tone":"white"},{"ra":3.7479,"dec":24.1133,"magnitude":3.72,"name":"昴宿一","tone":"blue"},{"ra":5.9921,"dec":54.2847,"magnitude":3.72,"name":"八谷一","tone":"white"},{"ra":21.0822,"dec":43.9279,"magnitude":3.72,"name":"车府六","tone":"warm"},{"ra":3.4528,"dec":9.7327,"magnitude":3.73,"name":"天廪三","tone":"blue"},{"ra":14.7708,"dec":1.8929,"magnitude":3.73,"name":"亢宿增十","tone":"blue"},{"ra":17.8921,"dec":56.8726,"magnitude":3.73,"name":"天棓一","tone":"warm"},{"ra":21.6913,"dec":-77.39,"magnitude":3.73,"name":"蛇尾三","tone":"white"},{"ra":22.8769,"dec":-7.5796,"magnitude":3.73,"name":"垒壁阵七","tone":"warm"},{"ra":1.8577,"dec":-10.335,"magnitude":3.74,"name":"天仓四","tone":"white"},{"ra":16.3653,"dec":19.1531,"magnitude":3.74,"name":"河间","tone":"white"},{"ra":21.2465,"dec":38.0453,"magnitude":3.74,"name":"天津六","tone":"white"},{"ra":9.0692,"dec":-47.0977,"magnitude":3.75,"name":"天社增三","tone":"warm"},{"ra":17.7982,"dec":2.7073,"magnitude":3.75,"name":"宗正二","tone":"blue"},{"ra":5.5604,"dec":-62.4898,"magnitude":3.76,"name":"金鱼三","tone":"white"},{"ra":5.8554,"dec":-20.8791,"magnitude":3.76,"name":"厕四","tone":"white"},{"ra":6.4803,"dec":-7.0331,"magnitude":3.76,"name":"参宿增廿六","tone":"blue"},{"ra":19.0781,"dec":-21.7415,"magnitude":3.76,"name":"建二","tone":"white"},{"ra":19.4951,"dec":51.7298,"magnitude":3.76,"name":"奚仲二","tone":"blue"},{"ra":22.5215,"dec":50.2825,"magnitude":3.76,"name":"螣蛇一","tone":"blue"},{"ra":2.8449,"dec":55.8955,"magnitude":3.77,"name":"天船一","tone":"warm"},{"ra":3.7532,"dec":42.5785,"magnitude":3.77,"name":"卷舌一","tone":"white"},{"ra":4.3822,"dec":17.5425,"magnitude":3.77,"name":"毕宿三","tone":"white"},{"ra":5.6458,"dec":-2.6001,"magnitude":3.77,"name":"参宿增一","tone":"blue"},{"ra":8.4289,"dec":-66.1369,"magnitude":3.77,"name":"飞鱼三","tone":"white"},{"ra":8.6771,"dec":-46.6487,"magnitude":3.77,"name":"天社二","tone":"white"},{"ra":16.8298,"dec":-59.0414,"magnitude":3.77,"name":"龟四","tone":"warm"},{"ra":20.6606,"dec":15.9121,"magnitude":3.77,"name":"瓠瓜一","tone":"blue"},{"ra":21.4445,"dec":-22.4113,"magnitude":3.77,"name":"燕","tone":"white"},{"ra":22.1169,"dec":25.3451,"magnitude":3.77,"name":"臼三","tone":"white"},{"ra":7.1458,"dec":-70.4989,"magnitude":3.78,"name":"飞鱼二","tone":"white"},{"ra":7.4288,"dec":27.7981,"magnitude":3.78,"name":"五诸侯三[井宿]","tone":"white"},{"ra":9.8498,"dec":59.0387,"magnitude":3.78,"name":"文昌二","tone":"white"},{"ra":10.8916,"dec":-58.8532,"magnitude":3.78,"name":"u","tone":"white"},{"ra":14.6858,"dec":13.7283,"magnitude":3.78,"name":"左摄提三","tone":"blue"},{"ra":20.7946,"dec":-9.4958,"magnitude":3.78,"name":"女宿一","tone":"blue"},{"ra":3.1583,"dec":44.8575,"magnitude":3.79,"name":"大陵四","tone":"white"},{"ra":10.8885,"dec":34.2149,"magnitude":3.79,"name":"势四","tone":"white"},{"ra":11.3031,"dec":31.5308,"magnitude":3.79,"name":"下台二","tone":"white"},{"ra":3.2013,"dec":-28.9876,"magnitude":3.8,"name":"天苑增十七","tone":"white"},{"ra":7.6472,"dec":-26.8038,"magnitude":3.8,"name":"弧矢六","tone":"blue"},{"ra":15.58,"dec":10.5389,"magnitude":3.8,"name":"秦","tone":"white"},{"ra":19.285,"dec":53.3685,"magnitude":3.8,"name":"奚仲一","tone":"white"},{"ra":20.2272,"dec":46.7413,"magnitude":3.8,"name":"天津增卅八","tone":"warm"},{"ra":4.5925,"dec":-30.5623,"magnitude":3.81,"name":"天园十二","tone":"white"},{"ra":10.4646,"dec":-58.7394,"magnitude":3.81,"name":"海山一","tone":"white"},{"ra":15.7124,"dec":26.2956,"magnitude":3.81,"name":"贯索五","tone":"blue"},{"ra":23.6261,"dec":46.4582,"magnitude":3.81,"name":"螣蛇十九","tone":"white"},{"ra":2.0341,"dec":2.7638,"magnitude":3.82,"name":"外屏七","tone":"blue"},{"ra":9.3141,"dec":36.8026,"magnitude":3.82,"name":"轩辕三","tone":"blue"},{"ra":11.5234,"dec":69.3311,"magnitude":3.82,"name":"上辅","tone":"warm"},{"ra":16.5152,"dec":1.9839,"magnitude":3.82,"name":"列肆二","tone":"blue"},{"ra":17.6577,"dec":46.0063,"magnitude":3.82,"name":"天棓五","tone":"blue"},{"ra":10.4348,"dec":-16.8363,"magnitude":3.83,"name":"张宿三","tone":"warm"},{"ra":13.9712,"dec":-42.1008,"magnitude":3.83,"name":"衡三","tone":"blue"},{"ra":14.7977,"dec":-79.0448,"magnitude":3.83,"name":"异雀八","tone":"warm"},{"ra":3.7367,"dec":-64.8069,"magnitude":3.84,"name":"蛇首二","tone":"white"},{"ra":3.7386,"dec":32.2882,"magnitude":3.84,"name":"卷舌增七","tone":"blue"},{"ra":4.4762,"dec":15.9622,"magnitude":3.84,"name":"毕宿六","tone":"white"},{"ra":8.9175,"dec":-60.6446,"magnitude":3.84,"name":"海石增二","tone":"blue"},{"ra":10.5469,"dec":9.3066,"magnitude":3.84,"name":"轩辕十六","tone":"blue"},{"ra":10.6217,"dec":-48.2256,"magnitude":3.84,"name":"海山增一","tone":"white"},{"ra":12.5411,"dec":-72.133,"magnitude":3.84,"name":"蜜蜂二*","tone":"blue"},{"ra":18.1257,"dec":28.7625,"magnitude":3.84,"name":"中山","tone":"blue"},{"ra":18.2294,"dec":-21.0588,"magnitude":3.84,"name":"斗宿三","tone":"blue"},{"ra":19.8029,"dec":70.2679,"magnitude":3.84,"name":"天厨三","tone":"white"},{"ra":4.2334,"dec":-42.2944,"magnitude":3.85,"name":"天园增六","tone":"white"},{"ra":5.7881,"dec":-51.0665,"magnitude":3.85,"name":"老人增四","tone":"blue"},{"ra":6.3686,"dec":-33.4364,"magnitude":3.85,"name":"孙增四","tone":"white"},{"ra":10.2456,"dec":-42.1219,"magnitude":3.85,"name":"天记增二","tone":"blue"},{"ra":12.558,"dec":69.7882,"magnitude":3.85,"name":"少尉","tone":"blue"},{"ra":12.6284,"dec":-48.5413,"magnitude":3.85,"name":"库楼八","tone":"blue"},{"ra":15.9409,"dec":15.6616,"magnitude":3.85,"name":"郑","tone":"white"},{"ra":18.395,"dec":21.7698,"magnitude":3.85,"name":"屠肆一","tone":"warm"},{"ra":18.5868,"dec":-8.2441,"magnitude":3.85,"name":"天弁一","tone":"warm"},{"ra":0.9459,"dec":38.4993,"magnitude":3.86,"name":"奎宿八","tone":"blue"},{"ra":4.6363,"dec":-14.304,"magnitude":3.86,"name":"九斿增四","tone":"white"},{"ra":5.5202,"dec":-35.4705,"magnitude":3.86,"name":"丈人二","tone":"white"},{"ra":16.2573,"dec":-63.6857,"magnitude":3.86,"name":"三角形增一","tone":"white"},{"ra":16.5575,"dec":-78.8971,"magnitude":3.86,"name":"异雀四","tone":"white"},{"ra":17.9376,"dec":37.2505,"magnitude":3.86,"name":"天纪九","tone":"warm"},{"ra":22.3609,"dec":-1.3873,"magnitude":3.86,"name":"坟墓二","tone":"blue"},{"ra":3.7638,"dec":24.3677,"magnitude":3.87,"name":"昴宿四","tone":"blue"},{"ra":8.7671,"dec":-46.0415,"magnitude":3.87,"name":"天社增二","tone":"blue"},{"ra":13.978,"dec":-44.8036,"magnitude":3.87,"name":"柱二[角宿]","tone":"blue"},{"ra":14.7177,"dec":-5.6582,"magnitude":3.87,"name":"亢宿增七","tone":"white"},{"ra":15.9481,"dec":-29.2141,"magnitude":3.87,"name":"房宿二","tone":"blue"},{"ra":19.8745,"dec":1.0057,"magnitude":3.87,"name":"天桴四","tone":"white"},{"ra":0.1568,"dec":-45.7474,"magnitude":3.88,"name":"火鸟四","tone":"white"},{"ra":1.8922,"dec":19.2939,"magnitude":3.88,"name":"娄宿二","tone":"blue"},{"ra":9.8794,"dec":26.007,"magnitude":3.88,"name":"轩辕十","tone":"warm"},{"ra":15.1989,"dec":-48.7378,"magnitude":3.88,"name":"骑阵将军","tone":"blue"},{"ra":23.1726,"dec":-45.2467,"magnitude":3.88,"name":"鹤七","tone":"white"},{"ra":2.9405,"dec":-8.8981,"magnitude":3.89,"name":"天苑六","tone":"white"},{"ra":6.9022,"dec":-24.1842,"magnitude":3.89,"name":"军市五","tone":"warm"},{"ra":9.2394,"dec":2.3143,"magnitude":3.89,"name":"柳宿八","tone":"blue"},{"ra":12.3318,"dec":-0.6668,"magnitude":3.89,"name":"左执法","tone":"blue"},{"ra":19.9384,"dec":35.0834,"magnitude":3.89,"name":"辇道增五","tone":"white"},{"ra":9.6643,"dec":-1.1428,"magnitude":3.9,"name":"星宿四","tone":"warm"},{"ra":11.3501,"dec":-54.491,"magnitude":3.9,"name":"π","tone":"blue"},{"ra":13.5174,"dec":-39.4073,"magnitude":3.9,"name":"库楼五","tone":"warm"},{"ra":4.0526,"dec":5.9893,"magnitude":3.91,"name":"毕宿增三","tone":"blue"},{"ra":8.4277,"dec":-3.9064,"magnitude":3.91,"name":"外厨增三","tone":"blue"},{"ra":12.4673,"dec":-50.2306,"magnitude":3.91,"name":"库楼十","tone":"blue"},{"ra":15.0853,"dec":-47.0512,"magnitude":3.91,"name":"骑官八","tone":"blue"},{"ra":15.5921,"dec":-14.7895,"magnitude":3.91,"name":"氐宿三","tone":"white"},{"ra":16.329,"dec":46.3134,"magnitude":3.91,"name":"七公二","tone":"blue"},{"ra":17.0048,"dec":30.9264,"magnitude":3.92,"name":"天纪三","tone":"blue"},{"ra":19.3612,"dec":-17.8472,"magnitude":3.92,"name":"建五","tone":"white"},{"ra":21.2637,"dec":5.2478,"magnitude":3.92,"name":"虚宿二","tone":"white"},{"ra":0.4367,"dec":-43.6798,"magnitude":3.93,"name":"火鸟五","tone":"blue"},{"ra":1.5209,"dec":-49.0727,"magnitude":3.93,"name":"天园一","tone":"white"},{"ra":2.9043,"dec":52.7625,"magnitude":3.93,"name":"大陵增十一","tone":"white"},{"ra":4.6053,"dec":-3.3525,"magnitude":3.93,"name":"九州殊口四","tone":"blue"},{"ra":7.697,"dec":-72.6061,"magnitude":3.93,"name":"飞鱼六","tone":"white"},{"ra":11.1432,"dec":-58.975,"magnitude":3.93,"name":"x","tone":"warm"},{"ra":16.1135,"dec":-20.6692,"magnitude":3.93,"name":"钩钤一","tone":"blue"},{"ra":18.0108,"dec":2.9316,"magnitude":3.93,"name":"宗人二","tone":"blue"},{"ra":1.1397,"dec":-55.2458,"magnitude":3.94,"name":"水委二","tone":"blue"},{"ra":7.6875,"dec":-9.5511,"magnitude":3.94,"name":"阙丘增七","tone":"white"},{"ra":7.7301,"dec":-28.9548,"magnitude":3.94,"name":"弧矢增十九","tone":"blue"},{"ra":8.7447,"dec":18.1543,"magnitude":3.94,"name":"鬼宿四","tone":"white"},{"ra":20.9529,"dec":41.1671,"magnitude":3.94,"name":"天津五","tone":"blue"},{"ra":2.0573,"dec":72.4213,"magnitude":3.95,"name":"杠五","tone":"blue"},{"ra":6.6114,"dec":-19.2559,"magnitude":3.95,"name":"野鸡","tone":"white"},{"ra":4.1444,"dec":47.7125,"magnitude":3.96,"name":"天船六","tone":"blue"},{"ra":5.9858,"dec":-42.8151,"magnitude":3.96,"name":"老人增三","tone":"white"},{"ra":9.0107,"dec":41.7829,"magnitude":3.96,"name":"轩辕一","tone":"white"},{"ra":9.188,"dec":-62.317,"magnitude":3.96,"name":"海石增三","tone":"blue"},{"ra":19.3773,"dec":-44.459,"magnitude":3.96,"name":"天渊二","tone":"blue"},{"ra":19.3981,"dec":-40.6159,"magnitude":3.96,"name":"天渊三","tone":"blue"},{"ra":20.2579,"dec":47.7142,"magnitude":3.96,"name":"天津增卅七","tone":"warm"},{"ra":23.3828,"dec":-20.1006,"magnitude":3.96,"name":"羽林军卅四","tone":"white"},{"ra":4.4006,"dec":-34.0168,"magnitude":3.97,"name":"天园十一","tone":"warm"},{"ra":5.8582,"dec":39.1485,"magnitude":3.97,"name":"柱五[毕宿]","tone":"white"},{"ra":7.2805,"dec":-67.9572,"magnitude":3.97,"name":"飞鱼五","tone":"white"},{"ra":8.6684,"dec":-35.3084,"magnitude":3.97,"name":"天狗四","tone":"white"},{"ra":12.1942,"dec":-52.3685,"magnitude":3.97,"name":"马尾二","tone":"blue"},{"ra":15.8493,"dec":-33.6272,"magnitude":3.97,"name":"从官二[房宿]","tone":"blue"},{"ra":20.0099,"dec":-72.9105,"magnitude":3.97,"name":"孔雀九","tone":"blue"},{"ra":22.4878,"dec":-43.4956,"magnitude":3.97,"name":"鹤增二","tone":"white"},{"ra":22.7755,"dec":23.5657,"magnitude":3.97,"name":"离宫一","tone":"white"},{"ra":3.9828,"dec":35.791,"magnitude":3.98,"name":"卷舌三","tone":"blue"},{"ra":21.5663,"dec":45.5918,"magnitude":3.98,"name":"车府四","tone":"white"},{"ra":2.0001,"dec":-21.0778,"magnitude":3.99,"name":"𫓧锧四","tone":"warm"},{"ra":6.2476,"dec":-6.2748,"magnitude":3.99,"name":"参宿增廿八","tone":"warm"},{"ra":10.4066,"dec":-74.0316,"magnitude":3.99,"name":"南船增一","tone":"white"},{"ra":13.4204,"dec":54.988,"magnitude":3.99,"name":"开阳增一","tone":"blue"},{"ra":23.2905,"dec":-58.2357,"magnitude":3.99,"name":"鹤五","tone":"white"},{"ra":9.0408,"dec":-66.3961,"magnitude":4,"name":"飞鱼一","tone":"blue"},{"ra":11.3987,"dec":10.5295,"magnitude":4,"name":"西次将","tone":"white"},{"ra":16.1999,"dec":-19.4607,"magnitude":4,"name":"键闭","tone":"blue"},{"ra":1.7277,"dec":50.6887,"magnitude":4.01,"name":"天大将军二","tone":"blue"},{"ra":4.7584,"dec":-3.2547,"magnitude":4.01,"name":"九斿二","tone":"blue"},{"ra":7.0685,"dec":20.5703,"magnitude":4.01,"name":"井宿七","tone":"white"},{"ra":7.2468,"dec":-26.7727,"magnitude":4.01,"name":"弧矢增三","tone":"blue"},{"ra":14.6993,"dec":-37.7935,"magnitude":4.01,"name":"阳门一","tone":"blue"},{"ra":16.0315,"dec":58.5653,"magnitude":4.01,"name":"上宰","tone":"white"},{"ra":16.3307,"dec":-50.1555,"magnitude":4.01,"name":"γ2","tone":"white"},{"ra":18.7173,"dec":-71.4281,"magnitude":4.01,"name":"孔雀八","tone":"white"},{"ra":20.4899,"dec":30.3686,"magnitude":4.01,"name":"天津增十六","tone":"white"},{"ra":8.8422,"dec":-27.7098,"magnitude":4.02,"name":"天狗六","tone":"warm"},{"ra":12.1402,"dec":-24.7289,"magnitude":4.02,"name":"右辖","tone":"white"},{"ra":18.9937,"dec":15.0683,"magnitude":4.02,"name":"吴越增一","tone":"white"},{"ra":19.028,"dec":-5.7391,"magnitude":4.02,"name":"天弁六","tone":"white"},{"ra":2.2886,"dec":33.8472,"magnitude":4.03,"name":"天大将军十","tone":"blue"},{"ra":5.057,"dec":60.4422,"magnitude":4.03,"name":"八谷增十四","tone":"white"},{"ra":8.7783,"dec":28.7599,"magnitude":4.03,"name":"轩辕增廿二","tone":"white"},{"ra":12.9099,"dec":-57.1779,"magnitude":4.03,"name":"μ1","tone":"blue"},{"ra":18.0909,"dec":2.5001,"magnitude":4.03,"name":"宗人四","tone":"white"},{"ra":20.5535,"dec":11.3033,"magnitude":4.03,"name":"败瓜一","tone":"blue"},{"ra":23.9885,"dec":6.8633,"magnitude":4.03,"name":"霹雳五","tone":"white"},{"ra":4.1978,"dec":-6.8376,"magnitude":4.04,"name":"九州殊口二","tone":"white"},{"ra":11.7643,"dec":6.5294,"magnitude":4.04,"name":"内屏二","tone":"warm"},{"ra":14.4199,"dec":51.8507,"magnitude":4.04,"name":"天枪三","tone":"white"},{"ra":22.5893,"dec":-0.1175,"magnitude":4.04,"name":"坟墓三","tone":"blue"},{"ra":3.1511,"dec":49.6133,"magnitude":4.05,"name":"大陵三","tone":"white"},{"ra":8.3088,"dec":-76.9197,"magnitude":4.05,"name":"小斗增一","tone":"white"},{"ra":8.74,"dec":-42.6493,"magnitude":4.05,"name":"天狗二","tone":"white"},{"ra":11.3523,"dec":6.0293,"magnitude":4.05,"name":"西上将","tone":"blue"},{"ra":13.8246,"dec":15.7979,"magnitude":4.05,"name":"右摄提三","tone":"warm"},{"ra":14.3426,"dec":-37.8853,"magnitude":4.05,"name":"柱六[角宿]","tone":"blue"},{"ra":14.6315,"dec":-49.4258,"magnitude":4.05,"name":"车骑二","tone":"blue"},{"ra":22.8265,"dec":-13.5926,"magnitude":4.05,"name":"羽林军廿四","tone":"warm"},{"ra":4.9395,"dec":13.5145,"magnitude":4.06,"name":"参旗二","tone":"warm"},{"ra":7.5987,"dec":26.8957,"magnitude":4.06,"name":"五诸侯四[井宿]","tone":"warm"},{"ra":11.4147,"dec":-17.684,"magnitude":4.06,"name":"翼宿二","tone":"white"},{"ra":12.2929,"dec":-67.9607,"magnitude":4.06,"name":"ε","tone":"warm"},{"ra":12.3073,"dec":-64.0031,"magnitude":4.06,"name":"ζ","tone":"blue"},{"ra":14.7276,"dec":-35.1737,"magnitude":4.06,"name":"阳门二","tone":"warm"},{"ra":16.9931,"dec":-53.1604,"magnitude":4.06,"name":"龟一","tone":"warm"},{"ra":14.2669,"dec":-6.0005,"magnitude":4.07,"name":"亢宿二","tone":"white"},{"ra":15.1474,"dec":-45.2799,"magnitude":4.07,"name":"骑官五","tone":"blue"},{"ra":15.2919,"dec":-58.8012,"magnitude":4.07,"name":"β","tone":"blue"},{"ra":22.4862,"dec":58.4152,"magnitude":4.07,"name":"造父一","tone":"white"},{"ra":0.789,"dec":24.2672,"magnitude":4.08,"name":"奎宿二","tone":"white"},{"ra":2.3625,"dec":-68.6594,"magnitude":4.08,"name":"蛇腹三","tone":"blue"},{"ra":2.658,"dec":0.3285,"magnitude":4.08,"name":"天囷九","tone":"blue"},{"ra":3.0399,"dec":-23.6245,"magnitude":4.08,"name":"天苑十","tone":"blue"},{"ra":6.9032,"dec":-12.0386,"magnitude":4.08,"name":"天狼增六","tone":"warm"},{"ra":9.5741,"dec":-59.2298,"magnitude":4.08,"name":"海石三","tone":"blue"},{"ra":10.9962,"dec":-18.2988,"magnitude":4.08,"name":"翼宿一","tone":"white"},{"ra":18.9223,"dec":43.9461,"magnitude":4.08,"name":"辇道一","tone":"warm"},{"ra":21.0991,"dec":-17.2329,"magnitude":4.08,"name":"秦一","tone":"blue"},{"ra":21.3681,"dec":19.8045,"magnitude":4.08,"name":"人二","tone":"white"},{"ra":5.6151,"dec":9.2907,"magnitude":4.09,"name":"觜宿三","tone":"white"},{"ra":15.8123,"dec":18.1416,"magnitude":4.09,"name":"周增八","tone":"warm"},{"ra":1.6133,"dec":41.4055,"magnitude":4.1,"name":"天大将军六","tone":"white"},{"ra":2.7367,"dec":49.2284,"magnitude":4.1,"name":"大陵增十三","tone":"white"},{"ra":7.8206,"dec":-46.3732,"magnitude":4.1,"name":"P","tone":"blue"},{"ra":18.4805,"dec":-49.0706,"magnitude":4.1,"name":"ζ","tone":"white"},{"ra":19.1672,"dec":-39.3408,"magnitude":4.1,"name":"鳖五","tone":"warm"},{"ra":2.6778,"dec":-39.8554,"magnitude":4.11,"name":"天园增一","tone":"white"},{"ra":7.0626,"dec":-15.6333,"magnitude":4.11,"name":"天狼增四","tone":"blue"},{"ra":8.6274,"dec":-42.9891,"magnitude":4.11,"name":"天狗一","tone":"blue"},{"ra":9.858,"dec":-14.8466,"magnitude":4.11,"name":"张宿一","tone":"white"},{"ra":10.5911,"dec":-78.6078,"magnitude":4.11,"name":"小斗三","tone":"warm"},{"ra":11.7752,"dec":-61.1784,"magnitude":4.11,"name":"HIP 57439","tone":"white"},{"ra":15.612,"dec":-66.317,"magnitude":4.11,"name":"三角形增二","tone":"warm"},{"ra":19.1579,"dec":-37.9045,"magnitude":4.11,"name":"鳖六","tone":"blue"},{"ra":23.0147,"dec":-52.7541,"magnitude":4.11,"name":"鹤六","tone":"white"},{"ra":2.6598,"dec":-68.2669,"magnitude":4.12,"name":"蛇腹二","tone":"blue"},{"ra":4.2483,"dec":48.4093,"magnitude":4.12,"name":"天船七","tone":"white"},{"ra":6.0397,"dec":9.6473,"magnitude":4.12,"name":"参宿增十八","tone":"blue"},{"ra":12.0868,"dec":8.733,"magnitude":4.12,"name":"内屏四","tone":"white"},{"ra":19.921,"dec":-41.8683,"magnitude":4.12,"name":"天渊增一","tone":"white"},{"ra":20.8637,"dec":-26.9191,"magnitude":4.12,"name":"天田二[牛宿]","tone":"warm"},{"ra":22.496,"dec":-43.7492,"magnitude":4.12,"name":"鹤十一","tone":"warm"},{"ra":5.3991,"dec":-7.8081,"magnitude":4.13,"name":"参宿增卅七","tone":"white"},{"ra":6.4827,"dec":20.2121,"magnitude":4.13,"name":"井宿二","tone":"blue"},{"ra":15.8971,"dec":-16.7293,"magnitude":4.13,"name":"西咸三","tone":"white"},{"ra":20.7683,"dec":-25.2709,"magnitude":4.13,"name":"天田四[牛宿]","tone":"white"},{"ra":22.7676,"dec":-81.3816,"magnitude":4.13,"name":"β","tone":"white"},{"ra":23.6658,"dec":5.6263,"magnitude":4.13,"name":"霹雳四","tone":"white"},{"ra":3.5145,"dec":12.9367,"magnitude":4.14,"name":"天廪一","tone":"white"},{"ra":3.7721,"dec":23.9484,"magnitude":4.14,"name":"昴宿五","tone":"blue"},{"ra":8.6276,"dec":5.7038,"magnitude":4.14,"name":"柳宿一","tone":"blue"},{"ra":12.1147,"dec":-64.6137,"magnitude":4.14,"name":"η","tone":"white"},{"ra":15.5488,"dec":31.3591,"magnitude":4.14,"name":"贯索二","tone":"blue"},{"ra":15.9598,"dec":26.8779,"magnitude":4.14,"name":"贯索七","tone":"warm"},{"ra":21.7441,"dec":25.645,"magnitude":4.14,"name":"臼二","tone":"white"},{"ra":22.2662,"dec":37.7487,"magnitude":4.14,"name":"杵一[危宿]","tone":"warm"},{"ra":7.1977,"dec":-0.4928,"magnitude":4.15,"name":"阙丘增三","tone":"blue"},{"ra":17.3947,"dec":37.1459,"magnitude":4.15,"name":"女床三","tone":"blue"},{"ra":23.6735,"dec":44.3339,"magnitude":4.15,"name":"螣蛇廿一","tone":"blue"},{"ra":6.0687,"dec":23.2633,"magnitude":4.16,"name":"司怪二","tone":"white"},{"ra":7.4852,"dec":31.7846,"magnitude":4.16,"name":"北河一","tone":"white"},{"ra":16.0727,"dec":-11.3736,"magnitude":4.16,"name":"西咸一","tone":"white"},{"ra":17.4395,"dec":-24.1753,"magnitude":4.16,"name":"天江四","tone":"white"},{"ra":0.55,"dec":62.9318,"magnitude":4.17,"name":"王良二","tone":"blue"},{"ra":3.8242,"dec":-36.2003,"magnitude":4.17,"name":"天园九","tone":"white"},{"ra":22.2806,"dec":-7.7833,"magnitude":4.17,"name":"泣二","tone":"white"},{"ra":14.2149,"dec":-10.2737,"magnitude":4.18,"name":"亢宿一","tone":"warm"},{"ra":14.2731,"dec":46.0883,"magnitude":4.18,"name":"玄戈","tone":"blue"},{"ra":16.6062,"dec":-35.2553,"magnitude":4.18,"name":"H","tone":"warm"},{"ra":22.2506,"dec":57.0436,"magnitude":4.18,"name":"螣蛇九","tone":"white"},{"ra":22.6776,"dec":-27.0436,"magnitude":4.18,"name":"羽林军八","tone":"blue"},{"ra":13.8241,"dec":-34.4508,"magnitude":4.19,"name":"库楼四","tone":"warm"},{"ra":18.761,"dec":20.5463,"magnitude":4.19,"name":"宗一","tone":"white"},{"ra":5.5131,"dec":5.9481,"magnitude":4.2,"name":"参宿增十三","tone":"blue"},{"ra":7.9476,"dec":-22.8801,"magnitude":4.2,"name":"弧矢增十五","tone":"white"},{"ra":10.4647,"dec":36.7072,"magnitude":4.2,"name":"势增四","tone":"white"},{"ra":16.5684,"dec":42.437,"magnitude":4.2,"name":"七公增十五","tone":"blue"},{"ra":22.7782,"dec":12.1729,"magnitude":4.2,"name":"雷电二","tone":"white"},{"ra":22.9325,"dec":-32.5396,"magnitude":4.2,"name":"天纲","tone":"white"},{"ra":3.4845,"dec":59.9403,"magnitude":4.21,"name":"传舍七","tone":"white"},{"ra":4.4228,"dec":22.2939,"magnitude":4.21,"name":"天街增二","tone":"blue"},{"ra":16.7662,"dec":82.0373,"magnitude":4.21,"name":"勾陈三","tone":"white"},{"ra":20.493,"dec":62.9941,"magnitude":4.21,"name":"天钩三","tone":"blue"},{"ra":21.4407,"dec":-65.3662,"magnitude":4.21,"name":"孔雀十","tone":"white"},{"ra":2.8431,"dec":38.3186,"magnitude":4.22,"name":"大陵七","tone":"white"},{"ra":3.7808,"dec":-23.2497,"magnitude":4.22,"name":"天苑十三","tone":"white"},{"ra":7.8884,"dec":-48.1029,"magnitude":4.22,"name":"J","tone":"blue"},{"ra":16.1099,"dec":-36.8023,"magnitude":4.22,"name":"积卒一","tone":"blue"},{"ra":16.4504,"dec":-18.4563,"magnitude":4.22,"name":"东咸二","tone":"white"},{"ra":18.346,"dec":71.3378,"magnitude":4.22,"name":"柱史","tone":"blue"},{"ra":18.7862,"dec":-4.7479,"magnitude":4.22,"name":"天弁四","tone":"white"},{"ra":18.8703,"dec":-62.1876,"magnitude":4.22,"name":"孔雀四","tone":"blue"},{"ra":18.9084,"dec":36.8986,"magnitude":4.22,"name":"渐台一","tone":"warm"},{"ra":20.761,"dec":30.7197,"magnitude":4.22,"name":"天津增十九","tone":"white"},{"ra":21.2903,"dec":39.3947,"magnitude":4.22,"name":"天津增廿八","tone":"blue"},{"ra":23.2387,"dec":-6.049,"magnitude":4.22,"name":"垒壁阵八","tone":"warm"},{"ra":0.3345,"dec":-64.8748,"magnitude":4.23,"name":"鸟喙六","tone":"white"},{"ra":7.7219,"dec":28.8835,"magnitude":4.23,"name":"北河增四","tone":"white"},{"ra":13.1979,"dec":27.8782,"magnitude":4.23,"name":"周鼎一","tone":"white"},{"ra":13.7615,"dec":-33.0437,"magnitude":4.23,"name":"柱九[角宿]","tone":"white"},{"ra":14.0274,"dec":1.5445,"magnitude":4.23,"name":"天田增七[角宿]","tone":"blue"},{"ra":16.1462,"dec":44.9349,"magnitude":4.23,"name":"七公三","tone":"blue"},{"ra":16.718,"dec":-77.5174,"magnitude":4.23,"name":"异雀三","tone":"white"},{"ra":19.107,"dec":-37.0634,"magnitude":4.23,"name":"鳖七","tone":"white"},{"ra":21.7251,"dec":58.78,"magnitude":4.23,"name":"造父四","tone":"warm"},{"ra":21.7799,"dec":49.3096,"magnitude":4.23,"name":"螣蛇三","tone":"blue"},{"ra":1.1458,"dec":86.2571,"magnitude":4.24,"name":"勾陈五","tone":"warm"},{"ra":2.4498,"dec":-47.7038,"magnitude":4.24,"name":"天园四","tone":"blue"},{"ra":2.7354,"dec":-13.8587,"magnitude":4.24,"name":"天苑七","tone":"blue"},{"ra":12.3058,"dec":-79.3122,"magnitude":4.24,"name":"小斗一","tone":"blue"},{"ra":12.5624,"dec":41.3575,"magnitude":4.24,"name":"常陈四","tone":"white"},{"ra":16.523,"dec":-34.7044,"magnitude":4.24,"name":"N","tone":"blue"},{"ra":17.6902,"dec":-12.8753,"magnitude":4.24,"name":"市楼二","tone":"blue"},{"ra":23.2649,"dec":-9.0877,"magnitude":4.24,"name":"羽林军卅九","tone":"white"},{"ra":1.2628,"dec":-68.8759,"magnitude":4.25,"name":"κ","tone":"white"},{"ra":4.1097,"dec":50.3513,"magnitude":4.25,"name":"积水[胃宿]","tone":"blue"},{"ra":4.5942,"dec":10.1608,"magnitude":4.25,"name":"天节七","tone":"blue"},{"ra":4.6115,"dec":41.2648,"magnitude":4.25,"name":"五车增三","tone":"warm"},{"ra":5.1524,"dec":-8.7541,"magnitude":4.25,"name":"玉井一","tone":"blue"},{"ra":8.3806,"dec":43.1881,"magnitude":4.25,"name":"上台增四","tone":"warm"},{"ra":12.8906,"dec":-40.1789,"magnitude":4.25,"name":"n","tone":"white"},{"ra":14.4588,"dec":75.696,"magnitude":4.25,"name":"庶子","tone":"warm"},{"ra":21.7575,"dec":61.1208,"magnitude":4.25,"name":"造父增五","tone":"white"},{"ra":1.1584,"dec":47.2418,"magnitude":4.26,"name":"军南门","tone":"blue"},{"ra":1.7566,"dec":9.1577,"magnitude":4.26,"name":"右更四","tone":"white"},{"ra":3.3321,"dec":-43.0698,"magnitude":4.26,"name":"天园增三","tone":"white"},{"ra":3.5631,"dec":-21.6329,"magnitude":4.26,"name":"天苑十二","tone":"blue"},{"ra":4.2671,"dec":-51.4866,"magnitude":4.26,"name":"金鱼一","tone":"white"},{"ra":4.9008,"dec":66.3427,"magnitude":4.26,"name":"少卫","tone":"blue"},{"ra":8.9748,"dec":11.8577,"magnitude":4.26,"name":"柳宿增十三","tone":"blue"},{"ra":17.6091,"dec":-38.6353,"magnitude":4.26,"name":"尾宿增三","tone":"white"},{"ra":18.0251,"dec":21.5958,"magnitude":4.26,"name":"帛度一","tone":"white"},{"ra":22.0632,"dec":64.628,"magnitude":4.26,"name":"天钩六","tone":"white"},{"ra":1.0491,"dec":7.8901,"magnitude":4.27,"name":"外屏二","tone":"white"},{"ra":2.749,"dec":10.1141,"magnitude":4.27,"name":"天囷四","tone":"white"},{"ra":4.2589,"dec":8.8924,"magnitude":4.27,"name":"毕宿增七","tone":"blue"},{"ra":4.636,"dec":12.5108,"magnitude":4.27,"name":"天节五","tone":"blue"},{"ra":4.7041,"dec":22.9569,"magnitude":4.27,"name":"诸王六","tone":"blue"},{"ra":13.1152,"dec":-49.9062,"magnitude":4.27,"name":"ξ2","tone":"blue"},{"ra":15.3089,"dec":-47.8753,"magnitude":4.27,"name":"骑官七","tone":"blue"},{"ra":19.387,"dec":-44.7998,"magnitude":4.27,"name":"天渊一","tone":"white"},{"ra":20.7776,"dec":16.1243,"magnitude":4.27,"name":"瓠瓜增七","tone":"white"},{"ra":23.4661,"dec":6.379,"magnitude":4.27,"name":"霹雳三","tone":"white"},{"ra":4.4385,"dec":22.8136,"magnitude":4.28,"name":"天街增三","tone":"white"},{"ra":9.6181,"dec":81.3264,"magnitude":4.28,"name":"四辅增一","tone":"warm"},{"ra":10.4525,"dec":-31.0678,"magnitude":4.28,"name":"α","tone":"warm"},{"ra":17.4559,"dec":-29.867,"magnitude":4.28,"name":"糠","tone":"white"},{"ra":20.2233,"dec":56.5677,"magnitude":4.28,"name":"奚仲增四","tone":"blue"},{"ra":21.3708,"dec":-16.8345,"magnitude":4.28,"name":"代一","tone":"white"},{"ra":22.1665,"dec":33.1782,"magnitude":4.28,"name":"杵二[危宿]","tone":"white"},{"ra":23.1146,"dec":-43.5204,"magnitude":4.28,"name":"鹤八","tone":"white"},{"ra":3.6146,"dec":0.4017,"magnitude":4.29,"name":"天囷增十五","tone":"white"},{"ra":5.3263,"dec":-13.1768,"magnitude":4.29,"name":"军井三","tone":"blue"},{"ra":10.6551,"dec":-55.6033,"magnitude":4.29,"name":"x","tone":"white"},{"ra":11.8818,"dec":-33.9081,"magnitude":4.29,"name":"青丘一","tone":"blue"},{"ra":15.7343,"dec":77.7945,"magnitude":4.29,"name":"勾陈四","tone":"blue"},{"ra":16.519,"dec":-16.6127,"magnitude":4.29,"name":"东咸一","tone":"white"},{"ra":22.1073,"dec":-13.8697,"magnitude":4.29,"name":"垒壁阵五","tone":"blue"},{"ra":22.5251,"dec":-32.3461,"magnitude":4.29,"name":"败臼增一","tone":"blue"},{"ra":23.6356,"dec":43.2681,"magnitude":4.29,"name":"螣蛇廿二","tone":"blue"},{"ra":0.9768,"dec":-29.3574,"magnitude":4.3,"name":"α","tone":"blue"},{"ra":2.4693,"dec":8.4601,"magnitude":4.3,"name":"天囷六","tone":"blue"},{"ra":3.7535,"dec":24.4673,"magnitude":4.3,"name":"昴宿二","tone":"blue"},{"ra":3.81,"dec":-37.6202,"magnitude":4.3,"name":"天园八","tone":"blue"},{"ra":4.4248,"dec":17.9279,"magnitude":4.3,"name":"毕宿二","tone":"blue"},{"ra":5.9989,"dec":45.9367,"magnitude":4.3,"name":"五车增十六","tone":"warm"},{"ra":8.7204,"dec":3.3987,"magnitude":4.3,"name":"柳宿三","tone":"blue"},{"ra":10.9269,"dec":24.7497,"magnitude":4.3,"name":"少微增九","tone":"blue"},{"ra":11.6158,"dec":-0.8237,"magnitude":4.3,"name":"明堂二","tone":"white"},{"ra":11.8281,"dec":-63.7885,"magnitude":4.3,"name":"j","tone":"blue"},{"ra":12.5345,"dec":-16.196,"magnitude":4.3,"name":"左辖","tone":"white"},{"ra":14.3388,"dec":-56.3865,"magnitude":4.3,"name":"v","tone":"blue"},{"ra":20.2941,"dec":-12.5082,"magnitude":4.3,"name":"牛宿增六","tone":"white"},{"ra":8.677,"dec":-59.761,"magnitude":4.31,"name":"d","tone":"blue"},{"ra":14.4487,"dec":-83.6679,"magnitude":4.31,"name":"异雀五","tone":"warm"},{"ra":15.4082,"dec":37.3772,"magnitude":4.31,"name":"七公六","tone":"white"},{"ra":16.1234,"dec":-20.8688,"magnitude":4.31,"name":"钩钤二","tone":"white"},{"ra":20.639,"dec":-1.1051,"magnitude":4.31,"name":"离珠二","tone":"white"},{"ra":3.6082,"dec":48.1926,"magnitude":4.32,"name":"天船四","tone":"blue"},{"ra":4.674,"dec":-19.6715,"magnitude":4.32,"name":"九斿八","tone":"warm"},{"ra":5.5369,"dec":18.5942,"magnitude":4.32,"name":"The Ruby Star","tone":"warm"},{"ra":6.2563,"dec":29.4981,"magnitude":4.32,"name":"井宿增一","tone":"white"},{"ra":8.7729,"dec":-13.5477,"magnitude":4.32,"name":"外厨增九","tone":"white"},{"ra":9.5287,"dec":22.968,"magnitude":4.32,"name":"轩辕八","tone":"warm"},{"ra":12.0504,"dec":-63.3129,"magnitude":4.32,"name":"θ1","tone":"white"},{"ra":13.1665,"dec":17.5294,"magnitude":4.32,"name":"东上将","tone":"white"},{"ra":13.8638,"dec":-32.9941,"magnitude":4.32,"name":"柱八[角宿]","tone":"blue"},{"ra":14.8606,"dec":-43.5754,"magnitude":4.32,"name":"骑官九","tone":"blue"},{"ra":17.3471,"dec":-12.8469,"magnitude":4.32,"name":"市楼增一","tone":"blue"},{"ra":7.4694,"dec":8.9255,"magnitude":4.33,"name":"南河增一","tone":"warm"},{"ra":12.8853,"dec":-48.9433,"magnitude":4.33,"name":"e","tone":"warm"},{"ra":14.4363,"dec":-45.3793,"magnitude":4.33,"name":"τ2","tone":"white"},{"ra":17.2558,"dec":-26.6028,"magnitude":4.33,"name":"天江二","tone":"white"},{"ra":18.143,"dec":-63.6686,"magnitude":4.33,"name":"孔雀二","tone":"white"},{"ra":18.331,"dec":36.0645,"magnitude":4.33,"name":"织女增四","tone":"warm"},{"ra":0.6147,"dec":33.7193,"magnitude":4.34,"name":"奎宿六","tone":"blue"},{"ra":0.6426,"dec":29.3118,"magnitude":4.34,"name":"奎宿四","tone":"white"},{"ra":1.185,"dec":55.1499,"magnitude":4.34,"name":"阁道四","tone":"blue"},{"ra":5.7462,"dec":-65.7355,"magnitude":4.34,"name":"金鱼四","tone":"white"},{"ra":6.5309,"dec":-23.4184,"magnitude":4.34,"name":"军市六","tone":"blue"},{"ra":8.344,"dec":-77.4845,"magnitude":4.34,"name":"小斗八","tone":"warm"},{"ra":9.27,"dec":-57.5415,"magnitude":4.34,"name":"g","tone":"warm"},{"ra":9.6138,"dec":-49.355,"magnitude":4.34,"name":"M","tone":"blue"},{"ra":14.0287,"dec":-45.6034,"magnitude":4.34,"name":"柱一[角宿]","tone":"white"},{"ra":15.6342,"dec":-42.5673,"magnitude":4.34,"name":"ω","tone":"warm"},{"ra":17.4419,"dec":4.1404,"magnitude":4.34,"name":"宗正增二","tone":"warm"},{"ra":18.7462,"dec":37.6051,"magnitude":4.34,"name":"织女三","tone":"blue"},{"ra":18.7837,"dec":18.1815,"magnitude":4.34,"name":"宗二","tone":"blue"},{"ra":21.7419,"dec":17.35,"magnitude":4.34,"name":"人四","tone":"warm"},{"ra":22.4922,"dec":47.7069,"magnitude":4.34,"name":"车府增十九","tone":"warm"},{"ra":3.1938,"dec":19.7267,"magnitude":4.35,"name":"天阴增六","tone":"white"},{"ra":4.8435,"dec":8.9002,"magnitude":4.35,"name":"参旗五","tone":"blue"},{"ra":6.5829,"dec":-52.9756,"magnitude":4.35,"name":"N","tone":"blue"},{"ra":6.9546,"dec":58.4228,"magnitude":4.35,"name":"八谷增卅","tone":"white"},{"ra":8.1322,"dec":-68.6171,"magnitude":4.35,"name":"ε","tone":"blue"},{"ra":8.8072,"dec":5.8378,"magnitude":4.35,"name":"柳宿四","tone":"blue"},{"ra":12.449,"dec":28.2684,"magnitude":4.35,"name":"郎位一","tone":"white"},{"ra":15.2972,"dec":-30.1487,"magnitude":4.35,"name":"阵车三","tone":"white"},{"ra":17.5369,"dec":86.5865,"magnitude":4.35,"name":"勾陈二","tone":"blue"},{"ra":18.3871,"dec":-61.4939,"magnitude":4.35,"name":"孔雀增二","tone":"warm"},{"ra":19.2728,"dec":38.1337,"magnitude":4.35,"name":"辇道三","tone":"warm"},{"ra":21.7491,"dec":-33.0258,"magnitude":4.35,"name":"天钱三","tone":"blue"},{"ra":0.5257,"dec":-62.9582,"magnitude":4.36,"name":"鸟喙四","tone":"blue"},{"ra":0.7226,"dec":-57.4631,"magnitude":4.36,"name":"水委三","tone":"blue"},{"ra":2.2167,"dec":8.8467,"magnitude":4.36,"name":"天囷五","tone":"white"},{"ra":3.5096,"dec":47.9952,"magnitude":4.36,"name":"天船增四","tone":"warm"},{"ra":4.0783,"dec":22.0819,"magnitude":4.36,"name":"月","tone":"white"},{"ra":4.8816,"dec":-5.4527,"magnitude":4.36,"name":"九斿三","tone":"white"},{"ra":5.2205,"dec":-12.9413,"magnitude":4.36,"name":"军井二","tone":"blue"},{"ra":5.9589,"dec":-35.2833,"magnitude":4.36,"name":"子增一","tone":"blue"},{"ra":6.9356,"dec":-17.0542,"magnitude":4.36,"name":"天狼增五","tone":"blue"},{"ra":8.1432,"dec":-2.9838,"magnitude":4.36,"name":"外厨增一","tone":"white"},{"ra":14.1008,"dec":-41.1796,"magnitude":4.36,"name":"衡四","tone":"blue"},{"ra":19.612,"dec":-1.2866,"magnitude":4.36,"name":"右旗增六","tone":"blue"},{"ra":0.0327,"dec":-6.0141,"magnitude":4.37,"name":"垒壁阵十二","tone":"warm"},{"ra":6.2759,"dec":-35.1405,"magnitude":4.37,"name":"孙一","tone":"white"},{"ra":7.3118,"dec":-24.9544,"magnitude":4.37,"name":"弧矢增六","tone":"blue"},{"ra":11.0026,"dec":-42.2259,"magnitude":4.37,"name":"i","tone":"blue"},{"ra":18.146,"dec":20.8146,"magnitude":4.37,"name":"帛度二","tone":"blue"},{"ra":19.9956,"dec":-35.2763,"magnitude":4.37,"name":"天渊增二","tone":"blue"},{"ra":13.1658,"dec":-5.539,"magnitude":4.38,"name":"平道一","tone":"blue"},{"ra":20.1482,"dec":77.7114,"magnitude":4.38,"name":"天柱增二","tone":"blue"},{"ra":23.4341,"dec":-20.642,"magnitude":4.38,"name":"羽林军卅三","tone":"warm"},{"ra":23.5495,"dec":-37.8183,"magnitude":4.38,"name":"火鸟一","tone":"blue"},{"ra":1.8941,"dec":-46.3027,"magnitude":4.39,"name":"ψ","tone":"warm"},{"ra":3.8254,"dec":65.526,"magnitude":4.39,"name":"上丞增一","tone":"warm"},{"ra":5.5803,"dec":9.4896,"magnitude":4.39,"name":"觜宿二","tone":"blue"},{"ra":5.9064,"dec":20.2762,"magnitude":4.39,"name":"司怪四","tone":"white"},{"ra":6.3961,"dec":4.5929,"magnitude":4.39,"name":"四渎四","tone":"white"},{"ra":8.0378,"dec":2.3346,"magnitude":4.39,"name":"南河增八","tone":"warm"},{"ra":10.1317,"dec":9.9975,"magnitude":4.39,"name":"御女","tone":"warm"},{"ra":15.0483,"dec":2.0913,"magnitude":4.39,"name":"氐宿增廿七","tone":"white"},{"ra":16.9001,"dec":10.1654,"magnitude":4.39,"name":"斛一","tone":"blue"},{"ra":17.3501,"dec":-21.1129,"magnitude":4.39,"name":"天江增七","tone":"white"},{"ra":19.6683,"dec":18.0139,"magnitude":4.39,"name":"左旗一","tone":"white"},{"ra":19.6841,"dec":17.476,"magnitude":4.39,"name":"左旗二","tone":"white"},{"ra":21.3311,"dec":-53.4494,"magnitude":4.39,"name":"θ","tone":"blue"},{"ra":0.9534,"dec":23.4176,"magnitude":4.4,"name":"奎宿一","tone":"white"},{"ra":7.8014,"dec":-25.9372,"magnitude":4.4,"name":"弧矢五","tone":"blue"},{"ra":8.1505,"dec":-19.245,"magnitude":4.4,"name":"弧矢增十三","tone":"blue"},{"ra":18.9492,"dec":-67.2335,"magnitude":4.4,"name":"孔雀五","tone":"white"},{"ra":21.9653,"dec":-54.9926,"magnitude":4.4,"name":"波斯六","tone":"white"},{"ra":6.8309,"dec":-53.6224,"magnitude":4.41,"name":"A","tone":"white"},{"ra":7.1857,"dec":30.2452,"magnitude":4.41,"name":"五诸侯增六[井宿]","tone":"warm"},{"ra":14.384,"dec":-39.5118,"magnitude":4.41,"name":"柱五[角宿]","tone":"blue"},{"ra":17.5123,"dec":26.1106,"magnitude":4.41,"name":"赵","tone":"warm"},{"ra":17.975,"dec":30.1893,"magnitude":4.41,"name":"中山增二","tone":"white"},{"ra":21.2986,"dec":34.8969,"magnitude":4.41,"name":"天津七","tone":"blue"},{"ra":23.1316,"dec":75.3875,"magnitude":4.41,"name":"少卫","tone":"white"},{"ra":23.2984,"dec":-9.1825,"magnitude":4.41,"name":"羽林军卅八","tone":"blue"},{"ra":23.3137,"dec":-32.532,"magnitude":4.41,"name":"γ","tone":"white"},{"ra":6.1262,"dec":14.7685,"magnitude":4.42,"name":"水府一","tone":"blue"},{"ra":6.6315,"dec":-18.2375,"magnitude":4.42,"name":"军市二","tone":"white"},{"ra":7.2256,"dec":-44.6397,"magnitude":4.42,"name":"L2","tone":"warm"},{"ra":7.2376,"dec":-26.3525,"magnitude":4.42,"name":"弧矢增四","tone":"blue"},{"ra":8.2341,"dec":-40.3479,"magnitude":4.42,"name":"h2","tone":"warm"},{"ra":11.0388,"dec":20.1798,"magnitude":4.42,"name":"西上相增一","tone":"blue"},{"ra":14.8381,"dec":-27.9604,"magnitude":4.42,"name":"阵车增一","tone":"warm"},{"ra":15.7741,"dec":7.3531,"magnitude":4.42,"name":"蜀增一","tone":"white"},{"ra":18.0292,"dec":1.3051,"magnitude":4.42,"name":"宗人三","tone":"blue"},{"ra":22.3927,"dec":52.229,"magnitude":4.42,"name":"螣蛇十","tone":"white"},{"ra":23.423,"dec":23.4041,"magnitude":4.42,"name":"离宫六","tone":"white"},{"ra":3.769,"dec":-12.1016,"magnitude":4.43,"name":"天苑二","tone":"warm"},{"ra":4.2545,"dec":-7.6529,"magnitude":4.43,"name":"九州殊口增十一","tone":"white"},{"ra":4.9548,"dec":53.7521,"magnitude":4.43,"name":"八谷五","tone":"blue"},{"ra":19.2293,"dec":39.146,"magnitude":4.43,"name":"辇道增二","tone":"blue"},{"ra":20.0443,"dec":-27.7098,"magnitude":4.43,"name":"狗国三","tone":"warm"},{"ra":20.3977,"dec":32.1902,"magnitude":4.43,"name":"天津增十五","tone":"warm"},{"ra":20.7243,"dec":15.0746,"magnitude":4.43,"name":"瓠瓜三","tone":"white"},{"ra":20.7956,"dec":-5.0277,"magnitude":4.43,"name":"女宿四","tone":"warm"},{"ra":0.244,"dec":-18.9329,"magnitude":4.44,"name":"八魁六","tone":"warm"},{"ra":0.8114,"dec":7.5851,"magnitude":4.44,"name":"外屏一","tone":"warm"},{"ra":4.2747,"dec":-59.3022,"magnitude":4.44,"name":"ε","tone":"white"},{"ra":4.676,"dec":-41.8638,"magnitude":4.44,"name":"α","tone":"white"},{"ra":6.3271,"dec":59.011,"magnitude":4.44,"name":"八谷增廿六","tone":"blue"},{"ra":7.5676,"dec":-22.2961,"magnitude":4.44,"name":"GJ279","tone":"white"},{"ra":8.1893,"dec":-39.6185,"magnitude":4.44,"name":"h1","tone":"warm"},{"ra":8.3093,"dec":-36.6593,"magnitude":4.44,"name":"q","tone":"white"},{"ra":14.5436,"dec":-50.4572,"magnitude":4.44,"name":"车骑三","tone":"blue"},{"ra":19.4784,"dec":24.6649,"magnitude":4.44,"name":"齐增五","tone":"warm"},{"ra":1.6905,"dec":5.4876,"magnitude":4.45,"name":"外屏五","tone":"warm"},{"ra":2.8182,"dec":-32.4059,"magnitude":4.45,"name":"天庾三*","tone":"white"},{"ra":5.205,"dec":-11.8692,"magnitude":4.45,"name":"军井一","tone":"blue"},{"ra":6.199,"dec":14.2088,"magnitude":4.45,"name":"水府二","tone":"blue"},{"ra":8.646,"dec":3.3414,"magnitude":4.45,"name":"柳宿二","tone":"warm"},{"ra":9.0015,"dec":-41.2536,"magnitude":4.45,"name":"w","tone":"white"},{"ra":10.5931,"dec":-57.5576,"magnitude":4.45,"name":"r","tone":"warm"},{"ra":10.7631,"dec":-80.5402,"magnitude":4.45,"name":"小斗四","tone":"blue"},{"ra":11.2777,"dec":-3.6516,"magnitude":4.45,"name":"明堂增六","tone":"white"},{"ra":16.5356,"dec":-21.4664,"magnitude":4.45,"name":"东咸增二","tone":"blue"},{"ra":19.2592,"dec":73.3555,"magnitude":4.45,"name":"御女一","tone":"warm"},{"ra":19.5682,"dec":7.3789,"magnitude":4.45,"name":"右旗一","tone":"warm"},{"ra":2.4844,"dec":67.4025,"magnitude":4.46,"name":"阁道一","tone":"blue"},{"ra":3.9049,"dec":-2.9547,"magnitude":4.46,"name":"九州殊口增二","tone":"white"},{"ra":5.2215,"dec":2.8613,"magnitude":4.46,"name":"参宿增九","tone":"warm"},{"ra":9.1478,"dec":51.6046,"magnitude":4.46,"name":"文昌五","tone":"white"},{"ra":11.1943,"dec":-22.8258,"magnitude":4.46,"name":"翼宿十六","tone":"blue"},{"ra":12.1348,"dec":-50.6613,"magnitude":4.46,"name":"V0863","tone":"blue"},{"ra":16.4531,"dec":-47.5548,"magnitude":4.46,"name":"ε","tone":"blue"},{"ra":22.8754,"dec":-32.8755,"magnitude":4.46,"name":"败臼三","tone":"blue"},{"ra":2.7517,"dec":-18.5726,"magnitude":4.47,"name":"天苑增八","tone":"white"},{"ra":3.339,"dec":29.0485,"magnitude":4.47,"name":"HIP 15549","tone":"warm"},{"ra":4.9758,"dec":1.714,"magnitude":4.47,"name":"参旗九","tone":"warm"},{"ra":6.4695,"dec":-32.5801,"magnitude":4.47,"name":"孙增二","tone":"blue"},{"ra":6.5484,"dec":7.333,"magnitude":4.47,"name":"四渎三","tone":"blue"},{"ra":7.9707,"dec":-49.2449,"magnitude":4.47,"name":"V","tone":"blue"},{"ra":9.0858,"dec":-72.6027,"magnitude":4.47,"name":"G","tone":"white"},{"ra":9.4109,"dec":26.1823,"magnitude":4.47,"name":"轩辕七","tone":"warm"},{"ra":9.5804,"dec":52.0515,"magnitude":4.47,"name":"文昌增四","tone":"blue"},{"ra":11.8524,"dec":-45.1735,"magnitude":4.47,"name":"B","tone":"warm"},{"ra":14.578,"dec":29.7451,"magnitude":4.47,"name":"梗河二","tone":"white"},{"ra":14.9531,"dec":-4.3465,"magnitude":4.47,"name":"氐宿增廿九","tone":"white"},{"ra":21.2413,"dec":10.007,"magnitude":4.47,"name":"司非二","tone":"white"},{"ra":22.1019,"dec":-39.5434,"magnitude":4.47,"name":"败臼二","tone":"warm"},{"ra":0.7454,"dec":48.2844,"magnitude":4.48,"name":"阁道六","tone":"blue"},{"ra":4.0149,"dec":-62.1593,"magnitude":4.48,"name":"γ","tone":"warm"},{"ra":4.4391,"dec":15.6183,"magnitude":4.48,"name":"毕宿七","tone":"white"},{"ra":6.7977,"dec":2.4122,"magnitude":4.48,"name":"阙丘一","tone":"white"},{"ra":10.1323,"dec":-0.3716,"magnitude":4.48,"name":"α","tone":"blue"},{"ra":15.3896,"dec":-59.3208,"magnitude":4.48,"name":"γ","tone":"blue"},{"ra":16.4017,"dec":-20.0373,"magnitude":4.48,"name":"东咸三","tone":"white"},{"ra":23.0646,"dec":3.82,"magnitude":4.48,"name":"霹雳一","tone":"blue"},{"ra":23.1113,"dec":-23.7431,"magnitude":4.48,"name":"羽林军卅","tone":"white"},{"ra":2.0326,"dec":70.907,"magnitude":4.49,"name":"杠七","tone":"blue"},{"ra":4.5585,"dec":-29.7665,"magnitude":4.49,"name":"天园十三","tone":"white"},{"ra":6.7331,"dec":13.228,"magnitude":4.49,"name":"井宿增十八","tone":"warm"},{"ra":7.2093,"dec":-46.7593,"magnitude":4.49,"name":"I","tone":"white"},{"ra":7.8774,"dec":-38.8628,"magnitude":4.49,"name":"弧矢增廿一","tone":"blue"},{"ra":10.1238,"dec":35.2447,"magnitude":4.49,"name":"内平二","tone":"blue"},{"ra":14.6788,"dec":16.4183,"magnitude":4.49,"name":"左摄提二","tone":"blue"},{"ra":19.6074,"dec":50.2211,"magnitude":4.49,"name":"奚仲三","tone":"white"},{"ra":21.1188,"dec":-25.0059,"magnitude":4.49,"name":"天田三[牛宿]","tone":"warm"},{"ra":21.7357,"dec":28.7426,"magnitude":4.49,"name":"臼一","tone":"white"},{"ra":23.7008,"dec":1.78,"magnitude":4.49,"name":"云雨四","tone":"white"},{"ra":23.712,"dec":-14.5449,"magnitude":4.49,"name":"羽林军四五","tone":"blue"},{"ra":23.9986,"dec":-65.5771,"magnitude":4.49,"name":"鸟喙七","tone":"blue"},{"ra":5.6531,"dec":4.1215,"magnitude":4.5,"name":"参宿增十五","tone":"blue"},{"ra":5.8305,"dec":-56.1667,"magnitude":4.5,"name":"γ","tone":"white"},{"ra":8.7785,"dec":-56.7698,"magnitude":4.5,"name":"f","tone":"blue"},{"ra":10.3486,"dec":-56.0432,"magnitude":4.5,"name":"J","tone":"blue"},{"ra":11.7998,"dec":20.2189,"magnitude":4.5,"name":"太子","tone":"white"},{"ra":13.7877,"dec":17.4569,"magnitude":4.5,"name":"右摄提增五","tone":"white"},{"ra":20.2628,"dec":27.8142,"magnitude":4.5,"name":"左旗增十二","tone":"warm"},{"ra":21.1599,"dec":-11.3717,"magnitude":4.5,"name":"天垒城增二","tone":"white"},{"ra":21.4787,"dec":-21.8072,"magnitude":4.5,"name":"晋","tone":"white"},{"ra":22.1397,"dec":-32.9885,"magnitude":4.5,"name":"天钱四","tone":"blue"},{"ra":22.2313,"dec":39.7149,"magnitude":4.5,"name":"HIP 109754","tone":"warm"},{"ra":22.6752,"dec":44.2763,"magnitude":4.5,"name":"车府二","tone":"warm"},{"ra":0.3055,"dec":36.7852,"magnitude":4.51,"name":"天厩三","tone":"blue"},{"ra":1.1943,"dec":30.0896,"magnitude":4.51,"name":"奎宿十一","tone":"white"},{"ra":5.8196,"dec":39.1811,"magnitude":4.51,"name":"柱六[毕宿]","tone":"white"},{"ra":9.4874,"dec":-35.9513,"magnitude":4.51,"name":"ε","tone":"warm"},{"ra":9.6558,"dec":-61.3281,"magnitude":4.51,"name":"m","tone":"blue"},{"ra":15.6925,"dec":19.6704,"magnitude":4.51,"name":"周增七","tone":"blue"},{"ra":20.047,"dec":67.8736,"magnitude":4.51,"name":"天厨四","tone":"warm"},{"ra":20.734,"dec":-51.921,"magnitude":4.51,"name":"波斯九","tone":"white"},{"ra":21.618,"dec":-19.466,"magnitude":4.51,"name":"垒壁阵二","tone":"blue"},{"ra":22.4555,"dec":-64.9664,"magnitude":4.51,"name":"鸟喙二","tone":"blue"},{"ra":23.9064,"dec":57.4994,"magnitude":4.51,"name":"螣蛇十二","tone":"warm"},{"ra":2.7985,"dec":29.2471,"magnitude":4.52,"name":"胃宿二","tone":"white"},{"ra":13.3772,"dec":-60.9884,"magnitude":4.52,"name":"J","tone":"blue"},{"ra":13.4001,"dec":-64.5357,"magnitude":4.52,"name":"m","tone":"white"},{"ra":14.3185,"dec":-13.3711,"magnitude":4.52,"name":"亢宿四","tone":"blue"},{"ra":15.0741,"dec":26.9476,"magnitude":4.52,"name":"梗河增一","tone":"warm"},{"ra":18.1872,"dec":-45.9544,"magnitude":4.52,"name":"ε","tone":"white"},{"ra":19.3621,"dec":-15.955,"magnitude":4.52,"name":"建六","tone":"blue"},{"ra":20.7559,"dec":57.5797,"magnitude":4.52,"name":"螣蛇增一","tone":"white"},{"ra":21.4991,"dec":23.6388,"magnitude":4.52,"name":"人一","tone":"warm"},{"ra":22.5081,"dec":43.1234,"magnitude":4.52,"name":"车府增九","tone":"blue"},{"ra":0.526,"dec":-62.9656,"magnitude":4.53,"name":"β2","tone":"blue"},{"ra":0.8302,"dec":41.0789,"magnitude":4.53,"name":"奎宿七","tone":"blue"},{"ra":6.0009,"dec":-3.0743,"magnitude":4.53,"name":"参宿增廿三","tone":"warm"},{"ra":7.6228,"dec":-34.9685,"magnitude":4.53,"name":"f","tone":"blue"},{"ra":14.2247,"dec":51.79,"magnitude":4.53,"name":"Asellus Tertius","tone":"white"},{"ra":17.4439,"dec":-5.0866,"magnitude":4.53,"name":"47","tone":"white"},{"ra":17.7927,"dec":-27.8308,"magnitude":4.53,"name":"天籥八","tone":"white"},{"ra":20.7901,"dec":36.4907,"magnitude":4.53,"name":"天津增卅","tone":"blue"},{"ra":23.2092,"dec":49.4062,"magnitude":4.53,"name":"螣蛇十七","tone":"white"},{"ra":5.3029,"dec":33.3716,"magnitude":4.54,"name":"天潢增一","tone":"warm"},{"ra":6.5843,"dec":-22.9648,"magnitude":4.54,"name":"军市增二","tone":"blue"},{"ra":9.533,"dec":-1.1847,"magnitude":4.54,"name":"星宿三","tone":"blue"},{"ra":9.5704,"dec":36.3976,"magnitude":4.54,"name":"内平增六","tone":"white"},{"ra":9.5747,"dec":69.8303,"magnitude":4.54,"name":"少辅","tone":"white"},{"ra":14.8565,"dec":19.1005,"magnitude":4.54,"name":"左摄提增一","tone":"white"},{"ra":15.2037,"dec":-19.7917,"magnitude":4.54,"name":"氐宿二","tone":"blue"},{"ra":15.3859,"dec":-36.8585,"magnitude":4.54,"name":"顿顽增一","tone":"blue"},{"ra":19.9491,"dec":-27.1699,"magnitude":4.54,"name":"狗国四","tone":"warm"},{"ra":23.1167,"dec":9.4095,"magnitude":4.54,"name":"雷电四","tone":"warm"},{"ra":23.4859,"dec":12.7606,"magnitude":4.54,"name":"雷电六","tone":"white"},{"ra":0.0623,"dec":-17.336,"magnitude":4.55,"name":"八魁二","tone":"blue"},{"ra":3.4985,"dec":58.8787,"magnitude":4.55,"name":"传舍八","tone":"white"},{"ra":5.0734,"dec":-35.483,"magnitude":4.55,"name":"γ","tone":"warm"},{"ra":7.0011,"dec":76.9774,"magnitude":4.55,"name":"六甲二","tone":"warm"},{"ra":7.4966,"dec":12.0066,"magnitude":4.55,"name":"水位一","tone":"warm"},{"ra":9.8684,"dec":54.0643,"magnitude":4.55,"name":"文昌三","tone":"blue"},{"ra":15.5981,"dec":-44.9584,"magnitude":4.55,"name":"d","tone":"blue"},{"ra":16.3439,"dec":-24.1693,"magnitude":4.55,"name":"心宿增三","tone":"white"},{"ra":18.1347,"dec":-28.4571,"magnitude":4.55,"name":"HIP 88839","tone":"white"},{"ra":21.6987,"dec":71.3114,"magnitude":4.55,"name":"上卫增二","tone":"white"},{"ra":22.3504,"dec":46.5366,"magnitude":4.55,"name":"车府三","tone":"blue"},{"ra":22.4086,"dec":49.4764,"magnitude":4.55,"name":"螣蛇二","tone":"blue"},{"ra":2.8586,"dec":35.0597,"magnitude":4.56,"name":"大陵增十六","tone":"warm"},{"ra":3.9791,"dec":-61.4002,"magnitude":4.56,"name":"δ","tone":"warm"},{"ra":5.8888,"dec":27.6123,"magnitude":4.56,"name":"诸王一","tone":"blue"},{"ra":9.1088,"dec":38.4522,"magnitude":4.56,"name":"轩辕二","tone":"white"},{"ra":11.2534,"dec":23.0955,"magnitude":4.56,"name":"虎贲","tone":"warm"},{"ra":14.4356,"dec":-45.2214,"magnitude":4.56,"name":"柱四[角宿]","tone":"blue"},{"ra":17.5943,"dec":-46.5057,"magnitude":4.56,"name":"杵一[箕宿]","tone":"blue"},{"ra":20.8688,"dec":27.097,"magnitude":4.56,"name":"天津增廿四","tone":"white"},{"ra":21.11,"dec":47.6484,"magnitude":4.56,"name":"车府增三","tone":"warm"},{"ra":3.6182,"dec":-40.2745,"magnitude":4.57,"name":"天园增四","tone":"white"},{"ra":16.4236,"dec":14.0333,"magnitude":4.57,"name":"斗增一","tone":"blue"},{"ra":16.4264,"dec":-23.4472,"magnitude":4.57,"name":"心宿增九","tone":"white"},{"ra":17.699,"dec":72.1488,"magnitude":4.57,"name":"女史增一","tone":"white"},{"ra":18.9125,"dec":22.6451,"magnitude":4.57,"name":"齐增一","tone":"white"},{"ra":19.1392,"dec":-40.4967,"magnitude":4.57,"name":"鳖四","tone":"white"},{"ra":19.891,"dec":24.0796,"magnitude":4.57,"name":"左旗增十七","tone":"blue"},{"ra":5.5898,"dec":-4.8384,"magnitude":4.58,"name":"伐一","tone":"blue"},{"ra":9.8613,"dec":-46.5476,"magnitude":4.58,"name":"m","tone":"warm"},{"ra":10.7256,"dec":-60.5666,"magnitude":4.58,"name":"w","tone":"warm"},{"ra":13.2049,"dec":-59.9206,"magnitude":4.58,"name":"V0831","tone":"blue"},{"ra":13.8572,"dec":64.7233,"magnitude":4.58,"name":"天乙","tone":"warm"},{"ra":16.2051,"dec":-27.9264,"magnitude":4.58,"name":"心宿增二","tone":"blue"},{"ra":17.6308,"dec":-8.1188,"magnitude":4.58,"name":"市楼一","tone":"blue"},{"ra":23.344,"dec":23.7403,"magnitude":4.58,"name":"离宫五","tone":"blue"},{"ra":0.6888,"dec":-46.085,"magnitude":4.59,"name":"火鸟七","tone":"white"},{"ra":3.7139,"dec":-37.3135,"magnitude":4.59,"name":"天园七","tone":"warm"},{"ra":3.8393,"dec":71.3323,"magnitude":4.59,"name":"杠一","tone":"blue"},{"ra":5.4473,"dec":3.0957,"magnitude":4.59,"name":"参宿增十一","tone":"blue"},{"ra":8.6702,"dec":64.3279,"magnitude":4.59,"name":"内阶增七","tone":"warm"},{"ra":9.4858,"dec":-2.769,"magnitude":4.59,"name":"星宿二","tone":"white"},{"ra":10.3269,"dec":-55.0293,"magnitude":4.59,"name":"GZ","tone":"warm"},{"ra":11.21,"dec":-60.3176,"magnitude":4.59,"name":"y","tone":"white"},{"ra":15.8266,"dec":26.0684,"magnitude":4.59,"name":"贯索六","tone":"white"},{"ra":15.8935,"dec":-25.3271,"magnitude":4.59,"name":"房宿增五","tone":"blue"},{"ra":18.7397,"dec":39.6127,"magnitude":4.59,"name":"织女增二","tone":"blue"},{"ra":19.6118,"dec":-24.8836,"magnitude":4.59,"name":"狗一","tone":"blue"},{"ra":23.8154,"dec":-28.1303,"magnitude":4.59,"name":"δ","tone":"blue"},{"ra":4.3041,"dec":50.2955,"magnitude":4.6,"name":"天船增十","tone":"blue"},{"ra":10.0854,"dec":-13.0646,"magnitude":4.6,"name":"张宿增一","tone":"blue"},{"ra":10.9453,"dec":-37.1378,"magnitude":4.6,"name":"ι","tone":"white"},{"ra":14.754,"dec":16.9643,"magnitude":4.6,"name":"左摄提一","tone":"white"},{"ra":15.4223,"dec":-38.7336,"magnitude":4.6,"name":"k","tone":"blue"},{"ra":15.8779,"dec":42.4515,"magnitude":4.6,"name":"七公四","tone":"white"},{"ra":19.3445,"dec":65.7145,"magnitude":4.6,"name":"天厨六","tone":"blue"},{"ra":0.0889,"dec":-5.7076,"magnitude":4.61,"name":"垒壁阵十一","tone":"white"},{"ra":0.2849,"dec":38.6816,"magnitude":4.61,"name":"天厩一","tone":"blue"},{"ra":1.8926,"dec":3.1875,"magnitude":4.61,"name":"外屏六","tone":"white"},{"ra":3.1882,"dec":39.6116,"magnitude":4.61,"name":"大陵增廿一","tone":"white"},{"ra":7.4452,"dec":49.2115,"magnitude":4.61,"name":"座旗增九","tone":"blue"},{"ra":7.9978,"dec":-18.3992,"magnitude":4.61,"name":"HIP 39095","tone":"blue"},{"ra":15.5696,"dec":-10.0645,"magnitude":4.61,"name":"氐宿增十九","tone":"white"},{"ra":20.5651,"dec":35.2509,"magnitude":4.61,"name":"天津增十三","tone":"warm"},{"ra":0.9444,"dec":59.1811,"magnitude":4.62,"name":"王良增五","tone":"white"},{"ra":3.9987,"dec":-24.0162,"magnitude":4.62,"name":"天苑十六","tone":"blue"},{"ra":5.0516,"dec":21.59,"magnitude":4.62,"name":"天高一","tone":"blue"},{"ra":5.5322,"dec":-7.3015,"magnitude":4.62,"name":"参宿增卅六","tone":"blue"},{"ra":9.1341,"dec":-25.8585,"magnitude":4.62,"name":"κ","tone":"warm"},{"ra":11.0836,"dec":7.336,"magnitude":4.62,"name":"灵台一","tone":"white"},{"ra":11.109,"dec":-62.4241,"magnitude":4.62,"name":"z","tone":"white"},{"ra":11.5793,"dec":-54.2641,"magnitude":4.62,"name":"A","tone":"blue"},{"ra":12.773,"dec":-56.4888,"magnitude":4.62,"name":"HIP 62327","tone":"blue"},{"ra":12.9109,"dec":-59.1467,"magnitude":4.62,"name":"λ","tone":"blue"},{"ra":16.4634,"dec":-8.3717,"magnitude":4.62,"name":"车肆一","tone":"blue"},{"ra":18.0081,"dec":-3.6903,"magnitude":4.62,"name":"东海增一","tone":"white"},{"ra":18.5584,"dec":-42.3125,"magnitude":4.62,"name":"鳖十一","tone":"white"},{"ra":18.937,"dec":4.2036,"magnitude":4.62,"name":"徐","tone":"blue"},{"ra":2.9869,"dec":21.3404,"magnitude":4.63,"name":"左更增七","tone":"blue"},{"ra":7.7257,"dec":-28.4109,"magnitude":4.63,"name":"1","tone":"warm"},{"ra":7.8843,"dec":-49.613,"magnitude":4.63,"name":"HIP 38500","tone":"blue"},{"ra":8.7279,"dec":-7.2337,"magnitude":4.63,"name":"外厨二","tone":"white"},{"ra":9.2625,"dec":-37.4131,"magnitude":4.63,"name":"Markeb","tone":"white"},{"ra":12.6646,"dec":-39.9873,"magnitude":4.63,"name":"l","tone":"blue"},{"ra":13.679,"dec":54.6816,"magnitude":4.63,"name":"辅增一","tone":"warm"},{"ra":14.9597,"dec":65.9325,"magnitude":4.63,"name":"天床五","tone":"warm"},{"ra":15.8497,"dec":-25.7513,"magnitude":4.63,"name":"房宿增四","tone":"blue"},{"ra":16.0589,"dec":-57.7751,"magnitude":4.63,"name":"ι1","tone":"white"},{"ra":18.5229,"dec":-62.2783,"magnitude":4.63,"name":"孔雀三","tone":"blue"},{"ra":18.8534,"dec":59.3884,"magnitude":4.63,"name":"扶筐四","tone":"warm"},{"ra":23.9626,"dec":25.1414,"magnitude":4.63,"name":"壁宿增六","tone":"warm"},{"ra":3.8952,"dec":-24.6122,"magnitude":4.64,"name":"天苑十五","tone":"blue"},{"ra":4.9149,"dec":10.1508,"magnitude":4.64,"name":"参旗四","tone":"blue"},{"ra":6.0653,"dec":20.1385,"magnitude":4.64,"name":"司怪三","tone":"white"},{"ra":13.7776,"dec":-51.4328,"magnitude":4.64,"name":"M","tone":"white"},{"ra":15.6563,"dec":36.6358,"magnitude":4.64,"name":"七公增七","tone":"blue"},{"ra":15.6865,"dec":-44.6612,"magnitude":4.64,"name":"g","tone":"white"},{"ra":16.8306,"dec":-10.783,"magnitude":4.64,"name":"车肆二","tone":"white"},{"ra":17.2945,"dec":37.2915,"magnitude":4.64,"name":"女床二","tone":"blue"},{"ra":18.1218,"dec":8.7339,"magnitude":4.64,"name":"宗人增二","tone":"white"},{"ra":19.442,"dec":0.3386,"magnitude":4.64,"name":"右旗四","tone":"white"},{"ra":20.5885,"dec":14.6742,"magnitude":4.64,"name":"瓠瓜五","tone":"blue"},{"ra":22.6229,"dec":51.5451,"magnitude":4.64,"name":"螣蛇十五","tone":"white"},{"ra":23.0697,"dec":50.0521,"magnitude":4.64,"name":"螣蛇十六","tone":"white"},{"ra":2.7242,"dec":27.7071,"magnitude":4.65,"name":"胃宿一","tone":"blue"},{"ra":4.5641,"dec":14.8444,"magnitude":4.65,"name":"天节二","tone":"white"},{"ra":5.0762,"dec":15.4041,"magnitude":4.65,"name":"参旗增四","tone":"blue"},{"ra":5.9017,"dec":-63.0896,"magnitude":4.65,"name":"36","tone":"white"},{"ra":7.3051,"dec":-36.734,"magnitude":4.65,"name":"v1","tone":"blue"},{"ra":7.5118,"dec":-30.9623,"magnitude":4.65,"name":"HIP 36514","tone":"white"},{"ra":7.5897,"dec":-28.3693,"magnitude":4.65,"name":"p","tone":"blue"},{"ra":10.4568,"dec":-57.6388,"magnitude":4.65,"name":"P","tone":"white"},{"ra":12.0146,"dec":6.6143,"magnitude":4.65,"name":"内屏三","tone":"blue"},{"ra":16.0536,"dec":-49.2297,"magnitude":4.65,"name":"η","tone":"white"},{"ra":1.1909,"dec":21.0347,"magnitude":4.66,"name":"奎宿十五","tone":"white"},{"ra":1.8264,"dec":-10.6864,"magnitude":4.66,"name":"天仓增廿一","tone":"white"},{"ra":6.683,"dec":9.8958,"magnitude":4.66,"name":"四渎增一","tone":"blue"},{"ra":6.9271,"dec":-20.1365,"magnitude":4.66,"name":"军市增七","tone":"white"},{"ra":7.2764,"dec":-27.8812,"magnitude":4.66,"name":"HIP 35205","tone":"warm"},{"ra":8.7214,"dec":21.4685,"magnitude":4.66,"name":"鬼宿三","tone":"blue"},{"ra":9.094,"dec":-70.5385,"magnitude":4.66,"name":"E","tone":"blue"},{"ra":10.8997,"dec":43.19,"magnitude":4.66,"name":"天牢一","tone":"blue"},{"ra":12.6541,"dec":-7.9956,"magnitude":4.66,"name":"进贤增八","tone":"warm"},{"ra":12.7098,"dec":-48.8131,"magnitude":4.66,"name":"w","tone":"white"},{"ra":15.6628,"dec":-34.4119,"magnitude":4.66,"name":"从官增一[房宿]","tone":"white"},{"ra":18.0837,"dec":-29.5801,"magnitude":4.66,"name":"Nash","tone":"white"},{"ra":18.3009,"dec":-27.0426,"magnitude":4.66,"name":"HIP 89678","tone":"warm"},{"ra":18.3943,"dec":-8.9344,"magnitude":4.66,"name":"ζ","tone":"white"},{"ra":20.0183,"dec":27.7536,"magnitude":4.66,"name":"左旗增十","tone":"blue"},{"ra":1.2292,"dec":24.5837,"magnitude":4.67,"name":"奎宿十四","tone":"white"},{"ra":3.4895,"dec":49.5089,"magnitude":4.67,"name":"天船增三","tone":"blue"},{"ra":4.2481,"dec":40.4837,"magnitude":4.67,"name":"卷舌增六","tone":"white"},{"ra":4.6546,"dec":15.918,"magnitude":4.67,"name":"附耳增四","tone":"blue"},{"ra":6.1026,"dec":-14.9353,"magnitude":4.67,"name":"厕增五","tone":"blue"},{"ra":8.2035,"dec":17.6478,"magnitude":4.67,"name":"水位四","tone":"white"},{"ra":9.182,"dec":63.5136,"magnitude":4.67,"name":"内阶增十","tone":"white"},{"ra":18.0009,"dec":16.7509,"magnitude":4.67,"name":"帛度增三","tone":"warm"},{"ra":18.4866,"dec":-14.5658,"magnitude":4.67,"name":"γ","tone":"blue"},{"ra":18.739,"dec":39.6701,"magnitude":4.67,"name":"织女二","tone":"blue"},{"ra":19.5393,"dec":69.6612,"magnitude":4.67,"name":"天厨二","tone":"white"},{"ra":21.0215,"dec":-32.2578,"magnitude":4.67,"name":"离瑜增一","tone":"white"},{"ra":1.5655,"dec":59.232,"magnitude":4.68,"name":"阁道增四","tone":"white"},{"ra":1.9156,"dec":-67.6473,"magnitude":4.68,"name":"蛇腹四","tone":"white"},{"ra":2.0748,"dec":-29.2968,"magnitude":4.68,"name":"天庾一*","tone":"blue"},{"ra":2.9794,"dec":39.6627,"magnitude":4.68,"name":"积尸[胃宿]","tone":"blue"},{"ra":8.9387,"dec":-52.7235,"magnitude":4.68,"name":"H","tone":"blue"},{"ra":9.6409,"dec":4.6493,"magnitude":4.68,"name":"轩辕增四六","tone":"warm"},{"ra":10.0036,"dec":8.0442,"magnitude":4.68,"name":"轩辕增卅八","tone":"warm"},{"ra":10.6453,"dec":31.9762,"magnitude":4.68,"name":"势增十一","tone":"white"},{"ra":13.5327,"dec":-6.2558,"magnitude":4.68,"name":"角宿增三","tone":"warm"},{"ra":13.5742,"dec":49.016,"magnitude":4.68,"name":"三公二[紫微垣]","tone":"blue"},{"ra":16.3391,"dec":-78.6957,"magnitude":4.68,"name":"异雀六","tone":"warm"},{"ra":19.6563,"dec":30.1533,"magnitude":4.68,"name":"辇道增六","tone":"white"},{"ra":21.6292,"dec":-7.8542,"magnitude":4.68,"name":"天垒城一","tone":"blue"},{"ra":22.7265,"dec":-18.8304,"magnitude":4.68,"name":"羽林军十三","tone":"warm"},{"ra":4.4434,"dec":14.7138,"magnitude":4.69,"name":"天节一","tone":"white"},{"ra":5.319,"dec":40.0991,"magnitude":4.69,"name":"咸池三","tone":"white"},{"ra":7.6383,"dec":-25.3648,"magnitude":4.69,"name":"m","tone":"blue"},{"ra":7.8056,"dec":-47.0777,"magnitude":4.69,"name":"Q","tone":"white"},{"ra":8.0204,"dec":-1.3926,"magnitude":4.69,"name":"南河增九","tone":"warm"},{"ra":10.6458,"dec":-59.183,"magnitude":4.69,"name":"t2","tone":"warm"},{"ra":12.7606,"dec":-60.9813,"magnitude":4.69,"name":"ι","tone":"white"},{"ra":21.7016,"dec":51.1896,"magnitude":4.69,"name":"螣蛇四","tone":"blue"},{"ra":22.056,"dec":-56.786,"magnitude":4.69,"name":"ε","tone":"white"},{"ra":23.5846,"dec":-42.6151,"magnitude":4.69,"name":"火鸟二","tone":"blue"},{"ra":5.3408,"dec":-21.2398,"magnitude":4.7,"name":"HIP 24927","tone":"blue"},{"ra":11.6114,"dec":-9.8022,"magnitude":4.7,"name":"翼宿十三","tone":"blue"},{"ra":11.6702,"dec":-34.7447,"magnitude":4.7,"name":"青丘七","tone":"blue"},{"ra":16.8999,"dec":-42.362,"magnitude":4.7,"name":"尾宿三","tone":"white"},{"ra":18.7046,"dec":-9.0525,"magnitude":4.7,"name":"天弁二","tone":"white"},{"ra":19.9307,"dec":-26.2995,"magnitude":4.7,"name":"狗国一","tone":"white"},{"ra":21.1724,"dec":10.1316,"magnitude":4.7,"name":"司非一","tone":"white"},{"ra":22.9069,"dec":84.3462,"magnitude":4.7,"name":"勾陈六","tone":"warm"},{"ra":23.5546,"dec":-20.9145,"magnitude":4.7,"name":"羽林军卅一","tone":"blue"},{"ra":2.9953,"dec":8.9074,"magnitude":4.71,"name":"天囷三","tone":"blue"},{"ra":3.4896,"dec":-62.9375,"magnitude":4.71,"name":"κ","tone":"white"},{"ra":4.8755,"dec":14.2506,"magnitude":4.71,"name":"参旗一","tone":"warm"},{"ra":5.0918,"dec":-57.4727,"magnitude":4.71,"name":"ζ","tone":"white"},{"ra":5.4956,"dec":-1.0922,"magnitude":4.71,"name":"参宿增二","tone":"warm"},{"ra":5.5455,"dec":32.192,"magnitude":4.71,"name":"柱七[毕宿]","tone":"white"},{"ra":9.3582,"dec":-25.9654,"magnitude":4.71,"name":"θ","tone":"warm"},{"ra":9.3867,"dec":-28.8339,"magnitude":4.71,"name":"λ","tone":"white"},{"ra":11.746,"dec":-18.3507,"magnitude":4.71,"name":"翼宿三","tone":"white"},{"ra":13.1046,"dec":-48.4633,"magnitude":4.71,"name":"库楼六","tone":"blue"},{"ra":13.9608,"dec":-63.6867,"magnitude":4.71,"name":"HIP 68191","tone":"white"},{"ra":19.9041,"dec":8.4615,"magnitude":4.71,"name":"河鼓增八","tone":"white"},{"ra":21.299,"dec":-32.1725,"magnitude":4.71,"name":"离瑜二","tone":"blue"},{"ra":23.1652,"dec":-22.4576,"magnitude":4.71,"name":"羽林军廿九","tone":"white"},{"ra":1.4322,"dec":68.13,"magnitude":4.72,"name":"华盖五","tone":"white"},{"ra":5.3627,"dec":-0.3825,"magnitude":4.72,"name":"参宿增五","tone":"blue"},{"ra":5.8507,"dec":37.3056,"magnitude":4.72,"name":"柱四[毕宿]","tone":"warm"},{"ra":6.1716,"dec":-54.9686,"magnitude":4.72,"name":"δ","tone":"blue"},{"ra":8.1879,"dec":-12.927,"magnitude":4.72,"name":"外厨增十六","tone":"white"},{"ra":9.4551,"dec":-22.3438,"magnitude":4.72,"name":"G","tone":"warm"},{"ra":10.4319,"dec":33.7961,"magnitude":4.72,"name":"势增十九","tone":"white"},{"ra":10.5056,"dec":-71.9928,"magnitude":4.72,"name":"K","tone":"blue"},{"ra":10.5539,"dec":40.4256,"magnitude":4.72,"name":"HIP 51658","tone":"white"},{"ra":12.072,"dec":-63.1657,"magnitude":4.72,"name":"θ2","tone":"blue"},{"ra":12.3453,"dec":17.7929,"magnitude":4.72,"name":"五诸侯增六[太微垣]","tone":"white"},{"ra":13.2924,"dec":40.5726,"magnitude":4.72,"name":"常陈增三","tone":"white"},{"ra":16.0466,"dec":46.0367,"magnitude":4.72,"name":"七公增四","tone":"blue"},{"ra":17.2769,"dec":-0.4453,"magnitude":4.72,"name":"宗正增三","tone":"white"},{"ra":21.711,"dec":-18.8663,"magnitude":4.72,"name":"垒壁阵一","tone":"white"},{"ra":2.4271,"dec":50.2786,"magnitude":4.73,"name":"大陵增九","tone":"warm"},{"ra":6.9107,"dec":13.1778,"magnitude":4.73,"name":"井宿增十三","tone":"white"},{"ra":8.1905,"dec":-42.9873,"magnitude":4.73,"name":"HIP 40096","tone":"blue"},{"ra":11.0305,"dec":-2.4846,"magnitude":4.73,"name":"灵台增五","tone":"warm"},{"ra":16.1082,"dec":-45.1732,"magnitude":4.73,"name":"δ","tone":"white"},{"ra":16.1495,"dec":36.4909,"magnitude":4.73,"name":"贯索增六","tone":"white"},{"ra":20.8776,"dec":-8.9833,"magnitude":4.73,"name":"女宿二","tone":"white"},{"ra":0.5295,"dec":54.5223,"magnitude":4.74,"name":"王良五","tone":"blue"},{"ra":1.3244,"dec":27.2641,"magnitude":4.74,"name":"奎宿增廿三","tone":"blue"},{"ra":2.5348,"dec":-15.2447,"magnitude":4.74,"name":"天苑增九","tone":"white"},{"ra":2.6633,"dec":-42.8917,"magnitude":4.74,"name":"天园五","tone":"blue"},{"ra":3.3331,"dec":65.6523,"magnitude":4.74,"name":"上丞","tone":"blue"},{"ra":3.5103,"dec":-5.0751,"magnitude":4.74,"name":"天苑增十四","tone":"blue"},{"ra":8.1502,"dec":-61.3024,"magnitude":4.74,"name":"B","tone":"white"},{"ra":8.687,"dec":-47.3171,"magnitude":4.74,"name":"n","tone":"blue"},{"ra":9.0424,"dec":67.6296,"magnitude":4.74,"name":"三师一","tone":"warm"},{"ra":13.3068,"dec":-18.3112,"magnitude":4.74,"name":"天门增四","tone":"white"},{"ra":14.1652,"dec":-53.4389,"magnitude":4.74,"name":"HIP 69191","tone":"white"},{"ra":15.8544,"dec":20.9779,"magnitude":4.74,"name":"贯索增十三","tone":"warm"},{"ra":17.9965,"dec":-23.8161,"magnitude":4.74,"name":"天籥增二","tone":"blue"},{"ra":19.0519,"dec":-42.0951,"magnitude":4.74,"name":"鳖三","tone":"blue"},{"ra":19.5295,"dec":34.453,"magnitude":4.74,"name":"辇道增九","tone":"blue"},{"ra":20.9971,"dec":47.521,"magnitude":4.74,"name":"车府五","tone":"blue"},{"ra":22.0552,"dec":-2.1554,"magnitude":4.74,"name":"盖屋一","tone":"blue"},{"ra":23.6308,"dec":-45.4924,"magnitude":4.74,"name":"火鸟增一","tone":"blue"},{"ra":7.2439,"dec":-48.2719,"magnitude":4.75,"name":"HIP 35020","tone":"blue"},{"ra":11.804,"dec":-66.8149,"magnitude":4.75,"name":"μ","tone":"warm"},{"ra":13.8868,"dec":-31.9276,"magnitude":4.75,"name":"柱七[角宿]","tone":"blue"},{"ra":14.2694,"dec":51.3672,"magnitude":4.75,"name":"天枪二","tone":"white"},{"ra":15.6991,"dec":-19.6788,"magnitude":4.75,"name":"日","tone":"warm"},{"ra":15.7114,"dec":-34.7104,"magnitude":4.75,"name":"从官一[房宿]","tone":"blue"},{"ra":20.593,"dec":-60.5817,"magnitude":4.75,"name":"φ1","tone":"white"},{"ra":23.3104,"dec":68.1114,"magnitude":4.75,"name":"天钩九","tone":"white"},{"ra":0.5236,"dec":-48.8035,"magnitude":4.76,"name":"火鸟八","tone":"blue"},{"ra":2.8412,"dec":-75.0669,"magnitude":4.76,"name":"附白二","tone":"warm"},{"ra":2.8506,"dec":-21.004,"magnitude":4.76,"name":"天苑九","tone":"white"},{"ra":5.874,"dec":1.8551,"magnitude":4.76,"name":"参宿增廿二","tone":"warm"},{"ra":6.3141,"dec":69.3198,"magnitude":4.76,"name":"上卫增二","tone":"blue"},{"ra":7.9611,"dec":-30.3346,"magnitude":4.76,"name":"弧矢四","tone":"blue"},{"ra":9.6881,"dec":-23.5915,"magnitude":4.76,"name":"I","tone":"blue"},{"ra":10.7039,"dec":-64.4664,"magnitude":4.76,"name":"V0518","tone":"blue"},{"ra":11.3189,"dec":38.1856,"magnitude":4.76,"name":"天牢增二","tone":"blue"},{"ra":12.4004,"dec":51.5623,"magnitude":4.76,"name":"相","tone":"white"},{"ra":12.9821,"dec":17.4094,"magnitude":4.76,"name":"五诸侯二[太微垣]","tone":"warm"},{"ra":13.4575,"dec":-15.9736,"magnitude":4.76,"name":"天门二","tone":"white"},{"ra":13.8632,"dec":34.4442,"magnitude":4.76,"name":"AW","tone":"warm"},{"ra":14.377,"dec":-58.4591,"magnitude":4.76,"name":"HIP 70264","tone":"white"},{"ra":17.3665,"dec":-67.7707,"magnitude":4.76,"name":"异雀一","tone":"warm"},{"ra":17.6733,"dec":-49.4156,"magnitude":4.76,"name":"λ","tone":"white"},{"ra":19.2703,"dec":21.3904,"magnitude":4.76,"name":"齐增三","tone":"blue"},{"ra":21.632,"dec":62.0819,"magnitude":4.76,"name":"天钩增十","tone":"white"},{"ra":23.1185,"dec":25.4683,"magnitude":4.76,"name":"室宿增二","tone":"warm"},{"ra":0.7365,"dec":-10.6096,"magnitude":4.77,"name":"天溷四","tone":"white"},{"ra":3.0923,"dec":56.7057,"magnitude":4.77,"name":"k","tone":"white"},{"ra":5.6481,"dec":-7.2128,"magnitude":4.77,"name":"参宿增卅五","tone":"blue"},{"ra":6.7888,"dec":8.0373,"magnitude":4.77,"name":"四渎二","tone":"warm"},{"ra":9.3296,"dec":-11.9749,"magnitude":4.77,"name":"星宿六","tone":"white"},{"ra":11.5052,"dec":-3.0035,"magnitude":4.77,"name":"明堂增七","tone":"warm"},{"ra":12.9059,"dec":-9.539,"magnitude":4.77,"name":"进贤增五","tone":"warm"},{"ra":17.6159,"dec":68.758,"magnitude":4.77,"name":"尚书增一","tone":"white"},{"ra":18.0514,"dec":-8.1803,"magnitude":4.77,"name":"市楼三","tone":"white"},{"ra":18.5429,"dec":57.0456,"magnitude":4.77,"name":"扶筐二","tone":"white"},{"ra":20.0593,"dec":-37.9407,"magnitude":4.77,"name":"天渊增三","tone":"warm"},{"ra":20.2964,"dec":38.0329,"magnitude":4.77,"name":"天津增九","tone":"white"},{"ra":20.3444,"dec":-12.7591,"magnitude":4.77,"name":"牛宿增十一","tone":"blue"},{"ra":20.481,"dec":-17.8137,"magnitude":4.77,"name":"牛宿六","tone":"white"},{"ra":22.7914,"dec":83.1538,"magnitude":4.77,"name":"勾陈增一","tone":"warm"},{"ra":0.0266,"dec":-77.0657,"magnitude":4.78,"name":"θ","tone":"warm"},{"ra":0.8835,"dec":-1.1443,"magnitude":4.78,"name":"天溷增三","tone":"warm"},{"ra":2.1415,"dec":37.8591,"magnitude":4.78,"name":"天大将军增九","tone":"blue"},{"ra":3.7673,"dec":63.345,"magnitude":4.78,"name":"上丞增二","tone":"white"},{"ra":4.5093,"dec":16.194,"magnitude":4.78,"name":"毕宿增十五","tone":"blue"},{"ra":4.9988,"dec":-12.5374,"magnitude":4.78,"name":"九斿五","tone":"white"},{"ra":5.5841,"dec":-6.002,"magnitude":4.78,"name":"HIP 26199","tone":"blue"},{"ra":8.141,"dec":51.5067,"magnitude":4.78,"name":"上台增一","tone":"blue"},{"ra":8.2249,"dec":-35.8995,"magnitude":4.78,"name":"r","tone":"blue"},{"ra":9.7367,"dec":-27.7695,"magnitude":4.78,"name":"θ","tone":"white"},{"ra":10.3289,"dec":19.4709,"magnitude":4.78,"name":"轩辕增卅三","tone":"white"},{"ra":12.3751,"dec":25.8462,"magnitude":4.78,"name":"郎位七","tone":"white"},{"ra":13.2934,"dec":5.4699,"magnitude":4.78,"name":"天田增一[角宿]","tone":"warm"},{"ra":14.3452,"dec":-45.1871,"magnitude":4.78,"name":"HIP 70104","tone":"white"},{"ra":14.3849,"dec":-27.754,"magnitude":4.78,"name":"折威增二","tone":"warm"},{"ra":17.5236,"dec":-23.9626,"magnitude":4.78,"name":"天籥六","tone":"blue"},{"ra":17.8364,"dec":-40.0904,"magnitude":4.78,"name":"Vanant","tone":"white"},{"ra":18.7575,"dec":-64.8713,"magnitude":4.78,"name":"孔雀增一","tone":"blue"},{"ra":22.3554,"dec":28.3305,"magnitude":4.78,"name":"臼四","tone":"blue"},{"ra":22.4643,"dec":4.6957,"magnitude":4.78,"name":"坟墓增二","tone":"white"},{"ra":0.2434,"dec":20.2067,"magnitude":4.79,"name":"壁宿增十九","tone":"warm"},{"ra":1.9655,"dec":23.5961,"magnitude":4.79,"name":"娄宿增五","tone":"white"},{"ra":4.8772,"dec":36.7032,"magnitude":4.79,"name":"五车增八","tone":"warm"},{"ra":8.3755,"dec":-48.4904,"magnitude":4.79,"name":"B","tone":"blue"},{"ra":9.3491,"dec":-62.4046,"magnitude":4.79,"name":"k","tone":"white"},{"ra":13.2542,"dec":-67.8946,"magnitude":4.79,"name":"η","tone":"blue"},{"ra":15.8539,"dec":35.6574,"magnitude":4.79,"name":"贯索增四","tone":"white"},{"ra":16.5035,"dec":-25.1152,"magnitude":4.79,"name":"心宿增五","tone":"blue"},{"ra":17.8196,"dec":-31.7032,"magnitude":4.79,"name":"HIP 87220","tone":"blue"},{"ra":18.0044,"dec":4.3686,"magnitude":4.79,"name":"宗人一","tone":"blue"},{"ra":20.2544,"dec":25.592,"magnitude":4.79,"name":"QR","tone":"blue"},{"ra":22.1635,"dec":72.3412,"magnitude":4.79,"name":"少卫增三","tone":"white"},{"ra":22.2603,"dec":-41.3467,"magnitude":4.79,"name":"鹤十二","tone":"white"},{"ra":0.7011,"dec":50.5125,"magnitude":4.8,"name":"阁道增二","tone":"blue"},{"ra":0.8845,"dec":61.124,"magnitude":4.8,"name":"王良增十四","tone":"white"},{"ra":3.2639,"dec":-8.8197,"magnitude":4.8,"name":"天苑五","tone":"white"},{"ra":4.3592,"dec":46.4989,"magnitude":4.8,"name":"天船增六","tone":"blue"},{"ra":4.4016,"dec":17.4441,"magnitude":4.8,"name":"毕宿增十二","tone":"blue"},{"ra":5.024,"dec":-7.174,"magnitude":4.8,"name":"玉井二","tone":"blue"},{"ra":6.6555,"dec":42.4889,"magnitude":4.8,"name":"座旗五","tone":"warm"},{"ra":9.1732,"dec":67.134,"magnitude":4.8,"name":"三师增一","tone":"white"},{"ra":9.2698,"dec":54.0219,"magnitude":4.8,"name":"文昌六","tone":"blue"},{"ra":9.3414,"dec":-9.5557,"magnitude":4.8,"name":"星宿五","tone":"white"},{"ra":10.7353,"dec":-63.9611,"magnitude":4.8,"name":"HIP 52502","tone":"blue"},{"ra":12.5809,"dec":22.6293,"magnitude":4.8,"name":"郎位十一","tone":"blue"},{"ra":13.1196,"dec":27.6247,"magnitude":4.8,"name":"周鼎三","tone":"warm"},{"ra":14.1475,"dec":77.5475,"magnitude":4.8,"name":"后宫","tone":"warm"},{"ra":14.2999,"dec":35.5095,"magnitude":4.8,"name":"A","tone":"white"},{"ra":14.7237,"dec":26.5279,"magnitude":4.8,"name":"梗河增五","tone":"warm"},{"ra":15.0351,"dec":25.0081,"magnitude":4.8,"name":"梗河增四","tone":"warm"},{"ra":16.305,"dec":-28.614,"magnitude":4.8,"name":"d","tone":"blue"},{"ra":17.2888,"dec":33.1001,"magnitude":4.8,"name":"天纪六","tone":"blue"},{"ra":20.2217,"dec":46.8157,"magnitude":4.8,"name":"天津三","tone":"blue"},{"ra":20.8874,"dec":44.3873,"magnitude":4.8,"name":"天津增卅二","tone":"blue"},{"ra":21.346,"dec":-40.8095,"magnitude":4.8,"name":"θ1","tone":"blue"},{"ra":22.4213,"dec":1.3774,"magnitude":4.8,"name":"坟墓四","tone":"blue"},{"ra":22.6959,"dec":29.3076,"magnitude":4.8,"name":"离宫三","tone":"blue"},{"ra":5.1617,"dec":15.5972,"magnitude":4.81,"name":"参旗增五","tone":"white"},{"ra":5.2293,"dec":-67.1853,"magnitude":4.81,"name":"夹白一","tone":"warm"},{"ra":5.2914,"dec":-34.8952,"magnitude":4.81,"name":"ο","tone":"white"},{"ra":5.9666,"dec":25.9539,"magnitude":4.81,"name":"司怪一","tone":"blue"},{"ra":8.0055,"dec":-63.5675,"magnitude":4.81,"name":"D","tone":"blue"},{"ra":9.5844,"dec":39.6215,"magnitude":4.81,"name":"HIP 47029","tone":"white"},{"ra":11.4102,"dec":-10.8593,"magnitude":4.81,"name":"翼宿十","tone":"warm"},{"ra":14.47,"dec":-2.228,"magnitude":4.81,"name":"亢宿三","tone":"white"},{"ra":18.4225,"dec":-20.5417,"magnitude":4.81,"name":"斗宿增三","tone":"warm"},{"ra":20.642,"dec":21.2012,"magnitude":4.81,"name":"瓠瓜增五","tone":"blue"},{"ra":20.8156,"dec":46.1141,"magnitude":4.81,"name":"天津增卅三","tone":"white"},{"ra":1.9528,"dec":-47.3853,"magnitude":4.82,"name":"HIP 9095","tone":"white"},{"ra":5.2238,"dec":38.4845,"magnitude":4.82,"name":"天潢五","tone":"blue"},{"ra":6.6546,"dec":-14.1458,"magnitude":4.82,"name":"HIP 31827","tone":"warm"},{"ra":6.8925,"dec":-20.2243,"magnitude":4.82,"name":"军市三","tone":"blue"},{"ra":7.5633,"dec":-14.5239,"magnitude":4.82,"name":"KQ","tone":"warm"},{"ra":10.3721,"dec":-41.65,"magnitude":4.82,"name":"r","tone":"white"},{"ra":10.5104,"dec":55.9805,"magnitude":4.82,"name":"天璇增一","tone":"white"},{"ra":12.4422,"dec":-51.4506,"magnitude":4.82,"name":"马尾一","tone":"blue"},{"ra":13.6243,"dec":36.2949,"magnitude":4.82,"name":"25","tone":"white"},{"ra":14.1733,"dec":25.0917,"magnitude":4.82,"name":"帝席一","tone":"white"},{"ra":16.0382,"dec":22.8045,"magnitude":4.82,"name":"贯索增十二","tone":"blue"},{"ra":16.3679,"dec":1.029,"magnitude":4.82,"name":"列肆一","tone":"white"},{"ra":16.8206,"dec":45.9833,"magnitude":4.82,"name":"七公增十六","tone":"blue"},{"ra":17.0177,"dec":-4.2226,"magnitude":4.82,"name":"车肆增二","tone":"warm"},{"ra":18.4331,"dec":65.5635,"magnitude":4.82,"name":"扶筐增二","tone":"warm"},{"ra":18.9066,"dec":71.2972,"magnitude":4.82,"name":"少弼","tone":"warm"},{"ra":21.0734,"dec":-19.855,"magnitude":4.82,"name":"周一","tone":"blue"},{"ra":22.3586,"dec":12.2052,"magnitude":4.82,"name":"土公吏一","tone":"blue"},{"ra":22.5108,"dec":-10.678,"magnitude":4.82,"name":"垒壁阵六","tone":"blue"},{"ra":23.2957,"dec":49.0153,"magnitude":4.82,"name":"螣蛇十八","tone":"warm"},{"ra":23.6961,"dec":-17.8165,"magnitude":4.82,"name":"𫓧钺增三","tone":"white"},{"ra":0.9167,"dec":58.9727,"magnitude":4.83,"name":"υ1","tone":"warm"},{"ra":1.4609,"dec":45.4067,"magnitude":4.83,"name":"天大将军增三","tone":"white"},{"ra":2.6594,"dec":-11.8722,"magnitude":4.83,"name":"刍藁六","tone":"white"},{"ra":2.7591,"dec":-67.6166,"magnitude":4.83,"name":"蛇腹一","tone":"blue"},{"ra":7.1475,"dec":-39.6557,"magnitude":4.83,"name":"A","tone":"blue"},{"ra":7.2769,"dec":-23.3156,"magnitude":4.83,"name":"145","tone":"warm"},{"ra":8.3564,"dec":-33.0544,"magnitude":4.83,"name":"w","tone":"warm"},{"ra":8.7071,"dec":-53.114,"magnitude":4.83,"name":"天社增四*","tone":"blue"},{"ra":13.0593,"dec":-49.5273,"magnitude":4.83,"name":"ξ1","tone":"blue"},{"ra":15.0631,"dec":47.6541,"magnitude":4.83,"name":"天枪增四","tone":"white"},{"ra":15.2138,"dec":-44.5004,"magnitude":4.83,"name":"e","tone":"blue"},{"ra":16.4774,"dec":41.8817,"magnitude":4.83,"name":"七公增十四","tone":"warm"},{"ra":17.0804,"dec":-34.1229,"magnitude":4.83,"name":"k","tone":"white"},{"ra":18.7679,"dec":26.6621,"magnitude":4.83,"name":"HIP 92088","tone":"warm"},{"ra":18.951,"dec":-5.8463,"magnitude":4.83,"name":"天弁五","tone":"white"},{"ra":18.9787,"dec":-37.1074,"magnitude":4.83,"name":"鳖八","tone":"white"},{"ra":1.5031,"dec":6.1438,"magnitude":4.84,"name":"外屏四","tone":"warm"},{"ra":2.2204,"dec":44.2317,"magnitude":4.84,"name":"天大将军增十二","tone":"warm"},{"ra":2.2842,"dec":34.2242,"magnitude":4.84,"name":"天大将军十一","tone":"white"},{"ra":3.3227,"dec":3.3702,"magnitude":4.84,"name":"天囷增十一","tone":"white"},{"ra":4.2323,"dec":9.2638,"magnitude":4.84,"name":"毕宿增八","tone":"white"},{"ra":5.6883,"dec":16.5341,"magnitude":4.84,"name":"天关增二","tone":"blue"},{"ra":7.6576,"dec":-38.308,"magnitude":4.84,"name":"弧矢增廿","tone":"blue"},{"ra":8.5888,"dec":-58.0092,"magnitude":4.84,"name":"e2","tone":"white"},{"ra":11.0093,"dec":3.6175,"magnitude":4.84,"name":"灵台三","tone":"white"},{"ra":11.7547,"dec":8.2581,"magnitude":4.84,"name":"内屏一","tone":"blue"},{"ra":14.3292,"dec":16.3069,"magnitude":4.84,"name":"亢池一","tone":"warm"},{"ra":16.5434,"dec":11.488,"magnitude":4.84,"name":"斗四","tone":"warm"},{"ra":16.682,"dec":64.589,"magnitude":4.84,"name":"尚书三","tone":"warm"},{"ra":16.7549,"dec":56.7819,"magnitude":4.84,"name":"Wo9578","tone":"white"},{"ra":19.9826,"dec":-26.1958,"magnitude":4.84,"name":"狗国二","tone":"white"},{"ra":22.725,"dec":-41.4143,"magnitude":4.84,"name":"鹤九","tone":"white"},{"ra":22.7605,"dec":-53.5001,"magnitude":4.84,"name":"鹤四","tone":"warm"},{"ra":23.1102,"dec":59.4198,"magnitude":4.84,"name":"螣蛇增十三","tone":"blue"},{"ra":3.199,"dec":74.3937,"magnitude":4.85,"name":"杠二","tone":"blue"},{"ra":3.3122,"dec":34.2227,"magnitude":4.85,"name":"HIP 15416","tone":"warm"},{"ra":7.4976,"dec":-23.0243,"magnitude":4.85,"name":"HIP 36431","tone":"white"},{"ra":10.149,"dec":-51.8113,"magnitude":4.85,"name":"Q","tone":"blue"},{"ra":13.2009,"dec":-37.803,"magnitude":4.85,"name":"GJ501.2","tone":"white"},{"ra":15.2941,"dec":-63.6105,"magnitude":4.85,"name":"ε","tone":"warm"},{"ra":17.9465,"dec":-44.3422,"magnitude":4.85,"name":"HIP 87846","tone":"warm"},{"ra":18.3478,"dec":3.3772,"magnitude":4.85,"name":"宗人增四","tone":"white"},{"ra":18.9744,"dec":-52.9386,"magnitude":4.85,"name":"λ","tone":"blue"},{"ra":0.4655,"dec":-33.0072,"magnitude":4.86,"name":"η","tone":"warm"},{"ra":3.3061,"dec":-22.5111,"magnitude":4.86,"name":"天苑增二","tone":"white"},{"ra":6.7706,"dec":59.4417,"magnitude":4.86,"name":"12","tone":"blue"},{"ra":8.6618,"dec":-29.5611,"magnitude":4.86,"name":"ζ","tone":"white"},{"ra":10.5849,"dec":75.7129,"magnitude":4.86,"name":"阴德增一","tone":"white"},{"ra":13.2869,"dec":-66.7834,"magnitude":4.86,"name":"HIP 64820","tone":"warm"},{"ra":14.3896,"dec":8.4466,"magnitude":4.86,"name":"HIP 70327","tone":"blue"},{"ra":14.6941,"dec":8.1618,"magnitude":4.86,"name":"左摄提增三","tone":"white"},{"ra":16.3683,"dec":30.892,"magnitude":4.86,"name":"天纪一","tone":"white"},{"ra":16.5681,"dec":-44.0453,"magnitude":4.86,"name":"μ","tone":"blue"},{"ra":16.6458,"dec":48.9283,"magnitude":4.86,"name":"七公一","tone":"warm"},{"ra":17.5378,"dec":55.173,"magnitude":4.86,"name":"天棓二","tone":"white"},{"ra":17.7238,"dec":-21.6832,"magnitude":4.86,"name":"天籥三","tone":"white"},{"ra":18.7387,"dec":-35.642,"magnitude":4.86,"name":"农丈人","tone":"blue"},{"ra":18.9028,"dec":-22.7448,"magnitude":4.86,"name":"建增六","tone":"warm"},{"ra":19.259,"dec":-25.2567,"magnitude":4.86,"name":"狗增六","tone":"white"},{"ra":20.6265,"dec":-61.5299,"magnitude":4.86,"name":"ρ","tone":"white"},{"ra":22.0947,"dec":5.0585,"magnitude":4.86,"name":"危宿增六","tone":"warm"},{"ra":1.3723,"dec":45.5288,"magnitude":4.87,"name":"天大将军增二","tone":"white"},{"ra":2.5979,"dec":5.5932,"magnitude":4.87,"name":"天囷七","tone":"white"},{"ra":3.2484,"dec":21.0444,"magnitude":4.87,"name":"天阴二","tone":"blue"},{"ra":4.2399,"dec":-10.2563,"magnitude":4.87,"name":"九州殊口一","tone":"warm"},{"ra":7.2204,"dec":-45.1827,"magnitude":4.87,"name":"L1","tone":"blue"},{"ra":8.6954,"dec":-15.9434,"magnitude":4.87,"name":"外厨增十","tone":"white"},{"ra":8.9254,"dec":-27.6819,"magnitude":4.87,"name":"天狗七","tone":"blue"},{"ra":9.9034,"dec":-25.9323,"magnitude":4.87,"name":"HIP 48559","tone":"warm"},{"ra":10.6205,"dec":-27.4126,"magnitude":4.87,"name":"HIP 51979","tone":"warm"},{"ra":10.7809,"dec":-64.3835,"magnitude":4.87,"name":"HIP 52736","tone":"blue"},{"ra":19.7727,"dec":-19.7611,"magnitude":4.87,"name":"天鸡二","tone":"white"},{"ra":21.5796,"dec":38.5341,"magnitude":4.87,"name":"车府增八","tone":"white"},{"ra":2.4325,"dec":-12.2905,"magnitude":4.88,"name":"刍藁一","tone":"blue"},{"ra":5.4606,"dec":21.937,"magnitude":4.88,"name":"天高增四","tone":"blue"},{"ra":5.8169,"dec":24.5675,"magnitude":4.88,"name":"诸王增四","tone":"white"},{"ra":5.8852,"dec":-33.8014,"magnitude":4.88,"name":"子一","tone":"blue"},{"ra":7.3112,"dec":-24.5587,"magnitude":4.88,"name":"弧矢增七","tone":"blue"},{"ra":11.9938,"dec":-78.2218,"magnitude":4.88,"name":"小斗二","tone":"blue"},{"ra":12.6981,"dec":10.2356,"magnitude":4.88,"name":"九卿一","tone":"blue"},{"ra":13.0046,"dec":30.785,"magnitude":4.88,"name":"周鼎二","tone":"warm"},{"ra":16.9338,"dec":65.1348,"magnitude":4.88,"name":"尚书五","tone":"white"},{"ra":17.9633,"dec":-41.7163,"magnitude":4.88,"name":"HIP 87936","tone":"warm"},{"ra":18.7253,"dec":-8.2752,"magnitude":4.88,"name":"天弁三","tone":"white"},{"ra":19.2939,"dec":-18.9529,"magnitude":4.88,"name":"建四","tone":"white"},{"ra":19.5869,"dec":-48.0992,"magnitude":4.88,"name":"ι","tone":"white"},{"ra":23.7843,"dec":58.652,"magnitude":4.88,"name":"螣蛇十三","tone":"white"},{"ra":23.9779,"dec":-3.556,"magnitude":4.88,"name":"垒壁阵九","tone":"white"},{"ra":23.9835,"dec":55.7549,"magnitude":4.88,"name":"螣蛇十一","tone":"blue"},{"ra":0.1877,"dec":-15.468,"magnitude":4.89,"name":"八魁一","tone":"white"},{"ra":4.8318,"dec":37.4883,"magnitude":4.89,"name":"五车增七","tone":"warm"},{"ra":5.4125,"dec":1.8464,"magnitude":4.89,"name":"参宿增七","tone":"blue"},{"ra":5.8258,"dec":12.6513,"magnitude":4.89,"name":"134","tone":"blue"},{"ra":7.6528,"dec":34.5843,"magnitude":4.89,"name":"北河增二","tone":"white"},{"ra":7.7687,"dec":18.51,"magnitude":4.89,"name":"水位增四","tone":"warm"},{"ra":10.5227,"dec":-53.7155,"magnitude":4.89,"name":"GJ397.2","tone":"white"},{"ra":10.6259,"dec":-13.3845,"magnitude":4.89,"name":"U","tone":"warm"},{"ra":11.7753,"dec":-40.5004,"magnitude":4.89,"name":"GJ442A","tone":"white"},{"ra":11.8642,"dec":-65.2059,"magnitude":4.89,"name":"HIP 57851","tone":"blue"},{"ra":12.8883,"dec":21.2449,"magnitude":4.89,"name":"五诸侯增二[太微垣]","tone":"white"},{"ra":14.3039,"dec":-81.0078,"magnitude":4.89,"name":"异雀七","tone":"white"},{"ra":17.0896,"dec":12.7408,"magnitude":4.89,"name":"宦者三","tone":"blue"},{"ra":17.5363,"dec":55.1842,"magnitude":4.89,"name":"天棓增一","tone":"white"},{"ra":19.7379,"dec":37.3544,"magnitude":4.89,"name":"辇道增四","tone":"white"},{"ra":20.8328,"dec":-33.7797,"magnitude":4.89,"name":"α","tone":"white"},{"ra":22.6544,"dec":39.0503,"magnitude":4.89,"name":"车府增十一","tone":"blue"},{"ra":23.5005,"dec":58.5489,"magnitude":4.89,"name":"螣蛇十四","tone":"blue"},{"ra":0.8139,"dec":50.9682,"magnitude":4.9,"name":"阁道五","tone":"blue"},{"ra":1.427,"dec":-14.5988,"magnitude":4.9,"name":"天仓增十五","tone":"warm"},{"ra":5.708,"dec":1.4746,"magnitude":4.9,"name":"参宿增十六","tone":"white"},{"ra":6.9603,"dec":45.0941,"magnitude":4.9,"name":"座旗二","tone":"blue"},{"ra":12.8448,"dec":-33.9993,"magnitude":4.9,"name":"p","tone":"blue"},{"ra":13.2375,"dec":-59.1032,"magnitude":4.9,"name":"GJ503AB","tone":"white"},{"ra":16.0567,"dec":-38.6025,"magnitude":4.9,"name":"HIP 78655","tone":"blue"},{"ra":16.0907,"dec":-19.8019,"magnitude":4.9,"name":"β2","tone":"blue"},{"ra":16.4745,"dec":-70.0844,"magnitude":4.9,"name":"ζ","tone":"white"},{"ra":19.8511,"dec":22.61,"magnitude":4.9,"name":"左旗增十八","tone":"blue"},{"ra":20.8247,"dec":-46.2268,"magnitude":4.9,"name":"ζ","tone":"warm"},{"ra":2.7041,"dec":40.1939,"magnitude":4.91,"name":"大陵八","tone":"white"},{"ra":4.5313,"dec":-0.044,"magnitude":4.91,"name":"九斿增二","tone":"warm"},{"ra":5.0238,"dec":-20.0519,"magnitude":4.91,"name":"HIP 23362","tone":"blue"},{"ra":5.1242,"dec":18.6451,"magnitude":4.91,"name":"天高增一","tone":"white"},{"ra":6.3332,"dec":-2.9445,"magnitude":4.91,"name":"HIP 30093","tone":"warm"},{"ra":7.1705,"dec":-4.2371,"magnitude":4.91,"name":"阙丘增五","tone":"white"},{"ra":7.1943,"dec":39.3205,"magnitude":4.91,"name":"座旗增六","tone":"warm"},{"ra":10.643,"dec":-16.8766,"magnitude":4.91,"name":"张宿六","tone":"white"},{"ra":12.699,"dec":-59.6858,"magnitude":4.91,"name":"39","tone":"blue"},{"ra":13.5799,"dec":37.1824,"magnitude":4.91,"name":"BH","tone":"white"},{"ra":15.0162,"dec":-8.5189,"magnitude":4.91,"name":"氐宿增一","tone":"blue"},{"ra":15.2437,"dec":-31.5191,"magnitude":4.91,"name":"顿顽二","tone":"white"},{"ra":16.6929,"dec":-17.7422,"magnitude":4.91,"name":"东咸增一","tone":"white"},{"ra":17.0889,"dec":54.47,"magnitude":4.91,"name":"天棓增九","tone":"white"},{"ra":19.9272,"dec":52.4389,"magnitude":4.91,"name":"ψ","tone":"blue"},{"ra":20.4942,"dec":-2.8855,"magnitude":4.91,"name":"离珠四","tone":"warm"},{"ra":20.6121,"dec":-2.55,"magnitude":4.91,"name":"离珠一","tone":"warm"},{"ra":22.55,"dec":-61.9821,"magnitude":4.91,"name":"ν","tone":"warm"},{"ra":22.9205,"dec":8.8162,"magnitude":4.91,"name":"雷电增二","tone":"blue"},{"ra":1.9445,"dec":-22.5268,"magnitude":4.92,"name":"𫓧锧五","tone":"warm"},{"ra":6.0307,"dec":-10.5979,"magnitude":4.92,"name":"参宿增卅一","tone":"blue"},{"ra":6.0831,"dec":-16.4844,"magnitude":4.92,"name":"厕增四","tone":"blue"},{"ra":6.415,"dec":49.2879,"magnitude":4.92,"name":"座旗增一","tone":"warm"},{"ra":7.0649,"dec":-49.5839,"magnitude":4.92,"name":"H","tone":"blue"},{"ra":7.5179,"dec":82.4115,"magnitude":4.92,"name":"六甲四","tone":"warm"},{"ra":9.2602,"dec":-38.5699,"magnitude":4.92,"name":"l","tone":"white"},{"ra":11.0889,"dec":-27.2936,"magnitude":4.92,"name":"翼宿廿","tone":"white"},{"ra":12.44,"dec":27.2682,"magnitude":4.92,"name":"郎位三","tone":"white"},{"ra":13.5689,"dec":3.659,"magnitude":4.92,"name":"天田一[角宿]","tone":"blue"},{"ra":13.8286,"dec":21.2641,"magnitude":4.92,"name":"右摄提增一","tone":"warm"},{"ra":14.7498,"dec":-35.1918,"magnitude":4.92,"name":"c2","tone":"blue"},{"ra":15.4033,"dec":-10.3223,"magnitude":4.92,"name":"氐宿增廿","tone":"white"},{"ra":18.1139,"dec":-43.4252,"magnitude":4.92,"name":"HIP 88726","tone":"white"},{"ra":18.3383,"dec":21.9613,"magnitude":4.92,"name":"屠肆增三","tone":"warm"},{"ra":18.5293,"dec":-45.9148,"magnitude":4.92,"name":"δ1","tone":"blue"},{"ra":18.8871,"dec":50.7082,"magnitude":4.92,"name":"HIP 92689","tone":"white"},{"ra":20.7479,"dec":25.2706,"magnitude":4.92,"name":"天津增廿三","tone":"warm"},{"ra":4.1807,"dec":-41.9936,"magnitude":4.93,"name":"δ","tone":"white"},{"ra":4.2877,"dec":20.5786,"magnitude":4.93,"name":"天街二","tone":"white"},{"ra":4.3402,"dec":34.5667,"magnitude":4.93,"name":"卷舌增三","tone":"white"},{"ra":4.9876,"dec":37.8902,"magnitude":4.93,"name":"五车增六","tone":"blue"},{"ra":7.5944,"dec":-52.5338,"magnitude":4.93,"name":"Q","tone":"warm"},{"ra":7.7168,"dec":58.7104,"magnitude":4.93,"name":"内阶增三","tone":"blue"},{"ra":7.9956,"dec":-3.6796,"magnitude":4.93,"name":"南河增十","tone":"warm"},{"ra":8.9496,"dec":-59.2293,"magnitude":4.93,"name":"b1","tone":"blue"},{"ra":9.704,"dec":-23.9156,"magnitude":4.93,"name":"GJ364","tone":"white"},{"ra":11.5379,"dec":-29.261,"magnitude":4.93,"name":"青丘三","tone":"white"},{"ra":11.6816,"dec":-62.0901,"magnitude":4.93,"name":"HIP 56986","tone":"white"},{"ra":12.2724,"dec":23.9454,"magnitude":4.93,"name":"郎位十","tone":"white"},{"ra":12.8616,"dec":27.5407,"magnitude":4.93,"name":"郎将","tone":"white"},{"ra":13.0121,"dec":56.3663,"magnitude":4.93,"name":"78","tone":"white"},{"ra":14.1807,"dec":-16.302,"magnitude":4.93,"name":"ET","tone":"warm"},{"ra":14.8503,"dec":-2.2992,"magnitude":4.93,"name":"亢宿增八","tone":"white"},{"ra":15.1217,"dec":24.8692,"magnitude":4.93,"name":"梗河增三","tone":"white"},{"ra":16.2,"dec":-10.0643,"magnitude":4.93,"name":"罚增二","tone":"blue"},{"ra":19.6148,"dec":-7.0275,"magnitude":4.93,"name":"右旗八","tone":"blue"},{"ra":20.1231,"dec":-52.8808,"magnitude":4.93,"name":"ξ","tone":"warm"},{"ra":20.1571,"dec":36.8396,"magnitude":4.93,"name":"天津增六","tone":"blue"},{"ra":20.2422,"dec":36.8063,"magnitude":4.93,"name":"天津增七","tone":"blue"},{"ra":20.7863,"dec":34.3741,"magnitude":4.93,"name":"天津增四十","tone":"warm"},{"ra":23.2808,"dec":-7.7265,"magnitude":4.93,"name":"羽林军四三","tone":"warm"},{"ra":23.7332,"dec":29.3615,"magnitude":4.93,"name":"壁宿增三","tone":"white"},{"ra":2.2062,"dec":30.3031,"magnitude":4.94,"name":"天大将军增六","tone":"white"},{"ra":2.9844,"dec":35.1831,"magnitude":4.94,"name":"24","tone":"warm"},{"ra":6.9378,"dec":-48.7211,"magnitude":4.94,"name":"HIP 33357","tone":"warm"},{"ra":7.3704,"dec":-19.0166,"magnitude":4.94,"name":"HIP 35727","tone":"blue"},{"ra":8.0586,"dec":27.7943,"magnitude":4.94,"name":"爟增三","tone":"white"},{"ra":8.8299,"dec":-45.3079,"magnitude":4.94,"name":"g","tone":"blue"},{"ra":9.9145,"dec":-19.0094,"magnitude":4.94,"name":"Felis","tone":"warm"},{"ra":10.4022,"dec":65.5664,"magnitude":4.94,"name":"ET","tone":"blue"},{"ra":10.5172,"dec":-73.2215,"magnitude":4.94,"name":"HIP 51495","tone":"warm"},{"ra":13.1509,"dec":-23.1181,"magnitude":4.94,"name":"平增一","tone":"white"},{"ra":13.2286,"dec":40.1529,"magnitude":4.94,"name":"HIP 64540","tone":"white"},{"ra":16.4664,"dec":68.7681,"magnitude":4.94,"name":"尚书二","tone":"blue"},{"ra":19.0002,"dec":32.1455,"magnitude":4.94,"name":"渐台增四","tone":"warm"},{"ra":20.2379,"dec":15.1976,"magnitude":4.94,"name":"左旗九","tone":"blue"},{"ra":20.501,"dec":48.9516,"magnitude":4.94,"name":"天津增卅五","tone":"blue"},{"ra":22.1691,"dec":-32.5484,"magnitude":4.94,"name":"天钱五","tone":"white"},{"ra":0.7245,"dec":47.0245,"magnitude":4.95,"name":"阁道增一","tone":"blue"},{"ra":1.3347,"dec":58.2316,"magnitude":4.95,"name":"阁道增三","tone":"white"},{"ra":3.9571,"dec":63.0723,"magnitude":4.95,"name":"上丞增三","tone":"blue"},{"ra":5.6808,"dec":-1.1288,"magnitude":4.95,"name":"HIP 26736","tone":"blue"},{"ra":6.2009,"dec":16.1304,"magnitude":4.95,"name":"水府四","tone":"blue"},{"ra":11.4656,"dec":2.8563,"magnitude":4.95,"name":"明堂一","tone":"white"},{"ra":12.5789,"dec":70.0218,"magnitude":4.95,"name":"少尉增一","tone":"warm"},{"ra":15.9698,"dec":-14.2794,"magnitude":4.95,"name":"西咸二","tone":"blue"},{"ra":16.2246,"dec":-54.6305,"magnitude":4.95,"name":"κ","tone":"white"},{"ra":16.2917,"dec":75.7553,"magnitude":4.95,"name":"勾陈增九","tone":"white"},{"ra":19.931,"dec":38.4867,"magnitude":4.95,"name":"天津增三","tone":"blue"},{"ra":20.0291,"dec":-59.3759,"magnitude":4.95,"name":"NU","tone":"warm"},{"ra":22.8672,"dec":43.3124,"magnitude":4.95,"name":"车府一","tone":"warm"},{"ra":23.4489,"dec":1.2556,"magnitude":4.95,"name":"云雨一","tone":"blue"},{"ra":23.7732,"dec":3.4868,"magnitude":4.95,"name":"云雨增七","tone":"warm"},{"ra":1.6763,"dec":40.577,"magnitude":4.96,"name":"天大将军增四","tone":"blue"},{"ra":1.6964,"dec":42.6134,"magnitude":4.96,"name":"GJ67","tone":"white"},{"ra":2.5641,"dec":-28.2323,"magnitude":4.96,"name":"天庾二*","tone":"blue"},{"ra":3.3574,"dec":43.3297,"magnitude":4.96,"name":"大陵增十九","tone":"blue"},{"ra":4.474,"dec":16.3597,"magnitude":4.96,"name":"75","tone":"white"},{"ra":5.3213,"dec":22.0965,"magnitude":4.96,"name":"天高四","tone":"white"},{"ra":5.9141,"dec":55.7069,"magnitude":4.96,"name":"八谷增六","tone":"blue"},{"ra":13.8312,"dec":-18.1342,"magnitude":4.96,"name":"天门增九","tone":"white"},{"ra":15.9632,"dec":54.7498,"magnitude":4.96,"name":"CL","tone":"white"},{"ra":16.0557,"dec":-25.8652,"magnitude":4.96,"name":"HIP 78650","tone":"warm"},{"ra":18.1005,"dec":22.2189,"magnitude":4.96,"name":"屠肆二","tone":"warm"},{"ra":18.1954,"dec":-23.7012,"magnitude":4.96,"name":"11","tone":"white"},{"ra":18.1984,"dec":31.4053,"magnitude":4.96,"name":"中山增四","tone":"warm"},{"ra":23.414,"dec":62.2828,"magnitude":4.96,"name":"螣蛇增十四","tone":"warm"},{"ra":1.2531,"dec":-45.5317,"magnitude":4.97,"name":"ν","tone":"white"},{"ra":1.9333,"dec":68.6852,"magnitude":4.97,"name":"华盖七","tone":"blue"},{"ra":3.7063,"dec":33.965,"magnitude":4.97,"name":"卷舌六","tone":"blue"},{"ra":4.0217,"dec":-61.0788,"magnitude":4.97,"name":"ι","tone":"warm"},{"ra":4.3392,"dec":27.3508,"magnitude":4.97,"name":"砺石四","tone":"white"},{"ra":5.925,"dec":-37.1207,"magnitude":4.97,"name":"ξ","tone":"white"},{"ra":7.8916,"dec":26.7658,"magnitude":4.97,"name":"五诸侯五[井宿]","tone":"blue"},{"ra":10.3828,"dec":-66.9015,"magnitude":4.97,"name":"L","tone":"blue"},{"ra":12.3392,"dec":3.3126,"magnitude":4.97,"name":"谒者","tone":"warm"},{"ra":13.4738,"dec":13.7788,"magnitude":4.97,"name":"东上将增一","tone":"white"},{"ra":14.4696,"dec":-29.4916,"magnitude":4.97,"name":"l","tone":"blue"},{"ra":15.6714,"dec":-23.8181,"magnitude":4.97,"name":"房宿增三","tone":"warm"},{"ra":16.2836,"dec":-50.0681,"magnitude":4.97,"name":"γ1","tone":"white"},{"ra":17.0522,"dec":14.0919,"magnitude":4.97,"name":"宦者一","tone":"warm"},{"ra":23.5659,"dec":31.3253,"magnitude":4.97,"name":"壁宿增二","tone":"warm"},{"ra":23.6631,"dec":-14.2222,"magnitude":4.97,"name":"羽林军四四","tone":"white"},{"ra":23.7672,"dec":46.4203,"magnitude":4.97,"name":"螣蛇廿","tone":"white"},{"ra":1.7121,"dec":-3.6902,"magnitude":4.98,"name":"天仓增廿","tone":"warm"},{"ra":2.157,"dec":25.9399,"magnitude":4.98,"name":"娄宿增九","tone":"white"},{"ra":2.9799,"dec":-64.0713,"magnitude":4.98,"name":"β","tone":"blue"},{"ra":5.1113,"dec":51.5977,"magnitude":4.98,"name":"八谷增四","tone":"white"},{"ra":5.5877,"dec":-5.3873,"magnitude":4.98,"name":"Trapezium","tone":"blue"},{"ra":5.5897,"dec":-5.4161,"magnitude":4.98,"name":"伐二","tone":"blue"},{"ra":7.6731,"dec":-15.2639,"magnitude":4.98,"name":"140","tone":"warm"},{"ra":8.6671,"dec":-12.4754,"magnitude":4.98,"name":"外厨增八","tone":"warm"},{"ra":11.0124,"dec":6.1014,"magnitude":4.98,"name":"灵台二","tone":"blue"},{"ra":11.8324,"dec":-70.2258,"magnitude":4.98,"name":"HIP 57696","tone":"warm"},{"ra":12.4498,"dec":26.8257,"magnitude":4.98,"name":"郎位四","tone":"blue"},{"ra":15.5297,"dec":40.8993,"magnitude":4.98,"name":"七公增九","tone":"blue"},{"ra":16.024,"dec":29.8511,"magnitude":4.98,"name":"贯索八","tone":"blue"},{"ra":18.3985,"dec":58.8007,"magnitude":4.98,"name":"扶筐三","tone":"blue"},{"ra":18.9374,"dec":4.2021,"magnitude":4.98,"name":"θ2","tone":"white"},{"ra":19.3425,"dec":-5.4158,"magnitude":4.98,"name":"天弁增五","tone":"white"},{"ra":19.932,"dec":58.846,"magnitude":4.98,"name":"奚仲增五","tone":"warm"},{"ra":0.075,"dec":-10.5095,"magnitude":4.99,"name":"八魁四","tone":"warm"},{"ra":2.0384,"dec":54.4875,"magnitude":4.99,"name":"大陵增五","tone":"blue"},{"ra":3.4675,"dec":49.0629,"magnitude":4.99,"name":"HIP 16147","tone":"blue"},{"ra":3.7041,"dec":-31.9384,"magnitude":4.99,"name":"δ","tone":"blue"},{"ra":3.9523,"dec":61.1089,"magnitude":4.99,"name":"传舍增二","tone":"warm"},{"ra":4.6482,"dec":-12.1231,"magnitude":4.99,"name":"HIP 21644","tone":"blue"},{"ra":5.3806,"dec":3.5445,"magnitude":4.99,"name":"参宿增十","tone":"blue"},{"ra":6.8461,"dec":41.7812,"magnitude":4.99,"name":"座旗六","tone":"warm"},{"ra":6.8479,"dec":-34.3673,"magnitude":4.99,"name":"HIP 32855","tone":"warm"},{"ra":7.0485,"dec":-4.2392,"magnitude":4.99,"name":"阙丘增四","tone":"blue"},{"ra":7.4275,"dec":9.2761,"magnitude":4.99,"name":"南河一","tone":"white"},{"ra":8.2222,"dec":-15.7882,"magnitude":4.99,"name":"外厨增十三","tone":"white"},{"ra":9.0995,"dec":5.0923,"magnitude":4.99,"name":"柳宿七","tone":"warm"},{"ra":9.1846,"dec":-44.8679,"magnitude":4.99,"name":"GX","tone":"white"},{"ra":9.5324,"dec":11.2998,"magnitude":4.99,"name":"酒旗二","tone":"white"},{"ra":11.3804,"dec":43.4827,"magnitude":4.99,"name":"天牢六","tone":"white"},{"ra":12.275,"dec":33.0615,"magnitude":4.99,"name":"HIP 59856","tone":"white"},{"ra":13.6958,"dec":-54.5594,"magnitude":4.99,"name":"Q","tone":"blue"},{"ra":14.2044,"dec":2.4094,"magnitude":4.99,"name":"CU","tone":"blue"},{"ra":15.369,"dec":-47.9278,"magnitude":4.99,"name":"ν1","tone":"white"},{"ra":15.3868,"dec":30.2878,"magnitude":4.99,"name":"贯索增三","tone":"white"},{"ra":15.9917,"dec":-41.7444,"magnitude":4.99,"name":"HIP 78323","tone":"white"},{"ra":18.2316,"dec":64.3973,"magnitude":4.99,"name":"扶筐增一","tone":"white"},{"ra":19.4021,"dec":29.6213,"magnitude":4.99,"name":"辇道增八","tone":"blue"},{"ra":20.0721,"dec":-32.0563,"magnitude":4.99,"name":"狗国增一","tone":"warm"},{"ra":22.1405,"dec":-34.0438,"magnitude":4.99,"name":"υ","tone":"warm"},{"ra":22.9406,"dec":49.7335,"magnitude":4.99,"name":"HIP 113288","tone":"warm"},{"ra":23.316,"dec":-9.6107,"magnitude":4.99,"name":"羽林军卅七","tone":"blue"},{"ra":4.0742,"dec":59.1555,"magnitude":5,"name":"传舍增四","tone":"white"},{"ra":5.4071,"dec":17.3835,"magnitude":5,"name":"111","tone":"white"},{"ra":6.1255,"dec":-37.2529,"magnitude":5,"name":"孙二","tone":"blue"},{"ra":6.2625,"dec":-13.7184,"magnitude":5,"name":"HIP 29735","tone":"blue"},{"ra":6.9352,"dec":-14.0434,"magnitude":5,"name":"天狼增三","tone":"warm"},{"ra":7.3089,"dec":49.4648,"magnitude":5,"name":"HIP 35384","tone":"blue"},{"ra":9.6202,"dec":6.8358,"magnitude":5,"name":"轩辕增四五","tone":"white"},{"ra":11.3869,"dec":-36.1648,"magnitude":5,"name":"HIP 55588","tone":"warm"},{"ra":11.7253,"dec":-62.4894,"magnitude":5,"name":"V0810","tone":"white"},{"ra":15.5236,"dec":77.3494,"magnitude":5,"name":"勾陈增七","tone":"warm"},{"ra":16.1346,"dec":17.047,"magnitude":5,"name":"晋","tone":"white"},{"ra":17.9848,"dec":-30.253,"magnitude":5,"name":"HIP 88060","tone":"warm"},{"ra":18.1246,"dec":43.4619,"magnitude":5,"name":"HIP 88788","tone":"white"},{"ra":18.9187,"dec":-22.6713,"magnitude":5,"name":"建增七","tone":"warm"},{"ra":19.024,"dec":46.9348,"magnitude":5,"name":"辇道增一","tone":"blue"},{"ra":19.232,"dec":57.7051,"magnitude":5,"name":"扶筐增三","tone":"warm"},{"ra":19.5764,"dec":19.7734,"magnitude":5,"name":"左旗增七","tone":"blue"},{"ra":19.7738,"dec":33.7276,"magnitude":5,"name":"辇道五","tone":"white"},{"ra":23.9597,"dec":-64.2982,"magnitude":5,"name":"鸟喙增一","tone":"blue"}];
const CONSTELLATIONS = [{"name":"仙女座","lines":[[[2.065,42.3297],[1.1622,35.6206],[0.6555,30.861],[0.1398,29.0904]],[[0.9534,23.4176],[0.789,24.2672],[0.6426,29.3118],[0.6555,30.861],[0.6147,33.7193],[23.6356,43.2681],[23.032,42.326]],[[23.6356,43.2681],[23.6735,44.3339],[23.6261,46.4582]],[[1.1622,35.6206],[0.9459,38.4993],[0.8302,41.0789],[1.1584,47.2418],[1.6332,48.6282]],[[23.6735,44.3339],[23.7672,46.4203]]],"boundaryParts":[[[22.9644,35.1682],[0.2764,48.6949],[1.4939,50.6479],[2.1247,37.3471],[0.9616,24.4266],[0.1071,28.696],[22.9644,35.1682]]],"labels":[[0.05,43]]},{"name":"唧筒座","lines":[[[9.4874,-35.9513],[10.4525,-31.0678],[10.9453,-37.1378]]],"boundaryParts":[[[9.4603,-24.5425],[9.4489,-40.2919],[11.0986,-35.6747],[10.6801,-31.8186],[10.3454,-29.7948],[9.844,-27.0835],[9.4603,-24.5425]]],"labels":[[10.4,-36]]},{"name":"天燕座","lines":[[[14.7977,-79.0448],[16.3391,-78.6957],[16.718,-77.5174],[16.5575,-78.8971]]],"boundaryParts":[[[13.9407,-83.1201],[18.2797,-74.9745],[18.2187,-67.4801],[17.2162,-67.6611],[14.9444,-70.5115],[13.8307,-70.6244],[13.9407,-83.1201]]],"labels":[[16,-74]]},{"name":"天鹰座","lines":[[[19.771,10.6133],[19.9219,6.4068],[20.1884,-0.8215],[19.425,3.1148],[19.0902,13.8635],[19.425,3.1148],[19.1041,-4.8826]]],"boundaryParts":[[[18.69,0.1155],[18.7639,6.3792],[19.0917,18.6882],[20.2373,16.1275],[20.6387,2.4361],[20.1151,-11.6762],[18.69,0.1155]]],"labels":[[19.4,8]]},{"name":"宝瓶座","lines":[[[20.7946,-9.4958],[21.526,-5.5712],[22.0964,-0.3199],[22.4805,-0.02],[22.5893,-0.1175],[23.2984,-9.1825],[23.1574,-21.1724]],[[21.526,-5.5712],[22.1073,-13.8697]],[[22.0964,-0.3199],[22.2806,-7.7833]],[[22.4805,-0.02],[22.4213,1.3774]],[[23.3828,-20.1006],[23.2984,-9.1825],[23.6961,-17.8165]]],"boundaryParts":[[[20.6399,0.4362],[21.5723,2.5544],[22.1059,2.3576],[22.8576,-3.3378],[23.9407,-24.8042],[21.4446,-8.4603],[20.6399,0.4362]]],"labels":[[22.5,-5]]},{"name":"天坛座","lines":[[[17.4232,-56.3777],[17.5183,-60.6838],[16.8298,-59.0414],[16.977,-55.9901],[16.9931,-53.1604],[17.5307,-49.8761],[17.4217,-55.5299]]],"boundaryParts":[[[16.6023,-60.2645],[18.1539,-45.486],[17.6779,-57.0748],[17.0483,-67.6906],[16.9522,-65.2063],[16.7692,-61.2365],[16.6023,-60.2645]]],"labels":[[17.2,-56]]},{"name":"白羊座","lines":[[[2.8331,27.2605],[2.1196,23.4624],[1.9107,20.808],[1.8922,19.2939]]],"boundaryParts":[[[2.111,10.5144],[1.783,25.6263],[2.0354,27.855],[2.5402,31.2213],[3.4951,31.1004],[3.4025,19.4461],[2.111,10.5144]]],"labels":[[2.8,22]]},{"name":"御夫座","lines":[[[5.9921,44.9474],[5.1086,41.2345],[4.9499,33.1661],[5.9954,37.2126],[5.9921,54.2847],[5.2782,45.998],[5.0413,41.0758]]],"boundaryParts":[[[4.6325,30.9219],[5.1657,52.6656],[6.2705,53.9663],[6.951,44.3418],[6.6727,35.3906],[4.8808,28.7124],[4.6325,30.9219]]],"labels":[[5.5,37]]},{"name":"牧夫座","lines":[[[13.7877,17.4569],[14.261,19.1824],[14.5305,30.3714],[15.0324,40.3906],[15.2584,33.3148],[14.261,19.1824],[14.6858,13.7283]],[[14.5346,38.3083],[14.2731,46.0883],[14.2244,51.7879],[14.4199,51.8507],[14.2731,46.0883]]],"boundaryParts":[[[15.1854,7.5254],[13.5969,27.8603],[14.1132,47.9039],[15.3061,55.0449],[15.8083,51.1177],[15.2677,32.5377],[15.1854,7.5254]]],"labels":[[14.9,35]]},{"name":"大犬座","lines":[[[6.3783,-17.9559],[6.7525,-16.7161],[7.0504,-23.8333],[7.1399,-26.3932],[7.0287,-27.9348],[6.9771,-28.9721],[6.3386,-30.0634]],[[7.4016,-29.3031],[7.1399,-26.3932]],[[6.7525,-16.7161],[6.9356,-17.0542],[7.0626,-15.6333],[6.9032,-12.0386],[6.9356,-17.0542]]],"boundaryParts":[[[6.2144,-11.0302],[7.4649,-11.2521],[7.4451,-33.2505],[6.6603,-33.1128],[6.1933,-33.0282],[6.1995,-27.2788],[6.2144,-11.0302]]],"labels":[[6.5,-26]]},{"name":"小犬座","lines":[[[7.655,5.225],[7.4525,8.2893]]],"boundaryParts":[[[8.1899,-0.3694],[7.1245,1.3074],[7.111,5.3101],[7.6161,12.2239],[7.9248,13.1732],[8.0366,6.655],[8.1899,-0.3694]]],"labels":[[7.3,5]]},{"name":"猎犬座","lines":[[[12.9335,38.3149],[12.5624,41.3575]]],"boundaryParts":[[[12.1063,33.304],[12.1879,52.3043],[13.5863,47.8599],[14.0514,30.1476],[13.5969,27.8603],[12.4372,31.3074],[12.1063,33.304]]],"labels":[[12.8,43]]},{"name":"雕具座","lines":[[[4.5139,-44.9537],[4.676,-41.8638],[4.701,-37.1443],[5.0734,-35.483]]],"boundaryParts":[[[4.3384,-39.7007],[4.5575,-48.7384],[4.8988,-42.7964],[5.0837,-27.0772],[4.7842,-27.0249],[4.6575,-36.754],[4.3384,-39.7007]]],"labels":[[4.9,-42]]},{"name":"鹿豹座","lines":[[[4.9548,53.7521],[5.057,60.4422],[4.9008,66.3427],[3.8393,71.3323],[3.8254,65.526],[3.4845,59.9403]],[[4.9008,66.3427],[6.3141,69.3198],[7.0011,76.9774]]],"boundaryParts":[[[6.2754,55.9658],[3.3236,55.4597],[3.6872,77.4163],[8.6935,86.0975],[11.629,76.3084],[9.3744,72.9741],[6.2754,55.9658]]],"labels":[[5.6,72]]},{"name":"摩羯座","lines":[[[20.2941,-12.5082],[20.481,-17.8137],[20.7683,-25.2709],[21.4445,-22.4113],[21.6682,-16.6623],[21.3708,-16.8345],[20.2941,-12.5082]]],"boundaryParts":[[[20.6456,-8.5634],[20.1151,-11.6762],[20.4599,-27.5913],[21.4539,-24.9598],[21.9771,-8.4044],[21.4478,-14.4601],[20.6456,-8.5634]]],"labels":[[21,-22]]},{"name":"船底座","lines":[[[6.6294,-43.1959],[9.22,-69.7172],[10.7159,-64.3945],[10.2847,-61.3323],[8.3752,-59.5095],[8.1589,-47.3366],[9.2848,-59.2752]],[[10.7159,-64.3945],[11.109,-62.4241],[11.1428,-61.9472],[11.21,-60.3176],[11.1432,-58.975],[10.8916,-58.8532],[10.5337,-61.6853]]],"boundaryParts":[[[11.3437,-57.1843],[8.5045,-54.9205],[8.2254,-51.1285],[6.213,-52.5346],[6.533,-58.0938],[9.0162,-75.4955],[11.3437,-57.1843]]],"labels":[[9.6,-66]]},{"name":"仙后座","lines":[[[1.9066,63.6701],[1.4303,60.2353],[0.9451,60.7167],[0.6751,56.5373],[0.153,59.1498]]],"boundaryParts":[[[22.9562,53.168],[23.6812,63.6929],[3.6158,68.4214],[2.0516,58.1047],[1.2404,50.6632],[0.2764,48.6949],[22.9562,53.168]]],"labels":[[23.6,55.5]]},{"name":"半人马座","lines":[[[11.3501,-54.491],[12.4673,-50.2306],[12.692,-48.9599],[13.9257,-47.2884],[13.8251,-41.6877],[14.1114,-36.37],[14.986,-42.1042]],[[13.8251,-41.6877],[13.3433,-36.7123]],[[14.6597,-60.8372],[13.6648,-53.4664],[14.0637,-60.373]],[[12.4673,-50.2306],[12.1942,-52.3685],[11.5295,-59.4421]]],"boundaryParts":[[[11.0986,-35.6747],[11.3437,-57.1843],[12.9556,-55.6771],[14.701,-64.539],[14.2967,-42.5806],[12.6951,-33.6864],[11.0986,-35.6747]]],"labels":[[13.3,-40]]},{"name":"仙王座","lines":[[[20.493,62.9941],[21.3097,62.5856],[21.7251,58.78],[22.1809,58.2013],[22.828,66.2004],[23.6558,77.6323],[21.3097,62.5856]],[[21.4777,70.5607],[22.828,66.2004]]],"boundaryParts":[[[20.0382,59.8511],[20.0449,80.3648],[1.6472,88.3564],[3.8354,80.3987],[23.2544,63.6813],[22.2116,53.3679],[20.0382,59.8511]]],"labels":[[22.5,71]]},{"name":"鲸鱼座","lines":[[[2.7217,3.2358],[2.749,10.1141],[3.038,4.0897],[2.3224,-2.9776],[1.7345,-15.9375],[1.1432,-10.1823],[1.8577,-10.335]]],"boundaryParts":[[[0.4401,0.6925],[2.1077,2.5979],[3.3902,0.447],[2.7559,-1.221],[1.7644,-23.7563],[23.9402,-6.3042],[0.4401,0.6925]]],"labels":[[1.9,-5]]},{"name":"蝘蜓座","lines":[[[8.3088,-76.9197],[10.5911,-78.6078],[10.7545,-80.4696],[12.3058,-79.3122],[11.9938,-78.2218],[10.5911,-78.6078]]],"boundaryParts":[[[7.4435,-82.7759],[13.9407,-83.1201],[13.8521,-75.6236],[11.3238,-75.684],[9.0162,-75.4955],[7.6143,-75.2899],[7.4435,-82.7759]]],"labels":[[12.6,-81]]},{"name":"圆规座","lines":[[[15.2919,-58.8012],[14.7084,-64.9751],[15.3896,-59.3208]]],"boundaryParts":[[[13.6454,-64.6379],[13.8307,-70.6244],[14.9336,-68.0122],[15.3444,-64.0416],[15.5033,-60.4355],[15.2056,-55.4755],[13.6454,-64.6379]]],"labels":[[14.5,-67]]},{"name":"巨蟹座","lines":[[[8.9748,11.8577],[8.7447,18.1543],[8.7214,21.4685],[8.7778,28.7651]],[[8.7447,18.1543],[8.2753,9.1855]]],"boundaryParts":[[[9.3603,6.4701],[8.0366,6.655],[7.9222,9.6734],[7.9298,19.6728],[8.0114,27.6603],[8.1329,33.1415],[9.3603,6.4701]]],"labels":[[8.55,27]]},{"name":"天鸽座","lines":[[[6.3686,-33.4364],[5.8493,-35.7683],[5.6608,-34.0741],[5.5202,-35.4705]],[[5.8493,-35.7683],[5.9858,-42.8151]]],"boundaryParts":[[[5.065,-42.8256],[5.0837,-27.0772],[6.1995,-27.2788],[6.6603,-33.1128],[6.6473,-43.1116],[6.0635,-43.0058],[5.065,-42.8256]]],"labels":[[5.7,-39]]},{"name":"后发座","lines":[[[13.1665,17.5294],[13.1979,27.8782],[12.449,28.2684]]],"boundaryParts":[[[11.9736,13.304],[12.1064,28.304],[12.437,33.3074],[13.3472,31.3437],[13.5969,27.8603],[12.9373,14.3225],[11.9736,13.304]]],"labels":[[12.9,24]]},{"name":"南冕座","lines":[[[18.9787,-37.1074],[19.107,-37.0634],[19.1579,-37.9045],[19.1392,-40.4967],[19.0519,-42.0951],[18.8264,-43.4341],[18.5584,-42.3125]]],"boundaryParts":[[[17.975,-37.0175],[19.3064,-36.7786],[19.318,-45.2776],[18.1539,-45.486],[17.9873,-45.5163],[17.975,-37.0175]]],"labels":[[18.8,-40]]},{"name":"北冕座","lines":[[[15.5488,31.3591],[15.4638,29.1057],[15.5781,26.7147],[15.7124,26.2956],[15.8266,26.0684],[15.9598,26.8779],[16.024,29.8511]]],"boundaryParts":[[[15.2733,25.5381],[15.5165,32.5726],[15.5096,39.5721],[16.4048,39.7117],[16.2524,26.6855],[16.2533,25.6856],[15.2733,25.5381]]],"labels":[[15.9,32]]},{"name":"巨爵座","lines":[[[11.6114,-9.8022],[11.4102,-10.8593],[10.9962,-18.2988],[11.1943,-22.8258],[11.3894,-18.78],[11.746,-18.3507],[11.9336,-17.1508]],[[11.3223,-14.7785],[11.4147,-17.684]]],"boundaryParts":[[[10.8551,-6.6622],[10.8517,-19.6621],[10.9354,-19.6666],[11.9394,-25.1958],[11.9398,-11.6958],[11.6228,-6.6917],[10.8551,-6.6622]]],"labels":[[11.65,-15]]},{"name":"南十字座","lines":[[[12.7954,-59.6888],[12.2524,-58.7489]],[[12.4433,-63.0991],[12.5194,-57.1132]]],"boundaryParts":[[[11.9381,-55.6958],[11.9372,-64.6958],[12.9626,-64.677],[12.9556,-55.6771],[11.9381,-55.6958]]],"labels":[[12.9,-62]]},{"name":"乌鸦座","lines":[[[12.1402,-24.7289],[12.1687,-22.6198],[12.2634,-17.5419],[12.4977,-16.5154],[12.5731,-23.3968],[12.1687,-22.6198]]],"boundaryParts":[[[12.9422,-11.6774],[11.9398,-11.6958],[11.9394,-25.1958],[12.6936,-25.1864],[12.6932,-22.6864],[12.9445,-22.6773],[12.9422,-11.6774]]],"labels":[[12.4,-19.5]]},{"name":"天鹅座","lines":[[[21.2156,30.2269],[20.7702,33.9703],[20.3705,40.2567],[19.7496,45.1308],[19.4951,51.7298],[19.285,53.3685]],[[20.6905,45.2803],[20.3705,40.2567],[19.9384,35.0834],[19.512,27.9597]]],"boundaryParts":[[[19.3422,27.7324],[19.2314,43.7149],[19.454,58.2555],[20.6416,61.3577],[21.9919,44.5983],[21.508,28.5481],[19.3422,27.7324]]],"labels":[[20.5,50]]},{"name":"海豚座","lines":[[[20.5535,11.3033],[20.6258,14.5951],[20.6606,15.9121],[20.7775,16.1241],[20.7243,15.0746],[20.6258,14.5951]]],"boundaryParts":[[[20.6387,2.4361],[20.2424,8.8779],[20.3458,16.144],[20.6605,19.94],[21.1499,12.3383],[20.9364,6.4772],[20.6387,2.4361]]],"labels":[[20.6,6]]},{"name":"剑鱼座","lines":[[[4.2671,-51.4866],[4.5666,-55.045],[5.5604,-62.4898],[5.9017,-63.0896],[5.5604,-62.4898],[5.0918,-57.4727],[4.5666,-55.045]]],"boundaryParts":[[[3.8879,-52.7968],[4.3703,-58.7089],[4.5721,-69.7467],[6.023,-61.0021],[5.0451,-53.8238],[4.3255,-48.6997],[3.8879,-52.7968]]],"labels":[[5.1,-64]]},{"name":"天龙座","lines":[[[17.8921,56.8726],[17.5072,52.3014],[17.8921,56.8726],[17.1464,65.7147],[16.0315,58.5653],[14.0732,64.3759],[11.5234,69.3311]],[[18.346,71.3378],[18.3509,72.7328]],[[19.2093,67.6615],[19.8029,70.2679]]],"boundaryParts":[[[9.3744,72.9741],[14.0434,69.3991],[17.4481,85.9496],[20.4541,61.9144],[19.1414,47.6999],[14.4834,54.9422],[9.3744,72.9741]]],"labels":[[17.9,64]]},{"name":"小马座","lines":[[[21.2637,5.2478],[21.2413,10.007],[21.1724,10.1316]]],"boundaryParts":[[[20.9387,2.4773],[20.9781,6.4827],[20.9746,12.3158],[21.2167,12.3466],[21.2163,13.0132],[21.4389,2.5394],[20.9387,2.4773]]],"labels":[[21.35,11.5]]},{"name":"波江座","lines":[[[5.1308,-5.0864],[3.9672,-13.5085],[2.7354,-13.8587],[3.5631,-21.6329],[4.2982,-33.7983],[2.6778,-39.8554],[1.6286,-57.2368]]],"boundaryParts":[[[3.6902,0.4037],[4.9287,-14.299],[4.3384,-39.7007],[2.7365,-50.4709],[1.6663,-50.8659],[3.5763,-39.1651],[3.6902,0.4037]]],"labels":[[3.5,-18]]},{"name":"天炉座","lines":[[[3.2013,-28.9876],[2.8182,-32.4059],[2.0748,-29.2968]]],"boundaryParts":[[[1.7644,-23.7563],[3.8393,-24.0034],[3.58,-35.582],[3.0796,-39.0963],[3.0792,-39.5129],[1.7567,-39.3726],[1.7644,-23.7563]]],"labels":[[2.7,-28]]},{"name":"双子座","lines":[[[6.248,22.5068],[6.7322,25.1311],[7.1857,30.2452],[7.7553,28.0262],[7.3354,21.9823],[7.0685,20.5703],[6.7548,12.8956]],[[7.3354,21.9823],[7.3015,16.5404]]],"boundaryParts":[[[6.4249,11.9333],[6.0083,21.5099],[6.6727,35.3906],[8.1329,33.1415],[7.9298,19.6728],[7.1165,12.3096],[6.4249,11.9333]]],"labels":[[7.15,23.5]]},{"name":"天鹤座","lines":[[[23.0147,-52.7541],[22.8092,-51.3169],[22.7111,-46.8846],[22.496,-43.7492],[22.1372,-46.961],[22.7111,-46.8846]],[[22.4878,-43.4956],[22.2603,-41.3467],[22.1019,-39.5434],[21.8988,-37.3649]]],"boundaryParts":[[[21.4619,-36.4593],[21.4745,-49.4586],[22.1333,-49.3912],[23.4512,-56.3127],[23.4462,-39.3128],[23.1152,-36.325],[21.4619,-36.4593]]],"labels":[[22.8,-41.5]]},{"name":"武仙座","lines":[[[16.3653,19.1531],[16.5037,21.4896],[16.6881,31.6027],[16.5684,42.437],[16.329,46.3134],[16.1462,44.9349],[15.8779,42.4515]],[[16.6881,31.6027],[17.0048,30.9264]],[[16.7149,38.9223],[17.2508,36.8092]],[[17.9376,37.2505],[17.3947,37.1459],[17.2508,36.8092],[17.2505,24.8392],[17.7743,27.7207],[17.9627,29.2479],[18.1257,28.7625]],[[17.2441,14.3903],[16.5037,21.4896]]],"boundaryParts":[[[16.3706,3.7034],[16.1204,25.6641],[15.8244,39.6189],[18.2311,47.537],[18.9518,25.6641],[18.3449,14.3875],[16.3706,3.7034]]],"labels":[[16.9,35]]},{"name":"时钟座","lines":[[[4.2334,-42.2944],[2.7093,-50.8003],[2.6234,-52.5431],[2.6777,-54.5499],[3.0602,-59.7378],[2.9799,-64.0713]]],"boundaryParts":[[[4.3384,-39.7007],[3.8918,-50.6305],[3.2527,-57.0378],[2.2389,-53.4165],[2.7365,-50.4709],[3.4859,-45.5692],[4.3384,-39.7007]]],"labels":[[3.4,-52]]},{"name":"长蛇座","lines":[[[8.7796,6.4188],[8.646,3.3414],[8.9232,5.9456],[9.4598,-8.6586],[10.4348,-16.8363],[11.8818,-33.9081],[14.8381,-27.9604]]],"boundaryParts":[[[8.1899,-0.3694],[10.8517,-19.6621],[12.9445,-22.6773],[12.3592,-33.6939],[10.6809,-29.8186],[9.179,-19.5088],[8.1899,-0.3694]]],"labels":[[10,-22]]},{"name":"水蛇座","lines":[[[0.4292,-77.2542],[3.7873,-74.239],[2.6598,-68.2669],[2.3625,-68.6594],[1.9156,-67.6473],[1.9795,-61.5699]]],"boundaryParts":[[[4.5863,-67.2479],[4.5305,-74.7432],[0.1022,-81.804],[0.8222,-74.3186],[1.3769,-75.3472],[2.2135,-66.9152],[4.5863,-67.2479]]],"labels":[[2.3,-72]]},{"name":"印第安座","lines":[[[20.6261,-47.2915],[20.734,-51.921],[20.9135,-58.4542],[21.9653,-54.9926],[21.3311,-53.4494],[20.6261,-47.2915]]],"boundaryParts":[[[21.5457,-74.4545],[23.4574,-66.8126],[22.1409,-56.3908],[21.4745,-49.4586],[20.478,-45.09],[20.5043,-59.5881],[21.5457,-74.4545]]],"labels":[[21.2,-55.5]]},{"name":"小狮座","lines":[[[10.1238,35.2447],[10.4319,33.7961],[10.8885,34.2149],[10.4647,36.7072],[10.1238,35.2447],[9.5704,36.3976]]],"boundaryParts":[[[9.3764,32.9691],[9.7139,41.4317],[10.9015,39.3356],[11.1129,28.325],[10.8634,24.8376],[10.6159,27.8529],[9.3764,32.9691]]],"labels":[[10.5,30]]},{"name":"蝎虎座","lines":[[[22.3927,52.229],[22.5215,50.2825],[22.3504,46.5366],[22.5081,43.1234],[22.6752,44.2763],[22.4086,49.4764],[22.3927,52.229]],[[22.5081,43.1234],[22.2313,39.7149],[22.2662,37.7487]]],"boundaryParts":[[[21.9641,36.5954],[21.9919,44.5983],[22.2116,53.3679],[22.3941,56.8826],[22.9562,53.168],[22.9138,35.6656],[21.9641,36.5954]]],"labels":[[22.8,47]]},{"name":"狮子座","lines":[[[10.1395,11.9672],[10.1222,16.7627],[10.3329,19.8415],[11.2351,20.5237],[11.8177,14.5721],[11.2373,15.4296],[10.1395,11.9672]],[[10.3329,19.8415],[10.2782,23.4173],[9.8794,26.007],[9.7642,23.7743]]],"boundaryParts":[[[10.8566,-0.6622],[9.3603,6.4701],[10.6159,27.8529],[10.8634,24.8376],[11.9739,28.304],[11.6234,-0.6917],[10.8566,-0.6622]]],"labels":[[10.6,15]]},{"name":"天兔座","lines":[[[6.1026,-14.9353],[5.9401,-14.1677],[5.5455,-17.8223],[5.2155,-16.2055],[5.091,-22.371],[5.7411,-22.4484],[5.8554,-20.8791]],[[5.2205,-12.9413],[5.2155,-16.2055],[5.3263,-13.1768]]],"boundaryParts":[[[4.9173,-27.048],[6.1995,-27.2788],[6.2144,-11.0302],[5.1813,-10.8432],[5.0148,-10.8138],[4.9287,-14.299],[4.9173,-27.048]]],"labels":[[5.9,-25]]},{"name":"天秤座","lines":[[[15.0678,-25.282],[14.848,-16.0418],[15.2834,-9.3829],[15.5921,-14.7895],[15.6171,-28.1351],[15.6443,-29.7778]],[[14.848,-16.0418],[15.5921,-14.7895]]],"boundaryParts":[[[15.1902,-0.4743],[14.7778,-8.5267],[14.3689,-25.0727],[15.0421,-29.9949],[15.7875,-20.3902],[16.0258,-3.6026],[15.1902,-0.4743]]],"labels":[[15.4,-26]]},{"name":"豺狼座","lines":[[[15.8493,-33.6272],[15.3634,-36.2614],[14.9755,-43.134],[15.2047,-52.0992],[15.3089,-47.8753],[15.5857,-41.1668],[16.1099,-36.8023]],[[15.3562,-40.6475],[15.5857,-41.1668]]],"boundaryParts":[[[14.3105,-55.58],[15.2056,-55.4755],[15.4805,-48.4371],[15.8083,-42.3886],[16.1298,-29.8378],[15.0531,-42.4942],[14.3105,-55.58]]],"labels":[[15.25,-35]]},{"name":"天猫座","lines":[[[6.3271,59.011],[6.9546,58.4228],[7.4452,49.2115],[8.3806,43.1881],[9.0107,41.7829],[9.3141,36.8026],[9.3509,34.3926]]],"boundaryParts":[[[7.504,35.2445],[6.6613,49.8946],[6.2938,61.9641],[8.5866,59.576],[9.3008,41.4786],[9.3764,32.9691],[7.504,35.2445]]],"labels":[[8.1,49]]},{"name":"天琴座","lines":[[[18.7462,37.6051],[18.7397,39.6127],[18.6156,38.7837],[18.9084,36.8986],[18.9824,32.6896],[18.8347,33.3627],[18.7462,37.6051]]],"boundaryParts":[[[18.9518,25.6641],[18.4467,30.074],[18.2895,47.5476],[19.2314,43.7149],[19.4746,36.7558],[19.3397,30.2322],[18.9518,25.6641]]],"labels":[[18.6,30]]},{"name":"山案座","lines":[[[6.1707,-74.753],[5.5314,-76.341],[4.9198,-74.9369],[5.0453,-71.3143]]],"boundaryParts":[[[7.268,-85.2614],[3.3394,-82.0645],[3.4717,-74.5741],[4.5721,-69.7467],[6.518,-75.1],[7.6143,-75.2899],[7.268,-85.2614]]],"labels":[[5.5,-80]]},{"name":"显微镜座","lines":[[[20.8328,-33.7797],[20.8081,-43.9885],[21.346,-40.8095],[21.299,-32.1725],[21.0215,-32.2578],[20.8328,-33.7797]]],"boundaryParts":[[[20.4599,-27.5913],[21.4554,-27.4597],[21.4619,-36.4593],[21.4695,-44.9589],[20.478,-45.09],[20.4599,-27.5913]]],"labels":[[21.1,-37]]},{"name":"麒麟座","lines":[[[7.6875,-9.5511],[8.1432,-2.9838],[7.1977,-0.4928],[6.4803,-7.0331],[6.2476,-6.2748]],[[7.1977,-0.4928],[6.7977,2.4122],[6.3961,4.5929],[6.5484,7.333],[6.683,9.8958]]],"boundaryParts":[[[6.3484,-0.0537],[6.4249,11.9333],[7.1145,9.8098],[7.3078,1.2756],[8.1823,-11.3688],[5.9311,-10.9785],[6.3484,-0.0537]]],"labels":[[7.65,-6]]},{"name":"苍蝇座","lines":[[[11.7601,-66.7288],[12.2929,-67.9607],[12.6197,-69.1356],[12.7713,-68.1081],[13.0379,-71.5489],[12.5411,-72.133],[12.6197,-69.1356]]],"boundaryParts":[[[11.339,-64.6843],[13.8521,-75.6236],[13.8307,-70.6244],[13.6472,-65.6379],[13.6454,-64.6379],[11.9372,-64.6958],[11.339,-64.6843]]],"labels":[[13,-73]]},{"name":"矩尺座","lines":[[[16.1082,-45.1732],[16.4531,-47.5548],[16.3307,-50.1555],[16.0536,-49.2297],[16.1082,-45.1732]]],"boundaryParts":[[[15.5033,-60.4355],[16.5714,-45.7671],[16.1435,-42.3367],[15.8165,-48.388],[15.4902,-54.4364],[15.2056,-55.4755],[15.5033,-60.4355]]],"labels":[[16.2,-52]]},{"name":"南极座","lines":[[[14.4487,-83.6679],[22.7676,-81.3816],[21.6913,-77.39],[14.4487,-83.6679]]],"boundaryParts":[[[0.1022,-81.804],[3.2155,-84.5554],[7.4435,-82.7759],[18.4577,-82.4583],[18.2797,-74.9745],[23.4665,-74.3125],[0.1022,-81.804]]],"labels":[[20,-80]]},{"name":"蛇夫座","lines":[[[17.9838,-9.7736],[17.7245,4.5673],[17.5822,12.56],[16.5152,1.9839],[16.2391,-3.6943],[16.6193,-10.5671],[17.173,-15.7249]],[[16.9611,9.375],[16.6193,-10.5671],[16.519,-16.6127],[16.4504,-18.4563],[16.4017,-20.0373],[16.4264,-23.4472]],[[17.7245,4.5673],[17.173,-15.7249],[17.3668,-24.9995],[17.4559,-29.867]]],"boundaryParts":[[[16.3735,-0.2964],[18.3469,12.0543],[18.5293,3.0867],[17.7816,-10.0502],[17.72,-16.0619],[16.4959,-18.5272],[16.3735,-0.2964]]],"labels":[[17.2,3]]},{"name":"猎户座","lines":[[[6.1262,14.7685],[5.9064,20.2762],[6.0653,20.1385],[6.0397,9.6473],[5.9195,7.4071],[5.4189,6.3497],[4.9149,10.1508]],[[4.9758,1.714],[4.9042,2.4407],[4.8307,6.9613],[4.8435,8.9002],[4.9149,10.1508],[5.0762,15.4041],[5.1617,15.5972]],[[5.2423,-8.2016],[5.4079,-2.3971],[5.5334,-0.2991],[5.5856,9.9342],[5.9195,7.4071],[5.6793,-1.9426],[5.7959,-9.6696]],[[5.6793,-1.9426],[5.6036,-1.2019],[5.5334,-0.2991]]],"boundaryParts":[[[4.7235,0.2375],[5.4528,15.6101],[5.8885,18.0314],[6.3416,21.4492],[6.3565,9.9455],[5.9311,-10.9785],[4.7235,0.2375]]],"labels":[[5.6,13]]},{"name":"孔雀座","lines":[[[20.4275,-56.7351],[20.1454,-66.1821],[18.8703,-62.1876],[18.143,-63.6686],[18.7173,-71.4281],[20.0099,-72.9105],[21.4407,-65.3662]]],"boundaryParts":[[[18.2797,-74.9745],[21.4899,-59.4577],[20.5043,-59.5881],[18.1782,-56.9838],[17.6779,-57.0748],[18.2187,-67.4801],[18.2797,-74.9745]]],"labels":[[19.8,-62]]},{"name":"飞马座","lines":[[[22.1665,33.1782],[23.0629,28.0828],[0.1398,29.0904],[23.0793,15.2053],[22.7782,12.1729],[22.17,6.1979],[21.7364,9.875]],[[23.0793,15.2053],[23.0629,28.0828],[22.8334,24.6016],[22.7755,23.5657],[22.1169,25.3451],[21.7441,25.645]]],"boundaryParts":[[[21.4389,2.5394],[21.3434,24.0289],[22.0906,35.6069],[23.8552,32.0285],[0.2493,21.6952],[22.8561,2.6622],[21.4389,2.5394]]],"labels":[[22.3,16]]},{"name":"英仙座","lines":[[[3.7386,32.2882],[3.9642,40.0102],[3.6082,48.1926],[2.8449,55.8955],[3.1583,44.8575],[3.0863,38.8403],[3.1361,40.9556]],[[4.1097,50.3513],[4.2483,48.4093],[4.1444,47.7125],[3.7154,47.7876]],[[3.1511,49.6133],[2.7367,49.2284],[1.7277,50.6887]]],"boundaryParts":[[[2.8419,31.1865],[2.659,51.0424],[1.7979,50.6257],[2.0516,58.1047],[3.3276,57.4594],[4.856,52.7196],[2.8419,31.1865]]],"labels":[[4.4,45]]},{"name":"凤凰座","lines":[[[0.4381,-42.306],[1.1014,-46.7184],[1.4728,-43.3182],[1.1397,-55.2458],[1.1014,-46.7184],[0.1568,-45.7474],[0.4381,-42.306]]],"boundaryParts":[[[23.4462,-39.3128],[23.4519,-57.8127],[1.4182,-52.8486],[1.9129,-50.8859],[2.4102,-47.6005],[1.7567,-39.3726],[23.4462,-39.3128]]],"labels":[[1.1,-43]]},{"name":"绘架座","lines":[[[6.8032,-61.9414],[5.8305,-56.1667],[5.7881,-51.0665]]],"boundaryParts":[[[6.0635,-43.0058],[4.5616,-46.2388],[5.0451,-53.8238],[6.023,-61.0021],[6.8674,-58.1537],[6.2072,-55.034],[6.0635,-43.0058]]],"labels":[[5.5,-50]]},{"name":"南鱼座","lines":[[[22.6776,-27.0436],[22.9325,-32.5396],[22.8754,-32.8755],[22.1397,-32.9885],[21.7491,-33.0258],[22.1397,-32.9885],[22.6776,-27.0436]]],"boundaryParts":[[[23.1121,-24.825],[21.9847,-24.904],[21.4539,-24.9598],[21.4554,-27.4597],[21.4619,-36.4593],[23.1152,-36.325],[23.1121,-24.825]]],"labels":[[22.2,-29]]},{"name":"双鱼座","lines":[[[1.2292,24.5837],[1.1909,21.0347],[2.0341,2.7638],[1.2289,7.5754],[23.6658,5.6263],[23.2861,3.2823],[23.6658,5.6263]],[[23.2861,3.2823],[23.0646,3.82]]],"boundaryParts":[[[22.8566,0.6622],[23.9398,10.6958],[0.961,21.6766],[1.5265,33.6454],[1.777,10.5432],[0.4395,-6.3075],[22.8566,0.6622]]],"labels":[[1.3,15]]},{"name":"船尾座","lines":[[[6.6294,-43.1959],[7.2857,-37.0975],[7.6472,-26.8038],[7.8216,-24.8598],[7.9476,-22.8801],[8.0597,-40.0031],[8.1589,-47.3366]],[[7.8216,-24.8598],[7.8014,-25.9372],[7.7301,-28.9548],[7.5897,-28.3693]]],"boundaryParts":[[[7.4649,-11.2521],[6.6603,-33.1128],[6.0635,-43.0058],[8.0692,-43.3535],[8.4452,-37.16],[8.466,-11.4116],[7.4649,-11.2521]]],"labels":[[7.4,-46]]},{"name":"罗盘座","lines":[[[8.0597,-40.0031],[8.6684,-35.3084],[8.7265,-33.1864],[8.8422,-27.7098]]],"boundaryParts":[[[8.4618,-17.4113],[8.679,-17.4425],[9.179,-19.5088],[9.1758,-24.5086],[9.4603,-24.5425],[8.4452,-37.16],[8.4618,-17.4113]]],"labels":[[8.8,-24]]},{"name":"网罟座","lines":[[[4.2404,-62.4739],[4.2747,-59.3022],[3.9791,-61.4002],[3.7367,-64.8069],[4.2404,-62.4739]]],"boundaryParts":[[[3.2242,-67.0358],[4.6183,-58.7507],[4.3767,-56.2094],[4.0532,-52.8228],[3.8879,-52.7968],[3.5491,-57.0798],[3.2242,-67.0358]]],"labels":[[3.7,-61]]},{"name":"玉夫座","lines":[[[0.9768,-29.3574],[23.8154,-28.1303],[23.3137,-32.532],[23.5495,-37.8183]]],"boundaryParts":[[[23.1121,-24.825],[23.9407,-24.8042],[1.7567,-39.3726],[0.0402,-39.3039],[23.4462,-39.3128],[23.1152,-36.325],[23.1121,-24.825]]],"labels":[[0.1,-33]]},{"name":"天蝎座","lines":[[[15.9809,-26.1141],[16.0056,-22.6217],[16.0906,-19.8055]],[[16.0056,-22.6217],[16.4901,-26.432],[16.8361,-34.2932],[16.9097,-42.3613],[17.2026,-43.2392],[17.7931,-40.127],[17.5601,-37.1038]]],"boundaryParts":[[[16.0292,-8.3523],[16.4959,-18.5272],[16.877,-24.7961],[17.9669,-30.0182],[16.5714,-45.7671],[15.7953,-29.8896],[16.0292,-8.3523]]],"labels":[[16.6,-38]]},{"name":"盾牌座","lines":[[[18.5868,-8.2441],[18.7862,-4.7479],[18.7046,-9.0525],[18.4866,-14.5658],[18.5868,-8.2441]]],"boundaryParts":[[[18.37,-15.9436],[18.9862,-15.8328],[18.9829,-11.8664],[18.9765,-3.8337],[18.6932,-3.8842],[18.3599,-3.9445],[18.37,-15.9436]]],"labels":[[18.8,-12.5]]},{"name":"巨蛇座","lines":[[[15.7698,15.4218],[15.6925,19.6704],[15.9409,15.6616],[15.7698,15.4218],[15.58,10.5389],[15.8469,4.4777],[16.2391,-3.6943]],[[17.173,-15.7249],[17.6264,-15.3986],[17.9838,-9.7736],[18.0514,-8.1803],[18.3552,-2.8988],[18.937,4.2036]]],"boundaryParts":[[[15.1902,-0.4743],[15.2733,25.5381],[16.1238,21.6644],[16.1784,15.6728],[16.3706,3.7034],[16.0258,-3.6026],[15.1902,-0.4743]],[[18.3567,0.0552],[18.3531,4.5549],[18.9718,2.1659],[18.37,-15.9436],[17.6982,-10.0654],[18.0816,-9.9956],[18.3567,0.0552]]],"labels":[[15.5,5],[18.7,3]]},{"name":"六分仪座","lines":[[[10.1323,-0.3716],[9.8751,-8.105],[10.4913,-2.7391],[10.5049,-0.637]]],"boundaryParts":[[[9.6899,-0.5671],[9.6932,6.4328],[10.8584,6.3377],[10.8551,-6.6622],[10.8539,-11.6621],[9.6847,-11.5668],[9.6899,-0.5671]]],"labels":[[10.5,-7]]},{"name":"天箭座","lines":[[[19.6683,18.0139],[19.7898,18.5343],[19.9793,19.4921]],[[19.6841,17.476],[19.7898,18.5343]]],"boundaryParts":[[[18.9582,18.6647],[19.3398,21.3148],[19.924,21.5787],[20.3423,20.8937],[20.2373,16.1275],[19.0937,16.3551],[18.9582,18.6647]]],"labels":[[19.4,18]]},{"name":"人马座","lines":[[[18.2938,-36.7617],[18.4029,-34.3846],[18.3499,-29.8281],[18.4662,-25.4217],[18.2294,-21.0588]],[[19.3773,-44.459],[19.3981,-40.6159],[19.0435,-29.8801],[18.7609,-26.9908],[18.4662,-25.4217]],[[19.921,-41.8683],[19.6118,-24.8836],[18.9211,-26.2967],[18.0968,-30.4241],[19.1157,-27.6704],[19.1627,-21.0236],[19.3621,-15.955]],[[19.0781,-21.7415],[18.9622,-21.1067],[18.9028,-22.7448],[18.9211,-26.2967]]],"boundaryParts":[[[18.9829,-11.8664],[18.37,-15.9436],[17.7335,-30.0607],[19.3064,-36.7786],[20.478,-45.09],[20.1277,-27.6419],[18.9829,-11.8664]]],"labels":[[19.5,-34]]},{"name":"金牛座","lines":[[[5.6274,21.1425],[4.5987,16.5093],[4.4777,15.8709],[4.3299,15.6276],[4.3822,17.5425],[4.4769,19.1804],[5.4382,28.6075]],[[4.3299,15.6276],[4.0113,12.4903],[3.4528,9.7327],[4.0526,5.9893]],[[3.4528,9.7327],[3.4136,9.0289],[3.6146,0.4017]]],"boundaryParts":[[[3.3891,-1.303],[3.4951,31.1004],[4.8808,28.7124],[5.8218,18.0435],[5.7196,15.5619],[4.7356,15.7365],[3.3891,-1.303]]],"labels":[[3.6,15]]},{"name":"望远镜座","lines":[[[18.1872,-45.9544],[18.4496,-45.9685],[18.4805,-49.0706]]],"boundaryParts":[[[20.4973,-56.5886],[20.478,-45.09],[19.318,-45.2776],[18.1539,-45.486],[18.1782,-56.9838],[20.4973,-56.5886]]],"labels":[[18.5,-54]]},{"name":"南三角座","lines":[[[16.8111,-69.0277],[15.919,-63.4307],[15.3152,-68.6795],[16.8111,-69.0277]]],"boundaryParts":[[[14.9444,-70.5115],[15.0902,-64.0751],[15.506,-61.4353],[16.6054,-61.2642],[16.9463,-63.7901],[17.0483,-67.6906],[14.9444,-70.5115]]],"labels":[[16,-67.5]]},{"name":"三角座","lines":[[[1.8847,29.5788],[2.1591,34.9873],[2.2886,33.8472],[1.8847,29.5788]]],"boundaryParts":[[[1.783,25.6263],[1.5265,33.6454],[2.1236,35.5971],[2.6956,37.2874],[2.8419,31.1865],[2.538,27.8048],[1.783,25.6263]]],"labels":[[1.8,34]]},{"name":"杜鹃座","lines":[[[22.3084,-60.2596],[23.2905,-58.2357],[0.5257,-62.9582],[0.3345,-64.8748],[23.9986,-65.5771],[22.4555,-64.9664],[22.3084,-60.2596]]],"boundaryParts":[[[23.4665,-74.3125],[0.8222,-74.3186],[1.3769,-75.3472],[23.4519,-57.8127],[23.4512,-56.3127],[22.1599,-66.89],[23.4665,-74.3125]]],"labels":[[23.2,-64]]},{"name":"大熊座","lines":[[[12.2571,57.0326],[11.0621,61.751],[11.0307,56.3824],[12.2571,57.0326],[12.9005,55.9598],[13.3988,54.9254],[13.7923,49.3133]],[[11.8972,53.6948],[11.7675,47.7794],[11.308,33.0943],[11.3031,31.5308]],[[11.7675,47.7794],[11.1611,44.4985],[10.3722,41.4995]],[[11.1611,44.4985],[10.2849,42.9144]],[[11.0621,61.751],[9.5255,63.0619],[8.5044,60.7182],[9.8498,59.0387],[11.0307,56.3824]],[[11.0307,56.3824],[9.8684,54.0643],[9.5476,51.6773],[8.9868,48.0418]],[[9.0604,47.1565],[9.5476,51.6773]]],"boundaryParts":[[[9.7139,41.4317],[8.1419,59.6434],[12.1054,63.304],[14.1056,54.9036],[12.1884,44.3043],[11.1143,33.325],[9.7139,41.4317]]],"labels":[[11,48]]},{"name":"小熊座","lines":[[[15.7343,77.7945],[16.2917,75.7553],[15.3455,71.834],[15.7343,77.7945],[16.7662,82.0373],[17.5369,86.5865],[2.5303,89.2641]]],"boundaryParts":[[[13.0547,76.3289],[15.6886,65.6023],[17.4358,74.9033],[20.5554,86.6306],[1.6472,88.3564],[14.2015,85.9308],[13.0547,76.3289]]],"labels":[[15.1,68]]},{"name":"船帆座","lines":[[[8.7451,-54.7088],[9.3686,-55.0107],[9.9477,-54.5678],[10.2456,-42.1219],[9.5117,-40.4668],[9.1333,-43.4326],[8.1589,-47.3366]]],"boundaryParts":[[[11.0892,-57.1744],[9.4489,-40.2919],[8.4382,-43.4095],[8.0574,-51.1026],[8.2213,-53.3782],[8.892,-54.9742],[11.0892,-57.1744]]],"labels":[[9.55,-46]]},{"name":"室女座","lines":[[[11.7643,6.5294],[11.8449,1.7647],[12.3318,-0.6668],[13.1658,-5.539],[13.4199,-11.1613],[14.2669,-6.0005],[14.7177,-5.6582]],[[13.0363,10.9592],[12.9267,3.3975],[12.6943,-1.4494]],[[13.1658,-5.539],[13.5782,-0.5958],[14.0274,1.5445],[14.7708,1.8929]]],"boundaryParts":[[[11.6234,-0.6917],[11.9736,13.304],[13.6019,14.3605],[14.7735,-0.5269],[14.3675,-22.5728],[11.9398,-11.6958],[11.6234,-0.6917]]],"labels":[[13.3,-4]]},{"name":"飞鱼座","lines":[[[9.0408,-66.3961],[8.4289,-66.1369],[8.1322,-68.6171],[7.2805,-67.9572],[7.1458,-70.4989],[8.1322,-68.6171],[9.0408,-66.3961]]],"boundaryParts":[[[6.5958,-64.107],[6.5636,-70.1041],[6.518,-75.1],[9.0162,-75.4955],[9.073,-64.499],[6.8469,-64.1519],[6.5958,-64.107]]],"labels":[[7.4,-73]]},{"name":"狐狸座","lines":[[[19.2703,21.3904],[19.4784,24.6649],[19.891,24.0796],[20.0183,27.7536],[20.2628,27.8142]]],"boundaryParts":[[[18.9559,21.2478],[19.7515,27.8012],[21.0056,28.4872],[21.3459,20.0291],[20.6598,20.9399],[19.9257,19.4955],[18.9559,21.2478]]],"labels":[[19.7,21]]}];
const MILKY_WAY_CENTERLINE = [[5.9612,30.557],[5.67504061894925,33.92780989810734],[5.41036668362285,38.249269756636295],[5.082684217495817,41.99050781544584],[4.624013444012125,42.8686200462323],[4.171991471220197,43.993194223017994],[3.941786014906378,46.60569910442487],[3.6163928781446613,44.38785478311323],[3.2138433050418076,47.63052344886743],[2.8131882059750475,48.30750870256169],[2.3453288387286872,50.76489157031077],[2.182055511227195,54.03505713263952],[2.262696686746354,55.7894681186045],[1.9902766582041158,58.04931842265377],[1.3781023893392121,57.700888100199826],[0.7167151714107293,56.501188927657886],[0.20260063394954678,54.83206344193671],[-0.31341922074829237,56.273054531675996],[-0.9551982209163958,54.47014063079435],[-1.5034554928230515,52.35444904763358],[-1.7962769583576748,50.665576032247884],[-1.7987878824751513,51.38604017449799],[-2.3894569909517616,49.58742130817005],[-2.745353789143506,45.698637968324064],[-2.9173246249518074,40.94154218684228],[-3.007302619167123,35.98947075101988],[-3.2063671412159707,36.23201732427514],[-3.4964679073463207,36.02169674923583],[-3.806682691271015,32.369503052843534],[-4.107329091087346,28.359735809793097],[-4.386740662732009,24.289828077855383],[-4.614697576122266,19.7393954505038],[-4.7822076608032225,15.499306700184631],[-4.79819855999515,10.260330555042843],[-4.924989041823593,5.489085602708971],[-4.991893523082564,0.2193969031367775],[-5.064459777216802,-4.362151313258567],[-5.2358103710293165,-8.544523082673882],[-5.442840554360684,-12.560274871474853],[-5.511054732133047,-17.441985135092196],[-5.4672615178313535,-20.618173704872827],[-5.435908194581388,-20.91861945335313],[-5.456821120683297,-20.878839343790535],[-5.475945926652427,-20.955267669696347],[-5.604647792745418,-19.701225782450592],[-5.784579851237984,-18.181022574416623],[-5.656749470022967,-19.148553124967222],[-5.830442847353016,-23.31863368279383],[-6.1121664455436004,-28.110095158266418],[-6.644510008084361,-31.369320052364344],[-7.180012904339183,-34.38653420881548],[-7.8170476244341565,-36.18452341971216],[-8.36262227115507,-39.26135226565843],[-9.058628106869302,-40.61427453855358],[-9.785329533390215,-42.19296139502759],[-10.35799914940727,-41.756069105251065],[-10.737770644161,-41.390961838594556],[-11.139544300835794,-40.68650355392437],[-11.469057170653196,-39.76505623492998],[-11.703388628426989,-40.295948568749836],[-11.789870569520238,-41.108689060085],[-11.84247485246208,-42.89470464159885],[-11.962779763871085,-43.50797462758592],[-12.083109406316897,-43.72726622268124],[-12.207028483188212,-44.48650492674574],[-12.584895149918221,-45.01586709144911],[-12.983692239302545,-43.624138928255014],[-12.803050400827662,-40.64898637094373],[-12.643083539254224,-36.65993187011248],[-12.52206513494737,-32.185041858816696],[-12.600359307125117,-27.771960158424],[-12.930748848791456,-26.609266620551075],[-13.304529639759807,-25.87926200328762],[-13.643275849308104,-25.530800612536606],[-13.719525264533036,-25.952690739433383],[-14.13666642856856,-23.355366191372312],[-14.55037108981519,-23.06829254930275],[-14.969209803042084,-20.836521447971265],[-15.32431045768934,-17.25409234681463],[-15.633068686208784,-14.780573026591085],[-15.853022666252823,-12.3081335315451],[-16.16695333897852,-9.893297827249146],[-16.218483498503712,-8.391089297511046],[-16.210440275670774,-6.24054637969903],[-16.221740527388388,-4.454338701594709],[-16.08694877629027,-1.5726238696959811],[-15.996570696167957,1.1380363243965892],[-15.957472116770003,3.360237705073084],[-15.938587559420867,5.036664693652574],[-15.877482862502099,7.223563567268981],[-15.763896921619438,10.075791305222925],[-15.651003848541183,12.859108854005626],[-15.50193063944467,15.779924307686176],[-15.43766898440523,18.15209845318545],[-15.253245414050863,21.031654685014757],[-14.999824550723766,23.9690058839061],[-14.870825541453259,26.450048118862913],[-14.801614063682628,29.07575818000008],[-14.71130471505932,30.408993393485915],[-14.261902438644984,30.412210928410133],[-13.812500162230654,30.41542846333435],[-13.36309788581632,30.41864599825857],[-12.91369560940199,30.42186353318279],[-12.464293332987655,30.42508106810701],[-12.01489105657332,30.42829860303123],[-11.565488780158992,30.431516137955448],[-11.116086503744654,30.434733672879666],[-10.666684227330325,30.437951207803884],[-10.217281950915993,30.441168742728106],[-9.767879674501653,30.444386277652328],[-9.318477398087326,30.447603812576546],[-8.869075121672989,30.450821347500764],[-8.419672845258654,30.45403888242498],[-7.970270568844322,30.4572564173492],[-7.520868292429992,30.46047395227342],[-7.071466016015656,30.463691487197643],[-6.622063739601327,30.466909022121857],[-6.172661463186988,30.47012655704608],[-5.723259186772661,30.473344091970297],[-5.273856910358322,30.47656162689452],[-4.824454633944,30.479779161818733],[-4.375052357529657,30.48299669674296],[-3.925650081115327,30.486214231667176],[-3.4762478047009955,30.489431766591395],[-3.026845528286662,30.492649301515613],[-2.577443251872327,30.495866836439834],[-2.128040975458,30.49908437136405],[-1.6786386990436561,30.50230190628827],[-1.2292364226293326,30.505519441212492],[-0.7798341462149985,30.50873697613671],[-0.33043186980066075,30.511954511060928],[0.11897040661366809,30.515172045985146],[0.5683726830280005,30.51838958090937],[1.0177749594423329,30.521607115833586],[1.467177235856667,30.524824650757807],[1.9165795122709994,30.528042185682025],[2.3659817886853336,30.531259720606243],[2.815384065099666,30.53447725553046],[3.2647863415139984,30.537694790454683],[3.7141886179283343,30.5409123253789],[4.163590894342672,30.544129860303123],[4.6129931707569956,30.54734739522734],[5.062395447171337,30.55056493015156],[5.511797723585667,30.553782465075777]];
const NEARBY_CITIES = [{"name":"北京","lat":39.9042,"lon":116.4074},{"name":"上海","lat":31.2304,"lon":121.4737},{"name":"天津","lat":39.0842,"lon":117.201},{"name":"重庆","lat":29.563,"lon":106.5516},{"name":"石家庄","lat":38.0428,"lon":114.5149},{"name":"太原","lat":37.8706,"lon":112.5489},{"name":"呼和浩特","lat":40.8424,"lon":111.7492},{"name":"沈阳","lat":41.8057,"lon":123.4315},{"name":"长春","lat":43.8171,"lon":125.3235},{"name":"哈尔滨","lat":45.8038,"lon":126.535},{"name":"南京","lat":32.0603,"lon":118.7969},{"name":"杭州","lat":30.2741,"lon":120.1551},{"name":"合肥","lat":31.8206,"lon":117.2272},{"name":"福州","lat":26.0745,"lon":119.2965},{"name":"南昌","lat":28.682,"lon":115.8579},{"name":"济南","lat":36.6512,"lon":117.1201},{"name":"郑州","lat":34.7466,"lon":113.6254},{"name":"武汉","lat":30.5928,"lon":114.3055},{"name":"长沙","lat":28.2282,"lon":112.9388},{"name":"广州","lat":23.1291,"lon":113.2644},{"name":"南宁","lat":22.817,"lon":108.3669},{"name":"海口","lat":20.044,"lon":110.1983},{"name":"成都","lat":30.5728,"lon":104.0668},{"name":"贵阳","lat":26.647,"lon":106.6302},{"name":"昆明","lat":25.0389,"lon":102.7183},{"name":"拉萨","lat":29.652,"lon":91.1721},{"name":"西安","lat":34.3416,"lon":108.9398},{"name":"兰州","lat":36.0611,"lon":103.8343},{"name":"西宁","lat":36.6171,"lon":101.7782},{"name":"银川","lat":38.4872,"lon":106.2309},{"name":"乌鲁木齐","lat":43.8256,"lon":87.6168},{"name":"香港","lat":22.3193,"lon":114.1694},{"name":"澳门","lat":22.1987,"lon":113.5439},{"name":"台北","lat":25.033,"lon":121.5654},{"name":"深圳","lat":22.5431,"lon":114.0579},{"name":"苏州","lat":31.2989,"lon":120.5853},{"name":"宁波","lat":29.8683,"lon":121.544},{"name":"青岛","lat":36.0671,"lon":120.3826},{"name":"厦门","lat":24.4798,"lon":118.0894},{"name":"大连","lat":38.914,"lon":121.6147},{"name":"无锡","lat":31.4912,"lon":120.3119},{"name":"佛山","lat":23.0218,"lon":113.1219},{"name":"东莞","lat":23.0207,"lon":113.7518},{"name":"珠海","lat":22.271,"lon":113.5767},{"name":"温州","lat":27.9949,"lon":120.6994},{"name":"烟台","lat":37.4638,"lon":121.4479},{"name":"潍坊","lat":36.7069,"lon":119.1619},{"name":"金华","lat":29.0791,"lon":119.6474},{"name":"嘉兴","lat":30.7461,"lon":120.7555},{"name":"南通","lat":31.9802,"lon":120.8943},{"name":"徐州","lat":34.2044,"lon":117.2858},{"name":"洛阳","lat":34.6197,"lon":112.454},{"name":"唐山","lat":39.6309,"lon":118.1802},{"name":"包头","lat":40.6578,"lon":109.8403},{"name":"大同","lat":40.0768,"lon":113.3001},{"name":"秦皇岛","lat":39.9354,"lon":119.6005},{"name":"吉林","lat":43.8378,"lon":126.5496},{"name":"齐齐哈尔","lat":47.3543,"lon":123.9182},{"name":"牡丹江","lat":44.5517,"lon":129.6329},{"name":"扬州","lat":32.3932,"lon":119.4128},{"name":"镇江","lat":32.1878,"lon":119.425},{"name":"芜湖","lat":31.3526,"lon":118.4331},{"name":"惠州","lat":23.1115,"lon":114.4152},{"name":"株洲","lat":27.8274,"lon":113.134},{"name":"宜昌","lat":30.6919,"lon":111.2865},{"name":"襄阳","lat":32.009,"lon":112.122},{"name":"三亚","lat":18.2528,"lon":109.5119},{"name":"绵阳","lat":31.4675,"lon":104.6796},{"name":"南充","lat":30.8373,"lon":106.1107},{"name":"遵义","lat":27.7257,"lon":106.927},{"name":"大理","lat":25.6065,"lon":100.2676},{"name":"喀什","lat":39.4677,"lon":75.9938},{"name":"酒泉","lat":39.732,"lon":98.494},{"name":"黄山","lat":29.715,"lon":118.338},{"name":"桂林","lat":25.274,"lon":110.29},{"name":"景德镇","lat":29.2688,"lon":117.1786}];
// ==================== 4. 天文历算核心引擎 ====================
function nearestKnownCityName(latitude, longitude) {
  let nearest = null;
  for (const city of NEARBY_CITIES) {
    const lat1 = latitude * DEG;
    const lat2 = city.lat * DEG;
    const deltaLat = (city.lat - latitude) * DEG;
    const deltaLon = (city.lon - longitude) * DEG;
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (!nearest || distance < nearest.distance) nearest = { ...city, distance };
  }
  if (!nearest || nearest.distance > 120) return "当前位置";
  return nearest.distance > 30 ? `附近·${nearest.name}` : nearest.name;
}

if (CITY && !CITY.name) CITY.name = nearestKnownCityName(CITY.lat, CITY.lon);

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function centuriesSinceJ2000(date) {
  return (julianDate(date) - 2451545.0) / 36525;
}

function gmstHours(jd) {
  const days = jd - 2451545.0;
  const T = days / 36525;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * days +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return mod(gmstDeg, 360) / 15;
}

function localSiderealHours(date, lon) {
  return mod(gmstHours(julianDate(date)) + lon / 15, 24);
}

function precessEquatorial(raHours, decDeg, date) {
  const T = centuriesSinceJ2000(date);
  const zeta = ((2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600) * DEG;
  const z = ((2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600) * DEG;
  const theta = ((2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600) * DEG;

  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;

  const A = Math.cos(dec) * Math.sin(ra + zeta);
  const B = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
  const C = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);

  return {
    ra: mod((Math.atan2(A, B) + z) * RAD, 360) / 15,
    dec: Math.asin(clamp(C, -1, 1)) * RAD
  };
}

function equatorialOfDateToHorizontal(raHours, decDeg, date, latDeg, lonDeg) {
  const lst = localSiderealHours(date, lonDeg);
  const ha = (lst - raHours) * 15 * DEG;
  const dec = decDeg * DEG;
  const lat = latDeg * DEG;

  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const altitude = Math.asin(clamp(sinAlt, -1, 1)) * RAD;

  const y = -Math.cos(dec) * Math.sin(ha);
  const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.cos(ha) * Math.sin(lat);
  const azimuth = mod(Math.atan2(y, x) * RAD, 360);

  return { ra: raHours, dec: decDeg, azimuth, altitude };
}

function meanObliquity(date) {
  const T = centuriesSinceJ2000(date);
  return (23.43929111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600) * DEG;
}

function eclipticToEquatorial(lambdaDeg, betaDeg, epsRad) {
  const lam = lambdaDeg * DEG;
  const bet = betaDeg * DEG;
  const sinDec = Math.sin(bet) * Math.cos(epsRad) + Math.cos(bet) * Math.sin(epsRad) * Math.sin(lam);
  const dec = Math.asin(clamp(sinDec, -1, 1)) * RAD;
  const y = Math.sin(lam) * Math.cos(epsRad) - Math.tan(bet) * Math.sin(epsRad);
  const x = Math.cos(lam);
  const ra = mod(Math.atan2(y, x) * RAD, 360) / 15;
  return { ra, dec };
}

function solarLongitude(date) {
  const T = centuriesSinceJ2000(date);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  return mod(L0 + C, 360);
}

function getCurrentSolarTerm(date) {
  const lon = solarLongitude(date);
  const idx = Math.floor(mod(lon, 360) / 15) % 24;
  return { name: SOLAR_TERMS[idx].name, lon, index: idx };
}

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 6; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

function heliocentricPlanet(el, T) {
  const a = el.a0 + el.da * T;
  const e = el.e0 + el.de * T;
  const I = (el.I0 + el.dI * T) * DEG;
  const L = mod(el.L0 + el.dL * T, 360) * DEG;
  const wBar = (el.w0 + el.dw * T) * DEG;
  const Omega = (el.O0 + el.dO * T) * DEG;
  const w = wBar - Omega;
  const M = mod((L - wBar) * RAD + 180, 360) * DEG - Math.PI;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const cosw = Math.cos(w), sinw = Math.sin(w);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  return {
    x: (cosw * cosO - sinw * sinO * cosI) * xp + (-sinw * cosO - cosw * sinO * cosI) * yp,
    y: (cosw * sinO + sinw * cosO * cosI) * xp + (-sinw * sinO + cosw * cosO * cosI) * yp,
    z: (sinw * sinI) * xp + (cosw * sinI) * yp
  };
}

const PLANET_ELEMENTS = [
  { key: "mercury", name: "水星", color: "#c2cedc", size: 4.5, a0: 0.38709927, da: 0.00000037, e0: 0.20563593, de: 0.00001906, I0: 7.00497902, dI: -0.00594749, L0: 252.2503235, dL: 149472.67411175, w0: 77.45779628, dw: 0.16047689, O0: 48.33076593, dO: -0.12534081 },
  { key: "venus", name: "金星", color: "#ffe7a8", size: 5.5, a0: 0.72333566, da: 0.00000390, e0: 0.00677672, de: -0.00004107, I0: 3.39467605, dI: -0.00078890, L0: 181.9790995, dL: 58517.81538729, w0: 131.60246718, dw: 0.00268329, O0: 76.67984255, dO: -0.27769418 },
  { key: "mars", name: "火星", color: "#ef8e7b", size: 5.0, a0: 1.52371034, da: 0.00001847, e0: 0.09339410, de: 0.00007882, I0: 1.84969142, dI: -0.00813131, L0: -4.55343205, dL: 19140.30268499, w0: -23.94362959, dw: 0.44441088, O0: 49.55953891, dO: -0.29257343 },
  { key: "jupiter", name: "木星", color: "#f2ca85", size: 6.0, a0: 5.20288700, da: -0.00011607, e0: 0.04838624, de: -0.00013253, I0: 1.30439695, dI: -0.00183714, L0: 34.39644051, dL: 3034.74612775, w0: 14.72847983, dw: 0.21252668, O0: 100.47390909, dO: 0.20469106 },
  { key: "saturn", name: "土星", color: "#dfc28f", size: 5.2, a0: 9.53667594, da: -0.00125060, e0: 0.05386179, de: -0.00050991, I0: 2.48599187, dI: 0.00193609, L0: 49.95424423, dL: 1222.49362201, w0: 92.59887831, dw: -0.41897216, O0: 113.66242448, dO: -0.28867794 }
];

const EARTH_ELEMENT = { a0: 1.00000261, da: 0.00000562, e0: 0.01671123, de: -0.00004392, I0: -0.00001531, dI: -0.01294668, L0: 100.46457166, dL: 35999.37244981, w0: 102.93768193, dw: 0.32327364, O0: 0.0, dO: 0.0 };

function planetaryBodies(date, lat, lon) {
  const T = centuriesSinceJ2000(date);
  const days = julianDate(date) - 2451545.0;
  const eps = meanObliquity(date);

  const sunLon = solarLongitude(date);
  const sunEq = eclipticToEquatorial(sunLon, 0, eps);
  const sunHor = equatorialOfDateToHorizontal(sunEq.ra, sunEq.dec, date, lat, lon);

  const Lm = mod(218.3164477 + 13.17639648 * days, 360);
  const Mm = mod(134.9633964 + 13.06499295 * days, 360) * DEG;
  const Ms = mod(357.5291092 + 0.98560028 * days, 360) * DEG;
  const D = mod(297.8501921 + 12.19074912 * days, 360) * DEG;
  const F = mod(93.2720950 + 13.22935024 * days, 360) * DEG;

  const moonLon = mod(
    Lm +
      6.288774 * Math.sin(Mm) +
      1.274027 * Math.sin(2 * D - Mm) +
      0.658314 * Math.sin(2 * D) +
      0.213618 * Math.sin(2 * Mm) -
      0.185596 * Math.sin(Ms) -
      0.114336 * Math.sin(2 * F),
    360
  );
  const moonLat =
    5.128122 * Math.sin(F) +
    0.280602 * Math.sin(Mm + F) +
    0.277693 * Math.sin(Mm - F) +
    0.173237 * Math.sin(2 * D - F);
  const moonEq = eclipticToEquatorial(moonLon, moonLat, eps);
  const moonHor = equatorialOfDateToHorizontal(moonEq.ra, moonEq.dec, date, lat, lon);

  const elongation = mod(moonLon - sunLon, 360);
  const phaseFraction = 0.5 * (1 - Math.cos(elongation * DEG));
  const phaseWaxing = elongation < 180;
  let phaseName = "新月";
  if (elongation >= 8 && elongation < 82) phaseName = "蛾眉月";
  else if (elongation >= 82 && elongation < 98) phaseName = "上弦月";
  else if (elongation >= 98 && elongation < 172) phaseName = "盈凸月";
  else if (elongation >= 172 && elongation < 188) phaseName = "满月";
  else if (elongation >= 188 && elongation < 262) phaseName = "亏凸月";
  else if (elongation >= 262 && elongation < 278) phaseName = "下弦月";
  else if (elongation >= 278 && elongation < 352) phaseName = "残月";

  const bodies = [
    { key: "sun", name: "太阳", ra: sunEq.ra, dec: sunEq.dec, altitude: sunHor.altitude, azimuth: sunHor.azimuth, color: "#f5d68c", size: 7.0 },
    { key: "moon", name: "月球", ra: moonEq.ra, dec: moonEq.dec, altitude: moonHor.altitude, azimuth: moonHor.azimuth, color: "#f5f0df", size: 6.2, phaseFraction, phaseWaxing, phaseName }
  ];

  const earth = heliocentricPlanet(EARTH_ELEMENT, T);
  for (const p of PLANET_ELEMENTS) {
    const helio = heliocentricPlanet(p, T);
    const dx = helio.x - earth.x;
    const dy = helio.y - earth.y;
    const dz = helio.z - earth.z;
    const lam = mod(Math.atan2(dy, dx) * RAD, 360);
    const bet = Math.atan2(dz, Math.hypot(dx, dy)) * RAD;
    const eq = eclipticToEquatorial(lam, bet, eps);
    const precessed = precessEquatorial(eq.ra, eq.dec, date);
    const hor = equatorialOfDateToHorizontal(precessed.ra, precessed.dec, date, lat, lon);
    bodies.push({
      key: p.key,
      name: p.name,
      ra: precessed.ra,
      dec: precessed.dec,
      altitude: hor.altitude,
      azimuth: hor.azimuth,
      color: p.color,
      size: p.size
    });
  }

  return bodies;
}

// ==================== 5. 网页版半球投影与绘制组件 ====================
// Follow src/renderer.js: the chart is a local-sky azimuthal projection, with
// east on the left and west on the right. The device location and time drive
// every sky coordinate; the native clock animation drives the three hands.
function projectHorizontal(horizontal, radius) {
  if (!horizontal || horizontal.altitude < 0) return null;
  const distance = radius * (1 - clamp(horizontal.altitude, 0, 90) / 90);
  const azimuth = horizontal.azimuth * DEG;
  return {
    x: -distance * Math.sin(azimuth),
    y: -distance * Math.cos(azimuth),
    radius: distance,
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth
  };
}

function projectEquatorial(ra, dec, date, radius) {
  const apparent = precessEquatorial(ra, dec, date);
  return projectHorizontal(equatorialOfDateToHorizontal(apparent.ra, apparent.dec, date, CITY.lat, CITY.lon), radius);
}

function projectOfDate(ra, dec, date, radius) {
  return projectHorizontal(equatorialOfDateToHorizontal(ra, dec, date, CITY.lat, CITY.lon), radius);
}

function projectActivityOfDate(ra, dec, date, radius) {
  const horizontal = equatorialOfDateToHorizontal(ra, dec, date, CITY.lat, CITY.lon);
  const latitudeSign = CITY.lat >= 0 ? 1 : -1;
  const poleDeclination = latitudeSign * 90;
  const limitDeclination = latitudeSign > 0
    ? Math.max(-90, CITY.lat - 110)
    : Math.min(90, CITY.lat + 110);
  const normalized = Math.abs(poleDeclination - dec) / Math.abs(poleDeclination - limitDeclination);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(date, CITY.lon) - ra) * latitudeSign * 15 * DEG;
  const angle = WATCH_ROTATION - hourAngle;
  const distance = radius * normalized;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    radius: distance,
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth
  };
}

// The activity chart's star map is laid out at a fixed sidereal reference and
// rotated as one background layer. Text and live body markers use the current
// projection above, so their glyphs stay upright while following the same sky.
function projectActivityReference(ra, dec, radius) {
  const latitudeSign = CITY.lat >= 0 ? 1 : -1;
  const poleDeclination = latitudeSign * 90;
  const limitDeclination = latitudeSign > 0
    ? Math.max(-90, CITY.lat - 110)
    : Math.min(90, CITY.lat + 110);
  const normalized = Math.abs(poleDeclination - dec) / Math.abs(poleDeclination - limitDeclination);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const distance = radius * normalized;
  const angle = WATCH_ROTATION + ra * latitudeSign * 15 * DEG;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    radius: distance
  };
}

function projectActivityReferenceEquatorial(ra, dec, date, radius) {
  const apparent = precessEquatorial(ra, dec, date);
  return projectActivityReference(apparent.ra, apparent.dec, radius);
}

function activityBackgroundRotation(date) {
  const latitudeSign = CITY.lat >= 0 ? 1 : -1;
  return -mod(localSiderealHours(date, CITY.lon), 24) * latitudeSign * 15;
}

function projectActivityEquatorial(ra, dec, date, radius) {
  const apparent = precessEquatorial(ra, dec, date);
  return projectActivityOfDate(apparent.ra, apparent.dec, date, radius);
}

function equatorialAtHorizontal(azimuthDegrees, altitudeDegrees, date) {
  const latitude = CITY.lat * DEG;
  const azimuth = azimuthDegrees * DEG;
  const altitude = altitudeDegrees * DEG;
  const sinDec = Math.sin(latitude) * Math.sin(altitude)
    + Math.cos(latitude) * Math.cos(altitude) * Math.cos(azimuth);
  const dec = Math.asin(clamp(sinDec, -1, 1)) * RAD;
  const cosDec = Math.max(0.000001, Math.cos(dec * DEG));
  const sinHourAngle = -Math.cos(altitude) * Math.sin(azimuth) / cosDec;
  const cosHourAngle = (
    Math.sin(altitude) * Math.cos(latitude)
    - Math.cos(altitude) * Math.cos(azimuth) * Math.sin(latitude)
  ) / cosDec;
  const hourAngle = Math.atan2(sinHourAngle, cosHourAngle) * RAD / 15;
  return { ra: mod(localSiderealHours(date, CITY.lon) - hourAngle, 24), dec };
}

function placeAt(D, dx, dy, boxW, boxH, child) {
  const cx = D / 2;
  const cy = D / 2;
  const w = Math.max(1, boxW);
  const h = Math.max(1, boxH);
  const left = clamp(Math.round(cx + dx - w / 2), 0, Math.max(0, D - w));
  const top = clamp(Math.round(cy + dy - h / 2), 0, Math.max(0, D - h));
  return (
    <vstack frame={`${D},${D},topLeading`} alignment="leading" spacing="0">
      <rect frame={`1,${top}`} color="clear" />
      <hstack frame={`${D},${h},leading`} alignment="center" spacing="0">
        <rect frame={`${left},1`} color="clear" />
        {child}
      </hstack>
    </vstack>
  );
}

function addDot(nodes, D, x, y, diameter, color, opacity = 1) {
  const size = Math.max(0.7, diameter);
  nodes.push(placeAt(D, x, y, size + 1, size + 1,
    <circle frame={`${size},${size}`} color={color} opacity={opacity} />));
}

function addLine(nodes, D, x1, y1, x2, y2, thickness, color, opacity = 1) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 0.35) return;
  const width = Math.max(0.38, thickness);
  const angle = Math.atan2(dy, dx) * RAD;
  nodes.push(placeAt(D, (x1 + x2) / 2, (y1 + y2) / 2, length + 1, width + 1,
    <line frame={`${length + 1},${width + 1}`} axis="horizontal" length={length} thickness={width} color={color} opacity={opacity} rotation={angle} />));
}

function addPolyline(nodes, D, points, project, thickness, color, opacity = 1, step = 1, close = false) {
  if (!points || points.length < 2) return;
  const projected = [];
  for (let index = 0; index < points.length; index += step) {
    const point = project(points[index][0], points[index][1]);
    projected.push(point);
  }
  const lastIndex = points.length - 1;
  if ((points.length - 1) % step !== 0) {
    const last = points[lastIndex];
    projected.push(project(last[0], last[1]));
  }
  let previous = null;
  for (const point of projected) {
    if (!point) {
      previous = null;
      continue;
    }
    if (previous) addLine(nodes, D, previous.x, previous.y, point.x, point.y, thickness, color, opacity);
    previous = point;
  }
  if (close && projected[0] && projected[projected.length - 1]) {
    const first = projected[0];
    const last = projected[projected.length - 1];
    addLine(nodes, D, last.x, last.y, first.x, first.y, thickness, color, opacity);
  }
}

function polarPoint(angle, radius) {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function placeText(D, x, y, width, height, text, fontSize, color, opacity = 1, rotation = 0, weight = "regular") {
  return placeAt(D, x, y, width, height,
    <text frame={`${width},${height}`} font={`${fontSize},${weight},default`} fontWeight={weight} color={color} opacity={opacity} rotation={rotation}>{text}</text>);
}

function moonCoordinates(date) {
  const days = julianDate(date) - 2451545.0;
  const sunLon = solarLongitude(date);
  const Lm = mod(218.3164477 + 13.17639648 * days, 360);
  const Mm = mod(134.9633964 + 13.06499295 * days, 360) * DEG;
  const Ms = mod(357.5291092 + 0.98560028 * days, 360) * DEG;
  const Dm = mod(297.8501921 + 12.19074912 * days, 360) * DEG;
  const F = mod(93.2720950 + 13.22935024 * days, 360) * DEG;
  const longitude = mod(
    Lm + 6.288774 * Math.sin(Mm) + 1.274027 * Math.sin(2 * Dm - Mm)
      + 0.658314 * Math.sin(2 * Dm) + 0.213618 * Math.sin(2 * Mm)
      - 0.185596 * Math.sin(Ms) - 0.114336 * Math.sin(2 * F),
    360
  );
  const latitude = 5.128122 * Math.sin(F) + 0.280602 * Math.sin(Mm + F)
    + 0.277693 * Math.sin(Mm - F) + 0.173237 * Math.sin(2 * Dm - F);
  const eq = eclipticToEquatorial(longitude, latitude, meanObliquity(date));
  const illumination = (1 - Math.cos(mod(longitude - sunLon, 360) * DEG)) / 2;
  return { ...eq, illumination };
}

function solarAltitudeAt(date) {
  const eq = eclipticToEquatorial(solarLongitude(date), 0, meanObliquity(date));
  return equatorialOfDateToHorizontal(eq.ra, eq.dec, date, CITY.lat, CITY.lon).altitude;
}

function timeStateAt(date) {
  const altitude = solarAltitudeAt(date);
  if (altitude >= 0) return "day";
  if (altitude >= -0.833) return "standard";
  if (altitude >= -6) return "civil";
  if (altitude >= -12) return "nautical";
  if (altitude >= -18) return "astronomical";
  const moon = moonCoordinates(date);
  const moonHorizontal = equatorialOfDateToHorizontal(moon.ra, moon.dec, date, CITY.lat, CITY.lon);
  return moonHorizontal.altitude > 0 && moon.illumination >= 0.08 ? "moon" : "night";
}

function localTimeRing(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const span = end.getTime() - start.getTime();
  const count = 144;
  const states = [];
  for (let index = 0; index < count; index += 1) {
    const sample = new Date(start.getTime() + span * (index + 0.5) / count);
    states.push(timeStateAt(sample));
  }
  const transitions = [];
  for (let index = 0; index < count; index += 1) {
    const before = states[(index + count - 1) % count];
    const after = states[index];
    if (before !== after && (before === "day" || after === "day")) {
      transitions.push({ fraction: index / count, label: after === "day" ? "日出" : "日落" });
    }
  }
  const localFraction = (date.getTime() - start.getTime()) / span;
  return { states, transitions, localFraction: clamp(localFraction, 0, 1) };
}

const TIME_COLORS = {
  day: "#f4f1df",
  standard: "#f6e2b4",
  civil: "#f2c36c",
  nautical: "#79aeea",
  astronomical: "#d59af4",
  moon: "#9bcdf7",
  night: "#1b335e"
};

function buildTimeRing(D, radius, scale, timeRing, date) {
  const nodes = [];
  const trackRadius = radius + 23 * scale;
  const trackOuter = radius + 27 * scale;
  const trackWidth = 8 * scale;
  const circumference = TAU * trackRadius;
  const count = timeRing.states.length;
  const displaySegments = 12;
  const segmentLength = circumference / displaySegments * 1.06;
  for (let index = 0; index < displaySegments; index += 1) {
    const sourceIndex = Math.min(count - 1, Math.floor((index + 0.5) * count / displaySegments));
    const angle = -Math.PI / 2 + ((index + 0.5) / displaySegments) * TAU;
    const point = polarPoint(angle, trackRadius);
    const color = TIME_COLORS[timeRing.states[sourceIndex]] || TIME_COLORS.night;
    nodes.push(placeAt(D, point.x, point.y, segmentLength + 1, trackWidth + 1,
      <line frame={`${segmentLength + 1},${trackWidth + 1}`} axis="horizontal" length={segmentLength} thickness={trackWidth} color={color} rotation={(angle + Math.PI / 2) * RAD} />));
  }

  for (let index = 0; index < 12; index += 1) {
    const angle = -Math.PI / 2 + (index / 12) * TAU;
    const major = index % 3 === 0;
    const medium = index % 2 === 0;
    const length = (major ? 8 : medium ? 5 : 3) * scale;
    const pointA = polarPoint(angle, trackOuter - length);
    const pointB = polarPoint(angle, trackOuter);
    addLine(nodes, D, pointA.x, pointA.y, pointB.x, pointB.y,
      Math.max(0.25, (major ? 1 : 0.7) * scale), major ? "#f0eee5" : "#8993ab", major ? 0.78 : 0.58);
  }

  for (const transition of timeRing.transitions) {
    const angle = -Math.PI / 2 + transition.fraction * TAU;
    const point = polarPoint(angle, trackOuter + 3 * scale);
    nodes.push(placeText(D, point.x, point.y, 22 * scale, 11 * scale, transition.label,
      Math.max(2.2, 8 * scale), "#f5f0df", 0.9, 0, "semibold"));
  }

  const markerAngle = -Math.PI / 2 + timeRing.localFraction * TAU;
  const marker = polarPoint(markerAngle, trackRadius);
  const sunRadius = Math.max(1.1, 2.5 * scale);
  addDot(nodes, D, marker.x, marker.y, sunRadius * 2, "#ff292f", 1);
  for (let ray = 0; ray < 4; ray += 1) {
    const angle = markerAngle + ray * TAU / 4;
    const inner = polarPoint(angle, trackRadius + sunRadius + 0.4 * scale);
    const outer = polarPoint(angle, trackRadius + sunRadius + 3.2 * scale);
    addLine(nodes, D, inner.x, inner.y, outer.x, outer.y, Math.max(0.65, 1.6 * scale), "#ff292f", 1);
  }
  return nodes;
}

function buildSolarTermRing(D, radius, scale, date, bodies) {
  const nodes = [];
  const bandWidth = 16 * scale;
  const bandInner = radius + 1.3 * scale;
  const bandMid = radius + bandWidth / 2 + scale;
  const bandOuter = radius + bandWidth + scale;
  const currentIndex = getCurrentSolarTerm(date).index;
  const obliquity = meanObliquity(date);
  const angleAtLongitude = (longitude) => {
    const eq = eclipticToEquatorial(longitude, 0, obliquity);
    if (PACKAGE_KIND === "active-planisphere") {
      const point = projectActivityOfDate(eq.ra, eq.dec, date, radius);
      return point ? Math.atan2(point.y, point.x) : -Math.PI / 2;
    }
    const horizontal = equatorialOfDateToHorizontal(eq.ra, eq.dec, date, CITY.lat, CITY.lon);
    return -horizontal.azimuth * DEG - Math.PI / 2;
  };

  for (let index = 0; index < SOLAR_TERMS.length; index += 1) {
    const term = SOLAR_TERMS[index];
    const startAngle = angleAtLongitude(term.lon);
    const endAngle = angleAtLongitude((term.lon + 15) % 360);
    const middleAngle = angleAtLongitude((term.lon + 7.5) % 360);
    const start = polarPoint(startAngle, bandInner);
    const end = polarPoint(startAngle, bandOuter - 0.3 * scale);
    if (index % 3 === 0) {
      addLine(nodes, D, start.x, start.y, end.x, end.y,
        Math.max(0.42, 0.65 * scale), "#dab670", 0.52);
    }

    if (index === currentIndex) {
      // Draw a short bright chord through the active term segment.
      let a = startAngle;
      let b = endAngle;
      while (b - a > Math.PI) b -= TAU;
      while (b - a < -Math.PI) b += TAU;
      const p1 = polarPoint(a, bandMid);
      const p2 = polarPoint(b, bandMid);
      addLine(nodes, D, p1.x, p1.y, p2.x, p2.y,
        Math.max(1.2, (bandWidth - scale) * 0.75), "#f5d68c", 0.34);
    }

    let textRotation = middleAngle + Math.PI / 2;
    if (Math.sin(middleAngle) > 0) textRotation += Math.PI;
    const labelPoint = polarPoint(middleAngle, bandMid);
    const fontSize = Math.max(2.2, 11 * scale);
    nodes.push(placeText(D, labelPoint.x, labelPoint.y, 22 * scale, 13 * scale,
      term.name, fontSize, index === currentIndex ? "#f5d68c" : "#d2dceb",
      index === currentIndex ? 1 : 0.86, textRotation * RAD, index === currentIndex ? "bold" : "regular"));
  }

  // The triangular solar pointer sits on the inner edge of the term band.
  const sun = bodies.find((body) => body.key === "sun");
  if (sun) {
    const sunPoint = PACKAGE_KIND === "active-planisphere"
      ? projectActivityOfDate(sun.ra, sun.dec, date, radius)
      : null;
    const horizontal = sunPoint ? null : equatorialOfDateToHorizontal(sun.ra, sun.dec, date, CITY.lat, CITY.lon);
    const angle = sunPoint ? Math.atan2(sunPoint.y, sunPoint.x) : -horizontal.azimuth * DEG - Math.PI / 2;
    const radial = { x: Math.cos(angle), y: Math.sin(angle) };
    const tangent = { x: -radial.y, y: radial.x };
    const tipRadius = radius + 6.2 * scale;
    const baseRadius = radius + 0.2 * scale;
    const halfBase = 4.2 * scale;
    const tip = { x: radial.x * tipRadius, y: radial.y * tipRadius };
    const left = { x: radial.x * baseRadius + tangent.x * halfBase, y: radial.y * baseRadius + tangent.y * halfBase };
    const right = { x: radial.x * baseRadius - tangent.x * halfBase, y: radial.y * baseRadius - tangent.y * halfBase };
    addLine(nodes, D, tip.x, tip.y, left.x, left.y, Math.max(0.8, 1.25 * scale), "#f5d68c", 1);
    addLine(nodes, D, tip.x, tip.y, right.x, right.y, Math.max(0.8, 1.25 * scale), "#f5d68c", 1);
    addLine(nodes, D, left.x, left.y, right.x, right.y, Math.max(0.8, 1.25 * scale), "#f5d68c", 1);
  }
  return nodes;
}

function buildPlanisphereDial(D, date, bodies, mode) {
  const scale = D / 512;
  const radius = Math.max(1, D / 2 - 35 * scale - 1);
  const borderWidth = Math.max(0.35, 1.35 * scale);
  const innerRadius = radius - borderWidth / 2;
  const timeRing = localTimeRing(date);
  const skyNodes = [];
  const gridNodes = [];
  const boundaryNodes = [];
  const constellationNodes = [];
  const galaxyNodes = [];
  const starNodes = [];
  const bodyNodes = [];
  const labelNodes = [];
  const activePlanisphere = PACKAGE_KIND === "active-planisphere";
  const projectStar = activePlanisphere
    ? (ra, dec) => projectActivityEquatorial(ra, dec, date, innerRadius)
    : (ra, dec) => projectEquatorial(ra, dec, date, innerRadius);
  const projectDate = activePlanisphere
    ? (ra, dec) => projectActivityOfDate(ra, dec, date, innerRadius)
    : (ra, dec) => projectOfDate(ra, dec, date, innerRadius);
  const projectSkyBase = activePlanisphere
    ? (ra, dec) => projectActivityReferenceEquatorial(ra, dec, date, innerRadius)
    : projectStar;
  const projectDateBase = activePlanisphere
    ? (ra, dec) => projectActivityReference(ra, dec, innerRadius)
    : projectDate;
  const backgroundRotation = activePlanisphere ? activityBackgroundRotation(date) : 0;

  if (activePlanisphere) {
    const latitudeSign = CITY.lat >= 0 ? 1 : -1;
    const limitDeclination = latitudeSign > 0
      ? Math.max(-90, CITY.lat - 110)
      : Math.min(90, CITY.lat + 110);
    const backgroundScale = 180 / Math.abs(90 - limitDeclination);
    const hemisphere = latitudeSign > 0 ? "north" : "south";
    skyNodes.push(<image name={`image/sky-base-${hemisphere}.png`}
      frame={`${2 * innerRadius * backgroundScale},${2 * innerRadius * backgroundScale}`} mode="fit" />);
  } else {
    // The local-sky widget keeps a small live vector layer around the brighter stars.
    skyNodes.push(<circle frame={`${2 * innerRadius},${2 * innerRadius}`} color="#030817" />);
    skyNodes.push(<circle frame={`${1.72 * innerRadius},${1.72 * innerRadius}`} color="#091736" opacity="0.92" />);
    skyNodes.push(<circle frame={`${1.15 * innerRadius},${1.15 * innerRadius}`} color="#0e2045" opacity="0.62" />);
  }

  // Home uses the local altitude/azimuth grid. The activity dial uses the
  // web Watch polar projection with its matching curved horizon coordinates.
  const gridStep = D < 190 ? 30 : 15;
  if (activePlanisphere) {
    for (const altitude of [30, 60]) {
      const path = [];
      for (let azimuth = 0; azimuth < 360; azimuth += 45) {
        const eq = equatorialAtHorizontal(azimuth, altitude, date);
        path.push([eq.ra, eq.dec]);
      }
      addPolyline(gridNodes, D, path, projectDateBase, Math.max(0.34, 0.62 * scale), "#6a84ac", 0.30, 1, true);
    }
    for (let azimuth = 0; azimuth < 360; azimuth += 90) {
      const path = [];
      const altitudeStep = 15;
      for (let altitude = 0; altitude <= 90; altitude += altitudeStep) {
        const eq = equatorialAtHorizontal(azimuth, altitude, date);
        path.push([eq.ra, eq.dec]);
      }
      addPolyline(gridNodes, D, path, projectDateBase, Math.max(0.34, 0.58 * scale), "#6a84ac", 0.27, 2);
    }
  } else {
    for (const altitude of [30, 60]) {
      const circleRadius = innerRadius * (1 - altitude / 90);
      const steps = 12;
      for (let index = 0; index < steps; index += 1) {
        const first = polarPoint((index / steps) * TAU, circleRadius);
        const second = polarPoint(((index + 1) / steps) * TAU, circleRadius);
        addLine(gridNodes, D, first.x, first.y, second.x, second.y,
          Math.max(0.25, 0.62 * scale), "#6a84ac", 0.30);
      }
    }
    for (let azimuth = 0; azimuth < 360; azimuth += 90) {
      const angle = (-azimuth - 90) * DEG;
      const end = polarPoint(angle, innerRadius);
      addLine(gridNodes, D, 0, 0, end.x, end.y, Math.max(0.25, 0.58 * scale), "#6a84ac", 0.27);
    }
  }

  // Milky Way is a narrow, softly layered band, never a large filled polygon.
  if (!activePlanisphere) {
    addPolyline(galaxyNodes, D, MILKY_WAY_CENTERLINE, projectSkyBase,
      Math.max(1.2, 4.2 * scale), "#d9e8ff", 0.045, D < 190 ? 24 : 18);
    addPolyline(galaxyNodes, D, MILKY_WAY_CENTERLINE, projectSkyBase,
      Math.max(0.55, 1.4 * scale), "#eff5ff", 0.10, D < 190 ? 24 : 18);
  }

  // Ecliptic and celestial equator use the web palette and real date precession.
  if (!activePlanisphere) {
    const equator = [];
    for (let ra = 0; ra <= 24; ra += 2) equator.push([ra % 24, 0]);
    addPolyline(skyNodes, D, equator, projectSkyBase,
      Math.max(0.25, 0.7 * scale), "#ef6868", 0.86, 1, true);

    const ecliptic = [];
    for (let longitude = 0; longitude <= 360; longitude += 30) {
      const coordinates = eclipticToEquatorial(longitude, 0, meanObliquity(date));
      ecliptic.push([coordinates.ra, coordinates.dec]);
    }
    addPolyline(skyNodes, D, ecliptic, projectDateBase,
      Math.max(0.35, 1.4 * scale), "#f2c36c", 0.86, 1, true);
  }

  // The circular chart rim already marks the horizon edge; its light border
  // is part of the clipped base circle, so no segmented horizon is needed.
  const horizonNodes = [];

  // Constellation boundary lines and connecting lines from the repository data.
  for (let conIndex = 0; !activePlanisphere && conIndex < Math.min(CONSTELLATIONS.length, 6); conIndex += 1) {
    const constellation = CONSTELLATIONS[conIndex];
    const line = constellation.lines[0];
    if (line) {
      addPolyline(constellationNodes, D, line, projectSkyBase,
        Math.max(0.25, 0.52 * scale), "#7ac7d6", 0.43, D < 190 ? 4 : 2);
    }
  }

  // Real stars; keep more depth on the large family and compact the tiny family.
  const starLimit = activePlanisphere ? -1 : (D < 190 ? 1.3 : 1.8);
  let renderedStars = 0;
  for (const star of STARS) {
    if (star.magnitude > starLimit) continue;
    const point = projectSkyBase(star.ra, star.dec);
    const labelPoint = projectStar(star.ra, star.dec);
    if (!point) continue;
    if (!activePlanisphere && renderedStars >= (D < 190 ? 10 : 16)) continue;
    renderedStars += 1;
    const diameter = clamp((2.0 + (3.6 - star.magnitude) * 1.2) * scale, 0.7, 3.8 * scale);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : "#f5f0df";
    const alpha = clamp(1.02 - star.magnitude / 7, 0.42, 1);
    if (star.magnitude <= 1.4) addDot(starNodes, D, point.x, point.y, diameter * 3.2, color, 0.10);
    addDot(starNodes, D, point.x, point.y, diameter, color, alpha);
    if (star.magnitude <= 0.8 && star.name && labelPoint) {
      labelNodes.push(placeText(D, labelPoint.x + 6 * scale, labelPoint.y - 3 * scale, 32 * scale, 12 * scale,
        star.name, Math.max(2.2, 10 * scale), "#f0eee5", 0.74, 0, "regular"));
    }
  }

  // Planets, phase-lit Moon, and Saturn's ring follow the calculated local sky.
  const sun = bodies.find((body) => body.key === "sun");
  const sunPoint = sun ? projectDate(sun.ra, sun.dec) : null;
  for (const body of bodies) {
    const point = projectDate(body.ra, body.dec);
    if (!point) continue;
    const diameter = Math.max(2.2, body.size * 2 * scale);
    const box = body.key === "saturn" ? diameter * 2.3 : diameter + 2;
    const node = body.key === "moon"
      ? <zstack frame={`${diameter},${diameter}`} clip="circle">
          <circle frame={`${diameter},${diameter}`} color="#09182f" />
          <hstack frame={`${diameter},${diameter}`} alignment={body.phaseWaxing ? "trailing" : "leading"} clip="circle">
            <ellipse frame={`${Math.max(0, diameter * body.phaseFraction)},${diameter}`} color={body.color} />
          </hstack>
        </zstack>
      : <zstack frame={`${box},${box}`} alignment="center">
          {body.key === "saturn" ? <ellipse frame={`${diameter * 2.2},${diameter * 0.72}`} color="#dfc28f" opacity="0.74" rotation="-22" /> : null}
          <circle frame={`${diameter + 2},${diameter + 2}`} color={body.color} opacity="0.20" />
          <circle frame={`${diameter},${diameter}`} color={body.color} />
        </zstack>;
    bodyNodes.push(placeAt(D, point.x, point.y, box, box, node));
    if (body.key !== "sun" || mode === "large") {
      const labelDx = point.x < 0 ? -8 * scale : 8 * scale;
      bodyNodes.push(placeText(D, point.x + labelDx, point.y - 5 * scale, 28 * scale, 12 * scale,
        body.name, Math.max(2.2, 9 * scale), body.color, 0.90, 0, "medium"));
    }
  }

  // Constellation names remain faint, matching the web Watch linework.
  for (let constellationIndex = 0; constellationIndex < (activePlanisphere ? 16 : 6); constellationIndex += 1) {
    const constellation = CONSTELLATIONS[constellationIndex];
    if (!constellation) continue;
    for (const [ra, dec] of constellation.labels) {
      const point = projectStar(ra, dec);
      if (!point) continue;
      labelNodes.push(placeText(D, point.x, point.y, 32 * scale, 12 * scale,
        constellation.name, Math.max(2.2, 10 * scale), "#7ac7d6", 0.40, 0, "regular"));
    }
  }

  // Accurate 1–12 month marks use the Sun's actual ecliptic longitude on each
  // local calendar month's first day, just like the website Watch renderer.
  const year = date.getFullYear();
  for (let month = 0; month < 12; month += 1) {
    const monthStart = new Date(year, month, 1, 0, 0, 0);
    const longitude = solarLongitude(monthStart);
    const before = eclipticToEquatorial(longitude - 1, 0, meanObliquity(date));
    const current = eclipticToEquatorial(longitude, 0, meanObliquity(date));
    const after = eclipticToEquatorial(longitude + 1, 0, meanObliquity(date));
    const a = projectDate(before.ra, before.dec);
    const p = projectDate(current.ra, current.dec);
    const b = projectDate(after.ra, after.dec);
    if (!a || !p || !b) continue;
    let rotation = Math.atan2(b.y - a.y, b.x - a.x);
    if (Math.cos(rotation) < 0) rotation += Math.PI;
    labelNodes.push(placeText(D, p.x, p.y, 13 * scale, 12 * scale, String(month + 1),
      Math.max(2.2, 9 * scale), "#f5d68c", 0.98, rotation * RAD, "bold"));
  }

  // Eight horizon bearings use azimuth itself: east (90°) is on the left.
  const directionRadius = Math.max(4, innerRadius - 20 * scale);
  const directionFont = Math.max(2.2, 11 * scale);
  const directions = [["北", 0], ["东北", 45], ["东", 90], ["东南", 135], ["南", 180], ["西南", 225], ["西", 270], ["西北", 315]];
  const directionNodes = [];
  for (const [label, azimuth] of directions) {
    let x;
    let y;
    if (activePlanisphere) {
      const eq = equatorialAtHorizontal(azimuth, 0, date);
      const point = projectDate(eq.ra, eq.dec);
      if (!point) continue;
      x = point.x;
      y = point.y;
    } else {
      const angle = azimuth * DEG;
      x = -directionRadius * Math.sin(angle);
      y = -directionRadius * Math.cos(angle);
    }
    directionNodes.push(placeText(D, x, y, 23 * scale, 13 * scale, label,
      directionFont, "#ffffff", 0.96, 0, "bold"));
  }

  // Draw the fine white horizon rim first, then clip the actual sky to it.
  const solarRingNodes = buildSolarTermRing(D, radius, scale, date, bodies);
  const timeRingNodes = buildTimeRing(D, radius, scale, timeRing, date);
  const hands = (
    <zstack frame={`${D},${D}`} alignment="center">
      <vstack animation="clockHour">
        <capsule frame={`${Math.max(0.7, D * 0.0042)},${Math.round(D * 0.15)}`} color="#f4e8c6" />
        <capsule frame={`${Math.max(0.7, D * 0.0042)},${Math.round(D * 0.15)}`} color="clear" />
      </vstack>
      <vstack animation="clockMinute">
        <capsule frame={`${Math.max(0.6, D * 0.0030)},${Math.round(D * 0.23)}`} color="#fff4dd" />
        <capsule frame={`${Math.max(0.6, D * 0.0030)},${Math.round(D * 0.23)}`} color="clear" />
      </vstack>
      <vstack animation="clockSecond">
        <capsule frame={`${Math.max(0.5, D * 0.0019)},${Math.round(D * 0.30)}`} color="#ff4b50" />
        <capsule frame={`${Math.max(0.5, D * 0.0019)},${Math.round(D * 0.30)}`} color="clear" />
      </vstack>
      <circle frame={`${Math.max(3.5, D * 0.018)},${Math.max(3.5, D * 0.018)}`} color="#f5d68c" />
    </zstack>
  );

  return (
    <zstack frame={`${D},${D}`} alignment="center" background="#030817">
      {/* The dial fills the square like the shared iPhone widget screenshot. */}
      <circle frame={`${D - 2},${D - 2}`} color="#dcb870" opacity="0.76" />
      <circle frame={`${D - 4},${D - 4}`} color="#102442" />
      <circle frame={`${D - 6},${D - 6}`} color="#071327" />

      {/* Solar-term band: a restrained blue ring with fine gold borders. */}
      <circle frame={`${2 * (radius + 17 * scale)},${2 * (radius + 17 * scale)}`} color="#dcb870" opacity="0.66" />
      <circle frame={`${2 * (radius + 16.3 * scale)},${2 * (radius + 16.3 * scale)}`} color="#183153" />
      <circle frame={`${2 * (radius + 1.9 * scale)},${2 * (radius + 1.9 * scale)}`} color="#dcb870" opacity="0.48" />
      <circle frame={`${2 * (radius + 1.3 * scale)},${2 * (radius + 1.3 * scale)}`} color="#030817" />

      {/* The white horizon edge and luminous blue sky surface. */}
      <circle frame={`${2 * radius + borderWidth},${2 * radius + borderWidth}`} color="#f5f5f5" opacity="0.85" />
      <circle frame={`${2 * innerRadius},${2 * innerRadius}`} color="#030817" />
      <zstack frame={`${2 * innerRadius},${2 * innerRadius}`} clip="circle" alignment="center">
        <zstack frame={`${D},${D}`} alignment="center" rotation={backgroundRotation}>
          {skyNodes}
          {galaxyNodes}
          {gridNodes}
          {horizonNodes}
          {boundaryNodes}
          {constellationNodes}
          {starNodes}
        </zstack>
        <zstack frame={`${D},${D}`} alignment="center">
          {bodyNodes}
          {labelNodes}
          {directionNodes}
        </zstack>
      </zstack>

      {/* Web-style solar terms and twilight/day/moonlight outer time ring. */}
      {solarRingNodes}
      {timeRingNodes}

      {/* Native ScriptWidget timeline animations provide moving clock hands. */}
      {hands}
    </zstack>
  );
}

// ==================== 6. Local sky and component family selection ====================
const now = new Date();
const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
const dateStr = `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
const lst = localSiderealHours(now, CITY.lon);
const lstH = Math.floor(lst);
const lstM = Math.floor((lst - lstH) * 60);
const lstStr = `${pad2(lstH)}h ${pad2(lstM)}m`;
const solarTerm = getCurrentSolarTerm(now);
const bodies = planetaryBodies(now, CITY.lat, CITY.lon);
const moon = bodies.find((body) => body.key === "moon");
const visibleBodies = bodies.filter((body) => body.altitude >= 0);
const locationText = `${CITY.name} · ${Math.abs(CITY.lat).toFixed(2)}°${CITY.lat >= 0 ? "N" : "S"} ${Math.abs(CITY.lon).toFixed(2)}°${CITY.lon >= 0 ? "E" : "W"}`;
const rawFamily = typeof $getenv === "function" ? String($getenv("widget-size") || "large").toLowerCase() : "large";

if (rawFamily.includes("inline")) {
  $render(<hstack spacing="4"><text>{CITY.name} · {solarTerm.name} · {moon.phaseName}</text></hstack>);
} else if (rawFamily.includes("circular")) {
  $render(
    <zstack frame="max" alignment="center" background="#030817">
      <circle frame="56,56" color="#0b2244" />
      <vstack alignment="center" spacing="1">
        <text font="8,bold,default" color="#f5d68c">{solarTerm.name}</text>
        <text font="11,bold,default" color="#f5f0df">{pad2(lstH)}:{pad2(lstM)}</text>
        <text font="7,regular,default" color="#79c8d2">{moon.phaseName}</text>
      </vstack>
    </zstack>
  );
} else if (rawFamily.includes("rectangular")) {
  const visibleNames = visibleBodies.map((body) => body.name).join(" ") || "暂无可见行星";
  $render(
    <vstack frame="max" alignment="leading" spacing="2" padding="8" background="#030817">
      <hstack spacing="4"><text font="10,bold,default" color="#f5d68c">{CITY.name} · {solarTerm.name}</text><spacer /><text font="9,regular,default" color="#79c8d2">LST {lstStr}</text></hstack>
      <text font="9,regular,default" color="#f5f0df">月相：{moon.phaseName} · {Math.round(moon.phaseFraction * 100)}% · {dateStr} {timeStr}</text>
      <text font="8,regular,default" color="#9ba9bf">地平以上：{visibleNames}</text>
    </vstack>
  );
} else if (rawFamily.includes("small")) {
  $render(<zstack frame="max" alignment="center" background="#030817">{buildPlanisphereDial(148, now, bodies, "small")}</zstack>);
} else if (rawFamily.includes("medium")) {
  $render(
    <hstack frame="max" padding="4,6,4,6" background="#030817" spacing="5" alignment="center">
      {buildPlanisphereDial(142, now, bodies, "medium")}
      <vstack frame="max" alignment="leading" spacing="3">
        <text font="10,bold,default" color="#f5d68c">{CITY.name}</text>
        <text font="8,regular,default" color="#79c8d2">恒星时 {lstStr}</text>
        <text font="8,regular,default" color="#f5f0df">{solarTerm.name} · {moon.phaseName}</text>
        <text font="7,regular,default" color="#9ba9bf">{locationText}</text>
      </vstack>
    </hstack>
  );
} else {
  $render(<zstack frame="max" alignment="center" background="#030817">{buildPlanisphereDial(332, now, bodies, "large")}</zstack>);
}
}

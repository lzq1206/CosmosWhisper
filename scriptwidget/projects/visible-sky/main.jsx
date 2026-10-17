/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page every 15 minutes.
 * City screenshot with contained bounds and ScriptWidget's native clock hands.
 */
const PACKAGE_KIND = "visible-sky";
const CITY_CATALOG = [{"id":"beijing","name":"北京","lat":39.9042,"lon":116.4074},{"id":"shanghai","name":"上海","lat":31.2304,"lon":121.4737},{"id":"tianjin","name":"天津","lat":39.0842,"lon":117.201},{"id":"chongqing","name":"重庆","lat":29.563,"lon":106.5516},{"id":"shijiazhuang","name":"石家庄","lat":38.0428,"lon":114.5149},{"id":"taiyuan","name":"太原","lat":37.8706,"lon":112.5489},{"id":"hohhot","name":"呼和浩特","lat":40.8424,"lon":111.7492},{"id":"shenyang","name":"沈阳","lat":41.8057,"lon":123.4315},{"id":"changchun","name":"长春","lat":43.8171,"lon":125.3235},{"id":"harbin","name":"哈尔滨","lat":45.8038,"lon":126.535},{"id":"nanjing","name":"南京","lat":32.0603,"lon":118.7969},{"id":"hangzhou","name":"杭州","lat":30.2741,"lon":120.1551},{"id":"hefei","name":"合肥","lat":31.8206,"lon":117.2272},{"id":"fuzhou","name":"福州","lat":26.0745,"lon":119.2965},{"id":"nanchang","name":"南昌","lat":28.682,"lon":115.8579},{"id":"jinan","name":"济南","lat":36.6512,"lon":117.1201},{"id":"zhengzhou","name":"郑州","lat":34.7466,"lon":113.6254},{"id":"wuhan","name":"武汉","lat":30.5928,"lon":114.3055},{"id":"changsha","name":"长沙","lat":28.2282,"lon":112.9388},{"id":"guangzhou","name":"广州","lat":23.1291,"lon":113.2644},{"id":"nanning","name":"南宁","lat":22.817,"lon":108.3669},{"id":"haikou","name":"海口","lat":20.044,"lon":110.1983},{"id":"chengdu","name":"成都","lat":30.5728,"lon":104.0668},{"id":"guiyang","name":"贵阳","lat":26.647,"lon":106.6302},{"id":"kunming","name":"昆明","lat":25.0389,"lon":102.7183},{"id":"lhasa","name":"拉萨","lat":29.652,"lon":91.1721},{"id":"xian","name":"西安","lat":34.3416,"lon":108.9398},{"id":"lanzhou","name":"兰州","lat":36.0611,"lon":103.8343},{"id":"xining","name":"西宁","lat":36.6171,"lon":101.7782},{"id":"yinchuan","name":"银川","lat":38.4872,"lon":106.2309},{"id":"urumqi","name":"乌鲁木齐","lat":43.8256,"lon":87.6168},{"id":"hong-kong","name":"香港","lat":22.3193,"lon":114.1694},{"id":"macau","name":"澳门","lat":22.1987,"lon":113.5439},{"id":"taipei","name":"台北","lat":25.033,"lon":121.5654},{"id":"shenzhen","name":"深圳","lat":22.5431,"lon":114.0579},{"id":"suzhou","name":"苏州","lat":31.2989,"lon":120.5853},{"id":"ningbo","name":"宁波","lat":29.8683,"lon":121.544},{"id":"qingdao","name":"青岛","lat":36.0671,"lon":120.3826},{"id":"xiamen","name":"厦门","lat":24.4798,"lon":118.0894},{"id":"dalian","name":"大连","lat":38.914,"lon":121.6147},{"id":"wuxi","name":"无锡","lat":31.4912,"lon":120.3119},{"id":"foshan","name":"佛山","lat":23.0218,"lon":113.1219},{"id":"dongguan","name":"东莞","lat":23.0207,"lon":113.7518},{"id":"zhuhai","name":"珠海","lat":22.271,"lon":113.5767},{"id":"wenzhou","name":"温州","lat":27.9949,"lon":120.6994},{"id":"yantai","name":"烟台","lat":37.4638,"lon":121.4479},{"id":"weifang","name":"潍坊","lat":36.7069,"lon":119.1619},{"id":"jinhua","name":"金华","lat":29.0791,"lon":119.6474},{"id":"jiaxing","name":"嘉兴","lat":30.7461,"lon":120.7555},{"id":"nantong","name":"南通","lat":31.9802,"lon":120.8943},{"id":"xuzhou","name":"徐州","lat":34.2044,"lon":117.2858},{"id":"luoyang","name":"洛阳","lat":34.6197,"lon":112.454},{"id":"tangshan","name":"唐山","lat":39.6309,"lon":118.1802},{"id":"baotou","name":"包头","lat":40.6578,"lon":109.8403},{"id":"datong","name":"大同","lat":40.0768,"lon":113.3001},{"id":"qinhuangdao","name":"秦皇岛","lat":39.9354,"lon":119.6005},{"id":"jilin","name":"吉林","lat":43.8378,"lon":126.5496},{"id":"qiqihar","name":"齐齐哈尔","lat":47.3543,"lon":123.9182},{"id":"mudanjiang","name":"牡丹江","lat":44.5517,"lon":129.6329},{"id":"yangzhou","name":"扬州","lat":32.3932,"lon":119.4128},{"id":"zhenjiang","name":"镇江","lat":32.1878,"lon":119.425},{"id":"wuhu","name":"芜湖","lat":31.3526,"lon":118.4331},{"id":"huizhou","name":"惠州","lat":23.1115,"lon":114.4152},{"id":"zhuzhou","name":"株洲","lat":27.8274,"lon":113.134},{"id":"yichang","name":"宜昌","lat":30.6919,"lon":111.2865},{"id":"xiangyang","name":"襄阳","lat":32.009,"lon":112.122},{"id":"sanya","name":"三亚","lat":18.2528,"lon":109.5119},{"id":"mianyang","name":"绵阳","lat":31.4675,"lon":104.6796},{"id":"nanchong","name":"南充","lat":30.8373,"lon":106.1107},{"id":"zunyi","name":"遵义","lat":27.7257,"lon":106.927},{"id":"dali","name":"大理","lat":25.6065,"lon":100.2676},{"id":"kashgar","name":"喀什","lat":39.4677,"lon":75.9938},{"id":"jiuquan","name":"酒泉","lat":39.732,"lon":98.494},{"id":"huangshan","name":"黄山","lat":29.715,"lon":118.338},{"id":"guilin","name":"桂林","lat":25.274,"lon":110.29},{"id":"jingdezhen","name":"景德镇","lat":29.2688,"lon":117.1786}];

const DEG = Math.PI / 180;

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
function nearestCity(latitude, longitude) {
  let selected = null;
  let shortestDistance = Infinity;
  for (const city of CITY_CATALOG) {
    const latitude1 = latitude * DEG;
    const latitude2 = city.lat * DEG;
    const deltaLatitude = (city.lat - latitude) * DEG;
    const deltaLongitude = (city.lon - longitude) * DEG;
    const haversine = Math.sin(deltaLatitude / 2) ** 2
      + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
    const distance = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    if (distance < shortestDistance) {
      selected = city;
      shortestDistance = distance;
    }
  }
  return selected;
}

const location = await getCurrentLocation();
const CITY = location ? nearestCity(location.latitude, location.longitude) : null;

if (!CITY) {
  $render(
    <vstack frame="max" background="#030817" alignment="center" spacing="6" padding="16">
      <icon systemName="location.slash" size="24" color="#f5d68c" />
      <text font="headline" color="#f5f0df">需要当前位置</text>
      <text font="caption" color="#9ba9bf">请在 ScriptWidget 主 App 中授权定位，然后刷新小组件。</text>
    </vstack>
  );
} else {
  const family = typeof $getenv === "function"
    ? String($getenv("widget-size") || "systemLarge").toLowerCase()
    : "systemLarge";
  const baseDialSize = family.includes("small")
    ? 148
    : family.includes("medium")
      ? 142
      : 332;
  const dialSize = baseDialSize;
  // Match the official sample's hand lengths while keeping the detailed dial's hands fine.
  const hourLength = Math.round(dialSize * (28 / 112));
  const minuteLength = Math.round(dialSize * (38 / 112));
  const secondLength = Math.round(dialSize * (46 / 112));
  const hourWidth = Math.max(0.8, dialSize * 0.0050).toFixed(2);
  const minuteWidth = Math.max(0.65, dialSize * 0.0037).toFixed(2);
  const secondWidth = Math.max(0.5, dialSize * 0.0024).toFixed(2);
  const imageKind = PACKAGE_KIND === "visible-sky" ? "visible-sky" : "active-planisphere";
  // Give the scheduled screenshot job a few minutes to publish before the URL cache key changes.
  const refreshVersion = Math.floor((Date.now() - 5 * 60 * 1000) / 900000);
  const imageURL = "https://raw.githubusercontent.com/lzq1206/CosmosWhisper/widget-snapshots/"
    + imageKind + "/" + CITY.id + ".jpg?v=" + refreshVersion;

  const imageMode = family.includes("medium") ? "fit" : "fill";
  $render(
    <zstack frame="max" alignment="center" background="#030817">
      <image
        url={imageURL}
        frame="max"
        mode={imageMode}
        clip="rect"
        accentedRenderingMode="fullColor"
      />
      <zstack frame={dialSize + "," + dialSize} alignment="center">
        <vstack animation="clockSecond">
          <rect frame={secondWidth + "," + secondLength} color="#ff4b50" corner={secondWidth} />
          <rect frame={secondWidth + "," + secondLength} color="clear" />
        </vstack>
        <vstack animation="clockMinute">
          <rect frame={minuteWidth + "," + minuteLength} color="#fff4dd" corner={minuteWidth} />
          <rect frame={minuteWidth + "," + minuteLength} color="clear" />
        </vstack>
        <vstack animation="clockHour">
          <rect frame={hourWidth + "," + hourLength} color="#f4e8c6" corner={hourWidth} />
          <rect frame={hourWidth + "," + hourLength} color="clear" />
        </vstack>
        <circle frame={Math.max(3.5, dialSize * 0.018) + "," + Math.max(3.5, dialSize * 0.018)} color="#f5d68c" />
        <vstack frame="max" alignment="center" spacing="0">
          <spacer />
          <date date="now" style="time" font="caption2" color="#f5d68c" opacity="0.8" padding="0,0,12,0" />
        </vstack>
      </zstack>
    </zstack>
  );
}

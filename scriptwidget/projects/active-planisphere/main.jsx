/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page at quarter-hour times.
 * City screenshot with contained bounds, displayed without clock hands.
 */
const PACKAGE_KIND = "active-planisphere";
const CITY_CATALOG = [{"id":"beijing","name":"北京","lat":39.9042,"lon":116.4074},{"id":"shanghai","name":"上海","lat":31.2304,"lon":121.4737},{"id":"tianjin","name":"天津","lat":39.0842,"lon":117.201},{"id":"chongqing","name":"重庆","lat":29.563,"lon":106.5516},{"id":"shijiazhuang","name":"石家庄","lat":38.0428,"lon":114.5149},{"id":"taiyuan","name":"太原","lat":37.8706,"lon":112.5489},{"id":"hohhot","name":"呼和浩特","lat":40.8424,"lon":111.7492},{"id":"shenyang","name":"沈阳","lat":41.8057,"lon":123.4315},{"id":"changchun","name":"长春","lat":43.8171,"lon":125.3235},{"id":"harbin","name":"哈尔滨","lat":45.8038,"lon":126.535},{"id":"nanjing","name":"南京","lat":32.0603,"lon":118.7969},{"id":"hangzhou","name":"杭州","lat":30.2741,"lon":120.1551},{"id":"hefei","name":"合肥","lat":31.8206,"lon":117.2272},{"id":"fuzhou","name":"福州","lat":26.0745,"lon":119.2965},{"id":"nanchang","name":"南昌","lat":28.682,"lon":115.8579},{"id":"jinan","name":"济南","lat":36.6512,"lon":117.1201},{"id":"zhengzhou","name":"郑州","lat":34.7466,"lon":113.6254},{"id":"wuhan","name":"武汉","lat":30.5928,"lon":114.3055},{"id":"changsha","name":"长沙","lat":28.2282,"lon":112.9388},{"id":"guangzhou","name":"广州","lat":23.1291,"lon":113.2644},{"id":"nanning","name":"南宁","lat":22.817,"lon":108.3669},{"id":"haikou","name":"海口","lat":20.044,"lon":110.1983},{"id":"chengdu","name":"成都","lat":30.5728,"lon":104.0668},{"id":"guiyang","name":"贵阳","lat":26.647,"lon":106.6302},{"id":"kunming","name":"昆明","lat":25.0389,"lon":102.7183},{"id":"lhasa","name":"拉萨","lat":29.652,"lon":91.1721},{"id":"xian","name":"西安","lat":34.3416,"lon":108.9398},{"id":"lanzhou","name":"兰州","lat":36.0611,"lon":103.8343},{"id":"xining","name":"西宁","lat":36.6171,"lon":101.7782},{"id":"yinchuan","name":"银川","lat":38.4872,"lon":106.2309},{"id":"urumqi","name":"乌鲁木齐","lat":43.8256,"lon":87.6168},{"id":"taipei","name":"台北","lat":25.033,"lon":121.5654}];

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
  const imageKind = PACKAGE_KIND === "visible-sky" ? "visible-sky" : "active-planisphere";
  const isLargeFamily = family.includes("large");
  const isSmallFamily = family.includes("small");
  const slotMilliseconds = 15 * 60 * 1000;
  const nearestSnapshot = Math.round(Date.now() / slotMilliseconds) * slotMilliseconds;
  const snapshotKey = new Date(nearestSnapshot).toISOString().slice(0, 16).replace(/[-:]/g, "") + "Z";
  const imageURL = "https://raw.githubusercontent.com/lzq1206/CosmosWhisper/widget-snapshots/"
    + imageKind + "/" + CITY.id + "/" + snapshotKey + ".jpg?v=" + snapshotKey;
  // Every image includes the large-family background extension. Square widgets
  // crop only that extra background; large widgets show the complete dial.
  const imageMode = isSmallFamily || isLargeFamily ? "fill" : "fit";
  $render(
    <zstack frame="max" alignment="center" background="#030817">
      <image
        url={imageURL}
        frame="max"
        mode={imageMode}
        clip="rect"
        accentedRenderingMode="fullColor"
      />
    </zstack>
  );
}

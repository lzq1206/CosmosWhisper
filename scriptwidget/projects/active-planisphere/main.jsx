/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page at quarter-hour times.
 * City screenshot with contained bounds, displayed without clock hands.
 */
const PACKAGE_KIND = "active-planisphere";
const CITY_CATALOG = [{"id":"beijing","name":"北京","lat":39.9042,"lon":116.4074},{"id":"shanghai","name":"上海","lat":31.2304,"lon":121.4737},{"id":"shenyang","name":"沈阳","lat":41.8057,"lon":123.4315},{"id":"fuzhou","name":"福州","lat":26.0745,"lon":119.2965},{"id":"wuhan","name":"武汉","lat":30.5928,"lon":114.3055},{"id":"guangzhou","name":"广州","lat":23.1291,"lon":113.2644},{"id":"chengdu","name":"成都","lat":30.5728,"lon":104.0668},{"id":"kunming","name":"昆明","lat":25.0389,"lon":102.7183},{"id":"lhasa","name":"拉萨","lat":29.652,"lon":91.1721},{"id":"xian","name":"西安","lat":34.3416,"lon":108.9398},{"id":"urumqi","name":"乌鲁木齐","lat":43.8256,"lon":87.6168},{"id":"taipei","name":"台北","lat":25.033,"lon":121.5654}];

const DEG = Math.PI / 180;

async function fetchSnapshotBase64(url) {
  try {
    const image = await fetch(url, { responseType: "base64", timeoutInterval: 3 });
    // The JPEG signature prevents an HTTP error page from being mistaken for
    // a successful image response by ScriptWidget's text-based fetch API.
    return typeof image === "string" && image.startsWith("/9j/") ? image : null;
  } catch (error) {
    return null;
  }
}

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
  const snapshotPath = imageKind + "/" + CITY.id + "/" + snapshotKey + ".jpg?v=" + snapshotKey;
  const pagesURL = "https://lzq1206.github.io/CosmosWhisper/widget-snapshots/" + snapshotPath;
  const customDomainURL = "https://cosmos.rainywhisper.com/widget-snapshots/" + snapshotPath;
  const imageBase64 = (await fetchSnapshotBase64(pagesURL))
    || (await fetchSnapshotBase64(customDomainURL));
  // Every image includes the large-family background extension. Square widgets
  // crop only that extra background; large widgets show the complete dial.
  const imageMode = isSmallFamily || isLargeFamily ? "fill" : "fit";
  if (imageBase64) {
    $render(
      <zstack frame="max" alignment="center" background="#030817">
        <image
          url={"data:image/jpeg;base64," + imageBase64}
          frame="max"
          mode={imageMode}
          clip="rect"
          accentedRenderingMode="fullColor"
        />
      </zstack>
    );
  } else {
    $render(
      <vstack frame="max" background="#030817" alignment="center" spacing="6" padding="16">
        <icon systemName="wifi.slash" size="24" color="#f5d68c" />
        <text font="caption" color="#9ba9bf">星图暂不可用，请稍后刷新</text>
      </vstack>
    );
  }
}

/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page every 15 minutes.
 * City screenshot with contained bounds and ScriptWidget's native clock hands.
 */
const PACKAGE_KIND = "__PACKAGE_KIND__";
const CITY_CATALOG = __CITY_CATALOG__;

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

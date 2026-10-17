/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page every 15 minutes.
 * Native WidgetKit clock-hand effects rotate three centered, full-dial layers.
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

function buildClockHand(dialSize, lengthRatio, widthRatio, color, animation) {
  const handLength = Math.round(dialSize * lengthRatio);
  const topGap = Math.round(dialSize / 2 - handLength);
  const bottomGap = dialSize - topGap - handLength;
  const width = Math.max(0.7, dialSize * widthRatio).toFixed(2);

  return (
    <vstack
      frame={dialSize + "," + dialSize}
      alignment="center"
      spacing="0"
      animation={animation}
    >
      <capsule frame={width + "," + topGap} color="clear" />
      <capsule frame={width + "," + handLength} color={color} />
      <capsule frame={width + "," + bottomGap} color="clear" />
    </vstack>
  );
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
  const dialSize = family.includes("small") ? 148 : family.includes("medium") ? 142 : 332;
  const imageKind = PACKAGE_KIND === "visible-sky" ? "visible-sky" : "active-planisphere";
  // Give the scheduled screenshot job a few minutes to publish before the URL cache key changes.
  const refreshVersion = Math.floor((Date.now() - 5 * 60 * 1000) / 900000);
  const imageURL = "https://raw.githubusercontent.com/lzq1206/CosmosWhisper/widget-snapshots/"
    + imageKind + "/" + CITY.id + ".jpg?v=" + refreshVersion;

  $render(
    <zstack frame="max" alignment="center" background="#030817">
      <image
        url={imageURL}
        frame={dialSize + "," + dialSize}
        mode="fit"
        accentedRenderingMode="fullColor"
      />
      {buildClockHand(dialSize, 0.14, 0.0042, "#f4e8c6", "clockHour")}
      {buildClockHand(dialSize, 0.22, 0.0030, "#fff4dd", "clockMinute")}
      {buildClockHand(dialSize, 0.30, 0.0019, "#ff4b50", "clockSecond")}
      <circle frame={Math.max(3.5, dialSize * 0.018) + "," + Math.max(3.5, dialSize * 0.018)} color="#f5d68c" />
    </zstack>
  );
}

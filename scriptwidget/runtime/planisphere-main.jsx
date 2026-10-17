/**
 * CosmosWhisper ScriptWidget packages.
 * The dial image is captured from the matching city page every 15 minutes.
 * City screenshot with contained bounds, displayed without clock hands.
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
  const imageKind = PACKAGE_KIND === "visible-sky" ? "visible-sky" : "active-planisphere";
  const isLargeFamily = family.includes("large");
  const isSmallFamily = family.includes("small");
  const imageDirectory = isLargeFamily ? imageKind + "-large" : imageKind;
  // Give the scheduled screenshot job a few minutes to publish before the URL cache key changes.
  const refreshVersion = Math.floor((Date.now() - 5 * 60 * 1000) / 900000);
  const imageURL = "https://raw.githubusercontent.com/lzq1206/CosmosWhisper/widget-snapshots/"
    + imageDirectory + "/" + CITY.id + ".jpg?v=" + refreshVersion;
  let imageSource = imageURL;
  if (imageKind === "visible-sky" && isLargeFamily && typeof $fetch === "function") {
    try {
      const imageData = await $fetch(imageURL, { timeoutInterval: 10, responseType: "base64" });
      if (typeof imageData === "string" && imageData.length > 0) {
        imageSource = "data:image/jpeg;base64," + imageData;
      }
    } catch (error) {}
  }

  // The tall large-family asset fills the widget while preserving the round dial.
  const imageMode = isSmallFamily || isLargeFamily ? "fill" : "fit";
  $render(
    <zstack frame="max" alignment="center" background="#030817">
      <image
        url={imageSource}
        frame="max"
        mode={imageMode}
        clip="rect"
        accentedRenderingMode="fullColor"
      />
    </zstack>
  );
}

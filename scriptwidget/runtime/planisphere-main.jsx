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
const PACKAGE_KIND = "__PACKAGE_KIND__";
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

// ==================== 3. 亮星与导航星表 (J2000) ====================
const STARS = [
  { ra: 2.5303, dec: 89.2641, mag: 1.98, tone: "warm", name: "北极星", con: "小熊座" },
  { ra: 14.8451, dec: 74.1555, mag: 2.08, tone: "warm", name: "帝", con: "小熊座" },
  { ra: 11.0621, dec: 61.7510, mag: 1.79, tone: "warm", name: "天枢", con: "大熊座" },
  { ra: 11.0307, dec: 56.3824, mag: 2.37, tone: "neutral", name: "天璇", con: "大熊座" },
  { ra: 11.8972, dec: 53.6948, mag: 2.44, tone: "neutral", name: "天玑", con: "大熊座" },
  { ra: 12.2570, dec: 57.0326, mag: 3.31, tone: "neutral", name: "天权", con: "大熊座" },
  { ra: 12.9005, dec: 55.9598, mag: 1.77, tone: "neutral", name: "玉衡", con: "大熊座" },
  { ra: 13.3988, dec: 54.9254, mag: 2.27, tone: "neutral", name: "开阳", con: "大熊座" },
  { ra: 13.7923, dec: 49.3133, mag: 1.86, tone: "blue", name: "摇光", con: "大熊座" },
  { ra: 0.1529, dec: 59.1498, mag: 2.27, tone: "warm", name: "王良四", con: "仙后座" },
  { ra: 0.6751, dec: 56.5373, mag: 2.23, tone: "warm", name: "王良一", con: "仙后座" },
  { ra: 0.9451, dec: 60.7167, mag: 2.47, tone: "blue", name: "策", con: "仙后座" },
  { ra: 1.4303, dec: 60.2353, mag: 2.68, tone: "neutral", name: "阁道三", con: "仙后座" },
  { ra: 18.6156, dec: 38.7837, mag: 0.03, tone: "blue", name: "织女一", con: "天琴座" },
  { ra: 19.8464, dec: 8.8683, mag: 0.77, tone: "neutral", name: "河鼓二", con: "天鹰座" },
  { ra: 20.6905, dec: 45.2803, mag: 1.25, tone: "neutral", name: "天津四", con: "天鹅座" },
  { ra: 20.3705, dec: 40.2567, mag: 2.20, tone: "warm", name: "天津一", con: "天鹅座" },
  { ra: 14.2610, dec: 19.1824, mag: -0.05, tone: "warm", name: "大角", con: "牧夫座" },
  { ra: 15.5781, dec: 26.7147, mag: 2.23, tone: "blue", name: "贯索四", con: "北冕座" },
  { ra: 13.4199, dec: -11.1613, mag: 0.98, tone: "blue", name: "角宿一", con: "室女座" },
  { ra: 10.1395, dec: 11.9672, mag: 1.35, tone: "blue", name: "轩辕十四", con: "狮子座" },
  { ra: 11.8177, dec: 14.5721, mag: 2.14, tone: "neutral", name: "五帝座一", con: "狮子座" },
  { ra: 16.4901, dec: -26.4320, mag: 0.96, tone: "warm", name: "心宿二", con: "天蝎座" },
  { ra: 17.5601, dec: -37.1038, mag: 1.63, tone: "blue", name: "尾宿八", con: "天蝎座" },
  { ra: 18.4029, dec: -34.3846, mag: 1.85, tone: "blue", name: "箕宿三", con: "人马座" },
  { ra: 18.9211, dec: -26.2967, mag: 2.02, tone: "blue", name: "斗宿四", con: "人马座" },
  { ra: 22.9597, dec: -29.6222, mag: 1.16, tone: "neutral", name: "北落师门", con: "南鱼座" },
  { ra: 23.0793, dec: 15.2053, mag: 2.49, tone: "blue", name: "室宿一", con: "飞马座" },
  { ra: 0.1398, dec: 29.0904, mag: 2.06, tone: "blue", name: "壁宿二", con: "仙女座" },
  { ra: 1.1622, dec: 35.6206, mag: 2.06, tone: "warm", name: "奎宿九", con: "仙女座" },
  { ra: 2.0650, dec: 42.3297, mag: 2.10, tone: "warm", name: "天大将军一", con: "仙女座" },
  { ra: 3.4054, dec: 49.8612, mag: 1.79, tone: "warm", name: "天船三", con: "英仙座" },
  { ra: 2.1196, dec: 23.4624, mag: 2.00, tone: "warm", name: "娄宿三", con: "白羊座" },
  { ra: 5.9195, dec: 7.4071, mag: 0.42, tone: "warm", name: "参宿四", con: "猎户座" },
  { ra: 5.2423, dec: -8.2016, mag: 0.13, tone: "blue", name: "参宿七", con: "猎户座" },
  { ra: 5.4189, dec: 6.3497, mag: 1.64, tone: "blue", name: "参宿五", con: "猎户座" },
  { ra: 5.6036, dec: -1.2019, mag: 1.69, tone: "blue", name: "参宿二", con: "猎户座" },
  { ra: 4.5987, dec: 16.5093, mag: 0.85, tone: "warm", name: "毕宿五", con: "金牛座" },
  { ra: 5.4382, dec: 28.6075, mag: 1.65, tone: "blue", name: "五车五", con: "金牛座" },
  { ra: 5.2782, dec: 45.9980, mag: 0.08, tone: "warm", name: "五车二", con: "御夫座" },
  { ra: 5.9921, dec: 44.9474, mag: 1.90, tone: "neutral", name: "五车三", con: "御夫座" },
  { ra: 7.5767, dec: 31.8883, mag: 1.58, tone: "neutral", name: "北河二", con: "双子座" },
  { ra: 7.7553, dec: 28.0262, mag: 1.14, tone: "warm", name: "北河三", con: "双子座" },
  { ra: 6.7525, dec: -16.7161, mag: -1.46, tone: "blue", name: "天狼", con: "大犬座" },
  { ra: 6.9771, dec: -28.9721, mag: 1.50, tone: "blue", name: "弧矢七", con: "大犬座" },
  { ra: 7.6550, dec: 5.2250, mag: 0.34, tone: "neutral", name: "南河三", con: "小犬座" },
  { ra: 9.4598, dec: -8.6586, mag: 1.98, tone: "warm", name: "星宿一", con: "长蛇座" },
  { ra: 6.3992, dec: -52.6957, mag: -0.74, tone: "neutral", name: "老人", con: "船底座" },
  { ra: 14.6601, dec: -60.8340, mag: -0.27, tone: "warm", name: "南门二", con: "半人马座" },
  { ra: 12.4433, dec: -63.0991, mag: 0.76, tone: "blue", name: "十字架二", con: "南十字座" }
];

// 核心星座名称锚点
const CONSTELLATION_LABELS = [
  { ra: 11.6, dec: 58.0, name: "大熊座" },
  { ra: 1.0, dec: 63.0, name: "仙后座" },
  { ra: 20.2, dec: 38.0, name: "天鹅座" },
  { ra: 18.8, dec: 34.5, name: "天琴座" },
  { ra: 19.5, dec: 4.5, name: "天鹰座" },
  { ra: 22.8, dec: 21.5, name: "飞马座" },
  { ra: 1.1, dec: 38.0, name: "仙女座" },
  { ra: 5.5, dec: 39.0, name: "御夫座" },
  { ra: 4.4, dec: 20.5, name: "金牛座" },
  { ra: 5.6, dec: 2.5, name: "猎户座" },
  { ra: 7.0, dec: 23.5, name: "双子座" },
  { ra: 6.8, dec: -23.0, name: "大犬座" },
  { ra: 10.7, dec: 17.5, name: "狮子座" },
  { ra: 13.0, dec: -3.0, name: "室女座" },
  { ra: 14.6, dec: 30.0, name: "牧夫座" },
  { ra: 16.9, dec: -32.0, name: "天蝎座" },
  { ra: 18.8, dec: -28.0, name: "人马座" }
];

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
    <vstack frame={`${D},${D}`} alignment="leading">
      <spacer frame={`1,${top}`} />
      <hstack frame={`${D},${h}`} alignment="center">
        <spacer frame={`${left},1`} />
        <zstack frame={`${w},${h}`} alignment="center">{child}</zstack>
        <spacer />
      </hstack>
      <spacer />
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
    <line axis="horizontal" length={length} thickness={width} color={color} opacity={opacity} rotation={angle} />));
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
    <text font={`system,${fontSize}`} fontWeight={weight} color={color} opacity={opacity} rotation={rotation}>{text}</text>);
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
  const segmentLength = circumference / count * 1.06;
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + ((index + 0.5) / count) * TAU;
    const point = polarPoint(angle, trackRadius);
    const color = TIME_COLORS[timeRing.states[index]] || TIME_COLORS.night;
    nodes.push(placeAt(D, point.x, point.y, segmentLength + 1, trackWidth + 1,
      <line axis="horizontal" length={segmentLength} thickness={trackWidth} color={color} rotation={(angle + Math.PI / 2) * RAD} />));
  }

  for (let index = 0; index < 96; index += 1) {
    const angle = -Math.PI / 2 + (index / 96) * TAU;
    const major = index % 8 === 0;
    const medium = index % 4 === 0;
    const length = (major ? 8 : medium ? 5 : 3) * scale;
    const pointA = polarPoint(angle, trackOuter - length);
    const pointB = polarPoint(angle, trackOuter);
    addLine(nodes, D, pointA.x, pointA.y, pointB.x, pointB.y,
      Math.max(0.45, (major ? 1 : 0.7) * scale), major ? "#f0eee5" : "#8993ab", major ? 0.78 : 0.58);
  }

  const clockLabels = [["0h", 0], ["6h", 0.25], ["12h", 0.5], ["18h", 0.75]];
  const clockFont = Math.max(4.6, 8 * scale);
  for (const [label, fraction] of clockLabels) {
    const angle = -Math.PI / 2 + fraction * TAU;
    let rotation = angle + Math.PI / 2;
    if (Math.cos(rotation) < 0) rotation += Math.PI;
    const point = polarPoint(angle, trackRadius);
    nodes.push(placeText(D, point.x, point.y, 15 * scale + 4, 8 * scale + 3, label, clockFont, "#f6e3bb", 0.98, rotation * RAD, "medium"));
  }

  for (const transition of timeRing.transitions) {
    const angle = -Math.PI / 2 + transition.fraction * TAU;
    const point = polarPoint(angle, trackOuter + 3 * scale);
    nodes.push(placeText(D, point.x, point.y, 18 * scale + 3, 8 * scale + 2, transition.label,
      Math.max(4.3, 7 * scale), "#f5f0df", 0.9, 0, "semibold"));
  }

  const markerAngle = -Math.PI / 2 + timeRing.localFraction * TAU;
  const marker = polarPoint(markerAngle, trackRadius);
  const sunRadius = Math.max(1.1, 2.5 * scale);
  addDot(nodes, D, marker.x, marker.y, sunRadius * 2, "#ff292f", 1);
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = markerAngle + ray * TAU / 8;
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
    addLine(nodes, D, start.x, start.y, end.x, end.y,
      Math.max(0.42, 0.65 * scale), "#dab670", 0.52);

    if (index === currentIndex) {
      // Draw a short bright chord through the active term segment.
      let a = startAngle;
      let b = endAngle;
      while (b - a > Math.PI) b -= TAU;
      while (b - a < -Math.PI) b += TAU;
      for (let part = 0; part < 5; part += 1) {
        const p1 = polarPoint(a + (b - a) * part / 5, bandMid);
        const p2 = polarPoint(a + (b - a) * (part + 1) / 5, bandMid);
        addLine(nodes, D, p1.x, p1.y, p2.x, p2.y,
          Math.max(1.2, (bandWidth - scale) * 0.75), "#f5d68c", 0.34);
      }
    }

    let textRotation = middleAngle + Math.PI / 2;
    if (Math.sin(middleAngle) > 0) textRotation += Math.PI;
    const labelPoint = polarPoint(middleAngle, bandMid);
    const fontSize = Math.max(4.6, 11 * scale);
    nodes.push(placeText(D, labelPoint.x, labelPoint.y, 17 * scale + 3, 9 * scale + 2,
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
  const borderWidth = Math.max(0.55, 1.35 * scale);
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

  // Layered circles approximate the website's blue radial sky gradient.
  skyNodes.push(<circle frame={`${2 * innerRadius},${2 * innerRadius}`} color="#030817" />);
  skyNodes.push(<circle frame={`${1.72 * innerRadius},${1.72 * innerRadius}`} color="#091736" opacity="0.92" />);
  skyNodes.push(<circle frame={`${1.15 * innerRadius},${1.15 * innerRadius}`} color="#0e2045" opacity="0.62" />);

  // Subtle deterministic dust grain from the website renderer.
  const dustCount = D < 190 ? 92 : 170;
  for (let index = 0; index < dustCount; index += 1) {
    const angle = ((index * 137.508) % 360) * DEG;
    const distance = Math.sqrt(((index * 47) % 997) / 997) * innerRadius * 0.98;
    const x = Math.sin(angle) * distance;
    const y = -Math.cos(angle) * distance;
    const diameter = Math.max(0.55, (0.7 + ((index * 19) % 11) / 20) * scale * 1.4);
    addDot(skyNodes, D, x, y, diameter, "#aebeee", 0.12 + ((index * 17) % 8) / 100);
  }

  // Home uses the local altitude/azimuth grid. The activity dial uses the
  // web Watch polar projection with its matching curved horizon coordinates.
  const gridStep = D < 190 ? 30 : 15;
  if (activePlanisphere) {
    for (let altitude = 15; altitude < 90; altitude += 15) {
      const path = [];
      for (let azimuth = 0; azimuth <= 360; azimuth += gridStep) {
        const eq = equatorialAtHorizontal(azimuth, altitude, date);
        path.push([eq.ra, eq.dec]);
      }
      addPolyline(gridNodes, D, path, projectDate, Math.max(0.34, 0.62 * scale), "#6a84ac", 0.30, 1, true);
    }
    for (let azimuth = 0; azimuth < 360; azimuth += 15) {
      const path = [];
      const altitudeStep = D < 190 ? 10 : 5;
      for (let altitude = 0; altitude <= 90; altitude += altitudeStep) {
        const eq = equatorialAtHorizontal(azimuth, altitude, date);
        path.push([eq.ra, eq.dec]);
      }
      addPolyline(gridNodes, D, path, projectDate, Math.max(0.34, 0.58 * scale), "#6a84ac", 0.27);
    }
  } else {
    for (let altitude = 15; altitude < 90; altitude += 15) {
      const circleRadius = innerRadius * (1 - altitude / 90);
      const steps = D < 190 ? 28 : 40;
      for (let index = 0; index < steps; index += 1) {
        const first = polarPoint((index / steps) * TAU, circleRadius);
        const second = polarPoint(((index + 1) / steps) * TAU, circleRadius);
        addLine(gridNodes, D, first.x, first.y, second.x, second.y,
          Math.max(0.34, 0.62 * scale), "#6a84ac", 0.30);
      }
    }
    for (let azimuth = 0; azimuth < 360; azimuth += 30) {
      const angle = (-azimuth - 90) * DEG;
      const end = polarPoint(angle, innerRadius);
      addLine(gridNodes, D, 0, 0, end.x, end.y, Math.max(0.34, 0.58 * scale), "#6a84ac", 0.27);
    }
  }

  // Milky Way is a narrow, softly layered band, never a large filled polygon.
  addPolyline(galaxyNodes, D, MILKY_WAY_CENTERLINE, (ra, dec) => projectStar(ra, dec),
    Math.max(1.2, 4.2 * scale), "#d9e8ff", 0.045, D < 190 ? 2 : 1);
  addPolyline(galaxyNodes, D, MILKY_WAY_CENTERLINE, (ra, dec) => projectStar(ra, dec),
    Math.max(0.55, 1.4 * scale), "#eff5ff", 0.10, D < 190 ? 2 : 1);

  // Ecliptic and celestial equator use the web palette and real date precession.
  const equator = [];
  for (let ra = 0; ra <= 24; ra += 0.5) equator.push([ra % 24, 0]);
  addPolyline(skyNodes, D, equator, (ra, dec) => projectStar(ra, dec),
    Math.max(0.48, 0.7 * scale), "#ef6868", 0.86, 1, true);

  const ecliptic = [];
  for (let longitude = 0; longitude <= 360; longitude += 5) {
    const coordinates = eclipticToEquatorial(longitude, 0, meanObliquity(date));
    ecliptic.push([coordinates.ra, coordinates.dec]);
  }
  addPolyline(skyNodes, D, ecliptic, (ra, dec) => projectDate(ra, dec),
    Math.max(0.72, 1.4 * scale), "#f2c36c", 0.86, 1, true);

  const horizonNodes = [];
  if (activePlanisphere) {
    const horizon = [];
    for (let azimuth = 0; azimuth <= 360; azimuth += 3) {
      const eq = equatorialAtHorizontal(azimuth, 0, date);
      horizon.push([eq.ra, eq.dec]);
    }
    addPolyline(horizonNodes, D, horizon, projectDate, Math.max(0.55, 0.9 * scale), "#f5f5f5", 0.88, 1, true);
  }

  // Constellation boundary lines and connecting lines from the repository data.
  for (let conIndex = 0; conIndex < CONSTELLATIONS.length; conIndex += 1) {
    const constellation = CONSTELLATIONS[conIndex];
    const boundaryStep = D < 190 ? 2 : 1;
    for (const boundary of constellation.boundaryParts) {
      addPolyline(boundaryNodes, D, boundary, (ra, dec) => projectStar(ra, dec),
        Math.max(0.34, 0.46 * scale), "#91aacf", 0.30, boundaryStep);
    }
    const lineSkip = D < 190 && conIndex % 2 === 1;
    if (!lineSkip) {
      for (const line of constellation.lines) {
        addPolyline(constellationNodes, D, line, (ra, dec) => projectStar(ra, dec),
          Math.max(0.36, 0.52 * scale), "#7ac7d6", 0.43, D < 190 ? 2 : 1);
      }
    }
  }

  // Real stars; keep more depth on the large family and compact the tiny family.
  const starLimit = D < 190 ? 4.0 : 4.9;
  for (const star of STARS) {
    if (star.magnitude > starLimit) continue;
    const point = projectStar(star.ra, star.dec);
    if (!point) continue;
    const diameter = clamp((2.0 + (3.6 - star.magnitude) * 1.2) * scale, 0.7, 3.8 * scale);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : "#f5f0df";
    const alpha = clamp(1.02 - star.magnitude / 7, 0.42, 1);
    if (star.magnitude <= 1.4) addDot(starNodes, D, point.x, point.y, diameter * 3.2, color, 0.10);
    addDot(starNodes, D, point.x, point.y, diameter, color, alpha);
    if (star.magnitude <= 1.2 && star.name) {
      labelNodes.push(placeText(D, point.x + 6 * scale, point.y - 3 * scale, 24 * scale + 3, 8 * scale + 2,
        star.name, Math.max(4.5, 8 * scale), "#f0eee5", 0.74, 0, "regular"));
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
      bodyNodes.push(placeText(D, point.x + labelDx, point.y - 5 * scale, 24 * scale + 3, 8 * scale + 2,
        body.name, Math.max(4.4, 7.5 * scale), body.color, 0.90, 0, "medium"));
    }
  }

  // Constellation names remain faint, matching the web Watch linework.
  for (const constellation of CONSTELLATIONS) {
    for (const [ra, dec] of constellation.labels) {
      const point = projectStar(ra, dec);
      if (!point) continue;
      labelNodes.push(placeText(D, point.x, point.y, 26 * scale + 4, 8 * scale + 2,
        constellation.name, Math.max(4.3, 7 * scale), "#7ac7d6", 0.40, 0, "regular"));
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
    labelNodes.push(placeText(D, p.x, p.y, 9 * scale + 3, 9 * scale + 2, String(month + 1),
      Math.max(4.4, 8.5 * scale), "#f5d68c", 0.98, rotation * RAD, "bold"));
  }

  // Eight horizon bearings use azimuth itself: east (90°) is on the left.
  const directionRadius = Math.max(4, innerRadius - 20 * scale);
  const directionFont = Math.max(4.8, 8 * scale);
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
    directionNodes.push(placeText(D, x, y, 18 * scale + 5, 9 * scale + 3, label,
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
        {skyNodes}
        {galaxyNodes}
        {gridNodes}
        {horizonNodes}
        {boundaryNodes}
        {constellationNodes}
        {starNodes}
        {bodyNodes}
        {labelNodes}
        {directionNodes}
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
        <text font="system,8" fontWeight="bold" color="#f5d68c">{solarTerm.name}</text>
        <text font="system,11" fontWeight="bold" color="#f5f0df">{pad2(lstH)}:{pad2(lstM)}</text>
        <text font="system,7" color="#79c8d2">{moon.phaseName}</text>
      </vstack>
    </zstack>
  );
} else if (rawFamily.includes("rectangular")) {
  const visibleNames = visibleBodies.map((body) => body.name).join(" ") || "暂无可见行星";
  $render(
    <vstack frame="max" alignment="leading" spacing="2" padding="8" background="#030817">
      <hstack spacing="4"><text font="system,10" fontWeight="bold" color="#f5d68c">{CITY.name} · {solarTerm.name}</text><spacer /><text font="system,9" color="#79c8d2">LST {lstStr}</text></hstack>
      <text font="system,9" color="#f5f0df">月相：{moon.phaseName} · {Math.round(moon.phaseFraction * 100)}% · {dateStr} {timeStr}</text>
      <text font="system,8" color="#9ba9bf">地平以上：{visibleNames}</text>
    </vstack>
  );
} else if (rawFamily.includes("small")) {
  $render(<zstack frame="max" alignment="center" background="#030817">{buildPlanisphereDial(148, now, bodies, "small")}</zstack>);
} else if (rawFamily.includes("medium")) {
  $render(
    <hstack frame="max" padding="4,6,4,6" background="#030817" spacing="5" alignment="center">
      {buildPlanisphereDial(142, now, bodies, "medium")}
      <vstack frame="max" alignment="leading" spacing="3">
        <text font="system,10" fontWeight="bold" color="#f5d68c">{CITY.name}</text>
        <text font="system,8" color="#79c8d2">恒星时 {lstStr}</text>
        <text font="system,8" color="#f5f0df">{solarTerm.name} · {moon.phaseName}</text>
        <text font="system,7" color="#9ba9bf">{locationText}</text>
      </vstack>
    </hstack>
  );
} else {
  $render(<zstack frame="max" alignment="center" background="#030817">{buildPlanisphereDial(332, now, bodies, "large")}</zstack>);
}

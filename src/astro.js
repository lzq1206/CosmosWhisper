export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const mod = (value, modulus) => ((value % modulus) + modulus) % modulus;

export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function centuriesSinceJ2000(date) {
  return (julianDate(date) - 2451545.0) / 36525;
}

export function gmstHours(jd) {
  const days = jd - 2451545.0;
  return mod(18.697374558 + 24.06570982441908 * days, 24);
}

export function localSiderealHours(date, longitude) {
  return mod(gmstHours(julianDate(date)) + longitude / 15, 24);
}

export function precessEquatorial(raHours, decDeg, date) {
  const T = centuriesSinceJ2000(date);
  const zeta = (2306.2181 * T + 0.30188 * T ** 2 + 0.017998 * T ** 3) / 3600 * DEG;
  const z = (2306.2181 * T + 1.09468 * T ** 2 + 0.018203 * T ** 3) / 3600 * DEG;
  const theta = (2004.3109 * T - 0.42665 * T ** 2 - 0.041833 * T ** 3) / 3600 * DEG;
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  const A = Math.cos(dec) * Math.sin(ra + zeta);
  const B = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
  const C = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);
  const nextRa = mod(Math.atan2(A, B) + z, TAU) * RAD / 15;
  const nextDec = Math.asin(clamp(C, -1, 1)) * RAD;
  return { ra: nextRa, dec: nextDec };
}

export function equatorialOfDateToHorizontal(raHours, decDeg, date, latitude, longitude) {
  const lst = localSiderealHours(date, longitude);
  const hourAngle = (lst - raHours) * 15 * DEG;
  const latitudeRad = latitude * DEG;
  const declinationRad = decDeg * DEG;
  const sinAltitude = Math.sin(latitudeRad) * Math.sin(declinationRad)
    + Math.cos(latitudeRad) * Math.cos(declinationRad) * Math.cos(hourAngle);
  const altitude = Math.asin(clamp(sinAltitude, -1, 1)) * RAD;
  const azimuth = mod(
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitudeRad) - Math.tan(declinationRad) * Math.cos(latitudeRad),
    ) + Math.PI,
    TAU,
  ) * RAD;
  return { altitude, azimuth, ra: raHours, dec: decDeg };
}

export function equatorialToHorizontal(raHours, decDeg, date, latitude, longitude) {
  const apparent = precessEquatorial(raHours, decDeg, date);
  return equatorialOfDateToHorizontal(apparent.ra, apparent.dec, date, latitude, longitude);
}

export function solarEquatorial(date) {
  const T = centuriesSinceJ2000(date);
  const meanLongitude = mod(280.46646 + 36000.76983 * T + 0.0003032 * T ** 2, 360);
  const meanAnomaly = (357.52911 + 35999.05029 * T - 0.0001537 * T ** 2) * DEG;
  const center = (1.914602 - 0.004817 * T - 0.000014 * T ** 2) * Math.sin(meanAnomaly)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * meanAnomaly)
    + 0.000289 * Math.sin(3 * meanAnomaly);
  const trueLongitude = (meanLongitude + center) * DEG;
  const omega = (125.04 - 1934.136 * T) * DEG;
  const apparentLongitude = trueLongitude - 0.00569 * DEG - 0.00478 * Math.sin(omega) * DEG;
  const obliquity = eclipticObliquity(date);
  const x = Math.cos(apparentLongitude);
  const y = Math.cos(obliquity) * Math.sin(apparentLongitude);
  const z = Math.sin(obliquity) * Math.sin(apparentLongitude);
  return {
    ra: mod(Math.atan2(y, x), TAU) * RAD / 15,
    dec: Math.asin(clamp(z, -1, 1)) * RAD,
  };
}

export function solarToHorizontal(date, latitude, longitude) {
  const solar = solarEquatorial(date);
  return equatorialOfDateToHorizontal(solar.ra, solar.dec, date, latitude, longitude);
}

export function solarAltitude(date, latitude, longitude) {
  return solarToHorizontal(date, latitude, longitude).altitude;
}

export function eclipticObliquity(date) {
  return (23.439291 - 0.0130042 * centuriesSinceJ2000(date)) * DEG;
}

export function eclipticToEquatorial(longitudeDeg, date) {
  const longitude = longitudeDeg * DEG;
  const obliquity = eclipticObliquity(date);
  const x = Math.cos(longitude);
  const y = Math.sin(longitude) * Math.cos(obliquity);
  const z = Math.sin(longitude) * Math.sin(obliquity);
  return {
    ra: mod(Math.atan2(y, x), TAU) * RAD / 15,
    dec: Math.asin(clamp(z, -1, 1)) * RAD,
  };
}

export function eclipticToHorizontal(longitudeDeg, date, latitude, longitude) {
  const equatorial = eclipticToEquatorial(longitudeDeg, date);
  return equatorialToHorizontal(equatorial.ra, equatorial.dec, date, latitude, longitude);
}

export function formatHours(hours, includeSeconds = false) {
  const normalized = mod(hours, 24);
  const wholeHours = Math.floor(normalized);
  const minuteFloat = (normalized - wholeHours) * 60;
  const minutes = Math.floor(minuteFloat);
  const seconds = Math.round((minuteFloat - minutes) * 60);
  if (includeSeconds) {
    const safeMinutes = seconds === 60 ? minutes + 1 : minutes;
    const safeHours = safeMinutes === 60 ? (wholeHours + 1) % 24 : wholeHours;
    return `${String(safeHours).padStart(2, "0")}h ${String(safeMinutes % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
  }
  return `${String(wholeHours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatClock(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatTimezone(date) {
  const parts = new Intl.DateTimeFormat("zh-CN", { timeZoneName: "short" }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "本地时区";
}

export function formatLatitude(latitude) {
  return `${latitude < 0 ? "南纬" : "北纬"} ${Math.abs(latitude).toFixed(1)}°`;
}

export function formatLongitude(longitude) {
  return `${longitude < 0 ? "西经" : "东经"} ${Math.abs(longitude).toFixed(1)}°`;
}

export function formatAzimuth(azimuth) {
  const headings = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return headings[Math.round(mod(azimuth, 360) / 45) % headings.length];
}

export function formatAltitude(altitude) {
  return `${altitude >= 0 ? "+" : ""}${altitude.toFixed(1)}°`;
}

export function toDateTimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateFromDateTimeLocalValue(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

const PLANET_ORBITS = {
  Mercury: { N: [48.3313, 3.24587e-5], i: [7.0047, 5e-8], w: [29.1241, 1.01444e-5], a: [0.387098, 0], e: [0.205635, 5.59e-10], M: [168.6562, 4.0923344368] },
  Venus: { N: [76.6799, 2.46590e-5], i: [3.3946, 2.75e-8], w: [54.8910, 1.38374e-5], a: [0.723330, 0], e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
  Earth: { N: [0, 0], i: [0, 0], w: [282.9404, 4.70935e-5], a: [1, 0], e: [0.016709, -1.151e-9], M: [356.0470, 0.9856002585] },
  Mars: { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: [1.523688, 0], e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766] },
  Jupiter: { N: [100.4542, 2.76854e-5], i: [1.3030, -1.557e-7], w: [273.8777, 1.64505e-5], a: [5.20256, 0], e: [0.048498, 4.469e-9], M: [19.8950, 0.0830853001] },
  Saturn: { N: [113.6634, 2.38980e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: [9.55475, 0], e: [0.055546, -9.499e-9], M: [316.9670, 0.0334442282] },
  Uranus: { N: [74.0005, 1.3978e-5], i: [0.7733, 1.9e-8], w: [96.6612, 3.0565e-5], a: [19.18171, -1.55e-8], e: [0.047318, 7.45e-9], M: [142.5905, 0.011725806] },
  Neptune: { N: [131.7806, 3.0173e-5], i: [1.7700, -2.55e-7], w: [272.8461, -6.027e-6], a: [30.05826, 3.313e-8], e: [0.008606, 2.15e-9], M: [260.2471, 0.005995147] },
};

function heliocentricEcliptic(body, date) {
  const d = julianDate(date) - 2451543.5;
  const orbit = PLANET_ORBITS[body];
  const element = (name) => orbit[name][0] + orbit[name][1] * d;
  const N = element("N") * DEG;
  const i = element("i") * DEG;
  const w = element("w") * DEG;
  const a = element("a");
  const e = element("e");
  const M = mod(element("M"), 360) * DEG;
  let E = M;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const longitude = v + w;
  return {
    x: r * (Math.cos(N) * Math.cos(longitude) - Math.sin(N) * Math.sin(longitude) * Math.cos(i)),
    y: r * (Math.sin(N) * Math.cos(longitude) + Math.cos(N) * Math.sin(longitude) * Math.cos(i)),
    z: r * Math.sin(longitude) * Math.sin(i),
  };
}

function eclipticVectorToEquatorial(vector, date) {
  const obliquity = eclipticObliquity(date);
  const y = vector.y * Math.cos(obliquity) - vector.z * Math.sin(obliquity);
  const z = vector.y * Math.sin(obliquity) + vector.z * Math.cos(obliquity);
  return {
    ra: mod(Math.atan2(y, vector.x), TAU) * RAD / 15,
    dec: Math.atan2(z, Math.hypot(vector.x, y)) * RAD,
  };
}

function geocentricPlanetEquatorial(body, date, earth) {
  const heliocentric = heliocentricEcliptic(body, date);
  return eclipticVectorToEquatorial({
    x: heliocentric.x - earth.x,
    y: heliocentric.y - earth.y,
    z: heliocentric.z - earth.z,
  }, date);
}

function moonEquatorial(date) {
  const d = julianDate(date) - 2451543.5;
  const N = (125.1228 - 0.0529538083 * d) * DEG;
  const i = 5.1454 * DEG;
  const w = (318.0634 + 0.1643573223 * d) * DEG;
  const a = 60.2666;
  const e = 0.0549;
  const M = mod(115.3654 + 13.0649929509 * d, 360) * DEG;
  let E = M;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const longitude = v + w;
  return eclipticVectorToEquatorial({
    x: r * (Math.cos(N) * Math.cos(longitude) - Math.sin(N) * Math.sin(longitude) * Math.cos(i)),
    y: r * (Math.sin(N) * Math.cos(longitude) + Math.cos(N) * Math.sin(longitude) * Math.cos(i)),
    z: r * Math.sin(longitude) * Math.sin(i),
  }, date);
}

function angularSeparation(first, second) {
  const firstDec = first.dec * DEG;
  const secondDec = second.dec * DEG;
  const deltaRa = (first.ra - second.ra) * 15 * DEG;
  return Math.acos(clamp(
    Math.sin(firstDec) * Math.sin(secondDec)
      + Math.cos(firstDec) * Math.cos(secondDec) * Math.cos(deltaRa),
    -1,
    1,
  )) * RAD;
}

export const PLANET_DEFINITIONS = [
  { id: "sun", name: "太阳", body: "Sun", color: "#ffe69a", size: 4.5, magnitude: -26.7 },
  { id: "moon", name: "月亮", body: "Moon", color: "#d8e7ff", size: 4, magnitude: -12.7 },
  { id: "mercury", name: "水星", body: "Mercury", color: "#c4b9a7", size: 2.2, magnitude: -0.5 },
  { id: "venus", name: "金星", body: "Venus", color: "#f5d39b", size: 3, magnitude: -4.2 },
  { id: "mars", name: "火星", body: "Mars", color: "#df8870", size: 2.5, magnitude: 1 },
  { id: "jupiter", name: "木星", body: "Jupiter", color: "#e8c397", size: 3.5, magnitude: -2.2 },
  { id: "saturn", name: "土星", body: "Saturn", color: "#ecd6a6", size: 3, magnitude: 0.7 },
  { id: "uranus", name: "天王星", body: "Uranus", color: "#9ddce2", size: 2, magnitude: 5.7 },
  { id: "neptune", name: "海王星", body: "Neptune", color: "#79a4e7", size: 2, magnitude: 7.8 },
];

export function planetaryBodies(date, latitude, longitude) {
  const sunVector = heliocentricEcliptic("Earth", date);
  const earth = { x: -sunVector.x, y: -sunVector.y, z: -sunVector.z };
  const sunEquatorial = eclipticVectorToEquatorial(sunVector, date);
  const moonEquatorialPosition = moonEquatorial(date);
  const illumination = (1 - Math.cos(angularSeparation(sunEquatorial, moonEquatorialPosition) * DEG)) / 2;
  return PLANET_DEFINITIONS.map((definition) => {
    const equatorial = definition.body === "Sun"
      ? sunEquatorial
      : definition.body === "Moon"
        ? moonEquatorialPosition
        : geocentricPlanetEquatorial(definition.body, date, earth);
    return {
      ...definition,
      ...equatorial,
      illumination: definition.body === "Moon" ? illumination : 1,
      horizontal: equatorialOfDateToHorizontal(equatorial.ra, equatorial.dec, date, latitude, longitude),
    };
  });
}

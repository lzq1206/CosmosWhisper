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

export function equatorialToHorizontal(raHours, decDeg, date, latitude, longitude) {
  const apparent = precessEquatorial(raHours, decDeg, date);
  const lst = localSiderealHours(date, longitude);
  const hourAngle = (lst - apparent.ra) * 15 * DEG;
  const latitudeRad = latitude * DEG;
  const declinationRad = apparent.dec * DEG;
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
  return { altitude, azimuth, ra: apparent.ra, dec: apparent.dec };
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

import { DEG, TAU, centuriesSinceJ2000, clamp, eclipticToEquatorial, equatorialOfDateToHorizontal, equatorialToHorizontal, localSiderealHours, planetaryBodies, solarAltitude, solarEquatorial } from "../../src/astro.js";
import { CONSTELLATIONS } from "../../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../../src/data/milkyWay.js";
import { STARS } from "../../src/data/stars.js";
import { CITY_BY_ID } from "../../src/data/cities.js";

const canvas = document.querySelector("#watch-canvas");
const status = document.querySelector("#watch-status");
const cityId = new URLSearchParams(window.location.search).get("city") || "beijing";
const city = CITY_BY_ID.get(cityId) || CITY_BY_ID.get("beijing");
const ctx = canvas.getContext("2d");
const state = { date: new Date(), latitudeSign: city.lat >= 0 ? 1 : -1, timeRing: null };
const WATCH_ROTATION = 90 * DEG;
let metrics = null;
let timeRingCacheKey = "";

const TWILIGHT_BANDS = [
  { id: "standard", low: -0.833, high: 0 },
  { id: "civil", low: -6, high: -0.833 },
  { id: "nautical", low: -12, high: -6 },
  { id: "astronomical", low: -18, high: -12 },
];

const SOLAR_TERMS = [
  { longitude: 0, name: "春分" }, { longitude: 15, name: "清明" },
  { longitude: 30, name: "谷雨" }, { longitude: 45, name: "立夏" },
  { longitude: 60, name: "小满" }, { longitude: 75, name: "芒种" },
  { longitude: 90, name: "夏至" }, { longitude: 105, name: "小暑" },
  { longitude: 120, name: "大暑" }, { longitude: 135, name: "立秋" },
  { longitude: 150, name: "处暑" }, { longitude: 165, name: "白露" },
  { longitude: 180, name: "秋分" }, { longitude: 195, name: "寒露" },
  { longitude: 210, name: "霜降" }, { longitude: 225, name: "立冬" },
  { longitude: 240, name: "小雪" }, { longitude: 255, name: "大雪" },
  { longitude: 270, name: "冬至" }, { longitude: 285, name: "小寒" },
  { longitude: 300, name: "大寒" }, { longitude: 315, name: "立春" },
  { longitude: 330, name: "雨水" }, { longitude: 345, name: "惊蛰" },
];

const COLORS = {
  ink: "#f5f0df",
  muted: "#9ba9bf",
  gold: "#dcb870",
  goldBright: "#f5d68c",
  line: "rgba(122, 199, 214, .41)",
  boundary: "rgba(143, 168, 203, .4)",
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const edge = Math.min(rect.width, rect.height);
  metrics = { width: rect.width, height: rect.height, cx: rect.width / 2, cy: rect.height / 2, radius: Math.max(1, edge / 2 - 30) };
  return true;
}

function declinationLimit() {
  return city.lat >= 0 ? Math.max(-90, city.lat - 90 - 20) : Math.min(90, city.lat + 90 + 20);
}

function localDayBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end, span: end.getTime() - start.getTime() };
}

function skyStateAt(date) {
  const altitude = solarAltitude(date, city.lat, city.lon);
  if (altitude >= 0) return "day";
  const twilight = TWILIGHT_BANDS.find(({ low, high }) => altitude >= low && altitude < high);
  if (twilight) return twilight.id;
  const moon = planetaryBodies(date, city.lat, city.lon).find((body) => body.id === "moon");
  return moon && moon.horizontal.altitude > 0 && moon.illumination >= 0.08 ? "moon" : "night";
}

function calculateTimeRing(date) {
  const { start, end, span } = localDayBounds(date);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const sampleStep = 60 * 1000;
  const segments = [];
  let previousState = null;
  let previousStart = 0;
  for (let time = startMs; time < endMs; time += sampleStep) {
    const nextTime = Math.min(time + sampleStep, endMs);
    const middle = new Date((time + nextTime) / 2);
    const currentState = skyStateAt(middle);
    const currentStart = (time - startMs) / span;
    const currentEnd = (nextTime - startMs) / span;
    if (currentState !== previousState) {
      if (previousState !== null) segments.push({ id: previousState, start: previousStart, end: currentStart });
      previousState = currentState;
      previousStart = currentStart;
    }
    if (nextTime === endMs) segments.push({ id: currentState, start: previousStart, end: currentEnd });
  }
  return { startMs, endMs, span, segments, timeFraction: 0 };
}

function ensureTimeRing() {
  const { start, end } = localDayBounds(state.date);
  const key = `${start.toISOString()}|${end.toISOString()}|${city.lat}|${city.lon}`;
  if (key !== timeRingCacheKey) {
    state.timeRing = calculateTimeRing(state.date);
    timeRingCacheKey = key;
  }
  state.timeRing.timeFraction = Math.min(1, Math.max(0, (state.date.getTime() - state.timeRing.startMs) / state.timeRing.span));
}

function solarLongitude(date) {
  const centuries = centuriesSinceJ2000(date);
  const meanLongitude = 280.46646 + 36000.76983 * centuries + 0.0003032 * centuries ** 2;
  const meanAnomaly = (357.52911 + 35999.05029 * centuries - 0.0001537 * centuries ** 2) * DEG;
  const center = (1.914602 - 0.004817 * centuries - 0.000014 * centuries ** 2) * Math.sin(meanAnomaly)
    + (0.019993 - 0.000101 * centuries) * Math.sin(2 * meanAnomaly)
    + 0.000289 * Math.sin(3 * meanAnomaly);
  return ((meanLongitude + center) % 360 + 360) % 360;
}

function projectHourAngle(hourAngle, normalized) {
  const angle = WATCH_ROTATION - hourAngle;
  return {
    x: metrics.cx + Math.cos(angle) * metrics.radius * normalized,
    y: metrics.cy + Math.sin(angle) * metrics.radius * normalized,
  };
}

function projectEquatorial(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const centerDec = state.latitudeSign * 90;
  const polarDec = state.latitudeSign * horizontal.dec;
  const limit = state.latitudeSign * declinationLimit();
  const normalized = Math.abs(centerDec - polarDec) / Math.abs(centerDec - limit);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - horizontal.ra) * state.latitudeSign * 15 * DEG;
  return projectHourAngle(hourAngle, normalized);
}

function projectOfDate(ra, dec) {
  const horizontal = equatorialOfDateToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const centerDec = state.latitudeSign * 90;
  const polarDec = state.latitudeSign * dec;
  const limit = state.latitudeSign * declinationLimit();
  const normalized = Math.abs(centerDec - polarDec) / Math.abs(centerDec - limit);
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - ra) * state.latitudeSign * 15 * DEG;
  return { ...projectHourAngle(hourAngle, normalized), altitude: horizontal.altitude };
}

function drawPath(points, project, close = false) {
  let started = false;
  for (const [ra, dec] of points) {
    const point = project(ra, dec);
    if (!point) { started = false; continue; }
    if (!started) { ctx.moveTo(point.x, point.y); started = true; } else ctx.lineTo(point.x, point.y);
  }
  if (close && started) ctx.closePath();
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(metrics.cx, metrics.cy, 0, metrics.cx, metrics.cy, metrics.radius);
  gradient.addColorStop(0, "#122f57"); gradient.addColorStop(.68, "#071934"); gradient.addColorStop(1, "#020711");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, TAU); ctx.fill();
}

function drawGrid() {
  ctx.save(); ctx.strokeStyle = "rgba(145,174,210,.28)"; ctx.lineWidth = .65; ctx.setLineDash([2, 7]);
  for (let dec = 0; dec <= 80; dec += 20) {
    const centerDec = state.latitudeSign * 90; const limit = state.latitudeSign * declinationLimit();
    const normalized = Math.abs(centerDec - state.latitudeSign * dec) / Math.abs(centerDec - limit);
    ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius * normalized, 0, TAU); ctx.stroke();
  }
  for (let hour = 0; hour < 24; hour += 2) {
    const points = []; for (let dec = 0; dec >= declinationLimit(); dec -= 2) points.push([hour, state.latitudeSign * dec]);
    ctx.beginPath(); drawPath(points, projectEquatorial); ctx.stroke();
  }
  ctx.restore();
}

function drawAuxiliaryPlanes() {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = .7;
  ctx.strokeStyle = "rgba(239, 104, 104, .9)";
  const equator = [];
  for (let ra = 0; ra <= 24; ra += .25) equator.push([ra, 0]);
  ctx.beginPath(); drawPath(equator, projectEquatorial); ctx.stroke();

  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(242, 195, 108, .86)";
  const ecliptic = [];
  for (let longitude = 0; longitude <= 360; longitude += 2) {
    const coordinates = eclipticToEquatorial(longitude, state.date);
    ecliptic.push([coordinates.ra, coordinates.dec]);
  }
  ctx.beginPath(); drawPath(ecliptic, projectOfDate); ctx.stroke();

  ctx.font = "10px Segoe UI,sans-serif";
  ctx.fillStyle = "rgba(244,238,209,.85)";
  const equatorLabel = projectEquatorial(6, 0);
  if (equatorLabel) ctx.fillText("天赤道", equatorLabel.x + 5, equatorLabel.y - 5);
  ctx.fillStyle = "rgba(242,195,108,.9)";
  const eclipticLabel = projectOfDate(6, 0);
  if (eclipticLabel) ctx.fillText("黄道", eclipticLabel.x + 5, eclipticLabel.y + 12);
  ctx.restore();
}

function drawEclipticNumbers() {
  ctx.save();
  ctx.font = "bold 9px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(5, 16, 35, .96)";
  ctx.fillStyle = "rgba(245, 214, 140, .96)";

  for (let index = 0; index < 12; index += 1) {
    const longitude = index * 30 + 15;
    const beforeCoordinates = eclipticToEquatorial(longitude - 1, state.date);
    const coordinates = eclipticToEquatorial(longitude, state.date);
    const afterCoordinates = eclipticToEquatorial(longitude + 1, state.date);
    const before = projectOfDate(beforeCoordinates.ra, beforeCoordinates.dec);
    const point = projectOfDate(coordinates.ra, coordinates.dec);
    const after = projectOfDate(afterCoordinates.ra, afterCoordinates.dec);
    if (!before || !point || !after) continue;

    let rotation = Math.atan2(after.y - before.y, after.x - before.x);
    if (Math.cos(rotation) < 0) rotation += Math.PI;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(rotation);
    ctx.strokeText(String(index + 1), 0, 0);
    ctx.fillText(String(index + 1), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawGalaxy() {
  ctx.save(); ctx.beginPath();
  for (const ring of MILKY_WAY_RINGS) drawPath(ring, projectEquatorial, true);
  ctx.fillStyle = "rgba(255,255,255,.09)"; ctx.fill("evenodd"); ctx.restore();
}

function drawConstellations() {
  ctx.save();
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) { ctx.setLineDash([]); ctx.beginPath(); drawPath(boundary, projectEquatorial); ctx.strokeStyle = COLORS.boundary; ctx.lineWidth = .4; ctx.stroke(); }
    ctx.setLineDash([]);
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, projectEquatorial); ctx.strokeStyle = COLORS.line; ctx.lineWidth = .5; ctx.stroke(); }
  }
  ctx.restore();
}

function drawStars() {
  for (const star of STARS) {
    const point = projectEquatorial(star.ra, star.dec); if (!point) continue;
    const radius = clamp(1 + (3.6 - star.magnitude) * .56, .85, 4.4);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color; ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, .42, 1); ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (star.magnitude <= 1.2) { ctx.fillStyle = "rgba(240,238,229,.8)"; ctx.font = "9px Segoe UI,sans-serif"; ctx.fillText(star.name, point.x + radius + 3, point.y - radius - 2); }
  }
}

function drawMoonPhase(point, moon, sunPoint) {
  const radius = moon.size * 1.35;
  const illumination = clamp(moon.illumination, 0, 1);
  const sunAngle = sunPoint
    ? Math.atan2(sunPoint.y - point.y, sunPoint.x - point.x)
    : 0;

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = "rgba(8,18,38,.96)";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();

  if (illumination >= .995) {
    ctx.fillStyle = moon.color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
  } else if (illumination > .005) {
    const terminator = (1 - 2 * illumination) / (2 * Math.sqrt(illumination * (1 - illumination)));
    ctx.save();
    ctx.rotate(sunAngle);
    ctx.beginPath();
    for (let step = 0; step <= 32; step += 1) {
      const y = -radius + (2 * radius * step) / 32;
      const halfWidth = Math.sqrt(Math.max(0, radius * radius - y * y));
      const x = clamp(terminator * halfWidth, -halfWidth, halfWidth);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.arc(0, 0, radius, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fillStyle = moon.color;
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(216,231,255,.45)";
  ctx.lineWidth = .7;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawBodies() {
  const bodies = planetaryBodies(state.date, city.lat, city.lon);
  const sun = bodies.find((body) => body.id === "sun");
  const sunPoint = sun ? projectOfDate(sun.ra, sun.dec) : null;
  for (const body of bodies) {
    const point = projectOfDate(body.ra, body.dec); if (!point) continue;
    if (body.id === "moon") drawMoonPhase(point, body, sunPoint);
    else { ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(point.x, point.y, body.size, 0, TAU); ctx.fill(); }
    ctx.fillStyle = body.color; ctx.font = "9px Segoe UI,sans-serif"; ctx.fillText(body.name, point.x + body.size + 3, point.y - body.size - 2);
  }
}

function drawConstellationLabels() {
  ctx.save();
  ctx.fillStyle = COLORS.boundary;
  ctx.font = "4px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const constellation of CONSTELLATIONS) {
    for (const [ra, dec] of constellation.labels) {
      const point = projectEquatorial(ra, dec);
      if (point) {
        ctx.fillText(constellation.name, point.x, point.y);
      }
    }
  }
  ctx.restore();
}

function horizonEquatorialAtAzimuth(azimuthDegrees, lst) {
  const latitude = city.lat * DEG;
  const azimuth = azimuthDegrees * DEG;
  const sinDec = Math.cos(latitude) * Math.cos(azimuth);
  const dec = Math.asin(clamp(sinDec, -1, 1)) / DEG;
  const cosDec = Math.max(.000001, Math.cos(dec * DEG));
  const sinHourAngle = -Math.sin(azimuth) / cosDec;
  const cosHourAngle = -Math.sin(latitude) * Math.cos(azimuth) / cosDec;
  const hourAngle = Math.atan2(sinHourAngle, cosHourAngle) / DEG / 15;
  return [lst - hourAngle, dec];
}

function horizonEquatorialPath() {
  const points = [];
  const lst = localSiderealHours(state.date, city.lon);
  for (let index = 0; index <= 360; index += 1) points.push(horizonEquatorialAtAzimuth(index, lst));
  return points;
}

function drawHorizonBoundary() {
  const horizon = horizonEquatorialPath();
  ctx.save();
  ctx.strokeStyle = "rgba(245,245,245,.88)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); drawPath(horizon, projectOfDate, true); ctx.stroke();
  ctx.restore();
}

function drawCompassDirections() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(3,8,23,.96)";
  ctx.fillStyle = COLORS.goldBright;
  const lst = localSiderealHours(state.date, city.lon);
  const directions = [
    ["北", 0, 12], ["东北", 45, 10], ["东", 90, 12], ["东南", 135, 10],
    ["南", 180, 12], ["西南", 225, 10], ["西", 270, 12], ["西北", 315, 10],
  ];
  for (const [label, azimuth, fontSize] of directions) {
    ctx.font = `bold ${fontSize}px Segoe UI,sans-serif`;
    const [ra, dec] = horizonEquatorialAtAzimuth(azimuth, lst);
    const point = projectOfDate(ra, dec);
    if (!point) continue;
    ctx.strokeText(label, point.x, point.y);
    ctx.fillText(label, point.x, point.y);
  }
  ctx.restore();
}

function drawTimeRing() {
  const { cx, cy, radius } = metrics;
  const time = radius + 22;
  const timeOuter = time + 4;
  const colors = {
    day: "#f4f1df",
    standard: "#f6e2b4",
    civil: "#f2c36c",
    nautical: "#79aeea",
    astronomical: "#d59af4",
    moon: "#9bcdf7",
    night: "#1b335e",
  };
  const labels = {
    standard: "标准",
    civil: "民用",
    nautical: "航海",
    astronomical: "天文",
    moon: "月照",
    night: "无月",
  };

  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineWidth = 8;
  ctx.strokeStyle = colors.night;
  ctx.beginPath();
  ctx.arc(cx, cy, time, 0, TAU);
  ctx.stroke();
  for (const segment of state.timeRing?.segments ?? []) {
    if (segment.end - segment.start < 0.00001) continue;
    const startAngle = -Math.PI / 2 + segment.start * TAU;
    const endAngle = -Math.PI / 2 + segment.end * TAU;
    ctx.strokeStyle = colors[segment.id] ?? colors.night;
    ctx.beginPath();
    ctx.arc(cx, cy, time, startAngle, endAngle);
    ctx.stroke();
    const label = labels[segment.id];
    if (label && segment.end - segment.start > 0.035) {
      const middle = (segment.start + segment.end) / 2;
      const labelAngle = -Math.PI / 2 + middle * TAU;
      const labelRadius = timeOuter + 1;
      const labelX = cx + Math.cos(labelAngle) * labelRadius;
      const labelY = cy + Math.sin(labelAngle) * labelRadius;
      ctx.fillStyle = colors[segment.id] ?? colors.night;
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.textAlign = labelX < cx ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, labelX, labelY);
    }
  }

  for (let index = 0; index < 96; index += 1) {
    const fraction = index / 96;
    const angle = -Math.PI / 2 + fraction * TAU;
    const length = index % 4 === 0 ? 4 : index % 2 === 0 ? 3 : 2;
    const tickWidth = index % 4 === 0 ? 1 : .7;
    const outerTickRadius = timeOuter - tickWidth / 2;
    const inner = outerTickRadius - length;
    ctx.strokeStyle = index % 4 === 0 ? "rgba(240,238,229,.78)" : "rgba(137,147,171,.6)";
    ctx.lineWidth = tickWidth;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outerTickRadius, cy + Math.sin(angle) * outerTickRadius);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(216,196,142,.86)";
  ctx.font = "9px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [label, fraction] of [["0h", 0], ["6h", .25], ["12h", .5], ["18h", .75]]) {
    const angle = -Math.PI / 2 + fraction * TAU;
    const distance = timeOuter - 1;
    ctx.fillText(label, cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance);
  }

  const markerAngle = -Math.PI / 2 + state.timeRing.timeFraction * TAU;
  const markerX = cx + Math.cos(markerAngle) * time;
  const markerY = cy + Math.sin(markerAngle) * time;
  ctx.save();
  ctx.translate(markerX, markerY);
  ctx.rotate(markerAngle);
  ctx.strokeStyle = "#ff625f";
  ctx.fillStyle = "#ff292f";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255, 35, 48, .95)";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, TAU);
  ctx.fill();
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = ray * TAU / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 3.8, Math.sin(angle) * 3.8);
    ctx.lineTo(Math.cos(angle) * 6.4, Math.sin(angle) * 6.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawSolarTermRing() {
  const { cx, cy, radius } = metrics;
  const lst = localSiderealHours(state.date, city.lon);
  const termBandWidth = 16;
  const termMidRadius = radius + termBandWidth / 2 + 1;
  const termOuterRadius = radius + termBandWidth + 1;
  const currentTerm = Math.floor(solarLongitude(state.date) / 15) % SOLAR_TERMS.length;
  const angleForRightAscension = (ra) => WATCH_ROTATION
    - (lst - ra) * state.latitudeSign * 15 * DEG;

  ctx.save();
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(12,28,56,.92)";
  ctx.lineWidth = termBandWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, termMidRadius, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = "rgba(218,182,112,.72)";
  ctx.lineWidth = .6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1.35, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = .6;
  ctx.strokeStyle = "rgba(218,182,112,.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, termOuterRadius - .35, 0, TAU);
  ctx.stroke();

  for (let index = 0; index < SOLAR_TERMS.length; index += 1) {
    const term = SOLAR_TERMS[index];
    const nextTerm = SOLAR_TERMS[(index + 1) % SOLAR_TERMS.length];
    const middleLongitude = (term.longitude + 7.5) % 360;
    const termEquatorial = eclipticToEquatorial(term.longitude, state.date);
    const nextEquatorial = eclipticToEquatorial(nextTerm.longitude, state.date);
    const middleEquatorial = eclipticToEquatorial(middleLongitude, state.date);
    const angle = angleForRightAscension(termEquatorial.ra);
    const nextAngle = angleForRightAscension(nextEquatorial.ra);
    const middleAngle = angleForRightAscension(middleEquatorial.ra);

    if (index === currentTerm) {
      ctx.strokeStyle = "rgba(245,214,140,.36)";
      ctx.lineWidth = termBandWidth - 1;
      ctx.beginPath();
      ctx.arc(cx, cy, termMidRadius, angle, nextAngle, state.latitudeSign < 0);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(218,182,112,.48)";
    ctx.lineWidth = .55;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (radius + 1.3), cy + Math.sin(angle) * (radius + 1.3));
    ctx.lineTo(cx + Math.cos(angle) * (termOuterRadius - .3), cy + Math.sin(angle) * (termOuterRadius - .3));
    ctx.stroke();

    const labelX = cx + Math.cos(middleAngle) * termMidRadius;
    const labelY = cy + Math.sin(middleAngle) * termMidRadius;
    ctx.save();
    ctx.translate(labelX, labelY);
    let rotation = middleAngle + Math.PI / 2;
    if (Math.sin(middleAngle) > 0) rotation += Math.PI;
    ctx.rotate(rotation);
    ctx.fillStyle = index === currentTerm ? COLORS.goldBright : "rgba(210,220,235,.82)";
    ctx.font = "11px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(term.name, 0, 0);
    ctx.restore();
  }

  const sun = solarEquatorial(state.date);
  const sunAngle = angleForRightAscension(sun.ra);
  const radialX = Math.cos(sunAngle);
  const radialY = Math.sin(sunAngle);
  const tangentX = -radialY;
  const tangentY = radialX;
  const tipRadius = radius + 6.2;
  const baseRadius = radius + .2;
  const halfBase = 4.2;
  const tipX = cx + radialX * tipRadius;
  const tipY = cy + radialY * tipRadius;
  const baseLeftX = cx + radialX * baseRadius + tangentX * halfBase;
  const baseLeftY = cy + radialY * baseRadius + tangentY * halfBase;
  const baseRightX = cx + radialX * baseRadius - tangentX * halfBase;
  const baseRightY = cy + radialY * baseRadius - tangentY * halfBase;
  ctx.fillStyle = COLORS.goldBright;
  ctx.strokeStyle = "rgba(5,16,35,.95)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseLeftX, baseLeftY);
  ctx.lineTo(baseRightX, baseRightY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPole() {
  ctx.save(); ctx.fillStyle = COLORS.goldBright; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(245,214,140,.65)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, 13, 0, TAU); ctx.stroke(); ctx.fillStyle = COLORS.ink; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center"; ctx.fillText("北极点", metrics.cx, metrics.cy + 28); ctx.restore();
}

function render() {
  if (!resize()) return;
  ensureTimeRing();
  ctx.clearRect(0, 0, metrics.width, metrics.height);
  drawBackground();
  ctx.save(); ctx.beginPath(); ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, TAU); ctx.clip();
  drawGalaxy(); drawGrid(); drawAuxiliaryPlanes(); drawConstellations(); drawStars(); drawBodies(); drawEclipticNumbers(); drawConstellationLabels();
  ctx.restore();
  drawHorizonBoundary(); drawCompassDirections(); drawTimeRing(); drawSolarTermRing(); drawPole();
  status.textContent = `${city.name} · Planisphere · 北极点旋转中心 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => { state.date = new Date(); render(); }, 1000);
requestAnimationFrame(render);

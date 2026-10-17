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
  line: "rgba(122, 199, 214, .82)",
  boundary: "rgba(7, 25, 52, .16)",
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const edge = Math.min(rect.width, rect.height);
  metrics = { width: rect.width, height: rect.height, cx: rect.width / 2, cy: rect.height / 2, radius: Math.max(1, edge / 2 - 32) };
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
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(244, 238, 209, .68)";
  const equator = [];
  for (let ra = 0; ra <= 24; ra += .25) equator.push([ra, 0]);
  ctx.beginPath(); drawPath(equator, projectEquatorial); ctx.stroke();

  ctx.strokeStyle = "rgba(242, 195, 108, .86)";
  const ecliptic = [];
  for (let longitude = 0; longitude <= 360; longitude += 2) {
    const coordinates = eclipticToEquatorial(longitude, state.date);
    ecliptic.push([coordinates.ra, coordinates.dec]);
  }
  ctx.beginPath(); drawPath(ecliptic, projectOfDate); ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "10px Segoe UI,sans-serif";
  ctx.fillStyle = "rgba(244,238,209,.85)";
  const equatorLabel = projectEquatorial(6, 0);
  if (equatorLabel) ctx.fillText("天赤道", equatorLabel.x + 5, equatorLabel.y - 5);
  ctx.fillStyle = "rgba(242,195,108,.9)";
  const eclipticLabel = projectOfDate(6, 0);
  if (eclipticLabel) ctx.fillText("黄道", eclipticLabel.x + 5, eclipticLabel.y + 12);
  ctx.restore();
}

function drawGalaxy() {
  ctx.save(); ctx.beginPath();
  for (const ring of MILKY_WAY_RINGS) drawPath(ring, projectEquatorial, true);
  ctx.fillStyle = "rgba(255,255,255,.09)"; ctx.fill("evenodd"); ctx.restore();
}

function drawConstellations() {
  ctx.save(); ctx.setLineDash([3, 5]);
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) { ctx.beginPath(); drawPath(boundary, projectEquatorial); ctx.strokeStyle = COLORS.boundary; ctx.lineWidth = .8; ctx.stroke(); }
    for (const line of constellation.lines) { ctx.beginPath(); drawPath(line, projectEquatorial); ctx.strokeStyle = COLORS.line; ctx.lineWidth = 1; ctx.stroke(); }
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

function drawBodies() {
  for (const body of planetaryBodies(state.date, city.lat, city.lon)) {
    const point = projectOfDate(body.ra, body.dec); if (!point) continue;
    ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(point.x, point.y, body.size, 0, TAU); ctx.fill();
    ctx.fillStyle = body.color; ctx.font = "9px Segoe UI,sans-serif"; ctx.fillText(body.name, point.x + body.size + 3, point.y - body.size - 2);
  }
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
  ctx.strokeStyle = "rgba(245,214,140,.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); drawPath(horizon, projectOfDate, true); ctx.stroke();
  ctx.restore();
}

function drawCompassDirections() {
  ctx.save();
  ctx.font = "bold 12px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(3,8,23,.96)";
  ctx.fillStyle = COLORS.goldBright;
  const lst = localSiderealHours(state.date, city.lon);
  for (const [label, azimuth] of [["北", 0], ["东", 90], ["南", 180], ["西", 270]]) {
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
  const time = radius + 16;
  const timeOuter = radius + 24;
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
  ctx.lineWidth = 10;
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
    const length = index % 4 === 0 ? 8 : index % 2 === 0 ? 5 : 3;
    const inner = timeOuter - length;
    ctx.strokeStyle = index % 4 === 0 ? "rgba(240,238,229,.78)" : "rgba(137,147,171,.6)";
    ctx.lineWidth = index % 4 === 0 ? 1 : .7;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * timeOuter, cy + Math.sin(angle) * timeOuter);
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
  ctx.strokeStyle = "#f2c36c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(markerAngle) * (time - 6), cy + Math.sin(markerAngle) * (time - 6));
  ctx.lineTo(cx + Math.cos(markerAngle) * (timeOuter + 7), cy + Math.sin(markerAngle) * (timeOuter + 7));
  ctx.stroke();
  ctx.restore();
}

function drawSolarTermRing() {
  const { cx, cy, radius } = metrics;
  const lst = localSiderealHours(state.date, city.lon);
  const termBandWidth = 8;
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
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(218,182,112,.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, termOuterRadius, 0, TAU);
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
    ctx.lineWidth = .75;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (radius + 1), cy + Math.sin(angle) * (radius + 1));
    ctx.lineTo(cx + Math.cos(angle) * termOuterRadius, cy + Math.sin(angle) * termOuterRadius);
    ctx.stroke();

    const labelX = cx + Math.cos(middleAngle) * termMidRadius;
    const labelY = cy + Math.sin(middleAngle) * termMidRadius;
    ctx.save();
    ctx.translate(labelX, labelY);
    let rotation = middleAngle + Math.PI / 2;
    if (Math.sin(middleAngle) > 0) rotation += Math.PI;
    ctx.rotate(rotation);
    ctx.fillStyle = index === currentTerm ? COLORS.goldBright : "rgba(210,220,235,.82)";
    ctx.font = "8px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(term.name, 0, 0);
    ctx.restore();
  }

  const sun = solarEquatorial(state.date);
  const sunAngle = angleForRightAscension(sun.ra);
  const needleTipRadius = termOuterRadius + 2;
  const tipX = cx + Math.cos(sunAngle) * needleTipRadius;
  const tipY = cy + Math.sin(sunAngle) * needleTipRadius;
  ctx.strokeStyle = COLORS.goldBright;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(sunAngle) * (radius + 1), cy + Math.sin(sunAngle) * (radius + 1));
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = COLORS.goldBright;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 2, 0, TAU);
  ctx.fill();
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
  drawGalaxy(); drawGrid(); drawAuxiliaryPlanes(); drawConstellations(); drawStars(); drawBodies();
  ctx.restore();
  drawHorizonBoundary(); drawCompassDirections(); drawTimeRing(); drawSolarTermRing(); drawPole();
  status.textContent = `${city.name} · Planisphere · 北极点旋转中心 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => { state.date = new Date(); render(); }, 1000);
requestAnimationFrame(render);

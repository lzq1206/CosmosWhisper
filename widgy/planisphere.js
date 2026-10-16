import {
  DEG,
  TAU,
  clamp,
  equatorialOfDateToHorizontal,
  equatorialToHorizontal,
  localSiderealHours,
  planetaryBodies,
} from "../src/astro.js";
import { CONSTELLATIONS } from "../src/data/constellations.js";
import { MILKY_WAY_RINGS } from "../src/data/milkyWay.js";
import { STARS } from "../src/data/stars.js";
import { CITY_BY_ID } from "../src/data/cities.js";

const canvas = document.querySelector("#planisphere-canvas");
const status = document.querySelector("#planisphere-status");
const cityId = new URLSearchParams(window.location.search).get("city") || "beijing";
const city = CITY_BY_ID.get(cityId) || CITY_BY_ID.get("beijing");
const state = {
  date: new Date(),
  location: city,
  zoom: 1,
  latitudeSign: city.lat >= 0 ? 1 : -1,
};
const ctx = canvas.getContext("2d");
let metrics = null;

const COLORS = {
  ink: "#f0eee5",
  muted: "#8f9db8",
  grid: "rgba(145, 164, 201, .36)",
  line: "rgba(121, 200, 210, .68)",
  boundary: "rgba(216, 155, 158, .3)",
  galaxy: "rgba(255, 255, 255, .1)",
  gold: "#f2c36c",
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shortEdge = Math.min(rect.width, rect.height);
  metrics = {
    width: rect.width,
    height: rect.height,
    centerX: rect.width / 2,
    centerY: rect.height / 2,
    radius: Math.max(1, shortEdge / 2 - 26) * state.zoom,
  };
  return true;
}

function horizonScale() {
  return Math.max(.25, Math.tan(Math.abs(city.lat) * DEG / 2));
}

function projectOuter(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  const polarDec = state.latitudeSign * horizontal.dec;
  const radial = Math.tan((90 - polarDec) * DEG / 2);
  const normalized = radial / horizonScale();
  if (!Number.isFinite(normalized) || normalized > 1.04) return null;
  const hourAngle = (localSiderealHours(state.date, city.lon) - horizontal.ra) * state.latitudeSign * 15 * DEG;
  return {
    x: metrics.centerX + Math.sin(hourAngle) * metrics.radius * normalized,
    y: metrics.centerY - Math.cos(hourAngle) * metrics.radius * normalized,
  };
}

function visibleCircle() {
  return {
    centerX: metrics.centerX,
    centerY: metrics.centerY + metrics.radius * .22,
    radius: metrics.radius * .52,
  };
}

function projectVisible(ra, dec) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  if (horizontal.altitude < -0.7) return null;
  const window = visibleCircle();
  const radial = window.radius * (1 - clamp(horizontal.altitude, 0, 90) / 90);
  const angle = horizontal.azimuth * DEG;
  return {
    x: window.centerX + Math.sin(angle) * radial,
    y: window.centerY - Math.cos(angle) * radial,
  };
}

function projectVisibleOfDate(ra, dec) {
  const horizontal = equatorialOfDateToHorizontal(ra, dec, state.date, city.lat, city.lon);
  if (horizontal.altitude < -0.7) return null;
  const window = visibleCircle();
  const radial = window.radius * (1 - clamp(horizontal.altitude, 0, 90) / 90);
  const angle = horizontal.azimuth * DEG;
  return {
    x: window.centerX + Math.sin(angle) * radial,
    y: window.centerY - Math.cos(angle) * radial,
  };
}

function horizonAltitudeAtHourAngle(hourAngle) {
  return Math.atan(-Math.cos(hourAngle * 15 * DEG) * Math.tan(city.lat * DEG)) / DEG;
}

function horizonPath() {
  const points = [];
  for (let index = 0; index <= 144; index += 1) {
    const hourAngle = index / 6;
    const dec = horizonAltitudeAtHourAngle(hourAngle);
    const ra = localSiderealHours(state.date, city.lon) - hourAngle;
    points.push(projectVisibleOfDate(ra, dec));
  }
  return points;
}

function drawPath(points, close = false) {
  let started = false;
  for (const point of points) {
    if (!point) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(point.x, point.y);
      started = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  if (close && started) ctx.closePath();
}

function drawSurface() {
  const { centerX, centerY, radius } = metrics;
  ctx.fillStyle = "#07142e";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TAU);
  ctx.fill();
}

function drawOuterGrid() {
  const { centerX, centerY, radius } = metrics;
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = .6;
  ctx.setLineDash([2, 7]);
  for (let declination = 0; declination <= 80; declination += 20) {
    const radial = Math.tan((90 - declination) * DEG / 2) / horizonScale() * radius;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radial, 0, TAU);
    ctx.stroke();
  }
  for (let hour = 0; hour < 24; hour += 2) {
    const points = [];
    for (let declination = 0; declination <= 90 - Math.abs(city.lat); declination += 2) {
      points.push(projectOuter(hour, state.latitudeSign * declination));
    }
    ctx.beginPath();
    drawPath(points);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVisibleGrid() {
  const window = visibleCircle();
  ctx.save();
  ctx.strokeStyle = "rgba(145,164,201,.28)";
  ctx.lineWidth = .6;
  ctx.setLineDash([2, 6]);
  for (const altitude of [30, 60]) {
    const radial = window.radius * (1 - altitude / 90);
    ctx.beginPath();
    ctx.arc(window.centerX, window.centerY, radial, 0, TAU);
    ctx.stroke();
  }
  for (let azimuth = 0; azimuth < 360; azimuth += 30) {
    const angle = azimuth * DEG;
    ctx.beginPath();
    ctx.moveTo(window.centerX, window.centerY);
    ctx.lineTo(window.centerX + Math.sin(angle) * window.radius, window.centerY - Math.cos(angle) * window.radius);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGalaxy(projector) {
  ctx.save();
  ctx.beginPath();
  for (const ring of MILKY_WAY_RINGS) {
    drawPath(ring.map(([ra, dec]) => projector(ra, dec)), true);
  }
  ctx.fillStyle = COLORS.galaxy;
  ctx.fill("evenodd");
  ctx.restore();
}

function drawConstellations(projector, colorScale = 1) {
  ctx.save();
  ctx.lineWidth = .8 * colorScale;
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = COLORS.boundary;
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) {
      ctx.beginPath();
      drawPath(boundary.map(([ra, dec]) => projector(ra, dec)));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = COLORS.line;
  for (const constellation of CONSTELLATIONS) {
    for (const line of constellation.lines) {
      ctx.beginPath();
      drawPath(line.map(([ra, dec]) => projector(ra, dec)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawOuterStars() {
  for (const star of STARS) {
    const point = projectOuter(star.ra, star.dec);
    if (!point) continue;
    const radius = clamp(1 + (3.6 - star.magnitude) * .52, .9, 3.8);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color;
    ctx.globalAlpha = .55;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawVisibleStars() {
  const window = visibleCircle();
  ctx.save();
  ctx.beginPath();
  ctx.arc(window.centerX, window.centerY, window.radius, 0, TAU);
  ctx.clip();
  for (const star of STARS) {
    const point = projectVisible(star.ra, star.dec);
    if (!point) continue;
    const radius = clamp(1.1 + (3.6 - star.magnitude) * .62, 1, 4.8);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color;
    ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, .45, 1);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (star.magnitude <= 1.2) {
      ctx.fillStyle = "rgba(240,238,229,.78)";
      ctx.font = "9px Segoe UI, sans-serif";
      ctx.fillText(star.name, point.x + radius + 3, point.y - radius - 2);
    }
  }
  ctx.restore();
}

function drawBodies() {
  const window = visibleCircle();
  ctx.save();
  ctx.beginPath();
  ctx.arc(window.centerX, window.centerY, window.radius, 0, TAU);
  ctx.clip();
  for (const body of planetaryBodies(state.date, city.lat, city.lon)) {
    const point = projectVisibleOfDate(body.ra, body.dec);
    if (!point) continue;
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, body.size, 0, TAU);
    ctx.fill();
    ctx.font = "9px Segoe UI, sans-serif";
    ctx.fillText(body.name, point.x + body.size + 3, point.y - body.size - 2);
  }
  ctx.restore();
}

function drawVisibleWindow() {
  const window = visibleCircle();
  ctx.save();
  ctx.beginPath();
  ctx.arc(window.centerX, window.centerY, window.radius, 0, TAU);
  ctx.clip();
  drawVisibleGrid();
  drawConstellations(projectVisible, 1.1);
  drawVisibleStars();
  drawBodies();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(window.centerX, window.centerY, window.radius, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = COLORS.muted;
  ctx.font = "9px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("当前可见", window.centerX, window.centerY + window.radius - 12);
  ctx.restore();
}

function drawDial() {
  const { centerX, centerY, radius } = metrics;
  ctx.save();
  ctx.strokeStyle = "rgba(242,195,108,.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 8, 0, TAU);
  ctx.stroke();
  ctx.font = "10px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [label, fraction] of [["0h", 0], ["6h", .25], ["12h", .5], ["18h", .75]]) {
    const angle = -Math.PI / 2 + fraction * TAU;
    const distance = radius + 22;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance);
  }
  const lstFraction = localSiderealHours(state.date, city.lon) / 24;
  const pointerAngle = -Math.PI / 2 + lstFraction * TAU;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX + Math.cos(pointerAngle) * (radius - 5), centerY + Math.sin(pointerAngle) * (radius - 5));
  ctx.lineTo(centerX + Math.cos(pointerAngle) * (radius + 12), centerY + Math.sin(pointerAngle) * (radius + 12));
  ctx.stroke();
  ctx.restore();
}

function render() {
  if (!resize()) return;
  const { width, height, centerX, centerY, radius } = metrics;
  ctx.clearRect(0, 0, width, height);
  drawSurface();
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TAU);
  ctx.clip();
  drawGalaxy(projectOuter);
  drawOuterGrid();
  drawConstellations(projectOuter, .72);
  drawOuterStars();
  ctx.restore();
  drawVisibleWindow();
  drawDial();
  status.textContent = `${city.name} · 活动星图 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => {
  state.date = new Date();
  render();
}, 1000);
requestAnimationFrame(render);

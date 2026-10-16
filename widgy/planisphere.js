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

function horizonAltitudeAtHourAngle(hourAngle) {
  return Math.atan(-Math.cos(hourAngle * 15 * DEG) * Math.tan(city.lat * DEG)) / DEG;
}

function projectCoordinates(ra, dec, horizontal, allowInvisible = false) {
  if (!allowInvisible && horizontal.altitude < -0.7) return null;
  const polarDec = state.latitudeSign * dec;
  const radial = Math.tan((90 - polarDec) * DEG / 2);
  const lst = localSiderealHours(state.date, city.lon);
  const hourAngle = (lst - ra) * state.latitudeSign * 15 * DEG;
  const normalized = radial / horizonScale();
  return {
    x: metrics.centerX + Math.sin(hourAngle) * metrics.radius * normalized,
    y: metrics.centerY - Math.cos(hourAngle) * metrics.radius * normalized,
    altitude: horizontal.altitude,
  };
}

function projectEquatorial(ra, dec, allowInvisible = false) {
  const horizontal = equatorialToHorizontal(ra, dec, state.date, city.lat, city.lon);
  return projectCoordinates(horizontal.ra, horizontal.dec, horizontal, allowInvisible);
}

function projectOfDate(ra, dec, allowInvisible = false) {
  const horizontal = equatorialOfDateToHorizontal(ra, dec, state.date, city.lat, city.lon);
  return projectCoordinates(ra, dec, horizontal, allowInvisible);
}

function horizonScale() {
  const lowestDeclination = 90 - Math.abs(city.lat);
  return Math.tan((90 - lowestDeclination) * DEG / 2) || 1;
}

function horizonPath() {
  const points = [];
  for (let index = 0; index <= 144; index += 1) {
    const hourAngle = index / 6;
    const dec = horizonAltitudeAtHourAngle(hourAngle);
    const ra = localSiderealHours(state.date, city.lon) - hourAngle;
    const point = projectOfDate(ra, dec, true);
    points.push(point);
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

function drawGrid() {
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
      const point = projectEquatorial(hour, state.latitudeSign * declination, true);
      points.push(point);
    }
    ctx.beginPath();
    drawPath(points);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGalaxy() {
  ctx.save();
  ctx.beginPath();
  for (const ring of MILKY_WAY_RINGS) {
    drawPath(ring.map(([ra, dec]) => projectEquatorial(ra, dec, true)), true);
  }
  ctx.fillStyle = COLORS.galaxy;
  ctx.fill("evenodd");
  ctx.restore();
}

function drawConstellations() {
  ctx.save();
  ctx.lineWidth = .8;
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = COLORS.boundary;
  for (const constellation of CONSTELLATIONS) {
    for (const boundary of constellation.boundaryParts) {
      ctx.beginPath();
      drawPath(boundary.map(([ra, dec]) => projectEquatorial(ra, dec)));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = COLORS.line;
  for (const constellation of CONSTELLATIONS) {
    for (const line of constellation.lines) {
      ctx.beginPath();
      drawPath(line.map(([ra, dec]) => projectEquatorial(ra, dec)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStars() {
  for (const star of STARS) {
    const point = projectEquatorial(star.ra, star.dec);
    if (!point) continue;
    const radius = clamp(1.1 + (3.6 - star.magnitude) * .6, 1.1, 4.6);
    const color = star.tone === "warm" ? "#ffd596" : star.tone === "blue" ? "#c9dcff" : COLORS.ink;
    ctx.fillStyle = color;
    ctx.globalAlpha = clamp(1.02 - star.magnitude / 7, .42, 1);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (star.magnitude <= 1.2) {
      ctx.fillStyle = "rgba(240,238,229,.75)";
      ctx.font = "9px Segoe UI, sans-serif";
      ctx.fillText(star.name, point.x + radius + 3, point.y - radius - 2);
    }
  }
}

function drawBodies() {
  for (const body of planetaryBodies(state.date, city.lat, city.lon)) {
    const point = projectEquatorial(body.ra, body.dec);
    if (!point) continue;
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, body.size * .9, 0, TAU);
    ctx.fill();
    ctx.font = "9px Segoe UI, sans-serif";
    ctx.fillText(body.name, point.x + body.size + 3, point.y - body.size - 2);
  }
}

function drawHorizon() {
  const points = horizonPath();
  ctx.save();
  ctx.beginPath();
  ctx.arc(metrics.centerX, metrics.centerY, metrics.radius, 0, TAU);
  ctx.clip();
  ctx.beginPath();
  drawPath(points, true);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.3;
  ctx.stroke();
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
  const cardinal = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
  ctx.fillStyle = COLORS.ink;
  for (const [label, azimuth] of cardinal) {
    const angle = azimuth * DEG;
    ctx.fillText(label, centerX + Math.sin(angle) * (radius - 19), centerY - Math.cos(angle) * (radius - 19));
  }
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
  drawGalaxy();
  drawGrid();
  drawConstellations();
  drawStars();
  drawBodies();
  ctx.restore();
  drawHorizon();
  drawDial();
  status.textContent = `${city.name} · 活动星图 · 恒星时 ${localSiderealHours(state.date, city.lon).toFixed(2)}h`;
}

window.addEventListener("resize", render);
setInterval(() => {
  state.date = new Date();
  render();
}, 1000);
requestAnimationFrame(render);

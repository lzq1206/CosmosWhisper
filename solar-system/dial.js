import { heliocentricEcliptic, moonEcliptic, solarAltitude, planetaryBodies } from '../src/astro.js';

const canvas = document.querySelector('#dial');
const ctx = canvas.getContext('2d');
const dateInput = document.querySelector('#date');
const timeLabel = document.querySelector('#time');
const planets = [
  { id: 'Mercury', name: '水星', color: '#aaa39b', size: 8 },
  { id: 'Venus', name: '金星', color: '#d9b779', size: 11 },
  { id: 'Earth', name: '地球', color: '#438ac6', size: 12 },
  { id: 'Mars', name: '火星', color: '#c87452', size: 9 },
  { id: 'Jupiter', name: '木星', color: '#d9b494', size: 18 },
  { id: 'Saturn', name: '土星', color: '#d8c394', size: 16 },
  { id: 'Uranus', name: '天王星', color: '#92d4d7', size: 12 },
  { id: 'Neptune', name: '海王星', color: '#4777d4', size: 12 },
];
const snapshotTime = Number(new URLSearchParams(window.location.search).get('at'));
let chosenDate = Number.isFinite(snapshotTime) && snapshotTime > 0 ? new Date(snapshotTime) : null;
let location = { lat: 39.9042, lon: 116.4074 };
let ringCache = null;
const center = 600;
const semiMajorAxes = { Mercury:.387098, Venus:.723330, Earth:1, Mars:1.523688, Jupiter:5.20256, Saturn:9.55475, Uranus:19.18171, Neptune:30.05826 };
const axisRates = { Uranus:-1.55e-8, Neptune:3.313e-8 };
function projectedPosition(id, date, radius, anomaly = null) {
  let vector = heliocentricEcliptic(id, date, anomaly);
  if (id === 'Earth') vector = { x:-vector.x, y:-vector.y };
  const days = date.getTime() / 86400000 + 2440587.5 - 2451543.5;
  const scale = radius / (semiMajorAxes[id] + (axisRates[id] || 0) * days);
  return { x:center + vector.x * scale, y:center - vector.y * scale };
}
const terms = ['春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','惊蛰'];
const ringColors = { day:'#f4f1df', standard:'#f6e2b4', civil:'#f2c36c', nautical:'#79aeea', astronomical:'#d59af4', moon:'#9bcdf7', night:'#1b335e' };

function timeRing(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1).getTime();
  const key = `${start}:${end}:${location.lat}:${location.lon}`;
  if (ringCache?.key === key) return ringCache;
  const segments = [];
  for (let t = start; t < end; t += 60000) {
    const middle = new Date(Math.min(t + 30000, end));
    const alt = solarAltitude(middle, location.lat, location.lon);
    let state = alt >= 0 ? 'day' : alt >= -.833 ? 'standard' : alt >= -6 ? 'civil' : alt >= -12 ? 'nautical' : alt >= -18 ? 'astronomical' : 'night';
    if (state === 'night') {
      const moon = planetaryBodies(middle, location.lat, location.lon).find(body => body.id === 'moon');
      if (moon.horizontal.altitude > 0 && moon.illumination >= .08) state = 'moon';
    }
    const previous = segments[segments.length - 1];
    if (previous?.state === state) previous.end = Math.min(t + 60000, end);
    else segments.push({ state, start:t, end:Math.min(t + 60000, end) });
  }
  return ringCache = { key, start, end, segments };
}

function drawRings(date, earthAngle) {
  const inner = 487, outer = 532, middle = (inner + outer) / 2;
  ctx.lineWidth = outer-inner; ctx.strokeStyle = '#0c1c38'; circle(center,center,middle); ctx.stroke();
  // The Sun's geocentric longitude is opposite Earth's heliocentric longitude.
  const sunLongitude = ((-earthAngle * 180 / Math.PI - 180) % 360 + 360) % 360;
  const current = Math.floor(sunLongitude / 15);
  for (let i=0; i<24; i++) {
    const angle = -(i * 15 + 180) * Math.PI / 180;
    const next = -((i+1)*15 + 180) * Math.PI / 180;
    if (i === current) { ctx.strokeStyle='rgba(245,214,140,.36)'; ctx.lineWidth=outer-inner-2; ctx.beginPath(); ctx.arc(center,center,middle,angle,next,true); ctx.stroke(); }
    ctx.strokeStyle='rgba(218,182,112,.5)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(center+Math.cos(angle)*inner,center+Math.sin(angle)*inner); ctx.lineTo(center+Math.cos(angle)*outer,center+Math.sin(angle)*outer); ctx.stroke();
    const a = -(i*15+7.5+180)*Math.PI/180;
    ctx.save(); ctx.translate(center+Math.cos(a)*middle,center+Math.sin(a)*middle);
    let rotation=a+Math.PI/2; if (Math.sin(a)>0) rotation+=Math.PI; ctx.rotate(rotation);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=i===current?'#f5d68c':'#d2dceb'; ctx.font='24px system-ui'; ctx.fillText(terms[i],0,0); ctx.restore();
  }
  ctx.lineWidth=1.5; ctx.strokeStyle='#bc9d61'; circle(center,center,inner); ctx.stroke(); circle(center,center,outer); ctx.stroke();
  ctx.save(); ctx.translate(center,center); ctx.rotate(earthAngle); ctx.fillStyle='#f5d68c'; ctx.strokeStyle='#071227'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(inner+13,0); ctx.lineTo(inner-3,-9); ctx.lineTo(inner-3,9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();

  const ring = timeRing(date), r = 547;
  ctx.lineWidth=22;
  for (const segment of ring.segments) { ctx.strokeStyle=ringColors[segment.state]; ctx.beginPath(); ctx.arc(center,center,r,-Math.PI/2+(segment.start-ring.start)/(ring.end-ring.start)*Math.PI*2,-Math.PI/2+(segment.end-ring.start)/(ring.end-ring.start)*Math.PI*2); ctx.stroke(); }
  for (let i=0;i<96;i++) {const a=-Math.PI/2+i*Math.PI*2/96; ctx.strokeStyle=i%4===0?'rgba(240,238,229,.8)':'rgba(137,147,171,.65)'; ctx.lineWidth=i%4===0?2:1; ctx.beginPath(); ctx.moveTo(center+Math.cos(a)*(i%4===0?539:544),center+Math.sin(a)*(i%4===0?539:544)); ctx.lineTo(center+Math.cos(a)*557,center+Math.sin(a)*557); ctx.stroke();}
  ctx.font='13px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ['0h','6h','12h','18h'].forEach((label,i)=>{const a=-Math.PI/2+i*Math.PI/2; ctx.save(); ctx.translate(center+Math.cos(a)*r,center+Math.sin(a)*r); let rot=a+Math.PI/2; if(Math.cos(rot)<0)rot+=Math.PI;ctx.rotate(rot);ctx.lineWidth=3;ctx.strokeStyle='#030817';ctx.strokeText(label,0,0);ctx.fillStyle='#f6e3bb';ctx.fillText(label,0,0);ctx.restore()});
  const a=-Math.PI/2+(date.getTime()-ring.start)/(ring.end-ring.start)*Math.PI*2;
  ctx.save();ctx.translate(center+Math.cos(a)*r,center+Math.sin(a)*r);ctx.strokeStyle='#ff625f';ctx.fillStyle='#ff292f';ctx.lineWidth=3;circle(0,0,5);ctx.fill();for(let i=0;i<8;i++){const ray=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(ray)*7,Math.sin(ray)*7);ctx.lineTo(Math.cos(ray)*13,Math.sin(ray)*13);ctx.stroke()}ctx.restore();
}

function circle(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

function drawPlanet(planet, x, y) {
  const r = planet.size;
  if (planet.id === 'Saturn') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.strokeStyle = '#d6c29a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.85, r * .46, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const shade = ctx.createRadialGradient(x - r * .2, y - r * .2, r * .05, x, y, r * 1.15);
  shade.addColorStop(0, planet.color);
  shade.addColorStop(1, '#34405a');
  circle(x, y, r);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.save();
  circle(x, y, r);
  ctx.clip();
  if (planet.id === 'Jupiter' || planet.id === 'Saturn') {
    ctx.strokeStyle = planet.id === 'Jupiter' ? '#a7755d' : '#b5a27e';
    ctx.lineWidth = r * .18;
    for (const offset of [-.45, -.1, .25, .55]) {
      ctx.beginPath(); ctx.moveTo(x - r, y + r * offset); ctx.lineTo(x + r, y + r * offset + r * .08); ctx.stroke();
    }
  }
  if (planet.id === 'Earth') {
    ctx.fillStyle = '#72ae86';
    ctx.beginPath(); ctx.ellipse(x - r * .25, y - r * .12, r * .35, r * .19, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r * .22, y + r * .25, r * .18, r * .28, .3, 0, Math.PI * 2); ctx.fill();
  }
  // Illumination is directed toward the Sun, at the center of the dial.
  const distance = Math.hypot(center - x, center - y) || 1;
  const lightX = (center - x) / distance;
  const lightY = (center - y) / distance;
  const light = ctx.createLinearGradient(x + lightX * r, y + lightY * r, x - lightX * r, y - lightY * r);
  light.addColorStop(0, 'rgba(255,245,210,.25)');
  light.addColorStop(.43, 'rgba(0,0,0,.03)');
  light.addColorStop(.58, 'rgba(2,6,16,.48)');
  light.addColorStop(1, 'rgba(2,6,16,.88)');
  ctx.fillStyle = light;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

function drawEarthMoon(date, earthX, earthY) {
  // The Moon's geocentric ecliptic vector sets its direction in the same
  // north-of-the-ecliptic view as the planets. Orbit size is enlarged to show it.
  const moon = moonEcliptic(date);
  const angle = Math.atan2(-moon.y, moon.x);
  const orbitRadius = 30;
  ctx.save();
  ctx.strokeStyle = 'rgba(193,211,232,.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  circle(earthX, earthY, orbitRadius);
  ctx.stroke();
  ctx.restore();
  const x = earthX + Math.cos(angle) * orbitRadius;
  const y = earthY + Math.sin(angle) * orbitRadius;
  drawPlanet({ id: 'Moon', color: '#d5d9de', size: 5 }, x, y);
}

function draw() {
  const date = chosenDate || new Date();
  ctx.clearRect(0, 0, 1200, 1200);
  const background = ctx.createRadialGradient(center, center, 30, center, center, 600);
  background.addColorStop(0, '#102440'); background.addColorStop(1, '#030817');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1200, 1200);
  // Use nearly the full square while keeping the outer Sun marker inside it.
  ctx.save();
  ctx.translate(center, center);
  ctx.scale(1.055, 1.055);
  ctx.translate(-center, -center);
  const glow = ctx.createRadialGradient(center, center, 3, center, center, 80);
  glow.addColorStop(0, '#fff8c3'); glow.addColorStop(.28, '#ffbe51'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; circle(center, center, 80); ctx.fill();
  ctx.fillStyle = '#ffe298'; circle(center, center, 23); ctx.fill();
  ctx.font = '19px system-ui'; ctx.fillStyle = '#ffe5a9'; ctx.fillText('太阳', center + 29, center + 6);

  planets.forEach((planet, index) => {
    const radius = 85 + index * 54;
    ctx.strokeStyle = 'rgba(175,194,224,.32)'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let step = 0; step <= 180; step++) {
      const point = projectedPosition(planet.id, date, radius, step * 2);
      if (step === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath(); ctx.stroke();
    const { x, y } = projectedPosition(planet.id, date, radius);
    if (planet.id === 'Earth') drawEarthMoon(date, x, y);
    drawPlanet(planet, x, y);
    ctx.font = '19px system-ui'; ctx.fillStyle = '#e1ebfa';
    ctx.textAlign = x > 1050 ? 'right' : 'left';
    ctx.fillText(planet.name, x + (x > 1050 ? -planet.size - 7 : planet.size + 7), y - planet.size * .55);
    ctx.textAlign = 'left';
  });
  const earth = heliocentricEcliptic('Earth', date);
  drawRings(date, -Math.atan2(-earth.y, -earth.x));
  ctx.restore();
  timeLabel.textContent = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full', timeStyle: 'short' }).format(date)
    + (chosenDate ? ' · 指定时间' : ' · 实时');
}

dateInput.addEventListener('change', () => {
  const date = new Date(dateInput.value);
  if (!Number.isNaN(date.getTime())) chosenDate = date;
  draw();
});
document.querySelector('#now').addEventListener('click', () => { chosenDate = null; dateInput.value = ''; draw(); });
document.querySelector('#locate').addEventListener('click', () => {
  if (!navigator.geolocation) { document.querySelector('#location-status').textContent = '无法获取定位，时间环使用北京。'; return; }
  navigator.geolocation.getCurrentPosition(({ coords }) => { location = { lat:coords.latitude, lon:coords.longitude }; ringCache = null; document.querySelector('#location-status').textContent = `时间环地点：${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`; draw(); }, () => { document.querySelector('#location-status').textContent = '定位未成功，时间环使用当前地点设置。'; });
});
draw();
setInterval(() => { if (!chosenDate) draw(); }, 60000);

import { heliocentricEcliptic } from '../src/astro.js';

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
let chosenDate = null;
const center = 600;

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
  const shade = ctx.createRadialGradient(x - r * .38, y - r * .42, r * .05, x, y, r * 1.15);
  shade.addColorStop(0, '#fff6dc');
  shade.addColorStop(.23, planet.color);
  shade.addColorStop(1, '#142138');
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
  ctx.restore();
}

function draw() {
  const date = chosenDate || new Date();
  ctx.clearRect(0, 0, 1200, 1200);
  const background = ctx.createRadialGradient(center, center, 30, center, center, 600);
  background.addColorStop(0, '#102440'); background.addColorStop(1, '#030817');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1200, 1200);
  ctx.strokeStyle = '#ac9561'; ctx.lineWidth = 2; circle(center, center, 570); ctx.stroke();
  for (let n = 0; n < 120; n++) {
    const a = n * Math.PI / 60;
    const inner = n % 5 === 0 ? 558 : 564;
    ctx.strokeStyle = n % 5 === 0 ? '#b8a574' : '#52617b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(center + Math.cos(a) * inner, center + Math.sin(a) * inner);
    ctx.lineTo(center + Math.cos(a) * 568, center + Math.sin(a) * 568); ctx.stroke();
  }
  const glow = ctx.createRadialGradient(center, center, 3, center, center, 80);
  glow.addColorStop(0, '#fff8c3'); glow.addColorStop(.28, '#ffbe51'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; circle(center, center, 80); ctx.fill();
  ctx.fillStyle = '#ffe298'; circle(center, center, 23); ctx.fill();
  ctx.font = '19px system-ui'; ctx.fillStyle = '#ffe5a9'; ctx.fillText('太阳', center + 29, center + 6);

  planets.forEach((planet, index) => {
    const radius = 105 + index * 61;
    ctx.strokeStyle = 'rgba(175,194,224,.32)'; ctx.lineWidth = 1.3;
    circle(center, center, radius); ctx.stroke();
    let vector = heliocentricEcliptic(planet.id, date);
    // The Earth elements in astro.js describe the Sun as seen from Earth.
    if (planet.id === 'Earth') vector = { x: -vector.x, y: -vector.y };
    const angle = Math.atan2(vector.y, vector.x);
    const x = center + radius * Math.cos(angle);
    const y = center - radius * Math.sin(angle);
    drawPlanet(planet, x, y);
    ctx.font = '19px system-ui'; ctx.fillStyle = '#e1ebfa';
    ctx.textAlign = x > 1050 ? 'right' : 'left';
    ctx.fillText(planet.name, x + (x > 1050 ? -planet.size - 7 : planet.size + 7), y - planet.size * .55);
    ctx.textAlign = 'left';
  });
  timeLabel.textContent = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full', timeStyle: 'short' }).format(date)
    + (chosenDate ? ' · 指定时间' : ' · 实时');
}

dateInput.addEventListener('change', () => {
  const date = new Date(dateInput.value);
  if (!Number.isNaN(date.getTime())) chosenDate = date;
  draw();
});
document.querySelector('#now').addEventListener('click', () => { chosenDate = null; dateInput.value = ''; draw(); });
draw();
setInterval(() => { if (!chosenDate) draw(); }, 60000);

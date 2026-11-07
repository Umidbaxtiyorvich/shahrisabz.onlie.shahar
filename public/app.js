import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- Koordinatalar: Shahrisabz markazi (Oqsaroy atrofi) ----
const LAT0 = 39.0578, LON0 = 66.8297;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110540;
const toXZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const BBOX = '39.015,66.775,39.105,66.885';

const $ = (id) => document.getElementById(id);
const api = async (url, data) => {
  const r = await fetch(url, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Xato');
  return j;
};
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---- Sahna ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 4000, 9000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 20000);
camera.position.set(0, 1400, 1500);
const controls = new MapControls(camera, renderer.domElement);
controls.maxPolarAngle = 1.35; controls.minDistance = 30; controls.maxDistance = 7000;
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfa0, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(800, 1500, 600); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshLambertMaterial({ color: 0xf4efcc }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
// bulutlar
for (let i = 0; i < 18; i++) {
  const c = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(60 + Math.random() * 50, 10, 8), m); s.position.set(j * 70 - 100, Math.random() * 30, Math.random() * 40); c.add(s); }
  c.position.set((Math.random() - .5) * 9000, 900 + Math.random() * 300, (Math.random() - .5) * 9000); scene.add(c);
}

// ---- Matnli yorliqlar (sprite) ----
function label(text, { size = 28, bg = 'rgba(255,255,255,.92)', fg = '#1d2433', scale = 1 } = {}) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = `600 ${size}px system-ui,sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + size, h = size * 1.6;
  cv.width = w; cv.height = h;
  g.font = `600 ${size}px system-ui,sans-serif`;
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill();
  g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, size / 2, h / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / h * 10 * scale, 10 * scale, 1); sp.renderOrder = 10;
  return sp;
}

// ---- Yo'llar (OpenStreetMap) ----
const WIDTH = { motorway: 20, trunk: 18, primary: 16, secondary: 13, tertiary: 11, residential: 8, unclassified: 8, road: 7, living_street: 6, service: 5, pedestrian: 5, track: 4, footway: 2.5, path: 2 };
let segments = []; // {ax,az,bx,bz,name}
let places = []; // {name,x,z}
const streetLabels = [], placeLabels = [];
let streetNames = [];

async function loadOSM() {
  const cached = store.get('osm-shahrisabz-v2');
  if (cached) return cached;
  status('🗺️ Shahrisabz xaritasi yuklanmoqda (birinchi marta 1–2 daqiqa)…');
  try { const r = await fetch('osm.json', { signal: AbortSignal.timeout(150000) }); if (r.ok) { const j = await r.json(); store.set('osm-shahrisabz-v2', j); return j; } } catch {}
  const q = `[out:json][timeout:180];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian|track|road|footway|path)$"](${BBOX}););out geom;(nwr["place"~"^(suburb|quarter|neighbourhood|city_block|village|hamlet|isolated_dwelling|locality|town)$"](${BBOX});relation["boundary"="administrative"]["admin_level"~"^(8|9|10|11)$"](${BBOX}););out center tags;`;
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  for (const u of mirrors) {
    try {
      const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(60000) });
      if (!r.ok) continue;
      const j = await r.json();
      const slim = { ways: [], places: [] };
      for (const e of j.elements) {
        if (e.type === 'way' && e.geometry) slim.ways.push({ t: e.tags.highway, n: e.tags['name:uz'] || e.tags.name || '', g: e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
        else if (e.tags?.name && (e.lat || e.center)) slim.places.push({ n: e.tags['name:uz'] || e.tags.name, k: e.tags.place || 'mahalla', lat: e.lat ?? e.center.lat, lon: e.lon ?? e.center.lon });
      }
      store.set('osm-shahrisabz-v2', slim);
      return slim;
    } catch {}
  }
  return null;
}

function fallbackGrid() { // internet bo'lmasa — oddiy to'r
  const ways = [], places = [];
  for (let i = -12; i <= 12; i++) {
    ways.push({ t: i % 4 ? 'residential' : 'secondary', n: `${Math.abs(i) + 1}-ko'cha`, xz: [[i * 200, -2500], [i * 200, 2500]] });
    ways.push({ t: i % 4 ? 'residential' : 'secondary', n: `${Math.abs(i) + 13}-ko'cha`, xz: [[-2500, i * 200], [2500, i * 200]] });
  }
  ['Oqsaroy', 'Dorut-tilovat', 'Kesh', 'Navbog\'', 'Ipak yo\'li'].forEach((n, k) => places.push({ n, xz: [Math.cos(k * 1.3) * 1200, Math.sin(k * 1.3) * 1200] }));
  return { ways, places };
}

function buildRoads(data) {
  const geos = [], lineGeo = [];
  const named = new Map();
  for (const w of data.ways) {
    const pts = w.xz || w.g.map(([la, lo]) => toXZ(la, lo));
    const wd = WIDTH[w.t] || 6;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az); if (len < .1) continue;
      segments.push({ ax, az, bx, bz, name: w.n });
      const g = new THREE.PlaneGeometry(len + wd * .6, wd);
      g.rotateX(-Math.PI / 2); g.rotateY(-Math.atan2(bz - az, bx - ax)); g.translate((ax + bx) / 2, .3 + (wd > 10 ? .1 : 0), (az + bz) / 2);
      geos.push(g);
      if (wd >= 11) { const m = new THREE.PlaneGeometry(len * .9, .6); m.rotateX(-Math.PI / 2); m.rotateY(-Math.atan2(bz - az, bx - ax)); m.translate((ax + bx) / 2, .5, (az + bz) / 2); lineGeo.push(m); }
      if (w.n) { const arr = named.get(w.n) || []; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (len > 12 && !arr.some((q) => Math.hypot(q.x - mx, q.z - mz) < 350)) arr.push({ x: mx, z: mz }); named.set(w.n, arr); }
    }
  }
  for (let i = 0; i < geos.length; i += 4000) scene.add(new THREE.Mesh(mergeGeometries(geos.slice(i, i + 4000)), new THREE.MeshLambertMaterial({ color: 0xd3d7de })));
  for (let i = 0; i < lineGeo.length; i += 4000) scene.add(new THREE.Mesh(mergeGeometries(lineGeo.slice(i, i + 4000)), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  streetNames = [...named.keys()].sort();
  for (const [n, arr] of named) for (const q of arr) {
    const l = label(n, { size: 24, bg: 'rgba(255,255,255,.8)', fg: '#4a5568', scale: 1.1 });
    l.position.set(q.x, 8, q.z); l.visible = false; scene.add(l); streetLabels.push(l);
  }
  const seenP = new Set();
  places = data.places.map((p) => { const [x, z] = p.xz || toXZ(p.lat, p.lon); return { name: p.n, k: p.k, x, z }; }).filter((p) => { const key = p.name + Math.round(p.x / 200) + Math.round(p.z / 200); if (seenP.has(key)) return false; seenP.add(key); return true; });
  for (const p of places) { const big = /suburb|town|village/.test(p.k || ''); const l = label('📍 ' + p.name, { size: 32, bg: big ? 'rgba(47,124,246,.92)' : 'rgba(31,164,99,.9)', fg: '#fff', scale: big ? 3.2 : 2 }); l.position.set(p.x, big ? 60 : 35, p.z); l.userData.big = big; scene.add(l); placeLabels.push(l); }
  // daraxtlar (bo'sh joylar uchun bezak)
  const treeG = new THREE.ConeGeometry(5, 14, 6); treeG.translate(0, 9, 0);
  const trees = new THREE.InstancedMesh(treeG, new THREE.MeshLambertMaterial({ color: 0x5cc96b }), 1500);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 1500; i++) { const s = segments[(Math.random() * segments.length) | 0]; const t = Math.random(), off = (Math.random() > .5 ? 1 : -1) * 14; const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz) || 1; mtx.makeTranslation(s.ax + dx * t - dz / L * off, 0, s.az + dz * t + dx / L * off); trees.setMatrixAt(i, mtx); }
  scene.add(trees);
}

function nearestRoad(x, z) {
  let best = null, bd = Infinity;
  for (const s of segments) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
    const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { s, px, pz, d }; }
  }
  return best;
}
function nearestStreetName(x, z) {
  let best = '', bd = Infinity;
  for (const s of segments) { if (!s.name) continue; const d = Math.hypot((s.ax + s.bx) / 2 - x, (s.az + s.bz) / 2 - z); if (d < bd) { bd = d; best = s.name; } }
  return bd < 400 ? best : '';
}
const nearestMahalla = (x, z) => places.reduce((b, p) => { const d = Math.hypot(p.x - x, p.z - z); return d < b.d ? { d, n: p.name } : b; }, { d: Infinity, n: '' }).n;

// ---- Uylar va binolar ----
const objects = new THREE.Group(); scene.add(objects);
const clickable = [];
const hsl = (h, s = .65, l = .62) => new THREE.Color().setHSL(h / 360, s, l);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: .05, ...o });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fd3ff, roughness: .1, metalness: .6, emissive: 0x1b3a5c, emissiveIntensity: .25 });
function box(g, w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); g.add(m); return m; }
function windowsRow(g, w, y, z, n, h = 2.4) { for (let i = 0; i < n; i++) box(g, (w / n) * .6, h, .3, GLASS, -w / 2 + (w / n) * (i + .5), y, z); }
// Uy dizaynlari: oddiy → zamonaviy → kottej → villa → minora
const HOUSE_BUILDERS = {
  oddiy(g, c) {
    box(g, 12, 8, 12, M(0xf2ead3));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 4), M(c)); roof.position.y = 10.5; roof.rotation.y = Math.PI / 4; g.add(roof);
    box(g, 2.6, 4.5, .4, M(0x8a5a2b), 0, 0, 6.05); windowsRow(g, 10, 4, 6.05, 2, 2.2);
    return 15;
  },
  zamonaviy(g, c) {
    box(g, 16, 6, 12, M(0xf7f7f5)); box(g, 10, 5, 10, M(c), 3, 6, -1);
    box(g, 16.6, .5, 12.6, M(0x2b2f36), 0, 6); box(g, 10.6, .5, 10.6, M(0x2b2f36), 3, 11);
    box(g, 9, 3.6, .3, GLASS, -3, 1, 6.05); box(g, 7, 3, .3, GLASS, 3, 7, 4.05);
    box(g, 3, 4.6, .3, M(0x3b2a1e), 5.5, 0, 6.05);
    box(g, 18, .3, 6, M(0xd9d4c7), 0, 0, 9); // terrasa
    return 15;
  },
  kottej(g, c) {
    box(g, 16, 5, 13, M(0xefe6d6)); box(g, 16, 5, 13, M(0xe7dcc8), 0, 5);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 12.5, 6, 4, 1), M(c)); roof.position.y = 13; roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, .85); g.add(roof);
    windowsRow(g, 14, 1.2, 6.55, 3); windowsRow(g, 14, 6.2, 6.55, 4);
    box(g, 10, .4, 3, M(0xffffff), 0, 5, 7.8); box(g, 10, 1, .2, M(0xffffff), 0, 5.4, 9.2); // balkon
    box(g, 3, 4.2, .3, M(0x6b3e1f), 0, 0, 6.6); box(g, 2, 3, 2, M(0x9a8f80), 5, 13, 0); // mo'ri
    return 19;
  },
  villa(g, c) {
    box(g, 24, 6, 14, M(0xfbfaf7)); box(g, 14, 5, 12, M(0xfbfaf7), -5, 6, -1);
    box(g, 25, .6, 15, M(c), 0, 6); box(g, 15, .6, 13, M(c), -5, 11);
    box(g, 20, 4, .3, GLASS, 0, 1, 7.05); box(g, 12, 3.4, .3, GLASS, -5, 7, 5.05);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(12, .4, 6), new THREE.MeshStandardMaterial({ color: 0x35b6e8, roughness: .1, metalness: .3 })); pool.position.set(5, .25, 12); g.add(pool);
    box(g, 14, .2, 8, M(0xe8e1d2), 5, 0, 12);
    for (const x of [-11, 11]) { const t = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), M(0x3fae55)); t.position.set(x, 3, 10); g.add(t); box(g, .6, 2, .6, M(0x7a5230), x, 0, 10); }
    return 16;
  },
  minora(g, c) {
    box(g, 14, 4, 14, M(0x2b2f36));
    for (let f = 0; f < 10; f++) { box(g, 12, 3.6, 12, f % 2 ? GLASS : M(c, { metalness: .3, roughness: .3 }), 0, 4 + f * 3.8); box(g, 12.8, .3, 12.8, M(0xffffff), 0, 7.6 + f * 3.8); }
    box(g, 2, 6, 2, M(0xdddddd), 0, 42);
    return 52;
  },
};
const CAR_BUILDERS = {
  sedan: (g, m) => { box(g, 4.4, 1.2, 2, m, 0, .5); box(g, 2.4, .9, 1.8, GLASS, -.2, 1.7); },
  jeep: (g, m) => { box(g, 4.6, 1.6, 2.2, m, 0, .6); box(g, 3, 1.2, 2, GLASS, -.4, 2.2); box(g, .8, .8, .3, M(0x222222), -2.3, 1, 0); },
  sport: (g, m) => { box(g, 4.6, .9, 2.1, m, 0, .4); box(g, 1.8, .6, 1.7, GLASS, -.3, 1.3); box(g, .4, .5, 2.1, M(0x111111), 2.1, 1.3); },
  limuzin: (g, m) => { box(g, 7.5, 1.2, 2.1, m, 0, .5); box(g, 5.4, .9, 1.9, GLASS, -.3, 1.7); },
};
function car(type, hue) {
  const g = new THREE.Group(), m = M(new THREE.Color().setHSL(hue / 360, .75, .45), { metalness: .6, roughness: .3 });
  CAR_BUILDERS[type](g, m);
  const len = type === 'limuzin' ? 2.8 : 1.5;
  for (const x of [-len, len]) for (const z of [-1.05, 1.05]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .4, 12), M(0x111111)); w.rotation.x = Math.PI / 2; w.position.set(x, .5, z); g.add(w); }
  return g;
}
// Avatar: Instagram rasmi (bo'lmasa — bosh harf) dumaloq qilib
const avatarCache = new Map();
function avatarSprite(r) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const draw = (img) => {
    g.clearRect(0, 0, 128, 128);
    g.save(); g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.closePath();
    const grd = g.createLinearGradient(0, 0, 128, 128); grd.addColorStop(0, '#feda75'); grd.addColorStop(.5, '#d62976'); grd.addColorStop(1, '#4f5bd5');
    g.fillStyle = grd; g.fill(); g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.clip();
    if (img) g.drawImage(img, 10, 10, 108, 108);
    else { g.fillStyle = hsl(r.color, .55, .55).getStyle(); g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = 'bold 60px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.username[0].toUpperCase(), 64, 68); }
    g.restore(); tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; draw(null);
  if (r.avatar) {
    let p = avatarCache.get(r.username);
    if (!p) { p = new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = '/avatar/' + encodeURIComponent(r.username); }); avatarCache.set(r.username, p); }
    p.then((im) => im && draw(im));
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(9, 9, 1); sp.renderOrder = 11;
  return sp;
}
function house(r) {
  const g = new THREE.Group();
  const top = (HOUSE_BUILDERS[r.style] || HOUSE_BUILDERS.oddiy)(g, hsl(r.color));
  if (r.car && CAR_BUILDERS[r.car]) { const c = car(r.car, r.carColor || 0); c.position.set(-11, 0, 9); g.add(c); }
  const av = avatarSprite(r); av.position.y = top + 9; g.add(av);
  const l = label('@' + r.username, { size: 26, fg: '#2f7cf6', scale: .9 }); l.position.y = top + 2.5; g.add(l);
  g.position.set(r.x, 0, r.z);
  g.userData = { kind: 'house', r };
  g.traverse((o) => { if (o.isMesh || o.isSprite) { o.userData = g.userData; clickable.push(o); } });
  return g;
}
const TYPE_STYLE = { uy: [0xf2ead3, 10], "do'kon": [0xffd36e, 8], kafe: [0xff9f80, 7], ofis: [0x9cc3ff, 30], mehmonxona: [0xc6a7ff, 40], maktab: [0xffe08a, 14], masjid: [0x7fd6c2, 16], "bog'": [0x6fd17c, 1], zavod: [0xb8bec9, 18], boshqa: [0xe7e1cf, 10] };
const TYPE_ICON = { uy: '🏠', "do'kon": '🛒', kafe: '☕', ofis: '🏢', mehmonxona: '🏨', maktab: '🏫', masjid: '🕌', "bog'": '🌳', zavod: '🏭', boshqa: '📍' };
function plotObj(p) {
  const g = new THREE.Group();
  const w = p.x2 - p.x1, d = p.z2 - p.z1, cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2;
  const base = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: p.status === 'sold' ? 0xcfeec0 : 0xffe9a8, transparent: true, opacity: .85 }));
  base.rotation.x = -Math.PI / 2; base.position.set(cx, .6, cz); g.add(base);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, .1, d)), new THREE.LineBasicMaterial({ color: p.status === 'sold' ? 0x1fa463 : 0xe0a100 }));
  edges.position.set(cx, .7, cz); g.add(edges);
  let top = 4;
  if (p.status === 'sold') {
    const [col, h] = TYPE_STYLE[p.type] || TYPE_STYLE.boshqa;
    if (p.type === "bog'") {
      for (let i = 0; i < Math.min(30, p.area / 60); i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 6), new THREE.MeshLambertMaterial({ color: 0x4cbf5d })); t.position.set(p.x1 + Math.random() * w, 6, p.z1 + Math.random() * d); g.add(t); }
      top = 16;
    } else {
      const bw = Math.max(4, w * .75), bd = Math.max(4, d * .75);
      if (p.type === 'uy' || (p.style && p.style !== 'oddiy')) { // dizaynli bino: joy o'lchamiga moslab
        const hg = new THREE.Group(); const t = (HOUSE_BUILDERS[p.style] || HOUSE_BUILDERS.oddiy)(hg, hsl(p.color ?? 40));
        const sc = Math.max(.6, Math.min(bw / 24, bd / 18, 4)); hg.scale.setScalar(sc); hg.position.set(cx, 0, cz); g.add(hg);
        hg.traverse((o) => { if (o.isMesh) { o.userData = { kind: 'plot', p }; clickable.push(o); } });
        top = t * sc + 6;
      } else {
        const b = box(g, bw, h, bd, M(col), cx, 0, cz);
        box(g, bw + 1, 1.2, bd + 1, M(0x6b7a90), cx, h, cz);
        if (h >= 7) for (let y = 2; y < h - 2; y += 4) box(g, bw * .8, 2, bd + .2, GLASS, cx, y, cz);
        if (p.type === 'masjid') { const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(bw, bd) / 3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2aa3c9)); dome.position.set(cx, h + 1, cz); g.add(dome); }
        b.userData = { kind: 'plot', p }; clickable.push(b);
        top = h + 10;
      }
    }
  }
  base.userData = { kind: 'plot', p }; clickable.push(base);
  const l = label(`${TYPE_ICON[p.type] || ''} ${p.name}${p.status === 'pending' ? ' (kutilmoqda)' : ''}`, { size: 26, bg: p.status === 'sold' ? 'rgba(255,255,255,.95)' : 'rgba(255,233,168,.95)', scale: 1 });
  l.position.set(cx, top, cz); g.add(l);
  return g;
}

// ---- Holat ----
let state = { residents: [], plots: [], settings: {}, types: [] };
let me = store.get('me'); // {username,password}
async function refresh() {
  state = await api('/api/state');
  clickable.length = 0;
  objects.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  objects.clear();
  state.residents.forEach((r) => objects.add(house(r)));
  state.plots.forEach((p) => objects.add(plotObj(p)));
  $('count').textContent = `${state.residents.length} ta uy`;
  renderMe();
  checkUnread();
  loadWallet();
}
const myRes = () => me && state.residents.find((r) => r.username === me.username);
function renderMe() {
  const r = myRes();
  $('guest').classList.toggle('hidden', !!r);
  $('me').classList.toggle('hidden', !r);
  if (r) { $('mename').textContent = '@' + r.username; $('meaddr').textContent = [r.mahalla, r.street].filter(Boolean).join(', '); }
}
function flyTo(x, z, dist = 160) {
  const from = camera.position.clone(), fromT = controls.target.clone();
  const toT = new THREE.Vector3(x, 0, z), to = new THREE.Vector3(x, dist, z + dist * 1.1);
  let t = 0; const step = () => { t = Math.min(1, t + .03); const e = 1 - Math.pow(1 - t, 3); camera.position.lerpVectors(from, to, e); controls.target.lerpVectors(fromT, toT, e); if (t < 1) requestAnimationFrame(step); }; step();
}

// ---- Modal ----
function modal(html) { $('mbox').innerHTML = html; $('modal').classList.remove('hidden'); }
const closeModal = () => $('modal').classList.add('hidden');
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('npok')) closeModal(); });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => Number(v).toLocaleString('ru-RU') + ' ' + (state.settings.currency || "so'm");

// ---- Rejimlar: ko'chish va joy sotib olish ----
let mode = 'view', corner = null, preview = null;
const status = (t) => { $('status').textContent = t; $('status').classList.toggle('hidden', !t); };
function setMode(m) {
  mode = m; corner = null; if (preview) { scene.remove(preview); preview = null; }
  status(m === 'move' ? "🚚 Xaritada yangi uyingiz uchun ko'cha bo'yidagi joyni bosing (Esc — bekor)" : m === 'buy' ? '📐 Joyning birinchi burchagini bosing (Esc — bekor)' : '');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMode('view'); });

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function groundPoint(e) { mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera); const h = ray.intersectObject(ground)[0]; return h && h.point; }
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) onClick(e); });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'buy' || !corner) return; const p = groundPoint(e); if (!p) return;
  if (preview) scene.remove(preview);
  const w = Math.abs(p.x - corner.x), d = Math.abs(p.z - corner.z);
  preview = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, 1), Math.max(d, 1)), new THREE.MeshBasicMaterial({ color: 0x2f7cf6, transparent: true, opacity: .4 }));
  preview.rotation.x = -Math.PI / 2; preview.position.set((p.x + corner.x) / 2, .8, (p.z + corner.z) / 2); scene.add(preview);
  status(`📐 ${Math.round(w * d)} m² — ${money(Math.round(w * d) * state.settings.pricePerM2)}. Ikkinchi burchakni bosing`);
});

async function onClick(e) {
  const p = groundPoint(e);
  if (mode === 'move' && p) {
    const n = nearestRoad(p.x, p.z);
    if (!n || n.d > 80) return status("Yo'lga yaqinroq joyni tanlang (80 m ichida)");
    const dx = n.s.bx - n.s.ax, dz = n.s.bz - n.s.az, L = Math.hypot(dx, dz) || 1;
    const side = ((p.x - n.px) * -dz / L + (p.z - n.pz) * dx / L) >= 0 ? 1 : -1;
    const x = n.px - dz / L * 16 * side, z = n.pz + dx / L * 16 * side;
    const street = n.s.name || nearestStreetName(x, z), mahalla = nearestMahalla(x, z);
    modal(`<h3>Ko'chib o'tasizmi?</h3><div>📍 ${esc(mahalla || 'Noma\'lum mahalla')}${street ? ', ' + esc(street) : ''}</div><div class="row"><button class="ok" id="yes">Ha, ko'chaman</button><button class="ghost" id="nope">Yo'q</button></div>`);
    $('nope').onclick = closeModal;
    $('yes').onclick = async () => { try { await api('/api/move', { ...me, x, z, street, mahalla }); closeModal(); setMode('view'); await refresh(); flyTo(x, z); } catch (er) { alert(er.message); } };
    return;
  }
  if (mode === 'buy' && p) {
    if (!corner) { corner = p.clone(); return status('📐 Endi qarama-qarshi burchakni bosing'); }
    const x1 = corner.x, z1 = corner.z, x2 = p.x, z2 = p.z;
    const area = Math.round(Math.abs(x2 - x1) * Math.abs(z2 - z1));
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, street = nearestStreetName(cx, cz), mahalla = nearestMahalla(cx, cz);
    modal(`<h3>📐 Joy sotib olish</h3>
      <div>Maydon: <b>${area} m²</b> · Narx: <b>${money(area * state.settings.pricePerM2)}</b> · Hamyonda: <b>${money(wallet.balance)}</b><div class="muted">(1 m² = ${money(state.settings.pricePerM2)})</div></div>
      <div class="muted">📍 ${esc(mahalla)}${street ? ', ' + esc(street) : ''}</div>
      <label>Nima qurasiz?<select id="ptype">${state.types.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <input id="pname" placeholder="Nomi (masalan: Umid market)">
      <input id="pcontact" placeholder="Telefon raqamingiz (admin bog'lanishi uchun)">
      <div class="row"><button class="ok" id="send">Sotib olish so'rovini yuborish</button><button class="ghost" id="nope">Bekor</button></div>`);
    $('nope').onclick = () => { closeModal(); setMode('view'); };
    $('send').onclick = async () => {
      try {
        const j = await api('/api/plots/request', { ...me, x1, z1, x2, z2, type: $('ptype').value, name: $('pname').value, contact: $('pcontact').value, street, mahalla });
        modal(j.plot.status === 'sold' ? `<h3>✅ Joy sizniki!</h3><div>Pul hamyoningizdan yechildi. Binongiz xaritada qurildi — endi uni zamonaviy dizaynga o'zgartirishingiz mumkin.</div><button id="okk">Yaxshi</button>` : `<h3>✅ So'rov yuborildi</h3><div>Hamyoningizda pul yetarli emas. Admin to'lovni qabul qilgandan keyin joy sizniki bo'ladi.</div><button id="okk">Yaxshi</button>`);
        $('okk').onclick = closeModal; setMode('view'); await refresh();
      } catch (er) { alert(er.message); }
    };
    return;
  }
  // ko'rish rejimi: uy yoki binoni bosish
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(clickable)[0];
  if (hit?.object.userData.kind === 'house') {
    const r = hit.object.userData.r;
    if (myRes() && r.username === me.username) return openMyPanel();
    if (myRes()) return openChat(r.username);
    modal(`<div class="row" style="align-items:center"><img class="ava" src="/avatar/${encodeURIComponent(r.username)}" onerror="this.style.visibility='hidden'"><div><h3>@${esc(r.username)}</h3><div class="muted">${esc([r.mahalla, r.street].filter(Boolean).join(', '))}</div></div></div><div class="hint">Uy egasi bilan yozishish uchun saytga kiring (pastda).</div><button class="ghost" id="nope">Yopish</button>`);
    $('nope').onclick = closeModal;
  } else if (hit?.object.userData.kind === 'plot') {
    const pl = hit.object.userData.p;
    modal(`<h3>${TYPE_ICON[pl.type] || ''} ${esc(pl.name)}</h3><div>Egasi: <b>@${esc(pl.owner)}</b></div><div class="muted">${pl.area} m² · ${esc(pl.type)} · ${pl.status === 'sold' ? 'sotilgan' : "to'lov kutilmoqda"}</div><div class="muted">${esc([pl.mahalla, pl.street].filter(Boolean).join(', '))}</div><div class="row">${myRes() && pl.owner === me.username && pl.status === 'sold' ? '<button id="pup">🎨 Dizaynni o\'zgartirish</button>' : ''}${myRes() && pl.owner !== me.username ? '<button id="pchat">💬 Egasiga yozish</button>' : ''}<button class="ghost" id="nope">Yopish</button></div>`);
    $('nope').onclick = closeModal; if ($('pup')) $('pup').onclick = () => openDesigner(pl); if ($('pchat')) $('pchat').onclick = () => openChat(pl.owner);
  }
}

function askNewPass() {
  modal(`<h3>🔐 Yangi parol qo'ying</h3><div class="hint">Birinchi kirish: umumiy parolni o'zingizning parolingizga almashtiring. Keyin har doim shu yangi parol bilan kirasiz.</div>
    <input id="np1" type="password" placeholder="Yangi parol"><input id="np2" type="password" placeholder="Yangi parolni takrorlang"><button class="ok" id="npok">Saqlash</button>`);
  $('npok').onclick = async () => {
    if ($('np1').value !== $('np2').value) return alert('Parollar bir xil emas');
    try { await api('/api/change-password', { ...me, newPassword: $('np1').value }); me.password = $('np1').value; store.set('me', me); closeModal(); alert('✅ Parol saqlandi'); } catch (e) { alert(e.message); }
  };
}
// ---- Tugmalar ----
$('login').onclick = async () => {
  try { const j = await api('/api/claim', { username: $('lu').value, password: $('lp').value }); me = { username: j.resident.username, password: $('lp').value }; store.set('me', me); await refresh(); flyTo(j.resident.x, j.resident.z); if (j.mustChange) askNewPass(); }
  catch (er) { alert(er.message); }
};
$('logout').onclick = () => { me = null; store.set('me', null); renderMe(); setMode('view'); };
$('gohome').onclick = () => { const r = myRes(); if (r) flyTo(r.x, r.z); openMyPanel(); };
$('move').onclick = openMove;
$('buy').onclick = () => setMode('buy');
const doSearch = () => { const u = $('q').value.trim().replace(/^@/, '').toLowerCase(); const r = state.residents.find((x) => x.username === u) || state.residents.find((x) => x.username.includes(u)); if (r && u) flyTo(r.x, r.z); else alert('Topilmadi'); };
$('qbtn').onclick = doSearch; $('q').addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());


// ---- Hamyon, uy dizayni, mashina ----
let wallet = { balance: 0, tx: [], shop: { houses: {}, cars: {}, repaint: 0 }, plots: [] };
async function loadWallet() { if (!myRes()) return; try { wallet = await api('/api/me', me); $('bal').textContent = money(wallet.balance); } catch {} }
const STYLE_NAMES = { oddiy: '🏠 Oddiy', zamonaviy: '🏡 Zamonaviy', kottej: '🏘️ Kottej', villa: '🏝️ Villa', minora: '🏙️ Minora' };
const CAR_NAMES = { yoq: '— Mashinasiz', sedan: '🚗 Sedan', jeep: '🚙 Jip', sport: '🏎️ Sport', limuzin: '🚘 Limuzin' };
async function openMyPanel() {
  await loadWallet(); const r = myRes(); if (!r) return;
  modal(`<div class="row" style="align-items:center"><img class="ava" src="/avatar/${encodeURIComponent(r.username)}" onerror="this.style.visibility='hidden'"><div><h3>@${esc(r.username)}</h3><div class="muted">${esc([r.mahalla, r.street].filter(Boolean).join(', '))}</div></div></div>
    <div class="wallet">💰 Hamyon: <b>${money(wallet.balance)}</b></div>
    <div class="row"><button id="pdes">🎨 Uy va mashina</button><button id="pmove">🚚 Ko'chish</button><button id="pbuy">📐 Joy sotib olish</button></div>
    ${wallet.plots.length ? '<b>Mening joylarim</b>' + wallet.plots.map((p, i) => `<div class="conv" data-i="${i}">${esc(p.name)} · ${p.area} m² · ${p.status === 'sold' ? STYLE_NAMES[p.style] || p.style : '⏳ to\'lov kutilmoqda'}</div>`).join('') : ''}
    <details><summary class="muted">Hamyon tarixi</summary>${wallet.tx.map((t) => `<div class="muted">${fmtT(t.at)} · <b style="color:${t.amount > 0 ? '#1fa463' : '#e24b4b'}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</b> · ${esc(t.text)}</div>`).join('') || '<div class="muted">Bo\'sh</div>'}</details>
    <button class="ghost" id="nope">Yopish</button>`);
  $('nope').onclick = closeModal; $('pdes').onclick = () => openDesigner(null); $('pmove').onclick = openMove; $('pbuy').onclick = () => { closeModal(); setMode('buy'); };
  document.querySelectorAll('.conv[data-i]').forEach((el) => (el.onclick = () => { const p = wallet.plots[el.dataset.i]; flyTo((p.x1 + p.x2) / 2, (p.z1 + p.z2) / 2); if (p.status === 'sold') openDesigner(p); }));
}
function openDesigner(plot) {
  const r = myRes(), sh = wallet.shop, cur = plot || r;
  let sel = { style: cur.style || 'oddiy', color: cur.color ?? 40, car: r.car || 'yoq', carColor: r.carColor || 0 };
  const priceOf = () => { let c = 0; if (sel.style !== (cur.style || 'oddiy')) c += sh.houses[sel.style] || 0; if (!plot && sel.car !== (r.car || 'yoq')) c += sh.cars[sel.car] || 0; if (!c && (sel.color !== (cur.color ?? -1) || (!plot && sel.carColor !== (r.carColor ?? -1)))) c = sh.repaint; return c; };
  const render = () => {
    modal(`<h3>🎨 ${plot ? esc(plot.name) : 'Uyim'} — dizayn</h3><div class="wallet">💰 Hamyon: <b>${money(wallet.balance)}</b></div>
      <b>Dizayn</b><div class="picks">${Object.entries(sh.houses).map(([k, v]) => `<button class="pick ${sel.style === k ? 'on' : ''}" data-s="${esc(k)}">${STYLE_NAMES[k] || esc(k)}<small>${k === (cur.style || 'oddiy') ? 'hozirgi' : v ? money(v) : 'bepul'}</small></button>`).join('')}</div>
      <label>Rang <input type="range" id="hue" min="0" max="360" value="${sel.color}"></label>
      ${plot ? '' : `<b>Mashina</b><div class="picks">${Object.entries(sh.cars).map(([k, v]) => `<button class="pick ${sel.car === k ? 'on' : ''}" data-c="${esc(k)}">${CAR_NAMES[k] || esc(k)}<small>${k === (r.car || 'yoq') ? 'hozirgi' : v ? money(v) : 'bepul'}</small></button>`).join('')}</div>
      <label>Mashina rangi <input type="range" id="chue" min="0" max="360" value="${sel.carColor}"></label>`}
      <div>Narxi: <b id="cost">${money(priceOf())}</b></div>
      <div class="row"><button class="ok" id="dbuy">Sotib olish va o'zgartirish</button><button class="ghost" id="nope">Yopish</button></div>`);
    document.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { sel.style = b.dataset.s; render(); }));
    document.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { sel.car = b.dataset.c; render(); }));
    $('hue').oninput = (e) => { sel.color = +e.target.value; $('cost').textContent = money(priceOf()); };
    if ($('chue')) $('chue').oninput = (e) => { sel.carColor = +e.target.value; $('cost').textContent = money(priceOf()); };
    $('nope').onclick = closeModal;
    $('dbuy').onclick = async () => {
      try { await api('/api/upgrade', { ...me, plotId: plot?.id, ...sel }); await refresh(); await loadWallet(); closeModal(); const p = plot ? [(plot.x1 + plot.x2) / 2, (plot.z1 + plot.z2) / 2] : [r.x, r.z]; flyTo(p[0], p[1], 90); }
      catch (e) { alert(e.message); }
    };
  };
  render();
}
// ---- Ko'chish: xaritadan yoki manzil bo'yicha ----
function openMove() {
  const mahs = [...new Set(places.map((p) => p.name))].sort();
  modal(`<h3>🚚 Qayerga ko'chasiz?</h3>
    <button id="mmap">🗺️ Xaritadan tanlash</button>
    <div class="muted" style="text-align:center">yoki manzilni kiriting</div>
    <input id="mmah" list="mahl" placeholder="Mahalla"><datalist id="mahl">${mahs.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <input id="mstr" list="strl" placeholder="Ko'cha nomi"><datalist id="strl">${streetNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row"><button class="ok" id="maddr">Shu manzilga ko'chish</button><button class="ghost" id="nope">Bekor</button></div>`);
  $('nope').onclick = closeModal;
  $('mmap').onclick = () => { closeModal(); setMode('move'); flyTo(controls.target.x, controls.target.z, 900); };
  $('maddr').onclick = async () => {
    const st = $('mstr').value.trim().toLowerCase(), mh = $('mmah').value.trim().toLowerCase();
    let cand = st ? segments.filter((s) => s.name && s.name.toLowerCase() === st) : [];
    if (st && !cand.length) cand = segments.filter((s) => s.name && s.name.toLowerCase().includes(st));
    const mp = mh && places.find((p) => p.name.toLowerCase().includes(mh));
    if (!cand.length && mp) { const n = nearestRoad(mp.x, mp.z); if (n) cand = [n.s]; }
    if (!cand.length) return alert("Bunday ko'cha yoki mahalla topilmadi");
    if (mp) cand.sort((a, b) => Math.hypot((a.ax + a.bx) / 2 - mp.x, (a.az + a.bz) / 2 - mp.z) - Math.hypot((b.ax + b.bx) / 2 - mp.x, (b.az + b.bz) / 2 - mp.z));
    // band bo'lmagan joy: uylar orasida kamida 25 m
    for (const sg of cand.slice(0, 60)) for (let t = .15; t < 1; t += .2) for (const side of [1, -1]) {
      const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, L = Math.hypot(dx, dz) || 1;
      const x = sg.ax + dx * t - dz / L * 16 * side, z = sg.az + dz * t + dx / L * 16 * side;
      if (state.residents.some((r) => r.username !== me.username && Math.hypot(r.x - x, r.z - z) < 25)) continue;
      try { await api('/api/move', { ...me, x, z, street: sg.name || nearestStreetName(x, z), mahalla: nearestMahalla(x, z) }); closeModal(); await refresh(); flyTo(x, z); } catch (e) { alert(e.message); }
      return;
    }
    alert("Bu ko'chada bo'sh joy qolmagan — xaritadan tanlang");
  };
}
// ---- CHAT (Instagram uslubida) ----
let chatWith = null, chatTimer = null, chatCount = -1;
const fmtT = (t) => new Date(t).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const ava = (u, cls = 'ava') => `<img class="${cls}" src="/avatar/${encodeURIComponent(u)}" onerror="this.outerHTML='<span class=&quot;${cls} ph&quot;>${esc(u[0] || '?').toUpperCase()}</span>'">`;
function msgHtml(m) {
  const mine = m.from === me.username;
  let body = esc(m.text || '');
  if (m.type === 'image') body = `<a href="${esc(m.url)}" target="_blank"><img class="mimg" src="${esc(m.url)}" loading="lazy"></a>` + (m.text ? `<div>${esc(m.text)}</div>` : '');
  if (m.type === 'video') body = `<video class="mimg" src="${esc(m.url)}" controls preload="metadata"></video>` + (m.text ? `<div>${esc(m.text)}</div>` : '');
  if (m.type === 'location') body = `<a class="mloc" href="https://maps.google.com/?q=${m.lat},${m.lon}" target="_blank" rel="noopener">📍 <b>Lokatsiya</b><br><small>${esc(m.label || `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}`)}</small><br><small>Xaritada ochish →</small></a>`;
  return `<div class="bub ${mine ? 'mine' : ''} ${m.type !== 'text' ? 'media' : ''}">${body}<small>${fmtT(m.at)}${mine ? (m.read ? ' · ✓✓' : ' · ✓') : ''}</small></div>`;
}
async function loadChat(scroll) {
  if (!chatWith || !$('msgs')) return;
  const { messages } = await api('/api/chat/history', { ...me, with: chatWith });
  if (messages.length === chatCount && !scroll) return; chatCount = messages.length;
  const box = $('msgs'), atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  box.innerHTML = messages.map(msgHtml).join('') || `<div class="empty">${ava(chatWith, 'ava big')}<b>@${esc(chatWith)}</b><div class="muted">Hali xabar yo'q — birinchi bo'lib yozing!</div></div>`;
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
}
function openChat(u) {
  if (!myRes()) return alert('Yozishish uchun avval saytga kiring');
  chatWith = u; chatCount = -1;
  const r = state.residents.find((x) => x.username === u);
  $('chat').innerHTML = `<div class="chead"><button class="ghost" id="cback">←</button>${ava(u)}<div><b>@${esc(u)}</b><div class="muted">${esc([r?.mahalla, r?.street].filter(Boolean).join(', '))}</div></div><button class="ghost" id="cfly" title="Uyini ko'rish">🏠</button><button class="ghost" id="cclose">✕</button></div>
    <div class="msgs" id="msgs"></div>
    <div class="cbar"><label class="cbtn" title="Rasm yoki video">📷<input type="file" id="cfile" accept="image/*,video/*" hidden></label><button class="cbtn" id="cloc" title="Lokatsiya">📍</button><input id="mtext" placeholder="Xabar yozing…" maxlength="2000"><button id="msend">➤</button></div>`;
  $('chat').classList.remove('hidden'); closeModal();
  const send = async (extra) => { try { await api('/api/chat/send', { ...me, to: u, text: $('mtext').value.trim(), ...extra }); $('mtext').value = ''; await loadChat(true); } catch (e) { alert(e.message); } };
  $('msend').onclick = () => $('mtext').value.trim() && send();
  $('mtext').addEventListener('keydown', (e) => e.key === 'Enter' && $('mtext').value.trim() && send());
  $('cfile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 20e6) return alert('Fayl 20 MB dan katta');
    const rd = new FileReader(); $('msend').textContent = '⏳';
    rd.onload = async () => { await send({ file: { type: f.type, data: rd.result } }); $('msend').textContent = '➤'; $('cfile').value = ''; };
    rd.readAsDataURL(f);
  };
  $('cloc').onclick = () => {
    if (!navigator.geolocation) return alert('Brauzer lokatsiyani bermaydi');
    navigator.geolocation.getCurrentPosition((p) => send({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Mening joylashuvim' }), () => alert('Lokatsiyaga ruxsat berilmadi'), { enableHighAccuracy: true, timeout: 15000 });
  };
  $('cback').onclick = () => { closeChat(); openInbox(); };
  $('cclose').onclick = closeChat;
  $('cfly').onclick = () => { if (r) { closeChat(); flyTo(r.x, r.z, 90); } };
  loadChat(true); clearInterval(chatTimer); chatTimer = setInterval(() => loadChat(), 3000);
  $('mtext').focus();
}
function closeChat() { $('chat').classList.add('hidden'); clearInterval(chatTimer); chatWith = null; checkUnread(); }
async function openInbox() {
  const { conversations } = await api('/api/chat/inbox', me);
  modal(`<h3>💬 Xabarlar</h3><input id="isearch" placeholder="🔍 Nik bo'yicha qidirish va yozish">
    <div id="ilist">${conversations.map((c) => `<div class="conv row" style="align-items:center;flex-wrap:nowrap" data-u="${esc(c.with)}">${ava(c.with)}<div style="flex:1;min-width:0"><b>@${esc(c.with)}</b> ${c.unread ? `<span class="count">${c.unread}</span>` : ''}<div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.last.slice(0, 80))} · ${fmtT(c.at)}</div></div></div>`).join('') || '<div class="muted">Hali yozishmalar yo\'q. Xaritadagi istalgan uyni bosing yoki yuqorida nikni qidiring.</div>'}</div>
    <button class="ghost" id="nope">Yopish</button>`);
  $('nope').onclick = closeModal;
  document.querySelectorAll('.conv[data-u]').forEach((el) => (el.onclick = () => openChat(el.dataset.u)));
  $('isearch').oninput = (e) => {
    const q = e.target.value.trim().replace(/^@/, '').toLowerCase(); if (!q) return;
    const found = state.residents.filter((r) => r.username.includes(q) && r.username !== me.username).slice(0, 8);
    $('ilist').innerHTML = found.map((r) => `<div class="conv row" style="align-items:center" data-u="${esc(r.username)}">${ava(r.username)}<b>@${esc(r.username)}</b></div>`).join('') || '<div class="muted">Topilmadi</div>';
    document.querySelectorAll('.conv[data-u]').forEach((el) => (el.onclick = () => openChat(el.dataset.u)));
  };
}
async function checkUnread() {
  if (!myRes()) return;
  try { const { conversations } = await api('/api/chat/inbox', me); const n = conversations.reduce((a, c) => a + c.unread, 0); $('unr').textContent = n; $('unr').classList.toggle('hidden', !n); } catch {}
}
setInterval(checkUnread, 10000);
$('inbox').onclick = openInbox;

// ---- Animatsiya ----
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let frame = 0;
(function loop() {
  requestAnimationFrame(loop); controls.update();
  if (frame++ % 15 === 0) { const t = controls.target, h = camera.position.y; for (const l of streetLabels) l.visible = h < 1100 && Math.hypot(l.position.x - t.x, l.position.z - t.z) < h * 1.8; for (const l of placeLabels) l.visible = l.userData.big || h < 2600; }
  renderer.render(scene, camera);
})();

// ---- Boshlash ----
(async () => {
  refresh().catch(() => {});
  const data = await loadOSM();
  if (data) { buildRoads(data); status(''); }
  else { buildRoads(fallbackGrid()); status("⚠️ OpenStreetMap ma'lumoti yuklanmadi — namunaviy to'r ko'rsatilmoqda"); }
  await refresh().catch(() => status('Server bilan aloqa yo\'q'));
  setInterval(() => mode === 'view' && refresh().catch(() => {}), 30000);
})();

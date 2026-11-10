// Shahrisabz Online Shahar — oddiy Node.js server (tashqi kutubxonasiz)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'umid0229';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'umid0229';
const FOLLOW_SECRET = process.env.FOLLOW_SECRET || 'follow-secret';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUB = path.join(__dirname, 'public');

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { residents: [], plots: [], notifications: [], settings: { pricePerM2: 50000, currency: "so'm" }, edgeCounter: 0 }; }
}
let db = loadDb();
db.messages ||= [];
db.tx ||= [];
db.customPlaces ||= [];
db.houses ||= []; // qo'shimcha (sotib olingan) uylar: {id, owner, x, z, style, colorHex, mahalla, street, no}
db.offers ||= [];
db.topups ||= []; // balans to'ldirish so'rovlari
db.group ||= []; // umumiy chat (hamma uchun bitta)
// Sahifa egasining akkaunti (bir marta yaratiladi; parolni keyin saytda o'zgartirish mumkin)
const OWNER = 'shahrisabz.online.shahar';
setTimeout(() => ensureOwner(), 0);
function ensureOwner() {
  let r = db.residents.find((x) => x.username === OWNER);
  if (!r) { r = { id: id(), username: OWNER, link: 'https://instagram.com/' + OWNER, x: 0, z: 0, rot: 0, mahalla: 'Markaz', street: '', color: 210, createdAt: Date.now(), source: 'owner' }; db.residents.push(r); }
  if (process.env.OWNER_PASSWORD && r.ownerPassSrc !== hash(process.env.OWNER_PASSWORD)) { r.pass = hash(process.env.OWNER_PASSWORD); r.ownerPassSrc = r.pass; r.mustChange = false; r.ownerInit = true; } // parol faqat Railway OWNER_PASSWORD dan
  r.owner = true; r.style = 'mega'; r.lot = true; save(); if (ROADS) placeOwner();
}
db.settings.payment ||= { cards: [], note: "Pulni o'tkazgach, chek skrinshotini yuklang. Admin tekshirib, balansingizni to'ldiradi.", min: 10000 };
const TOPUPS = path.join(__dirname, 'data', 'topups'); // sotish takliflari // admin qo'lda joylashtirgan mahalla/ko'chalar
db.settings.pricePerSotix ||= (db.settings.pricePerM2 || 50000) * 100; // 1 sotix = 100 m²
db.settings.shop ||= {
  houses: { oddiy: 0, zamonaviy: 5000000, kottej: 12000000, villa: 25000000, minora: 50000000 },
  cars: { yoq: 0, sedan: 3000000, jeep: 7000000, sport: 15000000, limuzin: 30000000 },
  repaint: 200000,
  build: 10000000, // sotib olingan joyga uy qurish narxi (tekin uy faqat birinchi uy)
};
db.settings.shop.build ??= 10000000;
// Bino turlari katalogi (uy o'rniga yoki sotib olingan joyga): n — nomi, i — belgi, m — 3D model, p — narx
db.settings.shop.buildings ||= {
  dokon: { n: "Do'kon", i: '🛒', m: 'shop', p: 8000000 }, supermarket: { n: 'Supermarket', i: '🏬', m: 'market', p: 40000000 },
  bozor: { n: 'Dehqon bozori', i: '🧺', m: 'bazaar', p: 60000000 }, kafe: { n: 'Kafe', i: '☕', m: 'cafe', p: 12000000 },
  choyxona: { n: 'Choyxona', i: '🫖', m: 'chaikhana', p: 15000000 }, restoran: { n: 'Restoran', i: '🍽️', m: 'restaurant', p: 30000000 },
  toyxona: { n: "To'yxona", i: '💒', m: 'wedding', p: 70000000 }, mehmonxona: { n: 'Mehmonxona', i: '🏨', m: 'hotel', p: 90000000 },
  dorixona: { n: 'Dorixona', i: '💊', m: 'pharmacy', p: 10000000 }, shifoxona: { n: 'Shifoxona / klinika', i: '🏥', m: 'hospital', p: 120000000 },
  maktab: { n: 'Maktab', i: '🏫', m: 'school', p: 80000000 }, bogcha: { n: "Bog'cha", i: '🧸', m: 'kinder', p: 50000000 },
  bank: { n: 'Bank', i: '🏦', m: 'bank', p: 150000000 }, ofis: { n: 'Ofis markazi', i: '🏢', m: 'office', p: 100000000 },
  hokimlik: { n: 'Hokimlik binosi', i: '🏛️', m: 'govt', p: 300000000 }, masjid: { n: 'Masjid', i: '🕌', m: 'mosque', p: 100000000 },
  yoqilgi: { n: "Yoqilg'i quyish shoxobchasi", i: '⛽', m: 'gas', p: 60000000 }, avtosalon: { n: 'Avtosalon', i: '🚘', m: 'carshow', p: 80000000 },
  sport: { n: 'Sport zal', i: '🏋️', m: 'gym', p: 35000000 }, stadion: { n: 'Stadion', i: '🏟️', m: 'stadium', p: 250000000 },
  kinoteatr: { n: 'Kinoteatr', i: '🎬', m: 'cinema', p: 70000000 }, park: { n: "Park / bog'", i: '🌳', m: 'park', p: 20000000 },
  zavod: { n: 'Zavod / sex', i: '🏭', m: 'factory', p: 120000000 }, ustaxona: { n: 'Avto ustaxona', i: '🔧', m: 'garage', p: 15000000 },
};
// Shahrisabzga xos qo'shimcha turlar (mavjud bazaga ham qo'shiladi)
for (const [k, v] of Object.entries({
  hunarmand: { n: 'Hunarmandchilik ustaxonasi', i: '🛠️', m: 'workshop', p: 12000000 }, kashtachilik: { n: "Kashtachilik do'koni", i: '🧵', m: 'shop', p: 10000000 },
  kulolchilik: { n: 'Kulolchilik ustaxonasi', i: '🏺', m: 'workshop', p: 12000000 }, nonvoyxona: { n: 'Nonvoyxona', i: '🍞', m: 'bakery', p: 9000000 },
  qassobxona: { n: 'Qassobxona', i: '🥩', m: 'shop', p: 9000000 }, mehmonuy: { n: 'Mehmon uyi (guesthouse)', i: '🛏️', m: 'guesthouse', p: 35000000 },
  suvenir: { n: "Suvenir do'koni", i: '🎁', m: 'shop', p: 10000000 }, tikuvchilik: { n: 'Tikuvchilik sexi', i: '🪡', m: 'workshop', p: 18000000 },
  avtobekat: { n: 'Avtobus bekati', i: '🚏', m: 'busstop', p: 3000000 }, pochta: { n: 'Pochta', i: '📮', m: 'office', p: 40000000 },
  notarius: { n: 'Notarius idorasi', i: '📜', m: 'shop', p: 15000000 }, zags: { n: 'FHDYo (ZAGS)', i: '💍', m: 'govt', p: 120000000 },
  gazxizmat: { n: 'Gaz xizmati idorasi', i: '🔥', m: 'office', p: 60000000 }, elektr: { n: 'Elektr tarmoqlari idorasi', i: '⚡', m: 'office', p: 60000000 },
  sartaroshxona: { n: 'Sartaroshxona', i: '💈', m: 'shop', p: 7000000 }, gozallik: { n: 'Go\'zallik saloni', i: '💅', m: 'shop', p: 9000000 },
  kitob: { n: "Kitob do'koni", i: '📚', m: 'shop', p: 9000000 }, telefon: { n: "Telefon do'koni", i: '📱', m: 'shop', p: 15000000 },
  qurilish: { n: 'Qurilish mollari', i: '🧱', m: 'market', p: 35000000 }, moyka: { n: 'Avtomoyka', i: '🚿', m: 'garage', p: 14000000 },
  oquvmarkaz: { n: "O'quv markazi", i: '🎓', m: 'school', p: 45000000 }, kollej: { n: 'Kollej / texnikum', i: '🏫', m: 'school', p: 90000000 },
  muzey: { n: 'Muzey', i: '🏛️', m: 'govt', p: 150000000 }, poliklinika: { n: 'Poliklinika', i: '🩺', m: 'hospital', p: 90000000 },
  militsiya: { n: 'Profilaktika inspektori punkti', i: '👮', m: 'shop', p: 20000000 }, yongin: { n: "Yong'in xavfsizligi qismi", i: '🚒', m: 'garage', p: 80000000 },
  temiryol: { n: 'Temir yo\'l vokzali', i: '🚉', m: 'govt', p: 200000000 }, avtovokzal: { n: 'Avtovokzal', i: '🚌', m: 'carshow', p: 120000000 },
})) db.settings.shop.buildings[k] ??= v;
'abcdefghijklmnopqrstu'.split('').forEach((c, i) => { db.settings.shop.houses['uy_' + c] ??= 4000000 + i * 1500000; }); // Kenney uylari (21 ta)
const MODELS = ['busstop', 'workshop', 'guesthouse', 'bakery', 'shop', 'market', 'bazaar', 'cafe', 'chaikhana', 'restaurant', 'wedding', 'hotel', 'pharmacy', 'hospital', 'school', 'kinder', 'bank', 'office', 'govt', 'mosque', 'gas', 'carshow', 'gym', 'stadium', 'cinema', 'park', 'factory', 'garage'];
const stylePrice = (st) => { const sh = db.settings.shop; if (String(st).startsWith('b:')) { const bb = sh.buildings[st.slice(2)]; return bb ? bb.p : null; } return st in sh.houses ? sh.houses[st] : null; };
db.dmQueue ||= [];
db.settings.defaultPass ||= '2026';
if (db.settings.defaultPass === 'shahrisabz2026') { // eski umumiy parol → 2026 (parolini almashtirmaganlar uchun ham)
  db.settings.defaultPass = '2026';
  const oldH = crypto.createHash('sha256').update('shs:shahrisabz2026').digest('hex');
  for (const r of db.residents) if (r.mustChange || r.pass === oldH) { r.pass = crypto.createHash('sha256').update('shs:2026').digest('hex'); r.mustChange = true; }
}
db.settings.watcher ||= { sessionid: '', username: 'shahrisabz.online.shahar', pk: '', initialized: false, lastCheck: 0, lastError: '' };
db.settings.instagram ||= { token: '', igUserId: '', verifyToken: '', username: '', lastSync: 0 };
const IG_APP_ID = process.env.IG_APP_ID || '';
const IG_APP_SECRET = process.env.IG_APP_SECRET || '';
const BASE_URL = process.env.BASE_URL || ''; // masalan https://shahrisabz.online
const oauthStates = new Set();
function save() { fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
const adminTokens = new Set();
const id = () => crypto.randomBytes(6).toString('hex');
const hash = (s) => crypto.createHash('sha256').update('shs:' + s).digest('hex');
const cleanName = (u) => String(u || '').trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);

// Yangi obunachi uchun shahar chekkasida joy: aylana bo'ylab, har aylanada radius kattalashadi
function edgeSpot() {
  const n = db.edgeCounter++;
  const perRing = 60, ring = Math.floor(n / perRing), k = n % perRing;
  const r = 3300 + ring * 60; // metr, markazdan
  const a = (k / perRing) * Math.PI * 2 + ring * 0.05;
  return { x: Math.round(Math.cos(a) * r), z: Math.round(Math.sin(a) * r) };
}

const genPass = () => String(crypto.randomInt(100000, 1000000));
const SITE = () => process.env.BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '');
const passText = (r) => `Assalomu alaykum, @${r.username}! 🏠 Sizning uyingiz tayyor — Shahrisabz online shahrida!\nSayt: ${SITE() || 'saytimiz'}\nLogin: ${r.username}\nParol: ${r.mustChange ? db.settings.defaultPass : '(o\'zingiz qo\'ygan parol)'}\n⚠️ Saytga birinchi kirganingizda parolni o'zgartiring!`;
function addFollower(username, source, pk) {
  const u = cleanName(username);
  if (!u) return null;
  let r = db.residents.find((x) => x.username === u);
  if (r) return r;
  const s = autoLot() || edgeSpot();
  const pw = db.settings.defaultPass;
  r = { id: id(), username: u, link: 'https://instagram.com/' + u, x: s.x, z: s.z, rot: s.rot || 0, lot: !!ROADS && s.rot !== undefined, mahalla: 'Shahar chekkasi', street: s.street || '', color: Math.floor(Math.random() * 360), createdAt: Date.now(), source, pass: hash(pw), initialPass: pw, mustChange: true, delivered: false };
  if (pk) r.pk = String(pk);
  db.residents.push(r);
  save();
  return r;
}

const pub = (r) => ({ owner: !!r.owner, bname: r.bname || '', balance: r.balance || 0, rot: r.rot || 0, no: r.no || '', homeless: !!r.homeless, id: r.id, username: r.username, link: r.link, x: r.x, z: r.z, mahalla: r.mahalla, street: r.street, color: r.color, style: r.style || 'oddiy', colorHex: r.colorHex || null, cars: (r.cars || (r.car && r.car !== 'yoq' ? [{ t: r.car, c: hueHex(r.carColor || 0) }] : [])).map((c) => ({ t: c.t, c: c.c })), avatar: !!r.avatar, claimed: !!r.lastLogin });
const pubPlot = (p) => ({ bname: p.bname || '', built: p.built !== false, no: p.no || '', colorHex: p.colorHex || null, sotix: p.sotix || Math.round(p.area / 10) / 10, style: p.style || 'oddiy', color: p.color ?? 40, id: p.id, owner: p.owner, x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, area: p.area, price: p.price, type: p.type, name: p.name, status: p.status, mahalla: p.mahalla, street: p.street });

function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 30e6) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
}
function userAuth(b) {
  const r = db.residents.find((x) => x.username === cleanName(b.username));
  if (!r || !r.pass || r.pass !== hash(b.password || '')) return null;
  return r;
}
const ADMIN_TOKEN = crypto.createHmac('sha256', 'shs-admin:' + FOLLOW_SECRET).update(ADMIN_LOGIN + ':' + ADMIN_PASSWORD).digest('hex');
const isAdmin = (req) => req.headers['x-admin-token'] === ADMIN_TOKEN;
function overlaps(a) {
  return db.plots.some((p) => p.status !== 'rejected' && a.x1 < p.x2 && a.x2 > p.x1 && a.z1 < p.z2 && a.z2 > p.z1);
}


// ---- Instagram Graph API (admin paneldan ulanadi) ----
async function igGet(pathq) {
  const ig = db.settings.instagram;
  if (!ig.token || !ig.igUserId) throw new Error('Avval Instagram token va akkaunt ID ni kiriting');
  const base = ig.kind === 'instagram' ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
  const r = await fetch(`${base}/${pathq}${pathq.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(ig.token)}`);
  const j = await r.json();
  if (j.error) throw new Error('Instagram: ' + j.error.message);
  return j;
}
// Instagram API obunachilar ro'yxatini bermaydi, shuning uchun postlarga komment yozganlarga uy quriladi
async function igSync() {
  const media = await igGet(`${db.settings.instagram.igUserId}/media?fields=id&limit=25`);
  const added = [];
  for (const md of media.data || []) {
    const c = await igGet(`${md.id}/comments?fields=username&limit=100`);
    for (const x of c.data || []) { const before = db.residents.length; const r = addFollower(x.username, 'instagram'); if (r && db.residents.length > before) added.push(r.username); }
  }
  db.settings.instagram.lastSync = Date.now(); save();
  return { ok: true, added };
}
setInterval(() => { if (db.settings.instagram.token) igSync().catch((e) => console.log(e.message)); }, 10 * 60 * 1000);

// ---- Instagram Business Login (OAuth): admin "Instagram bilan ulash" ni bosadi ----
const redirectUri = (req) => (BASE_URL || `http://${req.headers.host}`) + '/api/instagram/callback';
async function refreshIgToken() {
  const ig = db.settings.instagram;
  if (ig.kind !== 'instagram' || !ig.token) return;
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(ig.token)}`);
  const j = await r.json(); if (j.access_token) { ig.token = j.access_token; ig.expiresAt = Date.now() + j.expires_in * 1000; save(); }
}
setInterval(() => refreshIgToken().catch(() => {}), 24 * 3600 * 1000);

// ---- Xarita ma'lumoti: server bir marta OpenStreetMap'dan yuklab, data/osm.json da saqlaydi ----
const OSM_FILE = path.join(__dirname, 'data', 'osm-v4.json');
const OSM_BBOX = '38.90,66.62,39.22,67.05'; // tuman: katta yo'llar va qishloqlar
const CITY_BBOX = '39.00,66.76,39.11,66.89'; // shahar: barcha ko'chalar
let osmLoading = null;
async function getOsm() {
  if (fs.existsSync(OSM_FILE)) return fs.readFileSync(OSM_FILE);
  const bundled = path.join(PUB, 'osm.json'); if (fs.existsSync(bundled)) return fs.readFileSync(bundled);
  if (osmLoading) return osmLoading;
  osmLoading = (async () => {
    const q = `[out:json][timeout:170];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian|road)$"](${CITY_BBOX});way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${OSM_BBOX}););out geom;(nwr["place"~"^(suburb|quarter|neighbourhood|city_block|village|hamlet|isolated_dwelling|locality|town)$"](${OSM_BBOX}););out center tags;`;
    const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
    for (const u of mirrors) {
      try {
        const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'shahrisabz-online-shahar' }, signal: AbortSignal.timeout(200000) });
        if (!r.ok) { console.log('OSM', u, r.status); continue; }
        const j = await r.json();
        const out = { ways: [], places: [] };
        for (const e of j.elements) {
          if (e.type === 'way' && e.geometry) out.ways.push({ t: e.tags.highway, n: e.tags['name:uz'] || e.tags.name || '', g: e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
          else if (e.tags?.name && (e.lat || e.center)) out.places.push({ n: e.tags['name:uz'] || e.tags.name, k: e.tags.place || 'mahalla', lat: e.lat ?? e.center.lat, lon: e.lon ?? e.center.lon });
        }
        if (!out.ways.length) continue;
        const buf = Buffer.from(JSON.stringify(out));
        fs.mkdirSync(path.dirname(OSM_FILE), { recursive: true }); fs.writeFileSync(OSM_FILE, buf);
        console.log(`OSM saqlandi: ${out.ways.length} yo'l, ${out.places.length} mahalla`); buildRoads(buf);
        return buf;
      } catch (e) { console.log('OSM xato', u, e.message); }
    }
    return null;
  })().finally(() => { osmLoading = null; });
  return osmLoading;
}
getOsm().then((b) => b && buildRoads(b)).catch(() => {}); // server ishga tushganda oldindan yuklab qo'yadi
// ---- Ochiq ma'lumot: Shahrisabzdagi nomli joylar (OSM, ODbL) — xaritada faqat ma'lumot belgisi, sotilmaydi ----
const POI_FILE = path.join(__dirname, 'data', 'pois.json');
const POI_ICON = (t) => {
  const a = t.amenity, sh = t.shop, tr = t.tourism, h = t.historic, l = t.leisure, o = t.office, hc = t.healthcare, cr = t.craft;
  if (h || tr === 'attraction' || tr === 'museum') return ['🏛️', h === 'memorial' || h === 'monument' ? 'Yodgorlik' : tr === 'museum' ? 'Muzey' : 'Tarixiy joy'];
  if (tr === 'hotel' || tr === 'guest_house' || tr === 'hostel') return ['🏨', 'Mehmonxona'];
  if (a === 'place_of_worship') return ['🕌', 'Masjid / ibodatxona'];
  if (a === 'school') return ['🏫', 'Maktab']; if (a === 'kindergarten') return ['🧸', "Bog'cha"]; if (a === 'college' || a === 'university') return ['🎓', "O'quv yurti"];
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || hc) return ['🏥', 'Tibbiyot']; if (a === 'pharmacy') return ['💊', 'Dorixona'];
  if (a === 'bank' || a === 'atm') return ['🏦', 'Bank']; if (a === 'post_office') return ['📮', 'Pochta'];
  if (a === 'townhall' || o === 'government' || a === 'courthouse' || a === 'police') return ['🏢', 'Davlat idorasi'];
  if (a === 'restaurant') return ['🍽️', 'Restoran']; if (a === 'cafe') return ['☕', 'Kafe']; if (a === 'fast_food') return ['🍔', 'Tezkor ovqat'];
  if (a === 'marketplace') return ['🧺', 'Bozor']; if (a === 'fuel') return ['⛽', "Yoqilg'i"]; if (a === 'bus_station') return ['🚌', 'Avtovokzal'];
  if (sh === 'supermarket' || sh === 'mall') return ['🏬', 'Supermarket']; if (sh) return ['🛒', "Do'kon"];
  if (l === 'park' || l === 'garden') return ['🌳', 'Park']; if (l === 'stadium' || l === 'sports_centre') return ['🏟️', 'Sport'];
  if (cr) return ['🛠️', 'Ustaxona']; if (o) return ['🏢', 'Idora'];
  return ['📍', 'Joy'];
};
let poiLoading = null, weather = null;
async function loadPois() {
  if (fs.existsSync(POI_FILE) || poiLoading) return;
  poiLoading = (async () => {
    const q = `[out:json][timeout:120];(nwr["name"]["amenity"](${CITY_BBOX});nwr["name"]["shop"](${CITY_BBOX});nwr["name"]["tourism"](${CITY_BBOX});nwr["name"]["historic"](${CITY_BBOX});nwr["name"]["leisure"](${CITY_BBOX});nwr["name"]["office"](${CITY_BBOX});nwr["name"]["craft"](${CITY_BBOX});nwr["name"]["healthcare"](${CITY_BBOX}););out center tags;`;
    for (const u of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
      try {
        const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'shahrisabz-online-shahar' }, signal: AbortSignal.timeout(150000) });
        if (!r.ok) continue; const j = await r.json(); const out = [];
        for (const e of j.elements) { const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon; if (!lat || !e.tags?.name) continue; const [i, c] = POI_ICON(e.tags); out.push({ n: e.tags['name:uz'] || e.tags.name, i, c, lat: +lat.toFixed(6), lon: +lon.toFixed(6), a: [e.tags['addr:street'], e.tags['addr:housenumber']].filter(Boolean).join(' ') }); }
        fs.mkdirSync(path.dirname(POI_FILE), { recursive: true }); fs.writeFileSync(POI_FILE, JSON.stringify({ manba: '© OpenStreetMap hissadorlari (ODbL)', joylar: out }));
        console.log(`Joylar (POI) saqlandi: ${out.length} ta`); return;
      } catch (e) { console.log('POI xato', e.message); }
    }
  })().finally(() => { poiLoading = null; });
}
setTimeout(() => loadPois(), 20000); setInterval(() => loadPois(), 15 * 60 * 1000);
// ---- Shahrisabzning haqiqiy binolari (OSM building=*): shakli, qavatlar, balandlik — faqat bezak, sotilmaydi ----
const BLD_FILE = path.join(__dirname, 'data', 'buildings-v1.json');
let bldLoading = null, BLDG = null; // BLDG — bino markazlari panjarasi (uylar ustiga tushmasligi uchun)
function indexBuildings(buf) {
  try {
    const j = JSON.parse(buf), grid = new Map(); let n = 0;
    for (const b of j.b) { const pts = b.g.map(([la, lo]) => toXZ(la, lo)); let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
      const r = Math.max(...pts.map(([x, z]) => Math.hypot(x - cx, z - cz))); const k = Math.floor(cx / CELL) + ',' + Math.floor(cz / CELL); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ cx, cz, r }); n++; }
    BLDG = grid; console.log(`Binolar indeksi: ${n} ta`); if (ROADS) relocateBadAuto(); // bino ustida qolgan avto-uylar ko'chiriladi
  } catch (e) { console.log('Bino indeksi xato:', e.message); }
}
function nearBuilding(x, z, pad) {
  if (!BLDG) return false; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) for (const b of BLDG.get((cx + i) + ',' + (cz + k)) || []) if (Math.hypot(b.cx - x, b.cz - z) < b.r + pad) return true;
  return false;
}
async function loadBuildings() {
  if (fs.existsSync(BLD_FILE)) { if (!BLDG) indexBuildings(fs.readFileSync(BLD_FILE)); return; }
  if (bldLoading) return;
  bldLoading = (async () => {
    const q = `[out:json][timeout:180];way["building"](${CITY_BBOX});out geom tags;`;
    for (const u of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
      try {
        const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'shahrisabz-online-shahar' }, signal: AbortSignal.timeout(200000) });
        if (!r.ok) continue; const j = await r.json(); const out = [];
        for (const e of j.elements) { if (!e.geometry || e.geometry.length < 4) continue; const t = e.tags || {};
          const lv = parseFloat(t['building:levels']) || 0, h = parseFloat(t.height) || 0;
          out.push({ g: e.geometry.slice(0, -1).map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]), t: t.building, ...(lv ? { lv } : {}), ...(h ? { h } : {}), ...(t.name ? { n: t['name:uz'] || t.name } : {}), ...(t['roof:shape'] ? { rs: t['roof:shape'] } : {}) }); }
        if (!out.length) continue;
        const buf = Buffer.from(JSON.stringify({ manba: '© OpenStreetMap hissadorlari (ODbL)', b: out }));
        fs.mkdirSync(path.dirname(BLD_FILE), { recursive: true }); fs.writeFileSync(BLD_FILE, buf); console.log(`Binolar saqlandi: ${out.length} ta`); indexBuildings(buf); return;
      } catch (e) { console.log('Binolar xato', e.message); }
    }
  })().finally(() => { bldLoading = null; });
}
// Egasiz haqiqiy binolar o'chirilgan (shaharda faqat aholining binolari): yuklanmaydi va joylashtirishga to'sqinlik qilmaydi
setInterval(() => { if (!fs.existsSync(OSM_FILE)) getOsm().then((b) => b && buildRoads(b)).catch(() => {}); else if (!ROADS) buildRoads(fs.readFileSync(OSM_FILE)); }, 2 * 60 * 1000);

async function igPost(pathq, payload) {
  const ig = db.settings.instagram;
  const base = ig.kind === 'instagram' ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
  const r = await fetch(`${base}/${pathq}?access_token=${encodeURIComponent(ig.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json(); if (j.error) throw new Error('Instagram: ' + j.error.message); return j;
}
// Direct'ga xabar yozgan odamga: uy quriladi (bo'lmasa) va parol avtomatik javob bo'lib boradi (rasmiy API, 24 soat oynasi)
const KEYWORD = /(^|[^a-zа-я'ʻ`])(uy|уй)([^a-zа-я'ʻ`]|$)/i;
// 'me/messages' — Instagram Login tokeni (IGAA…) uchun ham, Facebook sahifa tokeni (EAA…) uchun ham ishlaydi
const igMsg = (recipient, text) => igPost('me/messages', { recipient, message: { text } }).catch((e) => igPost(`${db.settings.instagram.igUserId}/messages`, { recipient, message: { text } }).catch(() => { throw e; }));
db.webhookLog ||= [];
function wlog(o) { db.webhookLog.unshift({ at: Date.now(), ...o }); db.webhookLog = db.webhookLog.slice(0, 50); save(); }
// Direct'ga «uy» deb yozgan odam: obunani tekshiradi → uy quradi → sayt linki, nik, parol yuboradi
async function handleDm(senderId, text) {
  if (!KEYWORD.test(text || '')) return wlog({ type: 'dm', from: senderId, text, result: "«uy» so'zi yo'q — javob berilmadi" }); // tez: API chaqirmasdan
  let info;
  try { info = await igGet(`${senderId}?fields=username,profile_pic,is_user_follow_business`).catch(() => igGet(`${senderId}?fields=username`)); }
  catch (e) { return wlog({ type: 'dm', from: senderId, text, error: 'Nikni olib bo\'lmadi: ' + e.message }); }
  if (!info.username) return wlog({ type: 'dm', from: senderId, text, error: 'Instagram nikni bermadi' });
  if (info.is_user_follow_business === false) {
    wlog({ type: 'dm', from: '@' + info.username, text, result: "obuna bo'lmagan — obuna bo'lishni so'radik" });
    return igMsg({ id: senderId }, `Assalomu alaykum! 🏠 Uy olish uchun avval @${db.settings.instagram.username || 'sahifamiz'} ga obuna bo'ling, keyin yana «uy» deb yozing.`);
  }
  const r = addFollower(info.username, 'direct');
  r.igsid = senderId; if (info.profile_pic) { r.avatar = info.profile_pic; r.avatarAt = 0; }
  try { await igMsg({ id: senderId }, passText(r)); }
  catch (e) { return wlog({ type: 'dm', from: '@' + info.username, text, error: 'Uy qurildi, lekin javob yuborilmadi: ' + e.message }); }
  r.delivered = true; db.dmQueue = db.dmQueue.filter((x) => x !== r.id); save();
  wlog({ type: 'dm', from: '@' + info.username, text, result: '✅ uy tayyor, link va parol yuborildi' });
}
// Postga «uy» deb komment yozgan odam: uy quriladi va Direct'ga yopiq javob (private reply) boradi
async function handleComment(v) {
  const u = v?.from?.username; if (!u || !v.id) return;
  if (String(v.from.id) === String(db.settings.instagram.igUserId)) return;
  if (!KEYWORD.test(v.text || '')) return;
  const r = addFollower(u, 'comment');
  if (r.delivered) return;
  await igMsg({ comment_id: v.id }, passText(r));
  r.delivered = true; save();
}

// ---- Obunachilarni kuzatish: akkaunt seansi (sessionid cookie) orqali obunachilar ro'yxati o'qiladi ----
// Diqqat: bu Instagram'ning norasmiy veb-API'si. Juda tez-tez so'ralsa Instagram vaqtincha cheklashi mumkin.
const IGW = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'X-IG-App-ID': '936619743392459', Accept: '*/*' };
async function igWeb(url) {
  const w = db.settings.watcher;
  const r = await fetch(url, { headers: { ...IGW, Cookie: `sessionid=${w.sessionid}; ds_user_id=${w.pk || ''}` }, signal: AbortSignal.timeout(30000) });
  if (r.status === 401 || r.status === 403) throw new Error('Seans yaroqsiz — admin panelda sessionid ni yangilang');
  if (!r.ok) throw new Error('Instagram javobi: ' + r.status);
  const j = await r.json(); if (j.status === 'fail') throw new Error(j.message || 'Instagram rad etdi'); return j;
}
async function watchFollowers() {
  const w = db.settings.watcher;
  if (!w.sessionid) throw new Error('Avval sessionid kiriting');
  if (!w.pk) {
    const pr = await igWeb(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(w.username)}`);
    w.pk = pr?.data?.user?.id; if (!w.pk) throw new Error('Akkaunt topilmadi'); save();
  }
  const added = []; let maxId = '', pages = 0;
  do {
    const j = await igWeb(`https://www.instagram.com/api/v1/friendships/${w.pk}/followers/?count=100${maxId ? '&max_id=' + maxId : ''}`);
    let knownInPage = 0;
    for (const u of j.users || []) {
      const before = db.residents.length; addFollower(u.username, 'follow', w.initialized ? u.pk : null);
      if (db.residents.length > before) added.push(u.username); else knownInPage++;
    }
    maxId = j.next_max_id || '';
    if (w.initialized && knownInPage === (j.users || []).length) break; // ro'yxat eng yangidan boshlanadi — tanishlarga yetdik
    pages++; if (pages > 50) break;
    await new Promise((ok) => setTimeout(ok, 1500));
  } while (maxId);
  w.initialized = true; w.lastCheck = Date.now(); w.lastError = ''; save();
  return { ok: true, added };
}
let watchPauseUntil = 0, watchBusy = false;
setInterval(() => {
  const w = db.settings.watcher;
  if (!w.sessionid || watchBusy || Date.now() < watchPauseUntil) return;
  watchBusy = true;
  watchFollowers().then((r) => { if (r.added.length) dmWorker().catch(() => {}); })
    .catch((e) => { w.lastError = e.message; save(); console.log('Watcher:', e.message); if (/429|cheklang|wait|rad/i.test(e.message)) watchPauseUntil = Date.now() + 10 * 60 * 1000; })
    .finally(() => { watchBusy = false; });
}, 20 * 1000); // har 20 soniyada; Instagram cheklasa 10 daqiqa dam oladi

// ---- Yangi obunachiga Direct: "uyingiz tayyor" + sayt, login, parol (akkaunt seansi orqali, navbat bilan sekin) ----
async function sendWebDm(pk, text) {
  const w = db.settings.watcher;
  if (!w.csrftoken) throw new Error('csrftoken kiritilmagan');
  const form = new URLSearchParams({ recipient_users: JSON.stringify([[String(pk)]]), action: 'send_item', client_context: String(Date.now()) + crypto.randomInt(1000, 9999), text });
  const r = await fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', { method: 'POST', body: form, headers: { ...IGW, 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': w.csrftoken, Referer: 'https://www.instagram.com/direct/', Cookie: `sessionid=${w.sessionid}; csrftoken=${w.csrftoken}; ds_user_id=${w.pk}` }, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== 'ok') throw new Error('Direct yuborilmadi: ' + (j.message || r.status));
}
async function dmWorker() {
  const w = db.settings.watcher;
  if (!w.sessionid || !w.csrftoken || !db.dmQueue.length) return;
  const rid = db.dmQueue[0], r = db.residents.find((x) => x.id === rid);
  if (!r || !r.pk || r.delivered) { db.dmQueue.shift(); save(); return; }
  try { await sendWebDm(r.pk, passText(r)); r.delivered = true; db.dmQueue.shift(); w.dmError = ''; }
  catch (e) { w.dmError = e.message; r.dmTries = (r.dmTries || 0) + 1; if (r.dmTries >= 3) db.dmQueue.shift(); }
  save();
}
setInterval(() => dmWorker().catch(() => {}), 10 * 1000); // 10 soniyada 1 ta xabar

function addTx(r, amount, text) { db.tx.push({ id: id(), user: r.username, amount, text, balance: r.balance || 0, at: Date.now() }); }
const UPLOADS = path.join(__dirname, 'data', 'uploads');
const AVATARS = path.join(__dirname, 'data', 'avatars');
// Instagram avatarini serverda keshlaydi (CDN havolalari muddati tugaydi, brauzer esa WebGL uchun shu manzildan oladi)
async function avatarFile(r) {
  const f = path.join(AVATARS, r.username + '.jpg');
  if (fs.existsSync(f) && Date.now() - (r.avatarAt || 0) < 7 * 864e5) return f;
  if (!r.avatar) return fs.existsSync(f) ? f : null;
  try {
    const resp = await fetch(r.avatar, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(resp.status);
    fs.mkdirSync(AVATARS, { recursive: true }); fs.writeFileSync(f, Buffer.from(await resp.arrayBuffer()));
    r.avatarAt = Date.now(); save(); return f;
  } catch { return fs.existsSync(f) ? f : null; }
}

// geocodeAll endi kerak emas: mahallalar public/mahallas-geo.json da aniq chegaralari bilan bor

// ---- Obunachilar soni (rasmiy Graph API, 24/7, kompyutersiz) ----
db.followerStats ||= [];
async function pollFollowerCount() {
  const ig = db.settings.instagram; if (!ig.token || !ig.igUserId) return;
  const a = await igGet(`${ig.igUserId}?fields=followers_count`);
  const last = db.followerStats[db.followerStats.length - 1];
  if (!last || last.count !== a.followers_count || Date.now() - last.at > 3600e3) { db.followerStats.push({ at: Date.now(), count: a.followers_count }); db.followerStats = db.followerStats.slice(-2000); save(); }
}
setInterval(() => pollFollowerCount().catch((e) => console.log('Followers:', e.message)), 5 * 60 * 1000);
setTimeout(() => pollFollowerCount().catch(() => {}), 8000);

const hueHex = (h) => { const f = (n) => { const k = (n + h / 30) % 12, a = 0.75 * Math.min(0.45, 0.55); return Math.round(255 * (0.45 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
function migrateCars(r) { // eski bitta mashina → mashinalar ro'yxati
  if (!r.cars) { r.cars = r.car && r.car !== 'yoq' ? [{ t: r.car, c: hueHex(r.carColor || 0), price: db.settings.shop.cars[r.car] || 0, at: Date.now() }] : []; delete r.car; }
  return r.cars;
}

const pubHouse = (h) => ({ bname: h.bname || '', rot: h.rot || 0, id: h.id, owner: h.owner, x: h.x, z: h.z, style: h.style || 'oddiy', colorHex: h.colorHex || null, color: h.color ?? 30, mahalla: h.mahalla || '', street: h.street || '', no: h.no || '', n: houseNumber(h) });
// Egasining nechanchi uyi: asosiy uy = 1, keyingilari 2, 3 …
function houseNumber(h) { const own = db.houses.filter((x) => x.owner === h.owner); const main = db.residents.find((r) => r.username === h.owner && !r.homeless) ? 1 : 0; return own.indexOf(h) + 1 + main; }
function assetOf(r, kind, refId) {
  if (kind === 'main') return r.homeless ? null : { title: 'Asosiy uy', obj: r };
  if (kind === 'house') { const h = db.houses.find((x) => x.id === refId && x.owner === r.username); return h && { title: 'Uy', obj: h }; }
  if (kind === 'plot') { const pl = db.plots.find((x) => x.id === refId && x.owner === r.username && x.status === 'sold'); return pl && { title: pl.name, obj: pl }; }
  return null;
}
function transferAsset(seller, buyer, kind, refId) {
  if (kind === 'main') { // asosiy uy xaridorga qo'shimcha uy bo'lib o'tadi, sotuvchi uysiz qoladi
    db.houses.push({ id: id(), owner: buyer.username, x: seller.x, z: seller.z, rot: seller.rot || 0, style: seller.style || 'oddiy', colorHex: seller.colorHex || null, color: seller.color, mahalla: seller.mahalla, street: seller.street, no: seller.no || '', at: Date.now() });
    seller.homeless = true; seller.x = 99999; seller.z = 99999;
  } else if (kind === 'house') { const h = db.houses.find((x) => x.id === refId); h.owner = buyer.username; }
  else if (kind === 'plot') { const pl = db.plots.find((x) => x.id === refId); pl.owner = buyer.username; }
}

// ---- Yo'llar xaritasi (server tomonda): uylar va joylar yo'lga tushmasligi uchun ----
const LAT0 = 39.0578, LON0 = 66.8297, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110540;
const toXZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const RW = { motorway: 20, trunk: 18, primary: 16, secondary: 13, tertiary: 11, residential: 8, unclassified: 8, road: 7, living_street: 6, service: 5, pedestrian: 5, track: 4 };
let ROADS = null; const CELL = 60;
function buildRoads(buf) {
  try {
    const j = JSON.parse(buf), segs = [], grid = new Map();
    for (const w of j.ways) {
      const pts = w.g.map(([la, lo]) => toXZ(la, lo)), hw = (RW[w.t] || 6) / 2 + 2; // +2 m trotuar
      for (let i = 0; i < pts.length - 1; i++) {
        const sg = { ax: pts[i][0], az: pts[i][1], bx: pts[i + 1][0], bz: pts[i + 1][1], hw, t: w.t, n: w.n };
        if (Math.hypot(sg.bx - sg.ax, sg.bz - sg.az) < .5) continue;
        segs.push(sg);
        const x0 = Math.floor((Math.min(sg.ax, sg.bx) - 30) / CELL), x1 = Math.floor((Math.max(sg.ax, sg.bx) + 30) / CELL), z0 = Math.floor((Math.min(sg.az, sg.bz) - 30) / CELL), z1 = Math.floor((Math.max(sg.az, sg.bz) + 30) / CELL);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x + ',' + z; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(sg); }
      }
    }
    ROADS = { segs, grid }; lotQueue = null;
    console.log(`Yo'llar indeksi: ${segs.length} bo'lak`);
    relocateBadAuto(); placeOwner();
  } catch (e) { console.log("Yo'l indeksi xato:", e.message); }
}
// (x,z) nuqtadan eng yaqin yo'l chetigacha masofa (manfiy — yo'l ustida)
function roadClear(x, z) {
  if (!ROADS) return Infinity;
  let best = Infinity; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) for (const s of ROADS.grid.get((cx + i) + ',' + (cz + k)) || []) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) - s.hw);
  }
  return best;
}
const HOUSE_R = 23; // uy hovlisi radiusi (m): eng katta dizayn (villa) hovlisi bilan
function spotFree(x, z, exceptUser) {
  if (roadClear(x, z) < HOUSE_R) return false;
  if (nearBuilding(x, z, HOUSE_R * .8)) return false; // haqiqiy bino ustiga tushmasin
  if (db.residents.some((r) => !r.homeless && r.username !== exceptUser && Math.hypot(r.x - x, r.z - z) < HOUSE_R * 2)) return false;
  if (db.houses.some((h) => Math.hypot(h.x - x, h.z - z) < HOUSE_R * 2)) return false;
  if (db.plots.some((p) => p.status !== 'rejected' && x > p.x1 - HOUSE_R && x < p.x2 + HOUSE_R && z > p.z1 - HOUSE_R && z < p.z2 + HOUSE_R)) return false;
  return true;
}
// Eng yaqin yo'l nuqtasi (uyni ko'chaga qaratish va ko'cha nomi uchun)
function nearestRoadPt(x, z) {
  if (!ROADS) return null; let best = null;
  for (let R = 1; R <= 4 && !best; R++) { const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) for (const s of ROADS.grid.get((cx + i) + ',' + (cz + k)) || []) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2)), px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { d, px, pz, s };
    } }
  return best;
}
// Belgilangan nuqtaga eng yaqin bo'sh joy (yo'lga ham, boshqa uyga ham tegmaydi) — spiral bo'ylab qidiradi
function findFreeSpot(x, z, exceptUser) {
  for (let r = 0; r <= 400; r += 4) for (let a = 0, n = Math.max(1, Math.ceil(2 * Math.PI * r / 4)); a < n; a++) {
    const px = x + Math.cos(a / n * 2 * Math.PI) * r, pz = z + Math.sin(a / n * 2 * Math.PI) * r;
    if (spotFree(px, pz, exceptUser)) { const nr = nearestRoadPt(px, pz); return { x: Math.round(px), z: Math.round(pz), rot: nr ? Math.atan2(nr.px - px, nr.pz - pz) : 0, street: nr?.s.n || '' }; }
  }
  return null;
}
function findFreeRect(x, z, half) {
  const ok = (cx, cz) => rectClear(cx - half, cz - half, cx + half, cz + half) && !overlaps({ x1: cx - half, x2: cx + half, z1: cz - half, z2: cz + half }) && !db.residents.some((q) => !q.homeless && q.x > cx - half - HOUSE_R && q.x < cx + half + HOUSE_R && q.z > cz - half - HOUSE_R && q.z < cz + half + HOUSE_R) && !db.houses.some((h) => h.x > cx - half - HOUSE_R && h.x < cx + half + HOUSE_R && h.z > cz - half - HOUSE_R && h.z < cz + half + HOUSE_R);
  for (let r = 0; r <= 400; r += 4) for (let a = 0, n = Math.max(1, Math.ceil(2 * Math.PI * r / 4)); a < n; a++) {
    const px = x + Math.cos(a / n * 2 * Math.PI) * r, pz = z + Math.sin(a / n * 2 * Math.PI) * r; if (ok(px, pz)) return { x: px, z: pz };
  }
  return null;
}
function rectClear(x1, z1, x2, z2) { // joy ichida yo'l yo'qmi (har 3 m tekshiriladi)
  if (!ROADS) return true;
  for (let x = x1; x <= x2 + .01; x += 3) for (let z = z1; z <= z2 + .01; z += 3) if (roadClear(x, z) < .5) return false;
  if (nearBuilding((x1 + x2) / 2, (z1 + z2) / 2, Math.hypot(x2 - x1, z2 - z1) / 2)) return false;
  return roadClear(x2, z2) >= .5;
}
// Shahar chekkasidagi ko'chalar bo'ylab tartibli uchastkalar: har 34 m da, yo'l chetidan HOUSE_R+2 m, eshigi ko'chaga qaragan
let lotQueue = null;
function buildLots() {
  const lots = [];
  for (const s of ROADS.segs) {
    if (!/^(residential|unclassified|tertiary|living_street|road)$/.test(s.t)) continue;
    const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, d = Math.hypot(mx, mz);
    if (d < 1800 || d > 4500) continue;
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L, off = s.hw + HOUSE_R + 2;
    for (let t = 23; t < L - 23; t += 46) for (const side of [1, -1]) {
      const x = s.ax + dx / L * t + nx * off * side, z = s.az + dz / L * t + nz * off * side;
      lots.push({ x: Math.round(x), z: Math.round(z), rot: Math.atan2(-nx * side, -nz * side), street: s.n || '', d: Math.hypot(x, z), a: Math.atan2(z, x) });
    }
  }
  lots.sort((a, b) => Math.round(a.d / 300) - Math.round(b.d / 300) || a.a - b.a); // markazga yaqin halqalardan, aylana bo'ylab
  return lots;
}
function autoLot() {
  if (!ROADS) return null;
  lotQueue ||= buildLots();
  while (lotQueue.length) { const l = lotQueue.shift(); if (spotFree(l.x, l.z)) return l; }
  return null;
}
// Avval avtomatik qurilgan, lekin yo'lga tushib qolgan uylarni tartibli joyga ko'chirish
// Egasining mega-binosi shahar markaziga yaqin, yo'lga tegmaydigan katta joyga
function placeOwner() {
  const r = db.residents.find((x) => x.username === OWNER); if (!r || r.megaPlaced) return;
  for (let rad = 60; rad < 1500; rad += 20) for (let a = 0; a < 6.28; a += 20 / rad) { const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (roadClear(x, z) > 40 && spotFree(x, z, OWNER)) { const nr = nearestRoadPt(x, z); Object.assign(r, { x: Math.round(x), z: Math.round(z), rot: nr ? Math.atan2(nr.px - x, nr.pz - z) : 0, megaPlaced: true, street: nr?.s.n || r.street }); save(); console.log('Mega-bino joyi:', r.x, r.z); return; } }
}
function relocateBadAuto() {
  let n = 0;
  for (const r of db.residents) {
    if (r.owner || r.homeless || r.mahalla !== 'Shahar chekkasi' || (r.lot && roadClear(r.x, r.z) >= HOUSE_R && !nearBuilding(r.x, r.z, HOUSE_R * .8))) continue; // hali ko'chmagan avto-uylar tartibli joyga
    const l = autoLot(); if (!l) break;
    Object.assign(r, { x: l.x, z: l.z, rot: l.rot, lot: true, street: r.street || l.street }); n++;
  }
  if (n) { save(); console.log(`${n} ta uy yo'ldan tartibli joyga ko'chirildi`); }
}

const TYPES = ['uy', "do'kon", 'kafe', 'ofis', 'mehmonxona', 'maktab', 'masjid', 'bog\'', 'zavod', 'boshqa'];

async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (m === 'GET' && p === '/api/state') {
    return send(res, 200, { residents: db.residents.map(pub), houses: db.houses.map(pubHouse), plots: db.plots.filter((x) => x.status !== 'rejected').map(pubPlot), customPlaces: db.customPlaces, roadsReady: !!ROADS, shop: db.settings.shop, settings: { pricePerSotix: db.settings.pricePerSotix, pricePerM2: db.settings.pricePerSotix / 100, currency: db.settings.currency }, types: TYPES });
  }
  // Instagram obuna: avtomatlashtirish (ManyChat / Make / Zapier) shu manzilga yuboradi
  if (m === 'POST' && p === '/api/follow') {
    const b = await body(req);
    if ((req.headers['x-follow-secret'] || b.secret) !== FOLLOW_SECRET) return send(res, 403, { error: "Noto'g'ri secret" });
    const before = db.residents.length;
    const r = addFollower(b.username, b.source === 'browser' ? 'follow' : 'webhook');
    if (!r) return send(res, 400, { error: 'username kerak' });
    if (b.pk && !r.pk) { r.pk = String(b.pk); save(); }
    if (b.avatar && /^https:\/\//.test(b.avatar) && r.avatar !== b.avatar) { r.avatar = String(b.avatar); r.avatarAt = 0; save(); }
    return send(res, 200, { ok: true, isNew: db.residents.length > before, needDm: !r.delivered, dmText: passText(r), resident: pub(r) });
  }
  if (m === 'POST' && p === '/api/follow/delivered') {
    const b = await body(req);
    if (b.secret !== FOLLOW_SECRET) return send(res, 403, { error: "Noto'g'ri secret" });
    const r = db.residents.find((x) => x.username === cleanName(b.username));
    if (r) { r.delivered = true; db.dmQueue = db.dmQueue.filter((x) => x !== r.id); save(); }
    return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/follow/heartbeat') {
    const b = await body(req);
    if (b.secret !== FOLLOW_SECRET) return send(res, 403, { error: "Noto'g'ri secret" });
    db.settings.browserWatcher = { at: Date.now(), followers: b.followers || 0, error: String(b.error || '').slice(0, 200) }; save();
    return send(res, 200, { ok: true });
  }
  // Meta webhook tekshiruvi (GET hub.challenge)
  if (p === '/api/instagram/webhook') {
    if (m === 'GET') {
      const vt = url.searchParams.get('hub.verify_token'); if (vt && (vt === FOLLOW_SECRET || vt === db.settings.instagram.verifyToken)) { res.writeHead(200); return res.end(url.searchParams.get('hub.challenge') || ''); }
      return send(res, 403, { error: 'verify failed' });
    }
    const b = await body(req);
    const added = [];
    db.settings.lastWebhook = Date.now();
    if (!(b.entry || []).some((e) => (e.messaging || []).length || (e.changes || []).length)) wlog({ type: 'webhook', result: 'bo\'sh yoki noma\'lum xabar', text: JSON.stringify(b).slice(0, 200) });
    for (const e of b.entry || []) {
      for (const c of e.changes || []) {
        if (c.field === 'comments' || c.field === 'live_comments') handleComment(c.value).catch((er) => console.log('Komment xato', er.message));
        else if (c.field === 'messages' && c.value?.sender?.id) handleDm(c.value.sender.id, c.value.message?.text).catch((er) => console.log('DM xato', er.message));
      }
      for (const mm of e.messaging || []) {
        if (mm.message?.is_echo || !mm.sender?.id || mm.sender.id === String(db.settings.instagram.igUserId)) continue;
        handleDm(mm.sender.id, mm.message?.text).catch((er) => console.log('DM xato', er.message));
      }
    }
    return send(res, 200, { ok: true, added });
  }

  if (m === 'GET' && p === '/api/instagram/connect') {
    if (url.searchParams.get('t') !== ADMIN_TOKEN) return send(res, 401, { error: 'Admin emas' });
    if (!IG_APP_ID || !IG_APP_SECRET) { res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end("IG_APP_ID va IG_APP_SECRET sozlanmagan. README'dagi yo'riqnomani ko'ring."); }
    const st = crypto.randomBytes(12).toString('hex'); oauthStates.add(st);
    const q = new URLSearchParams({ client_id: IG_APP_ID, redirect_uri: redirectUri(req), response_type: 'code', state: st, scope: 'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages' });
    res.writeHead(302, { Location: 'https://www.instagram.com/oauth/authorize?' + q }); return res.end();
  }
  if (m === 'GET' && p === '/api/instagram/callback') {
    const done = (msg) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<meta charset="utf-8"><p style="font-family:sans-serif">${msg}</p><p><a href="/admin">← Admin panel</a></p>`); };
    const st = url.searchParams.get('state'); if (!oauthStates.has(st)) return done('Xato: state noto\'g\'ri');
    oauthStates.delete(st);
    const code = url.searchParams.get('code'); if (!code) return done('Ruxsat berilmadi: ' + (url.searchParams.get('error_description') || ''));
    try {
      const r1 = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_APP_SECRET, grant_type: 'authorization_code', redirect_uri: redirectUri(req), code }) });
      const short = await r1.json(); if (!short.access_token) throw new Error(short.error_message || JSON.stringify(short));
      const r2 = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${short.access_token}`);
      const long = await r2.json(); if (!long.access_token) throw new Error(JSON.stringify(long));
      const ig = db.settings.instagram;
      Object.assign(ig, { kind: 'instagram', token: long.access_token, expiresAt: Date.now() + long.expires_in * 1000 });
      const meR = await fetch(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${long.access_token}`); const meJ = await meR.json();
      ig.igUserId = String(meJ.user_id || meJ.id || short.user_id); ig.username = meJ.username || ''; save();
      return done(`✅ @${ig.username} ulandi! Uzoq muddatli token olindi (60 kun, avtomatik yangilanadi).`);
    } catch (e) { return done('Xato: ' + e.message); }
  }
  if (m === 'POST' && p === '/api/claim') {
    const b = await body(req);
    const r = db.residents.find((x) => x.username === cleanName(b.username));
    if (!r) return send(res, 404, { error: "Bunday obunachi topilmadi. Avval Instagram sahifamizga obuna bo'ling." });
    if (!b.password || b.password.length < 4) return send(res, 400, { error: "Parol kamida 4 belgi bo'lsin" });
    if (r.pass) { if (r.pass !== hash(b.password)) return send(res, 403, { error: "Parol noto'g'ri. Parolni olish uchun @shahrisabz.online.shahar ga Direct'da istalgan xabar yozing." }); }
    else r.pass = hash(b.password);
    r.lastLogin = Date.now(); save();
    return send(res, 200, { ok: true, resident: pub(r), mustChange: !!r.mustChange });
  }
  if (m === 'POST' && p === '/api/change-password') { // birinchi kirishda ham, keyin xohlagan paytda ham
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: "Joriy parol noto'g'ri" });
    const np = String(b.newPassword || '');
    if (np.length < 4) return send(res, 400, { error: "Yangi parol kamida 4 belgi bo'lsin" });
    if (np === db.settings.defaultPass) return send(res, 400, { error: 'Umumiy paroldan boshqa parol tanlang' });
    if (r.owner) r.ownerInit = true;
    r.pass = hash(np); r.plainPass = np; r.mustChange = false; save();
    return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/move') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    if (r.homeless) return send(res, 400, { error: "Uyingizni sotgansiz — ko'chish uchun avval joy sotib olib, uy quring" });
    if (!isFinite(b.x) || !isFinite(b.z)) return send(res, 400, { error: 'Joy tanlang' });
    if (!ROADS) return send(res, 503, { error: "Shahrisabz xaritasi serverda hali tayyorlanmoqda — 1–2 daqiqadan keyin qayta urinib ko'ring" });
    let spot = { x: Math.round(+b.x), z: Math.round(+b.z), rot: isFinite(b.rot) ? +b.rot : 0, street: '' };
    if (!spotFree(spot.x, spot.z, r.username)) { // yo'lga yaqin yoki band — eng yaqin bo'sh joyga o'zi suriladi
      spot = findFreeSpot(+b.x, +b.z, r.username);
      if (!spot) return send(res, 409, { error: "Bu atrofda bo'sh joy topilmadi — boshqa joyni tanlang" });
      if (spot.street && !b.keepStreet) b.street = spot.street;
    }
    r.x = spot.x; r.z = spot.z; r.rot = spot.rot;
    r.mahalla = String(b.mahalla || '').slice(0, 80); r.street = String(b.street || '').slice(0, 80);
    save();
    return send(res, 200, { ok: true, resident: pub(r) });
  }
  // Uy ma'lumotlarini tahrirlash: mahalla, ko'cha, uy raqami
  if (m === 'POST' && p === '/api/house/edit') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const a = assetOf(r, b.kind || 'main', b.refId); if (!a) return send(res, 404, { error: 'Uy topilmadi' });
    const o = a.obj, cut = (v, n) => String(v ?? '').trim().slice(0, n);
    if (b.mahalla !== undefined) o.mahalla = cut(b.mahalla, 80);
    if (b.street !== undefined) o.street = cut(b.street, 80);
    if (b.no !== undefined) o.no = cut(b.no, 20);
    save(); return send(res, 200, { ok: true });
  }
  // Sotish: sotuvchi "Sotildi" bosadi → xaridorga taklif boradi → xaridor qabul qilsa pul va uy o'tadi
  if (m === 'POST' && (p.startsWith('/api/sell/') || p === '/api/buy/offer')) {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    if (p === '/api/buy/offer') { // xaridor: boshqa odamning uyi/joyiga narx taklif qiladi
      const owner = db.residents.find((x) => x.username === cleanName(b.owner));
      if (!owner) return send(res, 404, { error: 'Egasi topilmadi' });
      if (owner.username === r.username) return send(res, 400, { error: 'Bu o\'zingizning mulkingiz' });
      const price = Math.round(Number(b.price)); if (!(price > 0)) return send(res, 400, { error: "Narxni to'g'ri yozing" });
      if ((r.balance || 0) < price) return send(res, 402, { error: `Hamyoningizda ${price.toLocaleString('ru-RU')} yo'q (bor: ${(r.balance || 0).toLocaleString('ru-RU')})` });
      const a = assetOf(owner, b.kind, b.refId); if (!a) return send(res, 404, { error: 'Bu mulk topilmadi' });
      db.offers = db.offers.filter((o) => !(o.status === 'pending' && o.buyer === r.username && o.kind === b.kind && (o.refId || '') === (b.refId || '') && o.seller === owner.username));
      const of = { id: id(), seller: owner.username, buyer: r.username, initiator: 'buyer', kind: b.kind, refId: b.refId || '', title: a.title, price, status: 'pending', at: Date.now() };
      db.offers.push(of);
      db.notifications.unshift({ id: id(), text: `🤝 @${r.username} @${owner.username} ning "${a.title}"iga ${price.toLocaleString('ru-RU')} ${db.settings.currency} taklif qildi`, read: false, at: Date.now() });
      save(); return send(res, 200, { ok: true, offer: of });
    }
    if (p === '/api/sell/offer') {
      const buyer = db.residents.find((x) => x.username === cleanName(b.buyer));
      if (!buyer) return send(res, 404, { error: 'Bunday nikli odam saytda yo\'q' });
      if (buyer.username === r.username) return send(res, 400, { error: 'O\'zingizga sota olmaysiz' });
      const price = Math.round(Number(b.price)); if (!(price >= 0)) return send(res, 400, { error: "Narxni to'g'ri yozing" });
      const a = assetOf(r, b.kind, b.refId); if (!a) return send(res, 404, { error: 'Sotiladigan mulk topilmadi' });
      db.offers = db.offers.filter((o) => !(o.status === 'pending' && o.seller === r.username && o.kind === b.kind && (o.refId || '') === (b.refId || '')));
      const of = { id: id(), seller: r.username, buyer: buyer.username, kind: b.kind, refId: b.refId || '', title: a.title, price, status: 'pending', at: Date.now() };
      db.offers.push(of);
      db.notifications.unshift({ id: id(), text: `🤝 @${r.username} "${a.title}"ni @${buyer.username} ga ${price.toLocaleString('ru-RU')} ${db.settings.currency} ga sotmoqda (xaridor tasdig'i kutilmoqda)`, read: false, at: Date.now() });
      save(); return send(res, 200, { ok: true, offer: of });
    }
    const of = db.offers.find((o) => o.id === b.offerId && o.status === 'pending');
    if (!of) return send(res, 404, { error: 'Taklif topilmadi yoki eskirgan' });
    if (p === '/api/sell/cancel') { if (of.seller !== r.username && of.buyer !== r.username) return send(res, 403, { error: 'Ruxsat yo\'q' }); of.status = of.seller === r.username ? 'bekor' : 'rad etildi'; save(); return send(res, 200, { ok: true }); }
    if (p === '/api/sell/accept') {
      const accepter = of.initiator === 'buyer' ? of.seller : of.buyer;
      if (accepter !== r.username) return send(res, 403, { error: 'Bu taklifni faqat ikkinchi tomon tasdiqlaydi' });
      const seller = db.residents.find((x) => x.username === of.seller), buyerR = db.residents.find((x) => x.username === of.buyer);
      if (!seller || !assetOf(seller, of.kind, of.refId)) { of.status = 'eskirgan'; save(); return send(res, 410, { error: 'Bu mulk endi sotuvchida yo\'q' }); }
      if ((buyerR.balance || 0) < of.price) return send(res, 402, { error: `Xaridor @${buyerR.username} hamyonida pul yetarli emas` });
      transferAsset(seller, buyerR, of.kind, of.refId);
      buyerR.balance = (buyerR.balance || 0) - of.price; seller.balance = (seller.balance || 0) + of.price;
      addTx(buyerR, -of.price, `Sotib olindi: ${of.title} (@${seller.username} dan)`); addTx(seller, of.price, `Sotildi: ${of.title} (@${buyerR.username} ga)`);
      of.status = 'sotildi'; of.doneAt = Date.now();
      db.offers.filter((o) => o.status === 'pending' && o.seller === seller.username && o.kind === of.kind && o.refId === of.refId).forEach((o) => (o.status = 'eskirgan'));
      db.notifications.unshift({ id: id(), text: `✅ SOTILDI: @${seller.username} → @${buyerR.username}: "${of.title}" — ${of.price.toLocaleString('ru-RU')} ${db.settings.currency}`, read: false, at: Date.now() });
      save(); return send(res, 200, { ok: true });
    }
  }
  // ---- Balansni to'ldirish: karta ma'lumoti → foydalanuvchi o'tkazadi → chek skrinshoti → admin tasdiqlaydi ----
  if (m === 'POST' && p === '/api/topup/info') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const pay = db.settings.payment;
    return send(res, 200, { cards: pay.cards.filter((c) => c.active !== false).map(({ number, holder, bank, link }) => ({ number, holder, bank, link })), note: pay.note, min: pay.min, my: db.topups.filter((t) => t.user === r.username).slice(-10).reverse().map(({ id, amount, status, at, reason }) => ({ id, amount, status, at, reason })) });
  }
  if (m === 'POST' && p === '/api/topup/request') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const amount = Math.round(Number(b.amount)), pay = db.settings.payment;
    if (!(amount >= (pay.min || 1))) return send(res, 400, { error: `Eng kam summa: ${(pay.min || 1).toLocaleString('ru-RU')} ${db.settings.currency}` });
    if (amount > 1e11) return send(res, 400, { error: 'Summa juda katta' });
    if (!b.file?.data || !String(b.file.type || '').startsWith('image/')) return send(res, 400, { error: "To'lov cheki skrinshotini (rasm) yuklang" });
    const buf = Buffer.from(String(b.file.data).split(',').pop(), 'base64');
    if (buf.length > 10e6) return send(res, 413, { error: 'Rasm 10 MB dan katta' });
    if (db.topups.filter((t) => t.user === r.username && t.status === 'pending').length >= 5) return send(res, 429, { error: "Sizda 5 ta tekshirilmagan so'rov bor — admin javobini kuting" });
    const ext = (String(b.file.type).split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5);
    const fn = id() + id() + '.' + ext; fs.mkdirSync(TOPUPS, { recursive: true }); fs.writeFileSync(path.join(TOPUPS, fn), buf);
    const t = { id: id(), user: r.username, amount, card: String(b.card || '').slice(0, 40), img: fn, status: 'pending', at: Date.now() };
    db.topups.push(t);
    db.notifications.unshift({ id: id(), text: `💳 @${r.username} balansni ${amount.toLocaleString('ru-RU')} ${db.settings.currency} ga to'ldirmoqchi — chekni tekshiring`, read: false, at: Date.now() });
    save(); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/me') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    return send(res, 200, { homeless: !!r.homeless, no: r.no || '', houses: db.houses.filter((h) => h.owner === r.username).map(pubHouse), offersIn: db.offers.filter((o) => o.status === 'pending' && (o.initiator === 'buyer' ? o.seller : o.buyer) === r.username).map((o) => ({ ...o, buyerCanPay: (db.residents.find((x) => x.username === o.buyer)?.balance || 0) >= o.price })), offersOut: db.offers.filter((o) => (o.initiator === 'buyer' ? o.buyer : o.seller) === r.username).slice(-20).reverse(), balance: r.balance || 0, tx: db.tx.filter((t) => t.user === r.username).slice(-30).reverse(), shop: db.settings.shop, plots: db.plots.filter((x) => x.owner === r.username && x.status !== 'rejected').map(pubPlot) });
  }
  // Uy / mashina / joydagi binoni o'zgartirish — hamyondan to'lanadi
  if (m === 'POST' && p === '/api/upgrade') {
    // body: { style?, color?: '#rrggbb', buyCar?: {t, c}, recolorCar?: {i, c}, removeCar?: i, plotId? }
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const shop = db.settings.shop, HEX = /^#[0-9a-f]{6}$/i;
    const target = b.plotId ? db.plots.find((x) => x.id === b.plotId && x.owner === r.username && x.status === 'sold') : b.houseId ? db.houses.find((h) => h.id === b.houseId && h.owner === r.username) : r;
    if (!b.plotId && !b.houseId && r.homeless) return send(res, 400, { error: 'Sizda asosiy uy yo\'q' });
    if (!target) return send(res, 404, { error: 'Topilmadi' });
    migrateCars(r);
    let cost = 0; const what = [];
    if (b.plotId && target.built === false) { if (!b.style) return send(res, 400, { error: 'Uy dizaynini tanlang' }); cost += shop.build; what.push('uy qurildi'); }
    if (b.style && (b.style !== (target.style || 'oddiy') || (b.plotId && target.built === false))) { if (stylePrice(b.style) === null) return send(res, 400, { error: 'Dizayn topilmadi' }); cost += stylePrice(b.style); what.push('dizayn: ' + b.style); }
    if (b.color && HEX.test(b.color) && b.color !== target.colorHex && !what.length) { cost += shop.repaint; what.push("uy rangi"); }
    if (!b.plotId && !b.houseId && b.buyCar) {
      if (!(b.buyCar.t in shop.cars) || b.buyCar.t === 'yoq') return send(res, 400, { error: 'Mashina topilmadi' });
      if (r.cars.length >= 12) return send(res, 400, { error: "Uy oldiga ko'pi bilan 12 ta mashina sig'adi" });
      cost += shop.cars[b.buyCar.t]; what.push('yangi mashina: ' + b.buyCar.t);
    }
    if (!b.plotId && b.recolorCar && r.cars[b.recolorCar.i] && HEX.test(b.recolorCar.c)) { cost += shop.repaint; what.push('mashina rangi'); }
    if (!b.plotId && Number.isInteger(b.removeCar) && r.cars[b.removeCar]) what.push('mashina olib tashlandi');
    if (!what.length && b.bname !== undefined && String(b.bname) !== (target.bname || '')) what.push('nomi');
    if (!what.length) return send(res, 400, { error: "Hech narsa o'zgarmadi" });
    if ((r.balance || 0) < cost) return send(res, 402, { error: `Hamyonda pul yetarli emas. Kerak: ${cost.toLocaleString('ru-RU')} ${db.settings.currency}, bor: ${(r.balance || 0).toLocaleString('ru-RU')}` });
    r.balance = (r.balance || 0) - cost;
    if (b.style) target.style = b.style;
    if (b.plotId && target.built === false) target.built = true;
    if (b.color && HEX.test(b.color)) target.colorHex = b.color.toLowerCase();
    if (!b.plotId && b.buyCar) r.cars.push({ t: b.buyCar.t, c: HEX.test(b.buyCar.c || '') ? b.buyCar.c.toLowerCase() : '#c0392b', price: shop.cars[b.buyCar.t], at: Date.now() });
    if (!b.plotId && b.recolorCar && r.cars[b.recolorCar.i] && HEX.test(b.recolorCar.c)) r.cars[b.recolorCar.i].c = b.recolorCar.c.toLowerCase();
    if (!b.plotId && Number.isInteger(b.removeCar) && r.cars[b.removeCar]) r.cars.splice(b.removeCar, 1);
    if (b.style) target.stylePrice = stylePrice(b.style) || 0;
    if (b.bname !== undefined) target.bname = String(b.bname).slice(0, 40);
    if (cost) addTx(r, -cost, (b.plotId ? `"${target.name}": ` : 'Uy: ') + what.join(', '));
    save();
    return send(res, 200, { ok: true, balance: r.balance, cost });
  }
  if (m === 'POST' && p === '/api/plots/request') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    // Joy: belgilangan nuqta markazida, sotix soniga teng kvadrat (1 sotix = 100 m²)
    const sotix = Math.round(Number(b.sotix) * 10) / 10;
    if (!(sotix >= 0.5 && sotix <= 200)) return send(res, 400, { error: 'Sotix soni 0.5 dan 200 gacha bo\'lsin' });
    if (!isFinite(b.x) || !isFinite(b.z)) return send(res, 400, { error: 'Joyni belgilang' });
    const half = Math.sqrt(sotix * 100) / 2;
    const x1 = b.x - half, x2 = +b.x + half, z1 = b.z - half, z2 = +b.z + half;
    if (![x1, x2, z1, z2].every(isFinite)) return send(res, 400, { error: "Joy noto'g'ri" });
    const area = Math.round(sotix * 100);
    if (area < 20) return send(res, 400, { error: 'Joy juda kichik (kamida 20 m²)' });
    if (area > 20000) return send(res, 400, { error: 'Joy juda katta (ko\'pi bilan 20 000 m²)' });
    const plot = { x1, x2, z1, z2 };
    if (!ROADS) return send(res, 503, { error: "Shahrisabz xaritasi serverda hali tayyorlanmoqda — 1–2 daqiqadan keyin qayta urinib ko'ring" });
    if (!rectClear(x1, z1, x2, z2) || overlaps(plot) || db.residents.some((q) => !q.homeless && q.x > x1 - HOUSE_R && q.x < x2 + HOUSE_R && q.z > z1 - HOUSE_R && q.z < z2 + HOUSE_R) || db.houses.some((h) => h.x > x1 - HOUSE_R && h.x < x2 + HOUSE_R && h.z > z1 - HOUSE_R && h.z < z2 + HOUSE_R)) { // yo'lga tushsa — o'zi chetga suriladi
      const f = findFreeRect(+b.x, +b.z, half); if (!f) return send(res, 409, { error: "Bu atrofda yo'lga tegmaydigan bo'sh joy topilmadi — boshqa joyni tanlang" });
      Object.assign(plot, { x1: f.x - half, x2: f.x + half, z1: f.z - half, z2: f.z + half });
    }
    Object.assign(plot, {
      id: id(), owner: r.username, area, sotix, price: Math.round(sotix * db.settings.pricePerSotix),
      type: TYPES.includes(b.type) ? b.type : 'boshqa', name: String(b.name || '').slice(0, 60) || r.username,
      contact: String(b.contact || '').slice(0, 80), status: 'pending', mahalla: String(b.mahalla || '').slice(0, 80), street: String(b.street || '').slice(0, 80), createdAt: Date.now(),
    });
    plot.style = 'oddiy'; plot.built = false; // joy bo'sh — uy pulga quriladi
    // Hamyonda pul yetmasa — so'rov adminga bormaydi, rad etiladi
    if ((r.balance || 0) < plot.price) return send(res, 402, { error: `Hamyoningizda pul yetarli emas: kerak ${plot.price.toLocaleString('ru-RU')}, bor ${(r.balance || 0).toLocaleString('ru-RU')} ${db.settings.currency}. Avval balansni to'ldiring.`, need: plot.price - (r.balance || 0) });
    r.balance -= plot.price; plot.status = 'sold'; plot.paidFromBalance = true;
    addTx(r, -plot.price, `Joy sotib olindi: ${plot.name} (${sotix} sotix)`);
    db.notifications.unshift({ id: id(), plotId: plot.id, text: `✅ @${r.username} hamyonidan "${plot.name}" (${sotix} sotix) joyini sotib oldi — ${plot.price.toLocaleString('ru-RU')} ${db.settings.currency}`, read: false, at: Date.now() });
    db.plots.push(plot);
    save();
    return send(res, 200, { ok: true, plot: pubPlot(plot) });
  }

  // ---- UMUMIY CHAT (@shahrisabz.online.shahar): matn, rasm, video, ovoz, uy kartochkasi, sotuv e'loni, lokatsiya ----
  if (m === 'POST' && p === '/api/group/list') {
    const b = await body(req); const after = Number(b.after) || 0;
    return send(res, 200, { messages: db.group.filter((x) => x.at > after).slice(-200) });
  }
  if (m === 'POST' && p === '/api/group/send') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Yozish uchun saytga kiring' });
    const msg = { id: id(), from: r.username, at: Date.now(), type: 'text', text: String(b.text || '').trim().slice(0, 2000) };
    if (b.file?.data) {
      const mt = String(b.file.type || ''); const kind = mt.startsWith('image/') ? 'image' : mt.startsWith('video/') ? 'video' : mt.startsWith('audio/') ? 'audio' : null;
      if (!kind) return send(res, 400, { error: 'Faqat rasm, video yoki ovoz' });
      const buf = Buffer.from(String(b.file.data).split(',').pop(), 'base64'); if (buf.length > 20e6) return send(res, 413, { error: 'Fayl 20 MB dan katta' });
      const ext = (mt.split('/')[1] || 'bin').split(';')[0].replace(/[^a-z0-9]/g, '').slice(0, 5);
      const fn = id() + id() + '.' + ext; fs.mkdirSync(UPLOADS, { recursive: true }); fs.writeFileSync(path.join(UPLOADS, fn), buf);
      Object.assign(msg, { type: kind, url: '/uploads/' + fn });
    } else if (b.kind === 'home' || b.kind === 'sell' || b.kind === 'loc') { // uyim: kartochka / sotuv e'loni / lokatsiya
      const tgt = b.houseId ? db.houses.find((h) => h.id === b.houseId && h.owner === r.username) : (!r.homeless ? r : null);
      if (!tgt) return send(res, 400, { error: 'Sizda uy yo\'q' });
      Object.assign(msg, { type: b.kind, x: tgt.x, z: tgt.z, style: tgt.style || 'oddiy', addr: [tgt.mahalla, tgt.street, tgt.no && 'uy ' + tgt.no].filter(Boolean).join(', '), value: (stylePrice(tgt.style || 'oddiy') || 0) + (tgt === r ? (r.cars || []).reduce((a, c) => a + (db.settings.shop.cars[c.t] || 0), 0) : 0), houseKind: b.houseId ? 'house' : 'main', houseId: b.houseId || '' });
      if (b.kind === 'sell') { const pr = Math.round(Number(b.price)); if (!(pr > 0)) return send(res, 400, { error: 'Sotish narxini yozing' }); msg.price = pr; }
    } else if (!msg.text) return send(res, 400, { error: "Xabar bo'sh" });
    db.group.push(msg); if (db.group.length > 3000) db.group = db.group.slice(-3000); save();
    return send(res, 200, { ok: true, message: msg });
  }
  // ---- CHAT (uy egalari o'rtasida, hamma xabarlar saqlanadi) ----
  if (m === 'POST' && p.startsWith('/api/chat/')) {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const me = r.username;
    if (p === '/api/chat/send') {
      const to = cleanName(b.to), text = String(b.text || '').trim().slice(0, 2000);
      if (!db.residents.some((x) => x.username === to)) return send(res, 404, { error: 'Bunday uy egasi yo\'q' });
      if (to === me) return send(res, 400, { error: 'O\'zingizga yozib bo\'lmaydi' });
      const msg = { id: id(), from: me, to, text, at: Date.now(), read: false, type: 'text' };
      if (b.file?.data) { // rasm yoki video
        const mt = String(b.file.type || ''); const kind = mt.startsWith('image/') ? 'image' : mt.startsWith('video/') ? 'video' : mt.startsWith('audio/') ? 'audio' : null;
        if (!kind) return send(res, 400, { error: 'Faqat rasm, video yoki ovozli xabar yuborish mumkin' });
        const buf = Buffer.from(String(b.file.data).split(',').pop(), 'base64');
        if (buf.length > 20e6) return send(res, 413, { error: 'Fayl 20 MB dan katta' });
        const ext = (mt.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5);
        const fn = id() + id() + '.' + ext; fs.mkdirSync(UPLOADS, { recursive: true }); fs.writeFileSync(path.join(UPLOADS, fn), buf);
        Object.assign(msg, { type: kind, url: '/uploads/' + fn });
      } else if (isFinite(b.lat) && isFinite(b.lon)) Object.assign(msg, { type: 'location', lat: +b.lat, lon: +b.lon, label: String(b.label || '').slice(0, 120) });
      else if (!text) return send(res, 400, { error: 'Xabar bo\'sh' });
      db.messages.push(msg); save();
      return send(res, 200, { ok: true, message: msg });
    }
    if (p === '/api/chat/history') {
      const w = cleanName(b.with);
      const list = db.messages.filter((x) => (x.from === me && x.to === w) || (x.from === w && x.to === me));
      let ch = false; list.forEach((x) => { if (x.to === me && !x.read) { x.read = true; ch = true; } }); if (ch) save();
      return send(res, 200, { messages: list });
    }
    if (p === '/api/chat/inbox') {
      const conv = {};
      for (const x of db.messages) {
        if (x.from !== me && x.to !== me) continue;
        const o = x.from === me ? x.to : x.from;
        const c = conv[o] ||= { with: o, last: '', at: 0, unread: 0 };
        c.last = x.type === 'image' ? '📷 Rasm' : x.type === 'video' ? '🎬 Video' : x.type === 'location' ? '📍 Lokatsiya' : x.text; c.at = x.at; if (x.to === me && !x.read) c.unread++;
      }
      return send(res, 200, { conversations: Object.values(conv).sort((a, b) => b.at - a.at) });
    }
  }
  // ---- ADMIN ----
  if (m === 'POST' && p === '/api/admin/login') {
    const b = await body(req);
    if (b.login !== ADMIN_LOGIN || b.password !== ADMIN_PASSWORD) return send(res, 403, { error: "Login yoki parol noto'g'ri" });
    const t = ADMIN_TOKEN;
    return send(res, 200, { token: t });
  }
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin emas' });
    const b = m === 'POST' ? await body(req) : {};
    if (p === '/api/admin/data') { const ig = db.settings.instagram; return send(res, 200, { pendingTopups: db.topups.filter((t) => t.status === 'pending').length, residents: db.residents.map((r) => ({ ...pub(r), balance: r.balance || 0 })), houses: db.houses.map(pubHouse), offers: db.offers.slice(-200).reverse(), shop: db.settings.shop, plots: db.plots, notifications: db.notifications, settings: { ...db.settings, instagram: { igUserId: ig.igUserId, verifyToken: ig.verifyToken, username: ig.username, lastSync: ig.lastSync, hasToken: !!ig.token, expiresAt: ig.expiresAt || 0, oauthReady: !!(IG_APP_ID && IG_APP_SECRET) } }, browserWatcher: db.settings.browserWatcher || null, followerStats: db.followerStats.slice(-300), residentsFromFollow: db.residents.filter((r) => r.source === 'follow').length, lastWebhook: db.settings.lastWebhook || 0, webhookLog: db.webhookLog, watcher: { username: db.settings.watcher.username, connected: !!db.settings.watcher.sessionid, lastCheck: db.settings.watcher.lastCheck, lastError: db.settings.watcher.lastError }, followSecret: FOLLOW_SECRET, messageCount: db.messages.length }); }
    if (p === '/api/admin/followers') {
      const names = String(b.usernames || '').split(/[\s,;]+/).filter(Boolean);
      const added = names.map((n) => addFollower(n, 'admin')).filter(Boolean).map((r) => r.username);
      return send(res, 200, { ok: true, added });
    }
    if (p === '/api/admin/plot') {
      const pl = db.plots.find((x) => x.id === b.id); if (!pl) return send(res, 404, { error: 'Topilmadi' });
      if (['sold', 'rejected', 'pending'].includes(b.status)) pl.status = b.status;
      db.notifications.forEach((n) => { if (n.plotId === pl.id) n.read = true; });
      save(); return send(res, 200, { ok: true });
    }

    if (p === '/api/admin/instagram') {
      const ig = db.settings.instagram;
      if (b.token !== undefined) { ig.token = String(b.token).trim(); ig.kind = ig.token.startsWith('IG') ? 'instagram' : 'facebook'; }
      if (b.igUserId !== undefined) ig.igUserId = String(b.igUserId).trim();
      if (b.verifyToken !== undefined) ig.verifyToken = String(b.verifyToken).trim();
      save(); return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/instagram/test') {
      try { const a = await igGet(`${db.settings.instagram.igUserId}?fields=username,followers_count,media_count,profile_picture_url`); db.settings.instagram.username = a.username; save(); return send(res, 200, a); }
      catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (p === '/api/admin/instagram/sync') {
      try { return send(res, 200, await igSync()); } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (p === '/api/admin/chats') return send(res, 200, { messages: db.messages.slice(-500) });

    if (p === '/api/admin/watcher') {
      const w = db.settings.watcher;
      if (b.sessionid) { w.sessionid = decodeURIComponent(String(b.sessionid).trim()); w.pk = ''; }
      if (b.csrftoken) w.csrftoken = String(b.csrftoken).trim();
      if (b.dsUserId) w.pk = String(b.dsUserId).trim();
      if (b.username) { w.username = cleanName(b.username); w.pk = ''; }
      save();
      try { return send(res, 200, await watchFollowers()); } catch (e) { w.lastError = e.message; save(); return send(res, 400, { error: e.message }); }
    }
    if (p === '/api/admin/passwords') return send(res, 200, { defaultPass: db.settings.defaultPass, queue: db.dmQueue.length, dmError: db.settings.watcher.dmError || '', list: db.residents.slice().sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ id: r.id, username: r.username, source: r.source, createdAt: r.createdAt, password: r.mustChange ? db.settings.defaultPass + ' (umumiy)' : (r.plainPass || '—'), changed: !r.mustChange, delivered: !!r.delivered, loggedIn: !!r.lastLogin, text: passText(r), canDm: !!r.pk })) });
    if (p === '/api/admin/default-pass') { const v = String(b.password || ''); if (v.length < 4) return send(res, 400, { error: 'Kamida 4 belgi' }); const old = db.settings.defaultPass; db.settings.defaultPass = v; db.residents.forEach((r) => { if (r.mustChange || r.pass === hash(old)) { r.pass = hash(v); r.mustChange = true; } }); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/resend') { const r = db.residents.find((x) => x.id === b.id); if (r && r.pk) { r.delivered = false; r.dmTries = 0; db.dmQueue.unshift(r.id); save(); } return send(res, 200, { ok: true, queued: !!(r && r.pk) }); }
    if (p === '/api/admin/delivered') { const r = db.residents.find((x) => x.id === b.id); if (r) { r.delivered = true; save(); } return send(res, 200, { ok: true }); }
    if (p === '/api/admin/balance') {
      const r = db.residents.find((x) => x.id === b.id); const amt = Math.round(Number(b.amount));
      if (!r || !isFinite(amt) || !amt) return send(res, 400, { error: "Summa noto'g'ri" });
      r.balance = (r.balance || 0) + amt; addTx(r, amt, amt > 0 ? "Admin pul tashladi" : "Admin pul oldi"); save();
      return send(res, 200, { ok: true, balance: r.balance });
    }
    if (p === '/api/admin/shop') {
      const sh = db.settings.shop;
      for (const k of ['houses', 'cars']) if (b[k]) for (const [n, v] of Object.entries(b[k])) { const nn = String(n).trim().toLowerCase().slice(0, 20); if (!nn) continue; if (v === null) delete sh[k][nn]; else if (Number(v) >= 0) sh[k][nn] = Math.round(Number(v)); }
      if (Number(b.repaint) >= 0) sh.repaint = Math.round(Number(b.repaint));
      if (Number(b.build) >= 0) sh.build = Math.round(Number(b.build));
      if (b.buildings && typeof b.buildings === 'object') for (const [k, v] of Object.entries(b.buildings)) {
        const key = String(k).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24); if (!key) continue;
        if (v === null) { delete sh.buildings[key]; continue; }
        const cur = sh.buildings[key] || {}; sh.buildings[key] = { n: String(v.n ?? cur.n ?? key).slice(0, 40), i: String(v.i ?? cur.i ?? '🏢').slice(0, 4), m: MODELS.includes(v.m) ? v.m : (cur.m || 'shop'), p: Number(v.p) >= 0 ? Math.round(Number(v.p)) : (cur.p || 0) };
      }
      save(); return send(res, 200, { ok: true, shop: sh });
    }
    if (p === '/api/admin/place') { // {n, kind: 'mahalla'|'kocha', coords: "39.05, 66.82"} — o'chirish: {n, kind, remove:true}
      const n = String(b.n || '').trim().slice(0, 60), kind = ['mahalla', 'joy'].includes(b.kind) ? b.kind : 'kocha';
      if (!n) return send(res, 400, { error: 'Nom kerak' });
      db.customPlaces = db.customPlaces.filter((x) => !(x.n === n && x.kind === kind));
      if (!b.remove) {
        const m = String(b.coords || '').match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
        if (!m) return send(res, 400, { error: "Koordinatani shunday kiriting: 39.05123, 66.82456" });
        let lat = +m[1], lon = +m[2]; if (lat > 60) [lat, lon] = [lon, lat];
        if (lat < 38.8 || lat > 39.3 || lon < 66.5 || lon > 67.2) return send(res, 400, { error: 'Bu koordinata Shahrisabzdan tashqarida' });
        db.customPlaces.push({ n, kind, lat, lon, mahalla: String(b.mahalla || '').slice(0, 60), icon: String(b.icon || '').slice(0, 4), cat: String(b.cat || '').slice(0, 40) });
      }
      save(); return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/payment') { // karta(lar) va yo'riqnoma
      const pay = db.settings.payment;
      if (Array.isArray(b.cards)) pay.cards = b.cards.slice(0, 10).map((c) => ({ number: String(c.number || '').replace(/[^\d ]/g, '').trim().slice(0, 23), holder: String(c.holder || '').slice(0, 60), bank: String(c.bank || '').slice(0, 40), link: /^https:\/\//.test(c.link || '') ? String(c.link).slice(0, 300) : '', active: c.active !== false })).filter((c) => c.number.replace(/ /g, '').length >= 12);
      if (b.note !== undefined) pay.note = String(b.note).slice(0, 500);
      if (Number(b.min) >= 0) pay.min = Math.round(Number(b.min));
      save(); return send(res, 200, { ok: true, payment: pay });
    }
    if (p === '/api/admin/topups') return send(res, 200, { topups: db.topups.slice(-300).reverse(), payment: db.settings.payment });
    if (p === '/api/admin/topup') {
      const t = db.topups.find((x) => x.id === b.id); if (!t) return send(res, 404, { error: 'Topilmadi' });
      if (t.status !== 'pending') return send(res, 400, { error: 'Bu so\'rov allaqachon ko\'rib chiqilgan' });
      const r = db.residents.find((x) => x.username === t.user); if (!r) return send(res, 404, { error: 'Foydalanuvchi topilmadi' });
      if (b.action === 'approve') {
        const amt = Math.round(Number(b.amount ?? t.amount)); if (!(amt > 0)) return send(res, 400, { error: "Summa noto'g'ri" });
        t.approved = amt; r.balance = (r.balance || 0) + amt; addTx(r, amt, "Balans to'ldirildi (karta orqali)");
        t.status = 'approved';
      } else { t.status = 'rejected'; t.reason = String(b.reason || '').slice(0, 200); }
      t.doneAt = Date.now(); save(); return send(res, 200, { ok: true, balance: r.balance });
    }
    if (p === '/api/admin/tx') return send(res, 200, { tx: db.tx.slice(-300).reverse() });
    if (p === '/api/admin/resident/delete') { db.residents = db.residents.filter((r) => r.id !== b.id); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/resident/reset') { const r = db.residents.find((x) => x.id === b.id); if (r) { r.pass = hash(db.settings.defaultPass); r.mustChange = true; delete r.plainPass; r.delivered = false; save(); if (r.igsid) igPost(`${db.settings.instagram.igUserId}/messages`, { recipient: { id: r.igsid }, message: { text: passText(r) } }).then(() => { r.delivered = true; save(); }).catch(() => {}); } return send(res, 200, { ok: true, password: r && r.initialPass }); }
    if (p === '/api/admin/settings') { const v = Number(b.pricePerSotix); if (v > 0) db.settings.pricePerSotix = v; if (b.currency) db.settings.currency = String(b.currency).slice(0, 10); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/read') { db.notifications.forEach((n) => (n.read = true)); save(); return send(res, 200, { ok: true }); }
  }
  send(res, 404, { error: 'Not found' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/follow')) { // instagram.com dagi kuzatuvchi skript uchun
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/shahrisabz-watcher.user.js') { // admin tokeni bilan — ichida maxfiy kalit bor
      if (url.searchParams.get('t') !== ADMIN_TOKEN) { res.writeHead(401); return res.end('Admin emas'); }
      const site = SITE() || `https://${req.headers.host}`;
      const js = fs.readFileSync(path.join(__dirname, 'watcher.template.js'), 'utf8').replace('__SITE__', site).replace('__HOST__', new URL(site).hostname).replace('__SECRET__', FOLLOW_SECRET);
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); return res.end(js);
    }
    if (url.pathname.startsWith('/topup-img/')) { // to'lov cheklari faqat admin uchun
      if (url.searchParams.get('t') !== ADMIN_TOKEN) { res.writeHead(401); return res.end(); }
      const f = path.normalize(path.join(TOPUPS, path.basename(url.pathname)));
      if (!f.startsWith(TOPUPS) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/' + (path.extname(f).slice(1) === 'png' ? 'png' : 'jpeg') }); return fs.createReadStream(f).pipe(res);
    }
    if (url.pathname.startsWith('/uploads/')) {
      const f = path.normalize(path.join(UPLOADS, path.basename(url.pathname)));
      if (!f.startsWith(UPLOADS) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      const ext = path.extname(f).slice(1);
      res.writeHead(200, { 'Content-Type': ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', webm: 'audio/webm', ogg: 'audio/ogg', mpeg: 'audio/mpeg', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4a: 'audio/mp4', wav: 'audio/wav', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', quicktime: 'video/quicktime', mov: 'video/quicktime' })[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' });
      return fs.createReadStream(f).pipe(res);
    }
    if (url.pathname.startsWith('/avatar/')) {
      const r = db.residents.find((x) => x.username === cleanName(decodeURIComponent(url.pathname.slice(8))));
      const f = r && (await avatarFile(r));
      if (!f) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }); return fs.createReadStream(f).pipe(res);
    }
    if (url.pathname === '/api/weather') { // Shahrisabzning hozirgi ob-havosi (Open-Meteo, bepul, kalitsiz) — 15 daqiqa keshlanadi
      if (!weather || Date.now() - weather.at > 15 * 60 * 1000) {
        try {
          const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=39.0578&longitude=66.8297&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,precipitation,is_day&timezone=Asia%2FTashkent', { signal: AbortSignal.timeout(10000) });
          const j = await r.json(); if (j.current) weather = { at: Date.now(), ...j.current };
        } catch (e) { console.log('Ob-havo:', e.message); }
      }
      return send(res, 200, weather || { error: "Ob-havo hozircha yo'q" });
    }
    if (url.pathname === '/buildings.json') {
      if (!fs.existsSync(BLD_FILE)) { loadBuildings(); return send(res, 200, { b: [] }); }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }); return fs.createReadStream(BLD_FILE).pipe(res);
    }
    if (url.pathname === '/pois.json') { // OSM joylari + admin qo'lda kiritgan joylar
      let osm = []; try { osm = JSON.parse(fs.readFileSync(POI_FILE, 'utf8')).joylar; } catch {}
      const manual = db.customPlaces.filter((c) => c.kind === 'joy').map((c) => ({ n: c.n, i: c.icon || '📍', c: c.cat || 'Joy', lat: c.lat, lon: c.lon, a: c.mahalla || '', admin: true }));
      return send(res, 200, { joylar: [...manual, ...osm] });
    }
    if (url.pathname === '/places.json') { // rasmiy ro'yxat + topilgan koordinatalar
      const list = JSON.parse(fs.readFileSync(path.join(PUB, 'mahallas-geo.json'), 'utf8')).mahallalar;
      return send(res, 200, { places: list.map(({ n, k, lat, lon }) => ({ n, k, lat, lon })) });
    }
    if (url.pathname === '/osm.json') {
      if (req.method === 'HEAD') { const ok = fs.existsSync(OSM_FILE); res.writeHead(ok ? 200 : 503); if (!ok) getOsm().catch(() => {}); return res.end(); }
      const buf = await getOsm();
      if (!buf) return send(res, 503, { error: 'Xarita hozircha yuklanmadi' });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' }); return res.end(buf);
    }
    let f = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : url.pathname));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    const ext = path.extname(f); // html/js/css har doim yangisi olinsin (eski kesh ko'rinmasin)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ['.html', '.js', '.css', '.json'].includes(ext) ? 'no-cache' : 'public, max-age=604800' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Server xatosi' }); }
}).listen(PORT, () => console.log(`Shahrisabz Online: http://localhost:${PORT}  (admin: /admin)`));

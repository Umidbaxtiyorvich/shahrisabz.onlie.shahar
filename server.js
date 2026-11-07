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
const passText = (r) => `Assalomu alaykum, @${r.username}! 🏠 Shahrisabz online shahrida uyingiz qurildi.\nKirish: ${SITE() || 'saytimiz'}\nLogin: ${r.username}\nParol: ${r.initialPass}\nParolni hech kimga bermang.`;
function addFollower(username, source) {
  const u = cleanName(username);
  if (!u) return null;
  let r = db.residents.find((x) => x.username === u);
  if (r) return r;
  const s = edgeSpot();
  const pw = genPass();
  r = { id: id(), username: u, link: 'https://instagram.com/' + u, x: s.x, z: s.z, mahalla: 'Shahar chekkasi', street: '', color: Math.floor(Math.random() * 360), createdAt: Date.now(), source, pass: hash(pw), initialPass: pw, delivered: false };
  db.residents.push(r);
  save();
  return r;
}

const pub = (r) => ({ id: r.id, username: r.username, link: r.link, x: r.x, z: r.z, mahalla: r.mahalla, street: r.street, color: r.color, claimed: !!r.lastLogin });
const pubPlot = (p) => ({ id: p.id, owner: p.owner, x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, area: p.area, price: p.price, type: p.type, name: p.name, status: p.status, mahalla: p.mahalla, street: p.street });

function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
}
function userAuth(b) {
  const r = db.residents.find((x) => x.username === cleanName(b.username));
  if (!r || !r.pass || r.pass !== hash(b.password || '')) return null;
  return r;
}
const isAdmin = (req) => adminTokens.has(req.headers['x-admin-token']);
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
const OSM_FILE = path.join(__dirname, 'data', 'osm.json');
const OSM_BBOX = '39.015,66.775,39.105,66.885';
let osmLoading = null;
async function getOsm() {
  if (fs.existsSync(OSM_FILE)) return fs.readFileSync(OSM_FILE);
  const bundled = path.join(PUB, 'osm.json'); if (fs.existsSync(bundled)) return fs.readFileSync(bundled);
  if (osmLoading) return osmLoading;
  osmLoading = (async () => {
    const q = `[out:json][timeout:120];(way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|service)$"](${OSM_BBOX});node["place"~"^(neighbourhood|suburb|quarter|village|hamlet)$"](${OSM_BBOX}););out geom;`;
    const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
    for (const u of mirrors) {
      try {
        const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'shahrisabz-online-shahar' }, signal: AbortSignal.timeout(130000) });
        if (!r.ok) { console.log('OSM', u, r.status); continue; }
        const j = await r.json();
        const out = { ways: [], places: [] };
        for (const e of j.elements) {
          if (e.type === 'way' && e.geometry) out.ways.push({ t: e.tags.highway, n: e.tags['name:uz'] || e.tags.name || '', g: e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
          else if (e.type === 'node' && e.tags?.name) out.places.push({ n: e.tags['name:uz'] || e.tags.name, lat: e.lat, lon: e.lon });
        }
        if (!out.ways.length) continue;
        const buf = Buffer.from(JSON.stringify(out));
        fs.mkdirSync(path.dirname(OSM_FILE), { recursive: true }); fs.writeFileSync(OSM_FILE, buf);
        console.log(`OSM saqlandi: ${out.ways.length} yo'l, ${out.places.length} mahalla`);
        return buf;
      } catch (e) { console.log('OSM xato', u, e.message); }
    }
    return null;
  })().finally(() => { osmLoading = null; });
  return osmLoading;
}
getOsm().catch(() => {}); // server ishga tushganda oldindan yuklab qo'yadi

async function igPost(pathq, payload) {
  const ig = db.settings.instagram;
  const base = ig.kind === 'instagram' ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
  const r = await fetch(`${base}/${pathq}?access_token=${encodeURIComponent(ig.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json(); if (j.error) throw new Error('Instagram: ' + j.error.message); return j;
}
// Direct'ga xabar yozgan odamga: uy quriladi (bo'lmasa) va parol avtomatik javob bo'lib boradi (rasmiy API, 24 soat oynasi)
async function handleDm(senderId) {
  const info = await igGet(`${senderId}?fields=username`);
  if (!info.username) return;
  const r = addFollower(info.username, 'direct');
  if (!r.initialPass) { r.initialPass = genPass(); r.pass = hash(r.initialPass); }
  await igPost(`${db.settings.instagram.igUserId}/messages`, { recipient: { id: senderId }, message: { text: passText(r) } });
  r.delivered = true; r.igsid = senderId; save();
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
      const before = db.residents.length; addFollower(u.username, 'follow');
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
setInterval(() => { if (db.settings.watcher.sessionid) watchFollowers().catch((e) => { db.settings.watcher.lastError = e.message; save(); console.log('Watcher:', e.message); }); }, 5 * 60 * 1000);

const TYPES = ['uy', "do'kon", 'kafe', 'ofis', 'mehmonxona', 'maktab', 'masjid', 'bog\'', 'zavod', 'boshqa'];

async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (m === 'GET' && p === '/api/state') {
    return send(res, 200, { residents: db.residents.map(pub), plots: db.plots.filter((x) => x.status !== 'rejected').map(pubPlot), settings: { pricePerM2: db.settings.pricePerM2, currency: db.settings.currency }, types: TYPES });
  }
  // Instagram obuna: avtomatlashtirish (ManyChat / Make / Zapier) shu manzilga yuboradi
  if (m === 'POST' && p === '/api/follow') {
    const b = await body(req);
    if ((req.headers['x-follow-secret'] || b.secret) !== FOLLOW_SECRET) return send(res, 403, { error: "Noto'g'ri secret" });
    const r = addFollower(b.username, 'webhook');
    return r ? send(res, 200, { ok: true, resident: pub(r) }) : send(res, 400, { error: 'username kerak' });
  }
  // Meta webhook tekshiruvi (GET hub.challenge)
  if (p === '/api/instagram/webhook') {
    if (m === 'GET') {
      const vt = url.searchParams.get('hub.verify_token'); if (vt && (vt === FOLLOW_SECRET || vt === db.settings.instagram.verifyToken)) { res.writeHead(200); return res.end(url.searchParams.get('hub.challenge') || ''); }
      return send(res, 403, { error: 'verify failed' });
    }
    const b = await body(req);
    const added = [];
    for (const e of b.entry || []) {
      for (const c of e.changes || []) { const u = c?.value?.from?.username; if (u) { const r = addFollower(u, 'instagram'); if (r) added.push(r.username); } }
      for (const mm of e.messaging || []) {
        if (mm.message?.is_echo || !mm.sender?.id || mm.sender.id === String(db.settings.instagram.igUserId)) continue;
        handleDm(mm.sender.id).catch((er) => console.log('DM xato', er.message));
      }
    }
    return send(res, 200, { ok: true, added });
  }

  if (m === 'GET' && p === '/api/instagram/connect') {
    if (!adminTokens.has(url.searchParams.get('t'))) return send(res, 401, { error: 'Admin emas' });
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
    return send(res, 200, { ok: true, resident: pub(r) });
  }
  if (m === 'POST' && p === '/api/move') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    if (!isFinite(b.x) || !isFinite(b.z)) return send(res, 400, { error: 'Joy tanlang' });
    r.x = Math.round(b.x); r.z = Math.round(b.z);
    r.mahalla = String(b.mahalla || '').slice(0, 80); r.street = String(b.street || '').slice(0, 80);
    save();
    return send(res, 200, { ok: true, resident: pub(r) });
  }
  if (m === 'POST' && p === '/api/plots/request') {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const x1 = Math.min(b.x1, b.x2), x2 = Math.max(b.x1, b.x2), z1 = Math.min(b.z1, b.z2), z2 = Math.max(b.z1, b.z2);
    if (![x1, x2, z1, z2].every(isFinite)) return send(res, 400, { error: "Joy noto'g'ri" });
    const area = Math.round((x2 - x1) * (z2 - z1));
    if (area < 20) return send(res, 400, { error: 'Joy juda kichik (kamida 20 m²)' });
    if (area > 20000) return send(res, 400, { error: 'Joy juda katta (ko\'pi bilan 20 000 m²)' });
    const plot = { x1, x2, z1, z2 };
    if (overlaps(plot)) return send(res, 409, { error: 'Bu joy band — boshqa joy tanlang' });
    Object.assign(plot, {
      id: id(), owner: r.username, area, price: area * db.settings.pricePerM2,
      type: TYPES.includes(b.type) ? b.type : 'boshqa', name: String(b.name || '').slice(0, 60) || r.username,
      contact: String(b.contact || '').slice(0, 80), status: 'pending', mahalla: String(b.mahalla || '').slice(0, 80), street: String(b.street || '').slice(0, 80), createdAt: Date.now(),
    });
    db.plots.push(plot);
    db.notifications.unshift({ id: id(), plotId: plot.id, text: `@${r.username} "${plot.name}" (${plot.type}) uchun ${area} m² joyni sotib olmoqchi — ${plot.price.toLocaleString('ru-RU')} ${db.settings.currency}`, read: false, at: Date.now() });
    save();
    return send(res, 200, { ok: true, plot: pubPlot(plot) });
  }

  // ---- CHAT (uy egalari o'rtasida, hamma xabarlar saqlanadi) ----
  if (m === 'POST' && p.startsWith('/api/chat/')) {
    const b = await body(req); const r = userAuth(b);
    if (!r) return send(res, 403, { error: 'Avval kiring' });
    const me = r.username;
    if (p === '/api/chat/send') {
      const to = cleanName(b.to), text = String(b.text || '').trim().slice(0, 2000);
      if (!db.residents.some((x) => x.username === to)) return send(res, 404, { error: 'Bunday uy egasi yo\'q' });
      if (!text || to === me) return send(res, 400, { error: 'Xabar bo\'sh' });
      const msg = { id: id(), from: me, to, text, at: Date.now(), read: false };
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
        c.last = x.text; c.at = x.at; if (x.to === me && !x.read) c.unread++;
      }
      return send(res, 200, { conversations: Object.values(conv).sort((a, b) => b.at - a.at) });
    }
  }
  // ---- ADMIN ----
  if (m === 'POST' && p === '/api/admin/login') {
    const b = await body(req);
    if (b.login !== ADMIN_LOGIN || b.password !== ADMIN_PASSWORD) return send(res, 403, { error: "Login yoki parol noto'g'ri" });
    const t = crypto.randomBytes(16).toString('hex'); adminTokens.add(t);
    return send(res, 200, { token: t });
  }
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin emas' });
    const b = m === 'POST' ? await body(req) : {};
    if (p === '/api/admin/data') { const ig = db.settings.instagram; return send(res, 200, { residents: db.residents.map(pub), plots: db.plots, notifications: db.notifications, settings: { ...db.settings, instagram: { igUserId: ig.igUserId, verifyToken: ig.verifyToken, username: ig.username, lastSync: ig.lastSync, hasToken: !!ig.token, expiresAt: ig.expiresAt || 0, oauthReady: !!(IG_APP_ID && IG_APP_SECRET) } }, watcher: { username: db.settings.watcher.username, connected: !!db.settings.watcher.sessionid, lastCheck: db.settings.watcher.lastCheck, lastError: db.settings.watcher.lastError }, followSecret: FOLLOW_SECRET, messageCount: db.messages.length }); }
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
      if (b.username) { w.username = cleanName(b.username); w.pk = ''; }
      save();
      try { return send(res, 200, await watchFollowers()); } catch (e) { w.lastError = e.message; save(); return send(res, 400, { error: e.message }); }
    }
    if (p === '/api/admin/passwords') return send(res, 200, { list: db.residents.filter((r) => r.initialPass).sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ id: r.id, username: r.username, password: r.initialPass, delivered: !!r.delivered, loggedIn: !!r.lastLogin, text: passText(r) })) });
    if (p === '/api/admin/delivered') { const r = db.residents.find((x) => x.id === b.id); if (r) { r.delivered = true; save(); } return send(res, 200, { ok: true }); }
    if (p === '/api/admin/resident/delete') { db.residents = db.residents.filter((r) => r.id !== b.id); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/resident/reset') { const r = db.residents.find((x) => x.id === b.id); if (r) { r.initialPass = genPass(); r.pass = hash(r.initialPass); r.delivered = false; save(); if (r.igsid) igPost(`${db.settings.instagram.igUserId}/messages`, { recipient: { id: r.igsid }, message: { text: passText(r) } }).then(() => { r.delivered = true; save(); }).catch(() => {}); } return send(res, 200, { ok: true, password: r && r.initialPass }); }
    if (p === '/api/admin/settings') { const v = Number(b.pricePerM2); if (v > 0) db.settings.pricePerM2 = v; if (b.currency) db.settings.currency = String(b.currency).slice(0, 10); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/read') { db.notifications.forEach((n) => (n.read = true)); save(); return send(res, 200, { ok: true }); }
  }
  send(res, 404, { error: 'Not found' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/osm.json') {
      const buf = await getOsm();
      if (!buf) return send(res, 503, { error: 'Xarita hozircha yuklanmadi' });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' }); return res.end(buf);
    }
    let f = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : url.pathname));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Server xatosi' }); }
}).listen(PORT, () => console.log(`Shahrisabz Online: http://localhost:${PORT}  (admin: /admin)`));

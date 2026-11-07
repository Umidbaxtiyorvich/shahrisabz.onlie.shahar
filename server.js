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
db.settings.instagram ||= { token: '', igUserId: '', verifyToken: '', username: '', lastSync: 0 };
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

function addFollower(username, source) {
  const u = cleanName(username);
  if (!u) return null;
  let r = db.residents.find((x) => x.username === u);
  if (r) return r;
  const s = edgeSpot();
  r = { id: id(), username: u, link: 'https://instagram.com/' + u, x: s.x, z: s.z, mahalla: 'Shahar chekkasi', street: '', color: Math.floor(Math.random() * 360), createdAt: Date.now(), source };
  db.residents.push(r);
  save();
  return r;
}

const pub = (r) => ({ id: r.id, username: r.username, link: r.link, x: r.x, z: r.z, mahalla: r.mahalla, street: r.street, color: r.color, claimed: !!r.pass });
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
  const r = await fetch(`https://graph.facebook.com/v21.0/${pathq}${pathq.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(ig.token)}`);
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
    for (const e of b.entry || []) for (const c of e.changes || e.messaging || []) {
      const u = c?.value?.from?.username || c?.value?.username || c?.sender?.username;
      if (u) { const r = addFollower(u, 'instagram'); if (r) added.push(r.username); }
    }
    return send(res, 200, { ok: true, added });
  }
  if (m === 'POST' && p === '/api/claim') {
    const b = await body(req);
    const r = db.residents.find((x) => x.username === cleanName(b.username));
    if (!r) return send(res, 404, { error: "Bunday obunachi topilmadi. Avval Instagram sahifamizga obuna bo'ling." });
    if (!b.password || b.password.length < 4) return send(res, 400, { error: "Parol kamida 4 belgi bo'lsin" });
    if (r.pass) { if (r.pass !== hash(b.password)) return send(res, 403, { error: "Parol noto'g'ri" }); }
    else { r.pass = hash(b.password); save(); }
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
    if (p === '/api/admin/data') { const ig = db.settings.instagram; return send(res, 200, { residents: db.residents.map(pub), plots: db.plots, notifications: db.notifications, settings: { ...db.settings, instagram: { igUserId: ig.igUserId, verifyToken: ig.verifyToken, username: ig.username, lastSync: ig.lastSync, hasToken: !!ig.token } }, followSecret: FOLLOW_SECRET, messageCount: db.messages.length }); }
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
      if (b.token !== undefined) ig.token = String(b.token).trim();
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
    if (p === '/api/admin/resident/delete') { db.residents = db.residents.filter((r) => r.id !== b.id); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/resident/reset') { const r = db.residents.find((x) => x.id === b.id); if (r) { delete r.pass; save(); } return send(res, 200, { ok: true }); }
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
    let f = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : url.pathname));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Server xatosi' }); }
}).listen(PORT, () => console.log(`Shahrisabz Online: http://localhost:${PORT}  (admin: /admin)`));

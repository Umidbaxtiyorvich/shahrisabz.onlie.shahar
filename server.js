// Shahrisabz Online Shahar — oddiy Node.js server (tashqi kutubxonasiz)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const FOLLOW_SECRET = process.env.FOLLOW_SECRET || 'follow-secret';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUB = path.join(__dirname, 'public');

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { residents: [], plots: [], notifications: [], settings: { pricePerM2: 50000, currency: "so'm" }, edgeCounter: 0 }; }
}
let db = loadDb();
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

const TYPES = ['uy', "do'kon", 'kafe', 'ofis', 'mehmonxona', 'maktab', 'masjid', 'bog\'', 'zavod', 'boshqa'];

async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (m === 'GET' && p === '/api/state') {
    return send(res, 200, { residents: db.residents.map(pub), plots: db.plots.filter((x) => x.status !== 'rejected').map(pubPlot), settings: db.settings, types: TYPES });
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
      if (url.searchParams.get('hub.verify_token') === FOLLOW_SECRET) { res.writeHead(200); return res.end(url.searchParams.get('hub.challenge') || ''); }
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
  // ---- ADMIN ----
  if (m === 'POST' && p === '/api/admin/login') {
    const b = await body(req);
    if (b.password !== ADMIN_PASSWORD) return send(res, 403, { error: "Parol noto'g'ri" });
    const t = crypto.randomBytes(16).toString('hex'); adminTokens.add(t);
    return send(res, 200, { token: t });
  }
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin emas' });
    const b = m === 'POST' ? await body(req) : {};
    if (p === '/api/admin/data') return send(res, 200, { residents: db.residents.map(pub), plots: db.plots, notifications: db.notifications, settings: db.settings, followSecret: FOLLOW_SECRET });
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

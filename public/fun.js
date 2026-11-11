// ✨ Shahar hayoti: tirik hovli, qo'shniga sovg'a, "Mahallam xotirasi", birgalikda shahar bog'i, Shahrisabz tarixi kolleksiyasi, mini-o'yinlar.
// app.js dan C (kontekst) bilan ishga tushiriladi.
import { buildMonuments } from './monuments.js?v=1';
import { initTimeMachine } from './timemachine.js?v=7';
export function initFun(C) {
  const { THREE, scene, camera, renderer, controls, K, $, api, getMe, myRes, modal, closeModal, toast, money, esc, ava, flyTo, toXZ, label, setBalance } = C;
  let fs = null, tab = 'farm', pub = { memories: [], trees: [], history: {} };
  const me = () => getMe();
  const hm = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60} daq` : `${m} daq`; };

  // ---- Xaritadagi belgilar: xotiralar (📜), tarixiy joylar (🏛️), ekilgan daraxtlar ----
  const markers = new THREE.Group(); scene.add(markers); const clickable = [];
  let treeMeshes = [], monuments = null, tm = null;
  function drawPublic() {
    for (const o of [...markers.children]) markers.remove(o); clickable.length = 0;
    for (const m of pub.memories) { const l = label('📜 ' + m.title.slice(0, 22), { size: 26, bg: 'rgba(255,248,225,.95)', fg: '#7a4b00', scale: 1.1 }); l.position.set(m.x, 18, m.z); l.userData.mem = m; markers.add(l); clickable.push(l); }
    for (const [k, h] of Object.entries(pub.history || {})) { const [x, z] = toXZ(h.lat, h.lon); const l = label('🏛️ ' + h.n, { size: 28, bg: 'rgba(32,58,120,.92)', fg: '#fff', scale: 1.5 }); l.position.set(x, ({ oqsaroy: 52, temur: 26, kokgumbaz: 60, dorussiyodat: 45, dorutilovat: 36, chorsu: 30, kitob: 24 }[k] || 30), z); l.userData.hist = k; markers.add(l); clickable.push(l); }
    if (!monuments && Object.keys(pub.history || {}).length) monuments = buildMonuments({ THREE, scene, toXZ, history: pub.history });
    if (monuments && !tm) tm = initTimeMachine({ ...C, history: pub.history, monuments, markersGroup: markers, getMe, myRes, onEra: (e) => (markers.visible = e === 'now') });
    for (const t of treeMeshes) scene.remove(t); treeMeshes = [];
    const parts = K.parts('q-tree-b', 6) || K.parts('tree-oak', 6); if (!parts || !pub.trees.length) return;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (const pr of parts) { const im = new THREE.InstancedMesh(pr.geometry, pr.material, pub.trees.length); im.castShadow = true;
      pub.trees.forEach(([x, z], i) => { const k = .8 + ((i * 37) % 10) / 20; mtx.compose(p.set(x, 0, z), q.setFromAxisAngle(Y, i * 2.4), s.set(k, k, k)); im.setMatrixAt(i, mtx); }); scene.add(im); treeMeshes.push(im); }
  }
  async function loadPublic() { try { pub = await api('/api/fun/public', {}); drawPublic(); } catch {} }
  // belgilar faqat yaqinda ko'rinadi (shahar ustida tartibsizlik bo'lmasin)
  setInterval(() => { const h = camera.position.y, t = controls.target; for (const l of markers.children) l.visible = l.userData.hist ? h < 3000 : h < 700 && Math.hypot(l.position.x - t.x, l.position.z - t.z) < h * 2; }, 500);
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  window.__funClick = (e) => { // app.js onClick dan oldin chaqiriladi
    if (tm?.click(e)) return true;
    mv.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mv, camera);
    const hit = ray.intersectObjects(clickable.filter((o) => o.visible), false)[0];
    if (!hit && monuments) { const mh = ray.intersectObject(monuments, true)[0]; if (mh) { let o = mh.object; while (o && !o.userData.hist) o = o.parent; if (o) { openHistory(o.userData.hist); return true; } } }
    if (!hit) return false;
    const u = hit.object.userData; if (u.mem) openMemory(u.mem); else if (u.hist) openHistory(u.hist); return true;
  };

  // ---- Asosiy oyna ----
  async function load() { if (!myRes()) return null; try { fs = await api('/api/fun/state', me()); setBalance?.(fs.balance); } catch { fs = null; } return fs; }
  async function open(t) {
    if (t) tab = t; if (tab !== 'mem' && tab !== 'hist' && !myRes()) return alert('Avval saytga kiring');
    if (myRes()) await load();
    const TABS = [['farm', '🐔 Hovli'], ['gift', "🎁 Sovg'a"], ['mem', '📜 Xotiralar'], ['city', '🌳 Shahar'], ['hist', '🏛️ Tarix'], ['play', "🕹️ O'yinlar"]];
    modal(`<h3>✨ Shahar hayoti</h3><div class="tabs wrap">${TABS.map(([k, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-ft="${k}">${n}</button>`).join('')}</div><div id="fbody">${body()}</div><button class="ghost" id="nope">Yopish</button>`);
    $('nope').onclick = closeModal; document.querySelectorAll('[data-ft]').forEach((b) => (b.onclick = () => open(b.dataset.ft))); bind();
  }
  const act = async (url, extra, msg) => { try { const j = await api(url, { ...me(), ...extra }); if (j.balance !== undefined) { fs = j; setBalance?.(j.balance); } if (msg) toast(msg(j)); return j; } catch (e) { alert(e.message); return null; } };

  function body() {
    const f = fs;
    if (tab === 'farm') return `<div class="wallet">🏡 Sizning hovlingiz: <b>🐔 ${f.hens} tovuq</b> · <b>🐄 ${f.cows} sigir</b> · 🍇 uzumzor · 🫓 tandir<br><small>Har kuni kirib hosilni yig'ing — tayyor bo'lgach yana o'sadi.</small></div>
      <div class="farm">${f.farm.map((x) => `<div class="fitem ${x.left ? '' : 'ready'}"><div class="fic">${x.n.split(' ')[0]}</div><b>${x.n.split(' ').slice(1).join(' ')}</b><small>${x.locked ? 'hayvon yo\'q' : x.left ? '⏳ ' + hm(x.left) : '✅ tayyor!'}</small><button class="${x.left || x.locked ? 'ghost' : 'ok'}" data-fi="${x.k}" ${x.left || x.locked ? 'disabled' : ''}>+${money(x.reward)}</button></div>`).join('')}</div>
      <div class="row">${Object.entries(f.buy).map(([k, v]) => `<button data-fb="${k}">${v.n} sotib olish — ${money(v.p)}</button>`).join('')}</div><div class="muted">Har bir tovuq tuxumni, sigir sutni ko'paytiradi.</div>`;
    if (tab === 'gift') return `<b>🎁 Qo'shni yoki do'stingizga sovg'a yuboring</b><input id="gto" placeholder="Kimga? nik, masalan: ali_99"><input id="gmsg" maxlength="120" placeholder="Tilak (ixtiyoriy): Hayit muborak!">
      <div class="picks gpicks">${Object.entries(f.gifts).map(([k, v]) => `<button class="pick" data-gk="${k}">${v.n}<small>${money(v.p)}</small></button>`).join('')}</div>
      <b>📥 Sizga kelgan sovg'alar (${f.giftsIn.length})</b>${f.giftsIn.map((g) => `<div class="offer"><span>${g.n} — <b>@${esc(g.from)}</b>${g.msg ? `: «${esc(g.msg)}»` : ''}</span><button class="ghost" data-gback="${esc(g.from)}">🎁 Javob</button></div>`).join('') || '<div class="muted">Hali sovg\'a yo\'q. Siz birinchi bo\'lib yuboring — javob keladi 😊</div>'}`;
    if (tab === 'mem') return `<div class="wallet">📜 <b>Mahallam xotirasi</b> — mahallangiz haqida eski rasm, xotira, bobolaringiz hikoyasini qoldiring. U xaritada shu joyda turadi.${myRes() ? '<br><small>Birinchi xotirangiz uchun +1 000 so\'m</small>' : ''}</div>
      ${myRes() ? '<button class="ok big" id="madd">➕ Xotira qo\'shish</button>' : ''}
      ${[...pub.memories].reverse().slice(0, 40).map((m) => `<div class="mcard" data-mo="${m.id}">${m.img ? `<img src="${esc(m.img)}" loading="lazy">` : '<div class="mph">📜</div>'}<div><b>${esc(m.title)}</b><div class="muted">@${esc(m.from)}${m.year ? ' · ' + esc(m.year) : ''}${m.mahalla ? ' · ' + esc(m.mahalla) : ''} · ❤️ ${m.likes}</div></div></div>`).join('') || '<div class="muted">Hali xotira yo\'q — birinchi bo\'ling!</div>'}`;
    if (tab === 'city') { const c = f.city, g = c.goals[c.done], prev = c.done ? c.goals[c.done - 1].n : 0;
      return `<div class="wallet">🌳 <b>Butun shahar bilan birga</b> — har kim daraxt eksa, Shahrisabz yashillashadi. Maqsadga yetilganda <b>hamma</b> aholi mukofot oladi!</div>
      <div class="cgoal"><div class="big">🌳 ${c.trees.toLocaleString('ru')}</div><div class="muted">ekilgan daraxt</div>${g ? `${'<div class="ebar"><i style="width:' + Math.round((c.trees - prev) / (g.n - prev) * 100) + '%"></i></div>'}<div>Keyingi maqsad: <b>${g.t}</b> — ${g.n.toLocaleString('ru')} ta · hammaga <b>+${money(g.bonus)}</b></div>` : '<b>🏆 Barcha maqsadlar bajarildi!</b>'}</div>
      ${c.goals.map((x, i) => `<div class="muted">${i < c.done ? '✅' : '⬜'} ${x.t} — ${x.n.toLocaleString('ru')} ta</div>`).join('')}
      <button class="ok big" id="cplant">🌱 Daraxt ekish ${c.freeToday ? '(bugun bepul!)' : '— ' + money(3000)}</button><div class="muted">Siz ekdingiz: <b>${c.mine}</b> ta. Daraxtingiz uyingiz atrofida o'sadi.</div>`; }
    if (tab === 'hist') { const list = fs ? fs.history : Object.entries(pub.history).map(([k, v]) => ({ k, ...v })), got = list.filter((x) => x.got).length;
      return `<div class="wallet">🏛️ <b>Shahrisabz tarixi kolleksiyasi</b>: ${got}/${list.length}<br><small>Har bir tarixiy joyga xaritada boring va kartochkani oling (+300). Hammasini yig'sangiz: <b>+8 000</b>!</small></div>
      ${list.map((h) => `<div class="hcard ${h.got ? 'got' : ''}"><div><b>${h.got ? '🃏' : '❔'} ${esc(h.n)}</b> <small class="muted">${esc(h.y)}</small><div class="muted">${h.got ? esc(h.f) : 'Kartochkani olish uchun joyga boring'}</div></div><button class="ghost" data-hgo="${h.k}">📍 Borish</button></div>`).join('')}<div class="muted">Joylashuvlar taxminiy.</div>`; }
    if (tab === 'play') return `<div class="wallet">🕹️ O'ynab pul ishlang! Bugun mukofotli o'yinlar: <b>${f.games.left}</b> ta (har biri ${money(f.games.max)} gacha)</div>
      <div class="games"><button class="gamebtn" data-gm="quiz">🧠<b>Shahrisabz viktorinasi</b><small>Shahringizni qanchalik bilasiz?</small></button>
      <button class="gamebtn" data-gm="pairs">🃏<b>Juftini top</b><small>Xotirani sinang</small></button>
      <button class="gamebtn" data-gm="tandir">🫓<b>Tandir ustasi</b><small>Nonni vaqtida uzing</small></button></div>`;
    return '';
  }
  function bind() {
    document.querySelectorAll('[data-fi]').forEach((b) => (b.onclick = async () => { if (await act('/api/fun/farm', { item: b.dataset.fi }, (j) => `🧺 +${money(j.got)} hovlidan!`)) open(); }));
    document.querySelectorAll('[data-fb]').forEach((b) => (b.onclick = async () => { if (await act('/api/fun/farm', { buy: b.dataset.fb }, () => '🎉 Hovlingizga yangi hayvon keldi!')) open(); }));
    document.querySelectorAll('[data-gk]').forEach((b) => (b.onclick = async () => { const to = $('gto').value.trim(); if (!to) return alert('Kimga yuborishni yozing'); if (await act('/api/fun/gift', { to, kind: b.dataset.gk, msg: $('gmsg').value }, () => `🎁 Sovg'a @${to.replace(/^@/, '')} ga yuborildi!`)) open(); }));
    document.querySelectorAll('[data-gback]').forEach((b) => (b.onclick = () => { $('gto').value = b.dataset.gback; $('gmsg').focus(); }));
    document.querySelectorAll('[data-mo]').forEach((el) => (el.onclick = () => { const m = pub.memories.find((x) => x.id === el.dataset.mo); if (m) openMemory(m); }));
    if ($('madd')) $('madd').onclick = addMemory;
    if ($('cplant')) $('cplant').onclick = async () => { const j = await act('/api/fun/plant', {}, (j) => j.goal ? `🎉 Shahar maqsadi bajarildi: ${j.goal.t}! Hammaga +${money(j.goal.bonus)}` : '🌱 Daraxt ekildi — rahmat!'); if (j) { pub.trees.push(j.pt); drawPublic(); open(); } };
    document.querySelectorAll('[data-hgo]').forEach((b) => (b.onclick = () => { const h = pub.history[b.dataset.hgo]; if (!h) return; closeModal(); const [x, z] = toXZ(h.lat, h.lon); flyTo(x, z, 120); setTimeout(() => openHistory(b.dataset.hgo), 2600); }));
    document.querySelectorAll('[data-gm]').forEach((b) => (b.onclick = () => GAMES[b.dataset.gm]()));
  }

  // ---- Sovg'a (boshqa odamning uyidan ham ochiladi) ----
  async function openGift(to) { tab = 'gift'; await open(); if ($('gto')) $('gto').value = to; }

  // ---- Xotiralar ----
  function addMemory() {
    const t = controls.target; let file = null;
    modal(`<h3>📜 Yangi xotira</h3><div class="hint">📍 Xotira xaritaning hozirgi markazida turadi. Kerakli joyni tanlash uchun oynani yoping, xaritani suring va qayta oching.</div>
      <input id="mt" maxlength="80" placeholder="Sarlavha: masalan, Bobomning choyxonasi"><div class="row"><input id="my" maxlength="12" placeholder="Yili: 1975" style="flex:1"><input id="mm" maxlength="60" placeholder="Mahalla" style="flex:2"></div>
      <textarea id="mx" rows="5" maxlength="1500" placeholder="Xotirangizni yozing…"></textarea><label>Eski rasm (ixtiyoriy)<input type="file" id="mf" accept="image/*"></label><img id="mprev" class="mimg hidden">
      <div class="row"><button class="ok" id="msave">Saqlash</button><button class="ghost" id="nope">Bekor</button></div>`);
    $('nope').onclick = () => open('mem');
    $('mf').onchange = (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 8e6) return alert('Rasm 8 MB dan katta'); const rd = new FileReader(); rd.onload = () => { file = { type: f.type, data: rd.result }; $('mprev').src = rd.result; $('mprev').classList.remove('hidden'); }; rd.readAsDataURL(f); };
    $('msave').onclick = async () => { $('msave').disabled = true; const j = await act('/api/fun/memory', { title: $('mt').value, text: $('mx').value, year: $('my').value, mahalla: $('mm').value, x: t.x, z: t.z, file }, (j) => '📜 Xotira saqlandi' + (j.bonus ? ` · +${money(j.bonus)}` : '')); $('msave') && ($('msave').disabled = false); if (j) { await loadPublic(); open('mem'); } };
  }
  function openMemory(m) {
    modal(`<h3>📜 ${esc(m.title)}</h3><div class="row" style="align-items:center">${ava(m.from)}<div><b>@${esc(m.from)}</b><div class="muted">${[m.year, m.mahalla].filter(Boolean).map(esc).join(' · ')}</div></div></div>
      ${m.img ? `<img class="mimg" style="max-width:100%;max-height:50vh" src="${esc(m.img)}">` : ''}<div style="white-space:pre-wrap">${esc(m.text)}</div>
      <div class="row">${myRes() ? `<button id="mlike">❤️ ${m.likes}</button>` : `<span>❤️ ${m.likes}</span>`}<button class="ghost" id="mfly">📍 Joyi</button>${myRes() && m.from === me().username ? '<button class="no" id="mdel">O\'chirish</button>' : ''}<button class="ghost" id="nope">Yopish</button></div>`);
    $('nope').onclick = closeModal; $('mfly').onclick = () => { closeModal(); flyTo(m.x, m.z, 90); };
    if ($('mlike')) $('mlike').onclick = async () => { const j = await act('/api/fun/memory', { like: m.id }); if (j) { m.likes = j.likes; $('mlike').textContent = '❤️ ' + j.likes; } };
    if ($('mdel')) $('mdel').onclick = async () => { if (confirm("Xotirani o'chirasizmi?") && await act('/api/fun/memory', { del: m.id })) { closeModal(); loadPublic(); } };
  }
  // ---- Tarixiy joy kartochkasi ----
  async function openHistory(k) {
    const h = pub.history[k]; if (!h) return; const [x, z] = toXZ(h.lat, h.lon), near = Math.hypot(controls.target.x - x, controls.target.z - z) < 400;
    if (myRes() && !fs) await load(); const got = fs?.history.find((y) => y.k === k)?.got;
    modal(`<h3>🏛️ ${esc(h.n)}</h3><div class="muted">📅 ${esc(h.y)}</div><div class="hcard got"><div>${esc(h.f)}</div></div>
      ${myRes() ? (got ? '<div class="hint">🃏 Bu kartochka kolleksiyangizda bor</div>' : near ? '<button class="ok big" id="hget">🃏 Kartochkani olish: +300</button>' : '<button class="ghost big" id="hgo">📍 Joyiga borish (kartochka u yerda)</button>') : '<div class="hint">Kartochka yig\'ish uchun saytga kiring</div>'}
      <button class="ghost" id="nope">Yopish</button>`);
    $('nope').onclick = closeModal;
    if ($('hgo')) $('hgo').onclick = () => { closeModal(); flyTo(x, z, 120); setTimeout(() => openHistory(k), 2600); };
    if ($('hget')) $('hget').onclick = async () => { const j = await act('/api/fun/history', { site: k }, (j) => j.all ? `🏆 To'liq kolleksiya! +${money(j.got)}` : `🃏 +${money(j.got)} — kolleksiyaga qo'shildi`); if (j) open('hist'); };
  }

  // ---- 🕹️ Mini-o'yinlar ----
  const finish = async (game, score) => { const j = await act('/api/fun/game', { game, score }); if (!j) return open('play');
    modal(`<h3>${score >= .8 ? '🏆 Ajoyib!' : score >= .5 ? '👏 Yaxshi!' : '🙂 Yana urinib ko\'ring'}</h3><div class="cgoal"><div class="big">${Math.round(score * 100)}%</div><div>Mukofot: <b>+${money(j.got)}</b></div><div class="muted">Bugun yana ${j.games.left} ta mukofotli o'yin</div></div><button class="ok" id="again">🕹️ O'yinlarga qaytish</button>`);
    $('again').onclick = () => open('play'); };
  const QUIZ = [
    ['Amir Temur qaysi yili tug\'ilgan?', ['1336', '1370', '1405', '1299'], 0],
    ['Oqsaroyni kim qurdirgan?', ['Amir Temur', "Mirzo Ulug'bek", 'Bobur', 'Shohruh'], 0],
    ["Ko'k gumbaz masjidini kim qurdirgan?", ["Mirzo Ulug'bek", 'Amir Temur', 'Husayn Boyqaro', 'Abdullaxon'], 0],
    ["Shahrisabz tarixiy markazi qachon UNESCO ro'yxatiga kirgan?", ['2000', '1991', '2010', '1985'], 0],
    ['Shahrisabzning qadimiy nomi qaysi?', ['Kesh', 'Nasaf', 'Choch', 'Marokand'], 0],
    ['Shahrisabz qaysi viloyatda joylashgan?', ['Qashqadaryo', 'Samarqand', 'Buxoro', 'Surxondaryo'], 0],
    ['"Shahrisabz" so\'zining ma\'nosi nima?', ['Yashil shahar', 'Oq shahar', 'Tog\'li shahar', 'Katta shahar'], 0],
    ['Dorus-Siyodat maqbarasi kim uchun qurilgan?', ["Jahongir (Temurning o'g'li)", "Ulug'bek", 'Bibixonim', 'Shamsiddin Kulol'], 0],
    ['Kitobdagi mashhur ilmiy stansiya nima o\'lchaydi?', ['Yer qutblarining harakatini', 'Zilzilalarni', 'Ob-havoni', 'Radiatsiyani'], 0],
    ['Shahrisabz necha yildan ortiq tarixga ega?', ['2700', '500', '1000', '300'], 0],
    ['Oqsaroy peshtoqi taxminan qancha baland bo\'lgan?', ['50 metrdan ortiq', '10 metr', '20 metr', '200 metr'], 0],
    ['Shahrisabz yaqinidan oqadigan daryo?', ['Qashqadaryo', 'Zarafshon', 'Amudaryo', 'Chirchiq'], 0],
  ];
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const GAMES = {
    quiz() { const qs = shuffle(QUIZ).slice(0, 5); let i = 0, ok = 0;
      const show = () => { if (i >= qs.length) return finish('Viktorina', ok / qs.length); const [q, ans, right] = qs[i], opts = shuffle(ans.map((a, k) => [a, k === right]));
        modal(`<h3>🧠 Savol ${i + 1}/${qs.length}</h3><div class="qq">${esc(q)}</div><div class="qopts">${opts.map(([a, r], k) => `<button class="ghost" data-qa="${k}">${esc(a)}</button>`).join('')}</div><div class="muted">To'g'ri: ${ok}</div>`);
        document.querySelectorAll('[data-qa]').forEach((b) => (b.onclick = () => { const r = opts[b.dataset.qa][1]; if (r) ok++; document.querySelectorAll('[data-qa]').forEach((x) => { x.disabled = true; if (opts[x.dataset.qa][1]) x.className = 'ok'; }); if (!r) b.className = 'no'; setTimeout(() => { i++; show(); }, 900); })); };
      show(); },
    pairs() { const ic = shuffle(['🕌', '🏛️', '🍇', '🫓', '🐔', '🌳', '🍵', '🕰️']).slice(0, 8), cards = shuffle([...ic, ...ic]); let open1 = null, lock = false, moves = 0, found = 0;
      modal(`<h3>🃏 Juftini top</h3><div class="muted" id="pm">Yurishlar: 0</div><div class="pairs">${cards.map((c, i) => `<button class="pcard" data-pc="${i}"></button>`).join('')}</div>`);
      document.querySelectorAll('[data-pc]').forEach((b) => (b.onclick = () => { if (lock || b.classList.contains('open')) return; b.textContent = cards[b.dataset.pc]; b.classList.add('open');
        if (open1 === null) { open1 = b; return; } moves++; $('pm').textContent = 'Yurishlar: ' + moves;
        if (cards[open1.dataset.pc] === cards[b.dataset.pc]) { found++; open1 = null; if (found === 8) setTimeout(() => finish('Juftini top', Math.max(0, Math.min(1, (24 - moves) / 14))), 600); }
        else { lock = true; const a = open1; open1 = null; setTimeout(() => { a.textContent = ''; b.textContent = ''; a.classList.remove('open'); b.classList.remove('open'); lock = false; }, 700); } })); },
    tandir() { let round = 0, score = 0, pos = 0, dir = 1, raf = 0; const zone = () => [35 + Math.random() * 30, 12];
      let [z0, zw] = zone();
      modal(`<h3>🫓 Tandir ustasi</h3><div class="muted">Ko'rsatkich yashil joyga kelganda <b>"Uzish!"</b> ni bosing. 5 ta non.</div><div class="tbar"><i id="tz"></i><b id="tp"></b></div><div class="cgoal"><div class="big" id="tr">🫓 1/5</div></div><button class="ok big" id="tgo">🫓 Uzish!</button>`);
      const draw = () => { $('tz').style.left = z0 + '%'; $('tz').style.width = zw + '%'; };
      draw(); const step = () => { pos += dir * (1.1 + round * .35); if (pos > 100 || pos < 0) { dir *= -1; pos = Math.max(0, Math.min(100, pos)); } const tp = $('tp'); if (!tp) return; tp.style.left = pos + '%'; raf = requestAnimationFrame(step); }; step();
      $('tgo').onclick = () => { const hit = pos >= z0 && pos <= z0 + zw, near = !hit && pos >= z0 - 6 && pos <= z0 + zw + 6; score += hit ? 1 : near ? .5 : 0; toast(hit ? '🔥 Zo\'r non!' : near ? '🙂 Biroz kuyibdi' : '😬 Xom qoldi'); round++;
        if (round >= 5) { cancelAnimationFrame(raf); return finish('Tandir ustasi', score / 5); } $('tr').textContent = `🫓 ${round + 1}/5`; [z0, zw] = zone(); zw = Math.max(6, 12 - round * 1.5); draw(); };
    },
  };

  loadPublic(); setInterval(loadPublic, 5 * 60 * 1000);
  return { open, openGift, load };
}

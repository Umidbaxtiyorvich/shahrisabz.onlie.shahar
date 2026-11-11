// 🏛️ Shahrisabz tarixiy obidalari — protsedural 3D modellar (asl o'lchamlarga taxminan mos): g'isht, koshin naqshlari, gumbazlar, peshtoqlar.
export function buildMonuments({ THREE, scene, toXZ, history }) {
  const group = new THREE.Group(); group.name = 'monuments';
  // ---- Teksturalar: pishgan g'isht, moviy-oq-oltin koshin (girih), feruza gumbaz ----
  const tex = (draw, rep = 1, s = 256) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const brickT = tex((g, s) => { g.fillStyle = '#c9a77a'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < s; x += 32) { g.fillStyle = `hsl(${30 + Math.random() * 8},${38 + Math.random() * 12}%,${58 + Math.random() * 10}%)`; g.fillRect(x + 1, y + 1, 30, 14); } });
  const tileT = tex((g, s) => { g.fillStyle = '#163f7a'; g.fillRect(0, 0, s, s); const c = s / 2;
    for (const [col, r] of [['#2a7fc4', .48], ['#f2efe4', .36], ['#1aa3b8', .27], ['#d9a640', .15], ['#163f7a', .07]]) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = (i % 2 ? r * .62 : r) * s; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.fill(); }
    g.strokeStyle = '#f2efe4'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4); for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) { g.fillStyle = '#1aa3b8'; g.beginPath(); g.arc(x, y, s * .14, 0, 7); g.fill(); } }, 1);
  const bandT = tex((g, s) => { g.fillStyle = '#f2efe4'; g.fillRect(0, 0, s, s); g.fillStyle = '#163f7a'; g.font = `bold ${s * .5}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = 0; i < 4; i++) g.fillText('ﷲ', s / 8 + i * s / 4, s / 2); g.fillStyle = '#d9a640'; g.fillRect(0, 0, s, s * .08); g.fillRect(0, s * .92, s, s * .08); });
  const domeT = tex((g, s) => { g.fillStyle = '#1f9fb8'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let x = 0; x < s; x += 16) { g.fillStyle = `hsl(${188 + Math.random() * 10},${55 + Math.random() * 20}%,${42 + Math.random() * 12}%)`; g.fillRect(x + 1, y + 1, 14, 14); } g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < s; x += 64) g.fillRect(x, 0, 3, s); });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: .85, ...o });
  const BRICK = M({ map: brickT }), TILE = M({ map: tileT, roughness: .45, metalness: .05 }), BAND = M({ map: bandT, roughness: .5 }), DOME = M({ map: domeT, roughness: .35, metalness: .1 }), GOLD = M({ color: 0xd9a640, metalness: .8, roughness: .3 }), STONE = M({ color: 0xd8cfbf }), BRONZE = M({ color: 0x6b4a2a, metalness: .85, roughness: .35 }), WHITE = M({ color: 0xf3f1ea }), DARK = M({ color: 0x2a2320, roughness: 1 });
  const add = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const box = (g, w, h, d, mat, x = 0, y = 0, z = 0) => { const geo = new THREE.BoxGeometry(w, h, d); const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * Math.max(w, d) / 6, u.getY(i) * h / 6); return add(g, geo, mat, x, y + h / 2, z); };
  // Ravoqli peshtoq (old devor + o'yiq ravoq) — Shape dan ekstruziya
  function portal(g, w, h, d, archW, archH, z = 0, matFace = TILE) {
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.lineTo(-w / 2, 0);
    const hole = new THREE.Path(), r = archW / 2, sp = archH - r; hole.moveTo(-r, 0); hole.lineTo(-r, sp); hole.quadraticCurveTo(-r, sp + r * 1.15, 0, sp + r * 1.25); hole.quadraticCurveTo(r, sp + r * 1.15, r, sp); hole.lineTo(r, 0); hole.lineTo(-r, 0); sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); geo.translate(0, 0, -d / 2); const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 8, u.getY(i) / 8);
    const m = add(g, geo, [matFace, BRICK], 0, 0, z); box(g, archW, .4, d * .7, DARK, 0, 0, z); // ravoq ichi
    box(g, w + 1, 2.2, d + .6, BAND, 0, h - 3.2, z); return m; // tepasida yozuvli belbog'
  }
  // Gumbaz: oddiy (yarim shar) yoki qovurg'ali "qovun" (Temuriylar uslubi), baraban ustida
  function dome(g, r, y, { ribs = 0, tall = 1, drumH = r * .5, mat = DOME } = {}) {
    add(g, new THREE.CylinderGeometry(r * 1.02, r * 1.02, drumH, 32), BAND, 0, y + drumH / 2, 0);
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI / 2, bulge = tall > 1 ? 1 + .12 * Math.sin(a * 2) : 1; pts.push(new THREE.Vector2(Math.max(0, Math.cos(a)) * r * bulge, Math.sin(a) * r * tall)); }
    const geo = new THREE.LatheGeometry(pts, ribs ? ribs * 4 : 40);
    if (ribs) { const p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), k = 1 + .07 * Math.abs(Math.cos(a * ribs / 2)); p.setXYZ(i, v.x * k, v.y, v.z * k); } geo.computeVertexNormals(); }
    add(g, geo, mat, 0, y + drumH, 0); add(g, new THREE.SphereGeometry(r * .06, 12, 8), GOLD, 0, y + drumH + r * tall + r * .04, 0); // tepada oltin bezak
  }
  const minaret = (g, r, h, x, z, mat = TILE) => { add(g, new THREE.CylinderGeometry(r * .85, r, h, 20), mat, x, h / 2, z); add(g, new THREE.CylinderGeometry(r * 1.3, r * .9, 1.6, 20), BAND, x, h + .8, z); add(g, new THREE.ConeGeometry(r * .9, r * 1.6, 20), DOME, x, h + 1.6 + r * .8, z); };
  const plaza = (g, w, d) => { const p = box(g, w, .3, d, STONE); p.castShadow = false; return p; };
  const pool = (g, w, d, x, z) => { box(g, w, .6, d, STONE, x, 0, z); const wtr = box(g, w - 1, .1, d - 1, M({ color: 0x3a8fc4, roughness: .05, metalness: .3, transparent: true, opacity: .85 }), x, .55, z); wtr.castShadow = false; };

  const BUILD = {
    // Oqsaroy: bugun saqlanib qolgan ulkan peshtoqning ikki minorasi (~38 m), oralig'idagi qulagan ravoq, atrofida bog'
    oqsaroy(g) { plaza(g, 110, 90);
      for (const sx of [-1, 1]) { const t = new THREE.Group(); t.position.x = sx * 16; g.add(t);
        box(t, 12, 38, 14, TILE); box(t, 12.4, 2.2, 14.4, BAND, 0, 34, 0); box(t, 12.6, 6, 14.6, BRICK, 0, 0, 0);
        for (let k = 0; k < 3; k++) box(t, 1.2, 30, 1.2, GOLD, sx * -6.2, 4, -7.1 + k * 7.1); // burchak bezaklari
        add(t, new THREE.CylinderGeometry(3.2, 3.6, 41, 20), TILE, sx * 6.5, 20.5, -7); }
      for (let i = 0; i < 14; i++) box(g, 2 + Math.random() * 3, 1 + Math.random() * 2, 2 + Math.random() * 3, BRICK, (Math.random() - .5) * 18, 0, (Math.random() - .5) * 14 - 2); // qulagan g'ishtlar
      for (let i = 0; i < 10; i++) box(g, 4, 1.2, 4, M({ color: 0x3f8f3a }), -45 + i * 10, 0, 30); },
    // Amir Temur haykali: baland postament ustida bronza haykal, atrofida favvoralar
    temur(g) { plaza(g, 60, 60); pool(g, 12, 30, -18, 0); pool(g, 12, 30, 18, 0);
      box(g, 7, 2, 7, STONE); box(g, 5, 6, 5, M({ color: 0x8a7f72 }), 0, 2, 0); box(g, 5.6, .6, 5.6, GOLD, 0, 7.6, 0);
      const s = new THREE.Group(); s.position.y = 8.2; g.add(s);
      add(s, new THREE.CylinderGeometry(1.1, 1.7, 4.2, 16), BRONZE, 0, 2.1, 0); add(s, new THREE.CylinderGeometry(.8, 1.1, 1.6, 16), BRONZE, 0, 4.9, 0);
      add(s, new THREE.SphereGeometry(.62, 16, 12), BRONZE, 0, 6.15, 0); add(s, new THREE.CylinderGeometry(.62, .7, .5, 16), BRONZE, 0, 6.75, 0); // salla
      const cape = add(s, new THREE.BoxGeometry(2.6, 4.4, .25), BRONZE, 0, 3.4, -.9); cape.rotation.x = .12;
      const arm = add(s, new THREE.CylinderGeometry(.22, .25, 2.2, 10), BRONZE, 1.35, 4.6, .55); arm.rotation.z = -1.1; arm.rotation.x = -.5; // ko'targan qo'li
      add(s, new THREE.BoxGeometry(.18, 3.2, .18), GOLD, -1.25, 2.6, .4); }, // qilich
    // Ko'k gumbaz masjidi (1435): katta moviy gumbaz, oldida ulkan peshtoq, ikki yonida minorachalar
    kokgumbaz(g) { plaza(g, 80, 90);
      box(g, 46, 18, 46, BRICK, 0, 0, -6); box(g, 46.4, 2, 46.4, BAND, 0, 16, -6);
      const d = new THREE.Group(); d.position.z = -6; g.add(d); dome(d, 18, 18, { drumH: 7 });
      const pg = new THREE.Group(); pg.position.z = 19; g.add(pg); portal(pg, 34, 30, 6, 14, 22); minaret(pg, 2.2, 32, -17.5, 0); minaret(pg, 2.2, 32, 17.5, 0);
      for (const sx of [-1, 1]) { const s1 = new THREE.Group(); s1.position.set(sx * 17, 0, -24); g.add(s1); dome(s1, 5, 12, { drumH: 2, mat: DOME }); } },
    // Dorus-Siyodat — Jahongir maqbarasi: qovurg'ali konussimon gumbaz, saqlangan peshtoq qismi
    dorussiyodat(g) { plaza(g, 60, 60);
      box(g, 16, 16, 16, BRICK); box(g, 16.4, 1.6, 16.4, BAND, 0, 14.4, 0); dome(g, 7.5, 16, { ribs: 12, tall: 1.6, drumH: 4, mat: M({ map: domeT, color: 0xbfe8ee, roughness: .4 }) });
      const pg = new THREE.Group(); pg.position.z = 13; g.add(pg); portal(pg, 22, 24, 4, 9, 16, 0, BRICK); box(pg, 3, 24, 4.2, TILE, -9.5, 0, 0); box(pg, 3, 24, 4.2, TILE, 9.5, 0, 0); },
    // Dorut-Tilovat: hovli atrofida Shamsiddin Kulol va Gumbazi Sayyidon maqbaralari (moviy gumbazlar)
    dorutilovat(g) { plaza(g, 70, 60);
      const mk = (x, z, s) => { const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t); box(t, 14 * s, 12 * s, 14 * s, BRICK); box(t, 14.4 * s, 1.4, 14.4 * s, BAND, 0, 10.6 * s, 0); dome(t, 6 * s, 12 * s, { drumH: 3 * s }); const p = new THREE.Group(); p.position.z = 7.5 * s; t.add(p); portal(p, 12 * s, 15 * s, 2.2, 5 * s, 10 * s); };
      mk(-16, -4, 1); mk(17, -6, .85); for (let i = 0; i < 6; i++) box(g, 3, 1, 3, M({ color: 0x3f8f3a }), -12 + i * 5, 0, 18);
      box(g, 66, 4, 1.2, BRICK, 0, 0, -26); },
    // Chorsu bozori: to'rt tomonida ravoqli kirish, o'rtada katta gumbaz, burchaklarda kichik gumbazlar
    chorsu(g) { plaza(g, 54, 54); box(g, 30, 10, 30, BRICK); box(g, 30.4, 1.2, 30.4, BAND, 0, 9, 0); dome(g, 10, 10, { drumH: 3, mat: M({ map: brickT, roughness: .9 }) });
      for (let i = 0; i < 4; i++) { const p = new THREE.Group(); p.rotation.y = i * Math.PI / 2; g.add(p); const q = new THREE.Group(); q.position.z = 15.5; p.add(q); portal(q, 12, 13, 2, 6, 9, 0, BRICK); }
      for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) { const c = new THREE.Group(); c.position.set(x, 0, z); g.add(c); dome(c, 3.4, 10, { drumH: 1, mat: M({ map: brickT }) }); } },
    // Kitob xalqaro kenglik stansiyasi (1899): oq bino va observatoriya gumbazi
    kitob(g) { plaza(g, 50, 40); box(g, 24, 7, 12, WHITE, 0, 0, 4); box(g, 24.4, .8, 12.4, M({ color: 0x8a9aa6 }), 0, 7, 4); box(g, 8, 9, 8, WHITE, 0, 0, -8);
      add(g, new THREE.SphereGeometry(4.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M({ color: 0xdfe6ea, metalness: .6, roughness: .3 }), 0, 9, -8); box(g, 1, 4, 9.4, DARK, 0, 9, -8);
      for (let i = 0; i < 5; i++) box(g, 2.2, 3, .2, M({ color: 0x5f7f9c, metalness: .5, roughness: .1 }), -9 + i * 4.5, 2.5, 10.1); },
  };
  for (const [k, h] of Object.entries(history || {})) {
    const b = BUILD[k]; if (!b) continue; const g = new THREE.Group(); b(g); const [x, z] = toXZ(h.lat, h.lon); g.position.set(x, 0, z); g.userData.hist = k; group.add(g);
  }
  scene.add(group); return group;
}

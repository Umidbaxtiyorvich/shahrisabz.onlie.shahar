// Shahrisabz online shahar — bino turlari (do'kon, bozor, supermarket, hokimlik …) uchun 3D modellar.
// Har bir funksiya (g, c) oladi: g — THREE.Group, c — asosiy rang; binoning balandligini (yorliq uchun) qaytaradi.
// Hammasi markazda (0,0), old tomoni +z (ko'chaga qaraydi), taxminan 30×30 m hovliga sig'adi.
export function makeBuildings(H) {
  const { THREE, box, M, GLASS, FRAME, WOOD, WALL, ROOF, BRICK, win, tree, lawn, proceduralCar } = H;
  const PAVE = M(0xcfc8b8, { roughness: 1 });
  const pave = (g, w, d, z = 0) => box(g, w, .2, d, PAVE, 0, 0, z);
  const sign = (g, w, y, z, color) => { box(g, w, 1.6, .3, M(color, { emissive: color, emissiveIntensity: .35 }), 0, y, z); };
  const awning = (g, w, y, z, color) => { const a = new THREE.Mesh(new THREE.BoxGeometry(w, .25, 2.4), M(color)); a.position.set(0, y, z + 1.1); a.rotation.x = .25; a.castShadow = true; g.add(a); };
  const cyl = (g, r, h, mat, x, y, z, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; g.add(m); return m; };
  const dome = (g, r, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const umbrella = (g, x, z, col) => { cyl(g, .08, 2.4, FRAME, x, 0, z, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(1.6, .6, 10), M(col)); u.position.set(x, 2.6, z); g.add(u); box(g, 1, .7, 1, WOOD, x, 0, z); };
  const cross = (g, y, z, col) => { box(g, 2.4, .7, .3, M(col, { emissive: col, emissiveIntensity: .6 }), 0, y, z); box(g, .7, 2.4, .3, M(col, { emissive: col, emissiveIntensity: .6 }), 0, y - .85, z); };
  const flag = (g, x, z, h = 14) => { cyl(g, .1, h, M(0xdddddd, { metalness: .8 }), x, 0, z, 8); box(g, 3, .6, .05, M(0x1eb53a), x + 1.5, h - .6, z); box(g, 3, .6, .05, M(0xffffff), x + 1.5, h - 1.2, z); box(g, 3, .6, .05, M(0x0099b5), x + 1.5, h - 1.8, z); };

  return {
    shop(g, c) { lawn(g, 22, 22, 2); pave(g, 14, 5, 7); box(g, 12, 5, 9, WALL(0xf4efe6)); box(g, 10, 3, .3, GLASS, 0, .4, 4.55); awning(g, 12, 3.8, 4.5, c); sign(g, 9, 4.3, 4.7, c); return 8; },
    market(g, c) { pave(g, 32, 30, 2); box(g, 28, 7, 18, WALL(0xf2f2f2), 0, 0, -3); box(g, 24, 4.5, .35, GLASS, 0, .4, 6.05); sign(g, 16, 5.6, 6.2, c); box(g, 29, .6, 19, M(0x3a3f47), 0, 7, -3);
      for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) box(g, 2.2, .1, 4.5, M(0xffffff), -9 + i * 6, .22, 11 + k * 0); return 11; },
    bazaar(g, c) { pave(g, 34, 34, 0);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const x = -11 + k * 7.3, z = -9 + r * 9; for (const [dx, dz] of [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) cyl(g, .12, 3.4, FRAME, x + dx, 0, z + dz, 6);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, .2, 5.2), M([c, 0xe74c3c, 0xf1c40f, 0x27ae60][(r + k) % 4])); roof.position.set(x, 3.5, z); roof.castShadow = true; g.add(roof);
        box(g, 5, .9, 1.6, WOOD, x, 0, z); for (let f = 0; f < 6; f++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), M([0xe74c3c, 0xf39c12, 0x27ae60, 0xf1c40f][f % 4])); fr.position.set(x - 2 + f * .8, 1.1, z); g.add(fr); } }
      const gate = new THREE.Group(); box(gate, 1, 6, 1, BRICK(), -6, 0, 0); box(gate, 1, 6, 1, BRICK(), 6, 0, 0); box(gate, 13, 1.6, 1.2, M(c), 0, 6, 0); gate.position.z = 16; g.add(gate); return 10; },
    cafe(g, c) { lawn(g, 26, 26, 3); pave(g, 18, 9, 8); box(g, 13, 5, 9, WALL(0xf7efe2), 0, 0, -1); box(g, 11, 3.2, .3, GLASS, 0, .4, 3.55); awning(g, 13, 3.9, 3.5, c); sign(g, 7, 4.4, 3.7, c);
      for (const x of [-6, -1.5, 3, 7]) umbrella(g, x, 8.5, [c, 0xffffff][(x > 0) | 0]); return 8; },
    chaikhana(g, c) { lawn(g, 28, 28, 2); box(g, 18, .6, 12, WOOD, 0, 0, 0); for (const x of [-8, -2.7, 2.7, 8]) for (const z of [-5, 5]) cyl(g, .25, 4, WOOD, x, .6, z, 8);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 11.5, 2.6, 4), ROOF(c)); roof.position.set(0, 5.9, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, .78); roof.castShadow = true; g.add(roof);
      for (const x of [-5, 0, 5]) { box(g, 3.6, .5, 3.6, M(0xb5651d), x, .6, 0); box(g, 3.6, .08, 3.6, M(0xc0392b), x, 1.1, 0); box(g, 1, .3, 1, WOOD, x, 1.18, 0); } tree(g, -11, 10, 1.2); tree(g, 11, 10, 1.1); return 9; },
    restaurant(g, c) { lawn(g, 30, 30, 3); pave(g, 22, 8, 9); box(g, 20, 6, 12, WALL(0xf3e9d8), 0, 0, -2); box(g, 18, 4, .3, GLASS, 0, .6, 4.05); box(g, 21, .6, 13, M(c), 0, 6, -2); sign(g, 10, 6.8, 4.2, c);
      for (const x of [-7, 0, 7]) umbrella(g, x, 10, c); return 10; },
    wedding(g, c) { pave(g, 34, 32, 2); box(g, 28, 8, 18, WALL(0xfdfaf3), 0, 0, -3); for (let x = -12; x <= 12; x += 4) cyl(g, .5, 8, M(0xffffff), x, 0, 6.5); box(g, 30, 1, 3, M(c), 0, 8, 6.5);
      box(g, 22, 1.4, .3, M(0xffd36e, { emissive: 0xffd36e, emissiveIntensity: .8 }), 0, 9.2, 6.6); dome(g, 5, M(c, { metalness: .4, roughness: .3 }), 0, 8, -3); return 14; },
    hotel(g, c) { lawn(g, 30, 30, 3); pave(g, 14, 6, 10);
      for (let f = 0; f < 9; f++) { box(g, 16, 3.4, 12, f % 2 ? GLASS : WALL(0xf5f3ef), 0, f * 3.6, -2); box(g, 16.6, .2, 12.6, M(c), 0, 3.4 + f * 3.6, -2); }
      sign(g, 10, 33, 4.2, c); box(g, 8, .3, 4, M(c), 0, 3.6, 6); return 36; },
    pharmacy(g, c) { lawn(g, 22, 22, 2); pave(g, 14, 5, 7); box(g, 12, 5, 9, WALL(0xffffff)); box(g, 10, 3, .3, GLASS, 0, .4, 4.55); sign(g, 9, 4.2, 4.7, 0x1fa463); cross(g, 7.6, 4.6, 0x1fa463); return 10; },
    hospital(g, c) { lawn(g, 34, 34, 2); pave(g, 16, 8, 10); box(g, 26, 12, 14, WALL(0xffffff), 0, 0, -3); for (let f = 0; f < 3; f++) box(g, 24, 2, .3, GLASS, 0, 1.5 + f * 3.8, 4.05);
      box(g, 8, 4, 5, WALL(0xffffff), 0, 0, 6); cross(g, 14.5, 4.2, 0xe24b4b); box(g, 10, .2, 10, M(0x9aa0a6), 0, 12.05, -3); return 16; },
    school(g, c) { lawn(g, 36, 36, 2); box(g, 28, 11, 9, BRICK(), 0, 0, -6); box(g, 9, 11, 18, BRICK(), -9.5, 0, 3); for (let f = 0; f < 3; f++) for (let i = 0; i < 6; i++) win(g, 2.4, 2, -11 + i * 4.4, 1.3 + f * 3.4, -1.45);
      box(g, 14, .2, 10, M(0x2e8b57), 6, 0, 8); flag(g, 13, 13); return 14; },
    kinder(g, c) { lawn(g, 30, 30, 2); box(g, 18, 4, 10, WALL(0xfff3d6), 0, 0, -4); const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 3.4, 4), ROOF(c)); roof.position.set(0, 5.7, -4); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .6); g.add(roof);
      for (const [x, col] of [[-6, 0xe74c3c], [0, 0x3498db], [6, 0xf1c40f]]) win(g, 2.6, 2, x, 1.2, 1.05); box(g, 2, 2.4, 2, M(0xe74c3c), -6, 0, 8); box(g, 4, .2, 1.2, M(0xf1c40f), -3.2, 1.6, 8); cyl(g, .1, 3, FRAME, 5, 0, 8, 6); cyl(g, .1, 3, FRAME, 8, 0, 8, 6); box(g, 3.2, .15, .15, FRAME, 6.5, 3, 8); return 9; },
    bank(g, c) { pave(g, 30, 30, 2); box(g, 22, 3, 14, M(0xd8d2c4), 0, 0, -3); box(g, 20, 10, 12, GLASS, 0, 3, -3); for (let x = -8; x <= 8; x += 4) cyl(g, .6, 9, M(0xf5f1e8), x, 3, 3.6);
      box(g, 22, 1.4, 3, M(0xf5f1e8), 0, 12, 3.6); sign(g, 12, 13.6, 5, c); return 17; },
    office(g, c) { lawn(g, 30, 30, 3); pave(g, 12, 6, 9);
      for (let f = 0; f < 14; f++) { box(g, 15, 3.4, 15, GLASS, 0, f * 3.6, -1); box(g, 15.6, .2, 15.6, M(c, { metalness: .5, roughness: .3 }), 0, 3.4 + f * 3.6, -1); }
      sign(g, 9, 51, 6.6, c); return 54; },
    govt(g, c) { pave(g, 40, 38, 2); box(g, 34, 2, 20, M(0xe8e2d2), 0, 0, -3); box(g, 32, 12, 18, WALL(0xf5efe0), 0, 2, -3);
      for (let x = -12; x <= 12; x += 3) cyl(g, .7, 11, M(0xffffff), x, 2, 6.8); box(g, 30, 2, 3, M(0xf5efe0), 0, 13, 6.8);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0, 16, 4, 3), M(0xf5efe0)); ped.rotation.x = Math.PI / 2; ped.rotation.z = Math.PI; ped.scale.set(1, .25, 1); ped.position.set(0, 16, 6.5); g.add(ped);
      dome(g, 6, M(c, { metalness: .6, roughness: .25 }), 0, 14, -3); flag(g, 0, 15, 26); for (let s = 0; s < 4; s++) box(g, 20 - s, .4, 2, M(0xd9d2c0), 0, s * .4, 10 - s * .5); return 27; },
    mosque(g, c) { pave(g, 34, 34, 2); box(g, 22, 9, 20, WALL(0xf3ead6), 0, 0, -2); dome(g, 8, M(c, { metalness: .3, roughness: .35 }), 0, 9, -2);
      for (const x of [-13, 13]) { cyl(g, 1.2, 24, WALL(0xf3ead6), x, 0, 6); dome(g, 1.5, M(c), x, 24, 6); } box(g, 8, 8, 1, M(c), 0, 0, 8.2); return 20; },
    gas(g, c) { pave(g, 34, 30, 0); for (const [x, z] of [[-9, -4], [9, -4], [-9, 6], [9, 6]]) cyl(g, .45, 6, M(0xdddddd), x, 0, z, 10);
      box(g, 24, 1.2, 14, M(0xffffff), 0, 6, 1); box(g, 24.2, .6, 14.2, M(c, { emissive: c, emissiveIntensity: .3 }), 0, 6.2, 1);
      for (const x of [-4, 4]) for (const z of [-2, 4]) box(g, 1.2, 2, .8, M(c), x, 0, z); box(g, 10, 4, 6, WALL(0xf4f4f4), 0, 0, -11); cyl(g, .3, 12, FRAME, 14, 0, 12, 8); box(g, 3, 4, .4, M(c), 14, 12, 12); return 10; },
    carshow(g, c) { pave(g, 34, 32, 2); box(g, 26, 7, 16, GLASS, 0, 0, -3); box(g, 27, .8, 17, M(c), 0, 7, -3); sign(g, 14, 8, 5.3, c);
      [[-8, 0xe74c3c], [-2.5, 0x2c3e50], [3, 0xffffff], [8.5, 0x3498db]].forEach(([x, col]) => { const cr = proceduralCar('sedan', M(col, { metalness: .8, roughness: .3 })); cr.position.set(x, 0, 10); cr.rotation.y = Math.PI / 2; g.add(cr); }); return 10; },
    gym(g, c) { lawn(g, 30, 30, 2); box(g, 24, 9, 16, M(0x5b6470), 0, 0, -3); box(g, 22, 4, .3, GLASS, 0, 3, 5.05); sign(g, 12, 7.6, 5.2, c); box(g, 25, .5, 17, M(c), 0, 9, -3); return 12; },
    stadium(g, c) { lawn(g, 44, 34, 0); box(g, 30, .2, 18, M(0x3aa655, { roughness: 1 }), 0, .1, 0);
      for (let x = -14; x <= 14; x += 4) box(g, .15, .05, 18, M(0xffffff), x, .23, 0);
      for (let s = 0; s < 4; s++) { box(g, 34, 1, 2, M([c, 0xdddddd][s % 2]), 0, s, -11 - s * 1.6); box(g, 34, 1, 2, M([c, 0xdddddd][s % 2]), 0, s, 11 + s * 1.6); }
      for (const [x, z] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) { cyl(g, .3, 18, FRAME, x, 0, z, 8); box(g, 3, 1.5, .5, M(0xffffff, { emissive: 0xffffff, emissiveIntensity: .7 }), x, 18, z); } return 20; },
    cinema(g, c) { pave(g, 32, 30, 2); box(g, 24, 12, 18, M(0x2b2f36), 0, 0, -4); box(g, 18, 6, .4, M(c, { emissive: c, emissiveIntensity: .4 }), 0, 6, 5.1);
      box(g, 22, 4, .3, GLASS, 0, .4, 5.05); box(g, 24, .6, 5, M(0x1d2433), 0, 4.4, 7); return 14; },
    park(g, c) { lawn(g, 36, 36, 0); const path = M(0xe0d6bf, { roughness: 1 }); box(g, 34, .25, 3, path, 0, 0, 0); box(g, 3, .25, 34, path, 0, 0, 0);
      cyl(g, 3, .8, M(0xbfb7a6), 0, 0, 0, 24); const w = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, .2, 24), M(0x3fb7e8, { metalness: .2, roughness: .05 })); w.position.set(0, .75, 0); g.add(w); cyl(g, .3, 3, M(0xbfb7a6), 0, .8, 0, 10);
      for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10], [-14, 0], [14, 0], [0, -14], [0, 14], [-6, 14], [6, -14]]) tree(g, x, z, 1.3);
      for (const [x, z] of [[-5, 2.5], [5, -2.5]]) box(g, 3, .5, .8, WOOD, x, .4, z); return 9; },
    factory(g, c) { pave(g, 38, 34, 0); box(g, 28, 10, 18, M(0x9aa3ad), 0, 0, -4); for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0, 4, 2.4, 3), M(c)); r.rotation.z = Math.PI / 2; r.rotation.y = Math.PI / 2; r.position.set(-10.5 + i * 7, 11, -4); r.scale.set(1, 1, 4.4); g.add(r); }
      cyl(g, 1.2, 22, BRICK(), 12, 0, -12, 14); for (let k = 0; k < 3; k++) box(g, 4, 3.6, 4, M(0x8b6d4a), -12 + k * 5, 0, 10); return 24; },
    busstop(g, c) { pave(g, 12, 6, 0); box(g, 8, .25, 2.6, M(c), 0, 3, 0); for (const x of [-3.6, 3.6]) cyl(g, .1, 3, FRAME, x, 0, -1, 6); box(g, 7.4, 2.6, .1, GLASS, 0, .3, -1.2); box(g, 6, .4, .8, WOOD, 0, .6, -.6); cyl(g, .08, 3.4, FRAME, 5, 0, 1, 6); box(g, 1, 1, .1, M(c, { emissive: c, emissiveIntensity: .4 }), 5, 3.4, 1); return 5; },
    workshop(g, c) { lawn(g, 24, 24, 2); box(g, 14, 5, 10, BRICK(), 0, 0, -1); const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 9.4, 2.4, 4), ROOF(c)); roof.position.set(0, 6.2, -1); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, .75); g.add(roof);
      box(g, 6, 3.6, .3, WOOD, -2.5, 0, 4.05); win(g, 3, 2, 4, 1.5, 4.05); for (let i = 0; i < 4; i++) cyl(g, .45 - i * .05, .9, M([0xb5651d, 0x2e86de, 0xc0392b, 0x27ae60][i]), -4 + i * 1.4, 0, 7, 12); sign(g, 8, 4.3, 4.2, c); return 9; },
    guesthouse(g, c) { lawn(g, 28, 28, 2); box(g, 16, 4.5, 12, WALL(0xf1e3c8)); box(g, 16, 4.2, 12, WALL(0xf1e3c8), 0, 4.5); for (const x of [-5, 0, 5]) { win(g, 2.4, 2.2, x, 1.2, 6.05); win(g, 2.4, 2.2, x, 5.6, 6.05); }
      box(g, 16.4, .5, 12.4, WOOD, 0, 8.7); box(g, 14, .3, 2.4, WOOD, 0, 4.5, 7.2); for (let x = -6.5; x <= 6.5; x += 1.3) box(g, .12, 1, .12, WOOD, x, 4.8, 8.3); box(g, 2.4, 3.6, .3, WOOD, 0, 0, 6.1); tree(g, -10, 9); tree(g, 10, 9, 1.1); sign(g, 7, 9.4, 6.4, c); return 12; },
    bakery(g, c) { lawn(g, 22, 22, 2); box(g, 12, 5, 9, BRICK()); box(g, 9, 3, .3, GLASS, -1, .4, 4.55); awning(g, 12, 3.8, 4.5, c); sign(g, 8, 4.3, 4.7, c); cyl(g, .8, 4, BRICK(), 4, 5, -2, 10); dome(g, 2.2, M(0xd9c9a8), -3, 5, -2); return 9; },
    garage(g, c) { pave(g, 28, 26, 2); box(g, 18, 6, 12, M(0xc9cdd2), 0, 0, -3); for (const x of [-5, 0, 5]) box(g, 4, 4.4, .3, M(0x6b7380), x, 0, 3.05); sign(g, 12, 5, 3.3, c);
      const cr = proceduralCar('jeep', M(0x2c3e50, { metalness: .7, roughness: .4 })); cr.position.set(-6, 0, 8); cr.rotation.y = Math.PI / 2; g.add(cr); return 9; },
  };
}

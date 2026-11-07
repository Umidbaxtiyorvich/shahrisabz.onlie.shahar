// Shahrisabz yo'llari va mahallalarini OpenStreetMap'dan yuklab public/osm.json ga saqlaydi.
// Ishlatish: npm run osm
const fs = require('fs'), path = require('path');
const BBOX = '39.015,66.775,39.105,66.885';
const q = `[out:json][timeout:120];(way["highway"~"^(trunk|primary|secondary|tertiary|residential|unclassified|living_street|service)$"](${BBOX});node["place"~"^(neighbourhood|suburb|quarter|village|hamlet)$"](${BBOX}););out geom;`;
(async () => {
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
  const j = await r.json();
  const out = { ways: [], places: [] };
  for (const e of j.elements) {
    if (e.type === 'way' && e.geometry) out.ways.push({ t: e.tags.highway, n: e.tags['name:uz'] || e.tags.name || '', g: e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]) });
    else if (e.type === 'node' && e.tags?.name) out.places.push({ n: e.tags['name:uz'] || e.tags.name, lat: e.lat, lon: e.lon });
  }
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'osm.json'), JSON.stringify(out));
  console.log(`Saqlandi: ${out.ways.length} ta yo'l, ${out.places.length} ta mahalla`);
})();

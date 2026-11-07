# fabioakitaa/mahallalar ma'lumotidan Shahrisabz shahri (1002) va tumani (1015) mahallalarini oladi:
# nomni lotinga o'giradi, chegarani soddalashtiradi va public/mahallas-geo.json ga yozadi.
import json, sys, math
SRC = sys.argv[1]
TR = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh','ъ':"'",'ы':'i','ь':'','э':'e','ю':'yu','я':'ya','ў':"o'",'қ':'q','ғ':"g'",'ҳ':'h'}
def lat(s):
    out = ''
    for i, ch in enumerate(s):
        lo = ch.lower(); t = TR.get(lo, ch)
        if lo == 'е' and (i == 0 or not s[i-1].isalpha()): t = 'ye'
        if ch != lo and t: t = t[0].upper() + t[1:]
        out += t
    return out.replace("'", "'")
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]; dx, dy = b[0]-a[0], b[1]-a[1]; L = dx*dx + dy*dy
        t = 0 if L == 0 else max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L))
        d = math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy)
        if d > dmax: dmax, idx = d, i
    if dmax > eps: return dp(pts[:idx+1], eps)[:-1] + dp(pts[idx:], eps)
    return [a, b]
out = []
for fid, kind in (('1002', 'shahar'), ('1015', 'tuman')):
    for m in json.load(open(f'{SRC}/mahallas/10/{fid}.json'))['mahalla']:
        g = json.loads(json.loads(m['geo_polygon'])['value'])
        gs = g if isinstance(g, list) else [g]
        polys = []
        for gg in gs: polys += gg['coordinates'] if gg['type'] == 'MultiPolygon' else [gg['coordinates']]
        rings = []
        for poly in polys:
            r = dp([[round(x, 5), round(y, 5)] for x, y in poly[0]], 0.00004)  # ~4 m
            if len(r) >= 4: rings.append(r)
        if not rings: continue
        big = max(rings, key=len)
        cx = sum(p[0] for p in big) / len(big); cy = sum(p[1] for p in big) / len(big)
        out.append({'id': m['id'], 'n': lat(m['name']), 'k': kind, 'lat': round(cy, 5), 'lon': round(cx, 5), 'rings': rings})
json.dump({'manba': 'github.com/fabioakitaa/mahallalar', 'mahallalar': out}, open('public/mahallas-geo.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'ta mahalla;', sum(1 for x in out if x['k'] == 'shahar'), 'shahar,', sum(1 for x in out if x['k'] == 'tuman'), 'tuman')
print(', '.join(x['n'] for x in out))

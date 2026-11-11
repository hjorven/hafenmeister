"""Stile: Aquarell mit Tusche, Blaupause, Linoldruck."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import scene as S
from common import *

def wobbly(d, a, b, rnd, fill, width, amp=1.6, seg=16, over=3.0):
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    if L < 1: return
    ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    a = (a[0] - ux * rnd.uniform(0, over), a[1] - uy * rnd.uniform(0, over)); b = (b[0] + ux * rnd.uniform(0, over), b[1] + uy * rnd.uniform(0, over))
    n = max(1, int(L / seg)); pts = []
    for i in range(n + 1):
        t = i / n; o = rnd.uniform(-amp, amp) if 0 < i < n else rnd.uniform(-amp, amp) * .4
        pts.append((a[0] + (b[0] - a[0]) * t - uy * o, a[1] + (b[1] - a[1]) * t + ux * o))
    d.line(pts, fill=fill, width=width, joint='curve')

# ------------------------------------------------------------------ 8 Aquarell mit Tusche
WCOL = {k: mix(sat(v, .95), (255, 255, 255), .22) for k, v in PAL.items()}
WCOL.update(grass=(176, 206, 142), sand=(244, 228, 186), sand_wet=(226, 214, 180), pave=(226, 224, 218), bank=(214, 194, 150), roof_red=(214, 110, 88),
            tree=(104, 156, 116), tree2=(136, 180, 120), hull_white=(250, 250, 248), cabin=(252, 252, 250), wall_white=(248, 244, 236), sail=(252, 252, 250))

def style_watercolor(scene):
    ss = 2; cam, items = setup(scene, ss); size = (W * ss, H * ss); sc = scene['vox']; rnd = random.Random(21)
    D = sdf(scene, cam, size, step=4)
    t = np.clip(D / (26 * sc), 0, 1)[..., None]
    c0, c1, c2 = np.array((196, 230, 228), np.float32), np.array((126, 184, 208), np.float32), np.array((92, 150, 194), np.float32)
    wat = np.where(t < .4, c0 + (c1 - c0) * (t / .4), c1 + (c2 - c1) * ((t - .4) / .6))
    blot = noise(size[0], size[1], 150 * ss, 31, octaves=3)[..., None]
    wat = wat * (.88 + .24 * blot)
    streak = np.asarray(Image.fromarray((np.random.RandomState(8).rand(size[1] // 22, size[0] // 240 + 2) * 255).astype(np.uint8)).resize(size, Image.BICUBIC), np.float32) / 255.0
    sm = np.clip((streak - .7) * 6, 0, 1)[..., None] * (D[..., None] > 2.5 * sc)
    wat = wat + (250 - wat) * sm * .75
    img = Image.fromarray(np.clip(wat, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(img)
    draw_items(d, items, lambda it: face_col(WCOL, it, .74, .31), min_lw=3)
    a = np.asarray(img, np.float32) / 255.0
    # Farbe verlaeuft: Verschiebung ueber ein Rauschfeld
    A = 6.5 * ss
    dx = (noise(size[0], size[1], 22 * ss, 41, 2) - .5) * 2 * A; dy = (noise(size[0], size[1], 22 * ss, 42, 2) - .5) * 2 * A
    yy, xx = np.mgrid[0:size[1], 0:size[0]].astype(np.float32)
    co = np.array([np.clip(yy + dy, 0, size[1] - 1), np.clip(xx + dx, 0, size[0] - 1)])
    a = np.stack([ndimage.map_coordinates(a[..., c], co, order=1, mode='nearest') for c in range(3)], -1)
    pig = noise(size[0], size[1], 60 * ss, 43, 3)[..., None]; fine = noise(size[0], size[1], 2 * ss, 44)[..., None]
    lum = a.mean(-1, keepdims=True)
    a = a * (1 - .22 * (pig - .5)) - .035 * (fine - .5) * (1.15 - lum)
    bl = np.stack([ndimage.gaussian_filter(a[..., c], 2.2 * ss) for c in range(3)], -1)
    edge = np.abs(a - bl).mean(-1, keepdims=True)
    a = a * (1 - np.clip(edge * 4.5, 0, .22))
    a = 1 - (1 - a) * .94
    # Tusche
    ink = Image.new('RGBA', size, (0, 0, 0, 0)); idr = ImageDraw.Draw(ink)
    INK = (46, 42, 56)
    for it in items:
        g = is_ground(it)
        if it['t'] == 'face':
            idr.polygon(it['pts'], fill=(0, 0, 0, 0))
            if g and it['mat'] in ('sand_wet', 'path', 'road', 'sand'): continue
            pts = it['pts']
            for i in range(len(pts)):
                if rnd.random() < (.3 if g else .1): continue
                wobbly(idr, pts[i], pts[(i + 1) % len(pts)], rnd, INK + ((120 if g else 215),), rnd.choice((2, 3, 3)) if not g else 2, amp=1.5 * ss * .6, seg=12 * ss)
        else:
            wobbly(idr, it['a'], it['b'], rnd, INK + (225,), 3, amp=1.0, seg=20 * ss)
    # ein paar Wellenstriche
    for _ in range(46):
        x, y = rnd.uniform(0, size[0]), rnd.uniform(0, size[1])
        if D[int(y), int(x)] < 3 * sc: continue
        L = rnd.uniform(20, 60) * ss
        wobbly(idr, (x, y), (x + L, y + rnd.uniform(-2, 2)), rnd, (60, 96, 140, 120), 2, amp=2.2, seg=9 * ss)
    ia = np.asarray(ink, np.float32) / 255.0
    al = ia[..., 3:4] * (.8 + .2 * noise(size[0], size[1], 3 * ss, 45)[..., None])
    a = a * (1 - al) + ia[..., :3] * al
    out = to_np(from_np(a).resize((W, H), Image.LANCZOS))
    paper = (.965 + .035 * noise(W, H, 2, 46)[..., None]) * (.975 + .05 * noise(W, H, 90, 47)[..., None])
    out = out * paper * (np.array((253, 250, 242), np.float32) / 255.0)
    return from_np(out)

# ------------------------------------------------------------------ 9 Blaupause
NOTES = {
    'Stufe 1': [('STEG  HOLZ  12,0 x 1,6 m', (0, 7.5, .75), (-250, -150)), ('WC', (-4.5, -5.5, 3.2), (-120, -70)), ('LIEGEPLATZ 1', (1.95, 4.4, .6), (150, 120)),
                ('FLAGGENMAST', (-1.7, -1.5, 4.5), (-180, -40)), ('STRAND', (8.5, -1.8, .4), (120, 60))],
    'Maximalstufe': [('SCHWIMMSTEGE A-E', (36, 24.5, .6), (-170, 150)), ('LEUCHTFEUER', (73.2, 35.7, 11), (-170, -60)), ('MOLE', (100.7, 22, 1.2), (60, 90)),
                     ('KAI', (95, -1.5, .8), (110, -40)), ('TANKSTELLE', (-5.7, 9.5, 3.3), (-50, -125)), ('SANITAER', (9, -9.5, 5.6), (-120, -90)),
                     ('HAFENBUERO', (27, -9, 6.9), (-40, -110)), ('RESTAURANT', (47, -10.5, 6.6), (60, -110))]}

def style_blueprint(scene):
    ss = 2; cam, items = setup(scene, ss, margin=.08); size = (W * ss, H * ss); sc = scene['vox']; rnd = random.Random(31)
    BG = (22, 70, 134); LAND = (30, 84, 152); LN = (232, 242, 255)
    img = Image.new('RGBA', size, BG + (255,))
    grid = Image.new('RGBA', size, (0, 0, 0, 0)); gd = ImageDraw.Draw(grid)
    for x in range(0, size[0], 20 * ss): gd.line([(x, 0), (x, size[1])], fill=(255, 255, 255, 46 if x % (100 * ss) == 0 else 18), width=1 if x % (100 * ss) else 2)
    for y in range(0, size[1], 20 * ss): gd.line([(0, y), (size[0], y)], fill=(255, 255, 255, 46 if y % (100 * ss) == 0 else 18), width=1 if y % (100 * ss) else 2)
    img.alpha_composite(grid)
    d = ImageDraw.Draw(img)
    D = sdf(scene, cam, size, step=4)
    for _ in range(150):
        x, y = rnd.uniform(0, size[0]), rnd.uniform(0, size[1])
        if D[int(y), int(x)] < 2.5 * sc: continue
        L = rnd.uniform(14, 34) * ss
        d.line([(x, y), (x + L, y)], fill=(120, 164, 214), width=ss)
        d.line([(x + L * .25, y + 5 * ss), (x + L * .8, y + 5 * ss)], fill=(92, 140, 196), width=ss)
    # Land mit Schraffur
    top = [i for i in items if is_ground(i) and i['pi'] == 0 and i['kind'] == 'top'][0]
    m = Image.new('L', size, 0); ImageDraw.Draw(m).polygon(top['pts'], fill=255)
    hat = Image.new('RGBA', size, LAND + (255,)); hd = ImageDraw.Draw(hat)
    for x in range(-size[1], size[0], 15 * ss): hd.line([(x, 0), (x + size[1], size[1])], fill=(64, 116, 180, 255), width=1)
    img.paste(hat, (0, 0), m)
    d = ImageDraw.Draw(img)
    for it in items:
        if it['t'] == 'face':
            g = is_ground(it)
            if g and it['pi'] == 0 and it['kind'] == 'top':
                d.line(it['pts'] + [it['pts'][0]], fill=LN, width=3); continue
            if g and it['kind'] == 'flat':
                d.line(it['pts'] + [it['pts'][0]], fill=(150, 184, 226), width=1); continue
            fillc = BG if not g else LAND
            if it['mat'] in ('glass', 'door'): fillc = (44, 98, 166)
            d.polygon(it['pts'], fill=fillc)
            d.line(it['pts'] + [it['pts'][0]], fill=LN, width=2 if it['kind'] != 'decal' else 1)
        else:
            d.line([it['a'], it['b']], fill=LN, width=2)
    # Masslinie
    fm = font(int(12.5 * ss), 'mono')
    for (p0, p1, text, off) in scene['dims']:
        a = cam.p(p0[0] + off, p0[1], .3); b = cam.p(p1[0] + off, p1[1], .3)
        d.line([a, b], fill=LN, width=2)
        for (q, e) in ((p0, a), (p1, b)):
            d.line([cam.p(q[0] - .2 * sc, q[1], .3), cam.p(q[0] + off * 1.12, q[1], .3)], fill=(190, 212, 240), width=1)
            d.ellipse([e[0] - 5, e[1] - 5, e[0] + 5, e[1] + 5], fill=LN)
        lay = Image.new('RGBA', size, (0, 0, 0, 0))
        ground_text(lay, text, ((p0[0] + p1[0]) / 2 + off * 1.32, (p0[1] + p1[1]) / 2), cam, fm, LN + (255,), z=.3, along='y')
        img.alpha_composite(lay)
    d = ImageDraw.Draw(img)
    for (text, (x, y, z), (ox, oy)) in NOTES[scene['name']]:
        a = cam.p(x, y, z); b = (a[0] + ox * ss, a[1] + oy * ss)
        tw = d.textlength(text, font=fm); e = (b[0] + (tw + 12 * ss) * (1 if ox > 0 else -1), b[1])
        d.line([a, b, e], fill=LN, width=2); d.ellipse([a[0] - 5, a[1] - 5, a[0] + 5, a[1] + 5], outline=LN, width=2)
        d.text((min(b[0], e[0]) + 6 * ss, b[1] - 17 * ss), text, font=fm, fill=LN)
    # Rahmen und Schriftfeld
    b_ = 16 * ss; d.rectangle([b_, b_, size[0] - b_, size[1] - b_], outline=LN, width=3)
    x0, y0, x1, y1 = size[0] - b_ - 330 * ss, size[1] - b_ - 88 * ss, size[0] - b_, size[1] - b_
    d.rectangle([x0, y0, x1, y1], fill=BG, outline=LN, width=3)
    d.line([(x0, y0 + 36 * ss), (x1, y0 + 36 * ss)], fill=LN, width=2); d.line([(x0 + 215 * ss, y0 + 36 * ss), (x0 + 215 * ss, y1)], fill=LN, width=2)
    d.line([(x0, y0 + 62 * ss), (x1, y0 + 62 * ss)], fill=LN, width=1)
    d.text((x0 + 10 * ss, y0 + 7 * ss), 'HAFENMEISTER', font=font(int(19 * ss), 'bold'), fill=LN)
    st = 'AUSBAUSTUFE 1  BADESTEG' if scene['name'] == 'Stufe 1' else 'AUSBAUSTUFE 5  SEEHAFEN'
    d.text((x0 + 10 * ss, y0 + 42 * ss), st, font=font(int(11 * ss), 'mono'), fill=LN)
    d.text((x0 + 10 * ss, y0 + 67 * ss), 'LAGEPLAN  ISOMETRIE', font=font(int(11 * ss), 'mono'), fill=LN)
    d.text((x0 + 223 * ss, y0 + 42 * ss), 'M 1:100' if scene['name'] == 'Stufe 1' else 'M 1:500', font=font(int(11 * ss), 'mono'), fill=LN)
    d.text((x0 + 223 * ss, y0 + 67 * ss), 'BLATT 1/2' if scene['name'] == 'Stufe 1' else 'BLATT 2/2', font=font(int(11 * ss), 'mono'), fill=LN)
    out = to_np(down(img.convert('RGB'), ss))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vig = 1 - .2 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / 2
    out = out * vig[..., None] * (.95 + .1 * noise(W, H, 120, 51)[..., None]) + .035 * (noise(W, H, 2, 52)[..., None] - .5)
    return from_np(out)

# ------------------------------------------------------------------ 10 Linoldruck
PAPER, NAVY, TEAL, CORAL = (240, 232, 212), (28, 40, 68), (56, 134, 150), (214, 88, 64)
LINO = {}
for k in PAL: LINO[k] = ('P', 'N')
for k in ('roof_red', 'hull_red', 'lh_red', 'umbrella_r', 'canopy', 'pump', 'flag', 'buoy_r', 'wall_wood'): LINO[k] = ('C', 'C')
for k in ('tree', 'tree2', 'hull_green', 'buoy_g', 'cover'): LINO[k] = ('T', 'N')
for k in ('hull_navy', 'hull_dark', 'glass', 'door', 'dark', 'post', 'post_top', 'bollard', 'roof_grey', 'mast', 'mast_wood', 'rig', 'trunk'): LINO[k] = ('N', 'N')
for k in ('hull_white', 'cabin', 'cabin_top', 'sail', 'sail2', 'deck_light', 'lh_white', 'sign', 'pedestal', 'umbrella_w', 'canopy_top', 'lantern', 'hull_yellow', 'wall_yellow'): LINO[k] = ('P', 'P')
for k in ('deck', 'wood', 'pontoon', 'deckwood', 'hull_wood', 'hull_in'): LINO[k] = ('P', 'N')
for k in ('wall_white',): LINO[k] = ('P', 'T')
for k in ('rock', 'rock_top', 'quaywall', 'bank', 'wood_side'): LINO[k] = ('P', 'N')

def style_lino(scene):
    ss = 2; cam, items = setup(scene, ss); size = (W * ss, H * ss); sc = scene['vox']; rnd = random.Random(61)
    D = sdf(scene, cam, size, step=4)
    M = {c: Image.new('L', size, 0) for c in 'NTC'}; Dr = {c: ImageDraw.Draw(M[c]) for c in 'NTC'}
    # Wasser: Teal mit geschnittenen Wellenlinien
    yy, xx = np.mgrid[0:size[1], 0:size[0]].astype(np.float32)
    row = 15 * ss
    wave = yy + 4.5 * ss * np.sin(xx / (30 * ss) + np.floor(yy / row) * 1.7) + 2 * ss * np.sin(xx / (11 * ss))
    band = (wave % row)
    cut = (band < 3.4 * ss)
    brk = noise(size[0], size[1], 46 * ss, 62)
    cut &= brk > .42
    cut |= (D > .25 * sc) & (D < .95 * sc)
    teal = ((D > 0) & ~cut).astype(np.uint8) * 255
    M['T'] = Image.fromarray(teal); Dr['T'] = ImageDraw.Draw(M['T'])
    def put(pts, ink):
        for c in 'NTC': Dr[c].polygon(pts, fill=255 if c == ink else 0)
    lw = int(2.6 * ss)
    hatch = Image.new('L', size, 0); hd = ImageDraw.Draw(hatch)
    for x in range(-size[1], size[0], 7 * ss): hd.line([(x, 0), (x + size[1], size[1])], fill=255, width=int(2.2 * ss))
    ha = np.asarray(hatch) > 0
    for it in items:
        if it['t'] == 'face':
            g = is_ground(it)
            if g:
                put(it['pts'], 'P' if it['kind'] in ('top', 'flat') else 'N')
                if it['kind'] == 'flat' and it['mat'] in ('road', 'pave', 'deckwood'):
                    Dr['N'].line(it['pts'] + [it['pts'][0]], fill=255, width=ss + 1)
                continue
            li, dk = LINO[it['mat']]
            lit = it['kind'] in ('top', 'sail', 'decal') or light(it['n']) > .78
            if it['kind'] == 'decal': ink = 'N'
            else: ink = li if lit else dk
            put(it['pts'], ink)
            Dr['N'].line(it['pts'] + [it['pts'][0]], fill=255, width=lw if sc < .6 else lw - 1)
        else:
            Dr['N'].line([it['a'], it['b']], fill=255, width=max(lw - 1, int(it['w'])))
    # Schatten als Schraffur, nur auf Land und Wasser hinter den Objekten nicht noetig: auf einer eigenen Ebene vor den Objekten waere richtig,
    # hier genuegt die Schraffur dort, wo noch Papier ist.
    sh = np.asarray(shadows(scene, cam, size, (0, 0, 0, 255), dx=.6, dy=-.28, kinds=('building', 'tree', 'lighthouse', 'boat', 'mole'), lines=False))[..., 3] > 0
    n_ = np.asarray(M['N']).copy(); t_ = np.asarray(M['T']).copy(); c_ = np.asarray(M['C']).copy()
    # Grasnarben
    land = D < -1.2 * sc
    specks = Image.new('L', size, 0); sd = ImageDraw.Draw(specks)
    for _ in range(900):
        x, y = rnd.uniform(0, size[0]), rnd.uniform(0, size[1])
        sd.line([(x, y), (x + 3 * ss, y - 5 * ss)], fill=255, width=ss + 1); sd.line([(x + 3 * ss, y - 5 * ss), (x + 7 * ss, y)], fill=255, width=ss + 1)
    occ = Image.new('L', size, 0); od = ImageDraw.Draw(occ)
    for it in items:
        if it['t'] == 'face' and (not is_ground(it) or it['kind'] == 'flat'): od.polygon(it['pts'], fill=255)
    free = np.asarray(occ) == 0
    n_ = np.where((np.asarray(specks) > 0) & land & free, 255, n_)
    n_ = np.where(sh & ha & free, 255, n_)
    def lay(mask, color, shift, seed):
        m = ndimage.shift(mask.astype(np.float32) / 255.0, (shift[1] * ss, shift[0] * ss), order=1, mode='constant')
        mott = noise(size[0], size[1], 2 * ss, seed); big = noise(size[0], size[1], 70 * ss, seed + 1)
        m = m * np.clip(1.25 - 1.0 * (mott > (.80 + .1 * big)), 0, 1) * (.9 + .1 * big)
        return np.clip(m, 0, 1)[..., None], np.array(color, np.float32) / 255.0
    out = np.empty((size[1], size[0], 3), np.float32); out[:] = np.array(PAPER, np.float32) / 255.0
    for (mask, color, shift, seed) in ((t_, TEAL, (2.0, -1.5), 71), (c_, CORAL, (-1.5, 1.5), 73), (n_, NAVY, (0, 0), 75)):
        m, col = lay(mask, color, shift, seed)
        out = out * (1 - m) + (out * col * 1.0 if False else col) * m
    A = 1.3 * ss
    dx = (noise(size[0], size[1], 5 * ss, 81) - .5) * 2 * A; dy = (noise(size[0], size[1], 5 * ss, 82) - .5) * 2 * A
    co = np.array([np.clip(yy + dy, 0, size[1] - 1), np.clip(xx + dx, 0, size[0] - 1)])
    out = np.stack([ndimage.map_coordinates(out[..., c], co, order=1, mode='nearest') for c in range(3)], -1)
    res = to_np(from_np(out).resize((W, H), Image.LANCZOS))
    res = res * (.96 + .05 * noise(W, H, 2, 83)[..., None]) * (.975 + .04 * noise(W, H, 110, 84)[..., None])
    img = from_np(res); d = ImageDraw.Draw(img)
    b = 22; d.rectangle([0, 0, W, H], outline=PAPER, width=b)
    return img

STYLES = dict(watercolor=style_watercolor, blueprint=style_blueprint, lino=style_lino)

"""Stile: Pixel Art, Voxel."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import scene as S
from common import *

# ------------------------------------------------------------------ 6 Pixel Art
PIXPAL = [(24, 60, 104), (36, 92, 140), (52, 128, 172), (88, 168, 200), (148, 208, 220), (226, 244, 248),
          (250, 232, 180), (232, 204, 144), (200, 160, 104), (160, 116, 72), (112, 76, 52), (72, 48, 40),
          (40, 88, 64), (60, 124, 76), (100, 160, 88), (152, 196, 112), (200, 224, 140),
          (128, 36, 44), (196, 60, 52), (236, 112, 84), (244, 204, 88),
          (28, 28, 40), (64, 68, 84), (108, 116, 132), (160, 168, 176), (208, 212, 212), (250, 250, 244), (36, 48, 88)]
PX = dict(PAL)
PX.update(grass=(152, 196, 112), sand=(250, 232, 180), sand_wet=(232, 204, 144), bank=(200, 160, 104), pave=(208, 212, 212), quaywall=(108, 116, 132),
          road=(160, 168, 176), path=(232, 204, 144), tree=(60, 124, 76), tree2=(100, 160, 88), rock=(108, 116, 132), rock_top=(160, 168, 176),
          deck=(200, 160, 104), wood=(200, 160, 104), wood_side=(160, 116, 72), pontoon=(160, 168, 176), deckwood=(200, 160, 104), mast=(64, 68, 84))

def style_pixel(scene):
    PW, PH, SCL = 400, 267, 3
    cam = S.fit(scene, PW, PH, .05); items = S.build(scene, cam); sc = scene['vox']; rnd = random.Random(12)
    D = sdf(scene, cam, (PW, PH), step=1)
    yy, xx = np.mgrid[0:PH, 0:PW]
    chk = ((xx + yy) % 2 == 0)
    a = np.empty((PH, PW, 3), np.uint8); a[:] = PIXPAL[1]
    a[D < 11 * sc] = PIXPAL[2]; a[(D >= 11 * sc) & (D < 13.5 * sc) & chk] = PIXPAL[2]
    a[D < 4 * sc] = PIXPAL[3]; a[(D >= 4 * sc) & (D < 5.6 * sc) & chk] = PIXPAL[3]
    foam = (D > .1 * sc) & (D < .75 * sc) & (np.random.RandomState(3).rand(PH, PW) > .28)
    a[foam] = PIXPAL[5]
    img = Image.fromarray(a); d = ImageDraw.Draw(img)
    for j in range(0, PH, 7):
        for i in range(0, PW, 15):
            x = i + (7 if (j // 7) % 2 else 0) + rnd.randint(-2, 2); y = j + rnd.randint(-1, 1)
            if not (0 <= x < PW - 4 and 0 <= y < PH) or rnd.random() < .45: continue
            dd = D[y, x]
            if dd < 1.4 * sc: continue
            c = PIXPAL[4] if dd < 11 * sc else PIXPAL[2]
            d.line([(x, y), (x + rnd.randint(2, 4), y)], fill=c)
    R = lambda pts: [(int(round(p[0])), int(round(p[1]))) for p in pts]
    # Boden mit Sprenkeln
    g = Image.new('RGBA', (PW, PH), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for it in items:
        if is_ground(it): gd.polygon(R(it['pts']), fill=shade(PX[it['mat']], light(it['n'], .7, .37)) + (255,))
    ga = np.asarray(g).copy(); rs = np.random.RandomState(5).rand(PH, PW)
    f = np.ones((PH, PW), np.float32); f[rs < .07] = .86; f[rs > .95] = 1.1
    ga[..., :3] = np.clip(ga[..., :3] * f[..., None], 0, 255).astype(np.uint8)
    img.paste(Image.fromarray(ga[..., :3]), (0, 0), Image.fromarray(ga[..., 3]))
    sh = Image.new('L', (PW, PH), 0); sd = ImageDraw.Draw(sh)
    for o in scene['objects']:
        for poly in S.shadow_polys(o, cam, .5, -.22, lines=False):
            if len(poly) >= 3: sd.polygon(R(poly), fill=255)
    ia = np.asarray(img).astype(np.float32); m = (np.asarray(sh) > 0)
    ia[m] *= .78
    img = Image.fromarray(ia.astype(np.uint8)); d = ImageDraw.Draw(img)
    for it in items:
        if is_ground(it): continue
        if it['t'] == 'face':
            c = face_col(PX, it, .6, .48)
            big = it['o']['kind'] in ('building', 'lighthouse', 'mole') or sc < .6
            d.polygon(R(it['pts']), fill=c, outline=shade(c, .62) if big else None)
        else:
            d.line(R([it['a'], it['b']]), fill=PX[it['mat']], width=1 if it['w'] < 1.6 else 2)
    pal = Image.new('P', (1, 1)); flatp = [v for c in PIXPAL for v in c]; pal.putpalette(flatp + flatp[:3] * (256 - len(PIXPAL)))
    img = img.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    return img.resize((PW * SCL, PH * SCL), Image.NEAREST).crop((0, 0, W, H))

# ------------------------------------------------------------------ 7 Voxel
VX = {k: sat(v, 1.12) for k, v in PAL.items()}
VX.update(grass=(124, 186, 88), sand=(238, 214, 150), pave=(196, 196, 196), quaywall=(150, 150, 152), bank=(124, 186, 88), tree=(52, 128, 72), tree2=(84, 156, 76))

def _k_range(z0, z1, v):
    k0 = math.floor(z0 / v + .35); k1 = math.ceil(z1 / v - .35)
    if k1 <= k0:
        k0 = math.floor((z0 + z1) / 2 / v); k1 = k0 + 1
    return k0, k1

def voxelize(scene, cam, size):
    v = scene['vox']
    cs = [cam.inv(0, 0), cam.inv(size[0], 0), cam.inv(0, size[1]), cam.inv(size[0], size[1])]
    pad = 14
    X0 = math.floor(min(c[0] for c in cs) / v) - 2; X1 = math.ceil(max(c[0] for c in cs) / v) + pad
    Y0 = math.floor(min(c[1] for c in cs) / v) - 2; Y1 = math.ceil(max(c[1] for c in cs) / v) + pad
    vox = {}; minis = []; water_over = {}
    def cells(bx0, by0, bx1, by1):
        thinx = (bx1 - bx0) < v; thiny = (by1 - by0) < v
        i0 = max(X0, math.floor(bx0 / v)); i1 = min(X1, math.ceil(bx1 / v))
        j0 = max(Y0, math.floor(by0 / v)); j1 = min(Y1, math.ceil(by1 / v))
        if thinx: i0 = math.floor((bx0 + bx1) / 2 / v); i1 = i0 + 1
        if thiny: j0 = math.floor((by0 + by1) / 2 / v); j1 = j0 + 1
        for i in range(i0, i1):
            for j in range(j0, j1):
                yield i, j, ((bx0 + bx1) / 2 if thinx else (i + .5) * v), ((by0 + by1) / 2 if thiny else (j + .5) * v)
    def fill(prims, ground=False):
        for pr in prims:
            t = pr['t']
            if t == 'prism' and pr.get('decal'):
                P = pr['poly']; bx0, by0 = min(p[0] for p in P), min(p[1] for p in P); bx1, by1 = max(p[0] for p in P), max(p[1] for p in P)
                zs = [pr['z0'] + (pr['z1'] - pr['z0']) * (q + .5) / max(1, round((pr['z1'] - pr['z0']) / v)) for q in range(max(1, round((pr['z1'] - pr['z0']) / v)))]
                if by1 - by0 < bx1 - bx0:
                    n = max(1, round((bx1 - bx0) / v)); pts = [(bx0 + (bx1 - bx0) * (q + .5) / n, by0 - v * .5) for q in range(n)]
                else:
                    n = max(1, round((by1 - by0) / v)); pts = [(bx0 - v * .5, by0 + (by1 - by0) * (q + .5) / n) for q in range(n)]
                for (x, y) in pts:
                    for z in zs:
                        key = (math.floor(x / v), math.floor(y / v), math.floor(z / v))
                        if key in vox: vox[key] = pr['mat']
            elif t == 'prism':
                P = pr['poly']; k0, k1 = _k_range(pr['z0'], pr['z1'], v)
                for i, j, cx, cy in cells(min(p[0] for p in P), min(p[1] for p in P), max(p[0] for p in P), max(p[1] for p in P)):
                    if in_poly(cx, cy, P):
                        for k in range(k0, k1):
                            vox[(i, j, k)] = pr['top'] if k == k1 - 1 else pr['mat']
            elif t == 'flat':
                P = pr['poly']; k = math.floor(pr['z'] / v - .2)
                for i, j, cx, cy in cells(min(p[0] for p in P), min(p[1] for p in P), max(p[0] for p in P), max(p[1] for p in P)):
                    if in_poly(cx, cy, P) or in_poly(cx, cy - .49 * v, P):
                        if pr['z'] < .1: water_over[(i, j)] = pr['mat']
                        else:
                            for kk in (k, k - 1, k + 1):
                                if (i, j, kk) in vox and (i, j, kk + 1) not in vox: vox[(i, j, kk)] = pr['mat']; break
            elif t == 'gable':
                x0, y0, x1, y1 = pr['r']; z0, h = pr['z0'], pr['h']; kb = math.floor(z0 / v + .35)
                for i, j, cx, cy in cells(x0, y0, x1, y1):
                    f = 1 - abs((cy - (y0 + y1) / 2) / ((y1 - y0) / 2)) if pr['axis'] == 'x' else 1 - abs((cx - (x0 + x1) / 2) / ((x1 - x0) / 2))
                    hz = z0 + h * max(0, f) * 1.15; k = kb
                    vox[(i, j, k)] = pr['mat']
                    while (k + 1.5) * v < hz + v * .5:
                        k += 1; vox[(i, j, k)] = pr['mat']
            elif t == 'frustum':
                cx0, cy0 = pr['c']; r0, r1, h, z0 = pr['r0'], pr['r1'], pr['h'], pr['z0']; k0, k1 = _k_range(z0, z0 + h, v); R_ = max(r0, r1)
                ci, cj = math.floor(cx0 / v), math.floor(cy0 / v)
                for k in range(k0, k1):
                    tt = min(1, max(0, ((k + .5) * v - z0) / h)); r = r0 + (r1 - r0) * tt
                    for i in range(math.floor((cx0 - R_) / v), math.ceil((cx0 + R_) / v)):
                        for j in range(math.floor((cy0 - R_) / v), math.ceil((cy0 + R_) / v)):
                            if math.hypot((i + .5) * v - cx0, (j + .5) * v - cy0) <= r or (i == ci and j == cj):
                                vox[(i, j, k)] = pr['top'] if (k == k1 - 1 and r1 > 1e-3) else pr['mat']
            elif t == 'line':
                if pr['mat'] == 'rig': continue
                a, b = pr['p0'], pr['p1']; L = math.dist(a, b); mv = v * .42; n = max(1, int(L / (mv * .8)))
                for q in range(n + 1):
                    tt = q / n; minis.append((a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt, a[2] + (b[2] - a[2]) * tt, mv * (.9 if pr['w'] < .2 else 1.25), pr['mat']))
            elif t == 'tri':
                a, b, c = pr['pts']; mv = v * .5
                n = max(2, int(max(math.dist(a, b), math.dist(a, c)) / (mv * .85)))
                for q in range(n + 1):
                    for r_ in range(n + 1 - q):
                        u, w_ = q / n, r_ / n
                        minis.append((a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * w_, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * w_, a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * w_, mv, pr['mat']))
    fill(scene['ground'], True)
    for o in scene['objects']:
        fill(o['prims'])
    return vox, minis, water_over, (X0, X1, Y0, Y1)

def style_voxel(scene):
    ss = 2; cam, _ = setup(scene, ss); size = (W * ss, H * ss); v = scene['vox']; sc = v
    vox, minis, wover, (X0, X1, Y0, Y1) = voxelize(scene, cam, size)
    img = Image.new('RGB', size, (40, 110, 170)); d = ImageDraw.Draw(img)
    h = lambda i, j, k: ((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) % 1000 / 1000.0
    wc = [(128, 206, 214), (70, 164, 204), (44, 124, 184)]
    for i in range(X0, X1):
        for j in range(Y0, Y1):
            p = [cam.p(i * v, j * v), cam.p((i + 1) * v, j * v), cam.p((i + 1) * v, (j + 1) * v), cam.p(i * v, (j + 1) * v)]
            if p[2][1] < 0 or p[0][1] > size[1] or p[1][0] < 0 or p[3][0] > size[0]: continue
            if (i, j) in wover: c = VX[wover[(i, j)]]
            else:
                dd = coast_dist(scene, (i + .5) * v, (j + .5) * v) / sc + (1.2 if (i + j) % 2 else 0)
                c = wc[0] if dd < 3.6 else wc[1] if dd < 11 else wc[2]
            c = shade(c, .97 + .06 * h(i, j, 0))
            d.polygon(p, fill=c, outline=shade(c, .93))
    draw = []
    for (i, j, k), m in vox.items():
        if k < 0: continue
        draw.append((i + j + k + 1.5, 0, i, j, k, m))
    for (x, y, z, s_, m) in minis:
        draw.append(((x + y + z) / v + .2, 1, x, y, z, (s_, m)))
    draw.sort(key=lambda t: t[0])
    def cube(x0, y0, z0, s_, c, faces=(True, True, True), jit=1.0, ao=1.0):
        x1, y1, z1 = x0 + s_, y0 + s_, z0 + s_
        if faces[2]:
            cc = shade(c, .68 * jit); d.polygon([cam.p(x1, y0, z0), cam.p(x1, y1, z0), cam.p(x1, y1, z1), cam.p(x1, y0, z1)], fill=cc, outline=shade(cc, .9))
        if faces[1]:
            cc = shade(c, .84 * jit); d.polygon([cam.p(x0, y1, z0), cam.p(x1, y1, z0), cam.p(x1, y1, z1), cam.p(x0, y1, z1)], fill=cc, outline=shade(cc, .9))
        if faces[0]:
            cc = shade(c, 1.0 * jit * ao); d.polygon([cam.p(x0, y0, z1), cam.p(x1, y0, z1), cam.p(x1, y1, z1), cam.p(x0, y1, z1)], fill=cc, outline=shade(cc, .9))
    for it in draw:
        if it[1] == 0:
            _, _, i, j, k, m = it
            top = (i, j, k + 1) not in vox; fx = (i + 1, j, k) not in vox; fy = (i, j + 1, k) not in vox
            if not (top or fx or fy): continue
            ao = .86 if ((i - 1, j, k + 1) in vox or (i, j - 1, k + 1) in vox) else 1.0
            cube(i * v, j * v, k * v, v, VX[m], (top, fy, fx), .96 + .08 * h(i, j, k), ao)
        else:
            _, _, x, y, z, (s_, m) = it
            cube(x - s_ / 2, y - s_ / 2, z - s_ / 2, s_, VX[m])
    return down(img, ss)

STYLES = dict(pixel=style_pixel, voxel=style_voxel)

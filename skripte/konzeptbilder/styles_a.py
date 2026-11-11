"""Stile: Low Poly, Flat Vector, Seekarte, Papier, Holzspielzeug."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import scene as S
from common import *

# ------------------------------------------------------------------ 1 Low Poly
LP = dict(PAL)
LP.update(water=(58, 160, 186), sand=(240, 218, 164), grass=(150, 190, 112), pave=(214, 210, 200), roof_red=(214, 92, 72),
          tree=(64, 138, 98), tree2=(104, 164, 96), rock=(134, 136, 148), rock_top=(164, 166, 174), deck=(206, 170, 118), pontoon=(186, 192, 200))

def style_lowpoly(scene):
    ss = 2; cam, items = setup(scene, ss); size = (W * ss, H * ss)
    rnd = random.Random(3); sc = scene['vox']
    img = Image.new('RGB', size, LP['water']); d = ImageDraw.Draw(img)
    deep, mid, shallow = (36, 112, 160), (58, 160, 186), (126, 208, 204)
    for t in tri_mesh(size[0], size[1], 74, 5):
        cx, cy = sum(p[0] for p in t) / 3, sum(p[1] for p in t) / 3
        wx, wy = cam.inv(cx, cy); dist = coast_dist(scene, wx, wy) / (26 * sc)
        c = mix(shallow, mid, min(1, dist * 2.2)) if dist < .45 else mix(mid, deep, min(1, (dist - .45) * 1.1))
        d.polygon(t, fill=shade(c, rnd.uniform(.93, 1.07)))
    g = Image.new('RGBA', size, (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    draw_items(gd, [i for i in items if is_ground(i)], lambda it: shade(LP[it['mat']], light(it['n'])) + (255,))
    f = Image.new('L', size, 128); fd = ImageDraw.Draw(f)
    for t in tri_mesh(size[0], size[1], 58, 9):
        fd.polygon(t, fill=int(128 * rnd.uniform(.9, 1.08)))
    ga = np.asarray(g, np.float32).copy(); fa = np.asarray(f, np.float32)[..., None] / 128.0
    ga[..., :3] = np.clip(ga[..., :3] * fa, 0, 255)
    img.paste(Image.fromarray(ga.astype(np.uint8)), (0, 0), Image.fromarray(ga[..., 3].astype(np.uint8)))
    sh = shadows(scene, cam, size, (20, 40, 60, 70)); img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    def col(it):
        if it['t'] == 'line' or it['kind'] == 'sail': return LP[it['mat']]
        return shade(LP[it['mat']], light(it['n'], .58, .5) * rnd.uniform(.96, 1.04))
    draw_items(d, [i for i in items if not is_ground(i)], col, min_lw=3)
    return down(img, ss)

# ------------------------------------------------------------------ 2 Flat Vector
FL = dict(PAL)
FL.update(water=(118, 196, 204), sand=(247, 228, 182), sand_wet=(226, 222, 190), grass=(184, 220, 168), bank=(226, 206, 160), pave=(240, 236, 226),
          quaywall=(190, 200, 206), road=(228, 224, 216), path=(242, 226, 192), deckwood=(228, 184, 134), deck=(232, 190, 134), wood=(228, 184, 128),
          wood_side=(194, 150, 100), post=(92, 84, 96), post_top=(116, 106, 116), pontoon=(206, 216, 224), roof_red=(242, 116, 92), roof_grey=(82, 100, 122),
          wall_white=(255, 248, 234), wall_yellow=(250, 212, 120), wall_wood=(216, 152, 104), tree=(80, 158, 128), tree2=(118, 186, 132), trunk=(150, 112, 86),
          rock=(146, 164, 176), rock_top=(174, 190, 200), hull_navy=(46, 72, 104), hull_red=(238, 100, 84), hull_yellow=(250, 208, 96), hull_green=(80, 158, 128),
          hull_dark=(46, 60, 78), glass=(62, 94, 122), cover=(72, 122, 192), lh_red=(238, 90, 78), umbrella_r=(238, 100, 84), canopy=(238, 100, 84),
          pump=(238, 100, 84), flag=(238, 90, 78), buoy_r=(238, 90, 78), buoy_g=(80, 158, 128), mast=(96, 110, 128), door=(120, 86, 70))

def style_flat(scene):
    ss = 2; cam, items = setup(scene, ss); size = (W * ss, H * ss); sc = scene['vox']; rnd = random.Random(4)
    D = sdf(scene, cam, size)
    a = np.empty((size[1], size[0], 3), np.float32); a[:] = FL['water']
    a[D < 7 * sc] = (150, 214, 216)
    a[(D > .25 * sc) & (D < .8 * sc)] = (240, 250, 248)
    img = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(img, 'RGBA')
    for _ in range(170):
        x, y = rnd.uniform(0, size[0]), rnd.uniform(0, size[1])
        if D[int(y), int(x)] < 2.5 * sc: continue
        L = rnd.uniform(16, 40) * ss; w = 3 * ss
        d.line([(x, y), (x + L, y)], fill=(255, 255, 255, 150), width=w)
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=(255, 255, 255, 150)); d.ellipse([x + L - w / 2, y - w / 2, x + L + w / 2, y + w / 2], fill=(255, 255, 255, 150))
    col = lambda it: face_col(FL, it, .76, .29)
    draw_items(d, [i for i in items if is_ground(i)], col)
    sh = shadows(scene, cam, size, (38, 60, 84, 46), dx=1.25, dy=-.55, lines=False); img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    draw_items(d, [i for i in items if not is_ground(i)], col, min_lw=3)
    return down(img, ss)

# ------------------------------------------------------------------ 3 Seekarte mit Modellen
CH = {k: sat(v, .92) for k, v in PAL.items()}
CHG = dict(grass=(246, 230, 164), sand=(250, 239, 190), sand_wet=(200, 222, 184), pave=(238, 229, 200), road=(255, 252, 240), path=(251, 245, 222),
           deckwood=(228, 204, 156), bank=(204, 184, 126), quaywall=(204, 184, 126))

def style_chart(scene):
    ss = 2; cam, items = setup(scene, ss); size = (W * ss, H * ss); sc = scene['vox']; rnd = random.Random(8)
    D = sdf(scene, cam, size, step=4)
    a = np.empty((size[1], size[0], 3), np.float32); a[:] = (252, 250, 243)
    a[D < 12 * sc] = (226, 240, 248); a[D < 5.5 * sc] = (194, 224, 242)
    yy, xx = np.mgrid[0:size[1], 0:size[0]]
    for lvl, dash in ((5.5, False), (12, False), (20, True)):
        m = np.abs(D - lvl * sc) < .09 * sc * (1.0 if not dash else .9)
        if dash: m &= ((xx + 2 * yy) // (14 * ss)) % 2 == 0
        a[m] = (92, 146, 198)
    img = Image.fromarray(a.astype(np.uint8)).convert('RGBA')
    lay = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    # Gitternetz in der Boden-Ebene
    step = 6 if sc < .6 else 20
    for i in range(-10, 12):
        d.line([cam.p(i * step, -300), cam.p(i * step, 300)], fill=(150, 150, 165, 90), width=ss)
        d.line([cam.p(-300, i * step), cam.p(300, i * step)], fill=(150, 150, 165, 90), width=ss)
    # Kompassrose
    cx, cy = cam.inv(size[0] * .15, size[1] * .80); R = 9 * sc; mag = (176, 64, 140, 255)
    ring = lambda r: [cam.p(cx + r * math.cos(t * math.pi / 60), cy + r * math.sin(t * math.pi / 60)) for t in range(121)]
    d.line(ring(R), fill=mag, width=ss + 1); d.line(ring(R * .8), fill=mag, width=ss)
    for t in range(0, 360, 10):
        r0 = R * (.8 if t % 30 else .68); an = math.radians(t)
        d.line([cam.p(cx + r0 * math.cos(an), cy + r0 * math.sin(an)), cam.p(cx + R * math.cos(an), cy + R * math.sin(an))], fill=mag, width=ss)
    for k_ in range(4):
        an = math.radians(-135 + 90 * k_); L_ = R * (.66 if k_ else .78)
        tip = (cx + L_ * math.cos(an), cy + L_ * math.sin(an)); l = (cx + R * .09 * math.cos(an + 1.57), cy + R * .09 * math.sin(an + 1.57)); r = (cx + R * .09 * math.cos(an - 1.57), cy + R * .09 * math.sin(an - 1.57))
        d.polygon([cam.p(*tip), cam.p(*l), cam.p(*r)], fill=mag if k_ == 0 else None, outline=mag)
    an = math.radians(-135)
    ground_text(lay, 'N', (cx + R * 1.22 * math.cos(an), cy + R * 1.22 * math.sin(an)), cam, font(int(20 * ss), 'serifb'), mag)
    # Tiefenzahlen (nicht unter Objekten)
    occ = Image.new('L', size, 0); od = ImageDraw.Draw(occ)
    for it in items:
        if is_ground(it): continue
        if it['t'] == 'face': od.polygon(it['pts'], fill=255)
    occ = np.asarray(occ.filter(ImageFilter.MaxFilter(int(12 * ss) | 1)).filter(ImageFilter.BoxBlur(26 * ss)))
    fn = font(int(11.5 * ss), 'italic')
    for gy in range(0, size[1], 92 * ss):
        for gx in range(0, size[0], 118 * ss):
            x, y = gx + rnd.uniform(-34, 34) * ss, gy + rnd.uniform(-26, 26) * ss
            if not (40 < x < size[0] - 40 and 40 < y < size[1] - 40): continue
            dd = D[int(y), int(x)]
            if dd < 1.6 * sc or occ[int(y), int(x)] > 6: continue
            wx, wy = cam.inv(x, y)
            if math.hypot(wx - cx, wy - cy) < R * 1.45: continue
            depth = .5 + dd / sc * .13 + rnd.uniform(-.15, .15)
            ground_text(lay, f'{depth:.1f}'.replace('.', ','), (wx, wy), cam, fn, (104, 116, 134, 255))
    img.alpha_composite(lay)
    d = ImageDraw.Draw(img)
    gcol = lambda it: shade(CHG.get(it['mat'], (246, 230, 164)), 1.0 if it['kind'] in ('top', 'flat') else 1.0)
    draw_items(d, [i for i in items if is_ground(i)], gcol)
    top = [i for i in items if is_ground(i) and i['pi'] == 0 and i['kind'] == 'top'][0]
    d.line(top['pts'] + [top['pts'][0]], fill=(40, 40, 46), width=ss + 1)
    lab = Image.new('RGBA', size, (0, 0, 0, 0)); fl = font(int(15 * ss), 'italic')
    for text, pos in scene['labels']:
        ground_text(lab, text, pos, cam, fl, (50, 52, 64, 255))
    img.alpha_composite(lab)
    img.alpha_composite(shadows(scene, cam, size, (30, 34, 50, 96), blur=5 * ss, dx=.6, dy=-.28))
    d = ImageDraw.Draw(img)
    draw_items(d, [i for i in items if not is_ground(i)], lambda it: face_col(CH, it, .6, .48), outline=lambda it: (150, 152, 164) if it['kind'] == 'sail' else None, min_lw=3)
    # Kartenrand
    b = 11 * ss; d.rectangle([0, 0, size[0] - 1, size[1] - 1], outline=(40, 40, 46), width=b)
    d.rectangle([b - 3, b - 3, size[0] - b + 2, size[1] - b + 2], outline=(40, 40, 46), width=2)
    seg = 60 * ss
    for i in range(0, size[0], seg * 2):
        d.rectangle([i + 4, 4, i + seg, b - 6], fill=(252, 250, 243)); d.rectangle([i + seg, size[1] - b + 5, i + 2 * seg - 4, size[1] - 5], fill=(252, 250, 243))
    for i in range(0, size[1], seg * 2):
        d.rectangle([4, i + 4, b - 6, i + seg], fill=(252, 250, 243)); d.rectangle([size[0] - b + 5, i + seg, size[0] - 5, i + 2 * seg - 4], fill=(252, 250, 243))
    out = to_np(down(img.convert('RGB'), ss)); g = noise(W, H, 3, 2)[..., None]
    return from_np(out * (.975 + .05 * g))

# ------------------------------------------------------------------ 4 Papier-Cutout
PP = {k: sat(v, .95) for k, v in PAL.items()}
PP.update(grass=(160, 190, 124), sand=(240, 222, 176), sand_wet=(218, 206, 168), pave=(228, 222, 208), bank=(206, 184, 140), quaywall=(176, 172, 166),
          deck=(204, 166, 112), wood=(204, 166, 112), pontoon=(196, 200, 204), road=(206, 200, 190), tree=(74, 132, 92), tree2=(110, 160, 98))

def _paste_with_shadow(base, tile, pos, off, blur, alpha):
    al = tile.split()[3]
    pad = blur * 3
    big = Image.new('L', (tile.size[0] + 2 * pad, tile.size[1] + 2 * pad), 0); big.paste(al, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * alpha))
    sh = Image.new('RGBA', big.size, (24, 26, 40, 0)); sh.putalpha(big)
    _comp(base, sh, (pos[0] - pad + off[0], pos[1] - pad + off[1]))
    _comp(base, tile, pos)

def _comp(base, tile, pos):
    x, y = pos; x0, y0 = max(0, x), max(0, y); x1, y1 = min(base.size[0], x + tile.size[0]), min(base.size[1], y + tile.size[1])
    if x1 <= x0 or y1 <= y0: return
    base.alpha_composite(tile.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))

def style_paper(scene):
    ss = 2; cam, items = setup(scene, ss); size = (W * ss, H * ss); sc = scene['vox']
    D = sdf(scene, cam, size, step=4)
    yy, xx = np.mgrid[0:size[1], 0:size[0]].astype(np.float32)
    s_ = (xx * 2 + yy) / math.sqrt(5)
    blues = [(44, 104, 150), (58, 124, 168), (80, 146, 184), (108, 170, 198), (142, 194, 210), (180, 216, 222)]
    img = Image.new('RGBA', size, blues[0] + (255,))
    for i, t in enumerate((30, 21, 13, 7, 2.6)):
        per = (64 + 9 * i) * ss
        wob = np.abs(np.sin(np.pi * (s_ + 37 * i * ss) / per)) * 1.5 * sc
        m = Image.fromarray(((D - wob < t * sc) * 255).astype(np.uint8))
        tile = Image.new('RGBA', size, blues[i + 1] + (255,)); tile.putalpha(m)
        _paste_with_shadow(img, tile, (0, 0), (3 * ss, 4 * ss), 3 * ss, .5)
    col = lambda it: face_col(PP, it, .8, .25) + (255,) if it['t'] == 'face' else PP[it['mat']] + (255,)
    for g in groups(items):
        pad = 4 * ss
        x0, y0, x1, y1 = group_bbox(g, pad, size)
        if x1 - x0 < 2 or y1 - y0 < 2: continue
        tile = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0)); td = ImageDraw.Draw(tile)
        for it in g:
            if it['t'] == 'face':
                td.polygon([(p[0] - x0, p[1] - y0) for p in it['pts']], fill=col(it))
            else:
                td.line([(it['a'][0] - x0, it['a'][1] - y0), (it['b'][0] - x0, it['b'][1] - y0)], fill=col(it), width=max(int(round(it['w'])), 3))
        ground = g[0]['obj'] == -1
        _paste_with_shadow(img, tile, (x0, y0), (2 * ss, 3 * ss) if not ground else (3 * ss, 4 * ss), (2 if not ground else 3) * ss, .55 if not ground else .5)
    out = to_np(down(img.convert('RGB'), ss))
    grain = noise(W, H, 2, 5)[..., None]; fib = noise(W, H, 40, 6)[..., None]
    return from_np(out * (.95 + .07 * grain) * (.97 + .06 * fib))

# ------------------------------------------------------------------ 5 Holzspielzeug
NW, NW2, NW3 = (236, 204, 150), (212, 168, 108), (190, 142, 88)
RED, BLUE, YEL, GRN, WHT = (226, 44, 44), (36, 96, 196), (250, 204, 40), (46, 160, 80), (250, 250, 245)
TY = dict(PAL)
TY.update(water=(44, 132, 204), grass=(118, 194, 84), sand=(250, 216, 104), sand_wet=(88, 168, 222), bank=NW2, quaywall=NW2, pave=NW, road=NW2, path=(244, 216, 160),
          deckwood=(226, 186, 128), deck=NW, wood=NW, wood_side=NW2, post=NW3, post_top=NW2, pontoon=NW, hull_white=WHT, hull_navy=BLUE, hull_red=RED,
          hull_yellow=YEL, hull_green=GRN, hull_wood=NW2, hull_dark=(64, 52, 52), hull_in=NW, deck_light=(250, 246, 236), cabin=WHT, cabin_top=(236, 238, 240), glass=BLUE, cover=BLUE,
          sail=(252, 252, 248), sail2=(244, 244, 238), mast=NW2, mast_wood=NW2, rig=(160, 124, 90), wall_white=(250, 246, 236), wall_yellow=YEL, wall_wood=NW,
          roof_red=RED, roof_grey=BLUE, door=(150, 96, 54), rock=(150, 152, 160), rock_top=(178, 180, 186), lh_white=WHT, lh_red=RED, lantern=(250, 216, 64),
          dark=(64, 64, 74), tree=GRN, tree2=(104, 190, 72), trunk=NW3, umbrella_r=RED, umbrella_w=WHT, canopy=RED, canopy_top=WHT, pump=RED, flag=RED,
          buoy_r=RED, buoy_g=GRN, sign=WHT, pedestal=WHT, bollard=(64, 64, 74))
WOODY = {'deck', 'deck_light', 'wood', 'wood_side', 'pontoon', 'post', 'post_top', 'hull_wood', 'hull_in', 'mast', 'mast_wood', 'wall_wood', 'trunk', 'cabin_top',
         'deckwood', 'pave', 'road', 'path', 'quaywall', 'bank'}

def style_toy(scene):
    ss = 2; cam, items = setup(scene, ss, margin=.075); size = (W * ss, H * ss); rnd = random.Random(6)
    img = Image.new('RGB', size, TY['water']); d = ImageDraw.Draw(img, 'RGBA')
    stepx, stepy = 92 * ss, 46 * ss
    for j in range(-1, size[1] // stepy + 2):
        for i in range(-1, size[0] // stepx + 2):
            x = i * stepx + (stepx // 2 if j % 2 else 0); y = j * stepy; r = 17 * ss
            d.arc([x - r, y - r * .5, x + r, y + r * .9], 200, 340, fill=(140, 200, 244, 230), width=3 * ss)
    wood = Image.new('L', size, 0); wd = ImageDraw.Draw(wood)
    def paint(sub, with_shadow_first=None):
        for it in sub:
            if it['t'] == 'face':
                c = face_col(TY, it, .66, .42)
                d.polygon(it['pts'], fill=c)
                d.line(it['pts'] + [it['pts'][0]], fill=shade(c, 1.1) + (200,), width=ss + 1)
                wd.polygon(it['pts'], fill=255 if it['mat'] in WOODY else 0)
            else:
                w = max(int(round(it['w'] * 1.9)), 5)
                d.line([it['a'], it['b']], fill=TY[it['mat']], width=w)
                wd.line([it['a'], it['b']], fill=255 if it['mat'] in WOODY else 0, width=w)
    paint([i for i in items if is_ground(i)])
    sh = shadows(scene, cam, size, (20, 30, 60, 120), blur=4 * ss, dx=.42, dy=-.2, lines=False); img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img, 'RGBA')
    paint([i for i in items if not is_ground(i)])
    a = np.asarray(img, np.float32) / 255.0
    grain = np.asarray(Image.fromarray((np.random.RandomState(4).rand(size[1] // 3, size[0] // 160 + 2) * 255).astype(np.uint8)).resize(size, Image.BICUBIC), np.float32) / 255.0
    m = (np.asarray(wood, np.float32) / 255.0)[..., None]
    a = a * (1 - m * (.16 * (grain[..., None] - .35)))
    img = from_np(a).resize((W, H), Image.LANCZOS)
    # Holzrahmen des Spielbretts
    d = ImageDraw.Draw(img); b = 26
    fr = Image.new('RGB', (W, H), NW2); fa = np.asarray(fr, np.float32) / 255.0
    g2 = np.asarray(Image.fromarray((np.random.RandomState(9).rand(H // 2, W // 90 + 2) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32)[..., None] / 255.0
    fr = from_np(fa * (.9 + .2 * g2))
    mask = Image.new('L', (W, H), 255); ImageDraw.Draw(mask).rounded_rectangle([b, b, W - b, H - b], radius=10, fill=0)
    img.paste(fr, (0, 0), mask)
    d.rounded_rectangle([b, b, W - b, H - b], radius=10, outline=(120, 84, 48), width=3)
    d.rounded_rectangle([1, 1, W - 2, H - 2], radius=6, outline=(244, 214, 164), width=3)
    return img

STYLES = dict(lowpoly=style_lowpoly, flat=style_flat, chart=style_chart, paper=style_paper, toy=style_toy)

"""Gemeinsame Hilfen fuer alle Stil-Renderer."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import scene as S

W, H = 1200, 800

PAL = dict(
    water=(62, 150, 190), sand=(236, 214, 160), sand_wet=(206, 192, 150), grass=(142, 182, 112), bank=(196, 170, 120),
    pave=(203, 202, 196), quaywall=(150, 150, 152), road=(170, 168, 165), path=(224, 206, 166), deckwood=(192, 152, 108),
    deck=(198, 162, 112), wood=(190, 152, 102), wood_side=(150, 115, 75), post=(92, 72, 56), post_top=(120, 96, 74), pontoon=(172, 178, 184),
    hull_white=(245, 245, 240), hull_navy=(44, 64, 104), hull_red=(200, 62, 52), hull_yellow=(240, 200, 72), hull_green=(62, 132, 102),
    hull_wood=(172, 122, 72), hull_dark=(52, 46, 46), hull_in=(214, 180, 130), deck_light=(232, 222, 202), cabin=(250, 250, 248), cabin_top=(228, 230, 232),
    glass=(60, 86, 112), cover=(50, 92, 162), sail=(250, 248, 240), sail2=(238, 236, 228), mast=(120, 126, 136), mast_wood=(120, 86, 56), rig=(110, 112, 118),
    wall_white=(240, 236, 226), wall_yellow=(236, 202, 112), wall_wood=(172, 112, 72), roof_red=(192, 76, 60), roof_grey=(112, 116, 126), door=(92, 62, 46),
    rock=(128, 128, 134), rock_top=(152, 152, 154), lh_white=(246, 246, 246), lh_red=(206, 52, 46), lantern=(250, 222, 122), dark=(60, 60, 66),
    tree=(70, 130, 86), tree2=(98, 152, 92), trunk=(110, 80, 56), umbrella_r=(216, 72, 62), umbrella_w=(245, 240, 230),
    canopy=(226, 62, 52), canopy_top=(238, 236, 230), pump=(222, 62, 52), flag=(216, 52, 52), buoy_r=(216, 52, 46), buoy_g=(52, 150, 92),
    sign=(245, 240, 230), pedestal=(236, 236, 236), bollard=(56, 56, 62))

LD = (-.4, .4, .82)

def light(n, amb=.62, dif=.46):
    return amb + dif * max(0.0, n[0] * LD[0] + n[1] * LD[1] + n[2] * LD[2])

def clamp8(v):
    return 0 if v < 0 else 255 if v > 255 else int(v)

def shade(c, f):
    return (clamp8(c[0] * f), clamp8(c[1] * f), clamp8(c[2] * f))

def mix(a, b, t):
    return tuple(clamp8(a[i] + (b[i] - a[i]) * t) for i in range(3))

def sat(c, s):
    g = .3 * c[0] + .59 * c[1] + .11 * c[2]
    return tuple(clamp8(g + (v - g) * s) for v in c)

def noise(w, h, cell, seed, octaves=1):
    """Weiches Rauschen 0..1 als float-Array (h, w)."""
    rs = np.random.RandomState(seed); out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        c = max(2, int(cell / (2 ** o)))
        small = rs.rand(h // c + 3, w // c + 3).astype(np.float32)
        im = Image.fromarray((small * 255).astype(np.uint8)).resize((w + 2 * c, h + 2 * c), Image.BICUBIC)
        out += np.asarray(im, np.float32)[c:c + h, c:c + w] / 255.0 * amp; tot += amp; amp *= .5
    return out / tot

def tri_mesh(w, h, cell, seed, jitter=.38):
    rs = random.Random(seed); nx, ny = int(w / cell) + 3, int(h / cell) + 3
    P = [[((i - 1) * cell + rs.uniform(-jitter, jitter) * cell, (j - 1) * cell + rs.uniform(-jitter, jitter) * cell) for i in range(nx)] for j in range(ny)]
    T = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a, b, c, d = P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]
            if (i + j) % 2 == 0: T += [(a, b, c), (a, c, d)]
            else: T += [(a, b, d), (b, c, d)]
    return T

def coast_dist(scene, x, y):
    best = 1e9; C = scene['coast']
    for i in range(len(C) - 1):
        (ax, ay), (bx, by) = C[i], C[i + 1]
        vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1e-9
        t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2))
        d = math.hypot(x - ax - t * vx, y - ay - t * vy)
        if d < best: best = d
    return best

def font(size, kind='sans'):
    names = dict(sans='DejaVuSans.ttf', bold='DejaVuSans-Bold.ttf', serif='DejaVuSerif.ttf', italic='DejaVuSerif-Italic.ttf',
                 mono='DejaVuSansMono.ttf', cond='DejaVuSansCondensed.ttf', condb='DejaVuSansCondensed-Bold.ttf', serifb='DejaVuSerif-Bold.ttf')
    try:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/' + names[kind], size)
    except Exception:
        return ImageFont.load_default()

def setup(scene, ss=2, margin=.05):
    cam = S.fit(scene, W * ss, H * ss, margin)
    return cam, S.build(scene, cam)

def is_ground(it):
    return it['obj'] == -1

def draw_items(d, items, col, outline=None, min_lw=2, lines=True, faces=True):
    for it in items:
        if it['t'] == 'face':
            if not faces: continue
            c = col(it)
            if c is None: continue
            d.polygon(it['pts'], fill=c, outline=outline(it) if outline else None)
        elif lines:
            c = col(it)
            if c is None: continue
            d.line([it['a'], it['b']], fill=c, width=max(int(round(it['w'])), min_lw))

def shadows(scene, cam, size, color=(0, 0, 0, 60), blur=0, dx=.55, dy=-.25, kinds=None, lines=True):
    layer = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for o in scene['objects']:
        if not o.get('shadow', True): continue
        if kinds and o['kind'] not in kinds: continue
        for poly in S.shadow_polys(o, cam, dx, dy, lines):
            if len(poly) >= 3: d.polygon(poly, fill=color)
    if blur: layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return layer

def down(img, ss):
    return img.resize((W, H), Image.LANCZOS) if ss != 1 else img

def to_np(img):
    return np.asarray(img.convert('RGB'), np.float32) / 255.0

def from_np(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def face_col(pal, it, amb=.62, dif=.46):
    if it['t'] == 'line' or it['kind'] == 'sail': return pal[it['mat']]
    return shade(pal[it['mat']], light(it['n'], amb, dif))

def land_poly(scene):
    return scene['ground'][0]['poly']

def in_poly(x, y, P):
    c = False; n = len(P); j = n - 1
    for i in range(n):
        xi, yi = P[i]; xj, yj = P[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def sdf(scene, cam, size, step=8):
    """Abstand zur Kueste in Welt-Einheiten pro Bildpunkt (Wasser positiv, Land negativ)."""
    w, h = size[0] // step + 2, size[1] // step + 2
    SX, SY = np.meshgrid(np.arange(w, dtype=np.float32) * step, np.arange(h, dtype=np.float32) * step)
    a = (SX - cam.ox) / cam.k; b = (SY - cam.oy) / (cam.k * .5)
    X = (a + b) / 2; Y = (b - a) / 2
    D = np.full(X.shape, 1e9, np.float32); C = scene['coast']
    for (ax, ay), (bx, by) in zip(C[:-1], C[1:]):
        vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy
        t = np.clip(((X - ax) * vx + (Y - ay) * vy) / L2, 0, 1)
        D = np.minimum(D, np.hypot(X - ax - t * vx, Y - ay - t * vy))
    P = land_poly(scene); inside = np.zeros(X.shape, bool); j = len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]; xj, yj = P[j]
        if yi != yj:
            cond = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi) + xi)
            inside ^= cond
        j = i
    D = np.where(inside, -D, D)
    im = Image.fromarray(D).resize((w * step, h * step), Image.BICUBIC)
    return np.asarray(im, np.float32)[:size[1], :size[0]]

def ground_text(layer, text, wxy, cam, fnt, color, z=0.0, along='x', anchor='mm'):
    """Schreibt Text so, als laege er auf der Boden-Ebene (Grundlinie entlang der Welt-x- oder y-Achse)."""
    tmp = Image.new('RGBA', (10, 10)); bb = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=fnt)
    tw, th = bb[2] - bb[0] + 8, bb[3] - bb[1] + 8
    tile = Image.new('RGBA', (tw, th), (0, 0, 0, 0)); ImageDraw.Draw(tile).text((4 - bb[0], 4 - bb[1]), text, font=fnt, fill=color)
    c, s_ = 2 / math.sqrt(5), 1 / math.sqrt(5)
    if along == 'x': ex, ey = (c, s_), (-c, s_)
    else: ex, ey = (c, -s_), (c, s_)
    px, py = cam.p(wxy[0], wxy[1], z)
    ox = px - (tw / 2) * ex[0] - (th / 2) * ey[0]; oy = py - (tw / 2) * ex[1] - (th / 2) * ey[1]
    det = ex[0] * ey[1] - ey[0] * ex[1]
    ia, ib, id_, ie = ey[1] / det, -ey[0] / det, -ex[1] / det, ex[0] / det
    ic = -(ia * ox + ib * oy); if_ = -(id_ * ox + ie * oy)
    warped = tile.transform(layer.size, Image.AFFINE, (ia, ib, ic, id_, ie, if_), resample=Image.BICUBIC)
    layer.alpha_composite(warped)


def groups(items):
    """Zeichenliste in Gruppen: Boden je Primitiv, Objekte je Objekt (Reihenfolge bleibt)."""
    out = []; last = None
    for it in items:
        key = (it['obj'], it['pi']) if it['obj'] == -1 else (it['obj'],)
        if key != last: out.append([]); last = key
        out[-1].append(it)
    return out

def group_bbox(g, pad, size):
    xs = []; ys = []
    for it in g:
        pts = it['pts'] if it['t'] == 'face' else [it['a'], it['b']]
        xs += [p[0] for p in pts]; ys += [p[1] for p in pts]
    x0, y0 = max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad)
    x1, y1 = min(size[0], int(max(xs)) + pad + 1), min(size[1], int(max(ys)) + pad + 1)
    return x0, y0, x1, y1

"""Draufsicht: Hafenentwicklung in sechs Ausbaustufen, vom Bootssteg am Binnensee bis zum Seehafen.

Aufruf: python3 hafen_von_oben.py [stufe ...]   Die Bilder landen in out/. Braucht Pillow und numpy.
Eine Planeinheit entspricht 0,62 m, Norden ist oben.
"""
import sys, math, random, pathlib
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import shade, mix, font

SS = 2; W, H = 1600, 1150
X0, Y1 = -300.0, 352.0
S = 2.637 * SS
def P(x, y): return ((x - X0) * S, (Y1 - y) * S)
def PP(pts): return [P(*p) for p in pts]

C = dict(deep=(98, 180, 194), d3=(112, 190, 200), d2=(132, 203, 208), d1=(158, 216, 216), d0=(196, 230, 222), sand=(247, 228, 182), grass=(184, 220, 168),
         pave=(238, 234, 224), road=(226, 222, 214), wood=(226, 182, 126), wood2=(196, 152, 102), pont=(214, 222, 230), pont2=(170, 182, 194),
         rock=(146, 164, 176), rock2=(176, 192, 202), pile=(92, 84, 96), white=(255, 252, 246), navy=(46, 72, 104), red=(238, 100, 84), yellow=(250, 208, 96),
         green=(80, 158, 128), green2=(120, 186, 132), coral=(242, 116, 92), grey=(82, 100, 122), glass=(62, 94, 122), teak=(214, 170, 120), orange=(240, 136, 62),
         ink=(40, 54, 72), cover=(72, 122, 192))

def coast(x): return 5 * math.sin(x / 70) + 3 * math.sin(x / 31 + 1)

# ------------------------------------------------------------------ Boote von oben
HULLS = dict(sail=[(-.5, .34), (-.3, .46), (0, .5), (.25, .4), (.42, .2), (.5, 0)], motor=[(-.5, .45), (0, .5), (.25, .46), (.42, .28), (.5, 0)],
             dinghy=[(-.5, .42), (-.1, .5), (.25, .4), (.5, 0)], row=[(-.5, .3), (-.2, .48), (.15, .45), (.4, .25), (.5, 0)],
             cutter=[(-.5, .4), (-.35, .5), (.2, .5), (.4, .3), (.5, 0)], tall=[(-.5, .3), (-.42, .46), (-.1, .5), (.25, .42), (.42, .2), (.5, 0)],
             super=[(-.5, .42), (-.2, .5), (.15, .46), (.38, .26), (.5, 0)], pax=[(-.5, .46), (.3, .5), (.44, .3), (.5, 0)], slim=[(-.5, .3), (-.1, .5), (.3, .36), (.5, 0)])

def poly_uv(shape, L, B, su=1.0, sv=1.0, du=0.0):
    up = [(u * L * su + du, v * B * sv) for u, v in shape]
    return up + [(u, -v) for u, v in reversed(up[:-1])] if shape[-1][1] == 0 else up + [(u, -v) for u, v in reversed(up)]

def boat(d, cx, cy, ang, kind, L, B, col, rnd):
    ca, sa = math.cos(ang), math.sin(ang)
    T = lambda u, v: P(cx + u * ca - v * sa, cy + u * sa + v * ca)
    def pg(uv, fill): d.polygon([T(u, v) for u, v in uv], fill=fill)
    def rect(u0, u1, v, fill): pg([(u0, -v), (u1, -v), (u1, v), (u0, v)], fill)
    def ln(a, b, fill, w): d.line([T(*a), T(*b)], fill=fill, width=max(1, int(w * S)))
    def dot(u, v, r, fill):
        x, y = T(u, v); rr = r * S; d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=fill)
    hull = C[col]; deck = (252, 248, 240) if col != 'white' else (236, 232, 222)
    if kind in ('sail', 'klassik'):
        pg(poly_uv(HULLS['sail' if kind == 'sail' else 'slim'], L, B), hull); pg(poly_uv(HULLS['sail' if kind == 'sail' else 'slim'], L, B, .84, .74), deck if kind == 'sail' else C['teak'])
        rect(-L * .18, L * .14, B * .2, (255, 255, 255) if kind == 'sail' else C['wood2']); rect(-L * .42, -L * .22, B * .24, C['teak'])
        ln((L * .1, 0), (-L * .3, 0), C['cover'], .45); dot(L * .1, 0, .32, C['ink'])
    elif kind == 'ketsch':
        pg(poly_uv(HULLS['sail'], L, B), hull); pg(poly_uv(HULLS['sail'], L, B, .84, .74), deck)
        rect(-L * .2, L * .12, B * .22, (255, 255, 255)); ln((L * .14, 0), (-L * .12, 0), C['cover'], .45); ln((-L * .3, 0), (-L * .46, 0), C['cover'], .4)
        dot(L * .14, 0, .32, C['ink']); dot(-L * .3, 0, .28, C['ink'])
    elif kind == 'motor':
        pg(poly_uv(HULLS['motor'], L, B), hull); pg(poly_uv(HULLS['motor'], L, B, .86, .78), deck)
        rect(-L * .2, L * .16, B * .3, (255, 255, 255)); rect(L * .1, L * .22, B * .27, C['glass']); rect(-L * .46, -L * .28, B * .3, C['teak'])
    elif kind == 'flybridge':
        pg(poly_uv(HULLS['motor'], L, B), hull); pg(poly_uv(HULLS['motor'], L, B, .88, .8), deck)
        rect(-L * .28, L * .2, B * .34, (255, 255, 255)); rect(L * .14, L * .27, B * .3, C['glass']); rect(-L * .2, L * .06, B * .26, (226, 230, 234)); rect(-L * .47, -L * .33, B * .32, C['teak'])
    elif kind == 'trawler':
        pg(poly_uv(HULLS['cutter'], L, B), hull); pg(poly_uv(HULLS['cutter'], L, B, .86, .78), C['teak'])
        rect(-L * .1, L * .2, B * .3, (255, 255, 255)); rect(L * .12, L * .2, B * .27, C['glass']); dot(-L * .22, 0, .5, C['coral'])
    elif kind == 'dinghy':
        pg(poly_uv(HULLS['dinghy'], L, B), hull); pg(poly_uv(HULLS['dinghy'], L, B, .8, .7), (236, 226, 204)); ln((L * .12, 0), (-L * .34, 0), C['cover'], .3); dot(L * .12, 0, .22, C['ink'])
    elif kind == 'row':
        pg(poly_uv(HULLS['row'], L, B), hull); pg(poly_uv(HULLS['row'], L, B, .82, .68), (236, 214, 170)); ln((-L * .15, -B * .3), (-L * .15, B * .3), C['wood2'], .25); ln((L * .1, -B * .3), (L * .1, B * .3), C['wood2'], .25)
    elif kind == 'rib':
        pg(poly_uv(HULLS['motor'], L, B), (120, 132, 148)); pg(poly_uv(HULLS['motor'], L, B, .72, .56, -L * .05), (226, 230, 234)); rect(-L * .08, L * .06, B * .14, hull); dot(-L * .46, 0, .3, C['ink'])
    elif kind == 'angel':
        pg(poly_uv(HULLS['motor'], L, B), hull); pg(poly_uv(HULLS['motor'], L, B, .84, .74), (236, 232, 222)); rect(-L * .04, L * .1, B * .2, (255, 255, 255)); dot(-L * .47, 0, .3, C['ink'])
    elif kind == 'cat':
        for sgn in (-1, 1):
            d.polygon([T(u, v + sgn * B * .37) for u, v in poly_uv(HULLS['slim'], L, B * .26)], fill=hull)
        rect(-L * .36, L * .16, B * .4, deck); rect(-L * .16, L * .1, B * .3, (255, 255, 255)); rect(L * .02, L * .1, B * .27, C['glass'])
        rect(L * .16, L * .4, B * .26, (226, 232, 236)); ln((L * .12, 0), (-L * .3, 0), C['cover'], .45); dot(L * .12, 0, .32, C['ink'])
    elif kind == 'cutter':
        pg(poly_uv(HULLS['cutter'], L, B), hull); pg(poly_uv(HULLS['cutter'], L, B, .86, .78), C['teak'])
        rect(-L * .38, -L * .12, B * .28, (255, 255, 255)); rect(-L * .16, -L * .12, B * .26, C['glass']); rect(L * .02, L * .22, B * .2, C['green']); dot(L * .3, 0, .3, C['ink'])
    elif kind == 'rescue':
        pg(poly_uv(HULLS['motor'], L, B), (255, 252, 246)); pg(poly_uv(HULLS['motor'], L, B, .86, .78), (230, 234, 238)); rect(-L * .24, L * .16, B * .32, C['orange']); rect(L * .08, L * .2, B * .28, C['glass'])
    elif kind == 'tall':
        pg(poly_uv(HULLS['tall'], L, B), (58, 62, 74)); pg(poly_uv(HULLS['tall'], L, B, .9, .8), C['teak'])
        rect(-L * .4, -L * .28, B * .24, (255, 255, 255)); rect(-L * .02, L * .05, B * .18, (255, 255, 255)); ln((L * .46, 0), (L * .66, 0), C['wood2'], .5)
        for u in (-L * .2, L * .05, L * .28):
            ln((u, -B * .95), (u, B * .95), C['wood2'], .45); ln((u - 1.6, -B * .7), (u - 1.6, B * .7), (250, 246, 236), .7); dot(u, 0, .5, C['ink'])
    elif kind == 'super':
        pg(poly_uv(HULLS['super'], L, B), hull); pg(poly_uv(HULLS['super'], L, B, .9, .8), C['teak'])
        pg(poly_uv(HULLS['super'], L, B, .62, .66, -L * .04), (255, 255, 255)); pg(poly_uv(HULLS['super'], L, B, .44, .54, -L * .02), C['glass']); pg(poly_uv(HULLS['super'], L, B, .36, .44, -L * .04), (244, 246, 248))
        dot(-L * .1, 0, .7, (226, 230, 234))
    elif kind == 'pax':
        pg(poly_uv(HULLS['pax'], L, B), hull); pg(poly_uv(HULLS['pax'], L, B, .92, .82), (236, 240, 244)); rect(-L * .4, L * .12, B * .34, (255, 255, 255))
        for i in range(7): ln((-L * .36 + i * L * .07, -B * .28), (-L * .36 + i * L * .07, B * .28), C['cover'], .35)
        rect(L * .16, L * .3, B * .3, C['glass'])
    elif kind == 'cruise':   # Kreuzfahrtschiff
        pg(poly_uv(HULLS['pax'], L, B), (250, 250, 250)); pg(poly_uv(HULLS['pax'], L, B, .92, .84), (228, 234, 240))
        rect(-L * .44, L * .32, B * .38, (255, 255, 255)); rect(-L * .38, L * .26, B * .3, (236, 240, 244))
        for i in range(12): ln((-L * .4 + i * L * .055, -B * .37), (-L * .4 + i * L * .055, B * .37), (198, 212, 224), .35)
        rect(-L * .06, L * .06, B * .14, (96, 196, 222)); rect(-L * .3, -L * .2, B * .12, C['coral']); rect(L * .2, L * .28, B * .26, C['glass'])
    elif kind == 'navy':     # Marineschiff (Korvette)
        pg(poly_uv(HULLS['slim'], L, B), (126, 136, 148)); pg(poly_uv(HULLS['slim'], L, B, .9, .8), (150, 160, 170))
        rect(-L * .14, L * .16, B * .3, (176, 184, 192)); rect(L * .06, L * .14, B * .24, C['glass']); dot(L * .3, 0, B * .09, (96, 104, 114))
        rect(-L * .46, -L * .26, B * .36, (112, 120, 130)); dot(-L * .36, 0, B * .2, (150, 160, 170))
    elif kind == 'srk':      # Seenotrettungskreuzer
        pg(poly_uv(HULLS['cutter'], L, B), (255, 252, 246)); pg(poly_uv(HULLS['cutter'], L, B, .88, .8), (230, 234, 238))
        rect(-L * .2, L * .2, B * .34, C['orange']); rect(L * .1, L * .2, B * .3, C['glass']); rect(-L * .48, -L * .3, B * .3, (210, 214, 220))
    elif kind == 'zees':
        pg(poly_uv(HULLS['cutter'], L, B), (58, 62, 74)); pg(poly_uv(HULLS['cutter'], L, B, .86, .78), C['teak']); ln((L * .18, 0), (-L * .2, 0), (150, 84, 60), .6); dot(L * .18, 0, .32, C['ink']); dot(-L * .3, 0, .28, C['ink'])

# ------------------------------------------------------------------ Stege und Liegeplaetze
def frame(p0, p1):
    L = math.dist(p0, p1); t = ((p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L); return L, t, (-t[1], t[0])

K = 1.6   # eine Planeinheit entspricht 0,62 m
SIZE = dict(S=(5.5 * K, 2.1 * K, 3.0 * K), M=(8.5 * K, 2.9 * K, 3.9 * K), L=(12.5 * K, 3.9 * K, 5.0 * K))   # Laenge, Breite, Boxbreite
MIX = dict(S=[('dinghy', 4), ('row', 2), ('rib', 2), ('angel', 3)], M=[('sail', 5), ('klassik', 2), ('motor', 3), ('zees', 1)],
           L=[('sail', 6), ('motor', 2), ('flybridge', 2), ('ketsch', 1), ('trawler', 1)])
COLS = ['white'] * 8 + ['navy'] * 2 + ['red', 'yellow', 'green']

class Harbor:
    def __init__(self, d, rnd, occ=.74):
        self.d, self.rnd, self.occ = d, rnd, occ; self.count = dict(S=0, M=0, L=0, XL=0, XXL=0, T=0); self.piles = []; self.boats = []; self.lines = []
    def line(self, pts, kind, wm):
        self.lines.append((pts, kind, wm * K))
    def boxes(self, p0, p1, side, cls, a0=5.0, a1=3.0, jw=2.4, fingers=False):
        jw = jw * K; L, t, n = frame(p0, p1); bl, bb, bw = SIZE[cls]; k = int((L - a0 - a1) / bw)
        if k <= 0: return
        off = a0 + ((L - a0 - a1) - k * bw) / 2
        for i in range(k + 1):
            a = off + i * bw; base = (p0[0] + t[0] * a, p0[1] + t[1] * a)
            if fingers:
                if i % 2 == 0:
                    e = (base[0] + side * n[0] * (jw / 2 + bl * .72), base[1] + side * n[1] * (jw / 2 + bl * .72))
                    self.lines.append(([base, e], 'finger', 1.0 * K))
            else:
                self.piles.append((base[0] + side * n[0] * (jw / 2 + bl + 1.2), base[1] + side * n[1] * (jw / 2 + bl + 1.2)))
        for i in range(k):
            a = off + (i + .5) * bw; self.count[cls] += 1
            if self.rnd.random() > self.occ: continue
            kinds = MIX[cls]; kind = self.rnd.choices([k_[0] for k_ in kinds], weights=[k_[1] for k_ in kinds])[0]
            Lb = bl * self.rnd.uniform(.82, 1.0); Bb = bb * self.rnd.uniform(.86, 1.0)
            if kind in ('dinghy', 'row'): Lb *= .8; Bb *= .82
            c = (p0[0] + t[0] * a + side * n[0] * (jw / 2 + .9 + Lb / 2), p0[1] + t[1] * a + side * n[1] * (jw / 2 + .9 + Lb / 2))
            ang = math.atan2(-side * n[1], -side * n[0])
            if self.rnd.random() < .25: ang += math.pi
            col = self.rnd.choice(COLS) if kind not in ('zees',) else 'navy'
            if kind == 'row': col = self.rnd.choice(['yellow', 'white', 'green', 'red'])
            self.boats.append((c[0], c[1], ang, kind, Lb, Bb, col))
    def along(self, p0, p1, side, items, jw=2.4, cls='L', gap=4.0, start=2.0, scale_jw=True):
        L, t, n = frame(p0, p1); a = start; jw = jw * K if scale_jw else jw
        for (kind, Lb, Bb, col, present) in items:
            Lb, Bb = Lb * K, Bb * K; self.count[cls] += 1
            if present:
                c = (p0[0] + t[0] * (a + Lb / 2) + side * n[0] * (jw / 2 + .8 + Bb / 2), p0[1] + t[1] * (a + Lb / 2) + side * n[1] * (jw / 2 + .8 + Bb / 2))
                self.boats.append((c[0], c[1], math.atan2(t[1], t[0]), kind, Lb, Bb, col))
            a += Lb + gap
    def render(self):
        d = self.d
        for pts, kind, wm in self.lines:
            col = C['wood'] if kind == 'wood' else C['pave'] if kind == 'pier' else C['pont']
            w = max(2, int(wm * S)); sp = PP(pts)
            if kind in ('float', 'finger'):
                d.line(sp, fill=C['pont2'], width=w + 2 * SS, joint='curve')
            elif kind == 'pier':
                d.line(sp, fill=C['rock'], width=w + 2 * SS, joint='curve')
            else:
                d.line(sp, fill=C['wood2'], width=w + 2 * SS, joint='curve')
            d.line(sp, fill=col, width=w, joint='curve')
        for (x, y) in self.piles:
            px, py = P(x, y); r = .5 * K * S; d.ellipse([px - r, py - r, px + r, py + r], fill=C['pile'])
        for b in self.boats:
            boat(d, *b, self.rnd)

# ------------------------------------------------------------------ Land
def building(d, sh, cx, cy, w, h, roof='coral', ang=0.0, hgt=4.0):
    ca, sa = math.cos(ang), math.sin(ang)
    R = lambda u, v: (cx + u * ca - v * sa, cy + u * sa + v * ca)
    pts = [R(-w / 2, -h / 2), R(w / 2, -h / 2), R(w / 2, h / 2), R(-w / 2, h / 2)]
    sh.polygon(PP([(x + hgt * .9, y - hgt * .9) for x, y in pts] + pts[::-1][:0]), fill=255)
    sh.polygon(PP([pts[1], pts[2], (pts[2][0] + hgt * .9, pts[2][1] - hgt * .9), (pts[1][0] + hgt * .9, pts[1][1] - hgt * .9)]), fill=255)
    sh.polygon(PP([pts[0], pts[1], (pts[1][0] + hgt * .9, pts[1][1] - hgt * .9), (pts[0][0] + hgt * .9, pts[0][1] - hgt * .9)]), fill=255)
    return ('b', pts, roof, w >= h, R, w, h)

def draw_building(d, b):
    _, pts, roof, wide, R, w, h = b
    col = C[roof] if roof in C else roof
    d.polygon(PP(pts), fill=col)
    if wide: d.polygon(PP([R(-w / 2, 0), R(w / 2, 0), R(w / 2, h / 2), R(-w / 2, h / 2)]), fill=shade(col, 1.1))
    else: d.polygon(PP([R(-w / 2, -h / 2), R(0, -h / 2), R(0, h / 2), R(-w / 2, h / 2)]), fill=shade(col, 1.1))

def tree(d, sh, x, y, r, rnd):
    q = P(x + r * .5, y - r * .5); rr = r * S; sh.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=255)
    return ('t', x, y, r, rnd.random() < .3)

def draw_tree(d, t):
    _, x, y, r, light = t; q = P(x, y); rr = r * S; col = C['green2'] if light else C['green']
    d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=col)
    q2 = P(x - r * .25, y + r * .25); r2 = rr * .55; d.ellipse([q2[0] - r2, q2[1] - r2, q2[0] + r2, q2[1] + r2], fill=shade(col, 1.12))

def label(d, text, x, y, new=False, anchor='mm', size=13):
    f = font(int(size * SS), 'bold' if new else 'sans'); q = P(x, y)
    bb = d.textbbox(q, text, font=f, anchor=anchor); pad = 5 * SS
    box = [bb[0] - pad, bb[1] - pad * .7, bb[2] + pad, bb[3] + pad * .7]
    d.rounded_rectangle(box, radius=6 * SS, fill=C['navy'] + (255,) if new else (255, 255, 255, 215))
    d.text(q, text, font=f, fill=(255, 255, 255, 255) if new else C['ink'] + (255,), anchor=anchor)

def beacon(d, x, y, col):
    q = P(x, y)
    for r, a in ((6.5, 60), (4.2, 110)):
        rr = r * S; d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=col + (a,))
    rr = 2.3 * S; d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=(255, 255, 255, 255)); rr = 1.6 * S; d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=col + (255,))

def buoy(d, x, y, col, kind='can'):
    q = P(x, y); r = 1.9 * S
    if kind == 'can': d.rectangle([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=col + (255,), outline=(255, 255, 255, 255), width=SS)
    elif kind == 'cone': d.polygon([(q[0], q[1] - r * 1.25), (q[0] + r * 1.1, q[1] + r), (q[0] - r * 1.1, q[1] + r)], fill=col + (255,), outline=(255, 255, 255, 255))
    else:
        r = 2.6 * S; d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=(255, 255, 255, 255)); d.pieslice([q[0] - r, q[1] - r, q[0] + r, q[1] + r], 90, 270, fill=(226, 70, 62, 255))
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], outline=(255, 255, 255, 255), width=SS)

def dashed(d, pts, col, w, dash=9.0, gap=7.0, arrow=True):
    # Polylinie in Welt-Koordinaten gestrichelt zeichnen
    segs = []; acc = 0.0; on = True; cur = [pts[0]]
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]; L = math.dist(a, b); pos = 0.0
        while pos < L:
            lim = dash if on else gap; step = min(lim - acc, L - pos); pos += step; acc += step
            q = (a[0] + (b[0] - a[0]) * pos / L, a[1] + (b[1] - a[1]) * pos / L)
            if on: cur.append(q)
            if acc >= lim - 1e-9:
                if on: segs.append(cur)
                on = not on; acc = 0.0; cur = [q]
    if on and len(cur) > 1: segs.append(cur)
    for s_ in segs: d.line(PP(s_), fill=col, width=int(w * S), joint='curve')
    if arrow:
        a, b = pts[-2], pts[-1]; L, t, n = frame(a, b); k = 7.5
        d.polygon(PP([(b[0] + t[0] * k * .9, b[1] + t[1] * k * .9), (b[0] - t[0] * 2 + n[0] * k * .55, b[1] - t[1] * 2 + n[1] * k * .55), (b[0] - t[0] * 2 - n[0] * k * .55, b[1] - t[1] * 2 - n[1] * k * .55)]), fill=col)

def curve(pts, n=14):
    # Catmull-Rom durch die Punkte
    out = []; P_ = [pts[0]] + list(pts) + [pts[-1]]
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1]); return out

# ------------------------------------------------------------------ Gelaende: Binnensee, Nehrung, Ostsee
def south(x): return coast(x) + .02 * max(0.0, -235 - x) ** 2          # Suedufer des Sees (Festland)
def lake_n(x): return 186 + 4 * math.sin(x / 55 + 2) + 2.5 * math.sin(x / 23)   # Nordufer des Sees (Nehrung innen)
def sea_s(x): return 224 + 4 * math.sin(x / 80 + 1) + 2 * math.sin(x / 27)      # Strand der Nehrung zur Ostsee

LAKE = dict(d0=(204, 232, 212), d1=(174, 218, 200), d2=(148, 204, 190), d3=(126, 190, 182), deep=(108, 178, 176))
CH = (152, 182)                                             # Durchstich: x von bis
MOLE_W34 = [(150, 222), (149, 268)]; MOLE_E34 = [(184, 222), (187, 258)]
MOLE_W5 = [(-2, 224), (-10, 282), (18, 312), (96, 320)]; MOLE_E5 = [(184, 222), (194, 278), (170, 304)]

TITLES = {1: ('Stufe 1: Bootssteg am See', 'Ein kurzer Holzsteg am Binnensee. Ruderboote, Beiboote und Jollen. Zur Ostsee führt nur ein flacher Graben.'),
          2: ('Stufe 2: Dorfhafen am See', 'Steg A wird länger und knickt ab, Steg B bekommt einen T-Kopf. Slip, Fischersteg, Hafenmeister. Der See ist flach, also nur Boote mit wenig Tiefgang.'),
          3: ('Stufe 3: Durchstich zur Ostsee', 'Der Graben wird zum Kanal mit zwei Molen und Molenfeuern. Jetzt kommen Yachten von See durch den Durchstich. Hauptsteg C, Promenade, ausgebaggertes Becken.'),
          4: ('Stufe 4: Marina', 'Hauptsteg C wird länger und bekommt einen Stichsteg, dazu Schwimmsteg D mit Fingerstegen. Tankstelle am Durchstich, Seenotretter, Travellift und Winterlager.'),
          5: ('Stufe 5: Küstenmarina', 'Vor der Nehrung entsteht der Außenhafen: zwei lange Molen, Kai für große Schiffe, Fahrgastanleger und Fischereikai. Schwimmsteg D gabelt sich.'),
          6: ('Stufe 6: Seehafen', 'Westlich der Molen entsteht im tiefen Wasser eine lange T-Pier: außen legen Kreuzfahrtschiffe an, innen besuchen Marineschiffe den Hafen. An der Westmole liegt der Seenotrettungskreuzer.')}

# Stufe 6: Grossschiffspier westlich der Westmole (T-Form), Steg vom Strand bei x = -140. Der Kopf liegt so
# weit draussen (y 330), dass das Kreuzfahrtschiff noerdlich der Westmole frei nach Osten ablegen kann.
PIER_X, PIER_Y, PIER_W, PIER_E = -140, 330, -270, -10
# Eigene Marinepier ganz im Westen (Nord-Sued), Schiffe an beiden Seiten, Ausfahrt gerade nach Norden
MARINE_X, MARINE_Y = -330, 380

def render(stage, seed=5):
    global X0, W
    # Stufe 6 reicht weiter nach Westen. Die Verschiebung ist ein ganzes Vielfaches des Tiefenrasters
    # (119 Zellen), damit die Tiefen dort, wo sich die Bilder ueberdecken, genau wie in Stufe 5 bleiben.
    off = 119 if stage >= 6 else 0
    X0, W = -300.0 - off * 4 / S, 1600 + off * 4 // SS
    size = (W * SS, H * SS); rnd = random.Random(seed)
    shore = lambda x: (6.0 if (stage >= 3 and -150 <= x <= 202) else min(south(x), lake_n(x)))
    xs = [X0 - 12 + i * 4 for i in range(int((W / (S / SS)) / 4) + 8)]
    # ---------------- Wassertiefe (Raster)
    st = 4; gw, gh = size[0] // st + 2, size[1] // st + 2
    GX, GY = np.meshgrid(X0 + (np.arange(gw) * st) / S, Y1 - (np.arange(gh) * st) / S)
    so = 5 * np.sin(GX / 70) + 3 * np.sin(GX / 31 + 1) + .02 * np.maximum(0, -235 - GX) ** 2
    ln_ = 186 + 4 * np.sin(GX / 55 + 2) + 2.5 * np.sin(GX / 23); sn_ = 224 + 4 * np.sin(GX / 80 + 1) + 2 * np.sin(GX / 27)
    gw0 = (1600 * SS) // st + 2   # Rauschen immer auf dem Raster der Stufen 1 bis 5, links am Rand fortgesetzt
    wob = np.asarray(Image.fromarray((np.random.RandomState(12).rand(8, 10) * 255).astype(np.uint8)).resize((gw0, gh), Image.BICUBIC), np.float32) / 255.0 - .5
    wob = wob[:, np.clip(np.arange(gw) - off, 0, gw0 - 1)]
    is_lake = (GY > so) & (GY < ln_); is_sea = GY >= sn_
    dl = 2.5 * (1 - np.exp(-np.maximum(0, np.minimum(GY - so, ln_ - GY)) / 26.0)) + .5 * wob
    ds = 5.0 * (1 - np.exp(-np.maximum(0, GY - sn_) / 42.0)) + .6 * wob
    dep = np.where(is_sea, ds, dl); dep = np.maximum(dep, .2)
    def mask(poly):
        m = Image.new('L', (gw, gh), 0); ImageDraw.Draw(m).polygon([((x - X0) * S / st, (Y1 - y) * S / st) for x, y in poly], fill=255)
        return np.asarray(m.filter(ImageFilter.GaussianBlur(3.2)), np.float32) / 255.0
    canal = [(CH[0], 176), (CH[1], 176), (CH[1], 234), (CH[0], 234)]
    if stage >= 3:
        basin = [(-22, 6), (202, 6), (204, 96), (186, 176), (148, 176), (118, 150), (20, 152), (-22, 120)] if stage >= 4 else [(-12, 6), (150, 6), (190, 120), (186, 176), (148, 176), (112, 128), (40, 112), (-12, 96)]
        dep = np.where(mask(basin) > .5, np.maximum(dep, 3.5 + .4 * wob), dep)
        if stage >= 4: dep = np.where(mask([(-84, 6), (-22, 6), (-22, 124), (-84, 112)]) > .5, np.maximum(dep, 2.6), dep)
        dep = np.where(mask(canal) > .5, 3.8, dep)
        if stage < 5:
            dep = np.where(mask([(152, 236), (182, 236), (212, 356), (176, 356)]) > .5, np.maximum(dep, 4.4), dep)
        else:
            dep = np.where(mask([(0, 226), (186, 226), (194, 278), (170, 304), (96, 320), (18, 312), (-8, 282)]) > .5, 5.0, dep)
            dep = np.where(mask([(108, 300), (160, 300), (184, 356), (132, 356)]) > .5, np.maximum(dep, 4.6), dep)
        if stage >= 6:   # Liegewanne an der Grossschiffspier
            dep = np.where(mask([(PIER_W - 40, 228), (PIER_E + 50, 228), (PIER_E + 60, 370), (PIER_W - 40, 370)]) > .5, np.maximum(dep, 8.5), dep)
    else:
        dep = np.where(mask([(163, 180), (171, 180), (173, 232), (165, 232)]) > .5, .5, dep)
    up = lambda arr: np.asarray(Image.fromarray(arr.astype(np.float32)).resize((gw * st, gh * st), Image.BICUBIC), np.float32)[:size[1], :size[0]]
    depI = up(dep); lakeI = up((GY < (ln_ + sn_) / 2).astype(np.float32)) > .5
    a = np.empty((size[1], size[0], 3), np.uint8); a[:] = C['deep']; a[lakeI] = LAKE['deep']
    for lim, key in ((4.0, 'd3'), (3.0, 'd2'), (2.0, 'd1'), (1.0, 'd0')):
        m = depI < lim; a[m & ~lakeI] = C[key]; a[m & lakeI] = LAKE[key]
    img = Image.fromarray(a).convert('RGBA'); d = ImageDraw.Draw(img, 'RGBA')
    # ---------------- Land: Festland und Nehrung
    d.polygon(PP([(x, shore(x)) for x in xs] + [(xs[-1], -200), (xs[0], -200)]), fill=C['sand'])
    d.polygon(PP([(x, min(south(x), lake_n(x)) - 13 - 4 * math.sin(x / 23)) for x in xs] + [(xs[-1], -200), (xs[0], -200)]), fill=C['grass'])
    d.polygon(PP([(min(-320, X0 - 12), -84), (330, -84), (330, -93), (min(-320, X0 - 12), -93)]), fill=C['road'])
    spit = [(x, lake_n(x)) for x in xs] + [(x, sea_s(x)) for x in reversed(xs)]
    d.polygon(PP(spit), fill=C['sand'])
    d.polygon(PP([(x, lake_n(x) + 1) for x in xs] + [(x, lake_n(x) + 17 + 4 * math.sin(x / 17)) for x in reversed(xs)]), fill=(206, 222, 170))
    dr = random.Random(21)
    for _ in range(170):   # Duenengras
        x = dr.uniform(X0, X0 + (620 if stage < 6 else 696)); y = lake_n(x) + dr.uniform(16, sea_s(x) - lake_n(x) - 9)
        q = P(x, y); r = dr.uniform(1.2, 2.4) * S; d.ellipse([q[0] - r, q[1] - r * .7, q[0] + r, q[1] + r * .7], fill=(196, 208, 150, 255))
    if stage >= 3:
        d.polygon(PP([(-150, -13), (202, -13), (202, 6), (-150, 6)]), fill=C['pave'])
    # Durchstich oder Graben
    if stage >= 3:
        d.polygon(PP([(CH[0], lake_n(CH[0]) - 3), (CH[1], lake_n(CH[1]) - 3), (CH[1], 236), (CH[0], 236)]), fill=C['d3'])
        d.polygon(PP([(CH[0], lake_n(CH[0]) - 3), (CH[1], lake_n(CH[1]) - 3), (CH[1], 205), (CH[0], 205)]), fill=LAKE['d3'])
        for xx in CH: d.line(PP([(xx, lake_n(xx) - 4), (xx, 224)]), fill=C['rock'], width=int(3.2 * S))
    else:
        d.line(PP(curve([(166, 180), (169, 196), (164, 212), (169, 232)])), fill=C['d0'], width=int(6 * S), joint='curve')
    # Schilf am See
    rr_ = random.Random(31)
    for _ in range(520):
        x = rr_.uniform(X0, X0 + 620); north = rr_.random() < .5
        if south(x) > lake_n(x) - 8: continue
        if not north and stage >= 3 and -156 < x < 208: continue
        if stage >= 3 and north and CH[0] - 6 < x < CH[1] + 6: continue
        if stage < 3 and north and 158 < x < 176: continue
        if not north and -150 < x < -20 and stage >= 2: continue
        if not north and -122 < x < -84 and stage == 1: continue
        y = (lake_n(x) - rr_.uniform(0, 7)) if north else (south(x) + rr_.uniform(0, 7))
        q = P(x, y); r = rr_.uniform(1.0, 2.0) * S
        d.ellipse([q[0] - r, q[1] - r * .8, q[0] + r, q[1] + r * .8], fill=rr_.choice([(150, 190, 112, 255), (176, 204, 124, 255), (132, 176, 110, 255)]))
    H_ = Harbor(d, rnd)
    def mole(pts, w=8.0):
        d.line(PP(pts), fill=C['rock'], width=int(w * S), joint='curve')
        for p in (pts[0], pts[-1]):
            q = P(*p); r = w * S / 2; d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=C['rock'])
        d.line(PP(pts), fill=C['rock2'], width=int((w - 3.8) * S), joint='curve')
        q = P(*pts[-1]); r = (w - 3.8) * S / 2; d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=C['rock2'])
    if stage in (3, 4): mole(MOLE_W34, 7.0); mole(MOLE_E34, 7.0)
    if stage >= 5:
        mole(MOLE_W5, 9.0); mole(MOLE_E5, 9.0)
        d.polygon(PP([(2, 216), (150, 216), (150, 229), (2, 229)]), fill=C['pave'])
        for xx in range(10, 150, 14):
            q = P(xx, 226.6); r = .9 * S; d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=C['pile'])
    # ---------------- Stege am Suedufer des Sees
    top = 0
    if stage == 1:
        A = [(-105, south(-105) - 4), (-108, 36)]; H_.line(A + [(-97, 38)], 'wood', 2.2)
        H_.boxes(A[0], A[1], -1, 'S', a0=14, a1=1, jw=2.2)
    if stage >= 2:
        r0 = (-105, shore(-105) - 4)
        A = [r0, (-110, 40), (-113, 58)] if stage == 2 else [r0, (-110, 40), (-117, 74)]
        H_.line(A + [(A[2][0] + 17, A[2][1] + 4)], 'wood', 2.4)
        H_.boxes(A[0], A[1], -1, 'S', a0=13, a1=1); H_.boxes(A[1], A[2], 1, 'S', a0=2, a1=2); H_.boxes(A[1], A[2], -1, 'S', a0=2, a1=2)
        top = {2: 62, 3: 84, 4: 84, 5: 100, 6: 100}[stage]
        B = [(-55, shore(-55) - 4), (-55, top)]; H_.line(B, 'wood', 2.4); H_.line([(-74, top), (-36, top)], 'wood', 2.4)
        H_.boxes(B[0], B[1], 1, 'M', a0=12, a1=4); H_.boxes(B[0], B[1], -1, 'M', a0=12, a1=4)
        H_.along((-74, top), (-36, top), 1, [('klassik', 10, 2.6, 'navy', True), ('motor', 9, 3.2, 'white', stage > 2)], cls='M', start=1)
        fs = [(-137, shore(-137) - 3), (-139, 34)]; H_.line(fs, 'wood', 2.2)
        H_.along(fs[0], fs[1], -1, [('cutter', 7.5, 2.9, 'navy', True)], jw=2.2, cls='M', start=17)
    if stage == 3:
        Cs = [(13, 2), (13, 72)]; H_.line(Cs, 'wood', 2.8); H_.line([(-11, 74), (37, 70)], 'wood', 2.8)
        H_.boxes(Cs[0], Cs[1], 1, 'L', a0=12, a1=4, jw=2.8); H_.boxes(Cs[0], Cs[1], -1, 'L', a0=12, a1=4, jw=2.8)
        H_.along((-11, 74), (37, 70), 1, [('cat', 12.5, 6.6, 'white', True), ('ketsch', 14, 4.2, 'navy', False)], jw=2.8, start=1)
    if stage >= 4:
        Cs = [(13, 2), (13, 70), (4, 124)]; H_.line(Cs, 'wood', 2.8); H_.line([(-21, 128), (28, 121)], 'wood', 2.8); br = [(13, 76), (58, 84)]; H_.line(br, 'wood', 2.4)
        H_.boxes(Cs[0], Cs[1], 1, 'L', a0=12, a1=2, jw=2.8); H_.boxes(Cs[0], Cs[1], -1, 'L', a0=12, a1=10, jw=2.8)
        H_.boxes(Cs[1], Cs[2], 1, 'L', a0=4, a1=4, jw=2.8); H_.boxes(Cs[1], Cs[2], -1, 'L', a0=24, a1=4, jw=2.8)
        H_.boxes(br[0], br[1], 1, 'M', a0=26, a1=1); H_.boxes(br[0], br[1], -1, 'M', a0=26, a1=1)
        H_.along((-21, 128), (28, 121), 1, [('cat', 12.5, 6.6, 'white', True), ('ketsch', 14, 4.2, 'navy', True)], jw=2.8, start=1)
        D = [(110, 2), (116, 60)]; H_.line(D, 'float', 3.0)
        H_.boxes(D[0], D[1], 1, 'L', a0=12, a1=5, jw=3.0, fingers=True); H_.boxes(D[0], D[1], -1, 'L', a0=12, a1=5, jw=3.0, fingers=True)
        if stage == 4:
            H_.line([(103, 62), (129, 58)], 'float', 3.0); H_.along((103, 62), (129, 58), 1, [('flybridge', 13, 4.4, 'white', True)], jw=3.0, start=2)
        H_.line([(112, 178), (142, 178)], 'float', 3.2); H_.along((112, 178), (142, 178), -1, [('motor', 9, 3.2, 'white', True)], jw=3.2, cls='T', start=6)
        H_.line([(183.5, 232), (185.5, 254)], 'float', 2.0); H_.along((183.5, 232), (185.5, 254), 1, [('rescue', 11, 3.8, 'white', True)], jw=2.0, cls='T', start=2)
        H_.line([(149, 6), (149, 24)], 'float', 1.2); H_.line([(163, 6), (163, 24)], 'float', 1.2)
        H_.boats.append((156, 15, math.pi / 2, 'sail', 10.5 * K, 3.4 * K, 'white'))
    if stage >= 5:
        f1 = [(116, 60), (102, 112)]; f2 = [(116, 60), (145, 104)]; H_.line(f1, 'float', 2.8); H_.line(f2, 'float', 2.8)
        H_.boxes(f1[0], f1[1], 1, 'L', a0=7, a1=2, jw=2.8, fingers=True); H_.boxes(f2[0], f2[1], 1, 'L', a0=31, a1=1, jw=2.8, fingers=True)
        H_.along((131, 83), (145, 104), -1, [('cat', 11.5, 6.2, 'white', True)], jw=4.4, start=2)
        H_.along((2, 229), (150, 229), 1, [('pax', 22, 5.8, 'white', True), ('tall', 36, 7.6, 'navy', True), ('super', 26, 6.2, 'white', True)], jw=0, cls='XL', start=2, gap=4)
        H_.along((-3, 232), (-9, 280), -1, [('cutter', 11, 3.9, 'navy', True), ('trawler', 10, 3.7, 'red', True)], jw=9, cls='L', start=3, gap=3, scale_jw=False)
    if stage >= 6:
        # Kreuzfahrtpier: Steg vom Strand, Kopf parallel zur Kueste, das Schiff liegt aussen (Bug nach Westen,
        # ragt an beiden Enden etwas ueber den Kopf hinaus wie an Dalben).
        H_.line([(PIER_X, sea_s(PIER_X) - 4), (PIER_X, PIER_Y)], 'pier', 5.0); H_.line([(PIER_W, PIER_Y), (PIER_E, PIER_Y)], 'pier', 5.0)
        H_.along((PIER_W - 16, PIER_Y), (PIER_E + 16, PIER_Y), 1, [('cruise', 180, 29, 'white', True)], jw=5.0, cls='XXL', start=0)
        # Marinepier: Korvette an der Ostseite, Minenjagdboot oder Segelschulschiff an der Westseite, Bug nach Norden
        MW = (MARINE_X, sea_s(MARINE_X) - 4)
        H_.line([MW, (MARINE_X, MARINE_Y)], 'pier', 5.0)
        H_.along(MW, (MARINE_X, MARINE_Y), -1, [('navy', 90, 13, 'grey', True)], jw=5.0, cls='XXL', start=6)
        H_.along(MW, (MARINE_X, MARINE_Y), 1, [('tall', 88, 12, 'white', True)], jw=5.0, cls='XXL', start=6)
        # Seenotrettungskreuzer an der Innenseite der Westmole, nahe der Einfahrt
        H_.along((18, 312), (96, 320), -1, [('srk', 46, 10, 'white', True)], jw=9, cls='XXL', start=1, gap=0, scale_jw=False)
    H_.render()
    berths = {k: v for k, v in H_.count.items() if k != 'T'}
    # ---------------- Land-Objekte
    sh = Image.new('L', size, 0); sd = ImageDraw.Draw(sh); objs = []
    B_ = lambda *a_, **k_: objs.append(building(d, sd, *a_, **k_))
    B_(-95, -24 if stage < 3 else -32, 5, 4, 'coral', hgt=2.5); B_(-126, -22, 8, 5, (214, 150, 104), hgt=3)
    if stage >= 2:
        B_(-72, -22 if stage < 3 else -30, 7, 5, 'grey', hgt=3); B_(-118, -36, 9, 6, 'coral'); B_(-36, -24 if stage < 3 else -30, 6, 5, (250, 212, 120), hgt=3)
        B_(-152, -22, 8, 5, (214, 150, 104), hgt=3); B_(-163, -24, 6, 5, (214, 150, 104), hgt=3)
    if stage >= 3:
        B_(6, -32, 14, 10, 'grey', hgt=7); B_(-60, -54, 26, 10, 'coral'); B_(-196, -44, 22, 11, 'coral')
    if stage >= 4:
        B_(48, -34, 26, 13, 'coral', hgt=5); B_(112, -30, 16, 9, 'coral'); B_(182, -56, 46, 26, (206, 216, 224), hgt=9)
    if stage >= 6:
        B_(-140, 208, 34, 10, (206, 216, 224), hgt=6); B_(-346, 208, 24, 9, 'grey', hgt=5)
    if stage >= 5:
        B_(-30, 204, 20, 10, (250, 212, 120), hgt=5); B_(56, 204, 16, 8, 'grey', hgt=5); B_(112, 204, 14, 8, 'coral', hgt=4)
    tr = random.Random(77); pts = []
    blocks = ((-95, -28, 8, 14), (-72, -26, 10, 14), (-118, -34, 12, 12), (-36, -27, 9, 12), (-157, -23, 22, 9), (6, -32, 18, 14), (-60, -54, 30, 14), (-196, -44, 26, 15),
              (48, -34, 30, 17), (112, -30, 20, 13), (182, -52, 60, 44), (6, -67, 100, 26), (-214, -26, 44, 22), (-126, -22, 12, 9))
    for _ in range(1600):
        if len(pts) >= 70: break
        x, y = tr.uniform(-296, 304), tr.uniform(-80, -18)
        if y > south(x) - 22: continue
        if any(abs(x - bx) < bw / 2 + 6 and abs(y - by) < bh / 2 + 6 for (bx, by, bw, bh) in blocks): continue
        if 128 < x < 216: continue
        if any(math.hypot(x - a_, y - b_) < 9 for a_, b_, _ in pts): continue
        pts.append((x, y, tr.uniform(3.0, 4.6)))
    for (x, y, r) in pts: objs.append(tree(d, sd, x, y, r, tr))
    sh_a = np.asarray(sh, np.float32)[..., None] / 255.0
    ia = np.asarray(img, np.float32).copy(); ia[..., :3] = ia[..., :3] * (1 - .16 * sh_a); img = Image.fromarray(ia.astype(np.uint8)); d = ImageDraw.Draw(img, 'RGBA'); H_.d = d
    if stage >= 3:
        d.polygon(PP([(-40, -80), (52, -80), (52, -54), (-40, -54)]), fill=C['road']); cr = random.Random(3)
        for i in range(18 if stage >= 4 else 9):
            x = -34 + (i % 9) * 10; y = -60 if i < 9 else -74
            if cr.random() < .25: continue
            col = cr.choice([C['white'], C['navy'], C['red'], C['grey'], (250, 208, 96), (200, 206, 212)])
            d.polygon(PP([(x - 1.7, y - 3.6), (x + 1.7, y - 3.6), (x + 1.7, y + 3.6), (x - 1.7, y + 3.6)]), fill=col)
    if stage >= 5:
        d.polygon(PP([(min(-320, X0 - 12), 207), (-44, 207), (-44, 211), (min(-320, X0 - 12), 211)]), fill=C['road'])
    if stage >= 2:
        d.polygon(PP([(-131, shore(-128) - 10), (-123, shore(-128) - 10), (-123, shore(-128) + 9), (-131, shore(-128) + 9)]), fill=(206, 204, 198))
    jr = random.Random(9)
    if stage >= 3:
        for i in range(6):
            boat(d, -226 + (i % 3) * 11, -20 - (i // 3) * 11, math.pi / 2 + jr.uniform(-.2, .2), 'dinghy', 4.4 * K, 1.7 * K, jr.choice(['white', 'red', 'yellow', 'navy']), jr)
        q = P(70, 1); r = 2.4 * S; d.line(PP([(70, 1), (70, 15)]), fill=C['yellow'], width=int(1.3 * S)); d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=C['yellow'])
    if stage <= 2:   # Leihboote am Strand
        for i in range(4): boat(d, -84 + i * 9, south(-80) - 7, math.pi / 2 + jr.uniform(-.3, .3), 'row' if i % 2 == 0 else 'dinghy', 4.2 * K, 1.6 * K, jr.choice(['white', 'red', 'yellow', 'green']), jr)
        q = P(24, 62); r = 4.0 * S; d.rectangle([q[0] - r, q[1] - r * .8, q[0] + r, q[1] + r * .8], fill=C['wood'] + (255,), outline=C['wood2'] + (255,), width=SS)   # Badeinsel
    if stage >= 4:
        d.polygon(PP([(136, -13), (208, -13), (208, -40), (136, -40)]), fill=(226, 222, 214)); j2 = random.Random(4)
        for i in range(4): boat(d, 147 + i * 16, -26, math.pi / 2, j2.choice(['sail', 'motor', 'sail']), 10.5 * K, 3.4 * K, j2.choice(['white', 'navy', 'white']), j2)
        a_, b_ = P(147.5, 27), P(164.5, 3); d.rectangle([a_[0], a_[1], b_[0], b_[1]], outline=C['navy'] + (255,), width=int(1.0 * S))
    for o in objs:
        if o[0] == 'b': draw_building(d, o)
        else: draw_tree(d, o)
    # ---------------- Seezeichen und Ansteuerung
    G, R = (40, 170, 96), (226, 60, 54)
    def pair(c, h, off=14):   # Tonnenpaar quer zur Einlaufrichtung h: Gruen an Steuerbord, Rot an Backbord
        rt = (h[1], -h[0]); buoy(d, c[0] + rt[0] * off, c[1] + rt[1] * off, G, 'cone'); buoy(d, c[0] - rt[0] * off, c[1] - rt[1] * off, R, 'can')
    if stage in (3, 4):
        beacon(d, *MOLE_W34[-1], G); beacon(d, *MOLE_E34[-1], R)
        for t_ in (30, 62): pair((168 + .3 * t_, 268 + .95 * t_), (-.3, -.95))
        route = curve([(196, 356), (176, 296), (168, 262), (167, 222), (167, 184), (128, 162), (74, 128) if stage == 3 else (70, 146)])
    elif stage >= 5:
        beacon(d, *MOLE_W5[-1], G); beacon(d, *MOLE_E5[-1], R)
        pair((146, 334), (-.5, -.866), 15); buoy(d, 166, 348, None, 'safe')
        route = curve([(158, 356), (134, 312), (150, 268), (166, 236), (167, 184), (128, 162), (70, 146)])
    elif stage == 2: route = curve([(304, 96), (150, 132), (20, 118), (-30, 92)])
    else: route = curve([(304, 96), (140, 118), (-20, 96), (-86, 50)])
    if stage >= 3:
        pair((140, 167), (-.92, -.39), 9); pair((104, 150), (-.92, -.39), 9)
    dashed(d, route, (255, 255, 255, 235), 1.6)
    if stage >= 6: dashed(d, curve([(-40, 356), (-120, 336), (-200, 326)]), (255, 255, 255, 235), 1.6)   # Grossschiffe
    # ---------------- Beschriftung
    n_ = lambda s_: stage == s_
    lb = lambda t_, x, y, new=False: label(d, t_, x, y, new)
    lb('Ostsee', 250 if stage < 5 else 264, 300 if stage < 5 else 314); lb('Binnensee', 222, 60); lb('Nehrung', -120 if stage < 5 else -150 if stage < 6 else -232, 205 if stage < 5 else 196)
    if stage == 1:
        lb('Steg A', -126, 26, True); lb('Bootsverleih', -134, -36, True); lb('Toilette', -95, -38, True); lb('Schilf', 60, 12); lb('Graben, nur für Ruderboote', 108, 206); lb('Badeinsel', 24, 76)
        lb('Leihboote', -70, -22)
    if stage == 2:
        lb('Steg A mit Knick', -134, 76, True); lb('Steg B mit T-Kopf', -55, top + 15, True); lb('Fischersteg', -168, 40, True)
        lb('Slip', -127, -17, True); lb('Hafenmeister', -72, -37, True); lb('Dusche', -118, -50, True); lb('Kiosk', -36, -38, True); lb('Graben', 142, 206); lb('Flachwasser', 120, 22)
    if stage >= 3:
        lb('Steg A', -121, 90); lb('Steg B', -55, top + 15, n_(5)); lb('Durchstich', 122 if stage < 5 else 214, 206, n_(3)); lb('Hauptsteg C', 56, 36, n_(3) or n_(4))
        lb('Hafenbüro', 6, -47, n_(3)); lb('Sanitär', -60, -68, n_(3)); lb('Segelclub', -196, -60, n_(3)); lb('Mastenkran', 70, -22, n_(3))
    if stage == 3:
        lb('Molen mit Molenfeuern', 108, 262, True); lb('Fahrrinne', 232, 318, True); lb('Fahrwasser im See', 150, 140, True); lb('Promenade', 150, -3, True); lb('ausgebaggert', 100, 40, True); lb('Fischersteg', -168, 40); lb('Slip', -127, -17)
    if stage >= 4:
        lb('Stichsteg', 52, 108, n_(4)); lb('Schwimmsteg D', 160, 52, n_(4)); lb('Tankstelle', 84, 180, n_(4)); lb('Seenotretter', 222, 246, n_(4)); lb('Travellift', 156, 36, n_(4))
        lb('Winterlager', 182, -56, n_(4)); lb('Restaurant', 48, -34, n_(4))
    if stage == 4: lb('Fahrrinne', 232, 318); lb('Molenfeuer', 110, 270)
    if stage >= 5:
        lb('Außenhafen', 96, 276, n_(5)); lb('Kai', 76, 208, n_(5)); lb('Fahrgastanleger', 62, 256, n_(5)); lb('Ostmole', 226, 284, n_(5))
        lb('Fischereikai', -52 if stage < 6 else 26, 262 if stage < 6 else 270, n_(5)); lb('Westmole', -34 if stage < 6 else -40, 318 if stage < 6 else 336, n_(5))
        lb('Ansteuerungstonne', 226, 344, n_(5)); lb('Gabelung', 150, 118, n_(5)); lb('Fischhalle', -30, 190, n_(5))
    if stage == 6:
        lb('Kreuzfahrtpier', -140, 300, True); lb('Marinepier', -300, 300, True); lb('Kreuzfahrtterminal', -140, 216, True); lb('Seenotkreuzer', 46, 290, True)
    # Wassertiefen aus dem Tiefenfeld
    f_ = font(int(11.5 * SS), 'italic')
    def dep_at(x, y):
        q = P(x, y); return float(depI[min(size[1] - 1, max(0, int(q[1]))), min(size[0] - 1, max(0, int(q[0])))])
    spots = [(-190, 110), (10, 150), (240, 130), (60, 330)] if stage < 3 else [(-190, 110), (-84, 124), (62, 160), (240, 130)] + ([(60, 300)] if stage >= 5 else [(60, 330)])
    for (tx, ty) in spots:
        d.text(P(tx, ty), f'{dep_at(tx, ty):.1f} m'.replace('.', ','), font=f_, fill=(34, 86, 108, 255), anchor='mm')
    # ---------------- Wind, Nordpfeil, Massstab (im See, westlich der Stege)
    wq = P(-282, 150); d.line([wq, (wq[0] + 54 * SS, wq[1])], fill=(255, 255, 255, 240), width=4 * SS)
    d.polygon([(wq[0] + 66 * SS, wq[1]), (wq[0] + 50 * SS, wq[1] - 9 * SS), (wq[0] + 50 * SS, wq[1] + 9 * SS)], fill=(255, 255, 255, 240))
    d.text((wq[0], wq[1] - 18 * SS), 'Wind meist aus West', font=font(int(12 * SS), 'sans'), fill=(34, 86, 108, 255), anchor='lm')
    q = P(-278, 116); d.polygon([(q[0], q[1] - 20 * SS), (q[0] + 8 * SS, q[1] + 10 * SS), (q[0], q[1] + 4 * SS), (q[0] - 8 * SS, q[1] + 10 * SS)], fill=C['ink'] + (255,))
    d.text((q[0] + 18 * SS, q[1] - 4 * SS), 'N', font=font(int(15 * SS), 'bold'), fill=C['ink'] + (255,), anchor='lm')
    a_, b_ = P(-284, 84), P(-284 + 25 / .62, 84); d.line([a_, b_], fill=C['ink'] + (255,), width=3 * SS)
    for e in (a_, b_): d.line([(e[0], e[1] - 5 * SS), (e[0], e[1] + 5 * SS)], fill=C['ink'] + (255,), width=3 * SS)
    d.text(((a_[0] + b_[0]) / 2, a_[1] - 13 * SS), '25 m', font=font(int(12 * SS), 'sans'), fill=C['ink'] + (255,), anchor='mm')
    # Ab Stufe 6 liegen Titel und Legende in einem Band ueber der Karte, damit sie die Pier nicht verdecken
    BAND = 236 if stage >= 6 else 0
    if BAND:
        voll = Image.new('RGBA', (size[0], size[1] + BAND * SS), (247, 244, 236, 255)); voll.paste(img, (0, BAND * SS)); img = voll; d = ImageDraw.Draw(img, 'RGBA')
    LX, LY = (660, 22) if BAND else (26, 164)
    # ---------------- Titel
    n = sum(berths.values()); t, sub = TITLES[stage]
    d.rounded_rectangle([26 * SS, 22 * SS, 640 * SS, 152 * SS], radius=14 * SS, fill=(255, 255, 255, 238))
    d.text((44 * SS, 32 * SS), t, font=font(int(27 * SS), 'bold'), fill=C['ink'] + (255,))
    parts = f'{n} Liegeplätze:  ' + ',  '.join(f'{v} {k}' for k, v in berths.items() if v)
    d.text((44 * SS, 71 * SS), parts, font=font(int(15 * SS), 'bold'), fill=(44, 100, 140, 255))
    words = sub.split(' '); lines = ['']; f2_ = font(int(13 * SS), 'sans')
    for w_ in words:
        if d.textlength((lines[-1] + ' ' + w_).strip(), font=f2_) > 578 * SS: lines.append(w_)
        else: lines[-1] = (lines[-1] + ' ' + w_).strip()
    for i, ln2 in enumerate(lines[:3]): d.text((44 * SS, (97 + i * 17.5) * SS), ln2, font=f2_, fill=C['ink'] + (255,))
    # ---------------- Legende
    rows = [('pile', 'Box mit Heckpfählen, Bug zum Steg')] + ([('finger', 'Schwimmsteg mit Fingerstegen')] if stage >= 4 else []) + \
           ([('beacon', 'Molenfeuer: einlaufend Grün rechts, Rot links'), ('buoy', 'Fahrwassertonnen')] if stage >= 3 else []) + [('route', 'Ansteuerung'), ('new', 'neu in dieser Stufe')]
    lx, ly = LX * SS, LY * SS
    d.rounded_rectangle([lx, ly, lx + 372 * SS, ly + (len(rows) * 25 + 14) * SS], radius=12 * SS, fill=(255, 255, 255, 228))
    fl = font(int(12.5 * SS), 'sans')
    for i, (k_, text) in enumerate(rows):
        cx_, cy_ = lx + 30 * SS, ly + (19 + i * 25) * SS
        if k_ == 'pile':
            for o_ in (-9, 0, 9): d.ellipse([cx_ + o_ * SS - 3 * SS, cy_ - 3 * SS, cx_ + o_ * SS + 3 * SS, cy_ + 3 * SS], fill=C['pile'])
        elif k_ == 'finger':
            d.line([(cx_ - 12 * SS, cy_ + 5 * SS), (cx_ + 12 * SS, cy_ + 5 * SS)], fill=C['pont2'], width=5 * SS)
            for o_ in (-8, 4): d.line([(cx_ + o_ * SS, cy_ + 5 * SS), (cx_ + o_ * SS, cy_ - 8 * SS)], fill=C['pont2'], width=3 * SS)
        elif k_ == 'beacon':
            for o_, col in ((-7, G), (7, R)): d.ellipse([cx_ + o_ * SS - 5 * SS, cy_ - 5 * SS, cx_ + o_ * SS + 5 * SS, cy_ + 5 * SS], fill=col + (255,))
        elif k_ == 'buoy':
            d.polygon([(cx_ - 8 * SS, cy_ - 6 * SS), (cx_ - 2 * SS, cy_ + 5 * SS), (cx_ - 14 * SS, cy_ + 5 * SS)], fill=G + (255,)); d.rectangle([cx_ + 3 * SS, cy_ - 5 * SS, cx_ + 13 * SS, cy_ + 5 * SS], fill=R + (255,))
        elif k_ == 'route':
            d.rounded_rectangle([cx_ - 16 * SS, cy_ - 7 * SS, cx_ + 16 * SS, cy_ + 7 * SS], radius=4 * SS, fill=C['d3'] + (255,))
            for o_ in (-12, 2): d.line([(cx_ + o_ * SS, cy_), (cx_ + (o_ + 9) * SS, cy_)], fill=(255, 255, 255, 255), width=3 * SS)
        elif k_ == 'new':
            d.rounded_rectangle([cx_ - 16 * SS, cy_ - 8 * SS, cx_ + 16 * SS, cy_ + 8 * SS], radius=5 * SS, fill=C['navy'] + (255,))
        d.text((lx + 58 * SS, cy_), text, font=fl, fill=C['ink'] + (255,), anchor='lm')
    return img.convert('RGB').resize((W, H + BAND), Image.LANCZOS), berths

if __name__ == '__main__':
    out = HERE / 'out'; out.mkdir(exist_ok=True)
    for s_ in ([int(a) for a in sys.argv[1:]] or [1, 2, 3, 4, 5, 6]):
        im, b = render(s_); im.save(out / f'hafen_stufe{s_}.png'); print(s_, b, sum(b.values()))

"""Gemeinsame Hafenszene fuer alle Stile: Geometrie, Projektion, Sortierung."""
import math, random

# ---------------------------------------------------------------- Primitive
def ccw(poly):
    a = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return list(poly) if a > 0 else list(reversed(poly))

def prism(poly, z0, z1, mat, top=None, decal=False):
    return dict(t='prism', poly=ccw(poly), z0=z0, z1=z1, mat=mat, top=top or mat, decal=decal)

def box(x0, y0, x1, y1, z0, z1, mat, top=None, decal=False):
    return prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, mat, top, decal)

def flat(poly, z, mat):
    return dict(t='flat', poly=ccw(poly), z=z, mat=mat)

def gable(x0, y0, x1, y1, z0, h, axis, mat, wall):
    return dict(t='gable', r=(x0, y0, x1, y1), z0=z0, h=h, axis=axis, mat=mat, wall=wall)

def frustum(cx, cy, z0, r0, r1, h, mat, n=8, top=None):
    return dict(t='frustum', c=(cx, cy), z0=z0, r0=r0, r1=r1, h=h, mat=mat, n=n, top=top or mat)

def cone(cx, cy, z0, r, h, mat, n=6):
    return frustum(cx, cy, z0, r, 0.0, h, mat, n)

def line(p0, p1, mat, w=0.12):
    return dict(t='line', p0=p0, p1=p1, mat=mat, w=w)

def tri(p0, p1, p2, mat):
    return dict(t='tri', pts=[p0, p1, p2], mat=mat)

def obj(name, prims, kind='misc', gz=0.0, shadow=True):
    return dict(name=name, prims=prims, kind=kind, gz=gz, shadow=shadow)

# ---------------------------------------------------------------- Modelle
def _xf(c, h):
    px, py = -h[1], h[0]
    return lambda u, v: (c[0] + u * h[0] + v * px, c[1] + u * h[1] + v * py)

def boat(cx, cy, L, B, heading, kind, hull, rnd, gz=0.0, sails=False):
    n = math.hypot(*heading); h = (heading[0] / n, heading[1] / n)
    T = _xf((cx, cy), h)
    hullp = [T(-L / 2, -B * .42), T(L * .12, -B / 2), T(L / 2, 0), T(L * .12, B / 2), T(-L / 2, B * .42)]
    rect = lambda u0, u1, v: [T(u0, -v), T(u1, -v), T(u1, v), T(u0, v)]
    P = []
    if kind == 'row':
        fb = .45
        P.append(prism(hullp, gz - .05, gz + fb, hull, top='hull_in'))
        for u in (-L * .2, L * .08):
            P.append(prism(rect(u - .1, u + .1, B * .38), gz + fb, gz + fb + .04, 'wood', decal=False))
    elif kind == 'dinghy':
        fb = .5
        P.append(prism(hullp, gz - .05, gz + fb, hull, top='deck_light'))
        m = T(L * .12, 0); mh = L * 1.25
        P.append(line((m[0], m[1], gz + fb), (m[0], m[1], gz + fb + mh), 'mast', .09))
        b = T(-L * .38, 0)
        P.append(line((m[0], m[1], gz + fb + .5), (b[0], b[1], gz + fb + .5), 'mast', .08))
        if sails:
            P.append(tri((m[0], m[1], gz + fb + .55), (b[0], b[1], gz + fb + .55), (m[0], m[1], gz + fb + mh * .96), 'sail'))
        else:
            P.append(line((m[0], m[1], gz + fb + .58), (b[0], b[1], gz + fb + .58), 'cover', .2))
    elif kind == 'sail':
        fb = .8
        P.append(prism(hullp, gz - .05, gz + fb, hull, top='deck_light'))
        P.append(prism(rect(-L * .2, L * .16, B * .27), gz + fb, gz + fb + .42, 'cabin', top='cabin'))
        P.append(prism(rect(-L * .44, -L * .24, B * .3), gz + fb, gz + fb + .05, 'deck'))
        m = T(L * .1, 0); mh = L * 1.3
        P.append(line((m[0], m[1], gz + fb), (m[0], m[1], gz + fb + mh), 'mast', .11))
        b = T(-L * .36, 0)
        P.append(line((m[0], m[1], gz + fb + .95), (b[0], b[1], gz + fb + .95), 'mast', .09))
        bow = T(L * .48, 0)
        P.append(line((m[0], m[1], gz + fb + mh * .92), (bow[0], bow[1], gz + fb), 'rig', .04))
        if sails:
            P.append(tri((m[0], m[1], gz + fb + 1.0), (b[0], b[1], gz + fb + 1.0), (m[0], m[1], gz + fb + mh * .97), 'sail'))
            j = T(L * .14, 0)
            P.append(tri((bow[0], bow[1], gz + fb + .1), (j[0], j[1], gz + fb + .5), (m[0], m[1], gz + fb + mh * .86), 'sail2'))
        else:
            P.append(line((m[0], m[1], gz + fb + 1.05), (b[0], b[1], gz + fb + 1.05), 'cover', .26))
    elif kind == 'motor':
        fb = .85
        P.append(prism(hullp, gz - .05, gz + fb, hull, top='deck_light'))
        P.append(prism(rect(-L * .22, L * .2, B * .33), gz + fb, gz + fb + .85, 'cabin', top='cabin'))
        P.append(prism(rect(L * .12, L * .26, B * .3), gz + fb, gz + fb + .6, 'glass', top='glass'))
        P.append(prism(rect(-L * .18, L * .06, B * .25), gz + fb + .85, gz + fb + 1.2, 'cabin', top='cabin_top'))
        P.append(prism(rect(-L * .46, -L * .28, B * .32), gz + fb, gz + fb + .05, 'deck'))
    elif kind == 'yacht':
        fb = 1.3
        P.append(prism(hullp, gz - .05, gz + fb, hull, top='deck_light'))
        P.append(prism(rect(-L * .28, L * .22, B * .36), gz + fb, gz + fb + 1.1, 'cabin', top='cabin'))
        P.append(prism(rect(L * .14, L * .28, B * .33), gz + fb, gz + fb + .8, 'glass', top='glass'))
        P.append(prism(rect(-L * .22, L * .1, B * .3), gz + fb + 1.1, gz + fb + 2.0, 'cabin', top='cabin_top'))
        P.append(prism(rect(L * .02, L * .13, B * .27), gz + fb + 1.1, gz + fb + 1.8, 'glass', top='glass'))
        P.append(prism(rect(-L * .47, -L * .32, B * .34), gz + fb, gz + fb + .06, 'deck'))
        a = T(-L * .12, 0)
        P.append(line((a[0], a[1], gz + fb + 2.0), (a[0], a[1], gz + fb + 3.3), 'mast', .1))
    elif kind == 'tall':
        fb = 1.7
        P.append(prism(hullp, gz - .05, gz + fb, hull, top='deck'))
        P.append(prism(rect(-L * .40, -L * .26, B * .26), gz + fb, gz + fb + 1.0, 'cabin', top='roof_grey'))
        P.append(prism(rect(-L * .02, L * .06, B * .2), gz + fb, gz + fb + .7, 'cabin', top='roof_grey'))
        for u, mh in ((-L * .2, 13.5), (L * .05, 15.5), (L * .28, 13.0)):
            m = T(u, 0)
            P.append(line((m[0], m[1], gz + fb), (m[0], m[1], gz + fb + mh), 'mast_wood', .22))
            for k, yl in ((.45, B * .95), (.68, B * .75), (.86, B * .55)):
                a, b = T(u, -yl), T(u, yl)
                P.append(line((a[0], a[1], gz + fb + mh * k), (b[0], b[1], gz + fb + mh * k), 'mast_wood', .14))
                P.append(line((a[0], a[1], gz + fb + mh * k - .22), (b[0], b[1], gz + fb + mh * k - .22), 'sail', .26))
        bs0, bs1 = T(L * .46, 0), T(L * .68, 0)
        P.append(line((bs0[0], bs0[1], gz + fb), (bs1[0], bs1[1], gz + fb + 1.6), 'mast_wood', .18))
        m = T(L * .28, 0)
        P.append(line((bs1[0], bs1[1], gz + fb + 1.6), (m[0], m[1], gz + fb + 12.5), 'rig', .04))
    return obj('boot', P, kind='boat', gz=gz)

def tree(x, y, gz, s, rnd, mat='tree'):
    return obj('baum', [frustum(x, y, gz, .16 * s, .13 * s, .7 * s, 'trunk', n=5),
                        cone(x, y, gz + .6 * s, 1.0 * s, 1.5 * s, mat, n=6),
                        cone(x, y, gz + 1.5 * s, .72 * s, 1.5 * s, mat, n=6)], kind='tree', gz=gz)

def bush(x, y, gz, s, mat='tree2'):
    return obj('busch', [cone(x, y, gz, .9 * s, .9 * s, mat, n=6)], kind='tree', gz=gz)

def pile(x, y, h=1.7, r=.17):
    return obj('pfahl', [box(x - r, y - r, x + r, y + r, -.3, h, 'post', top='post_top')], kind='pile')

def wall_decals(x0, x1, y, z0, z1, mat, eps=.04):      # Fassade, die nach +y zeigt
    return box(x0, y, x1, y + eps, z0, z1, mat, decal=True)

def wall_decals_x(y0, y1, x, z0, z1, mat, eps=.04):    # Fassade, die nach +x zeigt
    return box(x, y0, x + eps, y1, z0, z1, mat, decal=True)

# ---------------------------------------------------------------- Szene Stufe 1
def scene_stage1():
    rnd = random.Random(7)
    c = lambda x: .7 * math.sin(x / 4.3) + .35 * math.sin(x / 1.9 + 1) + .015 * x
    xs = [x * 1.0 for x in range(-42, 43, 2)]
    coast = [(x, c(x)) for x in xs]
    land = [(-42, -70), (42, -70)] + list(reversed(coast))
    gz = .35
    ground = [prism(land, -.6, gz, 'bank', top='grass'),
              flat([(x, c(x) + .1) for x in xs] + [(x, c(x) - 3.6 - .6 * math.sin(x / 3.1)) for x in reversed(xs)], gz + .01, 'sand'),
              flat([(x, c(x) + 1.3 + .25 * math.sin(x / 2.2)) for x in xs] + [(x, c(x) - .1) for x in reversed(xs)], .02, 'sand_wet'),
              flat([(-.75, -6.2), (.75, -6.2), (.75, c(0) + .2), (-.75, c(0) + .2)], gz + .02, 'path'),
              flat([(-3.7, -6.0), (-.7, -6.0), (-.7, -5.0), (-3.7, -5.0)], gz + .02, 'path')]
    O = []
    O.append(obj('steg', [box(-.8, -1.4, .8, 11, .5, .72, 'wood_side', top='wood')], kind='jetty'))
    for py in (1.2, 3.7, 6.2, 8.7, 10.8):
        for px in (-.8, .8):
            O.append(pile(px, py, h=1.05, r=.13))
    O.append(boat(1.95, 4.4, 3.4, 1.3, (0, -1), 'dinghy', 'hull_white', rnd, sails=True))
    O.append(boat(-1.75, 7.3, 2.8, 1.1, (0, 1), 'row', 'hull_wood', rnd))
    O.append(boat(-6.2, 11.2, 3.6, 1.35, (.75, -.66), 'dinghy', 'hull_red', rnd, sails=True))
    O.append(boat(5.4, -1.3, 2.6, 1.05, (.35, 1), 'row', 'hull_navy', rnd, gz=gz))
    # Toilettenhaeuschen
    O.append(obj('wc', [box(-5.3, -6.3, -3.7, -4.7, gz, 2.55, 'wall_wood'),
                        wall_decals(-4.85, -4.15, -4.7, gz, 2.05, 'door'),
                        gable(-5.6, -6.6, -3.4, -4.4, 2.55, .75, 'y', 'roof_red', 'wall_wood')], kind='building', gz=gz))
    O.append(obj('schild', [line((1.7, -1.2, gz), (1.7, -1.2, gz + 1.5), 'post', .1),
                            box(1.25, -1.26, 2.15, -1.14, gz + 1.25, gz + 1.85, 'sign')], kind='misc', gz=gz))
    O.append(obj('flagge', [line((-1.7, -1.5, gz), (-1.7, -1.5, gz + 4.2), 'mast', .09),
                            tri((-1.7, -1.5, gz + 4.15), (-1.7, -1.5, gz + 3.45), (-.6, -1.5, gz + 3.8), 'flag')], kind='misc', gz=gz))
    for (x, y, s) in ((-8.2, -7.6, 1.25), (6.3, -6.8, 1.1), (9.2, -9.5, 1.35), (-1.9, -10.4, 1.3), (-11.5, -4.6, 1.0), (11.8, -4.2, 1.05), (2.6, -12.5, 1.2)):
        O.append(tree(x, y, gz, s, rnd))
    for (x, y, s) in ((3.4, -4.7, .8), (-7.3, -3.9, .7), (8.3, -3.6, .6)):
        O.append(bush(x, y, gz, s))
    for (x, y, s) in ((6.9, c(6.9) + .5, .34), (7.7, c(7.7) + .9, .24), (-6.4, c(-6.4) + .6, .28), (-9.3, c(-9.3) + .3, .36)):
        O.append(obj('stein', [prism([(x - s, y - s * .8), (x + s * .9, y - s), (x + s, y + s * .7), (x - s * .7, y + s)], -.1, s * 1.1, 'rock', top='rock_top')], kind='rock'))
    O.append(obj('boje', [frustum(4.9, 9.6, -.05, .32, .2, .5, 'buoy_r', n=6), line((4.9, 9.6, .45), (4.9, 9.6, 1.0), 'dark', .06)], kind='misc'))
    return dict(name='Stufe 1', ground=ground, objects=O, coast=coast, focus=(-9.5, -9.5, 9.5, 13.8, 5.5), vox=.36,
                labels=[('Badesteg', (-3.2, 13.2)), ('Strand', (9.5, -2.2))], dims=[((-.8, -1.4), (-.8, 11), 'Steg 12 m', -2.2)])

# ---------------------------------------------------------------- Szene Maximalstufe
def scene_max():
    rnd = random.Random(11)
    left = [(-4, .8), (-10, 2.4), (-18, 3.2), (-28, 2.6), (-40, 3.6), (-70, 3.0)]
    right = [(107, -1.5), (114, -4), (126, -6), (150, -7)]
    coast = list(reversed(left)) + [(0, 0), (104, 0)] + right
    land = [(-70, -120), (150, -120)] + list(reversed(coast))
    gz = .7
    ground = [prism(land, -.8, gz, 'quaywall', top='grass'),
              flat([(0, -4.2), (104, -4.2), (104, 0), (0, 0)], gz + .01, 'pave'),
              flat([(0, -4.2), (0, 0)] + left + [(-70, -3.5), (-40, -2.5), (-20, -3.5), (-8, -5)], gz + .01, 'sand'),
              flat([(104, -4.2), (104, 0)] + right + [(150, -12), (124, -11), (110, -8.5)], gz + .01, 'sand'),
              flat([(p[0], p[1] + 1.6) for p in reversed(left)] + [(0, .9), (0, 0)] + left, .02, 'sand_wet'),
              flat([(104, 0), (104, 1.0)] + [(p[0], p[1] + 1.5) for p in right] + list(reversed(right)), .02, 'sand_wet'),
              flat([(18, -22), (21, -22), (21, -4.2), (18, -4.2)], gz + .02, 'path'),
              flat([(34, -22), (37, -22), (37, -4.2), (34, -4.2)], gz + .02, 'path'),
              flat([(-30, -22), (150, -22), (150, -25), (-30, -25)], gz + .02, 'road'),
              flat([(39.5, -5.6), (54.5, -5.6), (54.5, -.6), (39.5, -.6)], gz + .03, 'deckwood')]
    O = []
    hulls = ['hull_white'] * 9 + ['hull_navy'] * 3 + ['hull_red'] * 2 + ['hull_yellow', 'hull_green']
    JX = [8, 22, 36, 50, 64]
    for jx in JX:
        O.append(obj('steg', [box(jx - 1, -.2, jx + 1, 24.4, .22, .56, 'pontoon', top='deck')], kind='jetty'))
        O.append(pile(jx, 24.9))
        for fy in (2.5, 7.5, 12.5, 17.5, 22.5):
            for sgn in (-1, 1):
                x0, x1 = (jx + 1, jx + 5.3) if sgn > 0 else (jx - 5.3, jx - 1)
                O.append(obj('finger', [box(x0, fy - .3, x1, fy + .3, .22, .5, 'pontoon', top='deck')], kind='jetty'))
                O.append(pile(jx + sgn * 5.6, fy, h=1.7))
        for by in (5, 10, 15, 20):
            for sgn in (-1, 1):
                if rnd.random() < .12: continue
                kind = 'sail' if rnd.random() < .62 else 'motor'
                L = rnd.uniform(4.3, 5.4) if kind == 'sail' else rnd.uniform(4.0, 5.0)
                Bm = L * (.34 if kind == 'sail' else .4)
                hd = (-sgn, 0) if rnd.random() < .7 else (sgn, 0)
                O.append(boat(jx + sgn * (1.35 + L / 2), by + rnd.uniform(-.25, .25), L, Bm, hd, kind, rnd.choice(hulls), rnd))
        for py in (6, 14, 22):
            O.append(obj('saeule', [box(jx - .2, py - .2, jx + .2, py + .2, .56, 1.35, 'pedestal', top='cover')], kind='misc'))
    # Kai mit Traditionssegler und Grossyacht
    O.append(boat(86.5, 3.3, 22, 4.6, (-1, 0), 'tall', 'hull_dark', rnd))
    for bx in range(75, 101, 5):
        O.append(obj('poller', [box(bx - .25, -.9, bx + .25, -.4, gz, gz + .55, 'bollard')], kind='misc', gz=gz))
    O.append(boat(96.6, 19.5, 12.5, 3.7, (0, -1), 'yacht', 'hull_white', rnd))
    # Mole mit Leuchtfeuer
    mole = [(99, -.5), (102.4, -.5), (102.4, 37.4), (71, 37.4), (71, 34), (99, 34)]
    O.append(obj('mole', [prism(mole, -.8, 1.15, 'rock', top='rock_top')], kind='mole'))
    for i in range(46):
        if i < 26:
            x, y = 102.4 + rnd.uniform(.1, 1.3), rnd.uniform(1, 37)
        else:
            x, y = rnd.uniform(71, 102), 37.4 + rnd.uniform(.1, 1.3)
        s = rnd.uniform(.45, .95)
        O.append(obj('stein', [prism([(x - s, y - s * .8), (x + s * .9, y - s), (x + s, y + s * .7), (x - s * .7, y + s)], -.3, s * 1.2, 'rock', top='rock_top')], kind='rock'))
    lx, ly, lz = 73.2, 35.7, 1.15
    O.append(obj('leuchtfeuer', [frustum(lx, ly, lz, 1.5, 1.2, 2.6, 'lh_white', n=8),
                                 frustum(lx, ly, lz + 2.6, 1.2, 1.0, 2.6, 'lh_red', n=8),
                                 frustum(lx, ly, lz + 5.2, 1.0, .85, 2.4, 'lh_white', n=8),
                                 frustum(lx, ly, lz + 7.6, 1.25, 1.25, .3, 'dark', n=8),
                                 frustum(lx, ly, lz + 7.9, .62, .62, 1.1, 'lantern', n=8),
                                 cone(lx, ly, lz + 9.0, .85, .9, 'lh_red', n=8)], kind='lighthouse', gz=lz))
    # Tankstelle
    O.append(obj('tanksteg', [box(-7.2, 1.2, -4.2, 13.5, .22, .6, 'pontoon', top='deck')], kind='jetty'))
    O.append(obj('zapfsaeule', [box(-6.1, 9.4, -5.4, 10.3, .6, 1.75, 'pump', top='dark')], kind='misc'))
    cp = []
    for (px, py) in ((-7, 7.6), (-4.4, 7.6), (-7, 12.2), (-4.4, 12.2)):
        cp.append(line((px, py, .6), (px, py, 3.0), 'mast', .12))
    cp.append(box(-7.5, 7.1, -3.9, 12.7, 3.0, 3.3, 'canopy', top='canopy_top'))
    O.append(obj('tankdach', cp, kind='building'))
    O.append(boat(-2.6, 9.8, 5.2, 2.1, (0, -1), 'motor', 'hull_white', rnd))
    # Gebaeude
    O.append(obj('sanitaer', [box(3, -12.5, 15, -6.5, gz, 3.8, 'wall_white'),
                              wall_decals(4.6, 5.8, -6.5, gz, 2.9, 'door'), wall_decals(11.8, 13.0, -6.5, gz, 2.9, 'door'),
                              wall_decals(7.2, 8.4, -6.5, 2.2, 3.1, 'glass'), wall_decals(9.2, 10.4, -6.5, 2.2, 3.1, 'glass'),
                              wall_decals_x(-11.2, -9.8, 15, 2.2, 3.1, 'glass'), wall_decals_x(-9.0, -7.6, 15, 2.2, 3.1, 'glass'),
                              gable(2.5, -13, 15.5, -6, 3.8, 1.9, 'x', 'roof_red', 'wall_white')], kind='building', gz=gz))
    O.append(obj('buero', [box(23.5, -12, 31, -6.5, gz, 6.4, 'wall_yellow'),
                           wall_decals(24.3, 30.2, -6.5, 1.9, 3.1, 'glass'), wall_decals(24.3, 30.2, -6.5, 4.4, 5.6, 'glass'),
                           wall_decals_x(-11.2, -7.3, 31, 1.9, 3.1, 'glass'), wall_decals_x(-11.2, -7.3, 31, 4.4, 5.6, 'glass'),
                           box(23.1, -12.4, 31.4, -6.1, 6.4, 6.8, 'roof_grey'),
                           line((29.5, -10.5, 6.8), (29.5, -10.5, 9.6), 'mast', .08)], kind='building', gz=gz))
    O.append(obj('flagge', [line((22.2, -5.2, gz), (22.2, -5.2, gz + 8.2), 'mast', .12),
                            tri((22.2, -5.2, gz + 8.1), (22.2, -5.2, gz + 6.7), (24.6, -5.2, gz + 7.4), 'flag')], kind='misc', gz=gz))
    O.append(obj('restaurant', [box(40, -14, 54, -7, gz, 4.3, 'wall_white'),
                                wall_decals(41, 46, -7, 1.5, 3.5, 'glass'), wall_decals(47.2, 49, -7, gz, 3.5, 'door'), wall_decals(50, 53, -7, 1.5, 3.5, 'glass'),
                                wall_decals_x(-13, -8.2, 54, 1.5, 3.5, 'glass'),
                                gable(39.5, -14.5, 54.5, -6.5, 4.3, 2.3, 'x', 'roof_red', 'wall_white')], kind='building', gz=gz))
    for i, ux in enumerate((42, 45.6, 49.2, 52.8)):
        O.append(obj('schirm', [line((ux, -3.2, gz), (ux, -3.2, gz + 2.3), 'mast', .08),
                                cone(ux, -3.2, gz + 2.0, 1.45, .75, 'umbrella_r' if i % 2 == 0 else 'umbrella_w', n=8)], kind='misc', gz=gz))
    O.append(obj('kiosk', [box(60, -9.5, 65, -6.5, gz, 3.4, 'wall_wood'), wall_decals(60.8, 64.2, -6.5, 1.7, 2.8, 'glass'),
                           box(59.6, -9.9, 65.4, -5.4, 3.4, 3.7, 'canopy', top='canopy_top')], kind='building', gz=gz))
    O.append(obj('kran', [box(69, -3.4, 70.2, -2.2, gz, gz + 5.2, 'buoy_g'),
                          line((69.6, -2.8, gz + 5.0), (69.6, 2.4, gz + 6.4), 'buoy_g', .32),
                          line((69.6, 2.2, gz + 6.3), (69.6, 2.2, gz + 3.2), 'dark', .05)], kind='misc', gz=gz))
    pts = []
    tries = 0
    while len(pts) < 46 and tries < 4000:
        tries += 1
        x, y = rnd.uniform(-45, 135), rnd.uniform(-58, -8)
        if -25.5 < y < -21.5: continue
        if any(a < x < b and c < y < d for (a, b, c, d) in ((0, 18, -16, -4), (20.5, 34, -15, -4), (36.5, 58, -17, -4), (57, 68, -13, -4), (66, 106, -8, 0))): continue
        if y > -12 and (x < 0 or x > 104) and y > -9: continue
        if any(math.hypot(x - a, y - b) < 3.6 for a, b, _ in pts): continue
        pts.append((x, y, rnd.uniform(1.5, 2.3)))
    for (x, y, s) in pts:
        O.append(tree(x, y, gz, s, rnd, mat='tree' if rnd.random() < .7 else 'tree2'))
    # Boote auf dem Wasser, Tonnen
    O.append(boat(30, 37, 5.6, 1.9, (-.35, -.94), 'sail', 'hull_white', rnd, sails=True))
    O.append(boat(47, 44, 5.0, 2.0, (.9, -.44), 'motor', 'hull_navy', rnd))
    O.append(boat(-12, 24, 3.6, 1.35, (.8, .6), 'dinghy', 'hull_red', rnd, sails=True))
    O.append(obj('tonne', [frustum(63, 41, -.05, .7, .45, 1.2, 'buoy_r', n=6), line((63, 41, 1.1), (63, 41, 2.2), 'dark', .09)], kind='misc'))
    O.append(obj('tonne', [frustum(56, 32, -.05, .7, .45, 1.2, 'buoy_g', n=6), line((56, 32, 1.1), (56, 32, 2.2), 'dark', .09)], kind='misc'))
    return dict(name='Maximalstufe', ground=ground, objects=O, coast=coast, focus=(-11, -17, 104, 44, 11), view=(-38, 108, -12, 72), vox=1.0,
                labels=[('Steg A', (5, 31)), ('Steg E', (62, 30)), ('Mole', (86, 42)), ('Tankstelle', (-9, 18)), ('Hafeneinfahrt', (50, 38.5))],
                dims=[((7, -.2), (7, 24.4), 'Steg 25 m', -8.5)])

# ---------------------------------------------------------------- Kamera
class Cam:
    def __init__(self, k=10.0, ox=0.0, oy=0.0, zf=1.0):
        self.k, self.ox, self.oy, self.zf = k, ox, oy, zf
    def p(self, x, y, z=0.0):
        return ((x - y) * self.k + self.ox, (x + y) * self.k * .5 - z * self.k * self.zf + self.oy)
    def inv(self, sx, sy):   # Bildpunkt -> Punkt auf der Wasserflaeche
        a = (sx - self.ox) / self.k; b = (sy - self.oy) / (self.k * .5)
        return ((a + b) / 2, (b - a) / 2)

def fit(scene, W, H, margin=.05):
    if 'view' in scene:
        d0, d1, s0, s1 = scene['view']
        k = min(W * (1 - 2 * margin) / (d1 - d0), H * (1 - 2 * margin) / (s1 - s0))
        cam = Cam(k)
        cam.ox = W / 2 - (d0 + d1) / 2 * k
        cam.oy = H / 2 - (s0 + s1) / 2 * k
        return cam
    x0, y0, x1, y1, zt = scene['focus']
    c = Cam(1.0)
    pts = [c.p(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (0, zt)]
    minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
    miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
    k = min(W * (1 - 2 * margin) / (maxx - minx), H * (1 - 2 * margin) / (maxy - miny))
    cam = Cam(k)
    cam.ox = W / 2 - (minx + maxx) / 2 * k
    cam.oy = H / 2 - (miny + maxy) / 2 * k
    return cam

# ---------------------------------------------------------------- Netz (Flaechen)
VIEW = (1.0, 1.0, 1.0)

def _norm(v):
    n = math.sqrt(sum(a * a for a in v)) or 1.0
    return tuple(a / n for a in v)

def _face_normal(p):
    ax, ay, az = (p[1][i] - p[0][i] for i in range(3)); bx, by, bz = (p[2][i] - p[0][i] for i in range(3))
    return _norm((ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx))

def prim_faces(pr):
    """Liste von (punkte3d, normale, material, art) fuer sichtbare Flaechen eines Primitivs."""
    out = []
    t = pr['t']
    if t == 'flat':
        out.append(([(x, y, pr['z']) for x, y in pr['poly']], (0, 0, 1), pr['mat'], 'flat'))
    elif t == 'prism':
        P = pr['poly']; z0, z1 = pr['z0'], pr['z1']; sides = []
        for i in range(len(P)):
            a, b = P[i], P[(i + 1) % len(P)]
            n = _norm((b[1] - a[1], -(b[0] - a[0]), 0))
            if n[0] + n[1] > 1e-6 and z1 - z0 > 1e-6:
                sides.append(((a[0] + b[0] + a[1] + b[1]) / 2, ([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], n, pr['mat'], 'decal' if pr.get('decal') else 'side')))
        sides.sort(key=lambda s: s[0])
        out += [s[1] for s in sides]
        out.append(([(x, y, z1) for x, y in P], (0, 0, 1), pr['top'], 'decal' if pr.get('decal') else 'top'))
    elif t == 'gable':
        x0, y0, x1, y1 = pr['r']; z0, h = pr['z0'], pr['h']
        if pr['axis'] == 'x':
            ym = (y0 + y1) / 2
            fs = [[(x0, y0, z0), (x1, y0, z0), (x1, ym, z0 + h), (x0, ym, z0 + h)],
                  [(x1, y1, z0), (x0, y1, z0), (x0, ym, z0 + h), (x1, ym, z0 + h)],
                  [(x1, y0, z0), (x1, y1, z0), (x1, ym, z0 + h)], [(x0, y1, z0), (x0, y0, z0), (x0, ym, z0 + h)]]
        else:
            xm = (x0 + x1) / 2
            fs = [[(x0, y1, z0), (x0, y0, z0), (xm, y0, z0 + h), (xm, y1, z0 + h)],
                  [(x1, y0, z0), (x1, y1, z0), (xm, y1, z0 + h), (xm, y0, z0 + h)],
                  [(x1, y1, z0), (x0, y1, z0), (xm, y1, z0 + h)], [(x0, y0, z0), (x1, y0, z0), (xm, y0, z0 + h)]]
        for i, f in enumerate(fs):
            n = _face_normal(f)
            if sum(n[j] * VIEW[j] for j in range(3)) > 1e-6:
                out.append((f, n, pr['mat'] if i < 2 else pr['wall'], 'slope' if i < 2 else 'side'))
    elif t == 'frustum':
        cx, cy = pr['c']; n_ = pr['n']; z0 = pr['z0']; z1 = z0 + pr['h']; r0, r1 = pr['r0'], pr['r1']
        ring = lambda r, z: [(cx + r * math.cos(2 * math.pi * (i + .5) / n_), cy + r * math.sin(2 * math.pi * (i + .5) / n_), z) for i in range(n_)]
        A, B = ring(r0, z0), ring(max(r1, 1e-4), z1)
        for i in range(n_):
            j = (i + 1) % n_
            f = [A[i], A[j], B[j], B[i]] if r1 > 1e-3 else [A[i], A[j], B[i]]
            n = _face_normal(f)
            if sum(n[q] * VIEW[q] for q in range(3)) > 1e-6:
                out.append((f, n, pr['mat'], 'side'))
        if r1 > 1e-3:
            out.append((B, (0, 0, 1), pr['top'], 'top'))
    elif t == 'tri':
        f = pr['pts']; n = _face_normal(f)
        if n[0] + n[1] + n[2] < 0: n = tuple(-a for a in n)
        out.append((f, n, pr['mat'], 'sail'))
    return out

def obj_bounds(o):
    xs, ys = [], []
    for pr in o['prims']:
        t = pr['t']
        if t in ('prism', 'flat'): pts = pr['poly']
        elif t == 'gable': pts = [(pr['r'][0], pr['r'][1]), (pr['r'][2], pr['r'][3])]
        elif t == 'frustum': r = max(pr['r0'], pr['r1']); pts = [(pr['c'][0] - r, pr['c'][1] - r), (pr['c'][0] + r, pr['c'][1] + r)]
        elif t == 'line': pts = [pr['p0'][:2], pr['p1'][:2]]
        else: pts = [p[:2] for p in pr['pts']]
        xs += [p[0] for p in pts]; ys += [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

def sort_objects(objs):
    """Maler-Reihenfolge: hinten zuerst. Paarweiser Vergleich der Grundflaechen, dann topologisch sortiert."""
    n = len(objs); B = [obj_bounds(o) for o in objs]
    key = [(b[0] + b[2] + b[1] + b[3]) / 2 for b in B]
    order = sorted(range(n), key=lambda i: key[i])
    after = [[] for _ in range(n)]; indeg = [0] * n
    eps = 1e-6
    for ii in range(n):
        for jj in range(ii + 1, n):
            a, b = B[ii], B[jj]
            # nur wenn sie sich auf dem Bild ueberdecken koennten (grobe Pruefung ueber x-y)
            if a[2] - a[1] < b[0] - b[3] - 14 or b[2] - b[1] < a[0] - a[3] - 14: continue
            a_behind = a[2] <= b[0] + eps or a[3] <= b[1] + eps
            b_behind = b[2] <= a[0] + eps or b[3] <= a[1] + eps
            if a_behind and not b_behind: after[ii].append(jj); indeg[jj] += 1
            elif b_behind and not a_behind: after[jj].append(ii); indeg[ii] += 1
    import heapq
    heap = [(key[i], i) for i in range(n) if indeg[i] == 0]; heapq.heapify(heap)
    res = []; done = [False] * n
    while len(res) < n:
        if not heap:   # Zyklus: nimm den hintersten uebrigen
            i = min((i for i in range(n) if not done[i]), key=lambda i: key[i])
        else:
            _, i = heapq.heappop(heap)
            if done[i]: continue
        done[i] = True; res.append(i)
        for j in after[i]:
            indeg[j] -= 1
            if indeg[j] == 0 and not done[j]: heapq.heappush(heap, (key[j], j))
    return [objs[i] for i in res]

def build(scene, cam):
    """Erzeugt die Zeichenliste: Boden und danach Objekte von hinten nach vorn."""
    items = []
    def add(prims, oid, o=None):
        for pi, pr in enumerate(prims):
            if pr['t'] == 'line':
                items.append(dict(t='line', a=cam.p(*pr['p0']), b=cam.p(*pr['p1']), mat=pr['mat'], w=pr['w'] * cam.k, obj=oid, o=o, w3=(pr['p0'], pr['p1']), pi=pi, kind='line', n=(0, 0, 1)))
            else:
                for (pts, n, mat, kind) in prim_faces(pr):
                    items.append(dict(t='face', pts=[cam.p(*q) for q in pts], n=n, mat=mat, kind=kind, obj=oid, o=o, w3=pts, pi=pi))
    add(scene['ground'], -1)
    for i, o in enumerate(sort_objects(scene['objects'])):
        add(o['prims'], i, o)
    return items

def shadow_polys(o, cam, dx=.55, dy=-.25, lines=True):
    """Schlagschatten eines Objekts auf seiner Grundhoehe, als Bildpolygone."""
    out = []; gz = o.get('gz', 0.0)
    for pr in o['prims']:
        t = pr['t']
        if t == 'prism' and not pr.get('decal'):
            base, h = pr['poly'], pr['z1'] - gz
        elif t == 'gable':
            x0, y0, x1, y1 = pr['r']; base, h = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], pr['z0'] + pr['h'] * .6 - gz
        elif t == 'frustum':
            cx, cy = pr['c']; r = pr['r0']; base = [(cx + r * math.cos(a * math.pi / 4), cy + r * math.sin(a * math.pi / 4)) for a in range(8)]; h = pr['z0'] + pr['h'] - gz
        elif t == 'line':
            if not lines: continue
            (ax, ay, az), (bx, by, bz) = pr['p0'], pr['p1']; w = max(pr['w'], .12)
            a = (ax + dx * (az - gz), ay + dy * (az - gz)); b = (bx + dx * (bz - gz), by + dy * (bz - gz))
            out.append([cam.p(a[0], a[1] - w, gz), cam.p(a[0], a[1] + w, gz), cam.p(b[0], b[1] + w, gz), cam.p(b[0], b[1] - w, gz)])
            continue
        elif t == 'tri':
            if not lines: continue
            out.append([cam.p(q[0] + dx * (q[2] - gz), q[1] + dy * (q[2] - gz), gz) for q in pr['pts']])
            continue
        else:
            continue
        if h <= .05: continue
        if t == 'prism':   # auch fuer nicht konvexe Grundflaechen richtig: Grundflaeche, verschobene Flaeche und Kanten-Vierecke
            sh = [(x + dx * h, y + dy * h) for x, y in base]
            out.append([cam.p(x, y, gz) for x, y in sh])
            for i in range(len(base)):
                j = (i + 1) % len(base)
                out.append([cam.p(*base[i], gz), cam.p(*base[j], gz), cam.p(*sh[j], gz), cam.p(*sh[i], gz)])
            continue
        pts = list(base) + [(x + dx * h, y + dy * h) for x, y in base]
        out.append([cam.p(x, y, gz) for x, y in hull2d(pts)])
    return out

def hull2d(pts):
    pts = sorted(set((round(x, 5), round(y, 5)) for x, y in pts))
    if len(pts) < 3: return pts
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

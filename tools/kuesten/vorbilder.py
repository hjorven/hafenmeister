#!/usr/bin/env python3
"""Baut die Küsten 11 bis 15 aus echten Karten- und Höhendaten.

Je Vorbild: Ort des Hafens (Breite, Länge), Blickrichtung des Hafens zur See (Kompassgrad) und Maßstab
(Meter in der Wirklichkeit je Planeinheit im Spiel). Daraus entsteht in Spielkoordinaten (Hafen bei 0,0,
See in +y):
  - eine Land/Wasser-Maske im 5er-Raster über die ganze Welt (natur.js WELT), aus den Kacheln der Esri-Karte
    "World Light Gray Base" (Wasserflächen haben dort eine eigene Farbe),
  - Geländehöhen im 20er-Raster aus den offenen Höhenkacheln "Terrarium" (Mapzen/AWS, SRTM und andere).
Ergebnis: web/js/data/kuesten-vorbilder.js (erzeugt, nicht von Hand ändern) und Vorschaubilder.

Aufruf:  python3 tools/kuesten/vorbilder.py [--vorschau ORDNER] [--cache ORDNER]
Braucht Netz zu server.arcgisonline.com und s3.amazonaws.com sowie Pillow und numpy.
Quellen: Karte Esri, HERE, Garmin, OpenStreetMap-Mitwirkende; Höhen Mapzen Terrain Tiles (u. a. SRTM, EU-DEM).
"""
import base64, io, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw

HIER = os.path.dirname(os.path.abspath(__file__))
ZIEL = os.path.join(HIER, '..', '..', 'web', 'js', 'data', 'kuesten-vorbilder.js')
WELT = dict(x0=-1300, x1=1300, y0=-800, y1=1300)   # wie natur.js
S = 5        # Raster der Maske in Planeinheiten
SH = 20      # Raster der Höhen
PLAN_M = 0.62

# nr, Name, Ort, Breite, Länge, Blick (Kompassgrad, wohin der Hafen schaut), Meter je Planeinheit
VORBILDER = [
    dict(nr=11, id='marstrand', ort='Marstrand, Schweden', lat=57.8848, lon=11.5851, blick=90, m=0.4),
    dict(nr=12, id='punat', ort='Punat, Krk, Kroatien', lat=45.0265, lon=14.6315, blick=265, m=1.2),
    dict(nr=13, id='shilshole', ort='Shilshole Bay, Seattle, USA', lat=47.6815, lon=-122.4055, blick=290, m=1.1),
    dict(nr=14, id='kotor', ort='Tivat, Bucht von Kotor, Montenegro', lat=42.433, lon=18.6915, blick=265, m=7.0),
    dict(nr=15, id='portocervo', ort='Porto Cervo, Sardinien, Italien', lat=41.1348, lon=9.533, blick=20, m=0.5),
]

R = 6378137.0
def merc(lat, lon):
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

def holen(url, cache, name):
    pfad = os.path.join(cache, name)
    if not os.path.exists(pfad):
        req = urllib.request.Request(url, headers={'User-Agent': 'kuesten-werkzeug'})
        with urllib.request.urlopen(req, timeout=60) as r: daten = r.read()
        with open(pfad, 'wb') as f: f.write(daten)
    return pfad

def bauen(v, cache):
    mx, my = merc(v['lat'], v['lon'])
    k = 1 / math.cos(math.radians(v['lat']))          # Mercator-Meter je echtem Meter
    a = math.radians(v['blick'])
    # Spiel (px, py) -> Mercator: +y des Spiels zeigt in Blickrichtung, +x nach rechts davon
    def welt(px, py):
        ost = (px * math.cos(a) + py * math.sin(a)) * v['m'] * k
        nord = (-px * math.sin(a) + py * math.cos(a)) * v['m'] * k
        return mx + ost, my + nord
    # --- Karte: Kacheln der hellgrauen Grundkarte, Zoom passend zum Maßstab (höchstens 16)
    zk = max(9, min(16, int(math.ceil(math.log2(156543.03 * math.cos(math.radians(v['lat'])) / (S * v['m'] / 2))))))
    karten = {}
    def ist_wasser(X, Y):
        n = 2 ** zk
        fx = (X / (2 * math.pi * R) + 0.5) * n; fy = (0.5 - Y / (2 * math.pi * R)) * n
        tx, ty = int(fx), int(fy)
        if (tx, ty) not in karten:
            p = holen(f'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{zk}/{ty}/{tx}', cache, f'karte-{zk}-{tx}-{ty}.jpg')
            t = np.asarray(Image.open(p).convert('RGB')).astype(int)
            r, b = t[..., 0], t[..., 2]
            karten[(tx, ty)] = (r > 196) & (r < 222) & (b - r >= 1)    # Wasser: helles Blaugrau; Land fast weiß, Schrift dunkel
        t = karten[(tx, ty)]
        return t[min(255, int((fy - ty) * 256)), min(255, int((fx - tx) * 256))]
    nx = (WELT['x1'] - WELT['x0']) // S + 1; ny = (WELT['y1'] - WELT['y0']) // S + 1
    land = np.zeros((ny, nx), dtype=np.uint8)
    for j in range(ny):
        for i in range(nx):
            # 3 x 3 Proben je Zelle, Mehrheit
            n = 0
            for dy in (-1.6, 0, 1.6):
                for dx in (-1.6, 0, 1.6):
                    X, Y = welt(WELT['x0'] + i * S + dx, WELT['y0'] + j * S + dy)
                    n += 0 if ist_wasser(X, Y) else 1
            land[j, i] = 1 if n >= 5 else 0
    # Beschriftungen der Karte im Wasser und Bildrauschen entfernen: Landflecken unter 60 Zellen und
    # Wasserflecken unter 30 Zellen verschwinden (echte Inseln und Teiche sind größer)
    def flecken(wert, mindest):
        gesehen = np.zeros_like(land, dtype=bool)
        for j0 in range(ny):
            for i0 in range(nx):
                if gesehen[j0, i0] or land[j0, i0] != wert: continue
                stapel = [(j0, i0)]; gesehen[j0, i0] = True; zellen = []
                while stapel:
                    j, i = stapel.pop(); zellen.append((j, i))
                    for jj, ii in ((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)):
                        if 0 <= jj < ny and 0 <= ii < nx and not gesehen[jj, ii] and land[jj, ii] == wert:
                            gesehen[jj, ii] = True; stapel.append((jj, ii))
                if len(zellen) < mindest:
                    for j, i in zellen: land[j, i] = 1 - wert
    # Stege, Piers und schmale Molen der Karte entfernen (die baut das Spiel selbst): Land, das schmaler als
    # drei Zellen ist, verschwindet (erst abtragen, dann wieder auftragen)
    def nachbarn(f, alle):
        e = np.pad(f, 1, mode='edge'); teile = [e[1 + dj:1 + dj + ny, 1 + di:1 + di + nx] for dj in (-1, 0, 1) for di in (-1, 0, 1)]
        return np.minimum.reduce(teile) if alle else np.maximum.reduce(teile)
    land[:] = nachbarn(nachbarn(land, True), False)
    flecken(1, 60); flecken(0, 30)
    # --- Höhen: Terrarium-Kacheln, Zoom passend zum Maßstab
    ziel = SH * v['m'] / 2
    z = max(8, min(14, int(math.floor(math.log2(156543.03 * math.cos(math.radians(v['lat'])) / ziel)))))
    kacheln = {}
    def hoehe(X, Y):
        n = 2 ** z
        fx = (X / (2 * math.pi * R) + 0.5) * n; fy = (0.5 - Y / (2 * math.pi * R)) * n
        tx, ty = int(fx), int(fy)
        if (tx, ty) not in kacheln:
            p = holen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png', cache, f'terr-{z}-{tx}-{ty}.png')
            t = np.asarray(Image.open(p).convert('RGB')).astype(float)
            kacheln[(tx, ty)] = t[..., 0] * 256 + t[..., 1] + t[..., 2] / 256 - 32768
        t = kacheln[(tx, ty)]
        return t[min(255, int((fy - ty) * 256)), min(255, int((fx - tx) * 256))]
    hx = (WELT['x1'] - WELT['x0']) // SH + 1; hy = (WELT['y1'] - WELT['y0']) // SH + 1
    hoch = np.zeros((hy, hx))
    for j in range(hy):
        for i in range(hx):
            X, Y = welt(WELT['x0'] + i * SH, WELT['y0'] + j * SH)
            hoch[j, i] = max(0, hoehe(X, Y))
    # Höhe im Spielmaßstab: waagerecht ist die Welt um m / 0.62 gestaucht, senkrecht genauso (höchstens 110 m)
    stauch = v['m'] / PLAN_M
    spiel = hoch / stauch
    faktor = min(1.0, 110 / max(1.0, spiel.max()))
    spiel = np.clip(np.round(spiel * faktor * 2), 0, 255).astype(np.uint8)   # halbe Meter
    return dict(land=land, hoehe=spiel, nx=nx, ny=ny, hx=hx, hy=hy, max_echt=float(hoch.max()), max_spiel=float(spiel.max() / 2))

def packen(bits):
    return base64.b64encode(np.packbits(bits.reshape(-1)).tobytes()).decode()

def main():
    arg = sys.argv[1:]
    vorschau = arg[arg.index('--vorschau') + 1] if '--vorschau' in arg else None
    cache = arg[arg.index('--cache') + 1] if '--cache' in arg else os.path.join(HIER, '.cache')
    os.makedirs(cache, exist_ok=True)
    teile = []
    nur = arg[arg.index('--nur') + 1].split(',') if '--nur' in arg else None
    for v in VORBILDER:
        if nur and v['id'] not in nur: continue
        d = bauen(v, cache)
        print(f"{v['nr']} {v['ort']}: Land {d['land'].mean() * 100:.0f} %, höchster Punkt {d['max_echt']:.0f} m, im Spiel {d['max_spiel']:.0f} m")
        teile.append(
            f"  {v['nr']}: {{ id: '{v['id']}', ort: {json.dumps(v['ort'], ensure_ascii=False)}, lat: {v['lat']}, lon: {v['lon']}, blick: {v['blick']}, meterJeEinheit: {v['m']},\n"
            f"    s: {S}, nx: {d['nx']}, ny: {d['ny']}, sh: {SH}, hx: {d['hx']}, hy: {d['hy']},\n"
            f"    land: '{packen(d['land'])}',\n"
            f"    hoehe: '{base64.b64encode(d['hoehe'].tobytes()).decode()}' }},\n")
        if vorschau:
            os.makedirs(vorschau, exist_ok=True)
            h = np.kron(d['hoehe'], np.ones((SH // S, SH // S)))[:d['ny'], :d['nx']] / 2
            rgb = np.zeros((d['ny'], d['nx'], 3), dtype=np.uint8)
            rgb[...] = (60, 110, 170)
            t = np.clip(h / max(8.0, h.max()), 0, 1)[..., None]
            farbe = (np.array([150, 185, 120]) * (1 - t) + np.array([120, 100, 80]) * t).astype(np.uint8)
            m = d['land'] == 1
            rgb[m] = farbe[m]
            bild = Image.fromarray(rgb[::-1]); zeich = ImageDraw.Draw(bild)
            P = lambda x, y: ((x - WELT['x0']) / S, (WELT['y1'] - y) / S)
            zeich.rectangle((*P(-400, 600), *P(440, 245)), outline=(255, 255, 255))      # Reede (Pflicht-See)
            zeich.rectangle((*P(-150, 110), *P(-16, 6)), outline=(230, 30, 30))          # Stege
            zeich.rectangle((*P(-150, 6), *P(202, -92)), outline=(240, 200, 60))         # Ort
            zeich.ellipse((P(0, 0)[0] - 4, P(0, 0)[1] - 4, P(0, 0)[0] + 4, P(0, 0)[1] + 4), fill=(230, 30, 30))
            bild.save(os.path.join(vorschau, f"{v['nr']}-{v['id']}.png"))
    kopf = ("// ERZEUGT von tools/kuesten/vorbilder.py, nicht von Hand ändern.\n"
            "// Küsten 11 bis 15 aus echten Karten: Land/Wasser-Maske (Bits, zeilenweise ab y0, 1 = Land) und Höhen\n"
            "// (ein Byte je Zelle, halbe Meter im Spielmaßstab) in Spielkoordinaten, Hafen bei (0, 0), See in +y.\n"
            "// Quellen: Karte Esri World Light Gray Base (Esri, HERE, Garmin, OpenStreetMap-Mitwirkende);\n"
            "// Höhen Mapzen Terrain Tiles (SRTM, EU-DEM und andere offene Daten).\n"
            f"export const VORBILD_WELT = {{ x0: {WELT['x0']}, x1: {WELT['x1']}, y0: {WELT['y0']}, y1: {WELT['y1']} }};\n"
            "export const VORBILDER = {\n")
    if nur: return   # nur ansehen, Datei bleibt
    with open(ZIEL, 'w', encoding='utf-8') as f: f.write(kopf + ''.join(teile) + '};\n')
    print('geschrieben:', os.path.normpath(ZIEL), os.path.getsize(ZIEL) // 1024, 'KB')

if __name__ == '__main__':
    main()

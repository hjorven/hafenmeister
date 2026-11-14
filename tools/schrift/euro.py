"""Ersetzt das Euro-Zeichen in den Pixelify-Sans-Schnitten (web/fonts/) durch ein deutlicheres Pixel-Euro.

Pixelify zeichnet das Euro als geschlossene Form, die klein wie eine 8 aussieht ("11.682 8").
Hier wird es aus Rechtecken neu gebaut: ein offenes C mit zwei Querbalken links, Strichstärke
aus dem Schnitt selbst (linker Stamm der 8). Einmal ausführen, Ergebnis committen:

    python3 tools/schrift/euro.py

Braucht: pip install fonttools brotli. Ist das Euro schon ersetzt (Merkmal in der name-Tabelle), passiert nichts.
"""
import pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

ORDNER = pathlib.Path(__file__).resolve().parents[2] / 'web' / 'fonts'
MERKMAL = 'Hafenmeister: Euro neu'


def stamm(font):
    """Linker Stamm und obere/untere Balkenhöhe der 8 dieses Schnitts."""
    p = RecordingPen()
    font.getGlyphSet()['eight'].draw(p)
    pts = [a[0] for op, a in p.value if op in ('moveTo', 'lineTo')]
    xs = sorted({x for x, _ in pts})
    ys = sorted({y for _, y in pts})
    # aeussere Kontur: x0 (ganz links), Innenraum beginnt beim kleinsten x der zweiten Kontur
    zweite = []
    start = 0
    konturen = []
    for op, a in p.value:
        if op == 'moveTo':
            konturen.append([a[0]])
        elif op == 'lineTo':
            konturen[-1].append(a[0])
    innen = konturen[1]
    ix0 = min(x for x, _ in innen)
    iy0 = min(y for _, y in innen)
    return xs[0], ix0, ys[0], ys[-1], iy0


def rechteck(pen, x0, y0, x1, y1):
    # im Uhrzeigersinn (TrueType-Außenkontur)
    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()


def neu(font):
    x0, ix0, yu, yo, iy0 = stamm(font)
    sv = ix0 - x0                  # Stärke senkrecht
    sh = iy0 - yu                  # Stärke waagerecht (unterer Balken der 8)
    ecke = 89                      # ein Pixel abgeschnittene Ecke wie bei Pixelify
    rechts = 536
    links = x0 + ecke              # das C rückt ein Pixel nach rechts, Platz für die Querbalken
    pen = TTGlyphPen(None)
    rechteck(pen, links, yu + ecke, links + sv, yo - ecke)              # Stamm
    rechteck(pen, links + ecke, yo - sh, rechts, yo)                    # oben
    rechteck(pen, links + ecke, yu, rechts, yu + sh)                    # unten
    mitte = (yu + yo) / 2
    dick = max(60, round(sh * 0.62))
    lx = max(0, x0 - 40)
    rx = links + sv + 150
    rechteck(pen, lx, round(mitte + 30), rx, round(mitte + 30 + dick))  # oberer Querbalken
    rechteck(pen, lx, round(mitte - 30 - dick), rx, round(mitte - 30))  # unterer Querbalken
    g = pen.glyph()
    g.flags = [f | 0x40 if i == 0 else f for i, f in enumerate(g.flags)]   # OVERLAP_SIMPLE
    return g


for datei in sorted(ORDNER.glob('pixelify-sans-latin-*-normal.woff2')):
    font = TTFont(datei)
    namen = font['name']
    if any(MERKMAL in str(r) for r in namen.names):
        print(datei.name, 'schon ersetzt')
        continue
    name = font.getBestCmap()[0x20AC]
    font['glyf'][name] = neu(font)
    font['glyf'][name].recalcBounds(font['glyf'])
    font['hmtx'][name] = (font['hmtx']['eight'][0], font['glyf'][name].xMin)
    namen.setName(MERKMAL, 5, 3, 1, 0x409)   # in die Versionszeile
    font.flavor = 'woff2'
    font.save(datei)
    print(datei.name, 'Euro ersetzt')

"""Liegeplaetze und Stege aus der Draufsicht als Spieldaten exportieren.

Quelle ist skripte/konzeptbilder/hafen_von_oben.py. Das Skript zeichnet den Hafen fuer jede
Ausbaustufe einmal (ohne Bilder zu speichern), schreibt dabei jeden Liegeplatz und jeden Steg mit
und legt das Ergebnis als ES-Modul in web/js/data/harbor.js ab. Aendert sich das Layout in der
Zeichnung, reicht ein erneuter Aufruf.

Aufruf (aus dem Repo-Wurzelverzeichnis):
    python3 skripte/liegeplaetze_export.py            # web/js/data/harbor.js neu schreiben
    python3 skripte/liegeplaetze_export.py --pruefen  # nur pruefen, ob die Datei aktuell ist

Braucht Pillow und numpy (wie die Zeichnung).
"""
import sys, math, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'skripte' / 'konzeptbilder'))
import hafen_von_oben as hv   # noqa: E402

ZIEL = ROOT / 'web' / 'js' / 'data' / 'harbor.js'
STUFEN = [1, 2, 3, 4, 5, 6]
# Mehrere Haefen: jeder Hafen bekommt eine eigene Datei mit eigener id. Dieser ist der erste.
HAFEN_ID, HAFEN_NAME, REGION = 'nehrung', 'Hafen an der Nehrung', 'ostsee'
K = hv.K                       # Faktor, mit dem die Zeichnung Meterangaben in Planeinheiten umrechnet
M = 0.62                       # Meter je Planeinheit, wie Massstab der Zeichnung und web/js/main.js
TOL = 0.5                      # rueckt ein Platz zwischen zwei Stufen um weniger als eine halbe Boxbreite, bleibt es derselbe Platz

STEGE = {
    'A': 'Steg A', 'B': 'Steg B', 'C': 'Hauptsteg C', 'CS': 'Stichsteg', 'D': 'Schwimmsteg D',
    'F': 'Fischersteg', 'K': 'Kai', 'FK': 'Fischereikai',
    'P': 'Kreuzfahrtpier', 'MA': 'Marineanleger', 'SK': 'Seenotkreuzer',
}
# Stufe 6: Grossschiffe (Klasse XXL). Art und Steg haengen am gezeichneten Schiff.
XXL_ART = {'cruise': ('pier', 'P'), 'navy': ('marine', 'MA'), 'tall': ('marine', 'MA'), 'srk': ('seenotretter', 'SK')}
# Hoechstmasse je Platzart laut docs/hafen-und-schiffe.md, Abschnitt 2 (Laenge, Breite in m)
MAXMASS = {
    ('box', 'S'): (6.0, 2.4), ('box', 'M'): (9.0, 3.2), ('box', 'L'): (14.0, 4.5),
    ('finger', 'L'): (14.0, 4.5), ('stirn', 'M'): (14.0, 7.5), ('stirn', 'L'): (14.0, 7.5),
    ('kai', 'XL'): (40.0, 8.0), ('fischer', 'M'): (9.0, 3.2), ('fischer', 'L'): (14.0, 4.5),
    # Stufe 6, abgestimmt mit dem XL/XXL-Thread (web/js/data/boats/xxl.js)
    ('pier', 'XXL'): (182.0, 30.0), ('marine', 'XXL'): (92.0, 14.0), ('seenotretter', 'XXL'): (48.0, 11.0),
}


def steg_von(p0, p1):
    """Welcher Steg? Nach Lage der Segmentmitte, damit kleine Layoutaenderungen nichts kaputt machen."""
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    waagerecht = abs(p1[0] - p0[0]) > abs(p1[1] - p0[1])
    if my > 200 and mx < -250: return 'MA'      # Marinepier (Stufe 6)
    if my > 200 and mx < -60: return 'P'        # Grossschiffspier (Stufe 6)
    if my > 200 and mx > 160: return None      # Seenotretter
    if my > 200: return 'FK' if mx < 0 else 'K'
    if mx < -125: return 'F'
    if mx < -85: return 'A'
    if mx < -30: return 'B'
    if mx < 80: return 'CS' if (waagerecht and min(p0[0], p1[0]) > 0) else 'C'
    return 'D'


def art_von(steg):
    if steg == 'K': return 'kai'
    if steg in ('F', 'FK'): return 'fischer'
    return 'stirn'      # laengsseits an einem T-Kopf oder Stegende


class Mitschnitt(hv.Harbor):
    """Harbor, der zusaetzlich die Geometrie jedes Platzes und Stegs festhaelt."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k); self.plaetze = []; self.dienste = []; self.kaikanten = []

    def boxes(self, p0, p1, side, cls, a0=5.0, a1=3.0, jw=2.4, fingers=False):
        L, t, n = hv.frame(p0, p1); bl, bb, bw = hv.SIZE[cls]; jwk = jw * K
        k = int((L - a0 - a1) / bw)
        off = a0 + ((L - a0 - a1) - k * bw) / 2 if k > 0 else 0
        steg = steg_von(p0, p1)
        for i in range(max(k, 0)):
            a = off + (i + .5) * bw; r = jwk / 2 + bl / 2
            c = (p0[0] + t[0] * a + side * n[0] * r, p0[1] + t[1] * a + side * n[1] * r)
            bug = (-side * n[0], -side * n[1])       # Bug zeigt zum Steg
            self.plaetze.append(dict(steg=steg, klasse=cls, art='finger' if fingers else 'box', c=c, bug=bug,
                                     laenge=bl, breite=bw))
        super().boxes(p0, p1, side, cls, a0, a1, jw, fingers)

    def along(self, p0, p1, side, items, jw=2.4, cls='L', gap=4.0, start=2.0, scale_jw=True):
        if cls != 'T':   # Tankstelle und Seenotretter sind keine Liegeplaetze
            L, t, n = hv.frame(p0, p1); a = start; jwk = jw * K if scale_jw else jw
            steg = steg_von(p0, p1)
            if cls == 'XXL': steg = None
            if steg in ('K', 'FK'):   # Kai und Fischereikai haben keine Steglinie in der Zeichnung
                self.kaikanten.append(dict(steg=steg, bauart='kai', breite=0.0, punkte=[list(p0), list(p1)]))
            for (kind, Lb, Bb, _col, _present) in items:
                Lb, Bb = Lb * K, Bb * K; r = jwk / 2 + .8 + Bb / 2
                c = (p0[0] + t[0] * (a + Lb / 2) + side * n[0] * r, p0[1] + t[1] * (a + Lb / 2) + side * n[1] * r)
                art, st = XXL_ART[kind] if cls == 'XXL' else (art_von(steg), steg)
                self.plaetze.append(dict(steg=st, klasse=cls, art=art, c=c, bug=t,
                                         laenge=Lb, breite=Bb))
                a += Lb + gap
        else:            # Dienstplaetze: Tankstelle, Seenotretter
            L, t, n = hv.frame(p0, p1); a = start; jwk = jw * K if scale_jw else jw
            for (_kind, Lb, Bb, _col, _present) in items:
                Lb, Bb = Lb * K, Bb * K; r = jwk / 2 + .8 + Bb / 2
                c = (p0[0] + t[0] * (a + Lb / 2) + side * n[0] * r, p0[1] + t[1] * (a + Lb / 2) + side * n[1] * r)
                art = 'seenotretter' if c[1] > 200 else 'tankstelle'
                self.dienste.append(dict(art=art, x=r1(c[0]), y=r1(c[1]), richtung=round(math.degrees(math.atan2(t[1], t[0]))) % 360,
                                         laenge=r1(Lb), breite=r1(Bb)))
                a += Lb + gap
        super().along(p0, p1, side, items, jw, cls, gap, start, scale_jw)


def stufe_aufnehmen(stufe):
    """Zeichnet eine Stufe und gibt Harbor-Mitschnitt und Tiefenraster zurueck."""
    fang = {}
    def profil(frame, event, arg):
        if event == 'return' and frame.f_code is hv.render.__code__:
            fang['depI'] = frame.f_locals['depI']; fang['H'] = frame.f_locals['H_']
    alt = hv.Harbor; hv.Harbor = Mitschnitt; sys.setprofile(profil)
    try:
        _img, zaehl = hv.render(stufe)
    finally:
        sys.setprofile(None); hv.Harbor = alt
    return fang['H'], fang['depI'], zaehl


def tiefe(depI, c, bug, laenge):
    """Kleinste Wassertiefe auf der Mittellinie des Platzes (m)."""
    werte = []
    for f in (-.35, 0.0, .35):
        x, y = c[0] + bug[0] * laenge * f, c[1] + bug[1] * laenge * f
        px, py = hv.P(x, y)
        werte.append(float(depI[min(depI.shape[0] - 1, max(0, int(py))), min(depI.shape[1] - 1, max(0, int(px)))]))
    return round(min(werte), 1)


def r1(v): return round(v + 0.0, 1)


def exportieren():
    plaetze = []        # stufenuebergreifend
    stufen = {}
    for s in STUFEN:
        H, depI, zaehl = stufe_aufnehmen(s)
        ids = []
        for p in H.plaetze:
            treffer, best = None, TOL * p['breite']
            for q in plaetze:
                if (s - 1) in q['_stufen'] and s not in q['_stufen'] and q['steg'] == p['steg'] and q['klasse'] == p['klasse'] \
                        and q['art'] == p['art'] and math.dist(q['_c'], p['c']) < best:
                    treffer, best = q, math.dist(q['_c'], p['c'])
            if treffer is None:
                treffer = dict(steg=p['steg'], klasse=p['klasse'], art=p['art'], _nr=len(plaetze), _stufen=[], tiefe={}, lage={})
                plaetze.append(treffer)
            treffer.update(_c=p['c'], _bug=p['bug'], _laenge=p['laenge'], _breite=p['breite'])
            treffer['lage'][str(s)] = [r1(p['c'][0]), r1(p['c'][1]), round(math.degrees(math.atan2(p['bug'][1], p['bug'][0]))) % 360]
            treffer['_stufen'].append(s)
            treffer['tiefe'][s] = tiefe(depI, p['c'], p['bug'], p['laenge'])
            ids.append(treffer)
        stege = []
        for pts, kind, wm in H.lines:
            if kind == 'finger': continue
            st = steg_von(pts[0], pts[-1])
            if pts[0][1] > 170 and st not in ('P', 'MA'): st = None                # Tankstelle, Seenotretter
            if 140 < pts[0][0] < 170 and pts[0][1] < 30: st = None     # Travellift-Becken
            stege.append(dict(steg=st, bauart={'float': 'schwimmsteg', 'pier': 'pier'}.get(kind, 'holz'),
                              breite=r1(wm / K), punkte=[[r1(x), r1(y)] for x, y in pts]))
        for kk in H.kaikanten:
            stege.append(dict(kk, punkte=[[r1(x), r1(y)] for x, y in kk['punkte']]))
        if len(set(map(id, ids))) != len(ids):
            raise SystemExit(f'Stufe {s}: zwei Plaetze auf denselben Vorgaenger abgebildet')
        stufen[s] = dict(ids=ids, zaehl={k: v for k, v in zaehl.items()}, stege=stege, dienste=H.dienste)
        n = sum(zaehl.values())
        if n != len(ids):
            raise SystemExit(f'Stufe {s}: Zeichnung zaehlt {n} Plaetze, Export {len(ids)}')

    # IDs: je Steg fortlaufend, nach erster Stufe, dann Lage am Steg
    proSteg = {}
    for q in sorted(plaetze, key=lambda q: (q['_stufen'][0], q['steg'], q['_nr'])):
        proSteg[q['steg']] = proSteg.get(q['steg'], 0) + 1
        q['id'] = f"{q['steg']}{proSteg[q['steg']]:02d}"

    aus_plaetze = []
    for q in sorted(plaetze, key=lambda q: (list(STEGE).index(q['steg']), q['id'])):
        ml, mb = MAXMASS[(q['art'], q['klasse'])]
        aus_plaetze.append(dict(
            id=q['id'], steg=q['steg'], klasse=q['klasse'], art=q['art'],
            laenge=r1(q['_laenge']), breite=r1(q['_breite']),
            maxLaenge=ml, maxBreite=mb,
            stufen=q['_stufen'], lage=q['lage'], tiefe={str(k): v for k, v in q['tiefe'].items()}))
    aus_stufen = {}
    for s, d in stufen.items():
        aus_stufen[str(s)] = dict(
            name=hv.TITLES[s][0].split(': ', 1)[1],
            anzahl={k: v for k, v in d['zaehl'].items() if v} | {'gesamt': len(d['ids'])},
            plaetze=sorted(q['id'] for q in d['ids']),
            stege=d['stege'],
            dienste=d['dienste'])
    return dict(
        format=1,
        id=HAFEN_ID, name=HAFEN_NAME, region=REGION,
        quelle='skripte/konzeptbilder/hafen_von_oben.py',
        einheiten=dict(meterProEinheit=M, x='nach Osten', y='nach Norden', wasserlinie=0,
                       richtung='Grad, 0 = Osten, 90 = Norden, zeigt wohin der Bug zeigt'),
        stege=STEGE,
        plaetze=aus_plaetze,
        stufen=aus_stufen)


KOPF = """// Hafenmeister: Liegeplaetze und Stege je Ausbaustufe.
// ERZEUGT von skripte/liegeplaetze_export.py aus skripte/konzeptbilder/hafen_von_oben.py.
// Nicht von Hand aendern, sondern das Layout in der Zeichnung aendern und neu exportieren:
//   python3 skripte/liegeplaetze_export.py
//
// Koordinaten in Planeinheiten (1 Einheit = 0,62 m, wie in web/js/main.js), x nach Osten,
// y nach Norden.
// plaetze[]: ein Eintrag je Liegeplatz ueber alle Stufen. Liegt ein Platz in zwei Stufen an
//   derselben Stelle, behaelt er seine id. stufen = in welchen Stufen es ihn gibt.
//   lage[n]     [x, y, richtung] in Stufe n: Mitte des Platzes und Grad, wohin der Bug zeigt
//               (0 = Osten, 90 = Norden; bei Boxen zum Steg hin). Ein Ausbau kann einen Platz
//               um bis zu eine halbe Boxbreite verschieben, er behaelt dabei seine id.
//   laenge,     Groesse des Platzes in der Zeichnung (Planeinheiten, letzte Stufe). Bei Boxen
//   breite      die Box, laengsseits die Flaeche des gezeichneten Boots.
//   maxLaenge,  Hoechstmasse fuer Boote in Metern (docs/hafen-und-schiffe.md, Abschnitt 2)
//   maxBreite
//   tiefe       Wassertiefe in Metern je Stufe (kleinster Wert auf der Mittellinie)
//   art         box (Heckpfaehle), finger (Schwimmsteg mit Fingern), stirn (laengsseits am
//               T-Kopf oder Stegende), kai (XL im Aussenhafen), fischer (fest vergeben),
//               ab Stufe 6 (Klasse XXL): pier (Kreuzfahrtpier), marine (Marineanleger),
//               seenotretter (fester Platz des stationierten Seenotrettungskreuzers)
// stufen[n].stege[]: Steglinien zum Zeichnen und Antippen (ohne Fingerstege). steg = null bei
//   Dienststegen (Tankstelle, Seenotretter, Travellift). Kai und Fischereikai: bauart kai, die
//   Linie ist die Kante, an der die Schiffe liegen.
// stufen[n].dienste[]: Plaetze fuer Dienste (Tankstelle, Seenotretter), keine Liegeplaetze.
// id, region: Kennung dieses Hafens. Weitere Haefen (andere Regionen) liefern dieselbe Form
//   in eigenen Dateien mit eigener id.
//
// 3D: Die Daten liegen in der Wasserebene (Hoehe 0 = Wasserlinie). In der 3D-Szene des
// Grundgeruests (Meter, y nach oben, Norden = -z) gilt: 3D-x = x * 0.62, 3D-z = -y * 0.62,
// Drehung um die Hochachse = richtung in Grad (gegen den Uhrzeigersinn von oben gesehen).
// Erweiterbar: neue Platzarten (z. B. Kreuzfahrtanleger) bekommen eine neue art und Klasse,
// neue Felder werden nur angehaengt; format zaehlt hoch, wenn sich Bedeutungen aendern.
"""

HILFEN = '''
// Plan -> Spielwelt (Meter, x Osten, z Sueden, y oben), siehe docs/grundgeruest.md.
export function inWelt(x, y) {
  const m = HAFEN.einheiten.meterProEinheit;
  return { x: x * m, z: -y * m };
}

// Lage eines Platzes in Stufe n in der Spielwelt. winkel in Bogenmass fuer
// object.rotation.y, wenn das Bootsmodell mit dem Bug nach +x gebaut ist.
// Gibt null zurueck, wenn es den Platz in dieser Stufe nicht gibt.
export function platzInWelt(platz, stufe) {
  const l = platz.lage[String(stufe)];
  if (!l) return null;
  const p = inWelt(l[0], l[1]);
  return { x: p.x, z: p.z, winkel: l[2] * Math.PI / 180 };
}

// Alle Plaetze einer Stufe.
export function plaetzeInStufe(stufe) {
  return HAFEN.plaetze.filter((p) => p.stufen.includes(stufe));
}
'''


# Stegbild dieses Spiels (Variante der Stege A, B, C, CS, D) einsetzen, bevor ein Modul HAFEN liest.
# Siehe docs/stegbilder.md. Ohne Browser (Node, Tests) bleibt das Grundbild.
STEGBILD = '''
// Stegbild dieses Spiels einsetzen (docs/stegbilder.md). Ohne Browser bleibt das Grundbild.
stegbildAnwenden(HAFEN);
'''


def als_js(daten):
    return (KOPF + "\nimport { stegbildAnwenden } from './stegbild.js';\n"
            + '\nexport const HAFEN = ' + json.dumps(daten, ensure_ascii=False, indent=1) + ';\n'
            + STEGBILD + HILFEN + '\nexport default HAFEN;\n')


if __name__ == '__main__':
    text = als_js(exportieren())
    if '--pruefen' in sys.argv:
        if not ZIEL.exists() or ZIEL.read_text(encoding='utf-8') != text:
            print(f'{ZIEL.relative_to(ROOT)} ist veraltet. Neu erzeugen mit: python3 skripte/liegeplaetze_export.py')
            sys.exit(1)
        print(f'{ZIEL.relative_to(ROOT)} ist aktuell.')
    else:
        ZIEL.parent.mkdir(parents=True, exist_ok=True)
        ZIEL.write_text(text, encoding='utf-8')
        print(f'{ZIEL.relative_to(ROOT)} geschrieben.')

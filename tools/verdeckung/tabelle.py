#!/usr/bin/env python3
# Tabelle Vorher/Nachher aus zwei Messungen: python3 tools/verdeckung/tabelle.py (im Ordner mit vorher/ und nachher/)
import json, sys
v = json.load(open('vorher/messung.json'))
n = json.load(open('nachher/messung.json'))
G = ['handy', 'handy-quer', 'tablet', 'tablet-quer', 'pc']
GN = {'handy': 'Handy hoch', 'handy-quer': 'Handy quer', 'tablet': 'Tablet hoch', 'tablet-quer': 'Tablet quer', 'pc': 'PC'}
NAMEN = {
 'grund': 'Grundansicht (nichts offen)', 'dauer-hinweis': 'Dauerplatz-Hinweis', 'tagesziel-wahl': 'Tagesziel wählen (drei Karten)',
 'tagesziel-laufend': 'Tagesziel offen (nach der Wahl)', 'stufenziel': 'Ausbau-Ziel offen', 'wetter': 'Wetter offen', 'menue': 'Menü',
 'einstellungen': 'Einstellungen', 'spielstand': 'Spielstand', 'hilfe': 'Hilfe', 'tastenhilfe': 'Maus und Tastatur', 'gaestebuch': 'Gästebuch',
 'tagesabschluss': 'Tagesabschluss', 'bauen': 'Baumenü', 'bootskarte': 'Bootskarte', 'aufstieg': 'Aufstieg (Feier)', 'winter': 'Winterpause',
 'kombi-wahl+boot': 'Kombi: Kartenwahl + Bootskarte', 'kombi-ziel+boot': 'Kombi: Tagesziel offen + Bootskarte',
 'kombi-stufe+boot': 'Kombi: Ausbau offen + Bootskarte', 'kombi-bauen+ziel': 'Kombi: Tagesziel offen + Baumenü'}
def w(d, g, s):
    x = d.get(g, {}).get(s, {})
    return x.get('prozent')
out = ['| Menü | ' + ' | '.join(GN[g] for g in G) + ' |', '|---|' + '---|' * len(G)]
for s in NAMEN:
    zellen = []
    for g in G:
        a, b = w(v, g, s), w(n, g, s)
        if a is None and b is None: zellen.append('-'); continue
        if a is not None and b is not None and abs(a - b) >= 1: zellen.append(f'{a:.0f} → **{b:.0f}**')
        else: zellen.append(f'{(b if b is not None else a):.0f}')
    out.append(f'| {NAMEN[s]} | ' + ' | '.join(zellen) + ' |')
print('\n'.join(out))

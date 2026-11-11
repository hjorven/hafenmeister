"""Grobe Wirtschaftssimulation zum Spielplan (docs/plan.md, Abschnitt 6).

Ein Spieler, der immer das Sinnvollste kauft, ohne Stuerme und ohne Vorspulen. 40 Durchlaeufe.
Aufruf: python3 balance.py
"""
import random, statistics, sys, json
from collections import deque

BASE_FEE = {"S": 10, "M": 20, "L": 40, "XL": 100}
ORDER = ["S", "M", "L"]
# Steg: (Plaetze, groesste Klasse, Kosten fuer diese Stufe)
JETTY = {1: (4, "S", 150), 2: (6, "M", 300), 3: (8, "L", 1200), 4: (10, "L", 4000)}
JETTY_SLOTS = {1: 1, 2: 3, 3: 4, 4: 5, 5: 5}
JETTY_MAXLVL = {1: 1, 2: 2, 3: 3, 4: 4, 5: 4}
# Einrichtungen: Stufe -> (Kapazitaet, Kosten)
FAC = {
 "wc":     {1: (6, 80),   2: (15, 400),  3: (30, 1800), 4: (60, 6000)},
 "dusche": {1: (6, 200),  2: (15, 700),  3: (30, 2500), 4: (60, 8000)},
 "essen":  {1: (8, 500),  2: (20, 1500), 3: (45, 6000)},
 "diesel": {1: (10, 3000), 2: (25, 8000)},
}
FAC_STAGE = {"wc": 1, "dusche": 2, "essen": 2, "diesel": 4}
FAC_MAXLVL = {  # hoechste Stufe je Ausbaustufe
 "wc": {1: 1, 2: 2, 3: 3, 4: 4, 5: 4}, "dusche": {2: 2, 3: 3, 4: 4, 5: 4},
 "essen": {2: 1, 3: 2, 4: 3, 5: 3}, "diesel": {4: 1, 5: 2}}
OFFICE = {1: 600, 2: 2000, 3: 5000}; OFFICE_STAGE = {1: 2, 2: 3, 3: 3}
MOLE = {1: 1500, 2: 4000, 3: 9000}; MOLE_STAGE = {1: 3, 2: 4, 3: 5}
KAI = {1: (2, 18000), 2: (4, 40000)}
ARRIVALS = {1: 3, 2: 7, 3: 11, 4: 15, 5: 19}
MIX = {1: {"S": 1}, 2: {"S": .6, "M": .4}, 3: {"S": .35, "M": .4, "L": .25},
       4: {"S": .25, "M": .4, "L": .35}, 5: {"S": .2, "M": .35, "L": .35, "XL": .1}}
WISHES = {1: ["wc"], 2: ["wc", "dusche", "essen"], 3: ["wc", "dusche", "essen", "strom"],
          4: ["wc", "dusche", "essen", "strom", "diesel"], 5: ["wc", "dusche", "essen", "strom", "diesel"]}
NWISH = {1: (0, 1), 2: (1, 2), 3: (1, 3), 4: (1, 3), 5: (2, 3)}
GOAL = {1: (25, 2.5, 400), 2: (150, 3.0, 3000), 3: (500, 3.5, 14000), 4: (1300, 4.0, 45000)}

def run(seed):
    rnd = random.Random(seed)
    money, stage, day = 0, 1, 0
    jetties = [1]; fac = {k: 0 for k in FAC}; office = 0; mole = 0; kai = 0
    boats = []; rep = deque([3.0] * 5, maxlen=20); guests = 0
    stage_day = {}; done_day = None
    while day < 600:
        day += 1
        r = statistics.mean(rep)
        n_exp = ARRIVALS[stage] * (0.5 + 0.25 * (r - 1)) * (1.3 if mole >= 3 else 1)
        n = int(n_exp) + (1 if rnd.random() < n_exp - int(n_exp) else 0)
        # freie Plaetze je Klasse
        cap = {"S": 0, "M": 0, "L": 0, "XL": KAI[kai][0] if kai else 0}
        for lv in jetties: cap[JETTY[lv][1]] += JETTY[lv][0]
        used = {"S": 0, "M": 0, "L": 0, "XL": 0}
        for b in boats: used[b["berth"]] += 1
        turned = 0
        for _ in range(n):
            size = rnd.choices(list(MIX[stage]), weights=list(MIX[stage].values()))[0]
            lo, hi = NWISH[stage]
            ws = rnd.sample(WISHES[stage], min(rnd.randint(lo, hi), len(WISHES[stage])))
            fits = ["XL"] if size == "XL" else ORDER[ORDER.index(size):]
            berth = next((c for c in fits if used[c] < cap[c]), None)
            if berth is None:
                turned += 1
                if rnd.random() < 0.3: rep.append(2.0)
                continue
            used[berth] += 1
            boats.append({"size": size, "berth": berth, "nights": rnd.randint(1, 3), "w": ws, "ok": 0, "tot": 0})
        # Abend: Wuensche pruefen, kassieren
        left = {k: (FAC[k][fac[k]][0] if fac[k] else 0) for k in FAC}
        unmet = {k: 0 for k in list(FAC) + ["strom"]}
        for b in boats:
            ok = 0
            for w in b["w"]:
                if w == "strom":
                    good = b["berth"] in ("L", "XL")  # Strom gibt es ab Schwimmsteg und am Kai
                else:
                    good = left[w] > 0
                    if good: left[w] -= 1
                ok += good; unmet[w] += (not good)
            b["ok"] += ok; b["tot"] += len(b["w"])
            money += BASE_FEE[b["size"]] * (1 + 0.25 * ok)
            b["nights"] -= 1
        for b in [b for b in boats if b["nights"] <= 0]:
            sat = 4.0 if b["tot"] == 0 else 1 + 4 * b["ok"] / b["tot"]
            rep.append(sat); guests += 1
        boats = [b for b in boats if b["nights"] > 0]
        # Einkaeufe (einfacher Spieler)
        r = statistics.mean(rep)
        for _ in range(4):
            if stage < 5 and guests >= GOAL[stage][0] and r >= GOAL[stage][1]:
                if money >= GOAL[stage][2]:
                    money -= GOAL[stage][2]; stage += 1; stage_day[stage] = day
                    continue
                break  # sparen
            opts = []
            for k in FAC:
                if stage >= FAC_STAGE[k] and unmet[k] > 0 and fac[k] < FAC_MAXLVL[k][stage]:
                    opts.append((FAC[k][fac[k] + 1][1], "fac", k))
            if turned > 0 or unmet["strom"] > 0:
                if len(jetties) < JETTY_SLOTS[stage]: opts.append((JETTY[1][2], "newjetty", None))
                low = min(jetties)
                if low < JETTY_MAXLVL[stage]: opts.append((JETTY[low + 1][2], "upjetty", None))
                if stage == 5 and kai < 2: opts.append((KAI[kai + 1][1], "kai", None))
            if not opts:
                if office < 3 and stage >= OFFICE_STAGE[office + 1]: opts.append((OFFICE[office + 1] * 1.5, "office", None))
                if mole < 3 and stage >= MOLE_STAGE[mole + 1]: opts.append((MOLE[mole + 1] * 1.5, "mole", None))
            opts = [o for o in opts if o[0] <= money]
            if not opts: break
            cost, kind, k = min(opts, key=lambda o: o[0])
            if kind == "fac": fac[k] += 1; money -= cost
            elif kind == "newjetty": jetties.append(1); money -= cost
            elif kind == "upjetty": jetties[jetties.index(min(jetties))] += 1; money -= cost
            elif kind == "kai": kai += 1; money -= cost
            elif kind == "office": office += 1; money -= cost / 1.5
            elif kind == "mole": mole += 1; money -= cost / 1.5
        if stage == 5 and kai == 2 and r >= 4.75 and done_day is None:
            done_day = day; break
    return stage_day, done_day, guests, round(statistics.mean(rep), 2), stage, jetties, fac, kai

res = [run(s) for s in range(40)]
for st in (2, 3, 4, 5):
    d = [r[0][st] for r in res if st in r[0]]
    print(f"Stufe {st} erreicht an Tag: Median {statistics.median(d):.0f} (min {min(d)}, max {max(d)}), {len(d)}/40 Laeufe")
d = [r[1] for r in res if r[1]]
print(f"Ziel (5 Anker, Kai 2) an Tag: Median {statistics.median(d) if d else 'nie'} ({len(d)}/40 Laeufe)", (min(d), max(d)) if d else "")
print("Beispiel:", res[0])

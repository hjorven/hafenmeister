// Härtetest (docs/extremtest.md): die Extremlagen.
// Jede Lage: id, titel, was (ein Satz für den Bericht), adresse (Testadresse ohne testtempo),
// lauf(t) mit dem Werkzeugkasten aus lauf.cjs:
//   t.ex(name, ...args)    Helfer aus helfer.cjs im Browser aufrufen
//   t.beobachte(s, o)      s Sekunden Echtzeit laufen lassen, dabei prüfen und Bilder machen
//                          o: { bild: alle n s ein Bild (Standard 10), probe: alle n s prüfen (Standard 3), ui: false }
//   t.foto(label)          ein Bild der ganzen Seite
//   t.uebersicht()         Kamera auf den ganzen Hafen
//   t.speichernLaden(why)  speichern, neu laden, vergleichen (Abweichungen sind Funde)
//   t.laden(adresse)       Seite neu laden (gleicher Browser-Speicher)
//   t.fund(art, text), t.hinweis(text), t.messe(name, wert)
//   t.page, t.geraet, t.touch, t.kurz (true bei --kurz: alle Zeiten gedrittelt)

const dauer = (t, s) => Math.max(10, Math.round(t.kurz ? s / 3 : s));

const LAGEN = [
  {
    id: 'viele-boote',
    titel: '60 Boote auf einmal',
    was: 'Stufe 6, 60 Gastboote kommen innerhalb von 40 Spielsekunden von See, dazu der normale Verkehr. Bojen voll, Selbst-Einfahren, Abweisen.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      const n = await t.ex('boote', 60, 40);
      t.messe('eingeplante Boote', n);
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 150), { bild: 12 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'bojen-erreichbar',
    titel: 'Erreichen Gäste sichtbar eine Boje?',
    was: 'Je Stufe 2 bis 6 ein normaler Spieltag ohne Eingriff: Wie viele Boote der Warteschlange liegen sichtbar an einer Boje, wie viele fahren bei Andrang direkt aus der Anfahrt ein, wie viele nichts davon? Fund, wenn mehr als ein Viertel nichts davon tut oder kein Boot an einer Boje liegt.',
    adresse: '',
    varianten: (t) => (t.kurz ? [2, 5] : [2, 3, 4, 5, 6]).map((n) => ({ name: `stufe-${n}`, extra: `?stufe=${n}` })),
    async lauf(t) {
      // Je Boot der Warteschlange das Ergebnis: sichtbar an einer Boje, bei Andrang direkt aus der Anfahrt
      // in die Box (sim.js selfEnter: mehr als die Hälfte der Bojen vergeben, Absicht seit PR 280), am Ende
      // noch unterwegs, oder nichts davon (ohne Boje zugewiesen, weitergefahren oder verschwunden).
      await t.page.evaluate(() => { const G = window.hafenmeister; const a = window.__boje = { ank: new Set(), boje: new Set(), selbst: new Set(), versteckt: 0 };
        G.on('sim:arrived', (e) => { if (!e.direct) a.ank.add(e.boatId); });
        G.on('boot:an-boje', (e) => a.boje.add(e.id));
        G.on('sim:selfEntered', (e) => a.selbst.add(e.boatId));
        G.onTick(() => { a.versteckt = Math.max(a.versteckt, G.boatAnim.boats.filter((x) => x.versteckt).length); }); });
      await t.beobachte(dauer(t, 60), { bild: 20 });
      const r = await t.page.evaluate(() => {
        const a = window.__boje; const st = window.hafenmeister.sim.state; const ank = [...a.ank];
        const anBoje = ank.filter((i) => a.boje.has(i));
        const direkt = ank.filter((i) => !a.boje.has(i) && a.selbst.has(i));
        const unterwegs = ank.filter((i) => !a.boje.has(i) && !a.selbst.has(i) && st.boats[i]?.status === 'waiting');
        return { ankommen: ank.length, sichtbarAnBoje: anBoje.length, direktBeiAndrang: direkt.length, nochUnterwegs: unterwegs.length,
          ohneBoje: ank.length - anBoje.length - direkt.length - unterwegs.length, selbstEingefahren: a.selbst.size, hoechstensUnsichtbarDraussen: a.versteckt };
      });
      t.messe('Bojen', r);
      // Fund: Boote, die weder an einer Boje lagen noch bei Andrang direkt einfuhren noch unterwegs sind
      // (P87: die alte Regel "weniger als die Hälfte an der Boje" zählte die gewollte Andrang-Einfahrt mit)
      const fertig = r.ankommen - r.nochUnterwegs;
      if (fertig >= 6 && r.ohneBoje > fertig / 4) t.fund('boje', `${r.ohneBoje} von ${fertig} Booten der Warteschlange lagen nie sichtbar an einer Boje und fuhren auch nicht bei Andrang direkt ein`);
      if (fertig >= 6 && r.sichtbarAnBoje === 0) t.fund('boje', `kein Boot von ${fertig} lag sichtbar an einer Boje (${r.direktBeiAndrang} direkt bei Andrang)`);
    },
  },
  {
    id: 'voll-sturm',
    titel: 'Voller Hafen bei Sturm',
    was: 'Stufe 6, alle 98 Plätze belegt, Sturm. Liegende Boote bleiben in ihren Boxen, nichts treibt durch Stege, Leinen bleiben am Boot.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      t.messe('belegt', await t.ex('fuellen', true));
      t.messe('ereignis', await t.ex('ereignis', 'sturm', 2));
      await t.ex('boote', 20, 60);
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 120), { bild: 12 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'alle-einfahren',
    titel: 'Alle fahren gleichzeitig ein',
    was: 'Stufe 6, für jede freie Box ein Boot, alle bekommen im selben Augenblick ihren Platz und fahren los.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      t.messe('zugewiesen', await t.ex('fuellen', false));
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 180), { bild: 12 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'alle-ablegen',
    titel: 'Alle legen gleichzeitig ab',
    was: 'Stufe 6, voller Hafen, am nächsten Morgen reisen alle Gäste in einem Fenster von wenigen Spielsekunden ab.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      t.messe('belegt', await t.ex('fuellen', true));
      t.messe('reisen ab', await t.ex('allesAblegen'));
      t.messe('morgen', await t.ex('naechsterMorgen'));
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 180), { bild: 12 });
      await t.ex('fensterZurueck');
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'paeckchen-voll',
    titel: 'Päckchen im vollen Hafen',
    was: 'Voller Hafen, an jeden möglichen Päckchenplatz fährt im selben Augenblick ein Boot längsseits (P27); am nächsten Morgen reisen alle fast gleichzeitig ab, außen vor innen. Kein Rumpf berührt Stege, Land oder andere Boote. Funde mit den Booten aus "päckchen.boote" gehen aufs Päckchen.',
    adresse: '?services=alle',
    varianten: (t) => (t.kurz ? [3] : [2, 3, 4, 6]).map((n) => ({ name: `stufe-${n}`, extra: `&stufe=${n}` })),
    async lauf(t) {
      t.messe('belegt', await t.ex('fuellen', true));
      const p = await t.ex('paeckchenFuellen', false);
      t.messe('päckchen', p);
      if (!p.belegt) t.hinweis('kein Päckchenplatz frei');
      // Tempo 1: Anlegen und eine Nacht genau ansehen (Testtempo 8 allein sind schon mehrere Spieltage je Minute)
      await t.ex('tempo', 1);
      await t.beobachte(dauer(t, 15), { bild: 5, probe: 2 });
      t.messe('außen fest', await t.ex('paeckchenZahl'));
      await t.beobachte(dauer(t, 30), { bild: 6, probe: 2 });
      t.messe('außen nach der Nacht', await t.ex('paeckchenZahl'));
      t.messe('reisen ab', await t.ex('allesAblegen'));
      t.messe('morgen', await t.ex('naechsterMorgen'));
      await t.beobachte(dauer(t, 45), { bild: 6, probe: 2 });
      await t.ex('fensterZurueck');
      t.messe('außen danach', await t.ex('paeckchenZahl'));
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'grossschiffe-eng',
    titel: 'Großschiffe in engem Gelände',
    was: 'Stufe 6 mit allen Services, alle Großschiff-Besuche (Kreuzfahrt, Windjammer, Flotte) am selben Tag, in Bodden, Schären, Förde und Inselhafen.',
    adresse: '?stufe=6&services=alle',
    varianten: (t) => (t.kurz ? [8] : [4, 5, 8, 10]).map((g) => ({ name: `gelaende-${g}`, extra: `&gelaende=${g}&seed=${g * 7}` })),
    async lauf(t) {
      t.messe('besuche', await t.ex('grossschiffeMorgen'));
      await t.ex('fuellen', true, 0.6);
      t.messe('morgen', await t.ex('naechsterMorgen'));
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 120), { bild: 15 });
    },
  },
  {
    id: 'gelaende-alle',
    titel: 'Alle Küstentypen und Stegbilder',
    was: 'Jeder Küstentyp mit eigenem Seed und wechselndem Stegbild, Stufe 4 mit 30 Booten: nichts über Land, nichts durch Stege, Menschen an Land.',
    adresse: '?stufe=4',
    varianten: (t) => {
      const out = [];
      const n = t.kuesten; const sb = t.stegbilder;
      for (let g = 1; g <= n; g++) out.push({ name: `kueste-${g}`, extra: `&gelaende=${g}&seed=${g * 13 + 1}&stegbild=${(g - 1) % sb}` });
      // Restliche Stegbilder auf Küste 1
      for (let s = n; s < sb; s++) out.push({ name: `stegbild-${s}`, extra: `&gelaende=1&seed=5&stegbild=${s}` });
      return t.kurz ? out.slice(0, 3) : out;
    },
    async lauf(t) {
      await t.ex('fuellen', true, 0.5);
      await t.ex('boote', 30, 60);
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 75), { bild: 35 });
    },
  },
  {
    id: 'tempo8-lang',
    titel: 'Tempo 8x lange',
    was: 'Neues Spiel ab Tag 1, über den Knopf "Achtfach vorspulen", lange laufen lassen (ohne Testtempo): Tage, Abende, Rundgang, Tagesabschluss.',
    adresse: '',
    echteZeit: true,
    async lauf(t) {
      const knopf = t.page.locator('.hm-tempo-knopf[aria-label*="Achtfach"], .hm-tempo-knopf[title*="Achtfach"]').first();
      if (await knopf.count()) await (t.touch ? knopf.tap() : knopf.click()); else await t.ex('tempo', 8);
      t.messe('tempo nach Knopf', (await t.ex('zustand')).tempo);
      await t.beobachte(dauer(t, t.minuten8 * 60), { bild: 30, probe: 5, abschluss: true });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'speichern-gewusel',
    titel: 'Speichern und Laden mitten im Gewusel',
    was: 'Stufe 6 als echter Spielstand, voller Hafen und 40 Boote unterwegs; dreimal mitten in der Bewegung speichern und neu laden.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      await t.ex('fuellen', true, 0.7);
      await t.ex('echterSpielstand');
      for (let i = 1; i <= 3; i++) {
        await t.ex('boote', 25, 30);
        await t.ex('tempo', 3);
        await t.beobachte(dauer(t, 30), { bild: 15 });
        await t.speichernLaden(`Runde ${i}`);
        await t.beobachte(dauer(t, 25), { bild: 12 });
      }
    },
  },
  {
    id: 'bauen-belegt',
    titel: 'Bauen bei belegten Plätzen',
    was: 'Stufe 4 und 5, voller Hafen und Boote in Fahrt: alle offenen Stegprojekte, Hafenbüro, Bauwerke und Services werden auf einmal gebaut. Abreißen gibt es im Spiel nicht.',
    adresse: '',
    varianten: () => [{ name: 'stufe-4', extra: '?stufe=4' }, { name: 'stufe-5', extra: '?stufe=5' }],
    async lauf(t) {
      t.messe('belegt', await t.ex('fuellen', true));
      await t.ex('boote', 20, 20);
      await t.ex('geld', 5e6);
      await t.ex('tempo', 3);
      await t.beobachte(10, { bild: 0 });
      const gebaut = await t.page.evaluate(() => {
        const G = window.hafenmeister; const S = G.sim; const r = S.ctx.rules; const out = [];
        for (const p of S.openJettyProjects()) out.push(['steg ' + p.id, S.buildJettyProject(p.id).ok]);
        for (let i = 0; i < 4; i++) if (r.office.cost[S.state.office + 1] != null) out.push(['büro', S.upgradeOffice().ok]);
        for (const k of Object.keys(r.facilities || {})) for (let i = 0; i < 4; i++) { const u = S.facilityUpgrade(k); if (u?.available) out.push([k, S.upgradeFacility(k).ok]); }
        for (const x of G.services?.liste?.() ?? []) { const p = G.services.pruefe(x.id); if (p?.freigeschaltet && !p.fertig) out.push(['service ' + x.id, !!G.services.bauen(x.id)?.ok]); }
        return out;
      });
      t.messe('gebaut', gebaut.map(([k, ok]) => `${k}${ok ? '' : ' (abgelehnt)'}`).join(', '));
      await t.beobachte(dauer(t, 120), { bild: 15 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'ereignisse-uebereinander',
    titel: 'Ereignisse übereinander',
    was: 'Sturm läuft, Regatta angekündigt, Hanse-Woche geplant, Nebel-Nachspiel offen, alles am selben Tag; danach drei Tage durchlaufen.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      await t.ex('fuellen', true, 0.6);
      t.messe('ereignisse', await t.ex('uebereinander'));
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 40), { bild: 10 });
      for (let i = 0; i < 3; i++) {
        t.messe(`morgen ${i + 1}`, await t.ex('naechsterMorgen'));
        await t.beobachte(dauer(t, 35), { bild: 12 });
      }
    },
  },
  {
    id: 'winterwechsel',
    titel: 'Winterwechsel mit vollem Hafen',
    was: 'Echter Spielstand Stufe 4, voller Hafen und wartende Boote am letzten Saisontag; Wechsel in den Winter, Winter überspringen, Frühling.',
    adresse: '?stufe=4',
    async lauf(t) {
      await t.ex('fuellen', true);
      await t.ex('echterSpielstand');
      await t.ex('boote', 12, 20);
      await t.ex('tempo', 3);
      await t.beobachte(15, { bild: 0 });
      t.messe('letzter Saisontag', await t.ex('saisonEnde'));
      t.messe('erster Wintertag', await t.ex('naechsterMorgen'));
      await t.beobachte(dauer(t, 40), { bild: 10, ui: false });
      t.messe('winter', await t.ex('zustand'));
      const ueber = t.page.locator('#hm-winter .hm-knopf', { hasText: 'Winter überspringen' });
      // Anhalten, damit der Winter bei Testtempo nicht unter dem Finger von selbst endet
      await t.page.evaluate(() => window.hafenmeister.setPaused(true));
      if (await ueber.isVisible().catch(() => false)) {
        await ueber.scrollIntoViewIfNeeded().catch(() => {});
        await (t.touch ? ueber.tap({ timeout: 10000 }) : ueber.click({ timeout: 10000 }));
        t.messe('Winter überspringen', 'geklickt');
      } else if ((await t.ex('zustand')).winter) t.fund('ui', 'Knopf "Winter überspringen" im Winter nicht sichtbar');
      else t.hinweis('Winter war schon vorbei, bevor der Knopf gedrückt werden konnte');
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 60), { bild: 12 });
      t.messe('frühling', await t.ex('zustand'));
      await t.speichernLaden('nach dem Winter');
    },
  },
  {
    id: 'versorgung-voll',
    titel: 'Viele Menschen an der Versorgung',
    was: 'Stufe 6, alle Services, voller Hafen am Abend: alle Crews gehen an Land zu WC, Dusche, Kiosk und Gastro; Rundgang des Hafenmeisters.',
    adresse: '?stufe=6&services=alle',
    async lauf(t) {
      await t.ex('fuellen', true);
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 90), { bild: 15 });
      // Abend: Uhr kurz vor das Tagesende stellen
      await t.page.evaluate(() => { const S = window.hafenmeister.sim; S.state.clock = Math.max(S.state.clock, S.ctx.rules.dayLength - 5); });
      await t.beobachte(dauer(t, 90), { bild: 15 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'geld-extrem',
    titel: 'Geld 0 und sehr viel',
    was: 'Stufe 3: Geld auf 0 (Bauen, Tagesziele, Kassieren), dann auf 999.999.999 und 10^12 (Anzeige, Baumenü, nichts läuft über).',
    adresse: '?stufe=3',
    async lauf(t) {
      await t.ex('fuellen', true, 0.5);
      for (const v of [0, 999999999, 1e12]) {
        t.messe(`geld ${v}`, await t.ex('geld', v));
        await t.beobachte(8, { bild: 0 });
        await t.foto(`Geld ${v.toLocaleString('de-DE')}`);
        const bau = t.page.locator('#btn-build');
        if (await bau.isVisible().catch(() => false)) {
          await (t.touch ? bau.tap() : bau.click());
          await t.page.waitForTimeout(1200);
          await t.foto(`Baumenü bei ${v.toLocaleString('de-DE')} €`, { ui: false });
          await t.schliessen();
        }
        const breite = await t.page.evaluate(() => { const e = document.querySelector('#money'); if (!e) return null; const r = e.getBoundingClientRect(); return { breite: Math.round(r.width), scroll: e.scrollWidth > e.clientWidth + 1, text: e.innerText.trim(), rechts: Math.round(r.right), vw: innerWidth }; });
        t.messe(`Geldanzeige ${v}`, breite);
        if (breite?.scroll) t.fund('ui', `Geldanzeige läuft über bei ${v}: "${breite.text}"`);
      }
      await t.ex('geld', 0);
      await t.ex('tempo', 3);
      await t.beobachte(dauer(t, 60), { bild: 20 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
  {
    id: 'menues-alle',
    titel: 'Alle Menüs nacheinander und übereinander',
    was: 'Jede Tafel aus Menü und Leiste öffnen, Verdeckung messen, schließen; dann mehrere übereinander. Am Handy der wichtigste Teil.',
    adresse: '?stufe=4',
    async lauf(t) { await t.menues(); },
  },
  {
    id: 'schwache-fps',
    titel: 'Schwaches Gerät',
    was: 'Stufe 6 mit 40 Booten, Rechenleistung per CPU-Drossel auf ein Sechstel, Tempo 8x: Spielzeit läuft weiter, Boote springen nicht über Land, Knöpfe reagieren.',
    adresse: '?stufe=6&services=alle',
    echteZeit: true,
    async lauf(t) {
      await t.ex('fuellen', true, 0.6);
      await t.ex('boote', 40, 40);
      const cdp = await t.page.context().newCDPSession(t.page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await t.ex('tempo', 8);
      await t.beobachte(dauer(t, 90), { bild: 20, probe: 6 });
      // Reagiert der Pause-Knopf noch? Zeit vom Tippen bis zur Pause
      const knopf = t.page.locator('#btn-pause');
      if (await knopf.isVisible().catch(() => false)) {
        const t0 = Date.now();
        await (t.touch ? knopf.tap() : knopf.click());
        await t.page.waitForFunction(() => window.hafenmeister.paused, null, { timeout: 20000 }).catch(() => {});
        const ms = Date.now() - t0;
        t.messe('Pause reagiert nach ms', ms);
        // Nur Hinweis: im Container mit Software-Grafik ist die Drossel viel härter als auf einem echten schwachen Handy
        if (ms > 3000) t.hinweis(`Pause-Knopf reagiert erst nach ${ms} ms bei gedrosselter CPU (Software-Grafik, siehe Grenzen)`);
        await t.ex('tempo', 8);
      }
      await t.beobachte(dauer(t, 30), { bild: 15, probe: 6 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      t.messe('danach', await t.ex('zustand'));
    },
  },
];

module.exports = { LAGEN };

// P61: Three.js liegt im Spiel selbst. Prueft ohne Browser, dass keine Seite in web/ mehr auf ein
// CDN zeigt, dass jede Importmap auf vorhandene Dateien zeigt und dass die Kopie zur Version in
// tests/package.json passt (Aktualisieren: Version dort aendern, dann bash tools/three-holen.sh).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'package.json'), 'utf8')).devDependencies.three;
const VENDOR = path.join(WEB, 'vendor', `three-${VERSION}`);

function dateien(dir, endung) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'vendor' ? [] : dateien(p, endung);
    return p.endsWith(endung) ? [p] : [];
  });
}

test('Three.js liegt in der Version aus tests/package.json in web/vendor/', () => {
  for (const rel of ['build/three.module.js', 'build/three.core.js', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(VENDOR, rel)), `web/vendor/three-${VERSION}/${rel} fehlt (bash tools/three-holen.sh)`);
  }
  const andere = fs.readdirSync(path.join(WEB, 'vendor')).filter((n) => n.startsWith('three-') && n !== `three-${VERSION}`);
  assert.deepEqual(andere, [], 'alte Three.js-Ordner in web/vendor/ (bash tools/three-holen.sh raeumt auf)');
});

test('Die Kopie ist unveraendert gleich dem npm-Paket', { skip: !fs.existsSync(path.join(ROOT, 'tests/node_modules/three')) }, () => {
  const npm = path.join(ROOT, 'tests/node_modules/three');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(VENDOR)) {
    const rel = path.relative(VENDOR, f);
    assert.ok(fs.readFileSync(f).equals(fs.readFileSync(path.join(npm, rel))), `${rel} weicht vom npm-Paket ab`);
  }
});

test('Keine Seite und kein Modul in web/ laedt von einem CDN', () => {
  const cdn = /https?:\/\/(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|esm\.sh|cdn\.skypack\.dev)\//;
  for (const f of [...dateien(WEB, '.html'), ...dateien(WEB, '.js'), ...dateien(WEB, '.css')]) {
    // Kommentare im Service Worker duerfen CDNs erwaehnen, Code nicht
    const text = fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!cdn.test(text), `${path.relative(ROOT, f)} verweist auf ein CDN`);
  }
});

test('Jede Importmap zeigt auf die mitgelieferten Dateien', () => {
  const seiten = dateien(WEB, '.html').filter((f) => fs.readFileSync(f, 'utf8').includes('"three"'));
  assert.ok(seiten.some((f) => f.endsWith(path.join('web', 'index.html'))), 'web/index.html hat keine Importmap mit three');
  for (const f of seiten) {
    const map = JSON.parse(fs.readFileSync(f, 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    const dir = path.dirname(f);
    // Importmap-Ziele muessen mit ./ oder ../ beginnen, sonst ignoriert der Browser sie (null)
    for (const [k, v] of Object.entries(map.imports)) {
      assert.match(v, /^\.\.?\//, `${path.relative(ROOT, f)}: Importmap "${k}" muss mit ./ oder ../ beginnen`);
    }
    const kern = path.resolve(dir, map.imports.three);
    assert.equal(kern, path.join(VENDOR, 'build', 'three.module.js'), `${path.relative(ROOT, f)}: "three" zeigt nicht auf web/vendor/three-${VERSION}`);
    const addons = map.imports['three/addons/'];
    if (addons) assert.equal(path.resolve(dir, addons), path.join(VENDOR, 'examples', 'jsm'), `${path.relative(ROOT, f)}: "three/addons/" falsch`);
  }
});

test('Jedes eingebundene Zusatzmodul ist mitgeliefert', () => {
  const benutzt = new Set();
  for (const f of [...dateien(WEB, '.js'), ...dateien(WEB, '.html')]) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"]three\/addons\/([^'"]+)['"]/g)) benutzt.add(m[1]);
  }
  for (const rel of benutzt) {
    assert.ok(fs.existsSync(path.join(VENDOR, 'examples', 'jsm', rel)), `three/addons/${rel} fehlt in web/vendor (bash tools/three-holen.sh)`);
  }
});

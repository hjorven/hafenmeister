"""Rendert die Stilvorschauen: python3 run.py [stil ...]

Ohne Argument werden alle zehn Stile gerendert, je einmal fuer Stufe 1 und fuer die Maximalstufe.
Die Bilder landen im Ordner out/ neben diesem Skript. Braucht Pillow, numpy und scipy.
"""
import sys, time, importlib, pathlib
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import scene as S

def main():
    which = sys.argv[1:] or None
    styles = {}
    for m in ('styles_a', 'styles_b', 'styles_c'):
        styles.update(importlib.import_module(m).STYLES)
    out = HERE / 'out'; out.mkdir(exist_ok=True)
    scenes = [('1', S.scene_stage1()), ('max', S.scene_max())]
    for name, fn in styles.items():
        if which and name not in which: continue
        for tag, sc in scenes:
            t = time.time(); img = fn(sc); img.save(out / f'{name}_{tag}.png')
            print(f'{name}_{tag}: {img.size} in {time.time() - t:.1f}s')

if __name__ == '__main__':
    main()

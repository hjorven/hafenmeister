# Zehn Stile im Vergleich

Dieselbe Hafenszene aus derselben festen Kamera, einmal als Stufe 1 (Badesteg) und einmal als Maximalstufe. Die Bilder sind per Code gezeichnete Illustrationen, keine Screenshots aus dem Spiel. Der Aufwand im Spiel ist geschätzt.

**Entscheidung:** Flat Vector.

![Alle zehn Stile](uebersicht.jpg)

| Nr | Stil | Wirkung | Aufwand im Spiel | Passt zum 2D/3D-Mix |
|---|---|---|---|---|
| 01 | Low Poly | kantige Flächen, facettiertes Wasser | leicht | ja, reines 3D |
| 02 | Flat Vector | Pastellflächen, lange Schatten, sehr ruhig | leicht | ja |
| 03 | Seekarte mit Modellen | 3D-Modelle stehen auf einer gezeichneten Karte | leicht bis mittel | am besten, das ist der Mix |
| 04 | Papier-Cutout | Papierlagen mit Schatten, gewellte Wasserschichten | mittel | ja |
| 05 | Holzspielzeug | Grundfarben, Holzmaserung, Spielbrett mit Rahmen | leicht bis mittel | ja |
| 06 | Pixel Art | grobe Pixel, begrenzte Palette | mittel bis schwer | nein, alles 2D |
| 07 | Voxel | alles aus Würfeln | mittel | ja, reines 3D |
| 08 | Aquarell mit Tusche | verlaufende Farben, unruhige Linien | schwer | nur als 2D-Bilder |
| 09 | Blaupause | weiße Linien auf Blau, Maßlinien, Beschriftung | leicht | ja |
| 10 | Linoldruck | drei Druckfarben, geschnittene Wellen, Schraffur | schwer | nur mit Shader |

## Die Bilder einzeln

| Stil | Stufe 1 | Maximalstufe |
|---|---|---|
| 01 Low Poly | ![](bilder/01-low-poly-stufe-1.png) | ![](bilder/01-low-poly-max.png) |
| 02 Flat Vector | ![](bilder/02-flat-vector-stufe-1.png) | ![](bilder/02-flat-vector-max.png) |
| 03 Seekarte mit Modellen | ![](bilder/03-seekarte-stufe-1.jpg) | ![](bilder/03-seekarte-max.jpg) |
| 04 Papier-Cutout | ![](bilder/04-papier-cutout-stufe-1.jpg) | ![](bilder/04-papier-cutout-max.jpg) |
| 05 Holzspielzeug | ![](bilder/05-holzspielzeug-stufe-1.png) | ![](bilder/05-holzspielzeug-max.png) |
| 06 Pixel Art | ![](bilder/06-pixel-art-stufe-1.png) | ![](bilder/06-pixel-art-max.png) |
| 07 Voxel | ![](bilder/07-voxel-stufe-1.jpg) | ![](bilder/07-voxel-max.jpg) |
| 08 Aquarell mit Tusche | ![](bilder/08-aquarell-stufe-1.jpg) | ![](bilder/08-aquarell-max.jpg) |
| 09 Blaupause | ![](bilder/09-blaupause-stufe-1.jpg) | ![](bilder/09-blaupause-max.jpg) |
| 10 Linoldruck | ![](bilder/10-linoldruck-stufe-1.jpg) | ![](bilder/10-linoldruck-max.jpg) |

## Neu rendern

```bash
pip install pillow numpy scipy
cd skripte/konzeptbilder
python3 run.py
```

Die Bilder landen in `skripte/konzeptbilder/out/`. Mit `python3 run.py flat` wird nur ein Stil gerendert.

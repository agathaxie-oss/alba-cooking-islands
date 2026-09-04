# -*- coding: utf-8 -*-
"""Vygeneruje favicon.ico z téže geometrie jako favicon.svg.

Safari SVG favicony ignoruje, takže vedle nich musí stát klasické .ico —
tenhle skript ho vyrobí, aby se obě podoby nemohly rozejít omylem: geometrie
je tu opsaná z favicon.svg jako JEDINÁ tabulka bodů. Kdo mění tvar nebo tah,
mění ho na OBOU stranách (viz komentář v favicon.svg).

Kreslí se přes osminásobný supersampling a teprve pak zmenšuje — PIL sám
antialiasing čar neumí a bez toho by hrany v 16 px byly zubaté.

Spuštění z kořene projektu:  python tools/gen-favicon-ico.py
"""

from PIL import Image, ImageDraw

BRAND = (0, 131, 198, 255)   # #0083C6, Pantone 7461 C
VIEWBOX = 32.0               # stejná soustava jako favicon.svg
STROKE = 2.0                 # tah ve VIEWBOX jednotkách — držet shodný s SVG
SS = 8                       # supersampling
SIZES = (16, 32, 48, 64)     # co se uloží do .ico

# Body opsané z favicon.svg (souřadnice ve VIEWBOX jednotkách).
OUTLINE = [(16, 4), (27, 10), (27, 22), (16, 28), (5, 22), (5, 10)]
INNER = [
    [(5, 10), (16, 16), (27, 10)],   # horní stěna: dvě hrany sbíhající se ve středu
    [(16, 16), (16, 28)],            # svislá hrana dopředu
]


def render(size):
    """Jedna vrstva ikonky ve výsledné velikosti `size` px, s průhledným pozadím."""
    big = size * SS
    scale = big / VIEWBOX
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    width = max(1, round(STROKE * scale))

    def pts(seq):
        return [(x * scale, y * scale) for x, y in seq]

    # Obrys se kreslí jako uzavřená lomená čára (ne polygon) — chceme jen tah.
    draw.line(pts(OUTLINE + [OUTLINE[0]]), fill=BRAND, width=width, joint='curve')
    for seq in INNER:
        draw.line(pts(seq), fill=BRAND, width=width, joint='curve')

    # PIL nekreslí zakončení čar kulatě, takže konce a lomy dorovnáme kotouči —
    # bez toho jsou v místech setkání hran viditelné zuby.
    r = width / 2.0
    for x, y in {p for seq in INNER + [OUTLINE] for p in seq}:
        cx, cy = x * scale, y * scale
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND)

    return img.resize((size, size), Image.LANCZOS)


def main():
    # POZOR: `append_images` u ICO v Pillow neprojde — zapsalo by se jen první
    # vrstvy (ověřeno: soubor měl 666 B a jediný záznam 16×16). Správná cesta
    # je podat JEDEN obrázek ve vysokém rozlišení a nechat vrstvy odvodit
    # parametrem `sizes`.
    master = render(max(SIZES) * 4)
    # bitmap_format='bmp' — Pillow by jinak uložil vrstvy jako PNG-v-ICO.
    # Kvůli Safari (jediný důvod, proč .ico vůbec vzniká) volíme klasický BMP
    # zápis: čte ho úplně každý, a soubor zůstane v řádu jednotek kB.
    master.save('favicon.ico', format='ICO', sizes=[(s, s) for s in SIZES],
                bitmap_format='bmp')
    print('favicon.ico zapsan, vrstvy:', ', '.join(f'{s}x{s}' for s in SIZES))


if __name__ == '__main__':
    main()

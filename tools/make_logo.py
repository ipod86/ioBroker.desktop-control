#!/usr/bin/env python3
"""Erzeugt das Logo von ioBroker.desktop-control (Variante M2: Kacheln = Bildschirm).

Aufruf (im Adapter-Repo):  python3 tools/make_logo.py
Benötigt: pip install pillow
Schreibt: admin/desktop-control.png (320x320, Adapter-Icon)  und  docs/logo-512.png (512x512, README/GitHub)
Das gleiche Motiv steckt im WinCtl-Repo (tools/make_icon.py) für exe- und Tray-Icon.
"""
import os
from PIL import Image, ImageDraw

BLUE, DEEP, WHITE, YELLOW = (51, 153, 204), (15, 39, 64), (255, 255, 255), (255, 196, 61)
S = 2048  # Supersampling, danach runterskaliert


def px(v):
    return round(v * S)


def rrect(d, box, radius, fill):
    d.rounded_rectangle([px(c) for c in box], radius=px(radius), fill=fill)


def draw():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Hintergrund-Kachel (Squircle) in ioBroker-Blau
    rrect(d, (0.02, 0.02, 0.98, 0.98), 0.24, BLUE)

    # 2x2-Kacheln = der "Bildschirm": drei weiß, eine gelb als Akzent
    x0, y0, w, h, gap = 0.17, 0.20, 0.31, 0.21, 0.04
    tiles = [(x0, y0), (x0 + w + gap, y0), (x0, y0 + h + gap), (x0 + w + gap, y0 + h + gap)]
    for (tx, ty), color in zip(tiles, [WHITE, WHITE, WHITE, YELLOW]):
        rrect(d, (tx, ty, tx + w, ty + h), 0.04, color)

    # Standfuß als Pille
    rrect(d, (0.38, 0.76, 0.62, 0.81), 0.025, WHITE)

    # Mauszeiger auf der gelben Kachel: weißer Rand (Halo) + dunkelblaue Füllung
    ox, oy = tiles[3][0] + w * 0.42, tiles[3][1] + h * 0.30
    arrow = [(0, 0), (0, .205), (.047, .16), (.078, .235), (.112, .220), (.081, .148), (.142, .148)]
    pts = [(px(ox + x), px(oy + y)) for x, y in arrow]
    d.polygon(pts, fill=WHITE)
    d.line(pts + [pts[0]], fill=WHITE, width=px(0.03), joint="curve")
    d.polygon(pts, fill=DEEP)
    return img


if __name__ == "__main__":
    logo = draw()
    for path, size in (("admin/desktop-control.png", 320), ("docs/logo-512.png", 512)):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        logo.resize((size, size), Image.LANCZOS).save(path)
        print("geschrieben:", path, f"{size}x{size}")

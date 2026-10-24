#!/usr/bin/env python3
"""Logo für ioBroker.desktop-control: ioBroker-Marke + Monitor + Funk + Klick.
Alle Maße sind auf einem 1000x1000-Raster berechnet (gleichmäßige Ränder, mittiger Standfuß).
Aufruf (im Adapter-Repo):  python3 tools/make_logo.py
  -> schreibt docs/logo.svg und (mit cairosvg) admin/desktop-control.png + docs/logo-512.png
Das gleiche Motiv steckt im WinCtl-Repo (tools/make_icon.py) für exe- und Tray-Icon.
"""
import math, os

DARK, BAR = "#164476", "#3399CC"          # Originalfarben der ioBroker-Marke (Ring / Balken)
THEMES = {
    "tief": dict(bg=DARK, screen=BAR,  wave="#D6EFFB", frame="#FFFFFF"),   # dunkle Kachel, helles Display
    "hell": dict(bg=BAR,  screen=DARK, wave="#8FD0F2", frame="#FFFFFF"),   # helle Kachel, dunkles Display
}

def pt(cx, cy, r, deg):                      # Winkel in Grad, 0 = rechts, 270 = oben (SVG-Koordinaten)
    a = math.radians(deg); return cx + r * math.cos(a), cy + r * math.sin(a)

def arc(cx, cy, r, a0, a1):
    x0, y0 = pt(cx, cy, r, a0); x1, y1 = pt(cx, cy, r, a1)
    return f"M{x0:.1f} {y0:.1f} A{r} {r} 0 0 1 {x1:.1f} {y1:.1f}"

def svg(theme="tief"):
    t = THEMES[theme]
    # --- Monitor (gleichmäßiger Rahmen, mittiger Fuß)
    mx, my, mw, mh, bez = 270, 205, 610, 420, 34
    mcx = mx + mw / 2
    # --- ioBroker-Scheibe
    dx, dy, dr, halo = 292, 648, 165, 16
    lr = 139                                   # Radius der ioBroker-Marke in der Scheibe
    # --- Funkwellen (Mitte nahe der Scheibe, strahlen Richtung Display)
    waves = "".join(f'<path d="{arc(dx, dy, dr + halo + 30 + i * 46, 293, 333)}"/>' for i in range(3))
    # --- Mauszeiger + Klick-Strahlen
    tip = (690, 358); k = 0.85
    cur = [(0,0),(0,205),(47,160),(78,235),(112,220),(81,148),(142,148)]
    cur_pts = " ".join(f"{tip[0]+x*k:.1f},{tip[1]+y*k:.1f}" for x, y in cur)
    rays = "".join('<path d="M{:.1f} {:.1f} L{:.1f} {:.1f}"/>'.format(*pt(*tip, 44, a), *pt(*tip, 80, a)) for a in (197, 238, 279))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="512" height="512" role="img" aria-label="ioBroker.desktop-control">
  <defs><clipPath id="open"><path d="M-2 -2H-.223V-.45H.223V-2H2V2H-2Z"/></clipPath></defs>
  <rect x="20" y="20" width="960" height="960" rx="240" fill="{t['bg']}"/>
  <g transform="translate(500 500) scale(1.07) translate(-503 -509)">
    <rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="56" fill="{t['frame']}"/>
    <rect x="{mx+bez}" y="{my+bez}" width="{mw-2*bez}" height="{mh-2*bez}" rx="26" fill="{t['screen']}"/>
    <polygon points="{mcx-45},{my+mh-2} {mcx+45},{my+mh-2} {mcx+70},{my+mh+75} {mcx-70},{my+mh+75}" fill="{t['frame']}"/>
    <rect x="{mcx-130}" y="{my+mh+67}" width="260" height="50" rx="25" fill="{t['frame']}"/>
    <g fill="none" stroke="{t['wave']}" stroke-width="25" stroke-linecap="round">{waves}</g>
    <g fill="none" stroke="{t['wave']}" stroke-width="22" stroke-linecap="round">{rays}</g>
    <polygon points="{cur_pts}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <circle cx="{dx}" cy="{dy}" r="{dr+halo}" fill="{t['bg']}"/>
    <circle cx="{dx}" cy="{dy}" r="{dr}" fill="#FFFFFF"/>
    <g transform="translate({dx} {dy}) scale({lr})">
      <circle r=".8725" fill="none" stroke="{DARK}" stroke-width=".255" clip-path="url(#open)"/>
      <rect x="-.149" y="-1" width=".298" height=".255" rx=".02" fill="{BAR}"/>
      <rect x="-.149" y="-.654" width=".298" height="1.308" rx=".03" fill="{BAR}"/>
    </g>
  </g>
</svg>
'''

if __name__ == "__main__":
    theme = os.environ.get("LOGO_THEME", "tief")
    os.makedirs("docs", exist_ok=True); os.makedirs("admin", exist_ok=True)
    open("docs/logo.svg", "w", encoding="utf-8").write(svg(theme)); print("geschrieben: docs/logo.svg")
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg(theme).encode(), write_to="docs/logo-512.png", output_width=512, output_height=512)
        cairosvg.svg2png(bytestring=svg(theme).encode(), write_to="admin/desktop-control.png", output_width=320, output_height=320)
        print("geschrieben: docs/logo-512.png, admin/desktop-control.png")
    except ImportError:
        print("cairosvg fehlt (pip install cairosvg) - PNGs bitte aus docs/logo.svg rendern")

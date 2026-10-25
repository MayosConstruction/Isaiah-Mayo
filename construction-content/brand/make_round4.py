# MC monogram round 4: the approved "hook" layout (M high, C dropped in front of
# the M's right leg) in six lettering styles. Writes mc-round4.html and svg/mc-4X.svg.
import os
from mono import *

HERE = os.path.dirname(os.path.abspath(__file__))

concepts = [
    ("4A", "Old English", "Traditional blackletter, the classic tattoo-and-newspaper Old English. The most heritage of the six.",
     hook('UnifrakturCook')),
    ("4B", "Heavy Gothic", "A fat, rounded blackletter with attitude. Reads like a streetwear brand.",
     hook('Fruktur')),
    ("4C", "Western Saloon", "Circus-and-saloon wood type with split serifs. The most West Texas of the six.",
     hook('Rye')),
    ("4D", "Fashion Serif", "High-contrast Bodoni. Thick and thin strokes, sharp hairline serifs, a high-end clothing-label look.",
     hook('BodoniModa')),
    ("4E", "Stencil", "Condensed crate stencil. Industrial and blue-collar, and the easiest to print cleanly.",
     hook('BigShouldersStencilDisplay')),
    ("4F", "Modern Blackletter", "Tall, condensed blackletter with sharp diamond cuts. Old English, but sleek.",
     hook('PirataOne')),
]

os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
marks = []
for num, name, _, p in concepts:
    d = svg_d(p, 150)
    marks.append(d)
    with open(os.path.join(HERE, "svg", f"mc-{num}.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><title>Mayo\'s Construction MC {num} {name}</title><path fill="#fff" d="{d}"/></svg>\n')

TEE = "M150,40 L210,22 Q250,52 290,22 L350,40 L440,110 L395,175 L360,150 L360,470 L140,470 L140,150 L105,175 L60,110 Z"
tiles = "".join(f'''
<div class="tile"><svg viewBox="0 0 200 200" class="mark"><path fill="#fff" d="{d}"/></svg>
<div class="cap"><span class="num">{n}</span><span class="name">{t}</span></div><p>{desc}</p></div>''' for (n, t, desc, _), d in zip(concepts, marks))
tees = "".join(f'''<div class="tee"><svg viewBox="0 0 500 490"><path d="{TEE}" fill="#141414" stroke="#2a2a2a" stroke-width="2"/>
<path d="M210,22 Q250,52 290,22" fill="none" stroke="#2f2f2f" stroke-width="6"/>
<g transform="translate(276,96) scale(0.29)"><path fill="#f2f2f2" d="{d}"/></g></svg><span>{n}</span></div>''' for (n, *_), d in zip(concepts, marks))

html = f"""<!doctype html><html><head><meta charset="utf-8">
<style>
  body {{ margin:0; background:#0b0b0b; color:#fff; font-family: Inter, sans-serif; }}
  .wrap {{ width: 1500px; padding: 70px 80px 60px; box-sizing: border-box; }}
  .top {{ display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #2a2a2a; padding-bottom:22px; margin-bottom:36px; }}
  h1 {{ font: 600 15px Inter; letter-spacing:.32em; text-transform:uppercase; margin:0; }}
  .meta {{ font: 500 13px Inter; letter-spacing:.22em; text-transform:uppercase; color:#8a8a8a; }}
  .grid {{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }}
  .tile {{ background:#000; border:1px solid #1d1d1d; padding: 46px 34px 28px; }}
  .mark {{ display:block; width: 260px; height: 260px; margin: 0 auto 32px; }}
  .cap {{ display:flex; gap:14px; align-items:baseline; border-top:1px solid #222; padding-top:18px; }}
  .num {{ font: 600 13px Inter; color:#777; letter-spacing:.1em; }}
  .name {{ font: 600 15px Inter; letter-spacing:.24em; text-transform:uppercase; }}
  p {{ margin: 10px 0 0; font: 400 14px/1.5 Inter; color:#9a9a9a; }}
  .sec {{ margin-top: 44px; border-top:1px solid #2a2a2a; padding-top: 24px; }}
  .lab {{ font: 500 12px Inter; letter-spacing:.22em; text-transform:uppercase; color:#8a8a8a; margin-bottom: 18px; }}
  .tees {{ display:grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }}
  .tee {{ background:#1b1b1b; border:1px solid #242424; padding: 12px 6px 10px; text-align:center; }}
  .tee svg {{ width: 100%; height: auto; display:block; }}
  .tee span {{ font: 500 12px Inter; color:#777; letter-spacing:.1em; }}
</style></head><body><div class="wrap">
<div class="top"><h1>Mayo's Construction · MC Monogram</h1><div class="meta">Round 4 · Hook layout in six styles</div></div>
<div class="grid">{tiles}</div>
<div class="sec"><div class="lab">Left chest, about 2" wide on a black tee</div><div class="tees">{tees}</div></div>
</div></body></html>"""
open(os.path.join(HERE, "mc-round4.html"), "w").write(html)

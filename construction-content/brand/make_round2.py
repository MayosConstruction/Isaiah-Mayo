# MC monogram round 2: six lockups built from real letterforms with boolean joins.
# Writes mc-round2.html (presentation board) and svg/mc-0N.svg (one vector file per mark).
import os
from mono import *

HERE = os.path.dirname(os.path.abspath(__file__))

concepts = [
    ("01", "Frontier Gothic", "Western-gothic letters with spurred feet. The C's spine is the M's last stem, so it's one shape.",
     union(glyph('NewRocker', 'M'), glyph('NewRocker', 'C', x=62))),
    ("02", "Blackletter Block", "A modern, compact blackletter. The C grows out of the M's third stem like a ligature.",
     union(glyph('PirataOne', 'M'), glyph('PirataOne', 'C', x=50))),
    ("03", "Old English Cut", "Old English kept quiet: wedge serifs and a sharp C cut in front of the M with a clean gap.",
     front(glyph('Texturina', 'C', x=74), glyph('Texturina', 'M'), 3)),
    ("04", "Stencil Stem", "Crate-stencil lettering. One stem is the end of the M and the back of the C.",
     union(glyph('BigShouldersStencilDisplay', 'M'), glyph('BigShouldersStencilDisplay', 'C', x=52))),
    ("05", "Heritage Crest", "A Roman C holds the M inside it, separated by a clean gap. Reads as one crest.",
     front(glyph('Cinzel', 'M', 66, x=32, y=-30), glyph('Cinzel', 'C', 150), 3)),
    ("06", "Workhorse", "Heavy, flat-footed blackletter. The C's back merges with the M's stem. Built to survive cheap printing.",
     union(glyph('GermaniaOne', 'M'), glyph('GermaniaOne', 'C', x=52))),
]

os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
marks = []
for num, name, _, p in concepts:
    d = svg_d(p, 150)
    marks.append(d)
    with open(os.path.join(HERE, "svg", f"mc-{num}.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><title>Mayo\'s Construction MC {num} {name}</title><path fill="#fff" d="{d}"/></svg>\n')

tiles = "".join(f'''
<div class="tile"><svg viewBox="0 0 200 200" class="mark"><path fill="#fff" d="{d}"/></svg>
<div class="cap"><span class="num">{n}</span><span class="name">{t}</span></div><p>{desc}</p></div>''' for (n, t, desc, _), d in zip(concepts, marks))
small = "".join(f'<div class="s"><svg viewBox="0 0 200 200"><path fill="#fff" d="{d}"/></svg><span>{n}</span></div>' for (n, *_), d in zip(concepts, marks))

html = f"""<!doctype html><html><head><meta charset="utf-8">
<style>
  body {{ margin:0; background:#0b0b0b; color:#fff; font-family: Inter, sans-serif; }}
  .wrap {{ width: 1500px; padding: 70px 80px 60px; box-sizing: border-box; }}
  .top {{ display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #2a2a2a; padding-bottom:22px; margin-bottom:36px; }}
  h1 {{ font: 600 15px Inter; letter-spacing:.32em; text-transform:uppercase; margin:0; }}
  .meta {{ font: 500 13px Inter; letter-spacing:.22em; text-transform:uppercase; color:#8a8a8a; }}
  .grid {{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }}
  .tile {{ background:#000; border:1px solid #1d1d1d; padding: 50px 34px 30px; }}
  .mark {{ display:block; width: 270px; height: 270px; margin: 0 auto 36px; }}
  .cap {{ display:flex; gap:14px; align-items:baseline; border-top:1px solid #222; padding-top:18px; }}
  .num {{ font: 600 13px Inter; color:#777; letter-spacing:.1em; }}
  .name {{ font: 600 15px Inter; letter-spacing:.24em; text-transform:uppercase; }}
  p {{ margin: 10px 0 0; font: 400 14px/1.5 Inter; color:#9a9a9a; }}
  .row {{ margin-top: 40px; border-top:1px solid #2a2a2a; padding-top: 26px; display:flex; align-items:center; gap: 46px; }}
  .row .lab {{ font: 500 12px Inter; letter-spacing:.22em; text-transform:uppercase; color:#8a8a8a; width: 220px; line-height:1.6; }}
  .s {{ display:flex; flex-direction:column; align-items:center; gap:8px; }}
  .s svg {{ width: 64px; height: 64px; }}
  .s span {{ font: 500 11px Inter; color:#666; letter-spacing:.1em; }}
</style></head><body><div class="wrap">
<div class="top"><h1>Mayo's Construction · MC Monogram</h1><div class="meta">Round 2 · Six directions · Left chest, white on black</div></div>
<div class="grid">{tiles}</div>
<div class="row"><div class="lab">Small-size check<br>(about chest size on screen)</div>{small}</div>
</div></body></html>"""
open(os.path.join(HERE, "mc-round2.html"), "w").write(html)

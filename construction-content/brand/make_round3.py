# MC monogram round 3: Frontier Gothic (New Rocker) with the letters interlocked.
# The M sits high and the C drops low, hooking around the M's right leg.
# Writes mc-round3.html and svg/mc-3X.svg.
import os
from mono import *

HERE = os.path.dirname(os.path.abspath(__file__))
F = 'NewRocker'

def link(cx, cy, m_over_top=None, gap=3, split=-20):
    """C placed at (cx, cy) against the M. m_over_top=None: C in front everywhere.
    Otherwise the letters weave: one is in front above `split`, the other below."""
    M, C = glyph(F, 'M'), glyph(F, 'C', x=cx, y=cy)
    if m_over_top is None:
        return front(C, M, gap)
    top, bot = rect(-300, -300, 400, split), rect(-300, split, 400, 300)
    a, b = front(M, C, gap), front(C, M, gap)
    if not m_over_top:
        a, b = b, a
    return union(inter(a, top), inter(b, bot))

concepts = [
    ("3A", "Weave", "The C slips behind the M's right leg at the top and crosses in front at the foot, so the letters are actually woven.",
     link(58, 34, m_over_top=True)),
    ("3B", "Hook", "Same drop and stagger, but the C stays in front the whole way. A little simpler, with less to embroider.",
     link(58, 34)),
    ("3C", "Tight Weave", "The C pulled in closer and higher. More compact and more square on the chest.",
     link(54, 30, m_over_top=True)),
    ("3D", "Deep Drop", "The C drops lower for a bigger stagger, a taller mark that suits a narrow left-chest spot.",
     link(62, 42, m_over_top=True)),
]

os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
marks = []
for num, name, _, p in concepts:
    d = svg_d(p, 150)
    marks.append(d)
    with open(os.path.join(HERE, "svg", f"mc-{num}.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><title>Mayo\'s Construction MC {num} {name}</title><path fill="#fff" d="{d}"/></svg>\n')

TEE = ("M150,40 L210,22 Q250,52 290,22 L350,40 L440,110 L395,175 L360,150 L360,470 L140,470 L140,150 L105,175 L60,110 Z")
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
  .grid {{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }}
  .tile {{ background:#000; border:1px solid #1d1d1d; padding: 40px 26px 26px; }}
  .mark {{ display:block; width: 240px; height: 240px; margin: 0 auto 28px; }}
  .cap {{ display:flex; gap:12px; align-items:baseline; border-top:1px solid #222; padding-top:16px; }}
  .num {{ font: 600 13px Inter; color:#777; letter-spacing:.1em; }}
  .name {{ font: 600 14px Inter; letter-spacing:.22em; text-transform:uppercase; }}
  p {{ margin: 10px 0 0; font: 400 13.5px/1.5 Inter; color:#9a9a9a; }}
  .sec {{ margin-top: 44px; border-top:1px solid #2a2a2a; padding-top: 24px; }}
  .lab {{ font: 500 12px Inter; letter-spacing:.22em; text-transform:uppercase; color:#8a8a8a; margin-bottom: 18px; }}
  .tees {{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }}
  .tee {{ background:#1b1b1b; border:1px solid #242424; padding: 18px 10px 12px; text-align:center; }}
  .tee svg {{ width: 100%; height: auto; display:block; }}
  .tee span {{ font: 500 12px Inter; color:#777; letter-spacing:.1em; }}
</style></head><body><div class="wrap">
<div class="top"><h1>Mayo's Construction · MC Monogram</h1><div class="meta">Round 3 · Frontier Gothic, interlocked</div></div>
<div class="grid">{tiles}</div>
<div class="sec"><div class="lab">Left chest, about 2" wide on a black tee</div><div class="tees">{tees}</div></div>
</div></body></html>"""
open(os.path.join(HERE, "mc-round3.html"), "w").write(html)

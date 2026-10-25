# Six MC monogram concepts, white on black, drawn as pure geometry (viewBox 0 0 200 200).
import math
W = "#fff"

def stroke(d, w, cap="butt", join="miter", color=W, extra=""):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}" stroke-linejoin="{join}" stroke-miterlimit="10" {extra}/>'
def poly(pts, color=W):
    return '<polygon fill="%s" points="%s"/>' % (color, " ".join(f"{x:.2f},{y:.2f}" for x, y in pts))

def flat(body, y0, y1, cid):
    # Clip a stroked M so its peaks are cut flat at y0 and its feet at y1.
    return (f'<defs><clipPath id="{cid}"><rect x="0" y="{y0}" width="200" height="{y1 - y0}"/></clipPath></defs>'
            f'<g clip-path="url(#{cid})">{body}</g>')

def c1():
    # Shared stem: the M's right stem is the C's spine. Spurs close the C's arms.
    m = flat(stroke("M30,172 L30,24 L70,100 L110,24 L110,172", 16), 32, 168, "f1")
    return (m + stroke("M110,40 L172,40 L172,60", 16) + stroke("M110,160 L172,160 L172,140", 16))

def c2():
    # Hanging frame: chamfered C; the M hangs from its top bar on pointed feet.
    s = stroke("M170,31 L58,31 L31,58 L31,142 L58,169 L170,169", 14)
    s += flat(stroke("M64,141 L64,20 L100,90 L136,20 L136,141", 12), 31, 141, "f2")
    for x in (64, 136):
        s += poly([(x-6, 141), (x+6, 141), (x, 151)])
    for y in (31, 169):
        s += poly([(170, y-7), (178, y), (170, y+7)])
    return s

def c3():
    # Seal: an open ring reads as C; the M is cut from its chords and clipped to the ring.
    r, cx, cy, a = 74, 100, 100, math.radians(36)
    p = lambda t: (cx + r*math.cos(t), cy + r*math.sin(t))
    (x1, y1), (x2, y2) = p(-a), p(a)
    ring = f'<path d="M{x1:.2f},{y1:.2f} A{r},{r} 0 1 0 {x2:.2f},{y2:.2f}" fill="none" stroke="{W}" stroke-width="14"/>'
    m = stroke("M58,170 L58,30 L100,120 L142,30 L142,170", 14)
    return ring + f'<defs><clipPath id="sealclip"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath></defs><g clip-path="url(#sealclip)">{m}</g>'

def c4():
    # Broken pen: three Old English stems with diagonal heads and lozenge feet,
    # joined by angular roofs. The third stem opens into the C.
    s = ""
    for x in (40, 84, 128):
        s += poly([(x-8, 66), (x+8, 58), (x+8, 146), (x, 156), (x-8, 146)])
    for a, b in ((40, 84), (84, 128)):
        s += poly([(a+8, 58), ((a+b)/2, 46), (b-8, 58), (b-8, 66), ((a+b)/2, 56), (a+8, 66)])
    s += poly([(136, 58), (170, 58), (164, 70), (136, 70)])     # top arm, flag cut
    s += poly([(136, 138), (168, 128), (168, 138), (136, 148)])  # lower arm, rising
    return s

def c5():
    # Overlap: a round C sits behind a bold M; a clean gap separates them wherever they cross.
    r, cx, cy, a = 70, 100, 100, math.radians(30)
    p = lambda t: (cx + r*math.cos(t), cy + r*math.sin(t))
    (x1, y1), (x2, y2) = p(-a), p(a)
    ring = f'<path d="M{x1:.2f},{y1:.2f} A{r},{r} 0 1 0 {x2:.2f},{y2:.2f}" fill="none" stroke="{W}" stroke-width="15"/>'
    md = "M64,184 L64,16 L100,108 L136,16 L136,184"
    return (ring + flat(stroke(md, 28, color="#000"), 22, 178, "f5b")
            + flat(stroke(md, 16), 28, 172, "f5"))

def c6():
    # Western Mc: slab-serif M with flat peaks and an angular small c set into its V.
    s = flat(stroke("M40,172 L40,24 L100,118 L160,24 L160,172", 16), 40, 158, "f6")
    s += poly([(22, 146), (58, 146), (58, 158), (22, 158)]) + poly([(142, 146), (178, 146), (178, 158), (142, 158)])
    s += poly([(22, 40), (48, 40), (48, 52), (22, 52)]) + poly([(152, 40), (178, 40), (178, 52), (152, 52)])
    s += stroke("M115,46 L96,46 L90,52 L90,64 L96,70 L115,70", 9)
    return s

concepts = [
    ("01", "Shared Stem", "The M's last stroke is the C's spine. One vertical does two jobs."),
    ("02", "Hanging Frame", "A chamfered C holds the M, which hangs from its top bar on pointed feet."),
    ("03", "Seal", "An open ring reads as the C. The M is cut from the chords inside it."),
    ("04", "Broken Pen", "Old English stems with diagonal heads and lozenge feet. The third stem opens into the C."),
    ("05", "Overlap", "A bold M stands in front of a round C, with a clean cut where they cross. Ballcap-monogram energy."),
    ("06", "Western Mc", "A slab-serif M with a small angular c tucked into its V, the way old Mc signage was lettered."),
]
marks = [c1(), c2(), c3(), c4(), c5(), c6()]

tiles = "".join(f'''
<div class="tile"><svg viewBox="0 0 200 200" class="mark">{m}</svg>
<div class="cap"><span class="num">{n}</span><span class="name">{t}</span></div><p>{d}</p></div>''' for (n, t, d), m in zip(concepts, marks))
small = "".join(f'<div class="s"><svg viewBox="0 0 200 200">{m}</svg><span>{n}</span></div>' for (n, _, _), m in zip(concepts, marks))

html = f"""<!doctype html><html><head><meta charset="utf-8">
<style>
  body {{ margin:0; background:#0b0b0b; color:#fff; font-family: Inter, sans-serif; }}
  .wrap {{ width: 1500px; padding: 70px 80px 60px; box-sizing: border-box; }}
  .top {{ display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #2a2a2a; padding-bottom:22px; margin-bottom:36px; }}
  h1 {{ font: 600 15px Inter; letter-spacing:.32em; text-transform:uppercase; margin:0; }}
  .meta {{ font: 500 13px Inter; letter-spacing:.22em; text-transform:uppercase; color:#8a8a8a; }}
  .grid {{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }}
  .tile {{ background:#000; border:1px solid #1d1d1d; padding: 54px 34px 30px; }}
  .mark {{ display:block; width: 260px; height: 260px; margin: 0 auto 40px; }}
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
<div class="top"><h1>Mayo's Construction · MC Monogram</h1><div class="meta">Round 1 · Six directions · Left chest, white on black</div></div>
<div class="grid">{tiles}</div>
<div class="row"><div class="lab">Small-size check<br>(about chest size on screen)</div>{small}</div>
</div></body></html>"""
open(__file__.replace("make_monograms.py", "mc-monograms.html"), "w").write(html)

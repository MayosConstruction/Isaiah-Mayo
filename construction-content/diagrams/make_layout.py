# Generates countertop-layout.html: plan view of the kitchen from the site photos,
# with a seam at every change in direction. Dimensions are estimates (inches).
import math
S = 6.5               # px per inch
OX, OY = 120, 200     # page offset of the back corner where stove wall meets window wall
D = 25                # counter depth
X = 140               # stove wall to fridge wall
B = 48                # how far the diagonal back wall cuts in on each side
C = 9                 # angled front at the left inside corner
R2 = math.sqrt(2)

def p(x, y): return f"{OX + x*S:.1f},{OY + y*S:.1f}"
def poly(pts): return " ".join(p(*q) for q in pts)

# Right corner: back diagonal x - y = X - B; front diagonal offset by D.
fr_w = (X - B - D*R2 + D, D)            # front bend on the window run
fr_e = (X - D, X - D - (X - B - D*R2))  # front bend on the fridge wall run
bk_w, bk_e = (X - B, 0), (X, B)
cl1, cl2 = (D + C, D), (D, D + C)       # left corner angled front
mid = ((cl1[0]+cl2[0])/2, (cl1[1]+cl2[1])/2)

LEG_END = 62            # end of the counter on the stove wall, before the trash gap
TRASH = (62, 77); STOVE = (77, 107); PANTRY = (107, 143)
RIGHT_END = 92; DW = (fr_e[1] + 1.5, fr_e[1] + 25.5)

top = [(0,0), bk_w, fr_w, cl1, mid]
diag = [bk_w, bk_e, fr_e, fr_w]
right = [bk_e, (X, RIGHT_END), (X - D, RIGHT_END), fr_e]
left = [(0,0), mid, cl2, (D, LEG_END), (0, LEG_END)]
pantry = [(0, PANTRY[0]), (D, PANTRY[0]), (D, PANTRY[1]), (0, PANTRY[1])]
outline = [(0,0), bk_w, bk_e, (X, RIGHT_END), (X-D, RIGHT_END), fr_e, fr_w, cl1, cl2, (D, LEG_END), (0, LEG_END)]

# Sink: 33 x 22 double bowl, centered on the diagonal piece, square to the diagonal.
cx = (bk_w[0] + bk_e[0] + fr_w[0] + fr_e[0]) / 4
cy = (bk_w[1] + bk_e[1] + fr_w[1] + fr_e[1]) / 4
def lbl(x, y, t, cls="lbl", extra=""): return f'<text class="{cls}" x="{OX+x*S:.1f}" y="{OY+y*S:.1f}" {extra}>{t}</text>'
def tag(x, y, t, w=150): return (f'<g class="tag" transform="translate({OX+x*S:.1f},{OY+y*S:.1f})">'
    f'<rect x="{-w/2}" y="-19" width="{w}" height="38" rx="6"/><text>{t}</text></g>')

svg = f"""
<defs>
  <pattern id="h" width="40" height="28" patternUnits="userSpaceOnUse"><line x1="0" y1="8" x2="40" y2="8" class="stripe"/></pattern>
  <pattern id="v" width="28" height="40" patternUnits="userSpaceOnUse"><line x1="8" y1="0" x2="8" y2="40" class="stripe"/></pattern>
  <pattern id="d" width="40" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="8" x2="40" y2="8" class="stripe"/></pattern>
</defs>
<polyline class="wall" points="{p(0, PANTRY[1]+4)} {p(-0.8,-0.8)} {p(X-B,-0.8)} {p(X+0.8, B)} {p(X+0.8, 128)}"/>
{lbl((X-B)/2 + 6, -5, "window", "sm")}
{lbl(X - B/2 + 6, B/2 - 6, "corner window", "sm", 'transform="rotate(45 %.1f %.1f)"' % (OX+(X-B/2+6)*S, OY+(B/2-6)*S))}
{lbl(-5, 50, "stove wall", "sm", 'transform="rotate(-90 %.1f %.1f)"' % (OX-5*S, OY+50*S))}
{lbl(X+5, 75, "fridge wall", "sm", 'transform="rotate(90 %.1f %.1f)"' % (OX+(X+5)*S, OY+75*S))}

<polygon class="piece" points="{poly(top)}"/><polygon fill="url(#h)" points="{poly(top)}"/>
<polygon class="piece" points="{poly(diag)}"/><polygon fill="url(#d)" points="{poly(diag)}"/>
<polygon class="piece" points="{poly(right)}"/><polygon fill="url(#v)" points="{poly(right)}"/>
<polygon class="piece" points="{poly(left)}"/><polygon fill="url(#v)" points="{poly(left)}"/>
<polygon class="piece" points="{poly(pantry)}"/><polygon fill="url(#v)" points="{poly(pantry)}"/>

<g transform="translate({OX+cx*S:.1f},{OY+cy*S:.1f}) rotate(45)">
  <rect class="sink" x="{-16*S:.1f}" y="{-9*S:.1f}" width="{15.5*S:.1f}" height="{18*S:.1f}" rx="10"/>
  <rect class="sink" x="{0.5*S:.1f}" y="{-9*S:.1f}" width="{15.5*S:.1f}" height="{18*S:.1f}" rx="10"/>
</g>

<line class="seam" x1="{OX:.1f}" y1="{OY:.1f}" x2="{OX+mid[0]*S:.1f}" y2="{OY+mid[1]*S:.1f}"/>
<line class="seam" x1="{OX+bk_w[0]*S:.1f}" y1="{OY:.1f}" x2="{OX+fr_w[0]*S:.1f}" y2="{OY+fr_w[1]*S:.1f}"/>
<line class="seam" x1="{OX+bk_e[0]*S:.1f}" y1="{OY+bk_e[1]*S:.1f}" x2="{OX+fr_e[0]*S:.1f}" y2="{OY+fr_e[1]*S:.1f}"/>
<polygon class="outline" points="{poly(outline)}"/>
<polygon class="outline" points="{poly(pantry)}"/>

<rect class="open" x="{OX:.1f}" y="{OY+TRASH[0]*S:.1f}" width="{D*S:.1f}" height="{(TRASH[1]-TRASH[0])*S:.1f}"/>
{lbl(D/2, (TRASH[0]+TRASH[1])/2, "trash", "sm")}
<rect class="stove" x="{OX:.1f}" y="{OY+STOVE[0]*S:.1f}" width="{D*S:.1f}" height="{(STOVE[1]-STOVE[0])*S:.1f}"/>
{"".join(f'<circle class="burner" cx="{OX+bx*S:.1f}" cy="{OY+by*S:.1f}" r="{r*S:.1f}"/>' for bx, by, r in [(8, STOVE[0]+8, 4), (8, STOVE[1]-8, 3.2), (17, STOVE[0]+8, 3.2), (17, STOVE[1]-8, 4)])}
{lbl(D + 5, (STOVE[0]+STOVE[1])/2, "STOVE", "lbl", 'style="text-anchor:start"')}
{lbl(D + 5, (STOVE[0]+STOVE[1])/2 + 4, "(no top)", "sm", 'style="text-anchor:start"')}
{lbl(D + 5, (PANTRY[0]+PANTRY[1])/2 - 2, "counter under pantry", "sm", 'style="text-anchor:start"')}
{lbl(D + 5, (PANTRY[0]+PANTRY[1])/2 + 2, "(separate top)", "sm", 'style="text-anchor:start"')}

<rect class="under" x="{OX+(X-D+1)*S:.1f}" y="{OY+DW[0]*S:.1f}" width="{(D-2)*S:.1f}" height="{(DW[1]-DW[0])*S:.1f}"/>
{lbl(X - D/2, (DW[0]+DW[1])/2 - 1.5, "DW", "lbl", 'style="paint-order:stroke;stroke:#f5e3da;stroke-width:8"')}
{lbl(X - D/2, (DW[0]+DW[1])/2 + 2.5, "below", "sm", 'style="paint-order:stroke;stroke:#f5e3da;stroke-width:8"')}
<rect class="fridge" x="{OX+(X-31)*S:.1f}" y="{OY+(RIGHT_END+1)*S:.1f}" width="{31*S:.1f}" height="{33*S:.1f}"/>
{lbl(X - 15.5, RIGHT_END + 17.5, "FRIDGE")}

{tag(20, -6, "90° turn · 45° miter", 230)}
{tag(X - B - 4, -6, "45° turn", 130)}
{tag(X + 11, B + 3, "45° turn", 130)}
{lbl((fr_w[0]+fr_e[0])/2 - 4, (fr_w[1]+fr_e[1])/2 + 5, "SINK cutout (double bowl)", "lbl", 'style="text-anchor:end"')}
"""

W = OX*2 + X*S + 80
H = (OY - 120) + 145*S + 30
html = f"""<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body {{ margin: 0; background: #fafafa; font-family: Inter, sans-serif; color: #151515; }}
  .head {{ width: {W:.0f}px; padding: 36px 0 0; }}
  h1 {{ font-size: 34px; margin: 0 60px 6px; }}
  p {{ font-size: 19px; margin: 0 60px; color: #555; }}
  .draft {{ display: inline-block; margin: 14px 60px 0; background: #fff4d6; border: 2px solid #e0b33a; border-radius: 8px; padding: 8px 14px; font: 600 18px Inter, sans-serif; color: #6b4e00; }}
  .piece {{ fill: #f5e3da; }}
  .stripe {{ stroke: #d9875a; stroke-width: 4; }}
  .outline {{ fill: none; stroke: #151515; stroke-width: 3; stroke-linejoin: round; }}
  .seam {{ stroke: #a42f28; stroke-width: 6; stroke-linecap: round; }}
  .tag rect {{ fill: #a42f28; }}
  .tag text {{ fill: #fff; font: 700 20px Inter, sans-serif; text-anchor: middle; dominant-baseline: central; }}
  .open {{ fill: #fff; stroke: #151515; stroke-width: 2.5; stroke-dasharray: 10 7; }}
  .stove {{ fill: #fff; stroke: #151515; stroke-width: 3; }}
  .burner {{ fill: none; stroke: #151515; stroke-width: 3; }}
  .sink {{ fill: #fff; stroke: #151515; stroke-width: 3; }}
  .under {{ fill: none; stroke: #555; stroke-width: 2.5; stroke-dasharray: 8 6; }}
  .fridge {{ fill: #e4e4e4; stroke: #151515; stroke-width: 2.5; }}
  .lbl {{ font: 700 20px Inter, sans-serif; fill: #151515; text-anchor: middle; dominant-baseline: central; }}
  .sm {{ font: 500 17px Inter, sans-serif; fill: #555; text-anchor: middle; dominant-baseline: central; }}
  .wall {{ fill: none; stroke: #151515; stroke-width: 10; stroke-linejoin: miter; }}
</style></head>
<body>
<div class="head">
  <h1>Countertop layout: seam at every turn</h1>
  <p>Drawn from the site photos. The stripes follow each run and change direction at every seam.</p>
  <div class="draft">Not to scale. Lengths are estimates. Measure before cutting.</div>
</div>
<svg width="{W:.0f}" height="{H:.0f}" viewBox="0 120 {W:.0f} {H:.0f}">{svg}</svg>
</body></html>
"""
open(__file__.replace("make_layout.py", "countertop-layout.html"), "w").write(html)

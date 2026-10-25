# Generates countertop-layout.html: plan view of the kitchen from the site photos,
# with a seam at every change in direction. Dimensions are estimates (inches).
import math

S = 6.5               # px per inch
OX, OY = 130, 200     # page position of the back corner where the stove wall meets the window wall
D = 25                # counter depth
X = 140               # stove wall to fridge wall
A = 28                # sink corner: angled front cuts in this far on each run (front ~40")
C = 9                 # angled drawer at the stove-side corner
T = math.tan(math.radians(22.5)) * D   # where a seam from a 45° front bend meets the wall

LEG_END = 77; STOVE = (77, 107); PANTRY = (107, 143)   # counter runs straight to the stove (no trash gap)
RIGHT_END = 96

# Sink corner: square back corner, angled front. Seams bisect each 45° bend.
P1, P2 = (X - D - A, D), (X - D, D + A)
W1, W2 = (P1[0] + T, 0), (X, P2[1] - T)
# Stove-side corner: square back, small angled front, one 45° miter.
cl1, cl2 = (D + C, D), (D, D + C)
mid = ((cl1[0] + cl2[0]) / 2, (cl1[1] + cl2[1]) / 2)

top = [(0, 0), W1, P1, cl1, mid]
corner = [W1, (X, 0), W2, P2, P1]
right = [W2, (X, RIGHT_END), (X - D, RIGHT_END), P2]
left = [(0, 0), mid, cl2, (D, LEG_END), (0, LEG_END)]
pantry = [(0, PANTRY[0]), (D, PANTRY[0]), (D, PANTRY[1]), (0, PANTRY[1])]
outline = [(0, 0), (X, 0), (X, RIGHT_END), (X - D, RIGHT_END), P2, P1, cl1, cl2, (D, LEG_END), (0, LEG_END)]

# Sink: 33 x 22 double bowl, square to the angled front, 2" back from the edge.
n = (math.sqrt(.5), -math.sqrt(.5))          # from the angled front toward the back corner
u = (math.sqrt(.5), math.sqrt(.5))           # along the angled front
M = ((P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2)
SC = (M[0] + n[0] * 13, M[1] + n[1] * 13)

def inside(pt, poly):
    x, y = pt; hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit
for su in (-16.5, 16.5):
    for sn in (-11, 11):
        q = (SC[0] + u[0] * su + n[0] * sn, SC[1] + u[1] * su + n[1] * sn)
        assert inside(q, corner), f"sink corner {q} crosses a seam or edge"

def p(x, y): return f"{OX + x*S:.1f},{OY + y*S:.1f}"
def poly(pts): return " ".join(p(*q) for q in pts)
def at(x, y): return OX + x*S, OY + y*S
def lbl(x, y, t, cls="lbl", extra=""):
    px, py = at(x, y); return f'<text class="{cls}" x="{px:.1f}" y="{py:.1f}" {extra}>{t}</text>'
def tag(x, y, t, w=130):
    px, py = at(x, y)
    return (f'<g class="tag" transform="translate({px:.1f},{py:.1f})"><rect x="{-w/2}" y="-19" width="{w}" height="38" rx="6"/>'
            f'<text>{t}</text></g>')
def seam(a, b):
    (x1, y1), (x2, y2) = at(*a), at(*b)
    return f'<line class="seam" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>'
def rot(x, y, deg):
    px, py = at(x, y); return f'transform="rotate({deg} {px:.1f} {py:.1f})"'

scx, scy = at(*SC)
burners = "".join(f'<circle class="burner" cx="{at(bx, by)[0]:.1f}" cy="{at(bx, by)[1]:.1f}" r="{r*S:.1f}"/>'
                  for bx, by, r in [(8, STOVE[0]+8, 4), (8, STOVE[1]-8, 3.2), (17, STOVE[0]+8, 3.2), (17, STOVE[1]-8, 4)])
halo = 'style="paint-order:stroke;stroke:#f5e3da;stroke-width:8"'

svg = f"""
<defs>
  <pattern id="h" width="40" height="28" patternUnits="userSpaceOnUse"><line x1="0" y1="8" x2="40" y2="8" class="stripe"/></pattern>
  <pattern id="v" width="28" height="40" patternUnits="userSpaceOnUse"><line x1="8" y1="0" x2="8" y2="40" class="stripe"/></pattern>
  <pattern id="d" width="40" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="8" x2="40" y2="8" class="stripe"/></pattern>
</defs>
<polyline class="wall" points="{p(-0.8, PANTRY[1]+4)} {p(-0.8,-0.8)} {p(X+0.8,-0.8)} {p(X+0.8, 132)}"/>
{lbl(X/2, -5, "windows", "sm")}
{lbl(X + 5, 22, "window", "sm", rot(X + 5, 22, 90))}
{lbl(-5, 50, "stove wall", "sm", rot(-5, 50, -90))}
{lbl(X + 5, 80, "fridge wall", "sm", rot(X + 5, 80, 90))}

<polygon class="piece" points="{poly(top)}"/><polygon fill="url(#h)" points="{poly(top)}"/>
<polygon class="piece" points="{poly(corner)}"/><polygon fill="url(#d)" points="{poly(corner)}"/>
<polygon class="piece" points="{poly(right)}"/><polygon fill="url(#v)" points="{poly(right)}"/>
<polygon class="piece" points="{poly(left)}"/><polygon fill="url(#v)" points="{poly(left)}"/>
<polygon class="piece" points="{poly(pantry)}"/><polygon fill="url(#v)" points="{poly(pantry)}"/>

<g transform="translate({scx:.1f},{scy:.1f}) rotate(45)">
  <rect class="sink" x="{-16.5*S:.1f}" y="{-11*S:.1f}" width="{16*S:.1f}" height="{22*S:.1f}" rx="10"/>
  <rect class="sink" x="{0.5*S:.1f}" y="{-11*S:.1f}" width="{16*S:.1f}" height="{22*S:.1f}" rx="10"/>
</g>

{seam((0, 0), mid)}{seam(P1, W1)}{seam(P2, W2)}
<polygon class="outline" points="{poly(outline)}"/>
<polygon class="outline" points="{poly(pantry)}"/>

<rect class="stove" x="{at(0,0)[0]:.1f}" y="{at(0,STOVE[0])[1]:.1f}" width="{D*S:.1f}" height="{(STOVE[1]-STOVE[0])*S:.1f}"/>
{burners}
{lbl(D + 5, sum(STOVE)/2 - 1.5, "STOVE", "lbl", 'style="text-anchor:start"')}
{lbl(D + 5, sum(STOVE)/2 + 2.5, "(no top)", "sm", 'style="text-anchor:start"')}
{lbl(D + 5, sum(PANTRY)/2 - 2, "counter under pantry", "sm", 'style="text-anchor:start"')}
{lbl(D + 5, sum(PANTRY)/2 + 2, "(separate top)", "sm", 'style="text-anchor:start"')}

<rect class="under" x="{at(X-D+1,0)[0]:.1f}" y="{at(0,P2[1]+1.5)[1]:.1f}" width="{(D-2)*S:.1f}" height="{24*S:.1f}"/>
{lbl(X - D/2, P2[1] + 12, "DW", "lbl", halo)}
{lbl(X - D/2, P2[1] + 16, "below", "sm", halo)}
<rect class="fridge" x="{at(X-31,0)[0]:.1f}" y="{at(0,RIGHT_END+1)[1]:.1f}" width="{31*S:.1f}" height="{33*S:.1f}"/>
{lbl(X - 15.5, RIGHT_END + 17.5, "FRIDGE")}

{lbl(M[0] - 4, M[1] + 4, "SINK in the corner,", "lbl", 'style="text-anchor:end"')}
{lbl(M[0] - 4, M[1] + 8, "square to the angled front", "sm", 'style="text-anchor:end"')}
{tag(18, -6, "90° turn · 45° miter", 230)}
{tag(W1[0] - 6, -6, "45° turn")}
{tag(X + 11, W2[1] + 3, "45° turn")}
"""

W = OX * 2 + X * S + 80
H = (OY - 120) + 145 * S + 30
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

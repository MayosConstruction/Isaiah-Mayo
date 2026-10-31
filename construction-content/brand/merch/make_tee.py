# Mayo's merch tee: script MC monogram on the left chest, and a back print of the mascot
# with the "Mayo★s" script crossing his chest. Two colorways (cream tee, navy tee),
# two ink colors each. Writes print-ready SVGs (all outlines, knockouts cut in, so
# each color is its own clean shape) and a mockup page.
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "refresh"))
import make_refresh as R  # noqa: E402  (also rebuilds the refresh SVGs; harmless)
from mono import *  # noqa: E402
from fontTools.svgLib.path import parse_path  # noqa: E402

RED, CREAM, NAVY = R.RED, R.CREAM, R.NAVY


def from_d(dstr):
    """An SVG path string (even-odd) as a pathops path."""
    p = pathops.Path()
    parse_path(dstr, p.getPen())
    p.fillType = pathops.FillType.EVEN_ODD
    return union(p)


# --- Back print, laid out in hundredths of an inch: 12" wide.
W = 1200
mx, my, mw, mh = R.MASCOT_BOX
s = 760 / mh
place = lambda p: R.xform(p, s, 0, 0, s, W / 2 - (mx + mw / 2) * s, -my * s)
fill = place(from_d(R.MASCOT_FILL))
lines = place(from_d(R.MASCOT_LINES))
_, _, _, mascot_bottom = fill.bounds

# Script across his chest, overlapping the bottom of the mascot.
sx0, sy0, sx1, sy1 = R.bbox(R.script, R.STAR)
k = 1040 / (sx1 - sx0)
put = lambda p, dy: R.xform(p, k, 0, 0, k, W / 2 - (sx0 + sx1) / 2 * k, dy)
script_top = mascot_bottom - 230
script = put(R.script, script_top - sy0 * k)
star = put(R.STAR, script_top - sy0 * k)
gap = grow(union(script, star), 14)          # tee-colored gap between script and mascot
# End him just behind the script so his cut-off bottom doesn't peek between letters.
tuck = rect(-100, mascot_bottom - 62, W + 100, mascot_bottom + 100)
lines = minus(lines, union(gap, tuck))
fill = minus(fill, union(gap, tuck))

_, _, _, sb = R.bbox(script, star)
cons, cw = R.text("ArchivoBlack", "CONSTRUCTION CO.", 74, tracking=0.12)
cons = R.xform(cons, 1, 0, 0, 1, (W - cw) / 2, sb + 120)
small, smw = R.text("ArchivoBlack", "FATHER & SON  ·  HOT SPRINGS, ARKANSAS", 30, tracking=0.2)
small = R.xform(small, 1, 0, 0, 1, (W - smw) / 2, sb + 232)
rule_y = sb + 168
rules = union(rect(W / 2 - smw / 2, rule_y - 3, W / 2 - 40, rule_y + 3), rect(W / 2 + 40, rule_y - 3, W / 2 + smw / 2, rule_y + 3),
              R.star(W / 2, rule_y, 14))
_, _, _, bottom = R.bbox(small)
H = bottom + 20


def back_svg(tee):
    """Inks per colorway. Cream tee: red + navy (mascot fill is the shirt). Navy tee: cream + red."""
    if tee == "cream":
        layers = [(RED, union(lines, script)), (NAVY, union(star, cons, small, rules))]
    else:
        layers = [(CREAM, union(minus(fill, lines), cons, small, rules)), (RED, union(lines, script, star))]
    body = "".join(f'<path fill="{c}" d="{R.d(p)}"/>' for c, p in layers)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H:.0f}" width="12in" height="{H / 100:.2f}in">{body}</svg>'


# Left-chest MC in the brand script: the M sits high, the C hooks in front of its
# last stroke, and the wordmark's Texas star sits off the M's shoulder. One ink.
_M = glyph("Yellowtail", "M")
_mx0, _my0, _mx1, _ = _M.bounds
MC = union(hook("Yellowtail", 0.30, 0.40, gap=4), R.star(_mx1 + 4, _my0 + 4, 7))


def chest_svg(color):
    x0, y0, x1, y1 = MC.bounds
    pad = 2
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0 - pad:.2f} {y0 - pad:.2f} {w:.2f} {h:.2f}" '
            f'width="2in" height="{2 * h / w:.3f}in"><path fill="{color}" d="{R.d(MC)}"/></svg>')


os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
files = {
    "back-print-cream-tee.svg": back_svg("cream"),
    "back-print-navy-tee.svg": back_svg("navy"),
    "front-chest-navy-ink.svg": chest_svg(NAVY),
    "front-chest-cream-ink.svg": chest_svg(CREAM),
}
for name, svg in files.items():
    open(os.path.join(HERE, "svg", name), "w").write(svg + "\n")

# --- Mockup page: both colorways, front and back.
TEE = ("M150,40 L210,22 Q250,52 290,22 L350,40 L440,110 L395,175 L360,150 L360,470 "
       "L140,470 L140,150 L105,175 L60,110 Z")


def tee(color, collar, art, back=False):
    neck = ('<path d="M210,22 Q250,34 290,22" fill="none" stroke="%s" stroke-width="7"/>' % collar if back
            else '<path d="M210,22 Q250,52 290,22" fill="none" stroke="%s" stroke-width="7"/>' % collar)
    return (f'<svg viewBox="40 0 420 490" style="width:100%;height:auto;display:block">'
            f'<path d="{TEE}" fill="{color}" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>{neck}{art}</svg>')


def art(svg_text, x, y, w):
    vb = svg_text.split('viewBox="')[1].split('"')[0].split()
    vw, vh = float(vb[2]), float(vb[3])
    inner = svg_text[svg_text.index(">") + 1:svg_text.rindex("</svg>")]
    return f'<svg x="{x}" y="{y}" width="{w}" height="{w * vh / vw:.1f}" viewBox="{" ".join(vb)}">{inner}</svg>'


tiles = ""
for name, color, collar, front_ink, back in (("Cream tee", "#EFE6D3", "#e2d6bf", NAVY, files["back-print-cream-tee.svg"]),
                                             ("Navy tee", NAVY, "#16202c", CREAM, files["back-print-navy-tee.svg"])):
    front = chest_svg(front_ink)
    tiles += f'''<div class="pair"><div class="lab">{name}</div><div class="tees">
<div class="t">{tee(color, collar, art(front, 288, 92, 40))}<span>Front · left chest, 2" wide</span></div>
<div class="t">{tee(color, collar, art(back, 178, 96, 144), back=True)}<span>Back · 12" wide</span></div></div></div>'''

page = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#E9E0D0;color:{NAVY};font-family:Inter,sans-serif}}
.w{{width:1500px;padding:60px 80px;box-sizing:border-box}}
.top{{display:flex;justify-content:space-between;border-bottom:1.5px solid {NAVY};padding-bottom:18px;margin-bottom:30px}}
h1{{font:700 15px Inter;letter-spacing:.32em;text-transform:uppercase;margin:0}} .m{{font:600 13px Inter;letter-spacing:.22em;text-transform:uppercase;opacity:.6}}
.pair{{margin-bottom:34px}} .lab{{font:700 12px Inter;letter-spacing:.28em;text-transform:uppercase;opacity:.7;margin-bottom:14px}}
.tees{{display:grid;grid-template-columns:1fr 1fr;gap:22px}}
.t{{background:#F4EEE3;border-radius:6px;padding:26px 60px 18px;text-align:center}}
.t span{{font:500 13px Inter;opacity:.6}}
</style></head><body><div class="w"><div class="top"><h1>Mayo's Construction · Merch tee</h1><div class="m">Two colorways · Two inks each</div></div>
{tiles}</div></body></html>"""
open(os.path.join(HERE, "tee-mockup.html"), "w").write(page)
print("ok", f"back print 12 x {H / 100:.2f} in")

# Final MC monogram (round 4D, Fashion Serif hook) as production files.
#   final/svg  - vector masters sized to print width (white, black; print and embroidery)
#   final/*.html - pages the render step turns into PNG and PDF
import os
from mono import *

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "final")
os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)

def mark(gap=3, grow_by=0.0):
    M = glyph('BodoniModa', 'M')
    mx0, my0, mx1, _ = M.bounds
    C0 = glyph('BodoniModa', 'C')
    x = mx1 - 0.29 * (mx1 - mx0) - C0.bounds[0]
    p = front(glyph('BodoniModa', 'C', x=x, y=0.45 * -my0), M, gap)
    return clean(grow(p, grow_by) if grow_by else p)

# Print master is the approved mark. Embroidery version: hairlines ~1.2 mm and a
# ~1.3 mm gap at 2" wide, so stitches hold (thick strokes barely change).
VERSIONS = {"print": mark(), "embroidery": mark(gap=4.6, grow_by=0.55)}

def svg(p, color, width_in=None, pad=0.0):
    x0, y0, x1, y1 = p.bounds
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    pen = SVGPathPen(None, ntos=lambda v: f"{v:.3f}".rstrip("0").rstrip("."))
    p.draw(TransformPen(pen, (1, 0, 0, 1, -x0 + pad, -y0 + pad)))
    size = f' width="{width_in}in" height="{width_in * h / w:.4f}in"' if width_in else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.3f} {h:.3f}"{size}>'
            f'<title>Mayo\'s Construction MC monogram</title><path fill="{color}" d="{pen.getCommands()}"/></svg>\n')

for name, p in VERSIONS.items():
    for color, cname in (("#ffffff", "white"), ("#000000", "black")):
        with open(os.path.join(OUT, "svg", f"mc-monogram-{name}-{cname}.svg"), "w") as f:
            f.write(svg(p, color))
        with open(os.path.join(OUT, "svg", f"mc-monogram-{name}-{cname}-2in.svg"), "w") as f:
            f.write(svg(p, color, width_in=2.0))

# Spec sheet: the mark, clear space, sizes, placement, and the file list.
P = VERSIONS["print"]
x0, y0, x1, y1 = P.bounds
w, h = x1 - x0, y1 - y0
inline = lambda color, px: svg(P, color).replace("<svg ", f'<svg style="width:{px}px;height:auto;display:block" ', 1)
clear = 0.25 * h   # clear space = a quarter of the mark's height on every side
sheet = f"""<!doctype html><html><head><meta charset="utf-8"><style>
 body{{margin:0;background:#0b0b0b;color:#fff;font-family:Inter,sans-serif}}
 .w{{width:1500px;padding:70px 80px 60px;box-sizing:border-box}}
 .top{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #2a2a2a;padding-bottom:22px;margin-bottom:34px}}
 h1{{font:600 15px Inter;letter-spacing:.32em;text-transform:uppercase;margin:0}}
 .meta{{font:500 13px Inter;letter-spacing:.22em;text-transform:uppercase;color:#8a8a8a}}
 .row{{display:grid;grid-template-columns:1.25fr 1fr;gap:22px}}
 .panel{{background:#000;border:1px solid #1d1d1d;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center}}
 .light{{background:#f4f1ea}}
 h2{{font:600 13px Inter;letter-spacing:.24em;text-transform:uppercase;color:#bbb;margin:0 0 14px}}
 .specs{{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:22px}}
 .spec{{background:#000;border:1px solid #1d1d1d;padding:28px 30px}}
 .spec p,.spec li{{font:400 14.5px/1.6 Inter;color:#a5a5a5;margin:0}}
 .spec ul{{margin:0;padding-left:18px}}
 .spec b{{color:#fff;font-weight:600}}
 .cs{{position:relative;padding:{clear/h*220:.0f}px;border:1px dashed #555}}
 .cs span{{position:absolute;font:500 11px Inter;color:#777;letter-spacing:.1em}}
</style></head><body><div class="w">
<div class="top"><h1>Mayo's Construction · MC Monogram</h1><div class="meta">Final · Usage and production</div></div>
<div class="row">
 <div class="panel" style="padding:70px">{inline("#fff", 420)}</div>
 <div style="display:grid;grid-template-rows:1fr 1fr;gap:22px">
  <div class="panel light">{inline("#000", 210)}</div>
  <div class="panel"><div class="cs">{inline("#fff", 220 * w / h)}<span style="top:6px;left:8px">CLEAR SPACE</span></div></div>
 </div>
</div>
<div class="specs">
 <div class="spec"><h2>Size</h2><p><b>Left chest:</b> 2" wide (1.67" tall). <b>Minimum:</b> 1.5" wide for screen print and heat press, and 2" wide for embroidery. <b>Clear space:</b> keep a quarter of the mark's height empty on every side.</p></div>
 <div class="spec"><h2>Placement</h2><p>Wearer's left chest. Center the mark about <b>3.5–4"</b> to the left of the front center line, with its top about <b>7–8"</b> below the highest point of the shoulder. Check it on an adult medium before running the order.</p></div>
 <div class="spec"><h2>Color</h2><p><b>White on black</b> is the main version. Black on light colors is the alternate. One solid color only: no gradients, outlines, or shadows.</p></div>
</div>
<div class="specs" style="grid-template-columns:1fr 1fr">
 <div class="spec"><h2>Screen print and heat press</h2><ul><li>Use the <b>print</b> files.</li><li>The thinnest lines are about 0.8 mm at 2" wide. Ask for a fine-line screen (about 230 mesh) or DTF transfer.</li></ul></div>
 <div class="spec"><h2>Embroidery</h2><ul><li>Use the <b>embroidery</b> files. The hairlines and the gap around the C are thickened to about 1.2–1.3 mm so the stitches hold.</li><li>Ask the digitizer for satin stitch on the thin strokes, with no underlay on the hairlines.</li></ul></div>
</div>
</div></body></html>"""
open(os.path.join(OUT, "spec-sheet.html"), "w").write(sheet)

# Pages for PNG and PDF exports.
for name, p in VERSIONS.items():
    for color, cname in (("#ffffff", "white"), ("#000000", "black")):
        with open(os.path.join(OUT, f"_{name}-{cname}.html"), "w") as f:
            f.write(f'<!doctype html><html><body style="margin:0;background:transparent">{svg(p, color, width_in=2.0)}</body></html>')
print(f"ink {w:.1f} x {h:.1f} units")

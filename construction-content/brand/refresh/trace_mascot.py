# Traces the mascot from the original high-res logo (source/mayos-logo-original-square.png)
# into two vector layers: mascot-lines.d (the ink outlines) and mascot-fill.d (his
# silhouette with a cream sticker edge), plus mascot-box.txt (their bounding box).
# Coordinates are in the source image's pixels.
import os

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage

OUT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(OUT, "source", "mayos-logo-original-square.png")
CX, CY = 622, 640          # centre of the old round badge
S = 2                      # trace at 2x for smoother curves

im = Image.open(SRC).convert("RGBA")
W, H = im.size
a = np.asarray(im.resize((W * S, H * S), Image.LANCZOS)).astype(float)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
lum = 0.299 * r + 0.587 * g + 0.114 * b
yy, xx = np.mgrid[0:H * S, 0:W * S] / S
rr = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)

dark = (lum < 95) & (al > 128)
redbg = (r > 120) & (g < 110) & (b < 100) & (r - g > 60)
capzone = (yy < 250) & (xx > 380) & (xx < 860)
ring = (rr > 455) & ~capzone                       # the old badge's border and cream band
# The border arc merges into the top of the cap: drop anything above-left of the
# cap's crown line, from (430, 215) to (590, 78).
ring |= (rr > 440) & (xx < 600) & (yy < 215 - 0.856 * (xx - 430) - 4)
cut = (yy > 642) | ((xx > 800) & (yy > 600))   # old "Mayo's" lettering; leaves a straight bottom
# Background = everything light reachable from the image edge. The cap is closed off
# by its own outline, so it stays even though it's the same cream.
lab, _ = ndimage.label(~dark | (al <= 128))
edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
outside = np.isin(lab, edge[edge > 0])
body = ~outside & ~redbg & ~ring & ~cut & (al > 128)
body = ndimage.binary_opening(body, iterations=3 * S)
lab, n = ndimage.label(body)
sizes = ndimage.sum(body, lab, range(1, n + 1))
body = ndimage.binary_fill_holes(lab == (1 + int(np.argmax(sizes))))
body = ndimage.binary_dilation(body, iterations=7 * S)          # cream sticker edge around him
lines = dark & ndimage.binary_erosion(body, iterations=7 * S)


def trace(mask, turd):
    bm = potrace.Bitmap(~mask)  # potracer traces the unset pixels
    path = bm.trace(turdsize=turd, alphamax=1.0, opticurve=True, opttolerance=0.2)
    d = []
    for c in path:
        st = c.start_point
        d.append(f"M{st.x / S:.1f},{st.y / S:.1f}")
        for seg in c:
            if seg.is_corner:
                d.append(f"L{seg.c.x / S:.1f},{seg.c.y / S:.1f}L{seg.end_point.x / S:.1f},{seg.end_point.y / S:.1f}")
            else:
                d.append(f"C{seg.c1.x / S:.1f},{seg.c1.y / S:.1f} {seg.c2.x / S:.1f},{seg.c2.y / S:.1f} {seg.end_point.x / S:.1f},{seg.end_point.y / S:.1f}")
        d.append("Z")
    return "".join(d)


open(os.path.join(OUT, "mascot-lines.d"), "w").write(trace(lines, 20))
open(os.path.join(OUT, "mascot-fill.d"), "w").write(trace(body, 200))
ys, xs = np.nonzero(body)
x0, x1, y0, y1 = xs.min() / S, xs.max() / S, ys.min() / S, ys.max() / S
open(os.path.join(OUT, "mascot-box.txt"), "w").write(f"{x0:.1f} {y0:.1f} {x1 - x0:.1f} {y1 - y0:.1f}\n")
print("box", x0, y0, x1 - x0, y1 - y0)

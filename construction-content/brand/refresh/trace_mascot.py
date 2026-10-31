# Traces the mascot from the original logo (public/logo.png) into two vector layers:
# mascot-lines.d (the ink outlines) and mascot-fill.d (his silhouette, for the fill color).
import os
OUT = os.path.dirname(os.path.abspath(__file__))
import numpy as np, potrace
from PIL import Image, ImageFilter
im = Image.open('/home/user/Isaiah-Mayo/public/logo.png').convert('RGBA')
S = 6
big = im.resize((320*S, 320*S), Image.LANCZOS)
a = np.asarray(big).astype(float)
r, g, b, al = a[...,0], a[...,1], a[...,2], a[...,3]
lum = 0.299*r + 0.587*g + 0.114*b
sat = a[...,:3].max(-1) - a[...,:3].min(-1)
yy, xx = np.mgrid[0:320*S, 0:320*S] / S
from scipy import ndimage
rr = np.sqrt((xx-160)**2 + (yy-160)**2)
dark = (lum < 95) & (al > 128)
redbg = (r > 120) & (g < 110) & (b < 100) & (r - g > 60)
capzone = (yy < 72) & (xx > 92) & (xx < 228)
ring = (rr > 126) & ~capzone                      # the old badge's border and cream edge
cut = (yy > 178) | ((xx > 192) & (yy > 138)) | ((xx < 92) & (yy > 150))   # old "Mayo's" lettering
# Background = everything light reachable from the image edge (this keeps the cap,
# which is closed off by its own outline, even though it's the same cream).
light_px = ~dark | (al <= 128)
lab, _ = ndimage.label(light_px)
edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
outside = np.isin(lab, edge[edge > 0])
body = ~outside & ~redbg & ~ring & ~cut & (al > 128)
body = ndimage.binary_opening(body, iterations=2*S)
lab, n = ndimage.label(body); sizes = ndimage.sum(body, lab, range(1, n+1))
body = ndimage.binary_fill_holes(lab == (1 + int(np.argmax(sizes))))
body = ndimage.binary_dilation(body, iterations=2*S)   # cream sticker edge around him
light = body
lines = dark & ndimage.binary_erosion(body, iterations=2*S)
def trace(mask, turd=40):
    bm = potrace.Bitmap(~mask)  # potracer traces the unset pixels
    path = bm.trace(turdsize=turd*S, alphamax=1.1, opticurve=True, opttolerance=0.3)
    d = []
    for c in path:
        st = c.start_point
        d.append(f"M{st.x/S:.2f},{st.y/S:.2f}")
        for seg in c:
            if seg.is_corner:
                d.append(f"L{seg.c.x/S:.2f},{seg.c.y/S:.2f}L{seg.end_point.x/S:.2f},{seg.end_point.y/S:.2f}")
            else:
                d.append(f"C{seg.c1.x/S:.2f},{seg.c1.y/S:.2f} {seg.c2.x/S:.2f},{seg.c2.y/S:.2f} {seg.end_point.x/S:.2f},{seg.end_point.y/S:.2f}")
        d.append("Z")
    return "".join(d)
L, F = trace(lines, 8), trace(light, 30)
open(os.path.join(OUT, 'mascot-lines.d'),'w').write(L); open(os.path.join(OUT, 'mascot-fill.d'),'w').write(F)

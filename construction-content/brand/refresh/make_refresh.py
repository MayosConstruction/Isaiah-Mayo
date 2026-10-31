# Mayo's Construction brand refresh: script wordmark, mascot avatar, circle badge,
# palette, and mockups. Everything is vector (text converted to outlines) so the SVGs
# in svg/ go straight to a printer, sign shop, or embroiderer.
# Run trace_mascot.py first; then: python3 make_refresh.py
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from mono import *  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402

RED, CREAM, NAVY = "#C4553B", "#F3EBDD", "#1E2A3A"
MASCOT_LINES = open(os.path.join(HERE, "mascot-lines.d")).read()
MASCOT_FILL = open(os.path.join(HERE, "mascot-fill.d")).read()
MASCOT_BOX = (58, 12, 168, 168)   # x, y, w, h of the traced mascot in its own coordinates


def xform(p, a, b, c, d, e, f):
    out = pathops.Path()
    p.draw(TransformPen(out.getPen(), (a, b, c, d, e, f)))
    return out


def text(font, s, size=100, x=0, y=0, tracking=0.0):
    """Outlined text; returns (path, advance width)."""
    f = TTFont(os.path.join(FONTS, font + ".ttf"))
    cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    p, cx = pathops.Path(), x
    for ch in s:
        if ch != " ":
            p = union(p, glyph(font, ch, size, x=cx, y=y))
        cx += hmtx[cmap[ord(ch)]][0] * size / upm + tracking * size
    return p, cx - x - tracking * size


def star(cx, cy, r, inner=0.42, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * inner
        t = math.radians(rot + i * 36)
        pts.append((cx + rr * math.cos(t), cy + rr * math.sin(t)))
    return poly(pts)


def d(p):
    pen = SVGPathPen(None, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    p.draw(pen)
    return pen.getCommands()


def bbox(*ps):
    bs = [p.bounds for p in ps]
    return min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)


# --- Wordmark: "Mayo★s" in a sign-painter script, the apostrophe a Texas star,
# with a wide "CONSTRUCTION" set under it.
mayo, w1 = text("Yellowtail", "Mayo")
s_, w2 = text("Yellowtail", "s", x=w1 + 6)
script = union(mayo, s_)
STAR = star(w1 + 1.5, -56, 8.5)
sx0, _, sx1, sy1 = bbox(script, STAR)
cons, cw = text("ArchivoBlack", "CONSTRUCTION", 15.5, tracking=0.16)
cons = xform(cons, 1, 0, 0, 1, sx0 + (sx1 - sx0 - cw) / 2 + 4, sy1 + 24)
WORDMARK = {"script": script, "star": STAR, "cons": cons}


def wordmark_svg(script_c, star_c, cons_c, pad=6, bg=None):
    x0, y0, x1, y1 = bbox(script, STAR, cons)
    x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    back = f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}">{back}'
            f'<path fill="{script_c}" d="{d(script)}"/><path fill="{star_c}" d="{d(STAR)}"/>'
            f'<path fill="{cons_c}" d="{d(cons)}"/></svg>')


def mascot_g(cx, cy, h, fill, ink):
    """The mascot, scaled to height h with his centre at (cx, cy)."""
    bx, by, bw, bh = MASCOT_BOX
    s = h / bh
    return (f'<g transform="translate({cx - (bx + bw / 2) * s:.2f},{cy - (by + bh / 2) * s:.2f}) scale({s:.4f})">'
            f'<path fill="{fill}" fill-rule="evenodd" d="{MASCOT_FILL}"/>'
            f'<path fill="{ink}" fill-rule="evenodd" d="{MASCOT_LINES}"/></g>')


# --- Avatar: the mascot cropped by a red circle, like a profile picture.
def avatar_svg(bg=RED, fill=CREAM, ink=RED):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><clipPath id="av"><circle cx="100" cy="100" r="100"/></clipPath></defs>'
            f'<g clip-path="url(#av)"><circle cx="100" cy="100" r="100" fill="{bg}"/>{mascot_g(104, 112, 184, fill, ink)}</g></svg>')


# --- Badge: mascot in a red disc, ringed with lettering and stars. For hat patches.
def arc_text(s, r, size, bottom=False, font="ArchivoBlack", tracking=0.12):
    """Text centred on the top of a circle (reading clockwise), or on the bottom
    (reading left to right, right side up)."""
    f = TTFont(os.path.join(FONTS, font + ".ttf"))
    cmap, hmtx, upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    advs = [hmtx[cmap[ord(ch)]][0] * size / upm + tracking * size for ch in s]
    span = (sum(advs) - tracking * size) / r
    ang = -span / 2
    out = pathops.Path()
    for ch, adv in zip(s, advs):
        mid = ang + (adv - tracking * size) / 2 / r
        if ch != " ":
            g = glyph(font, ch, size)
            g = xform(g, 1, 0, 0, 1, -hmtx[cmap[ord(ch)]][0] * size / upm / 2, 0)
            if bottom:
                t = math.pi - mid          # left-to-right across the bottom
                rot = t - math.pi
            else:
                t, rot = mid, mid
            c, s_ = math.cos(rot), math.sin(rot)
            out = union(out, xform(g, c, s_, -s_, c, r * math.sin(t), -r * math.cos(t)))
        ang += adv / r
    return out


RING = union(arc_text("MAYO'S CONSTRUCTION", 79, 12.5, tracking=0.1),
             arc_text("FATHER & SON", 88.5, 12.5, tracking=0.1, bottom=True),
             star(-83.5, 4, 5.5), star(83.5, 4, 5.5))


def badge_svg(ring_bg=NAVY, ring_ink=CREAM, disc=RED, fill=CREAM, ink=RED):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200"><defs><clipPath id="bd"><circle r="64"/></clipPath></defs>'
            f'<circle r="99" fill="{ring_bg}"/><circle r="94" fill="none" stroke="{ring_ink}" stroke-width="1.6"/>'
            f'<path fill="{ring_ink}" d="{d(RING)}"/>'
            f'<circle r="66" fill="{ring_ink}"/><g clip-path="url(#bd)"><circle r="64" fill="{disc}"/>{mascot_g(4, 14, 126, fill, ink)}</g></svg>')


def save(name, svg):
    os.makedirs(os.path.join(HERE, "svg"), exist_ok=True)
    with open(os.path.join(HERE, "svg", name), "w") as f:
        f.write(svg + "\n")


save("wordmark-red-navy.svg", wordmark_svg(RED, NAVY, NAVY))
save("wordmark-cream.svg", wordmark_svg(CREAM, CREAM, CREAM))
save("wordmark-navy.svg", wordmark_svg(NAVY, NAVY, NAVY))
save("wordmark-on-red.svg", wordmark_svg(CREAM, NAVY, NAVY, pad=30, bg=RED))
save("avatar.svg", avatar_svg())
save("badge.svg", badge_svg())
save("badge-one-color.svg", badge_svg(NAVY, CREAM, NAVY, CREAM, NAVY))
save("mascot-red.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{MASCOT_BOX[0]} {MASCOT_BOX[1]} {MASCOT_BOX[2]} {MASCOT_BOX[3]}"><path fill="{CREAM}" fill-rule="evenodd" d="{MASCOT_FILL}"/><path fill="{RED}" fill-rule="evenodd" d="{MASCOT_LINES}"/></svg>')
print("ok")

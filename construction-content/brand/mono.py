# Monogram toolkit: real glyph outlines from font files, combined with boolean
# path operations, fitted by ink bounds, exported as clean SVG paths.
import os
import pathops
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = os.path.join(os.path.dirname(__file__), "fonts")
_cache = {}

def glyph(font, ch, size=100, x=0, y=0, sx=1.0):
    """Outline of one character, `size` px per em, baseline at y, y pointing down.
    sx widens or narrows the letter."""
    if font not in _cache:
        _cache[font] = TTFont(os.path.join(FONTS, font + ".ttf"))
    f = _cache[font]
    gs = f.getGlyphSet()
    name = f.getBestCmap()[ord(ch)]
    s = size / f["head"].unitsPerEm
    p = pathops.Path()
    gs[name].draw(TransformPen(p.getPen(), (s * sx, 0, 0, -s, x, y)))
    return simplify(p)

def simplify(p):
    return pathops.op(p, pathops.Path(), pathops.PathOp.UNION, fix_winding=True)

def union(*ps):
    out = ps[0]
    for p in ps[1:]:
        out = pathops.op(out, p, pathops.PathOp.UNION, fix_winding=True)
    return out

def minus(a, b):
    return pathops.op(a, b, pathops.PathOp.DIFFERENCE, fix_winding=True)

def inter(a, b):
    return pathops.op(a, b, pathops.PathOp.INTERSECTION, fix_winding=True)

def grow(p, d):
    """p expanded outward by d (used to cut clean gaps)."""
    s = pathops.Path()
    p.draw(s.getPen())
    s.stroke(d * 2, pathops.LineCap.BUTT_CAP, pathops.LineJoin.MITER_JOIN, 4)
    return union(p, s)

def rect(x0, y0, x1, y1):
    p = pathops.Path(); pen = p.getPen()
    pen.moveTo((x0, y0)); pen.lineTo((x1, y0)); pen.lineTo((x1, y1)); pen.lineTo((x0, y1)); pen.closePath()
    return p

def poly(pts):
    p = pathops.Path(); pen = p.getPen()
    pen.moveTo(pts[0])
    for q in pts[1:]:
        pen.lineTo(q)
    pen.closePath()
    return p

def front(top, under, gap):
    """`top` sits in front of `under`, with a clean gap where they cross."""
    return union(top, minus(under, grow(top, gap)))

def clean(p, min_area=20.0):
    """Drop slivers and specks left over from boolean cuts (too small to print)."""
    out = pathops.Path()
    for c in p.contours:
        if abs(c.area) >= min_area:
            c.draw(out.getPen())
    return union(out)

def svg_d(p, box=150, center=100):
    """Fit p's ink bounds into a box x box square centred in a 200 x 200 viewBox."""
    p = clean(p)
    x0, y0, x1, y1 = p.bounds
    s = box / max(x1 - x0, y1 - y0)
    tx = center - (x0 + x1) / 2 * s
    ty = center - (y0 + y1) / 2 * s
    pen = SVGPathPen(None, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    p.draw(TransformPen(pen, (s, 0, 0, s, tx, ty)))
    return pen.getCommands()

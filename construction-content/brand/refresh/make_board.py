# Brand refresh presentation board: the logo system, palette, and mockups
# (Instagram profile, yard sign, business card). Run make_refresh.py first.
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RED, CREAM, NAVY = "#C4553B", "#F3EBDD", "#1E2A3A"


def svg(name):
    s = open(os.path.join(HERE, "svg", name)).read().strip()
    return s.replace("<svg ", '<svg style="width:100%;height:100%;display:block" ', 1)


def inner(name):
    """The drawing inside an SVG file, for nesting in a mockup."""
    s = open(os.path.join(HERE, "svg", name)).read()
    vb = s.split('viewBox="')[1].split('"')[0]
    return vb, s[s.index(">") + 1:s.rindex("</svg>")]


def nest(name, x, y, w, h):
    vb, body = inner(name)
    return f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="{vb}">{body}</svg>'


photos = "".join(f'<div class="ph" style="background-image:url(photos/p{i}.jpg)"></div>' for i in range(1, 7))
highlights = "".join(f'''<div class="hl"><div class="ring"><div class="dot">{icon}</div></div><span>{label}</span></div>'''
                     for icon, label in [(svg("avatar.svg"), "Jobs"),
                                         ('<svg viewBox="-10 -10 20 20" style="width:56%;height:56%"><polygon fill="#F3EBDD" points="0,-9 2.1,-2.9 8.6,-2.8 3.4,1.1 5.3,7.3 0,3.6 -5.3,7.3 -3.4,1.1 -8.6,-2.8 -2.1,-2.9"/></svg>', "Reviews"),
                                         (svg("badge-one-color.svg"), "Merch"),
                                         ('<span style="font:400 30px Yellowtail;color:#F3EBDD;margin-top:-4px">Free</span>', "Estimates")])

# A yard sign on wire stakes, the kind that goes in the customer's lawn during a job.
hat = f'''<svg viewBox="0 0 400 260" style="width:100%;height:100%">
  <path d="M150,200 L150,256 M250,200 L250,256" stroke="#8a8a8a" stroke-width="4"/>
  <rect x="70" y="14" width="260" height="188" rx="4" fill="{RED}"/>
  {nest("wordmark-cream.svg", 100, 30, 200, 104)}
  <rect x="100" y="148" width="200" height="38" rx="3" fill="{CREAM}"/>
  <text x="200" y="164" text-anchor="middle" font-family="Archivo Black, Inter" font-weight="900" font-size="10.5" letter-spacing="1.6" fill="{NAVY}">FREE ESTIMATES</text>
  <text x="200" y="180" text-anchor="middle" font-family="Archivo Black, Inter" font-weight="900" font-size="13" letter-spacing="1" fill="{RED}">870-617-3507</text>
</svg>'''

card_front = f'''<div class="card" style="background:{CREAM}"><div style="width:62%;margin:0 auto">{svg("wordmark-red-navy.svg")}</div>
<div class="ci">Isaiah Mayo &nbsp;·&nbsp; 870-617-3507<br>mayosconstruction.netlify.app</div></div>'''
card_back = f'''<div class="card" style="background:{RED};display:flex;align-items:center;justify-content:center"><div style="width:44%">{svg("badge.svg")}</div></div>'''

ig = f'''<div class="ig">
  <div class="igtop"><div class="av">{svg("avatar.svg")}</div>
    <div><div class="nm">Mayo's Construction</div><div class="st"><b>Father &amp; son</b> · Hot Springs, AR</div></div></div>
  <div class="bio">Repairs are our specialty, and we love building new.<br>When you call, you get one of us.</div>
  <div class="hls">{highlights}</div>
  <div class="grid">{photos}</div>
</div>'''

swatches = "".join(f'<div class="sw"><div class="chip" style="background:{c}"></div><b>{n}</b><span>{c}</span><p>{u}</p></div>'
                   for c, n, u in [(RED, "Ranch Red", "Main color. Wordmark, avatar, truck."),
                                   (CREAM, "Cream", "Backgrounds, the mascot, cards."),
                                   (NAVY, "Navy", "Text, badges, hats and shirts.")])

html = f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yellowtail&family=Archivo+Black&display=swap">
<style>
 body{{margin:0;background:#E9E0D0;color:{NAVY};font-family:Inter,sans-serif}}
 .w{{width:1500px;padding:64px 80px 70px;box-sizing:border-box}}
 .top{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid {NAVY};padding-bottom:20px;margin-bottom:34px}}
 h1{{font:700 15px Inter;letter-spacing:.32em;text-transform:uppercase;margin:0}}
 .meta{{font:600 13px Inter;letter-spacing:.22em;text-transform:uppercase;opacity:.6}}
 h2{{font:700 12px Inter;letter-spacing:.28em;text-transform:uppercase;margin:44px 0 16px;opacity:.7}}
 .hero{{display:grid;grid-template-columns:1.65fr 1fr;gap:22px}}
 .p{{border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center}}
 .row{{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}}
 .row .p{{aspect-ratio:1/1}}
 .sws{{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}}
 .sw .chip{{height:120px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(0,0,0,.08)}}
 .sw b{{font:700 16px Inter;margin-right:10px}} .sw span{{font:500 14px Inter;opacity:.6}}
 .sw p{{font:400 14px/1.5 Inter;margin:6px 0 0;opacity:.75}}
 .apps{{display:grid;grid-template-columns:1fr 1.15fr;gap:22px;align-items:start}}
 .apps>*,.cards>*,.stack>*{{min-width:0}}
 .ig{{background:#0f141b;color:#fff;border-radius:6px;padding:26px 24px 0}}
 .igtop{{display:flex;gap:20px;align-items:center}}
 .av{{width:96px;height:96px;border-radius:50%;overflow:hidden;flex:none;outline:2px solid #2b3440;outline-offset:3px}}
 .nm{{font:700 21px Inter}} .st{{font:400 15px Inter;opacity:.75;margin-top:4px}}
 .bio{{font:400 14.5px/1.5 Inter;opacity:.9;margin:16px 0 18px}}
 .hls{{display:flex;gap:18px;margin-bottom:22px}}
 .hl{{text-align:center;font:500 12px Inter;opacity:.95}}
 .ring{{width:72px;height:72px;border-radius:50%;padding:4px;box-sizing:border-box;background:repeating-conic-gradient({CREAM} 0 10deg,{RED} 10deg 20deg);margin-bottom:6px}}
 .dot{{width:100%;height:100%;border-radius:50%;background:{RED};border:3px solid #0f141b;box-sizing:border-box;overflow:hidden;display:flex;align-items:center;justify-content:center}}
 .grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin:0 -24px}}
 .ph{{aspect-ratio:1/1;background-size:cover;background-position:center}}
 .stack{{display:grid;grid-template-rows:auto auto;gap:22px}}
 .hat{{background:{CREAM};border-radius:6px;height:300px;padding:26px 40px 18px;box-sizing:border-box}}
 .cards{{display:grid;grid-template-columns:1fr 1fr;gap:22px}}
 .card{{aspect-ratio:3.5/2;border-radius:6px;box-shadow:0 10px 30px rgba(30,42,58,.18);padding:28px 22px 18px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center}}
 .ci{{font:600 12.5px/1.6 Inter;text-align:center;margin-top:14px;color:{NAVY}}}
 .notes{{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:6px}}
 .notes p{{font:400 14.5px/1.55 Inter;margin:0}} .notes b{{display:block;font:700 13px Inter;letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px}}
</style></head><body><div class="w">
<div class="top"><h1>Mayo's Construction</h1><div class="meta">Brand refresh · Logo system</div></div>
<div class="hero">
  <div class="p" style="background:{CREAM};padding:70px 90px">{svg("wordmark-red-navy.svg")}</div>
  <div class="p" style="background:{CREAM};padding:46px">{svg("avatar.svg")}</div>
</div>
<div class="row" style="margin-top:22px">
  <div class="p" style="background:{CREAM};padding:28px">{svg("badge.svg")}</div>
  <div class="p" style="background:{RED};padding:34px">{svg("wordmark-cream.svg")}</div>
  <div class="p" style="background:{NAVY};padding:28px">{svg("badge-one-color.svg").replace('#1E2A3A','#C4553B')}</div>
  <div class="p" style="background:{CREAM};padding:40px">{svg("mascot-red.svg")}</div>
</div>
<h2>Palette</h2>
<div class="sws">{swatches}</div>
<h2>In use</h2>
<div class="apps">
  {ig}
  <div class="stack"><div class="hat">{hat}</div><div class="cards">{card_front}{card_back}</div></div>
</div>
<h2>The system</h2>
<div class="notes">
  <p><b>Wordmark</b>The main logo. Hand-painted sign script with a Texas star for the apostrophe, over a wide "CONSTRUCTION". Use it on the truck, signs, hats and estimates.</p>
  <p><b>Mascot avatar</b>Your same guy, cleaned up into two colors. Use him for the profile picture, stickers and favicon. He works on his own now, without the lettering on top of him.</p>
  <p><b>Badge</b>For hat patches, shirt backs and yard signs. It also comes in one color for cheap single-color printing.</p>
</div>
</div></body></html>"""
open(os.path.join(HERE, "brand-board.html"), "w").write(html)
print("ok")

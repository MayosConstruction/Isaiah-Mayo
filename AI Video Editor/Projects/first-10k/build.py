"""First $10K reel, v2. Builds assets + index.html.
Smooth zoom-blur crossfades between story shots, grayscale "employee" section,
fast job montage under a $0 -> $10,000 counter with tick/coin/roll sounds, then family payoff.
Run: ../../Setup/whisper-env/bin/python build.py"""
import os, subprocess, shutil, html
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
ROOT = os.path.dirname(os.path.dirname(HERE))
R = '/home/user/Isaiah-Mayo/construction-content/raw-footage'
U = '/root/.claude/uploads/03d2cb76-e365-5423-89b9-e3b9838ff4f7'
MM = os.path.join(ROOT, 'Projects/mayo-month/assets')
os.makedirs(os.path.join(A, 'fonts'), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
for f in ['BebasNeue.ttf', 'Montserrat-ExtraBold.ttf']:
    shutil.copy(os.path.join(ROOT, 'Signature Style/fonts/pack', f), os.path.join(A, 'fonts'))
SFX = {}
def sfx(name):
    for d in ['Setup/sfx-made', 'Setup/sound-effects']:
        p = os.path.join(ROOT, d, name + '.mp3')
        if os.path.exists(p):
            shutil.copy(p, A); return f'assets/{name}.mp3'
    raise SystemExit(name)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
def probe(src, sel):
    return subprocess.run(['ffprobe', '-v', 'error', '-select_streams', sel, '-show_entries', 'stream=index,color_transfer', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip()

OV = 0.22  # crossfade overlap
# (src, in, dur, opts)  opts: rate, vol, gray, crop, cut(hard cut, no blend)
STORY = [
    (f'{R}/IMG_2454.mov', 0.0, 3.0, dict(rate=0.48)),                     # hook walk
    (f'{R}/IMG_3101.mov', 2.0, 1.4, dict(gray=1, vol=0.35)),              # I was a cop
    (f'{R}/IMG_2148.mov', 0.5, 2.2, dict(gray=1)),                        # anxiety, resigned
    (f'{U}/ee8a389e-IMG_4699.mov', 0.3, 1.4, dict(gray=1)),               # banker
    (f'{U}/ee8a389e-IMG_4699.mov', 1.8, 2.0, dict(gray=1)),               # not me
    (f'{R}/IMG_3101.mov', 6.0, 1.7, dict(gray=1, vol=0.35)),              # back to cop
    (f'{R}/IMG_2148.mov', 3.0, 1.8, dict(gray=1)),                        # same paycheck
    (f'{R}/IMG_4458.mov', 0.3, 2.0, dict(cut=1, vol=0.3)),                # bet on myself (color)
    (f'{R}/IMG_2236.mov', 0.5, 1.8, dict(vol=0.4)),                       # day 1 $0
    (f'{R}/IMG_2239.mov', 0.0, 0.7, dict(vol=0.4)), (f'{R}/IMG_2235.mov', 0.3, 0.7, dict(vol=0.4)),
    (f'{R}/IMG_2417.mov', 1.0, 0.8, {}), (f'{R}/IMG_2148.mov', 6.0, 0.8, {}),
    (f'{R}/IMG_4467.mov', 4.0, 0.7, dict(vol=0.6)), (f'{R}/IMG_4464.mov', 6.8, 0.7, dict(vol=0.7)),
    (f'{R}/IMG_4462.mov', 0.6, 0.7, dict(vol=0.6)), (f'{U}/18e009f9-IMG_2547.mov', 0.5, 0.7, dict(vol=0.4)),
    (f'{R}/IMG_2548.mov', 0.0, 0.9, dict(vol=0.5)),                       # and then...
]
MONTAGE = [
    (f'{R}/IMG_4460.mov', 0.5), (f'{U}/f811d03a-image.jpg', 0), (f'{R}/IMG_2236.mov', 1.5), (f'{U}/08bebf6e-image.jpg', 0),
    (f'{R}/IMG_2624.mov', 2.5), (f'{R}/IMG_2340.mov', 2.5), (f'{MM}/slider-b.jpg', 0), (f'{R}/IMG_3094.mov', 40.0),
    (f'{R}/286CBA62-05B5-407D-BB65-7426E54C714D.mov', 2.5), (f'{MM}/door-b.jpg', 0), (f'{R}/IMG_2241.mov', 2.0),
    (f'{MM}/fan-b.jpg', 0), (f'{U}/18e009f9-IMG_2547.mov', 3.0), (f'{U}/ba9abc44-image.jpg', 0),
]
END = [
    (f'{R}/IMG_4464.mov', 1.0, 2.0, dict(vol=0.5)),                       # build with my dad
    (f'{R}/IMG_2248.mov', 3.5, 1.2, {}),                                  # home for my boys
    (f'{R}/IMG_0068.mov', 8.0, 1.2, {}),
    (f'{R}/IMG_2248.mov', 4.4, 4.2, {}),                                  # paycheck won't + follow
]

def prep(src, t_in, dur, name, rate=1.0, vol=0, **_):
    if src.lower().endswith(('.jpg', '.png')):
        shutil.copy(src, os.path.join(A, name + '.jpg')); return f'assets/{name}.jpg', None
    tr = probe(src, 'v:0').split(',')[-1]
    vf = (TONEMAP if tr in ('arib-std-b67', 'smpte2084') else '') + f"setpts=PTS/{rate},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur * rate + 0.4), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', os.path.join(A, name + '.mp4')], check=True)
    nat = None
    if vol and probe(src, 'a:0'):
        af = f"atempo={max(0.5, min(2.0, rate))},afade=t=in:d=0.05,afade=t=out:st={max(0, dur - 0.1):.2f}:d=0.1,loudnorm=I=-18:TP=-2"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur * rate + 0.1), '-vn', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, name + '.m4a')], check=True)
        nat = f'assets/{name}.m4a'
    return f'assets/{name}.mp4', nat

els, js, aud = [], [], []
def audio(t, src, vol, dur=1.6):
    aud.append((round(t, 3), src, vol, dur))
def media_el(id, src, start, dur, extra=''):
    if src.endswith('.jpg'):
        return f'      <img id="{id}" class="clip shot"{extra} src="{src}" data-start="{start:.3f}" data-duration="{dur:.3f}" data-track-index="0" />'
    return f'      <video id="{id}" class="clip shot"{extra} src="{src}" muted playsinline data-start="{start:.3f}" data-duration="{dur:.3f}" data-media-start="0" data-track-index="0"></video>'

def story(shots, t, prefix):
    for i, (src, tin, d, o) in enumerate(shots):
        path, nat = prep(src, tin, d + OV, f'{prefix}{i}', **o)
        blend = (t > 0) and not o.get('cut')
        start = t - OV if blend else t
        base = 'grayscale(1) contrast(1.15)' if o.get('gray') else 'grayscale(0) contrast(1)'
        sid = f'{prefix}{i}'
        els.append(media_el(sid, path, start, d + (OV if blend else 0), f' style="filter:{base}"'))
        js.append(f'      tl.fromTo("#{sid}", {{ scale: 1.12 }}, {{ scale: 1, duration: {d + OV:.2f}, ease: "power2.out", immediateRender: false }}, {start:.3f});')
        if blend:
            js.append(f'      tl.fromTo("#{sid}", {{ opacity: 0, filter: "blur(14px) {base}" }}, {{ opacity: 1, filter: "blur(0px) {base}", duration: {OV}, ease: "power1.out", immediateRender: false }}, {start:.3f});')
            audio(start, sfx('whoosh-short'), 0.3)
        if nat: audio(t, nat, o['vol'], d)
        t += d
    return t

t = story(STORY, 0.0, 's')
# MONEY MONTAGE: accelerating flashes under the counter
M0 = t; MD = 3.2
w = [0.92 ** k for k in range(len(MONTAGE))]; durs = [MD * x / sum(w) for x in w]
for k, ((src, tin), d) in enumerate(zip(MONTAGE, durs)):
    path, _ = prep(src, tin, d, f'm{k}')
    els.append(media_el(f'm{k}', path, t, d))
    js.append(f'      tl.fromTo("#m{k}", {{ scale: 1.18 }}, {{ scale: 1.02, duration: {d:.3f}, ease: "power3.out", immediateRender: false }}, {t:.3f});')
    audio(t, sfx('tick'), 0.55, 0.3)
    if k % 3 == 2: audio(t, sfx('coin'), 0.45, 0.6)
    t += d
# Deck before -> after wipe, counter lands on the reveal
shutil.copy(f'{U}/8da61488-image.jpg', os.path.join(A, 'deck-b.jpg')); shutil.copy(f'{U}/42910d69-image.jpg', os.path.join(A, 'deck-a.jpg'))
W0 = t; LAND = W0 + 0.8; HOLD = 2.0
els.append(media_el('db', 'assets/deck-b.jpg', W0, 0.8 + HOLD))
els.append(media_el('da', 'assets/deck-a.jpg', W0, 0.8 + HOLD))
els.append(f'      <div id="wl" class="clip wipe" data-start="{W0:.3f}" data-duration="0.8" data-track-index="2"></div>')
js.append(f'      tl.fromTo("#da", {{ clipPath: "inset(0 100% 0 0)" }}, {{ clipPath: "inset(0 0% 0 0)", duration: 0.75, ease: "power2.inOut" }}, {W0:.3f});')
js.append(f'      tl.fromTo("#wl", {{ x: 0 }}, {{ x: 1080, duration: 0.75, ease: "power2.inOut" }}, {W0:.3f});')
js.append(f'      tl.fromTo("#da", {{ scale: 1.08 }}, {{ scale: 1, duration: {HOLD + 0.8:.2f}, ease: "power1.out", immediateRender: false }}, {W0:.3f});')
audio(W0, sfx('whoosh-cinematic'), 0.6)
audio(M0, sfx('roll'), 0.7, LAND - M0)
audio(M0 - 1.0, sfx('sweep'), 0.5, 1.2)
audio(LAND, sfx('ching'), 0.9); audio(LAND, sfx('boom'), 0.8); audio(LAND + 0.05, sfx('coin'), 0.6); audio(LAND + 0.15, sfx('sparkle'), 0.5)
t = W0 + 0.8 + HOLD
E0 = t
t = story(END, t, 'e')
total = round(t, 2)

# Text
def esc(x, gold=(), red=False):
    s = html.escape(x).replace('\n', '<br>')
    for g in gold: s = s.replace(html.escape(g), f'<span class="{"red" if red else "y"}">{html.escape(g)}</span>')
    return s
T = []
def line(id, start, dur, text, gold=(), y=640, box=False, sfx_name='pop', shake=False, flash=False, vol=0.55):
    inner = f'<span class="b">{esc(text, gold, red=True)}</span>' if box else esc(text, gold)
    T.append((id, start, dur, inner, 'box' if box else 'line', y))
    if start > 0: js.append(f'      tl.fromTo("#{id}", {{ scale: 1.5, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.18, ease: "power4.out", immediateRender: false }}, {start:.3f});')
    if sfx_name: audio(start, sfx(sfx_name), vol)
    if shake: js.append(f'      tl.fromTo("#cam", {{ x: 0, y: 0 }}, {{ keyframes: [{{ x: -18, y: 10, duration: 0.04 }}, {{ x: 16, y: -12, duration: 0.04 }}, {{ x: -10, y: 6, duration: 0.04 }}, {{ x: 0, y: 0, duration: 0.05 }}], immediateRender: false }}, {start + 0.02:.3f});')
    if flash: js.append(f'      tl.fromTo("#fx", {{ opacity: 0.8 }}, {{ opacity: 0, duration: 0.3, ease: "power2.out", immediateRender: false }}, {start:.3f});')
KIN = []
def kin(id, start, dur, text, gold=(), y=660, sfx_name='click', vol=0.3, shake=False, flash=False, first=0.0):
    words = text.split(' ')
    spans = []
    for k, w in enumerate(words):
        g = any(w.strip('.,:!?') == x.strip('.,:!?') or w == x for x in gold)
        spans.append(f'<span id="{id}w{k}" class="w{" g" if g else ""}">{html.escape(w)}</span>')
        js.append(f'      tl.fromTo("#{id}w{k}", {{ opacity: 0, scale: 1.6, y: 18 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.14, ease: "power4.out", immediateRender: false }}, {start + first + k * 0.11:.3f});')
        if g: audio(start + first + k * 0.11, sfx('pop'), 0.45, 0.4)
    T.append((id, start, dur, ' '.join(spans), 'kin', y))
    if sfx_name: audio(start, sfx(sfx_name), vol)
    if shake: js.append(f'      tl.fromTo("#cam", {{ x: 0, y: 0 }}, {{ keyframes: [{{ x: -18, y: 10, duration: 0.04 }}, {{ x: 16, y: -12, duration: 0.04 }}, {{ x: -10, y: 6, duration: 0.04 }}, {{ x: 0, y: 0, duration: 0.05 }}], immediateRender: false }}, {start + 0.02:.3f});')
    if flash: js.append(f'      tl.fromTo("#fx", {{ opacity: 0.8 }}, {{ opacity: 0, duration: 0.3, ease: "power2.out", immediateRender: false }}, {start:.3f});')
st = [0]
for s_ in STORY: st.append(round(st[-1] + s_[2], 3))
kin('k0', 0, 3.0, "I made $10,000 my first month. Here's how 👇", ['$10,000'], y=640, sfx_name=None, first=0.35)
kin('k1', st[1], 1.4, "I was a cop.", ['cop.'])
kin('k2', st[2], 2.2, "The anxiety got so bad I resigned.", ['anxiety', 'resigned.'], sfx_name='error', vol=0.35)
kin('k3', st[3], 1.4, "So I became a banker.", ['banker.'])
kin('k4', st[4], 2.0, "Nice office. Steady check. Not me.", ['Not', 'me.'])
kin('k5', st[5], 1.7, "So I went back to being a cop.", ['back'])
kin('k6', st[6], 1.8, "Same stress. Same paycheck.", ['stress.', 'paycheck.'], sfx_name='buzzer', vol=0.5, shake=True)
line('l7', st[7], 2.0, "So I bet\non myself.", ['on myself.'], box=True, sfx_name='boom', shake=True, flash=True, vol=0.8)
kin('k8', st[8], 1.8, "Day 1: $0. Zero customers.", ['$0.', 'Zero'], sfx_name='click')
kin('k9', st[9], 1.4, "I took every small job.", ['every'], sfx_name='key-press', vol=0.5, shake=True)
kin('k10', st[11], 1.6, "Knocked doors. Handed out flyers.", ['doors.', 'flyers.'], sfx_name='key-press', vol=0.5, shake=True)
kin('k11', st[13], 1.4, "Posted every job on Facebook.", ['Facebook.'], sfx_name='shutter', vol=0.5, shake=True)
kin('k12', st[15], 1.4, "Said yes to decks and kitchens.", ['yes'], sfx_name='key-press', vol=0.5, shake=True)
kin('k13', st[17], 0.9, "And then...", ['then...'], sfx_name=None)
kin('k14', LAND, HOLD, "in under a month.", ['month.'], y=900, sfx_name=None)
kin('k15', E0, 2.0, "Now I build with my dad.", ['dad.'], y=1150)
kin('k16', E0 + 2.0, 2.4, "And I'm home for my boys.", ['boys.'], y=1150)
line('l17', E0 + 4.4, 2.2, "Your paycheck\nwon't give you that.", ["won't"], y=200, box=True, sfx_name='boom', shake=True, vol=0.8)
kin('k18', E0 + 6.6, total - E0 - 6.6, "Follow if you're ready to bet on yourself.", ['bet', 'on', 'yourself.'], y=1250, sfx_name='pop', vol=0.4)
# Counter
js.append(f'''      const m = {{ v: 0 }};
      tl.fromTo(m, {{ v: 0 }}, {{ v: 10000, duration: {LAND - M0:.3f}, ease: "power2.in", immediateRender: false,
        onUpdate: () => {{ const n = Math.round(m.v / 50) * 50; document.getElementById("money").textContent = "$" + n.toLocaleString("en-US"); }} }}, {M0:.3f});
      tl.fromTo("#money", {{ scale: 0.5, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.25, ease: "back.out(2)", immediateRender: false }}, {M0:.3f});
      tl.fromTo("#money", {{ scale: 1 }}, {{ keyframes: [{{ scale: 1.3, duration: 0.1 }}, {{ scale: 1, duration: 0.3, ease: "back.out(3)" }}], immediateRender: false }}, {LAND:.3f});
      tl.fromTo("#money", {{ color: "#ffffff" }}, {{ color: "#ffd23f", duration: {LAND - M0:.3f}, ease: "none", immediateRender: false }}, {M0:.3f});
      tl.fromTo("#fx", {{ opacity: 0.85 }}, {{ opacity: 0, duration: 0.35, ease: "power2.out", immediateRender: false }}, {LAND:.3f});
      tl.fromTo("#cam", {{ x: 0, y: 0 }}, {{ keyframes: [{{ x: -24, y: 14, duration: 0.04 }}, {{ x: 20, y: -14, duration: 0.04 }}, {{ x: -12, y: 8, duration: 0.04 }}, {{ x: 0, y: 0, duration: 0.06 }}], immediateRender: false }}, {LAND + 0.02:.3f});''')
js.insert(0, '      tl.fromTo("#hook", { scale: 1 }, { keyframes: [{ scale: 1.12, duration: 0.06 }, { scale: 1, duration: 0.22, ease: "back.out(3)" }], immediateRender: false }, 0.02);')
audio(0, sfx('boom'), 0.8)
audio(0.6, sfx('roll'), 0.0, 0.1)  # keep file referenced once early (no-op)
aud = [a for a in aud if a[2] > 0]

texts = "\n".join(f'      <div id="{i}" class="clip {c}" style="top:{y}px" data-start="{s:.3f}" data-duration="{d:.3f}" data-track-index="{4 + k % 2}">{inner}</div>' for k, (i, s, d, inner, c, y) in enumerate(T))
auds = "\n".join(f'      <audio id="a{k}" class="clip" src="{src}" data-start="{s:.3f}" data-duration="{min(d, total - s):.3f}" data-volume="{v}" data-track-index="{8 + k % 6}"></audio>' for k, (s, src, v, d) in enumerate(aud))
doc = f'''<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Bebas"; src: url("assets/fonts/BebasNeue.ttf"); }}
      @font-face {{ font-family: "Montserrat"; src: url("assets/fonts/Montserrat-ExtraBold.ttf"); font-weight: 800; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 1080px; height: 1920px; overflow: hidden; }}
      #cam {{ position: absolute; inset: 0; }}
      .shot {{ position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      .hook {{ position: absolute; top: 240px; left: 50px; right: 50px; text-align: center; z-index: 20; font: 400 128px/1.22 "Bebas", sans-serif; }}
      .hook span.b, .box span.b {{ background: #fff; color: #111; padding: 4px 26px 0; border-radius: 16px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }}
      .red {{ color: #c4553b; }}
      .line {{ position: absolute; left: 60px; right: 60px; text-align: center; z-index: 18; color: #fff; font: 800 76px/1.16 "Montserrat", sans-serif; text-transform: uppercase; text-wrap: balance;
        -webkit-text-stroke: 10px #000; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0,0,0,.55); }}
      .box {{ position: absolute; left: 50px; right: 50px; text-align: center; z-index: 18; font: 400 116px/1.22 "Bebas", sans-serif; }}
      .y {{ color: #ffd23f; }}
      .kin {{ position: absolute; left: 60px; right: 60px; text-align: center; z-index: 18; color: #fff; font: 800 80px/1.2 "Montserrat", sans-serif; text-transform: uppercase; text-wrap: balance;
        -webkit-text-stroke: 11px #000; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0,0,0,.55); }}
      .kin .w {{ display: inline-block; }}
      .kin .g {{ color: #ffd23f; font-size: 1.22em; }}
      .money {{ position: absolute; top: 560px; left: 0; right: 0; text-align: center; z-index: 22; font: 400 270px/1 "Bebas", sans-serif; color: #ffd23f;
        -webkit-text-stroke: 14px #000; paint-order: stroke fill; text-shadow: 0 10px 30px rgba(0,0,0,.6); font-variant-numeric: tabular-nums; }}
      .wipe {{ position: absolute; top: 0; bottom: 0; left: 0; width: 10px; margin-left: -5px; background: #fff; z-index: 12; box-shadow: 0 0 24px rgba(0,0,0,.5); }}
      .flash {{ position: absolute; inset: 0; background: #fff; z-index: 30; opacity: 0; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
      <div id="cam">
{chr(10).join(els)}
      </div>
      <div id="fx" class="clip flash" data-start="0" data-duration="{total}" data-track-index="3"></div>
      <div id="hook" class="clip hook" data-start="0" data-duration="3.0" data-track-index="3"><span class="b">Your paycheck is<br><span class="red">keeping you broke</span></span></div>
      <div id="money" class="clip money" data-start="{M0:.3f}" data-duration="{LAND + HOLD - M0:.3f}" data-track-index="6">$0</div>
{texts}
{auds}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
open(os.path.join(HERE, 'index.html'), 'w').write(doc)
print('total', total, 'montage', round(M0, 2), 'land', round(LAND, 2), 'end', round(E0, 2))

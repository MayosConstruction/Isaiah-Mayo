"""First $10K reel, v4 ("heart" cut).
- Hook calls out the viewer who is struggling.
- One shot per story beat, slow push-ins, soft crossfades (no cut-per-line).
- Past (cop / banker) in the Film Memory grade; present in a light warm grade.
- Organic light leak on the turn ("So I bet on myself").
- Captions fade up phrase by phrase (no pops per word). Sound only where it means something:
  heartbeat under the struggle, riser + boom on the turn, tick/roll/coin/cha-ching on the money.
Run: ../../Setup/whisper-env/bin/python build3.py"""
import os, subprocess, shutil, html, json
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
ROOT = os.path.dirname(os.path.dirname(HERE))
R = '/home/user/Isaiah-Mayo/construction-content/raw-footage'
U = '/root/.claude/uploads/03d2cb76-e365-5423-89b9-e3b9838ff4f7'
MM = os.path.join(ROOT, 'Projects/mayo-month/assets')
os.makedirs(os.path.join(A, 'fonts'), exist_ok=True)
for f in os.listdir(A):
    if f.endswith(('.mp4', '.m4a')) or (f.endswith('.jpg')): os.remove(os.path.join(A, f))
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
for f in ['BebasNeue.ttf', 'Montserrat-ExtraBold.ttf']:
    shutil.copy(os.path.join(ROOT, 'Signature Style/fonts/pack', f), os.path.join(A, 'fonts'))
def sfx(name):
    for d in ['Setup/sfx-made', 'Setup/sound-effects']:
        p = os.path.join(ROOT, d, name + '.mp3')
        if os.path.exists(p):
            shutil.copy(p, A); return f'assets/{name}.mp3'
    raise SystemExit(name)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
def probe(src, sel):
    return subprocess.run(['ffprobe', '-v', 'error', '-select_streams', sel, '-show_entries', 'stream=index,color_transfer', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip()
def prep(src, t_in, dur, name, rate=1.0, vol=0):
    if src.lower().endswith(('.jpg', '.png')):
        shutil.copy(src, os.path.join(A, name + '.jpg')); return f'assets/{name}.jpg', None
    tr = probe(src, 'v:0').split(',')[-1]
    vf = (TONEMAP if tr in ('arib-std-b67', 'smpte2084') else '') + f"setpts=PTS/{rate},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur * rate + 0.6), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', os.path.join(A, name + '.mp4')], check=True)
    nat = None
    if vol and probe(src, 'a:0'):
        af = f"atempo={max(0.5, min(2.0, rate))},afade=t=in:d=0.3,afade=t=out:st={max(0, dur - 0.4):.2f}:d=0.4,loudnorm=I=-20:TP=-3"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur * rate + 0.1), '-vn', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, name + '.m4a')], check=True)
        nat = f'assets/{name}.m4a'
    return f'assets/{name}.mp4', nat

FILM = {"preset": "vintage-wash", "intensity": 0.7, "details": {"vignette": 0.16, "grain": 0.14, "grainSize": 0.2, "grainRoughness": 0.6}}
WARM = {"preset": "warm-daylight", "intensity": 0.45}
OV = 0.45  # soft crossfade

# Story beats: (shots[(src,in,dur,rate,vol)], phrases[(offset, dur, text, gold)], look, opts)
BEATS = [
  ([(f'{R}/IMG_2148.mov', 0.3, 5.8, 1.0, 0)],
   [(0.0, 3.4, None, ()), (1.0, 2.4, "...this is for you.", ("for you.",)), (3.4, 2.4, "I was you.", ("you.",))], 'film', {}),
  ([(f'{R}/IMG_3101.mov', 1.0, 5.2, 1.0, 0.25)],
   [(0.0, 2.2, "I was a cop.", ("cop.",)), (2.2, 3.0, "The anxiety got\nso bad I resigned.", ("anxiety", "resigned."))], 'film', {}),
  ([(f'{U}/ee8a389e-IMG_4699.mov', 0.25, 4.2, 0.9, 0)],
   [(0.0, 1.3, "Then a banker.", ("banker.",)), (1.3, 1.3, "Nice office.\nSteady check.", ()), (2.6, 1.6, "It still wasn't me.", ("wasn't me.",))], 'film', {}),
  ([(f'{R}/IMG_3101.mov', 6.6, 2.6, 1.0, 0.25)],
   [(0.0, 2.6, "So I went back\nto being a cop.", ("back",))], 'film', {}),
  ([(f'{R}/IMG_2148.mov', 5.8, 2.6, 1.0, 0)],
   [(0.0, 2.6, "Same stress.\nSame paycheck.", ("stress.", "paycheck."))], 'film', {}),
  ([(f'{R}/IMG_4458.mov', 0.2, 3.0, 1.0, 0.25)],
   [(0.0, 3.0, "BOX:So I bet\non myself.", ("on myself.",))], 'warm', {'turn': 1}),
  ([(f'{R}/IMG_2454.mov', 0.0, 2.8, 0.52, 0)],
   [(0.0, 2.8, "Day 1.\nZero customers.", ("Zero",))], 'warm', {}),
  ([(f'{R}/IMG_2235.mov', 0.2, 2.8, 1.0, 0.35)],
   [(0.0, 2.8, "So I took every\nsmall job.", ("every",))], 'warm', {}),
  ([(f'{R}/IMG_2417.mov', 1.0, 2.8, 1.0, 0)],
   [(0.0, 2.8, "Knocked on doors.\nPosted every job.", ("doors.", "every job."))], 'warm', {}),
  ([(f'{R}/IMG_4462.mov', 0.6, 2.6, 1.0, 0.45)],
   [(0.0, 1.3, "Said yes to every deck\nand every kitchen.", ("yes",))], 'warm', {}),
]
MONTAGE = [(f'{R}/IMG_4460.mov', 0.5), (f'{U}/08bebf6e-image.jpg', 0), (f'{R}/IMG_2624.mov', 2.5), (f'{R}/IMG_2340.mov', 2.5),
           (f'{MM}/slider-b.jpg', 0), (f'{R}/IMG_3094.mov', 40.0), (f'{R}/286CBA62-05B5-407D-BB65-7426E54C714D.mov', 2.5),
           (f'{MM}/fan-b.jpg', 0), (f'{U}/18e009f9-IMG_2547.mov', 3.0), (f'{U}/ba9abc44-image.jpg', 0)]
END = [
  ([(f'{R}/IMG_4464.mov', 1.0, 2.8, 1.0, 0.3)],
   [(0.0, 2.8, "Now I build\nwith my dad.", ("my dad.",))], 'warm', {'y': 1150}),
  ([(f'{R}/IMG_0068.mov', 7.0, 1.6, 1.0, 0), (f'{R}/IMG_8266.mov', 0.5, 1.6, 1.0, 0)],
   [(0.0, 3.2, "And I'm home\nfor my boys.", ("my boys.",))], 'warm', {'y': 1150}),
  ([(f'{R}/IMG_2248.mov', 1.8, 8.6, 0.8, 0)],
   [(0.0, 3.0, "If you're struggling\nright now...", ("struggling",)), (3.0, 3.4, "you're allowed to\nbet on yourself too.", ("bet on yourself",)),
    (6.4, 2.2, "Follow.\nI'll show you how.", ("Follow.",))], 'warm', {'y': 1250}),
]

els, js, aud, texts = [], [], [], []
def audio(t, src, vol, dur=1.6, fade_out=0):
    aud.append((round(t, 3), src, vol, dur, fade_out))
def grade_attr(look):
    # Shader grading needs WebGL (not available in this render box), so use CSS filters:
    # past = faded black-and-white memory, present = slightly warm and rich.
    f = 'grayscale(1) sepia(0.18) contrast(1.08) brightness(0.92)' if look == 'film' else 'saturate(1.12) sepia(0.08) contrast(1.04)'
    return f' data-look="{look}" data-filter="{f}"'

def media_el(id, src, start, dur, look):
    ga = grade_attr(look); f = ga.split('data-filter="')[1].split('"')[0]
    attr = f' style="filter: {f}"'
    if src.endswith('.jpg'):
        return f'      <img id="{id}" class="clip shot" src="{src}"{attr} data-start="{start:.3f}" data-duration="{dur:.3f}" data-track-index="0" />'
    return f'      <video id="{id}" class="clip shot" src="{src}"{attr} muted playsinline data-start="{start:.3f}" data-duration="{dur:.3f}" data-media-start="0" data-track-index="0"></video>'

pid = [0]
def phrase(start, dur, text, gold, y):
    i = pid[0]; pid[0] += 1
    box = text.startswith('BOX:')
    if box: text = text[4:]
    lines = []
    for ln in text.split('\n'):
        ws = []
        for w in ln.split(' '):
            g = any(w in x.split(' ') or w == x for x in gold)
            ws.append(f'<span class="{"g" if g else ""}">{html.escape(w)}</span>')
        lines.append(' '.join(ws))
    inner = '<br>'.join(lines)
    if box:
        inner = f'<span class="b">{inner}</span>'
        texts.append(f'      <div id="p{i}" class="clip box" style="top:{min(y, 900)}px" data-start="{start:.3f}" data-duration="{dur:.3f}" data-track-index="{4 + i % 2}">{inner}</div>')
        js.append(f'      tl.fromTo("#p{i}", {{ scale: 1.25, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.6)", immediateRender: false }}, {start:.3f});')
    else:
        texts.append(f'      <div id="p{i}" class="clip cap" style="top:{y}px" data-start="{start:.3f}" data-duration="{dur:.3f}" data-track-index="{4 + i % 2}">{inner}</div>')
        js.append(f'      tl.fromTo("#p{i} span", {{ opacity: 0, y: 26, filter: "blur(6px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45, stagger: 0.07, ease: "power2.out", immediateRender: false }}, {start:.3f});')

def beats(list_, t, prefix):
    for bi, (shots, phr, look, o) in enumerate(list_):
        bt = t
        for si, (src, tin, d, rate, vol) in enumerate(shots):
            sid = f'{prefix}{bi}_{si}'
            path, nat = prep(src, tin, d + OV, sid, rate, vol)
            blend = t > 0 and not o.get('turn')
            start = t - OV if blend else t
            els.append(media_el(sid, path, start, d + (OV if blend else 0), look))
            js.append(f'      tl.fromTo("#{sid}", {{ scale: 1.0 }}, {{ scale: 1.08, duration: {d + OV:.2f}, ease: "none", immediateRender: false }}, {start:.3f});')
            if blend:
                js.append(f'      tl.fromTo("#{sid}", {{ opacity: 0 }}, {{ opacity: 1, duration: {OV}, ease: "sine.inOut", immediateRender: false }}, {start:.3f});')
            if nat: audio(t, nat, vol, d)
            t += d
        for (off, dur, text, gold) in phr:
            if text: phrase(bt + off, dur, text, gold, o.get('y', 660))
        if o.get('turn'):
            TURN[0] = bt
    return t

TURN = [0]
t = beats(BEATS, 0.0, 's')
STRUGGLE_END = TURN[0]
# Money montage (the one fast section, on purpose)
M0 = t; MD = 3.6
w = [0.9 ** k for k in range(len(MONTAGE))]; durs = [MD * x / sum(w) for x in w]
for k, ((src, tin), d) in enumerate(zip(MONTAGE, durs)):
    path, _ = prep(src, tin, d, f'm{k}')
    els.append(media_el(f'm{k}', path, t, d, 'warm'))
    js.append(f'      tl.fromTo("#m{k}", {{ scale: 1.15 }}, {{ scale: 1.02, duration: {d:.3f}, ease: "power3.out", immediateRender: false }}, {t:.3f});')
    audio(t, sfx('tick'), 0.4, 0.3)
    if k % 3 == 2: audio(t, sfx('coin'), 0.35, 0.6)
    t += d
shutil.copy(f'{U}/8da61488-image.jpg', os.path.join(A, 'deck-b.jpg')); shutil.copy(f'{U}/42910d69-image.jpg', os.path.join(A, 'deck-a.jpg'))
W0 = t; LAND = W0 + 0.8; HOLD = 2.6
els.append(media_el('db', 'assets/deck-b.jpg', W0, 0.8 + HOLD, 'warm'))
els.append(media_el('da', 'assets/deck-a.jpg', W0, 0.8 + HOLD, 'warm'))
els.append(f'      <div id="wl" class="clip wipe" data-start="{W0:.3f}" data-duration="0.8" data-track-index="2"></div>')
js.append(f'      tl.fromTo("#da", {{ clipPath: "inset(0 100% 0 0)" }}, {{ clipPath: "inset(0 0% 0 0)", duration: 0.75, ease: "power2.inOut" }}, {W0:.3f});')
js.append(f'      tl.fromTo("#wl", {{ x: 0 }}, {{ x: 1080, duration: 0.75, ease: "power2.inOut" }}, {W0:.3f});')
js.append(f'      tl.fromTo("#da", {{ scale: 1.08 }}, {{ scale: 1, duration: {HOLD + 0.8:.2f}, ease: "power1.out", immediateRender: false }}, {W0:.3f});')
audio(W0, sfx('whoosh-cinematic'), 0.5)
audio(M0, sfx('roll'), 0.55, LAND - M0)
audio(M0 - 1.0, sfx('sweep'), 0.35, 1.2)
audio(LAND, sfx('ching'), 0.8); audio(LAND, sfx('boom'), 0.6); audio(LAND + 0.15, sfx('sparkle'), 0.4)
t = W0 + 0.8 + HOLD
E0 = t
t = beats(END, t, 'e')
total = round(t, 2)
# lead-in line over the last build shot before the money
phrase(M0 - 1.3, 1.3, "And in under a month...", ("month...",), 660)

# Sound: hook impact, heartbeat under the struggle, riser + boom + light leak on the turn.
audio(0, sfx('boom'), 0.45)
audio(0.4, sfx('heartbeat'), 0.55, min(17.2, STRUGGLE_END - 0.4), fade_out=1.0)
audio(STRUGGLE_END - 1.6, sfx('riser'), 0.4, 1.6)
audio(STRUGGLE_END, sfx('boom'), 0.7)
audio(STRUGGLE_END, sfx('whoosh-cinematic'), 0.4)

def hook_html():
    return '<span class="b">If you\'re working hard<br>and <span class="red">still broke</span>...</span>'
js.insert(0, '      tl.fromTo("#hook", { scale: 1 }, { keyframes: [{ scale: 1.06, duration: 0.08 }, { scale: 1, duration: 0.3, ease: "sine.out" }], immediateRender: false }, 0.02);')
js.append(f'''      const m = {{ v: 0 }};
      tl.fromTo(m, {{ v: 0 }}, {{ v: 10000, duration: {LAND - M0:.3f}, ease: "power2.in", immediateRender: false,
        onUpdate: () => {{ const n = Math.round(m.v / 50) * 50; document.getElementById("money").textContent = "$" + n.toLocaleString("en-US"); }} }}, {M0:.3f});
      tl.fromTo("#money", {{ scale: 0.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)", immediateRender: false }}, {M0:.3f});
      tl.fromTo("#money", {{ scale: 1 }}, {{ keyframes: [{{ scale: 1.25, duration: 0.1 }}, {{ scale: 1, duration: 0.35, ease: "back.out(3)" }}], immediateRender: false }}, {LAND:.3f});
      tl.fromTo("#money", {{ color: "#ffffff" }}, {{ color: "#ffd23f", duration: {LAND - M0:.3f}, ease: "none", immediateRender: false }}, {M0:.3f});
      tl.fromTo("#fx", {{ opacity: 0.7 }}, {{ opacity: 0, duration: 0.4, ease: "power2.out", immediateRender: false }}, {LAND:.3f});''')

auds = []
for k, (s, src, v, d, fo) in enumerate(aud):
    d = min(d, total - s)
    fade = f' data-fade-out="{fo}"' if fo else ''
    auds.append(f'      <audio id="a{k}" class="clip" src="{src}" data-start="{s:.3f}" data-duration="{d:.3f}" data-volume="{v}"{fade} data-track-index="{8 + k % 6}"></audio>')
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
      .shot {{ position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      /* Hook: Bebas Neue on white boxes, "still broke" in Mayo's red. */
      .hook {{ position: absolute; top: 240px; left: 50px; right: 50px; text-align: center; z-index: 20; font: 400 122px/1.22 "Bebas", sans-serif; }}
      .hook span.b, .box span.b {{ background: #fff; color: #111; padding: 4px 26px 0; border-radius: 16px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }}
      .red, .box .g {{ color: #c4553b; }}
      .box {{ position: absolute; left: 50px; right: 50px; text-align: center; z-index: 18; font: 400 130px/1.22 "Bebas", sans-serif; }}
      /* Story captions: Montserrat ExtraBold, white, soft shadow; key words gold. */
      .cap {{ position: absolute; left: 70px; right: 70px; text-align: center; z-index: 18; color: #fff; font: 800 74px/1.22 "Montserrat", sans-serif; text-transform: uppercase;
        -webkit-text-stroke: 9px #000; paint-order: stroke fill; text-shadow: 0 8px 24px rgba(0,0,0,.6); }}
      .cap span {{ display: inline-block; }}
      .cap .g {{ color: #ffd23f; }}
      .money {{ position: absolute; top: 560px; left: 0; right: 0; text-align: center; z-index: 22; font: 400 270px/1 "Bebas", sans-serif; color: #ffd23f;
        -webkit-text-stroke: 14px #000; paint-order: stroke fill; text-shadow: 0 10px 30px rgba(0,0,0,.6); }}
      .wipe {{ position: absolute; top: 0; bottom: 0; left: 0; width: 10px; margin-left: -5px; background: #fff; z-index: 12; box-shadow: 0 0 24px rgba(0,0,0,.5); }}
      .flash {{ position: absolute; inset: 0; background: #fff; z-index: 30; opacity: 0; }}
      .leak {{ position: absolute; inset: 0; z-index: 15; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{chr(10).join(els)}
      <div id="leak" class="clip leak" data-composition-id="organic-light-leak-overlay" data-composition-src="compositions/organic-light-leak-overlay.html" data-start="{STRUGGLE_END - 0.3:.3f}" data-duration="2.4" data-width="1080" data-height="1920" data-track-index="3"></div>
      <div id="fx" class="clip flash" data-start="0" data-duration="{total}" data-track-index="3"></div>
      <div id="hook" class="clip hook" data-start="0" data-duration="3.4" data-track-index="3">{hook_html()}</div>
      <div id="money" class="clip money" data-start="{M0:.3f}" data-duration="{LAND + HOLD - M0:.3f}" data-track-index="6">$0</div>
{chr(10).join(texts)}
{chr(10).join(auds)}
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
print('total', total, 'turn', round(STRUGGLE_END, 2), 'montage', round(M0, 2), 'land', round(LAND, 2), 'end', round(E0, 2))

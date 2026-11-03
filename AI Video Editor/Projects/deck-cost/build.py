"""'Why does a new deck cost $5K-$15K?' : price-shock hook, show where the money goes, before/after payoff.
Style: the approved slow-season look (small typewriter line + big hand-lettered gold keyword).
Motion rules (Signature Style/STYLE.md): straight cuts, quiet labels, ONE big moment (the wipe),
real job sound (drill, mallet) as the texture.
Run: ../../Setup/whisper-env/bin/python build.py"""
import os, subprocess, shutil, html
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
ROOT = os.path.dirname(os.path.dirname(HERE))
R = '/home/user/Isaiah-Mayo/construction-content/raw-footage'
U = '/root/.claude/uploads/03d2cb76-e365-5423-89b9-e3b9838ff4f7'
os.makedirs(os.path.join(A, 'fonts'), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
for f in ['CourierPrime-Bold.ttf', 'PermanentMarker.ttf']:
    shutil.copy(os.path.join(ROOT, 'Projects/slow-season/assets/fonts', f), os.path.join(A, 'fonts'))
def sfx(name):
    for d in ['Setup/sfx-made', 'Setup/sound-effects']:
        p = os.path.join(ROOT, d, name + '.mp3')
        if os.path.exists(p):
            shutil.copy(p, A); return f'assets/{name}.mp3'
    raise SystemExit(name)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
def prep(src, t_in, dur, name):
    if src.endswith('.jpg'):
        shutil.copy(src, os.path.join(A, name + '.jpg')); return f'assets/{name}.jpg', None
    vf = TONEMAP + "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur + 0.3), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', os.path.join(A, name + '.mp4')], check=True)
    af = f"afade=t=in:d=0.06,afade=t=out:st={max(0, dur - 0.1):.2f}:d=0.1,loudnorm=I=-20:TP=-3"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-map', '0:a:0', '-t', str(dur), '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, name + '.m4a')], check=True)
    return f'assets/{name}.mp4', f'assets/{name}.m4a'

BEFORE, AFTER, CLOSE = f'{U}/8da61488-image.jpg', f'{U}/42910d69-image.jpg', f'{U}/ba9abc44-image.jpg'
# (src, in, dur, small, BIG, under, natural-audio vol)
BEATS = [
    (BEFORE, 0, 2.8, 'why does a new deck cost', '$5K-$15K?', '', 0),
    (f'{R}/IMG_4458.mov', 0.3, 2.2, 'first:', 'the boards', 'composite. not the cheap stuff.', 0.3),
    (f'{R}/IMG_4462.mov', 0.6, 2.2, 'then:', 'every screw', 'set by hand', 0.6),
    (f'{R}/IMG_4464.mov', 6.8, 2.2, 'then:', 'every plug', 'tapped in. one by one.', 0.8),
    (f'{R}/IMG_4467.mov', 4.0, 2.0, 'hundreds of', 'them', '', 0.6),
    (f'{R}/IMG_4466.mov', 0.0, 2.0, 'two guys.', 'father & son', '', 0.5),
    ('WIPE', 0, 3.4, 'and you get', 'this', '', 0),
    (CLOSE, 0, 2.4, 'no stain. no sanding.', 'no splinters', '', 0),
    (AFTER, 0, 2.6, 'want a price on yours?', 'comment "deck"', '', 0),
]
els, js, aud, caps, t = [], [], [], [], 0.0
def audio(at, src, vol, dur=1.6):
    aud.append((round(at, 3), src, vol, dur))
def img(id, src, start, dur, track=0):
    return f'      <img id="{id}" class="clip shot" src="{src}" data-start="{start:.2f}" data-duration="{dur}" data-track-index="{track}" />'
for i, (f, tin, d, small, big, under, nv) in enumerate(BEATS):
    if f == 'WIPE':
        shutil.copy(BEFORE, os.path.join(A, 'wb.jpg')); shutil.copy(AFTER, os.path.join(A, 'wa.jpg'))
        els.append(img('wb', 'assets/wb.jpg', t, d)); els.append(img('wa', 'assets/wa.jpg', t, d, 1))
        els.append(f'      <div id="wl" class="clip wipe" data-start="{t:.2f}" data-duration="1.3" data-track-index="2"></div>')
        W = t + 0.45
        js.append(f'      tl.fromTo("#wa", {{ clipPath: "inset(0 100% 0 0)" }}, {{ clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "power2.inOut" }}, {W:.2f});')
        js.append(f'      tl.fromTo("#wl", {{ x: 0 }}, {{ x: 1080, duration: 0.8, ease: "power2.inOut" }}, {W:.2f});')
        js.append(f'      tl.fromTo("#wa", {{ scale: 1.06 }}, {{ scale: 1.0, duration: {d:.2f}, ease: "power1.out", immediateRender: false }}, {t:.2f});')
        audio(t - 0.9, sfx('riser'), 0.35, 1.3)
        audio(W, sfx('whoosh-cinematic'), 0.6); audio(W + 0.8, sfx('boom'), 0.55); audio(W + 0.85, sfx('sparkle'), 0.4)
        HERO_T = W + 0.8
    else:
        vp, ap = prep(f, tin, d, f'v{i}')
        if vp.endswith('.jpg'):
            els.append(img(f'v{i}', vp, t, d))
        else:
            els.append(f'      <video id="v{i}" class="clip shot" src="{vp}" muted playsinline data-start="{t:.2f}" data-duration="{d}" data-media-start="0" data-track-index="0"></video>')
        js.append(f'      tl.fromTo("#v{i}", {{ scale: 1.0 }}, {{ scale: 1.04, duration: {d}, ease: "none", immediateRender: false }}, {t:.2f});')
        if ap and nv: audio(t, ap, nv, d)
    if i: audio(max(0, t - 0.06), sfx('whoosh-short'), 0.2, 0.6)
    inner = f'<div class="sm">{html.escape(small)}</div><div class="big">{html.escape(big)}</div>' + (f'<div class="sm2">{html.escape(under)}</div>' if under else '')
    caps.append(f'      <div id="c{i}" class="clip cap" data-start="{t:.2f}" data-duration="{d}" data-track-index="{4 + i % 2}">{inner}</div>')
    if i > 0:
        js.append(f'      tl.fromTo("#c{i} .sm", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, {t + 0.08:.2f});')
        if f == 'WIPE':
            # the one big moment: anticipation dip -> overshoot -> settle, landing with the boom
            js.append(f'      tl.fromTo("#c{i} .big", {{ opacity: 0, scale: 0.92 }}, {{ keyframes: [{{ opacity: 1, scale: 0.95, duration: 0.08 }}, {{ scale: 1.16, duration: 0.14, ease: "power2.out" }}, {{ scale: 1, duration: 0.3, ease: "back.out(2)" }}], immediateRender: false }}, {HERO_T - 0.08:.2f});')
        else:
            js.append(f'      tl.fromTo("#c{i} .big", {{ opacity: 0, y: 18, scale: 0.98 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power3.out", immediateRender: false }}, {t + 0.16:.2f});')
            audio(t + 0.16, sfx('click-soft'), 0.3, 0.4)
    if under:
        js.append(f'      tl.fromTo("#c{i} .sm2", {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, {t + 0.75:.2f});')
    t += d
total = round(t, 2)
audio(0.0, sfx('impact-bass-2'), 0.35)
audio(total - 2.6 + 0.16, sfx('notification'), 0.4)
auds = "\n".join(f'      <audio id="a{k}" class="clip" src="{s}" data-start="{at:.3f}" data-duration="{min(d, total - at):.3f}" data-volume="{v}" data-track-index="{8 + k % 6}"></audio>' for k, (at, s, v, d) in enumerate(aud))
doc = f'''<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Courier Prime"; src: url("assets/fonts/CourierPrime-Bold.ttf"); font-weight: 700; }}
      @font-face {{ font-family: "Marker"; src: url("assets/fonts/PermanentMarker.ttf"); }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 1080px; height: 1920px; overflow: hidden; }}
      .shot {{ position: absolute; inset: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      .cap {{ position: absolute; top: 560px; left: 60px; right: 60px; text-align: center; z-index: 10; }}
      .cap::before {{ content: ""; position: absolute; left: -60px; right: -60px; top: -90px; bottom: -90px; z-index: -1; background: radial-gradient(ellipse at center, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 70%); }}
      .sm, .sm2 {{ font: 700 54px/1.25 "Courier Prime", monospace; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,.9), 0 0 18px rgba(0,0,0,.6); }}
      .sm2 {{ font-size: 44px; margin-top: 18px; display: inline-block; background: rgba(0,0,0,.55); padding: 6px 18px; border-radius: 10px; }}
      .big {{ font: 400 124px/1.02 "Marker", sans-serif; color: #ffd23f; text-transform: uppercase; margin-top: 8px;
        text-shadow: 0 4px 0 rgba(0,0,0,.35), 0 6px 22px rgba(0,0,0,.65); }}
      .wipe {{ position: absolute; top: 0; bottom: 0; left: 0; width: 10px; margin-left: -5px; background: #fff; z-index: 5; box-shadow: 0 0 24px rgba(0,0,0,.5); }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{chr(10).join(els)}
{chr(10).join(caps)}
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
print('total', total)

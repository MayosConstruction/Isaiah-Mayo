"""'What I do when work slows down for winter' (original reel).
Hook formula from the owner's reference: personal experience + specific situation.
Motion rules (Signature Style/STYLE.md): straight cuts, quiet labels (ease-out 280 ms, 80 ms stagger),
one big moment (anticipation dip -> overshoot -> settle) with the only boom, sound as secondary action.
Run: ../../Setup/whisper-env/bin/python build.py"""
import os, subprocess, shutil, html
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
ROOT = os.path.dirname(os.path.dirname(HERE))
R = '/home/user/Isaiah-Mayo/construction-content/raw-footage/day1'
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
def sfx(name):
    for d in ['Setup/sfx-made', 'Setup/sound-effects']:
        p = os.path.join(ROOT, d, name + '.mp3')
        if os.path.exists(p):
            shutil.copy(p, A); return f'assets/{name}.mp3'
    raise SystemExit(name)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
def prep(src, t_in, dur, name):
    vf = TONEMAP + "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur + 0.3), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', os.path.join(A, name + '.mp4')], check=True)
    af = f"afade=t=in:d=0.06,afade=t=out:st={max(0, dur - 0.1):.2f}:d=0.1,loudnorm=I=-22:TP=-3"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-map', '0:a:0', '-t', str(dur), '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, name + '.m4a')], check=True)
    return f'assets/{name}.mp4', f'assets/{name}.m4a'

# Beats: (clip, in, dur, small line, BIG keyword, small line under)
BEATS = [
    ('IMG_2921', 0.3, 2.8, 'what i do when', 'work slows down', 'for winter'),
    ('IMG_2919', 0.0, 2.2, 'step one:', 'business cards', ''),
    ('IMG_2923', 0.4, 2.0, 'step two:', 'donuts', ''),
    ('IMG_2929', 0.3, 2.6, 'a card in', 'every box', ''),
    ('IMG_2927', 1.0, 3.0, 'first stop:', 'realtors', 'every house they sell needs work'),
    ('IMG_2925', 0.5, 2.4, 'then:', 'mortgage lenders', 'their deals die on bad inspections'),
    ('IMG_2926', 0.5, 2.6, 'most contractors', 'wait for spring', ''),
    ('IMG_2921', 3.4, 3.0, "i'd rather", 'go get it', ''),
]
HERO = 7  # the one big moment
els, js, aud, caps, t = [], [], [], [], 0.0
def audio(at, src, vol, dur=1.6):
    aud.append((round(at, 3), src, vol, dur))
for i, (f, tin, d, small, big, under) in enumerate(BEATS):
    vp, ap = prep(f'{R}/{f}.mov', tin, d, f'v{i}')
    els.append(f'      <video id="v{i}" class="clip shot" src="{vp}" muted playsinline data-start="{t:.2f}" data-duration="{d}" data-media-start="0" data-track-index="0"></video>')
    # slow, barely-there push-in (secondary motion, never noticed)
    js.append(f'      tl.fromTo("#v{i}", {{ scale: 1.0 }}, {{ scale: 1.04, duration: {d}, ease: "none", immediateRender: false }}, {t:.2f});')
    audio(t, ap, 0.35, d)
    if i: audio(max(0, t - 0.06), sfx('whoosh-short'), 0.22, 0.6)
    inner = f'<div class="sm">{html.escape(small)}</div><div class="big">{html.escape(big)}</div>' + (f'<div class="sm2">{html.escape(under)}</div>' if under else '')
    caps.append(f'      <div id="c{i}" class="clip cap" data-start="{t:.2f}" data-duration="{d}" data-track-index="{4 + i % 2}">{inner}</div>')
    first = 0.0 if i == 0 else 0.08
    if i == 0:
        pass  # frame 0 must already show the hook
    else:
        js.append(f'      tl.fromTo("#c{i} .sm", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, {t + first:.2f});')
    if i == HERO:
        # anticipation dip -> overshoot -> settle, the only boom in the video
        js.append(f'      tl.fromTo("#c{i} .big", {{ opacity: 0, scale: 0.92 }}, {{ keyframes: [{{ opacity: 1, scale: 0.95, duration: 0.08 }}, {{ scale: 1.14, duration: 0.14, ease: "power2.out" }}, {{ scale: 1, duration: 0.3, ease: "back.out(2)" }}], immediateRender: false }}, {t + 0.35:.2f});')
        audio(t + 0.35, sfx('boom'), 0.6); audio(t + 0.1, sfx('riser'), 0.3, 0.4)
    elif i > 0:
        js.append(f'      tl.fromTo("#c{i} .big", {{ opacity: 0, y: 18, scale: 0.98 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power3.out", immediateRender: false }}, {t + first + 0.08:.2f});')
        audio(t + first + 0.08, sfx('click-soft'), 0.35, 0.4)
    if under and i > 0:
        js.append(f'      tl.fromTo("#c{i} .sm2", {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, {t + 0.7:.2f});')
    t += d
total = round(t, 2)
audio(0.0, sfx('impact-bass-2'), 0.35)
ENDT = total - 1.4
caps.append(f'      <div id="end" class="clip endc" data-start="{ENDT:.2f}" data-duration="1.4" data-track-index="6"><span>follow for what happens next</span></div>')
js.append(f'      tl.fromTo("#end span", {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out", immediateRender: false }}, {ENDT:.2f});')
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
      /* Captions: small typewriter lowercase + one big hand-lettered keyword (from the reference style) */
      .cap {{ position: absolute; top: 600px; left: 70px; right: 70px; text-align: center; z-index: 10; }}
      .sm, .sm2 {{ font: 700 54px/1.25 "Courier Prime", monospace; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,.9), 0 0 18px rgba(0,0,0,.55); }}
      .sm2 {{ font-size: 44px; margin-top: 18px; }}
      .big {{ font: 400 118px/1.02 "Marker", sans-serif; color: #ffd23f; text-transform: uppercase; margin-top: 8px;
        text-shadow: 0 4px 0 rgba(0,0,0,.35), 0 6px 22px rgba(0,0,0,.6); }}
      .endc {{ position: absolute; top: 1240px; left: 0; right: 0; text-align: center; z-index: 11; }}
      .endc span {{ font: 700 46px/1.3 "Courier Prime", monospace; color: #fff; background: rgba(0,0,0,.55); padding: 8px 22px; border-radius: 10px; }}
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

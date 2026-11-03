"""'POV: you hired a father & son crew' (funny original reel).
Hook formula from the owner's reference: personal experience + specific situation.
Motion rules (Signature Style/STYLE.md): straight cuts, quiet labels (ease-out 280 ms, 80 ms stagger),
one big moment (anticipation dip -> overshoot -> settle) with the only boom, sound as secondary action.
Run: ../../Setup/whisper-env/bin/python build.py"""
import os, subprocess, shutil, html
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
ROOT = os.path.dirname(os.path.dirname(HERE))
R = '/home/user/Isaiah-Mayo/construction-content/raw-footage'
U = '/root/.claude/uploads/03d2cb76-e365-5423-89b9-e3b9838ff4f7'
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
def sfx(name):
    for d in ['Setup/sfx-made', 'Setup/sound-effects']:
        p = os.path.join(ROOT, d, name + '.mp3')
        if os.path.exists(p):
            shutil.copy(p, A); return f'assets/{name}.mp3'
    raise SystemExit(name)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
def prep(src, t_in, dur, name, rate=1.0):
    if src.endswith('.jpg'):
        shutil.copy(src, os.path.join(A, name + '.jpg')); return f'assets/{name}.jpg', None
    tr = subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=color_transfer','-of','csv=p=0',src],capture_output=True,text=True).stdout.strip()
    vf = (TONEMAP if tr in ('arib-std-b67','smpte2084') else '') + f"setpts=PTS/{rate}," + "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur * rate + 0.3), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', os.path.join(A, name + '.mp4')], check=True)
    if rate != 1.0: return f'assets/{name}.mp4', None
    af = f"afade=t=in:d=0.06,afade=t=out:st={max(0, dur - 0.1):.2f}:d=0.1,loudnorm=I=-22:TP=-3"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-map', '0:a:0', '-t', str(dur), '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, name + '.m4a')], check=True)
    return f'assets/{name}.mp4', f'assets/{name}.m4a'

# Beats: (src, in, dur, small, BIG, under, rate, natural-audio vol)
BEATS = [
    (f'{R}/IMG_2454.mov', 0.0, 2.8, 'pov:', 'you hired a father & son crew', '', 0.52, 0),
    (f'{R}/IMG_2241.mov', 1.0, 2.2, 'dad:', 'does the actual work', '', 1.0, 0.5),
    (f'{R}/IMG_2340.mov', 2.0, 2.0, 'also dad:', 'ladders are optional', '', 1.0, 0.3),
    (f'{R}/IMG_4462.mov', 0.6, 2.0, 'son:', 'does the work dad points at', '', 1.0, 0.5),
    (f'{R}/70F91C88.mov', 25.6, 1.8, 'both of us:', 'fight bats. for free.', '', 1.0, 0.7),
    ('FREEZE', 27.4, 0.9, '', '', '', 1.0, 0),
    (f'{R}/79AE81E5.mp4', 1.0, 2.4, 'the new hire:', 'still in training', '(he is 2)', 1.0, 0.6),
    (f'{R}/79AE81E5.mp4', 15.6, 2.2, 'lunch break:', 'milk chugging contest', '', 1.0, 0.6),
    (f'{U}/42910d69-image.jpg', 0, 2.8, 'the result:', 'somehow it works', '', 1.0, 0),
]
HERO = 4  # bats: the one big moment (freeze + boom)
els, js, aud, caps, t = [], [], [], [], 0.0
def audio(at, src, vol, dur=1.6):
    aud.append((round(at, 3), src, vol, dur))
for i, (f, tin, d, small, big, under, rate, nv) in enumerate(BEATS):
    if f == 'FREEZE':
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(tin),'-i',f'{R}/70F91C88.mov','-frames:v','1','-vf','scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920','-q:v','2',os.path.join(A,'freeze.jpg')],check=True)
        els.append(f'      <img id="v{i}" class="clip shot" src="assets/freeze.jpg" data-start="{t:.2f}" data-duration="{d}" data-track-index="0" />')
        js.append(f'      tl.fromTo("#v{i}", {{ scale: 1.0 }}, {{ scale: 1.18, duration: 0.25, ease: "power3.out", immediateRender: false }}, {t:.2f});')
        js.append(f'      tl.fromTo("#fx", {{ opacity: 0.85 }}, {{ opacity: 0, duration: 0.3, ease: "power2.out", immediateRender: false }}, {t:.2f});')
        audio(t, sfx('boom'), 0.75); audio(t, sfx('shutter'), 0.5, 0.6)
        # keep the bats caption up through the freeze
        caps[-1] = caps[-1].replace(f'data-duration="{BEATS[i-1][2]}"', f'data-duration="{BEATS[i-1][2] + d}"')
        t += d; continue
    vp, ap = prep(f, tin, d, f'v{i}', rate)
    if vp.endswith('.jpg'):
        els.append(f'      <img id="v{i}" class="clip shot" src="{vp}" data-start="{t:.2f}" data-duration="{d}" data-track-index="0" />')
    else:
        els.append(f'      <video id="v{i}" class="clip shot" src="{vp}" muted playsinline data-start="{t:.2f}" data-duration="{d}" data-media-start="0" data-track-index="0"></video>')
    js.append(f'      tl.fromTo("#v{i}", {{ scale: 1.0 }}, {{ scale: 1.04, duration: {d}, ease: "none", immediateRender: false }}, {t:.2f});')
    if ap and nv: audio(t, ap, nv, d)
    if i: audio(max(0, t - 0.06), sfx('whoosh-short'), 0.22, 0.6)
    inner = f'<div class="sm">{html.escape(small)}</div><div class="big">{html.escape(big)}</div>' + (f'<div class="sm2">{html.escape(under)}</div>' if under else '')
    caps.append(f'      <div id="c{i}" class="clip cap" data-start="{t:.2f}" data-duration="{d}" data-track-index="{4 + i % 2}">{inner}</div>')
    if i > 0:
        js.append(f'      tl.fromTo("#c{i} .sm", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, {t + 0.08:.2f});')
        js.append(f'      tl.fromTo("#c{i} .big", {{ opacity: 0, y: 18, scale: 0.98 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power3.out", immediateRender: false }}, {t + 0.16:.2f});')
        audio(t + 0.16, sfx('click-soft'), 0.35, 0.4)
    if under:
        js.append(f'      tl.fromTo("#c{i} .sm2", {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, {t + 0.9:.2f});')
        audio(t + 0.9, sfx('pop'), 0.35, 0.4)
    t += d
total = round(t, 2)
audio(0.0, sfx('impact-bass-2'), 0.35); audio(total - 2.7, sfx('sparkle'), 0.3)
ENDT = total - 1.4
caps.append(f'      <div id="end" class="clip endc" data-start="{ENDT:.2f}" data-duration="1.4" data-track-index="6"><span>follow the crew</span></div>')
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
      .big {{ font: 400 104px/1.04 "Marker", sans-serif; color: #ffd23f; text-transform: uppercase; margin-top: 8px;
        text-shadow: 0 4px 0 rgba(0,0,0,.35), 0 6px 22px rgba(0,0,0,.6); }}
      .flash {{ position: absolute; inset: 0; background: #fff; opacity: 0; z-index: 9; }}
      .endc {{ position: absolute; top: 1240px; left: 0; right: 0; text-align: center; z-index: 11; }}
      .endc span {{ font: 700 46px/1.3 "Courier Prime", monospace; color: #fff; background: rgba(0,0,0,.55); padding: 8px 22px; border-radius: 10px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{chr(10).join(els)}
      <div id="fx" class="clip flash" data-start="0" data-duration="{total}" data-track-index="3"></div>
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

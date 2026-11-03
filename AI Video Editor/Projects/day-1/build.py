"""Day 1 ($0 -> $250,000 series), built for a voiceover added later.
Designed title slide, short labels only, persistent progress tracker, sound matched to the action.
Run: ../../Setup/whisper-env/bin/python build.py"""
import os, subprocess, shutil, html
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'assets')
ROOT = os.path.dirname(os.path.dirname(HERE))
R = '/home/user/Isaiah-Mayo/construction-content/raw-footage/day1'
os.makedirs(os.path.join(A, 'fonts'), exist_ok=True)
for f in os.listdir(A):
    if f.endswith(('.mp4', '.m4a', '.mp3')): os.remove(os.path.join(A, f))
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
def prep(src, t_in, dur, name, vol):
    vf = TONEMAP + "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p,eq=saturation=1.08:contrast=1.04"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-t', str(dur + 0.4), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', os.path.join(A, name + '.mp4')], check=True)
    af = f"afade=t=in:d=0.08,afade=t=out:st={max(0, dur - 0.12):.2f}:d=0.12,loudnorm=I=-20:TP=-3"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t_in), '-i', src, '-map', '0:a:0', '-t', str(dur), '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, name + '.m4a')], check=True)
    return f'assets/{name}.mp4', f'assets/{name}.m4a'

# (file, in, dur, natural-audio volume)
SHOTS = [('IMG_2921', 0.3, 2.8, 0.3),   # title: driving, donuts on the dash
         ('IMG_2926', 1.0, 2.0, 0.3),   # pulling in
         ('IMG_2919', 0.0, 2.6, 0.35),  # business cards
         ('IMG_2920', 0.4, 1.8, 0.5),   # truck door
         ('IMG_2922', 3.4, 1.6, 0.3),   # arriving at the donut shop
         ('IMG_2923', 0.5, 2.2, 0.35),  # donut case
         ('IMG_2929', 0.3, 2.6, 0.5),   # card on the donut box
         ('IMG_2927', 1.0, 3.0, 0.3),   # realtor office
         ('IMG_2925', 0.5, 2.4, 0.4),   # walking in
         ('IMG_2929', 4.6, 1.8, 0.3)]   # end card
els, js, aud, t, starts = [], [], [], 0.0, []
def audio(at, src, vol, dur=1.6):
    aud.append((round(at, 3), src, vol, dur))
for i, (f, tin, d, v) in enumerate(SHOTS):
    vp, ap = prep(f'{R}/{f}.mov', tin, d, f'v{i}', v)
    els.append(f'      <video id="v{i}" class="clip shot" src="{vp}" muted playsinline data-start="{t:.2f}" data-duration="{d}" data-media-start="0" data-track-index="0"></video>')
    js.append(f'      tl.fromTo("#v{i}", {{ scale: 1.1 }}, {{ scale: 1.0, duration: {min(d, 0.6)}, ease: "power3.out", immediateRender: false }}, {t:.2f});')
    audio(t, ap, v, d)
    if i > 1: audio(max(0, t - 0.08), sfx('whoosh-short'), 0.3, 0.8)
    starts.append(t); t += d
total = round(t, 2)
S = starts
TITLE_END = S[1]

# Labels (short, so the voiceover carries the story)
labels = [(S[2] + 0.15, S[3] - S[2] - 0.15, 'Step 1: <b>business cards</b>'),
          (S[5] + 0.15, S[6] - S[5] - 0.15, 'Step 2: <b>donuts</b> 🍩'),
          (S[6] + 0.1, S[7] - S[6] - 0.1, '+ a card in <b>every box</b>'),
          (S[7] + 0.15, S[8] - S[7] - 0.15, 'Stop #1: <b>realtor office</b>')]
texts = []
for k, (st, d, txt) in enumerate(labels):
    texts.append(f'      <div id="lb{k}" class="clip label" data-start="{st:.2f}" data-duration="{d:.2f}" data-track-index="{4 + k % 2}"><span>{txt}</span></div>')
    js.append(f'      tl.fromTo("#lb{k} span", {{ y: -40, opacity: 0, scale: 0.85 }}, {{ y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2.2)", immediateRender: false }}, {st:.2f});')
    audio(st, sfx('pop'), 0.5, 0.5)

# Sound matched to the action
audio(0.0, sfx('boom'), 0.75)
audio(0.12, sfx('whoosh-short'), 0.45, 0.8)
audio(0.45, sfx('impact-bass-2'), 0.55)
audio(TITLE_END - 0.25, sfx('whoosh-cinematic'), 0.55)
audio(S[2] + 0.3, sfx('shutter'), 0.5, 0.6)          # card close-up "snap"
audio(S[5] + 0.4, sfx('sparkle'), 0.35)              # donut case
audio(S[6] + 0.9, sfx('click'), 0.5, 0.4)            # card into the box
audio(S[7], sfx('impact-bass-1'), 0.45)              # first stop
audio(S[9], sfx('notification'), 0.55)               # "phone, ring"
audio(S[9] + 0.15, sfx('pop'), 0.5, 0.5)

# Title slide motion: DAY 1 is readable on frame 0, the rest slams in.
js.insert(0, f'''      tl.fromTo("#t-day", {{ scale: 1.12 }}, {{ scale: 1, duration: 0.35, ease: "back.out(2)", immediateRender: false }}, 0.02);
      tl.fromTo("#t-sub", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.3, ease: "power3.out", immediateRender: false }}, 0.12);
      tl.fromTo("#t-goal", {{ scale: 1.5, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.25, ease: "power4.out", immediateRender: false }}, 0.45);
      tl.fromTo("#t-cam", {{ x: 0, y: 0 }}, {{ keyframes: [{{ x: -14, y: 8, duration: 0.04 }}, {{ x: 12, y: -8, duration: 0.04 }}, {{ x: 0, y: 0, duration: 0.05 }}], immediateRender: false }}, 0.47);
      tl.fromTo("#title", {{ opacity: 1 }}, {{ opacity: 0, duration: 0.25, ease: "power2.in", immediateRender: false }}, {TITLE_END - 0.25:.2f});
      tl.fromTo("#trk", {{ y: -60, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "power3.out", immediateRender: false }}, {TITLE_END:.2f});
      tl.fromTo("#fill", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.6, ease: "power2.out", immediateRender: false }}, {TITLE_END + 0.2:.2f});
      tl.fromTo("#end span", {{ scale: 1.4, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)", immediateRender: false }}, {S[9]:.2f});''')

auds = "\n".join(f'      <audio id="a{k}" class="clip" src="{s}" data-start="{at:.3f}" data-duration="{min(d, total - at):.3f}" data-volume="{v}" data-track-index="{8 + k % 6}"></audio>' for k, (at, s, v, d) in enumerate(aud))
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
      /* Title slide */
      .title {{ position: absolute; inset: 0; z-index: 20; background: linear-gradient(180deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.45) 45%, rgba(0,0,0,.15) 75%, rgba(0,0,0,0) 100%); }}
      #t-cam {{ position: absolute; inset: 0; }}
      #t-day {{ position: absolute; top: 230px; left: 0; right: 0; text-align: center; font: 400 330px/0.9 "Bebas", sans-serif; color: #fff; letter-spacing: .02em;
        text-shadow: 0 12px 40px rgba(0,0,0,.6); }}
      #t-day b {{ color: #ffd23f; font-weight: 400; }}
      #t-sub {{ position: absolute; top: 560px; left: 0; right: 0; text-align: center; font: 800 50px/1 "Montserrat", sans-serif; color: #fff; letter-spacing: .14em; text-transform: uppercase; }}
      #t-goal {{ position: absolute; top: 650px; left: 0; right: 0; text-align: center; }}
      #t-goal span {{ display: inline-block; background: #fff; color: #111; font: 400 150px/1 "Bebas", sans-serif; padding: 14px 40px 4px; border-radius: 22px; box-shadow: 0 14px 40px rgba(0,0,0,.45); }}
      #t-goal i {{ font-style: normal; color: #c4553b; }}
      /* Series tracker */
      .tracker {{ position: absolute; top: 120px; left: 90px; right: 90px; z-index: 25; }}
      .tracker .row {{ display: flex; justify-content: space-between; align-items: center; font: 400 54px/1 "Bebas", sans-serif; color: #fff; text-shadow: 0 3px 10px rgba(0,0,0,.7); }}
      .tracker .chip {{ background: #c4553b; padding: 8px 20px 2px; border-radius: 12px; }}
      .tracker .bar {{ margin-top: 14px; height: 16px; border-radius: 8px; background: rgba(255,255,255,.28); overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,.4); }}
      .tracker #fill {{ width: 2%; height: 100%; background: #ffd23f; transform-origin: left center; }}
      /* Labels */
      .label {{ position: absolute; top: 330px; left: 0; right: 0; text-align: center; z-index: 18; }}
      .label span {{ display: inline-block; background: #fff; color: #111; font: 400 92px/1.15 "Bebas", sans-serif; padding: 8px 30px 2px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }}
      .label b {{ font-weight: 400; color: #c4553b; }}
      .end {{ position: absolute; top: 760px; left: 0; right: 0; text-align: center; z-index: 22; }}
      .end span {{ display: inline-block; background: #fff; color: #111; font: 400 130px/1.1 "Bebas", sans-serif; padding: 12px 40px 2px; border-radius: 20px; box-shadow: 0 14px 40px rgba(0,0,0,.45); }}
      .end b {{ font-weight: 400; color: #c4553b; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{chr(10).join(els)}
      <div id="title" class="clip title" data-start="0" data-duration="{TITLE_END:.2f}" data-track-index="3"><div id="t-cam">
        <div id="t-day">DAY <b>1</b></div>
        <div id="t-sub">Scaling my business</div>
        <div id="t-goal"><span>$0 → <i>$250,000</i></span></div>
      </div></div>
      <div id="trk" class="clip tracker" data-start="{TITLE_END:.2f}" data-duration="{total - TITLE_END:.2f}" data-track-index="6">
        <div class="row"><span class="chip">DAY 1</span><span>$0 / $250,000</span></div>
        <div class="bar"><div id="fill"></div></div>
      </div>
{chr(10).join(texts)}
      <div id="end" class="clip end" data-start="{S[9]:.2f}" data-duration="{total - S[9]:.2f}" data-track-index="5"><span>Follow for <b>Day 2</b></span></div>
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

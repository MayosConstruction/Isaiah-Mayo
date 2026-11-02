"""Punchy text reel builder v2 (HyperFrames project from a JSON spec).
Usage: textreel2.py spec.json
Spec:
  name, hook{text, red, dur, size?}
  shots[ {src, in, dur, rate?, vol?(natural sound 0-1, default .55)}
       | {slider:{before, after}, dur}           # before/after wipe payoff (photos)
       | {src: photo.jpg, dur} ]
  lines[ {t, dur, text, gold?[], box?, y?, sfx?(default "pop"), shake?, flash?} ]
  events[ {t, sfx, vol?} ]                         # extra sound hits (riser, boom...)
Sounds: names from Setup/sound-effects and Setup/sfx-made (boom, ching, shutter, buzzer, sweep).
Hook slams in with a boom + camera shake; every cut gets a whoosh; HDR clips are tone-mapped.
Music: none baked in. Add the trending sound in Instagram (keep original audio ~40%)."""
import json, subprocess, sys, os, shutil, html, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = json.load(open(sys.argv[1]))
P = os.path.join(ROOT, 'Projects', spec['name']); A = os.path.join(P, 'assets')
os.makedirs(os.path.join(A, 'fonts'), exist_ok=True); os.makedirs(os.path.join(P, 'exports'), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
for f in ['BebasNeue.ttf', 'Montserrat-ExtraBold.ttf']:
    shutil.copy(os.path.join(ROOT, 'Signature Style/fonts/pack', f), os.path.join(A, 'fonts'))
def sfx(name):
    for d in ['Setup/sfx-made', 'Setup/sound-effects']:
        p = os.path.join(ROOT, d, name + '.mp3')
        if os.path.exists(p):
            shutil.copy(p, A); return f'assets/{name}.mp3'
    raise SystemExit('no sfx ' + name)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
def probe(src, what):
    return subprocess.run(['ffprobe', '-v', 'error', '-select_streams', what, '-show_entries', 'stream=index,color_transfer', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip()
els, js, audio, t = [], [], [], 0.0
sliders = []
for i, s in enumerate(spec['shots']):
    d = s['dur']
    if 'slider' in s:
        b, a = s['slider']['before'], s['slider']['after']
        shutil.copy(b, os.path.join(A, f'shot{i}b.jpg')); shutil.copy(a, os.path.join(A, f'shot{i}a.jpg'))
        els.append(f'      <img id="v{i}" class="clip shot" src="assets/shot{i}b.jpg" data-start="{t:.2f}" data-duration="{d}" data-track-index="0" />')
        els.append(f'      <img id="v{i}a" class="clip shot" src="assets/shot{i}a.jpg" data-start="{t:.2f}" data-duration="{d}" data-track-index="1" />')
        els.append(f'      <div id="v{i}l" class="clip wipe" data-start="{t:.2f}" data-duration="{min(d, 1.4):.2f}" data-track-index="2"></div>')
        els.append(f'      <div id="v{i}tb" class="clip ba" style="left:50px" data-start="{t:.2f}" data-duration="0.5" data-track-index="2">BEFORE</div>')
        els.append(f'      <div id="v{i}ta" class="clip ba" style="right:50px" data-start="{t + 1.0:.2f}" data-duration="{d - 1.0:.2f}" data-track-index="2">AFTER</div>')
        sliders.append((i, t))
        audio.append((t + 0.35, sfx('whoosh-cinematic'), 0.7)); audio.append((t + 1.05, sfx('sparkle'), 0.5))
    elif s['src'].lower().endswith(('.jpg', '.png')):
        shutil.copy(s['src'], os.path.join(A, f'shot{i}.jpg'))
        els.append(f'      <img id="v{i}" class="clip shot" src="assets/shot{i}.jpg" data-start="{t:.2f}" data-duration="{d}" data-track-index="0" />')
    else:
        rate = s.get('rate', 1.0)
        tr = probe(s['src'], 'v:0').split(',')[-1]
        vf = (TONEMAP if tr in ('arib-std-b67', 'smpte2084') else '') + f"setpts=PTS/{rate},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
        out = os.path.join(A, f'shot{i}.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s['in']), '-i', s['src'], '-t', str(d * rate + 0.1), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', out], check=True)
        els.append(f'      <video id="v{i}" class="clip shot" src="assets/shot{i}.mp4" muted playsinline data-start="{t:.2f}" data-duration="{d}" data-media-start="0" data-track-index="0"></video>')
        vol = s.get('vol', 0.55)
        if vol > 0 and probe(s['src'], 'a:0'):
            af = f"atempo={max(0.5, min(2.0, rate))},afade=t=in:d=0.03,afade=t=out:st={max(0, d - 0.06):.2f}:d=0.06,loudnorm=I=-18:TP=-2"
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s['in']), '-i', s['src'], '-t', str(d * rate + 0.1), '-vn', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', os.path.join(A, f'nat{i}.m4a')], check=True)
            audio.append((t, f'assets/nat{i}.m4a', vol, d))
    js.append(f'["#v{i}",{t:.2f},{d}]')
    if i > 0 and 'slider' not in s: audio.append((max(0, t - 0.1), sfx('whoosh-short'), 0.35))
    t += d
total = round(t, 2)
h = spec['hook']
hook = html.escape(h['text']).replace(html.escape(h['red']), f'<span class="red">{html.escape(h["red"])}</span>').replace('\n', '<br>')
audio.append((0.0, sfx('boom'), 0.8))
lines, ljs, shakes, flashes = [], [], [0.0], []
for i, l in enumerate(spec['lines']):
    y = l.get('y', 640)
    txt = html.escape(l['text']).replace('\n', '<br>')
    for w in l.get('gold', []): txt = txt.replace(html.escape(w), f'<span class="y">{html.escape(w)}</span>')
    if l.get('box'):
        txt = f'<span class="b">{txt}</span>'; cls = 'box'
    else: cls = 'line'
    lines.append(f'      <div id="l{i}" class="clip {cls}" style="top:{y}px" data-start="{l["t"]}" data-duration="{l["dur"]}" data-track-index="{4 + i % 2}">{txt}</div>')
    if l['t'] > 0: ljs.append(f'["#l{i}",{l["t"]}]')
    if l.get('sfx', 'pop'): audio.append((l['t'], sfx(l.get('sfx', 'pop')), l.get('vol', 0.55)))
    if l.get('shake'): shakes.append(l['t'])
    if l.get('flash'): flashes.append(l['t'])
for e in spec.get('events', []):
    audio.append((e['t'], sfx(e['sfx']), e.get('vol', 0.6)))
aud = []
for k, a in enumerate(audio):
    st, src, vol = a[0], a[1], a[2]
    dur = a[3] if len(a) > 3 else 1.6
    dur = min(dur, total - st)
    aud.append(f'      <audio id="a{k}" class="clip" src="{src}" data-start="{st:.2f}" data-duration="{dur:.2f}" data-volume="{vol}" data-track-index="{8 + k % 6}"></audio>')
slider_js = "".join(
    f'      tl.fromTo("#v{i}a", {{ clipPath: "inset(0 100% 0 0)" }}, {{ clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "power2.inOut", immediateRender: true }}, {t + 0.35:.2f});\n'
    f'      tl.fromTo("#v{i}l", {{ x: 0 }}, {{ x: 1080, duration: 1.0, ease: "power2.inOut", immediateRender: true }}, {t + 0.35:.2f});\n'
    f'      tl.fromTo("#v{i}a", {{ scale: 1.06 }}, {{ scale: 1, duration: 2, ease: "power1.out", immediateRender: false }}, {t + 0.35:.2f});\n'
    for i, t in sliders)
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
      /* Hook: Bebas Neue, black on white boxes, trigger word in Mayo's red. */
      .hook {{ position: absolute; top: 240px; left: 50px; right: 50px; text-align: center; z-index: 20; font: 400 {h.get('size', 128)}px/1.22 "Bebas", sans-serif; }}
      .hook span.b, .box span.b {{ background: #fff; color: #111; padding: 4px 26px 0; border-radius: 16px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }}
      .red {{ color: #c4553b; }}
      /* Lines: Montserrat ExtraBold, white with black outline, key words gold. */
      .line {{ position: absolute; left: 60px; right: 60px; text-align: center; z-index: 18; color: #fff; font: 800 76px/1.16 "Montserrat", sans-serif; text-transform: uppercase; text-wrap: balance;
        -webkit-text-stroke: 10px #000; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0,0,0,.55); }}
      .box {{ position: absolute; left: 50px; right: 50px; text-align: center; z-index: 18; font: 400 116px/1.22 "Bebas", sans-serif; }}
      .y {{ color: #ffd23f; }}
      .box .y {{ color: #c4553b; }}
      .wipe {{ position: absolute; top: 0; bottom: 0; left: 0; width: 10px; margin-left: -5px; background: #fff; z-index: 12; box-shadow: 0 0 24px rgba(0,0,0,.5); }}
      .ba {{ position: absolute; top: 1250px; z-index: 16; font: 400 72px/1 "Bebas", sans-serif; color: #fff; background: rgba(0,0,0,.6); padding: 12px 26px 6px; border-radius: 12px; }}
      .flash {{ position: absolute; inset: 0; background: #fff; z-index: 30; opacity: 0; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
      <div id="cam">
{chr(10).join(els)}
      </div>
      <div id="fx" class="clip flash" data-start="0" data-duration="{total}" data-track-index="3"></div>
      <div id="hook" class="clip hook" data-start="0" data-duration="{h['dur']}" data-track-index="3"><span class="b">{hook}</span></div>
{chr(10).join(lines)}
{chr(10).join(aud)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      [{",".join(js)}].forEach(([id, t, d]) => {{
        tl.fromTo(id, {{ scale: 1.14 }}, {{ scale: 1, duration: Math.min(d, 0.5), ease: "power3.out", immediateRender: false }}, t);
      }});
      // Hook is readable on frame 0, then punches with the boom.
      tl.fromTo("#hook", {{ scale: 1 }}, {{ keyframes: [{{ scale: 1.12, duration: 0.06 }}, {{ scale: 1, duration: 0.22, ease: "back.out(3)" }}], immediateRender: false }}, 0.02);
      [{",".join(ljs)}].forEach(([id, t]) => {{
        tl.fromTo(id, {{ scale: 1.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.16, ease: "power4.out", immediateRender: false }}, t);
      }});
      // Camera shake on punches.
      [{",".join(f"{s:.2f}" for s in shakes)}].forEach((t) => {{
        tl.fromTo("#cam", {{ x: 0, y: 0 }}, {{ keyframes: [{{ x: -18, y: 10, duration: 0.04 }}, {{ x: 16, y: -12, duration: 0.04 }}, {{ x: -10, y: 6, duration: 0.04 }}, {{ x: 6, y: -4, duration: 0.04 }}, {{ x: 0, y: 0, duration: 0.05 }}], immediateRender: false }}, t + 0.02);
      }});
      [{",".join(f"{s:.2f}" for s in flashes)}].forEach((t) => {{
        tl.fromTo("#fx", {{ opacity: 0.8 }}, {{ opacity: 0, duration: 0.25, ease: "power2.out", immediateRender: false }}, t);
      }});
{slider_js}      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
open(os.path.join(P, 'index.html'), 'w').write(doc)
print(P, total)

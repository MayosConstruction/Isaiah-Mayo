"""Build a text-driven reel (hook + pain-point lines over job footage) as a HyperFrames project.
Usage: textreel.py spec.json   (spec: name, shots[{src,in,dur,rate?}], hook{text,red,dur}, lines[{t,dur,text,y?}], end?)
Footage is pre-cut to 1080x1920 SDR h264 segments (HDR iPhone clips are tone-mapped)."""
import json, subprocess, sys, os, shutil, html
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # AI Video Editor
spec = json.load(open(sys.argv[1]))
P = os.path.join(ROOT, 'Projects', spec['name']); A = os.path.join(P, 'assets')
os.makedirs(os.path.join(A, 'fonts'), exist_ok=True); os.makedirs(os.path.join(P, 'exports'), exist_ok=True)
shutil.copy(os.path.join(ROOT, 'Setup/node_modules/gsap/dist/gsap.min.js'), A)
for f in ['BebasNeue.ttf', 'Montserrat-ExtraBold.ttf']:
    shutil.copy(os.path.join(ROOT, 'Signature Style/fonts/pack', f), os.path.join(A, 'fonts'))
for f in ['whoosh-short.mp3', 'pop.mp3', 'impact-bass-1.mp3']:
    shutil.copy(os.path.join(ROOT, 'Setup/sound-effects', f), A)
TONEMAP = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,"
vids, js, t = [], [], 0.0
for i, s in enumerate(spec['shots']):
    out = os.path.join(A, f'shot{i}.' + ('jpg' if s['src'].lower().endswith(('.jpg', '.png')) else 'mp4'))
    if out.endswith('.jpg'):
        shutil.copy(s['src'], out)
        vids.append(f'      <img id="v{i}" class="clip shot" src="assets/shot{i}.jpg" data-start="{t:.2f}" data-duration="{s["dur"]}" data-track-index="0" />')
    else:
        tr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer', '-of', 'csv=p=0', s['src']], capture_output=True, text=True).stdout.strip()
        rate = s.get('rate', 1.0)
        vf = (TONEMAP if tr in ('arib-std-b67', 'smpte2084') else '') + f"setpts=PTS/{rate},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s['in']), '-i', s['src'], '-t', str(s['dur'] * rate + 0.1), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '18', out], check=True)
        vids.append(f'      <video id="v{i}" class="clip shot" src="assets/shot{i}.mp4" muted playsinline data-start="{t:.2f}" data-duration="{s["dur"]}" data-media-start="0" data-track-index="0"></video>')
    js.append(f'["#v{i}",{t:.2f},{s["dur"]}]'); t += s['dur']
total = round(t, 2)
h = spec['hook']; hook = html.escape(h['text']).replace(html.escape(h['red']), f'<span class="red">{html.escape(h["red"])}</span>').replace('\n', '<br>')
lines, ljs, sfx = [], [], []
for i, l in enumerate(spec['lines']):
    y = l.get('y', 640)
    txt = html.escape(l['text']).replace('\n', '<br>')
    for w in l.get('gold', []): txt = txt.replace(html.escape(w), f'<span class="y">{html.escape(w)}</span>')
    cls = 'box' if l.get('box') else 'line'
    lines.append(f'      <div id="l{i}" class="clip {cls}" style="top:{y}px" data-start="{l["t"]}" data-duration="{l["dur"]}" data-track-index="{4 + i % 2}">{txt}</div>')
    if l["t"] > 0: ljs.append(f'["#l{i}",{l["t"]}]')
    sfx.append(f'      <audio id="p{i}" class="clip" src="assets/pop.mp3" data-start="{l["t"]}" data-duration="0.5" data-volume="0.45" data-track-index="{8 + i % 2}"></audio>')
cuts = [float(j.split(',')[1]) for j in js[1:]]
for i, c in enumerate(cuts):
    sfx.append(f'      <audio id="w{i}" class="clip" src="assets/whoosh-short.mp3" data-start="{max(0, c - 0.08):.2f}" data-duration="0.8" data-volume="0.3" data-track-index="{10 + i % 2}"></audio>')
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
      /* Hook: Bebas Neue, black on white boxes, trigger word in Mayo's red. */
      .hook {{ position: absolute; top: 240px; left: 50px; right: 50px; text-align: center; z-index: 20; font: 400 {h.get('size', 124)}px/1.22 "Bebas", sans-serif; }}
      .hook span.b {{ background: #fff; color: #111; padding: 4px 26px 0; border-radius: 16px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }}
      .red {{ color: #c4553b; }}
      /* Pain-point lines: Montserrat ExtraBold, white with black outline, key words gold. */
      .line {{ position: absolute; left: 70px; right: 70px; text-align: center; z-index: 18; color: #fff; font: 800 70px/1.18 "Montserrat", sans-serif; text-transform: uppercase; text-wrap: balance;
        -webkit-text-stroke: 9px #000; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0,0,0,.55); }}
      .box {{ position: absolute; left: 50px; right: 50px; text-align: center; z-index: 18; font: 400 104px/1.22 "Bebas", sans-serif; }}
      .box {{ color: #111; }} .box::before {{ content: none; }}
      .box {{ background: none; }}
      .y {{ color: #ffd23f; }}
      .box .y {{ color: #c4553b; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{chr(10).join(vids)}
      <div id="hook" class="clip hook" data-start="0" data-duration="{h['dur']}" data-track-index="3"><span class="b">{hook}</span></div>
{chr(10).join(lines)}
{chr(10).join(sfx)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      [{",".join(js)}].forEach(([id, t, d]) => {{
        tl.fromTo(id, {{ scale: 1.1 }}, {{ scale: 1, duration: Math.min(d, 0.6), ease: "power3.out" }}, t);
      }});
      [{",".join(ljs)}].forEach(([id, t]) => {{
        tl.fromTo(id, {{ scale: 0.7, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.18, ease: "back.out(2)", immediateRender: false }}, t);
      }});
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
# box lines: wrap text in white pill spans
doc = doc.replace('class="clip box"', 'class="clip box"')
import re
doc = re.sub(r'(<div id="l\d+" class="clip box"[^>]*>)(.*?)(</div>)', lambda m: m.group(1) + '<span class="b" style="background:#fff;padding:4px 26px 0;border-radius:16px;-webkit-box-decoration-break:clone;box-decoration-break:clone">' + m.group(2) + '</span>' + m.group(3), doc)
open(os.path.join(P, 'index.html'), 'w').write(doc)
print(P, total)

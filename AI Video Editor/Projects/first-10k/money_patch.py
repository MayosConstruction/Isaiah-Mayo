# Adds the $0 -> $10,000 count-up over the before/after payoff (run after textreel2.py).
S, LAND = 18.4, 19.6
p='index.html';s=open(p).read()
s=s.replace('      .flash {','      .money { position: absolute; top: 560px; left: 0; right: 0; text-align: center; z-index: 22; font: 400 260px/1 "Bebas", sans-serif; color: #ffd23f; -webkit-text-stroke: 14px #000; paint-order: stroke fill; text-shadow: 0 10px 30px rgba(0,0,0,.6); }\n      .flash {',1)
s=s.replace('      <div id="hook"',f'      <div id="money" class="clip money" data-start="{S}" data-duration="{21.6-S:.1f}" data-track-index="6">$0</div>\n      <div id="hook"',1)
s=s.replace('      window.__timelines["main"] = tl;',f'''      // $0 -> $10,000 count-up, seek-safe (text set from tween progress).
      const m = {{ v: 0 }};
      tl.fromTo(m, {{ v: 0 }}, {{ v: 10000, duration: {LAND-S:.1f}, ease: "power2.in", immediateRender: false,
        onUpdate: () => {{ const n = Math.round(m.v / 50) * 50; document.getElementById("money").textContent = "$" + n.toLocaleString("en-US"); }} }}, {S});
      tl.fromTo("#money", {{ scale: 0.6 }}, {{ keyframes: [{{ scale: 1.25, duration: 0.12 }}, {{ scale: 1, duration: 0.25, ease: "back.out(3)" }}], immediateRender: false }}, {LAND});
      tl.fromTo("#cam", {{ x: 0, y: 0 }}, {{ keyframes: [{{ x: -20, y: 12, duration: 0.04 }}, {{ x: 18, y: -12, duration: 0.04 }}, {{ x: -10, y: 6, duration: 0.04 }}, {{ x: 0, y: 0, duration: 0.05 }}], immediateRender: false }}, {LAND + 0.02:.2f});
      window.__timelines["main"] = tl;''',1)
open(p,'w').write(s)

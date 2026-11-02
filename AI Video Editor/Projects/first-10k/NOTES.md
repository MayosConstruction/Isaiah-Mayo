# First $10K reel: build notes
Build: `../../Setup/whisper-env/bin/python build3.py` (v4 "heart" cut). `build.py` is the older fast cut.
- Tools used: organic-light-leak-overlay (registry block, made portrait + local GSAP) on the turn;
  Film Memory recipe tried, but shader grading needs WebGL (not in this render box), so the past uses a CSS B&W/sepia look.
  grain-overlay skipped: its CSS infinite animation isn't seek-safe.
- Sounds: Setup/sfx-made heartbeat (struggle), riser + boom (turn), roll/tick/coin/ching (money).
- On a Mac with a GPU, swap the CSS look for data-color-grading Film Memory (vintage-wash 0.7, vignette .16, grain .14).

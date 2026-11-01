# Jump-cut a talking-head take: drop the pauses, alternate normal and punched-in
# framing on each sentence, and bring the voice up to Instagram loudness.
# Usage: python3 cut.py <input> <output>
import subprocess, sys

src, out = sys.argv[1], sys.argv[2]
PAD = 0.06          # keep a hair of breath around each cut
CENTER = (0.5, 0.40)  # zoom toward the face

# Speech segments between the measured pauses (seconds), with zoom per segment.
SEGS = [(0.00, 4.05, 1.00), (4.95, 6.56, 1.25), (7.00, 10.03, 1.00), (10.63, 11.47, 1.30),
        (11.85, 14.30, 1.00), (15.08, 15.50, 1.25), (15.87, 17.17, 1.00), (17.65, 20.07, 1.25)]

parts, labels = [], []
for i, (a, b, z) in enumerate(SEGS):
    a, b = max(0, a - PAD if i else 0), b + PAD
    cw, ch = f"trunc(iw/{z}/2)*2", f"trunc(ih/{z}/2)*2"
    cx, cy = f"(iw-{cw})*{CENTER[0]}", f"(ih-{ch})*{CENTER[1]}"
    parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,crop={cw}:{ch}:{cx}:{cy},scale=1080:1920,setsar=1[v{i}];"
                 f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b - a - 0.02:.3f}:d=0.02[a{i}];")
    labels.append(f"[v{i}][a{i}]")
graph = "".join(parts) + "".join(labels) + f"concat=n={len(SEGS)}:v=1:a=1[v][a0];[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out], check=True)

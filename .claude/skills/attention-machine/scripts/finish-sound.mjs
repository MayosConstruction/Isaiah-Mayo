// Sets an exported video's sound to -14 LUFS with peaks under -1.5 dB, like the
// Attention Machine. The picture is copied untouched.
//
//   node finish-sound.mjs <export.mp4>
import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { levelFilter, measure } from "./loudness.mjs";

const video = process.argv[2];
if (!video) {
  console.error("usage: finish-sound.mjs <export.mp4>");
  process.exit(1);
}

const before = measure(video);
const temp = video.replace(/(\.\w+)$/, ".finishing$1");
execFileSync(
  "ffmpeg",
  ["-v", "error", "-y", "-i", video, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", levelFilter(before.lufs), "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", temp],
  { stdio: "inherit" },
);
renameSync(temp, video);
const after = measure(video);
console.error(`Sound was ${before.lufs} LUFS (peak ${before.peak} dB), now ${after.lufs} LUFS (peak ${after.peak} dB).`);

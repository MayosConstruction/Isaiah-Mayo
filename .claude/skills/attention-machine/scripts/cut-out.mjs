// Cuts the speaker out of one stretch of a recording, for graphics behind them. Both layers
// come from one run, so they line up exactly: base.webm (the whole picture) goes under the
// graphics, cut-out.webm (only the speaker, see-through around them) over them. Play both
// muted from the same frame, in place of the recording. Make the stretch a whole clip, cut to
// cut, so the switch to base.webm hides in a cut.
//
// It needs the video project's packages, so copy it into the project's scripts/ and run it
// there. Install them once per project:
//   npx remotion add @remotion/video-matting
//   npm i @mediabunny/server@<the version of mediabunny that came with it>
//
//   node scripts/cut-out.mjs <recording> <from> <to> <folder>
//     from, to: seconds in the recording. Writes base.webm and cut-out.webm into the folder.
//     It runs on this computer's graphics chip and says so if it can't. The first run
//     downloads the model.
import { env } from "@huggingface/transformers";
import { registerMediabunnyServer } from "@mediabunny/server";
import { canUseVideoMatting, disposeVideoMattingModel, downloadVideoMattingModel, separateVideoLayers } from "@remotion/video-matting";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MODEL = "modnet";

const [recording, fromArg, toArg, folder] = process.argv.slice(2);
const [from, to] = [Number(fromArg), Number(toArg)];
if (!recording || !folder || !(from >= 0) || !(to > from)) {
  console.error("usage: cut-out.mjs <recording> <from seconds> <to seconds> <folder>");
  process.exit(1);
}

registerMediabunnyServer();
env.cacheDir = join(tmpdir(), "attention-machine-models");
const check = await canUseVideoMatting({ model: MODEL });
if (!check.supported) {
  console.error(`This computer can't cut out video: ${check.detailedReason}`);
  process.exit(1);
}

// The model reads whole files, so the stretch is cut out first, to the frame.
const rate = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate", "-of", "csv=p=0", recording], { encoding: "utf8" });
const [num, den] = rate.trim().split("/").map(Number);
const fps = num / (den || 1);
const first = Math.round(from * fps);
const frames = Math.round(to * fps) - first;
const stretch = join(tmpdir(), `cut-out-${process.pid}.mp4`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", (Math.max(0, first - 0.25) / fps).toFixed(6), "-i", recording, "-map", "0:v:0", "-frames:v", String(frames), "-c:v", "libx264", "-crf", "8", "-pix_fmt", "yuv420p", stretch]);

await downloadVideoMattingModel({ model: MODEL });
const layers = await separateVideoLayers({ src: stretch, model: MODEL, audio: "none", videoBitrate: "very-high" });
mkdirSync(folder, { recursive: true });
for (const [name, layer] of [["base.webm", layers.base], ["cut-out.webm", layers.foreground]]) {
  writeFileSync(join(folder, name), Buffer.from(await (await layer.getBlob()).arrayBuffer()));
  await layer.dispose();
}
await disposeVideoMattingModel({ model: MODEL });
rmSync(stretch);
console.error(`Cut out ${layers.processedFrames} frames, ${(first / fps).toFixed(3)} to ${((first + frames) / fps).toFixed(3)} s in the recording.`);

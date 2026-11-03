#!/usr/bin/env node
// Uploads a video project's recordings (big media in public/), so a cloud export can read them.
// HEVC video is copied to H.264 first: Remotion's headless browser can't decode HEVC.
//
//   node scripts/cloud-upload.mjs <video project folder> [--again]
//
// Goes to <project folder name>/<path in public/> in RECORDINGS_BUCKET, or under recordings/ in
// Remotion's own bucket. A recording already there is skipped unless it changed since, or --again
// is given. Settings: see cloud-common.mjs.
import { execFileSync, spawnSync } from "node:child_process";
import { createReadStream, mkdirSync, renameSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cloud, recordingMetadata, recordings, sameRecording } from "./cloud-common.mjs";

const args = process.argv.slice(2);
const folders = args.filter((a) => !a.startsWith("--"));
if (folders.length !== 1 || args.some((a) => a.startsWith("--") && a !== "--again")) {
  throw new Error("usage: cloud-upload.mjs <video project folder> [--again]");
}
const c = await cloud(folders[0]);
const { Upload } = c.require("@aws-sdk/lib-storage");
const TYPES = { mov: "video/quicktime", mp4: "video/mp4", m4v: "video/mp4", m4a: "audio/mp4", wav: "audio/wav", mp3: "audio/mpeg", aac: "audio/aac" };

const probe = (file, entries) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
const copyOf = (rel) => join(tmpdir(), "cloud-render", c.slug, rel);

function h264Copy(rel, recording) {
  const source = join(c.publicDir, rel);
  const [codec, rate, bitrate] = probe(source, "stream=codec_name,r_frame_rate,bit_rate").split(",");
  if (codec !== "hevc") return source;
  const copy = copyOf(rel);
  const mtime = Math.round(recording.mtimeMs);
  // The copy takes the recording's modified time, so a changed recording gets a new copy.
  if (Math.round(statSync(copy, { throwIfNoEntry: false })?.mtimeMs) !== mtime) {
    mkdirSync(dirname(copy), { recursive: true });
    // Same visual quality at about 1.6x the HEVC size; a keyframe every second for fast seeking.
    const target = Math.round((Number(bitrate) || 14e6) * 1.6);
    const [num, den] = rate.split("/").map(Number);
    const encoder = process.platform === "darwin" ? "h264_videotoolbox" : "libx264";
    const part = `${copy}.${process.pid}.part.mov`;
    console.log(`copying ${rel} to H.264...`);
    const run = spawnSync("ffmpeg", ["-v", "error", "-stats", "-y", "-i", source, "-map", "0:v:0", "-map", "0:a?", "-c:v", encoder, "-b:v", String(target), "-g", String(Math.round(num / (den || 1))), "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", part], { stdio: "inherit" });
    if (run.status !== 0) throw new Error(`ffmpeg failed on ${rel}`);
    utimesSync(part, new Date(), new Date(mtime));
    renameSync(part, copy);
  }
  // The edit addresses the recording by frame, so the copy must match exactly and decode cleanly.
  const [was, is] = [source, copy].map((f) => probe(f, "stream=nb_frames,r_frame_rate"));
  if (was !== is) throw new Error(`${rel}: the copy has ${is}, the original ${was}. Delete ${copy} and run again.`);
  const decode = spawnSync("ffmpeg", ["-v", "error", "-skip_frame", "nokey", "-i", copy, "-an", "-f", "null", "-"], { encoding: "utf8" });
  if (decode.status !== 0 || decode.stderr.trim()) throw new Error(`${rel}: the copy doesn't decode cleanly. Delete ${copy} and run again.`);
  return copy;
}

async function put(file, rel, metadata) {
  const target = { Bucket: c.bucket, Key: c.key(rel) };
  const upload = new Upload({
    client: c.s3.client,
    partSize: 64 * 1024 * 1024,
    queueSize: 4,
    leavePartsOnError: true,
    params: { ...target, Body: createReadStream(file), ContentType: TYPES[rel.split(".").pop().toLowerCase()], Metadata: metadata },
  });
  let shown = 0;
  upload.on("httpUploadProgress", ({ loaded, total }) => {
    const percent = Math.floor((loaded / total) * 10) * 10;
    if (percent > shown) console.log(`${rel}: ${(shown = percent)}%`);
  });
  try {
    await upload.done();
  } catch (err) {
    // Remotion's user policy can't abort an upload, so cleaning up is best effort and never hides the error.
    if (upload.uploadId) await c.s3.client.send(new c.s3.sdk.AbortMultipartUploadCommand({ ...target, UploadId: upload.uploadId })).catch(() => {});
    throw err;
  }
}

const files = recordings(c.publicDir);
if (!files.length) throw new Error("No recordings (media files of 50 MB or more) in public/.");
for (const rel of files) {
  const recording = statSync(join(c.publicDir, rel));
  const object = args.includes("--again") ? null : await c.head(c.key(rel));
  // Older uploads count as up to date at the size of the recording or its copy.
  if (object && (sameRecording(object, recording) ?? [recording.size, statSync(copyOf(rel), { throwIfNoEntry: false })?.size].includes(object.ContentLength))) {
    console.log(`${rel} is already in the bucket`);
    continue;
  }
  const file = /\.(mov|mp4|m4v)$/i.test(rel) ? h264Copy(rel, recording) : join(c.publicDir, rel);
  console.log(`uploading ${rel}...`);
  await put(file, rel, recordingMetadata(recording));
}
console.log(`ready for cloud-render.mjs (${files.length} recording${files.length > 1 ? "s" : ""})`);

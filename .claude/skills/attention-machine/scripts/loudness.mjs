// Loudness the way the Attention Machine sets it: one fixed gain that lands the
// sound on -14 LUFS, then a limiter that holds peaks under -1.5 dB.
import { spawnSync } from "node:child_process";

export const TARGET_LUFS = -14;
const PEAK_CEILING_DB = -1.5;
const GAIN_LIMIT_DB = 20;

export function measure(file, stream = "0:a:0") {
  const { stderr: log, status } = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-map", stream, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  if (status !== 0) throw new Error(`Couldn't measure the sound of ${file}:\n${log}`);
  const summary = log.slice(log.lastIndexOf("Summary:"));
  return {
    lufs: Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1] ?? -70),
    peak: Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1] ?? -70),
  };
}

export function levelFilter(lufs) {
  const gain = Math.max(-GAIN_LIMIT_DB, Math.min(GAIN_LIMIT_DB, TARGET_LUFS - (Number.isFinite(lufs) ? lufs : -70)));
  return `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${PEAK_CEILING_DB}dB:attack=5:release=50:level=false:latency=true,aresample=48000`;
}

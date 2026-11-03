// Stills of chosen moments, without exporting the whole video.
// From a video project it builds the project once, then each still takes about a second.
// From a video file, like an export, it takes the frames with ffmpeg, to check the file itself.
// Each still is a full-size PNG. The sheet puts them all in one picture, in the order
// asked, each with its time and frame number.
//
//   node stills.mjs <project folder> <composition> <times...> [--out=<folder>]
//   node stills.mjs <video file> <times...> [--out=<folder>]
//     composition: its id in src/Root.tsx.
//     times: 310 is frame 310, 12.4s is 12.4 seconds, 1:05.2 is 1 minute 5.2 seconds.
//       A time between 2 frames takes the nearest one.
//     --out: where the stills go (default: a new folder in the system temp folder).
//     Prints the path of each still, then the sheet's, one per line.
//
// A project is built with its own Remotion and its remotion.config.ts, like `npx remotion still`.
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";

const PARALLEL = 3;
const TILE_PX = 640;
const STRIP_PX = 40;
const LABEL_PX = 24;
const SHEET_ASPECT = 4 / 3;
const FONTS = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
];

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
};
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
const [input, ...rest] = args.filter((a) => !a.startsWith("--"));
const isProject = existsSync(input ?? "") && statSync(input).isDirectory();
const [compositionId, ...times] = isProject ? rest : [null, ...rest];
if (!input || times.length === 0) {
  fail("usage: stills.mjs <project folder> <composition> <times...> [--out=<folder>]\n       stills.mjs <video file> <times...> [--out=<folder>]");
}
if (!existsSync(input)) fail(`There's nothing at ${input}.`);
const source = resolve(input);
const outDir = option("out", "") && resolve(option("out"));

const seconds = (time) => {
  const s = /^(\d+(?:\.\d+)?)s$/.exec(time);
  const ms = /^(\d+):([0-5]\d(?:\.\d+)?)$/.exec(time);
  return s ? Number(s[1]) : ms ? Number(ms[1]) * 60 + Number(ms[2]) : null;
};
const bad = times.find((time) => !/^\d+$/.test(time) && seconds(time) === null);
if (bad) fail(`Bad time "${bad}": write a frame number (310), seconds (12.4s) or minutes:seconds (1:05.2).`);

const clock = (s) => {
  const hundredths = Math.round(s * 100);
  const minutes = Math.floor(hundredths / 6000);
  return `${minutes}:${((hundredths - minutes * 6000) / 100).toFixed(2).padStart(5, "0")}`;
};
const took = (from, to = Date.now()) => `${((to - from) / 1000).toFixed(1)} s`;
const count = (stills) => `${stills.length} ${stills.length === 1 ? "still" : "stills"}`;

// The same frame asked for twice is made once.
const stillsAt = (fps, total) => {
  const frames = new Set(
    times.map((time) => {
      const frame = /^\d+$/.test(time) ? Number(time) : Math.round(seconds(time) * fps);
      if (frame >= total) throw new Error(`${time} is past the end: the video is ${clock(total / fps)} long, ${total} frames.`);
      return frame;
    }),
  );
  const out = outDir || mkdtempSync(join(tmpdir(), `stills-${basename(source, extname(source))}-`));
  mkdirSync(out, { recursive: true });
  return [...frames].map((frame) => ({
    frame,
    label: `${clock(frame / fps)}  frame ${frame}`,
    path: join(out, `${clock(frame / fps).replace(":", "m")}s-frame${frame}.png`),
  }));
};

const inParallel = (items, work) => {
  const queue = [...items];
  const worker = async () => {
    while (queue.length) await work(queue.shift());
  };
  return Promise.all(Array.from({ length: PARALLEL }, worker));
};

const fromProject = async (project) => {
  // Remotion looks for its downloaded browser from the working folder, as when run in the project.
  process.chdir(project);
  const need = createRequire(join(project, "package.json"));
  let packages;
  try {
    packages = ["@remotion/cli", "@remotion/cli/config", "@remotion/renderer/client", "@remotion/bundler", "@remotion/renderer"].map((name) => need(name));
  } catch {
    throw new Error(`${project} isn't a video project: Remotion isn't installed in it.`);
  }
  const [{ CliInternals }, { ConfigInternals }, { BrowserSafeApis }, { bundle }, { openBrowser, selectComposition, renderStill }] = packages;
  await CliInternals.loadConfig(project);
  const setting = (name) => BrowserSafeApis.options[`${name}Option`]?.getValue({ commandLine: {} }).value ?? null;
  const entryPoint = CliInternals.findEntryPoint({ args: [], remotionRoot: project, logLevel: "error", allowDirectory: false }).file;
  if (!entryPoint) throw new Error(`${project} isn't a video project: it has no src/index.ts.`);
  const timeoutInMilliseconds = setting("delayRenderTimeoutInMilliseconds") ?? undefined;
  let bundleDir = null;
  try {
    const started = Date.now();
    const serveUrl = await bundle({
      entryPoint,
      rootDir: project,
      publicDir: setting("publicDir"),
      rspack: setting("rspack") ?? false,
      webpackOverride: ConfigInternals.getWebpackOverrideFn(),
      rspackOverride: ConfigInternals.getRspackOverrideFn?.(),
      bundlerOverride: ConfigInternals.getBundlerOverrideFn?.(),
      // Off: the cache would be written into the project's node_modules.
      enableCaching: false,
      symlinkPublicDir: true,
      onDirectoryCreated: (dir) => (bundleDir = dir),
    });
    const built = Date.now();
    const browser = await openBrowser("chrome", {
      browserExecutable: setting("browserExecutable"),
      chromeMode: setting("chromeMode") ?? undefined,
      chromiumOptions: { gl: setting("gl") },
      logLevel: "error",
    });
    const composition = await selectComposition({ serveUrl, id: compositionId, puppeteerInstance: browser, timeoutInMilliseconds, logLevel: "error" });
    const stills = stillsAt(composition.fps, composition.durationInFrames);
    await inParallel(stills, ({ frame, path }) =>
      renderStill({ serveUrl, composition, frame, output: path, puppeteerInstance: browser, timeoutInMilliseconds, overwrite: true, logLevel: "error" }),
    );
    // Closed only here: after a failure Remotion may still be closing a page in it, and
    // the browser ends with this process anyway.
    await browser.close({ silent: true });
    console.error(`Built in ${took(started, built)}, then ${count(stills)} in ${took(built)}.`);
    return stills;
  } finally {
    if (bundleDir) rmSync(bundleDir, { recursive: true, force: true });
  }
};

const rate = (fraction) => {
  const [num, den] = String(fraction).split("/").map(Number);
  return num / den;
};
const run = promisify(execFile);

const fromVideo = async (video) => {
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate,r_frame_rate,duration:format=duration", "-of", "json", video], {
    encoding: "utf8",
  });
  const { streams: [stream] = [], format = {} } = probe.status === 0 ? JSON.parse(probe.stdout) : {};
  const fps = [stream?.avg_frame_rate, stream?.r_frame_rate].map(rate).find((r) => r > 0);
  const duration = Number(stream?.duration ?? format.duration);
  if (!fps || !(duration > 0)) throw new Error(`Can't read ${video} as a video.`);
  const started = Date.now();
  const stills = stillsAt(fps, Math.round(duration * fps));
  await inParallel(stills, async ({ frame, label, path }) => {
    rmSync(path, { force: true });
    // ffmpeg takes the first frame at or after -ss, so half a frame early lands on this one.
    await run("ffmpeg", ["-v", "error", "-y", "-ss", Math.max(0, (frame - 0.5) / fps).toFixed(6), "-i", video, "-map", "0:v:0", "-frames:v", "1", "-update", "1", path]);
    if (!existsSync(path)) throw new Error(`There's no picture at ${label} in ${video}.`);
  });
  console.error(`${count(stills)} in ${took(started)}.`);
  return stills;
};

// Filter values are unescaped twice: once by the filter graph, once by the filter.
const escapeFilter = (value) => value.replace(/[\\':]/g, "\\$&").replace(/[\\'[\],;]/g, "\\$&");

const labelFont = () => {
  if (!/\bdrawtext\b/.test(execFileSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" }))) return null;
  const font = FONTS.find((file) => existsSync(file)) ?? spawnSync("fc-match", ["-f", "%{file}", "sans-serif:bold"], { encoding: "utf8" }).stdout;
  return font && existsSync(font) ? font : null;
};

const makeSheet = (stills) => {
  const font = labelFont();
  if (!font) console.error("The sheet has no times on it: this ffmpeg can't draw text, or no font was found. The file names have them.");
  const head = readFileSync(stills[0].path).subarray(16, 24);
  const [width, height] = [head.readUInt32BE(0), head.readUInt32BE(4)];
  const n = stills.length;
  const rows = Math.ceil(n / Math.max(1, Math.round(Math.sqrt((n * height * SHEET_ASPECT) / width))));
  const columns = Math.ceil(n / rows);
  const tiles = stills.map(({ label }, i) => {
    const caption = font
      ? `,pad=iw:ih+${STRIP_PX}:0:${STRIP_PX},drawtext=fontfile=${escapeFilter(font)}:text=${escapeFilter(label)}:expansion=none:fontsize=${LABEL_PX}:fontcolor=white:x=12:y=(${STRIP_PX}-th)/2`
      : "";
    return `[${i}:v]scale=${TILE_PX}:${TILE_PX}:force_original_aspect_ratio=decrease${caption}[t${i}]`;
  });
  const grid = `${stills.map((_, i) => `[t${i}]`).join("")}concat=n=${n}:v=1:a=0,tile=${columns}x${rows}:nb_frames=${n}:padding=8:margin=8:color=0x303030`;
  const sheet = join(dirname(stills[0].path), "sheet.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", ...stills.flatMap(({ path }) => ["-i", path]), "-filter_complex", [...tiles, grid].join(";"), "-frames:v", "1", "-update", "1", sheet]);
  return sheet;
};

try {
  const stills = isProject ? await fromProject(source) : await fromVideo(source);
  const sheet = makeSheet(stills);
  console.log([...stills.map(({ path }) => path), sheet].join("\n"));
} catch (error) {
  fail(String(error.message ?? error).replace(/^Error: /, ""));
}

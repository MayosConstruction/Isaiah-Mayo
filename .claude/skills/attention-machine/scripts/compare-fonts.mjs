// Renders candidate fonts under a crop of the original text, each scaled to the
// original's width, so weight, width and letter shapes can be compared by eye.
//
//   node compare-fonts.mjs <frame.png> <x,y,w,h> "<words>" "<font>" ["<font>" ...] [options]
//     frame.png: a full-size frame (ffmpeg -ss <seconds> -i <video> -frames:v 1 frame.png).
//     x,y,w,h: a box around one line of text, with a little room around it.
//     words: exactly the words in the box, in the case shown.
//     font: a Google Fonts family with its styles, written as in a Google Fonts
//       link ("Barlow Semi Condensed:ital,wght@1,900", "Noto Serif Display:wdth,wght@62.5,600"),
//       or the path of a font file. Tweaks can follow:
//       +skew=<degrees> extra lean, +spacing=<em> letter spacing, +thicken=<em> a stroke in the same colour, like CSS -webkit-text-stroke.
//     Prints each font's height at the original's width: 1.00 is the same
//     proportions, above 1 the font is narrower than the original, below 1 wider.
//
//   --ink=<#rrggbb>  colour of the original letters (default #ffffff)
//   --tol=<0-255>    how far a pixel may be from that colour and still count (default 60)
//   --out=<file>     where the sheet goes (default compare-fonts.png)
//
// The red box on the original shows what was measured. If it doesn't hug the
// letters, fix the box, --ink or --tol before trusting the numbers.
// Needs @napi-rs/canvas: install it in a scratch folder (npm i @napi-rs/canvas)
// and run this from there.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_PX = 200;
const MIN_HITS = 2;
const MAX_NEUTRAL_CHROMA = 24;
const MIN_PART_SHARE = 0.02;
const LABEL_PX = 16;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
};
const [framePath, boxArg, words, ...fontArgs] = args.filter((a) => !a.startsWith("--"));
const box = (boxArg ?? "").split(",").map(Number);
const ink = option("ink", "#ffffff");
const tol = Number(option("tol", "60"));
const out = option("out", "compare-fonts.png");
if (!framePath || box.length !== 4 || box.some((n) => !(n >= 0)) || !words || fontArgs.length === 0 || !/^#[0-9a-f]{6}$/i.test(ink) || !(tol >= 0)) {
  console.error('usage: compare-fonts.mjs <frame.png> <x,y,w,h> "<words>" "<font>" ["<font>" ...] [--ink=#rrggbb] [--tol=<0-255>] [--out=<file>]');
  process.exit(1);
}

let canvasLib;
try {
  canvasLib = createRequire(join(process.cwd(), "noop.js"))("@napi-rs/canvas");
} catch {
  console.error("Needs @napi-rs/canvas: run `npm i @napi-rs/canvas` in this folder, then run this again from here.");
  process.exit(1);
}
const { createCanvas, loadImage, GlobalFonts } = canvasLib;

const inkRgb = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
// White, grey or black letters: pale sand or sky can be as close in colour, but not as colourless.
const neutralInk = chroma(...inkRgb) <= MAX_NEUTRAL_CHROMA;
const isInk = (d, i) =>
  Math.hypot(d[i] - inkRgb[0], d[i + 1] - inkRgb[1], d[i + 2] - inkRgb[2]) <= tol &&
  (!neutralInk || chroma(d[i], d[i + 1], d[i + 2]) <= MAX_NEUTRAL_CHROMA);
const isOpaque = (d, i) => d[i + 3] > 127;
const toMask = (data, test) => Uint8Array.from({ length: data.length / 4 }, (_, p) => (test(data, p * 4) ? 1 : 0));

// Letters sit inside the box. Ink-coloured patches that reach its edge, and specks
// far smaller than the biggest letter (sand, sky, highlights), are background.
const keepLetters = (mask, width, height) => {
  const label = new Int32Array(mask.length).fill(-1);
  const parts = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] >= 0) continue;
    const part = { size: 0, edge: false };
    label[start] = parts.length;
    const stack = [start];
    while (stack.length) {
      const p = stack.pop();
      const x = p % width;
      const y = (p - x) / width;
      part.size++;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) part.edge = true;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q >= 0 && q < mask.length && mask[q] && label[q] < 0) {
          label[q] = parts.length;
          stack.push(q);
        }
      }
    }
    parts.push(part);
  }
  const biggest = parts.reduce((max, part) => (part.edge ? max : Math.max(max, part.size)), 0);
  return mask.map((m, p) => (m && !parts[label[p]].edge && parts[label[p]].size >= biggest * MIN_PART_SHARE ? 1 : 0));
};

// Rows and columns with only a stray pixel or two don't count.
const inkBox = (mask, width, height) => {
  const rows = new Array(height).fill(0);
  const cols = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  const first = (a) => a.findIndex((n) => n >= MIN_HITS);
  const last = (a) => a.findLastIndex((n) => n >= MIN_HITS);
  const [top, left] = [first(rows), first(cols)];
  if (top < 0 || left < 0) return null;
  return { left, top, right: last(cols) + 1, bottom: last(rows) + 1 };
};

const cacheDir = join(tmpdir(), "compare-fonts");
mkdirSync(cacheDir, { recursive: true });
const fontFile = async (spec) => {
  if (existsSync(spec)) return spec;
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec)}`)).text();
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error("not on Google Fonts with those styles; check the name and styles on fonts.google.com");
  const file = join(cacheDir, createHash("sha1").update(url).digest("hex").slice(0, 16) + (url.match(/\.\w+$/)?.[0] ?? ".ttf"));
  if (!existsSync(file)) writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return file;
};

const render = (family, tweaks) => {
  const lean = Math.tan(((tweaks.skew ?? 0) * Math.PI) / 180);
  const spacing = (tweaks.spacing ?? 0) * BASE_PX;
  const thicken = (tweaks.thicken ?? 0) * BASE_PX;
  const font = `${BASE_PX}px "${family}"`;
  const probe = createCanvas(1, 1).getContext("2d");
  probe.font = font;
  const chars = [...words];
  // Placing each letter by the width of the text before it keeps the font's kerning.
  const xs = chars.map((_, i) => probe.measureText(chars.slice(0, i).join("")).width + i * spacing);
  const baseline = BASE_PX * 1.4;
  const pad = BASE_PX;
  const canvas = createCanvas(Math.ceil(pad * 2 + probe.measureText(words).width + chars.length * Math.abs(spacing) + baseline * Math.abs(lean)), BASE_PX * 2);
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.fillStyle = ctx.strokeStyle = ink;
  ctx.lineJoin = "round";
  ctx.lineWidth = thicken;
  ctx.setTransform(1, 0, -lean, 1, lean * baseline, 0);
  chars.forEach((ch, i) => {
    if (thicken > 0) ctx.strokeText(ch, pad + xs[i], baseline);
    ctx.fillText(ch, pad + xs[i], baseline);
  });
  return canvas;
};

const frame = await loadImage(framePath);
const [bx, by, bw, bh] = box;
const original = createCanvas(bw, bh);
const octx = original.getContext("2d");
octx.drawImage(frame, bx, by, bw, bh, 0, 0, bw, bh);
const odata = octx.getImageData(0, 0, bw, bh).data;
const omask = keepLetters(toMask(odata, isInk), bw, bh);
const target = inkBox(omask, bw, bh);
if (!target) {
  console.error(`No letters of colour ${ink} inside the box. Check the box leaves room around the letters, then --ink and --tol.`);
  process.exit(1);
}
const targetW = target.right - target.left;
const targetH = target.bottom - target.top;
console.log(`original: letters ${targetW}x${targetH}px, top left at ${bx + target.left},${by + target.top}`);

const background = [0, 1, 2].map((ch) => {
  const values = [];
  for (let p = 0; p < omask.length; p += 7) if (!omask[p]) values.push(odata[p * 4 + ch]);
  values.sort((a, b) => a - b);
  return values[values.length >> 1] ?? 0;
});

const rows = [];
for (const arg of fontArgs) {
  const [spec, ...tweakArgs] = arg.split(/\s+\+/);
  const tweaks = Object.fromEntries(tweakArgs.map((t) => t.split("=")).map(([k, v]) => [k.trim(), Number(v)]));
  try {
    const family = `compare-${rows.length}`;
    GlobalFonts.registerFromPath(await fontFile(spec.trim()), family);
    const rendered = render(family, tweaks);
    const rdata = rendered.getContext("2d").getImageData(0, 0, rendered.width, rendered.height).data;
    const got = inkBox(toMask(rdata, isOpaque), rendered.width, rendered.height);
    if (!got) throw new Error("drew nothing; the font may not have these characters");
    const scale = targetW / (got.right - got.left);
    const ratio = ((got.bottom - got.top) * scale) / targetH;
    console.log(`${ratio.toFixed(2)}  ${arg}`);
    rows.push({ label: `${arg}  ${ratio.toFixed(2)}`, rendered, got, scale });
  } catch (error) {
    console.log(`skipped  ${arg}: ${error.message}`);
  }
}

const sheet = createCanvas(bw, bh * (rows.length + 1));
const sctx = sheet.getContext("2d");
sctx.drawImage(original, 0, 0);
sctx.strokeStyle = "#ff3030";
sctx.lineWidth = 2;
sctx.strokeRect(target.left - 1, target.top - 1, targetW + 2, targetH + 2);
rows.forEach(({ rendered, got, scale }, i) => {
  const top = bh * (i + 1);
  const h = (got.bottom - got.top) * scale;
  sctx.save();
  sctx.beginPath();
  sctx.rect(0, top, bw, bh);
  sctx.clip();
  sctx.fillStyle = `rgb(${background.join(",")})`;
  sctx.fillRect(0, top, bw, bh);
  sctx.drawImage(rendered, got.left, got.top, got.right - got.left, got.bottom - got.top, target.left, top + target.bottom - h, targetW, h);
  sctx.restore();
});
sctx.font = `${LABEL_PX}px sans-serif`;
[{ label: "original", top: 0 }, ...rows.map(({ label }, i) => ({ label, top: bh * (i + 1) }))].forEach(({ label, top }) => {
  sctx.fillStyle = "rgba(0,0,0,0.7)";
  sctx.fillRect(0, top, sctx.measureText(label).width + 10, LABEL_PX + 8);
  sctx.fillStyle = "#ffffff";
  sctx.fillText(label, 5, top + LABEL_PX + 1);
});
writeFileSync(out, await sheet.encode("png"));
console.log(`sheet: ${out}`);

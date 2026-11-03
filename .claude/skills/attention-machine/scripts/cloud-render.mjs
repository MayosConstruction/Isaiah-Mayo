#!/usr/bin/env node
// Exports a video project on Remotion Lambda instead of on this computer, and downloads the result.
// Run cloud-upload.mjs first, and again whenever a recording changes.
//
//   node scripts/cloud-render.mjs <video project folder> <CompositionId> <output file> [remotion lambda render flags...]
//
// Each run: checks that the recordings in the bucket are up to date, makes sure a Lambda function
// for the project's Remotion version exists (10 GB memory and disk, 900 s), uploads the project as
// the site <project folder name> (public/ without the recordings), then renders with the
// recordings read from the bucket through links signed for 12 hours. The project resolves them
// with src/media.ts. The export's cloud copy deletes itself a day later. Settings: see cloud-common.mjs.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { cloud, recordings, sameRecording } from "./cloud-common.mjs";

const FUNCTION = { memorySizeInMb: 10240, diskSizeInMb: 10240, timeoutInSeconds: 900 };

const [folder, composition, output, ...flags] = process.argv.slice(2);
if (!output || [folder, composition, output].some((a) => a.startsWith("--"))) {
  throw new Error("usage: cloud-render.mjs <video project folder> <CompositionId> <output file> [flags...]");
}
const c = await cloud(folder);
const scratch = join(tmpdir(), "cloud-render", c.slug);
mkdirSync(scratch, { recursive: true });
// The project's own Remotion CLI, not through npx: on Windows that needs a shell, which breaks paths with spaces.
const remotion = (args) => {
  const cli = join(c.dir, "node_modules", "@remotion", "cli");
  const run = spawnSync(process.execPath, [join(cli, JSON.parse(readFileSync(join(cli, "package.json"), "utf8")).bin.remotion), ...args], { cwd: c.dir, stdio: "inherit" });
  if (run.status !== 0) throw new Error(`remotion ${args.slice(0, 3).join(" ")} failed (see above).`);
};

const files = recordings(c.publicDir);
const footage = {};
for (const rel of files) {
  const object = await c.head(c.key(rel));
  if (!object) throw new Error(`${rel} isn't in the bucket yet. Run cloud-upload.mjs first.`);
  if (sameRecording(object, statSync(join(c.publicDir, rel))) === false) throw new Error(`${rel} changed since it was uploaded. Run cloud-upload.mjs again.`);
  footage[rel] = await c.lambda.presignUrl({ region: c.region, bucketName: c.bucket, objectKey: c.key(rel), expiresInSeconds: 43200 });
}
const props = join(scratch, "props.json");
writeFileSync(props, JSON.stringify({ footage }));

const functionName = c.require("@remotion/lambda/client").speculateFunctionName(FUNCTION);
const functions = await c.lambda.getFunctions({ region: c.region, compatibleOnly: true });
if (!functions.some((f) => f.functionName === functionName)) {
  remotion(["lambda", "functions", "deploy", `--region=${c.region}`, `--memory=${FUNCTION.memorySizeInMb}`, `--disk=${FUNCTION.diskSizeInMb}`, `--timeout=${FUNCTION.timeoutInSeconds}`]);
}

const site = join(scratch, "site-public");
rmSync(site, { recursive: true, force: true });
cpSync(c.publicDir, site, { recursive: true, dereference: true, filter: (src) => !files.includes(relative(c.publicDir, src).split(sep).join("/")) });
remotion(["lambda", "sites", "create", "src/index.ts", `--site-name=${c.slug}`, `--region=${c.region}`, `--public-dir=${site}`, "--enable-folder-expiry"]);

remotion(["lambda", "render", c.slug, composition, resolve(output), `--region=${c.region}`, `--function-name=${functionName}`, `--props=${props}`, "--privacy=private", "--delete-after=1-day", ...flags]);

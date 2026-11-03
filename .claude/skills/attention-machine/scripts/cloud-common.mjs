// Shared settings for exporting a video project on Remotion Lambda, in the user's own AWS account.
// See references/cloud-render.md.
//
// Settings come from the environment first, then from .attentionmachine/.env in the project
// folder or the nearest folder above it:
//   REMOTION_AWS_REGION             required, for example us-east-1
//   REMOTION_AWS_ACCESS_KEY_ID      the access key from Remotion's Lambda setup,
//   REMOTION_AWS_SECRET_ACCESS_KEY  with its secret
//   REMOTION_AWS_PROFILE            or an AWS profile that holds the key (default "remotion")
//   RECORDINGS_BUCKET               optional, a bucket of your own for the recordings. Without it
//                                   they go in the bucket Remotion makes for itself.
//
// Both scripts add @remotion/lambda to the project, at its Remotion version, when it's missing.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

// Files in public/ this big are recordings: they go to the bucket, not the site.
const BIG = 50 * 1024 * 1024;
const MEDIA = /\.(mov|mp4|m4v|m4a|wav|mp3|aac)$/i;
const SIGN_IN = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE", "REMOTION_AWS_ACCESS_KEY_ID", "REMOTION_AWS_SECRET_ACCESS_KEY", "REMOTION_AWS_SESSION_TOKEN", "REMOTION_AWS_PROFILE"];

let profile = "remotion";
const plain = (err) => {
  const text = String(err?.message ?? err).replace(/\s+/g, " ").trim();
  const status = err?.$metadata?.httpStatusCode;
  if (err?.name === "CredentialsProviderError") return `No AWS sign-in: put REMOTION_AWS_ACCESS_KEY_ID and REMOTION_AWS_SECRET_ACCESS_KEY in .attentionmachine/.env, or set up the AWS profile "${profile}".`;
  if (/^(InvalidAccessKeyId|SignatureDoesNotMatch|InvalidClientTokenId|UnrecognizedClientException)$/.test(err?.name)) return "AWS doesn't accept the access key. It was probably deleted or replaced.";
  if (status === 301 || err?.name === "PermanentRedirect") return "RECORDINGS_BUCKET is in another AWS region than REMOTION_AWS_REGION.";
  if (status === 403 || err?.name === "AccessDenied") return `AWS refused access: the AWS user is missing a permission${text === "UnknownError" ? "" : ` (${text})`}.`;
  return err?.name && !/^(Error|TypeError|RangeError)$/.test(err.name) ? `${err.name}: ${text}` : text;
};
// Every failure ends in a single plain line.
process.on("uncaughtException", (err) => {
  console.error(plain(err));
  process.exit(1);
});

function project(folder) {
  const dir = resolve(folder ?? "");
  if (!folder || !existsSync(join(dir, "src", "index.ts")) || !existsSync(join(dir, "public"))) {
    throw new Error("Pass a video project folder (the one with src/index.ts and public/).");
  }
  return { dir, slug: basename(dir), publicDir: join(dir, "public") };
}

export function recordings(publicDir) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (MEDIA.test(entry.name) && statSync(path).size >= BIG) found.push(relative(publicDir, path).split(sep).join("/"));
    }
  };
  walk(publicDir);
  return found;
}

function settingsFile(dir) {
  for (let at = dir; ; at = dirname(at)) {
    const file = join(at, ".attentionmachine", ".env");
    if (existsSync(file)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/).map((line) => /^\s*(?:export\s+)?(\w+)\s*=\s*(.*?)\s*$/.exec(line)).filter(Boolean);
      return Object.fromEntries(lines.map(([, name, value]) => [name, /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value.replace(/\s+#.*$/, "")]));
    }
    if (dirname(at) === at) return {};
  }
}

function settings(dir) {
  const file = settingsFile(dir);
  const get = (name) => process.env[name] || file[name] || undefined;
  const region = get("REMOTION_AWS_REGION");
  if (!region) throw new Error("Missing setting REMOTION_AWS_REGION (the AWS region for cloud exports, for example us-east-1) in .attentionmachine/.env.");
  const [id, secret] = [get("REMOTION_AWS_ACCESS_KEY_ID"), get("REMOTION_AWS_SECRET_ACCESS_KEY")];
  if (!id !== !secret) throw new Error(`Missing setting ${id ? "REMOTION_AWS_SECRET_ACCESS_KEY" : "REMOTION_AWS_ACCESS_KEY_ID"}: an access key needs both its ID and its secret.`);
  const bucket = get("RECORDINGS_BUCKET");
  if (bucket && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error(`RECORDINGS_BUCKET "${bucket}" isn't a valid bucket name.`);
  profile = get("REMOTION_AWS_PROFILE") ?? (id ? null : "remotion");
  // A static key, never a browser session: links signed with a session die when it ends. The key
  // reaches Remotion as AWS_* only, because its CLI sends every REMOTION_* variable along with a render.
  for (const name of SIGN_IN) delete process.env[name];
  if (profile) process.env.AWS_PROFILE = profile;
  else Object.assign(process.env, { AWS_ACCESS_KEY_ID: id, AWS_SECRET_ACCESS_KEY: secret });
  return { region, bucket };
}

function lambdaRequire(dir) {
  const versionOf = (pkg) => {
    const file = join(dir, "node_modules", pkg, "package.json");
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).version : null;
  };
  const version = versionOf("remotion");
  if (!version) throw new Error("Install the project's packages first (npm install in the project folder).");
  if (versionOf("@remotion/lambda") !== version) {
    const run = spawnSync("npm", ["install", "--save-exact", `@remotion/lambda@${version}`], { cwd: dir, stdio: "inherit", shell: process.platform === "win32" });
    if (run.status !== 0) throw new Error(`Couldn't add @remotion/lambda ${version} to the project.`);
  }
  return createRequire(join(dir, "node_modules", "@remotion", "lambda", "package.json"));
}

export async function cloud(folder) {
  const where = project(folder);
  const { region, bucket: own } = settings(where.dir);
  const require = lambdaRequire(where.dir);
  const lambda = require("@remotion/lambda");
  if (!lambda.getRegions().includes(region)) throw new Error(`REMOTION_AWS_REGION "${region}" isn't a region Remotion Lambda runs in, like us-east-1 or eu-central-1.`);
  const bucket = own ?? (await lambda.getOrCreateBucket({ region })).bucketName;
  const s3 = lambda.getAwsClient({ region, service: "s3" });
  return {
    ...where,
    region,
    bucket,
    lambda,
    require,
    s3,
    // A bucket of your own holds only recordings. In Remotion's they get a folder beside its sites and renders.
    key: (rel) => `${own ? "" : "recordings/"}${where.slug}/${rel}`,
    head: (key) =>
      s3.client.send(new s3.sdk.HeadObjectCommand({ Bucket: bucket, Key: key })).catch((err) => {
        if (err.name === "NotFound") return null;
        throw err;
      }),
  };
}

// Each upload carries the recording's size and modified time, so a changed recording goes up again
// even at the same size. Uploads from before that carry neither: sameRecording gives null for them.
export const recordingMetadata = (stat) => ({ "recording-mtime": String(Math.round(stat.mtimeMs)), "recording-size": String(stat.size) });
export function sameRecording(object, stat) {
  const sent = object.Metadata ?? {};
  const mine = recordingMetadata(stat);
  return sent["recording-mtime"] ? sent["recording-mtime"] === mine["recording-mtime"] && sent["recording-size"] === mine["recording-size"] : null;
}

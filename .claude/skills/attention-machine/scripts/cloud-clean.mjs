#!/usr/bin/env node
// Deletes a finished video's recordings from the cloud, its uploaded project, and the H.264 copies
// cloud-upload.mjs made on this computer. Exports themselves delete from the cloud a day after
// rendering, on their own. Settings: see cloud-common.mjs.
//
//   node scripts/cloud-clean.mjs <video project folder>
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloud } from "./cloud-common.mjs";

if (process.argv.length !== 3) throw new Error("usage: cloud-clean.mjs <video project folder>");
const c = await cloud(process.argv[2]);
const { ListObjectsV2Command, DeleteObjectCommand } = c.s3.sdk;

let removed = 0;
let token;
do {
  const page = await c.s3.client.send(new ListObjectsV2Command({ Bucket: c.bucket, Prefix: c.key(""), ContinuationToken: token }));
  for (const { Key } of page.Contents ?? []) {
    await c.s3.client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key }));
    removed++;
  }
  token = page.NextContinuationToken;
} while (token);

const site = (await c.lambda.getSites({ region: c.region })).sites.find((s) => s.id === c.slug);
if (site) await c.lambda.deleteSite({ region: c.region, bucketName: site.bucketName, siteName: c.slug });
rmSync(join(tmpdir(), "cloud-render", c.slug), { recursive: true, force: true });

console.log(`deleted ${removed} recording${removed === 1 ? "" : "s"}${site ? " and the uploaded project" : ""} from the cloud, and the local copies`);

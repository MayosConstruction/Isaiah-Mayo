# Cloud exports (BETA)

> Strict rule: do not autonomously suggest cloud exports to the user. This is highly technical, and currently under development. Only act on it when explicitly asked for.

A video can export on Remotion Lambda, in the user's own AWS account, instead of on their computer. A long video finishes much faster and the computer stays free. Each export costs a little on their AWS bill.

Exporting locally stays the default. Export in the cloud when the user asks for it, or when a long export would tie up their computer. The settings are listed at the top of `scripts/cloud-common.mjs`.

## Setting it up

Once, when a script says a setting is missing. The user does the AWS part in their browser. Give them all the steps in one message:

1. Sign in to aws.amazon.com, or create an account.
2. Follow steps 2 to 6 of [Remotion's Lambda setup](https://www.remotion.dev/docs/lambda/setup): a policy, a role, a user, an access key for that user, and the user's own policy. Hand them the 2 policy texts ready to paste, from [Remotion's permissions page](https://www.remotion.dev/docs/lambda/permissions).
3. Paste the access key ID and the secret access key here.

Save them in `.attentionmachine/.env` as `REMOTION_AWS_ACCESS_KEY_ID` and `REMOTION_AWS_SECRET_ACCESS_KEY`, with the region closest to the user as `REMOTION_AWS_REGION`. Never show the key back or copy it anywhere else. Test with 10 frames at quarter size (`--frames=0-9 --scale=0.25`) into the system temp folder. The first run takes a few minutes longer while it sets up the cloud function.

## The project

A cloud export reads every recording in `public/` (any media file of 50 MB or more) from the cloud, not from the project it uploads. So each recording has to load through `media()`. Once per project, add `src/media.ts`:

```ts
import { getInputProps, staticFile } from "remotion";

const footage = (getInputProps().footage ?? {}) as Record<string, string>;
export const media = (file: string) => footage[file] ?? staticFile(file);
```

Then use `media("camera.mov")` instead of `staticFile("camera.mov")` for each recording. Smaller files (pictures, sound effects, fonts) stay on `staticFile()`. Local exports, stills and Studio work as before.

The scripts add `@remotion/lambda` to the project when it's missing, at the project's Remotion version.

## Exporting

Run both from this skill's folder:

1. `node scripts/cloud-upload.mjs <project folder>` sends the recordings to the cloud. HEVC video (most iPhone recordings) gets an H.264 copy first, because Remotion can't read HEVC in the cloud. Recordings already there are skipped and changed ones go up again, so run it before every cloud export.
2. `node scripts/cloud-render.mjs <project folder> <CompositionId> <output file>` uploads the project and exports it. Extra `remotion lambda render` flags go at the end.

Then run `finish-sound.mjs` on the export, as with any export.

A long recording takes a while to upload on a slow connection. Both scripts show their progress, so look in on them as with any export.

The export uses Remotion's default x264 preset, `medium`. Pass `--x264-preset=veryfast` only when a 4K export runs out of memory.

## Review rounds

While the user is still giving feedback, export at half size (`--scale=0.5`) into the system temp folder and open the file for them. Half size is quicker and enough to judge timing, sound and motion. Only the version they approve exports at full size, into `export/`.

## Cleaning up

An export's cloud copy deletes itself a day after it's made. The recordings stay up between exports. When the user calls the video finished, run `node scripts/cloud-clean.mjs <project folder>`: it deletes the project's recordings and uploaded project from the cloud, and the H.264 copies on this computer. The recordings in `public/` stay as they are.

## When it fails

- A setting is missing or wrong: the script names it. Set it up as above.
- "isn't in the bucket yet" or "changed since it was uploaded": run the upload, then the export.
- AWS doesn't accept the key, or refuses access: the key was deleted or replaced, or the AWS user's Remotion policy is missing or out of date. Tell the user in plain words what to fix in AWS.
- The export can't load a recording: it still loads through `staticFile()`. Switch it to `media()`.
- A concurrency or rate error: new AWS accounts may run as few as 10 functions at once. Add `--concurrency=8`, and tell the user they can ask AWS for a higher Lambda limit.
- It fails partway: run it again with `--log=verbose` for a link to the cloud logs.


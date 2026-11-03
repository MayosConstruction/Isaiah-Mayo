# First setup

Run this before the first edit, and whenever something below is missing. Check everything yourself first, quietly. The user only does the two things nobody else can: Homebrew's password on a Mac, and the ElevenLabs key. Do everything else yourself, without asking.

**In this order:**

1. Homebrew, on a Mac only.
2. Node.js and ffmpeg.
3. Skills: this one and Remotion's.
4. The ElevenLabs key.

## Homebrew (Mac only)

Check `brew --version`. A fresh install isn't on your shell's path yet, so also look for `/opt/homebrew/bin/brew` (Apple silicon) and `/usr/local/bin/brew` (Intel). Windows and Linux skip this part.

The installer needs the Mac password typed into a real Terminal, so this is the one step the user does by hand. Say in one line what it is: an app store for the tools their AI needs. Then give them these steps:

1. Press Command + Space, type Terminal, and press Return.
2. Paste this and press Return:
  ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```
3. Type your Mac password, the one you unlock your computer with, and press Return. Nothing shows while you type. That's normal.
4. When it says "Press RETURN/ENTER to continue", press Return.
5. Wait until it's finished, usually 5-15 minutes. It may download Apple's developer tools first; that's part of it.
6. Come back here and say "done".

Then finish it yourself. Homebrew ends with "Next steps" that add it to the path: do the same yourself (add `eval "$(/opt/homebrew/bin/brew shellenv)"`, or the `/usr/local` one on Intel, to `~/.zprofile`) and check `brew --version`. Never have the user paste those.

If it fails, ask them to paste or screenshot what Terminal says, and take it from there.

## Node.js and ffmpeg

Install both yourself:

- Mac: `brew install node ffmpeg`.
- Windows: `winget install OpenJS.NodeJS.LTS`, then `winget install Gyan.FFmpeg`. Open a new shell afterwards so both are on the path.
- Linux: the system's package manager.

The scripts need a full ffmpeg. The one bundled with Remotion lacks their sound filters. Check that `ffmpeg -hide_banner -filters` lists `ebur128` and `alimiter`.

## Skills

This skill and Remotion's official skills, the guide for all Remotion work. Both come through `npx skills` (project scope), so one update keeps them current.

- This skill: if `skills-lock.json` doesn't list `attention-machine`, it was installed another way and won't update. Reinstall it with `npx -y skills add robinebers/attentionmachine-skills -y`. That replaces the copy in place. If an old copy is left under another folder name (like `attentionmachine`), delete it.
- Remotion's skills: if they're missing, install all of them, for every agent, without picking (`npx -y skills add remotion-dev/skills -y`).
- Then update both: `npx -y skills update -p -y`.

## ElevenLabs

Check that `ELEVENLABS_API_KEY` is in `.attentionmachine/.env`. If not, give the user all the steps in one message, ending with "paste the key here":

1. Sign up at [elevenlabs.io](https://elevenlabs.io). The free plan is enough to start.
2. Open [API keys](https://elevenlabs.io/app/developers/api-keys) and create a key with access to Speech to Text, Text to Speech, Sound Effects and Music.
3. Paste it here.

Then save it in `.attentionmachine/.env` and test it with a few spoken words through `scribe_v2`. Keys can be limited to some features, so test with a real request, not the account page.

Never show the key back or copy it anywhere else.

## When it's done

Tell the user in one line that setup is done, and carry on with their video. If they haven't shared one yet, ask for it right here. No new chat needed. Don't list what you installed or what was already there.
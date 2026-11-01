# AI Video Editor (Mayo's Construction)

Instructions for any AI coding agent working in this folder (Codex reads this file;
Claude Code reads CLAUDE.md, which points here).

## Folders
- `Raw/`: the owner's unedited recordings. Never edit or delete these; work on copies.
- `Projects/<video-name>/`: one folder per video. Its HyperFrames source, working files
  and finished files (`exports/`) live together.
- `Signature Style/`: branding, fonts, logos, examples and `STYLE.md`. Read STYLE.md
  before making any video.
- `Setup/`: tools, sound effects and `SETUP.md` (versions, how they were installed, test results).

## Tools (all local, no paid services)
- Video: HyperFrames (`Setup/node_modules/.bin/hyperframes`), FFmpeg/ffprobe.
  Skills: `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`
  in `.claude/skills/` and `.agents/skills/` (same files). Read `/hyperframes` first.
- Animation library: use the local `gsap.min.js` (copy from `Setup/node_modules/gsap/dist/`),
  not the CDN link the templates use.
- Captions: the TikTok-style "Highlight" caption block (`hyperframes add caption-highlight`), already made
  offline-ready in `Setup/blocks/caption-highlight.html`: copy it to `compositions/components/` in a project
  and copy `gsap.min.js` and `Signature Style/fonts/Montserrat-ExtraBold.ttf` into that project's `assets/`.
  Its words and timings are the `WORDS` list at the top of its script.
- Effects: 17 motion effects (orbit, zoom-through, vertigo, paper cut, doodle boil, checklist,
  phone mockup and more) installed in `Setup/effects-library/`; the table is in its `EFFECTS.md`.
- Sound effects: `Setup/sound-effects/` (Pixabay license, credits in CREDITS.md).
- Transcripts: WhisperX in its own environment, `Setup/whisper-env/bin/whisperx`, CPU mode:
  `--device cpu --compute_type int8`.
- Downloads: `Setup/tools-env/bin/yt-dlp`.

## Rules
- Don't add paid voice, avatar, music or media services unless the owner asks.
- Start a new video with:
  `cd Projects && ../Setup/node_modules/.bin/hyperframes init <name> --example blank --resolution portrait --non-interactive --skip-skills`
- Run `hyperframes check` before rendering, then render to `exports/`.
- Look at frames from the finished file before calling a video done.

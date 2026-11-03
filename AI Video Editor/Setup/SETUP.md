# AI Video Editor: setup notes

Built and tested 2026-11-01 in the Claude Code cloud workspace (Ubuntu 24.04, x86_64, 4 CPU cores,
16 GB RAM, no graphics card). Everything below was actually run, not just downloaded.

## Results

| Tool | Version | Where | Test | Result |
|---|---|---|---|---|
| FFmpeg / ffprobe | 6.1.1 | system (`/usr/bin`) | decode all 19 sound effects; probe renders | PASS |
| Python | 3.12 (separate envs) | `Setup/*-env/` via uv 0.11 | envs created, packages import | PASS |
| Node.js / npm | 22.22.0 / 10.9.4 | system | HyperFrames needs ≥ 22 | PASS |
| HyperFrames CLI | 0.8.226 (pinned) | `Setup/node_modules` | `doctor`, `check`, `snapshot`, full MP4 render with sound | PASS |
| HyperFrames render browser | chrome-headless-shell 152 | `~/.cache/hyperframes/chrome` | `browser ensure`, renders | PASS |
| GSAP (animation library) | 3.15.0 | `Setup/node_modules/gsap` | used locally; the CDN is blocked here | PASS |
| HyperFrames core skills | latest `main` | `.claude/skills/` and `.agents/skills/` (identical) | Claude Code listed all four as project skills | PASS (Claude Code) |
| Sound effects | 19 files, Pixabay license | `Setup/sound-effects/` + `CREDITS.md` | each decodes; placed whoosh/hit land at the right times in a render | PASS |
| WhisperX | 3.8.6, torch 2.8.0, CPU mode | `Setup/whisper-env/` | imports, CLI runs on CPU (`--device cpu --compute_type int8`) | PARTIAL: speech models can't download here (Hugging Face is blocked) |
| yt-dlp | 2026.10.26 | `Setup/tools-env/` | runs | PARTIAL: YouTube and Instagram are blocked here |
| Playwright (Node) | preinstalled | system | renders and screenshots | PASS |
| agent-skills (Addy Osmani) | 25 skills | repo `.claude/skills/` + `.agents/skills/` | installed; scripts reviewed | PASS |
| headroom | 0.42.0 | `Setup/headroom-env/` | proxy started, `/health` = healthy | PASS (not routed; see below) |

Not checked: Codex. It isn't installed here and needs your OpenAI sign-in. The same skills are in
`.agents/skills/` and the same instructions in `AGENTS.md`, which is where Codex looks.

## Rebuild steps (from the AI Video Editor folder)

```bash
cd Setup && npm install                       # hyperframes 0.8.226 + gsap 3.15.0 (package.json)
npx hyperframes browser ensure                # render browser
cd .. && Setup/node_modules/.bin/hyperframes skills update   # core skills; copy into .claude/skills and .agents/skills
cd Setup
uv venv --python 3.12 whisper-env && uv pip install --python whisper-env/bin/python whisperx
uv venv --python 3.12 tools-env   && uv pip install --python tools-env/bin/python yt-dlp
uv venv --python 3.12 headroom-env && uv pip install --python headroom-env/bin/python "headroom-ai[all]"
```

On a Mac with Apple silicon, the same `pip install whisperx` gets a CPU build of torch (no CUDA),
which is much smaller than the 7 GB Linux build used here.

## Known limits of this cloud workspace

- Blocked sites: Hugging Face (Whisper models), YouTube, Instagram, Google Drive, jsDelivr (CDN).
- The workspace resets when idle; the big installs (`node_modules`, `*-env`) are not saved to
  GitHub. Re-run the rebuild steps above.
- headroom is installed but not wired in: wiring it changes how Claude Code reaches the API.
  On your Mac: `headroom init -g` then restart Claude Code.
- claude-mem was not installed (telemetry on by default; hosted memory is paid after a trial).
  On your Mac: `npx claude-mem install --provider claude` then `npx claude-mem telemetry disable`.

## OBS MCP (royshil/obs-mcp, GPL-2.0) — source in `Setup/obs-mcp/`
Lets Claude control OBS Studio (scenes, sources, start/stop recording and streaming) over the OBS WebSocket.
Only works on the owner's Mac (OBS isn't in the cloud workspace). Setup on the Mac:
1. OBS → Tools → WebSocket Server Settings → enable, copy the password.
2. Claude desktop MCP config: `{"mcpServers":{"obs":{"command":"npx","args":["-y","obs-mcp@latest"],"env":{"OBS_WEBSOCKET_PASSWORD":"<password>"}}}}`
3. Restart Claude, then "switch to my truck scene and start recording".
It only connects to OBS on the same computer (ws://localhost:4455).

## Skills library
`Setup/skills-library/animation-principles-all/` holds all 144 dylantarre animation skills (MIT). Only the 24 most useful for Reels are installed in `.claude/skills/`; copy more from here if needed.

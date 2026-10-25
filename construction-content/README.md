# Construction Content — Mayo's Construction

Everything for making marketing content (videos, captions, postcards, social posts) for **Mayo's Construction**, Hot Springs, AR · 870-617-3507 · mayosconstruction.netlify.app.

## Tools (`tools/`)

Downloaded as shallow copies (latest version only). They're too big for this repo, so `tools/` is not saved to GitHub. In a new session, re-download them with:

```bash
cd construction-content && mkdir -p tools && cd tools
for r in remotion-dev/remotion heygen-com/hyperframes FFmpeg/FFmpeg ggml-org/whisper.cpp yt-dlp/yt-dlp; do
  git clone --depth 1 https://github.com/$r.git
done
```

| Tool | What it's for |
|---|---|
| **remotion** | Make videos with code: branded intros, job-site before/after reels, text overlays |
| **hyperframes** (HeyGen) | Turn HTML into video, for animated promos and title cards |
| **FFmpeg** | Cut, trim, resize (vertical for Reels/TikTok), add music, compress |
| **whisper.cpp** | Turn speech into text, for auto captions/subtitles on job-site videos |
| **yt-dlp** | Download videos (your own posts, or reference clips you have rights to use) |

## Session notes

**2026-10-25**
- Proofread the EDDM postcard (`../marketing/postcard.html`). No errors. Phone number, website, and QR code all match.
- Optional change, not applied yet: front text "Moss and Isaiah Mayo, a father-and-son crew." → "**We're** Moss and Isaiah Mayo, a father-and-son crew."
- Editing preference: **proofread only**. Keep the owners' voice and wording.
- Downloaded the five video tools above to get ready for video editing.

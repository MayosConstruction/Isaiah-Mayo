# Overlays

Where to get real logos, app icons, photos, screenshots and clips, and how to check them. The style decides where they go and how they look.

## Plan them first

Overlays are part of every edit, not an extra. Once you've picked the words to keep, go through them and list every brand, app, website, product, person, place and thing shown or explained. Give each one a picture, a screenshot, a clip, an animation or a placeholder, as the style asks. Write the list in `about.md` before building graphics.

## Sources, best first

1. **The user's own:** files they gave you, logo files listed in `preferences.md`, their website, their own past exports. Always look here first.
2. **App icons:** the App Store. Search `https://itunes.apple.com/search?term=<app>&entity=software&country=us&limit=5` (Mac apps: `entity=macSoftware`). Check `sellerName` is the real maker. In `artworkUrl512`, swap `512x512bb.jpg` for `1024x1024bb.png` for the full size. Icons come square: round the corners yourself, about 22% of the width.
3. **Brand logos:** the company's own brand or press page. Then Wikimedia Commons. Simple Icons (`cdn.jsdelivr.net/npm/simple-icons@latest/icons/<name>.svg`, free) only has one-colour versions: use it when the style wants a one-colour logo, or when the real logo is one colour anyway (set `fill` to the brand's colour).
4. **Websites and products:** take the screenshot yourself, live, at 2x: `npx playwright install chromium` once, then `npx playwright screenshot --device="Desktop Chrome HiDPI" --wait-for-timeout=3000 <url> <file>.png`. Or your own browser tool. Crop to the part that's spoken about. Pages behind a login (dashboards, their inbox, their stats): ask the user for a screenshot.
5. **People:** Wikipedia's lead photo, found on Wikimedia Commons, or official press photos. The user's clients and friends: their public website or profile photo.
6. **Places, objects, scenes:** Wikimedia Commons, Unsplash, Pexels, or an image search.
7. **Clips:** any video online that shows what's talked about, from anywhere `yt-dlp` supports (YouTube, Instagram, TikTok, X and many more): launch videos, demos, news, famous scenes. Download it (install `yt-dlp` if it's missing) and use the few seconds that matter, muted unless the clip's own sound is the point. The user's own past videos too.
8. **Public domain:** NASA, government agencies, the Library of Congress, banknote scans.

### Wikimedia Commons

Requests without a `User-Agent` header get blocked, so always send one.

- Search: `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=10&format=json&srsearch=<words>`
- File and size: `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=1600&format=json&titles=File:<name>`. `thumburl` is the download.

## Never

- AI-generated pictures, unless the user asks for one.
- Made-up screens, logos or numbers.
- Another logo standing in for the real one: the parent company, a sister product, an older version. Use a placeholder and tell the user.
- Watermarked pictures.
- Too small: under about 1000px wide for a big picture, or under 512px for an icon.

Use the best picture you can find, wherever it comes from, and note the source in `about.md`. Rights are the user's call, not yours: never leave a spot empty or skip a picture over them.

## Check each one

- Look at it before using it. Right person, right product, the current logo in its real colours, sharp.
- Crop or zoom it to the moment: the part of the page or photo that's being talked about, big enough to read on a phone.
- Save it in `public/images/` (clips in `public/clips/`) and list the source link in `about.md`.
- Truly nothing usable, or a download fails? Use a placeholder, keep going, and tell the user what belongs there.


# Copying a style from a video

A user shares a video they like and wants that look ("make a style out of this"). The result is a `style.md` in `.attentionmachine/styles/<name>/`: the system behind the look, written so it works on the user's own recordings. It doesn't have to be a perfect copy, but the closer the better: someone who knows the original should recognise the look.

## Gather

- Two or three videos of the same look beat one, because one video mixes the system with one-offs. Use every one the user shared. With one, ask for more, then carry on either way.
- One look, one style. Videos from the same account usually share one; the downloaded info file says who posted each. Different looks get separate styles, unless the user wants a mix.
- Download with `yt-dlp` and keep the info file. Instagram needs a logged-in browser's cookies (`--cookies-from-browser`); if the computer's privacy settings block one browser, try another.
- Keep the videos, info files and transcripts in `.attentionmachine/styles/<name>/reference/`, to compare against later.
- Transcribe each video with word timings. Learn from what the creator says as well as what they do; some explain their own method.
- Write findings into `reference/notes.md` as you go, with the times they show up, or details get lost.

## Look

- One frame per second for the overview: which kinds of text, overlays and layouts there are, and how often something changes.
- Every frame around cuts, new text or overlays, and zooms, until the pattern is clear. One frame per second hides zooms, slides, pops and punch-ins.
- Find every cut. Jump cuts on the same background barely change the picture, so scene detection (ffmpeg `scdet`) needs a low threshold. That also catches text appearing; a real cut changes the picture around the text too. Note what happens at each: a punch-in, new text, an overlay.
- Full-size crops of each kind of text, for fonts, colours and spacing.

What happens in every video is the style. What happens once is a one-off: leave it out or mark it rare.

## What to write down

Every kind of text (captions, big words, titles, labels, numbers, notes), each with:

- font, weight, and size relative to the frame;
- case, punctuation, how many words at once, how it builds (word by word or the whole phrase);
- colour, and any shadow, glow, outline or box;
- spacing between lines;
- where it sits: the nearest of the engine's named positions, with a nudge in words when it sits between two ("halfway from off-center to bottom"), or relative to the face. Not pixel heights; they don't carry over to other footage;
- in front of the speaker or behind them (text behind the head needs the speaker cut out);
- what makes it appear;
- how it moves in and out: frames, direction, easing, overshoot;
- what it never does.

Then everything else: overlays (what kind, size, edges, placement, how they match what's said), layouts (split, inset, cutaway, behind, and when), cuts and pacing (how tight, what hides a cut, how often something changes), punch-ins and zooms (how far, how often, what for), the opening and the ending.

## Fonts

"A serif" or "a bold sans" isn't a match. Weight and width are where guesses go wrong most, then letter shapes.

- From the full-size crop, name what makes the type distinctive: serif or not, weight, width (condensed or wide), contrast between thick and thin strokes, how tall the small letters are, rounded or sharp ends, and telling letters (a, g, t, y, numbers).
- Shortlist several look-alikes from Google Fonts. Many have weight and width settings; use them.
- Compare them on one sheet: `scripts/compare-fonts.mjs` draws the same words in each font under a crop of the original, at the same width, and says how much narrower or wider each is. Its first lines say how to set it up and run it. Pick by eye.
- Caption tools often add extra slant, letter spacing or a thicker stroke on top of the font. Try those before ruling out a font with the right shapes.
- Check numbers, punctuation and special characters in the pick. Some script fonts make "2." look like "Q.".
- Stop once a pick matches the weight, the width and the telling letters. Use the same family for the other kinds of text unless they clearly differ. If you recognise the original, name it: the style uses it when the user has it, and the closest Google Fonts match otherwise.

## Colours

- Sample the inside of thick letters or shapes over several frames and take the typical value. Edges and thin strokes mix with the background.
- Compression shifts colours a little. If a colour is clearly meant to be pure (white, a full yellow), use the pure value.
- Give each colour its job. Note shadows, glows and outlines too: colour, softness, strength.

## Line spacing

Stacked titles and mixed-size compositions often sit very close. This is where copies go wrong: letters run into each other.

- Measure on the crop: each line's letter height, and the gap from the lowest letter of one line to the highest of the next (tall letters, i-dots, capitals). Where a small line tucks beside a big one, measure where letters actually sit above each other.
- Write the gap as a share of letter height ("about a third of the small line's letter height"), not as a line-height number. Fonts carry different built-in spacing, so the same number gives different gaps in another font.
- Say whether lines ever touch or overlap. Usually never.

## Motion

- Step through a few examples of each kind of movement frame by frame: text arriving and leaving, overlays, punch-ins and zooms, transitions.
- For each, note how many frames it takes to settle (and the video's frame rate), what changes (position, size, opacity, blur), from where, and whether it overshoots and springs back.
- Punch-ins and zooms: how much closer, instant or gradual, how long they hold, and what they're for (hiding a cut, landing a point, waking the viewer up).
- Also note what never moves, and say how it should feel: snappy, soft, bouncy, calm.

## Sound

Leave music out. Users pick their own.

You can't hear sound effects well enough to copy them. Ask the user which moments get one and what kind, and write that down with how loud next to the voice. Or "no sound effects".

## Writing it

Same shape as the ready-made styles in this skill's `styles/`. Name it for the look, in plain words.

A style is one look in every shape. Write what holds whatever the shape (colours, fonts, kinds of text, overlays, pacing, motion, sound) in "General" first. What only differs in the source videos' shape goes in a "Vertical and square videos" or "Horizontal videos" section after it: positions, sizes, how layouts sit, and things like captions or a hook that one shape has and the other doesn't. Only write a section for a shape you've seen. No lines from their videos, not even as examples: they'd end up in the user's video.

Write the system, so it works on a recording that isn't theirs:

- Sizes are targets that shrink to fit the safe zone. Keep the relationships (the big word about three times the caption).
- Say what the source footage was like and what the look depends on (room above the head, a background dark enough for white text), so whoever edits knows what to keep when the user's recording differs.
- Make content-dependent parts conditional: only when the speaker counts steps, names a thing, asks a question, waves.
- A rule that needs footage or overlays says what to do when there are none.
- Settle overlaps: which text wins when two could show at once, what leaves together, how long things hold. Read the whole file once for contradictions.
- Define fuzzy categories: does a screenshot count as a photo? A logo?
- Say how text stays readable when the background changes (shadow, box, placement).

## Try it

Try it on one of the user's recordings right away, the latest one unless another fits better. Before showing, put stills of the edit (`scripts/stills.mjs`) next to frames from the original (in `reference/`) at the same kinds of moments, and compare fonts, sizes, colours, spacing and motion. Look at every moment with text on more than one line at full size. Where the `style.md` was unclear, fix the file, not just the edit.
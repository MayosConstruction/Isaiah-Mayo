# Motion design references

How to make titles, graphics, overlays and transitions look directed, not generated. The style decides how things look and move. This guide fills in whatever the style leaves open. Captions aren't motion graphics and aren't covered here.

The generic AI look lives in the decisions you leave open. Swap every adjective for a number, a state or a named rule.

## What earns motion

Animate only what helps the viewer follow the speaker:

- a thing named: a logo, a product, a person;
- a number said;
- something shown: a screenshot, a step, a before and after;
- a turn in the story: a new section, the payoff, the call to action;
- an explainer: a process or a tool that a graphic makes clear.

When a moment has none of these, leave the speaker alone.

When something earns a graphic, the graphic acts out the idea instead of just showing the thing: it builds piece by piece on the words, drops what gets cut, turns the before into the after. Nothing is pasted on. Everything that arrives gets a small, tasteful entrance and a little life while it holds.

## Principles

1. Numbers, not adjectives. "Premium" becomes curves and spring values. "Punchy" becomes durations and beats.
2. One thing owns the screen at a time. Everything else waits, dims to 40% or holds still. After every move the viewer knows where to look.
3. Rank the rest. Supporting moves travel 50-70% as far as the main one and start 100-200 ms after it. 0.1 s is a good first try.
4. Motion means something: grouping, order, cause or size. No decorative moves, nothing that moves forever.
5. Weight by size. Small things snap, panels settle, headlines arrive fast and then hold. If everything bounces, nothing feels precise.
6. Restraint. The style's colours and fonts only, and one accent with one job.
7. Only real things. Never invent screens, logos, numbers or quotes. When something's missing, use a placeholder.
8. Go big or don't move. A zoom into proof (a screenshot, a result) goes as big as the safe zone allows and highlights the line that matters. A timid zoom reads as a mistake.

## Numbers

### Durations


| Use                                  | Value                            |
| ------------------------------------ | -------------------------------- |
| Small feedback (a tick, a highlight) | 100-200 ms                       |
| Moves                                | 200-500 ms                       |
| Main reveals                         | 600-900 ms                       |
| Exits                                | 40-50% shorter than the entrance |


Write timing in seconds, then convert: frames = seconds x fps. A 0.6 s entrance is 18 frames at 30 fps.

### Easing

- Entering: ease-out. Exiting: ease-in. Moving across the screen: ease-in-out.
- Zooms and pans, including punch-ins on the speaker, get the softest curves, such as ease-in-out-quart.
- Linear only for rotation, progress bars and loops. Linear on a move is the quickest way to make it look like a render.
- "Premium" usually means ease-out-quint on entrances, springs at a damping ratio of 0.8, and no overshoot on text.

### Springs

Damping ratio = damping / (2 x √(stiffness x mass)).


| Damping ratio | Feel      |
| ------------- | --------- |
| 1.0           | no bounce |
| 0.7-0.85      | premium   |
| 0.4-0.6       | playful   |
| under 0.3     | cartoon   |


- Remotion's default spring (mass 1, damping 10, stiffness 100) is 0.5, playful. Damping 16 at stiffness 100 gives 0.8.
- Position and size may bounce. Opacity and colour never do.
- Overshoot: cards about 2%, never over 5-8%. Text 0%.
- Everything settles before the text that depends on it appears.
- When tuning, keep the destination fixed and change one value at a time.

### Stagger

Letters 1 frame apart, words 60-120 ms, list items 40-80 ms. Start the next element when the previous one is 30-50% done.

### Emphasis

- Pop: scale 1.0 → 1.08 → 1.0 over 6 frames, peaking on the word or the beat.
- Living hold: a slow push, 1.00 → 1.03 over 3 s. Define it from start to end, never as a percentage per frame, or it compounds.

### Reading time

- Count the hold from the moment the text is readable, not from when its entrance starts.
- At least 0.3 s per word plus 0.5 s. Then read it aloud at normal speed, and extend any hold that ends before you finish.
- Nothing near the text moves while it's being read. Blur only during a fast entrance, never on text being read.

### Text

- Contrast at least 4.5:1 on every frame. No more than 3 flashes per second.
- Under 8 words per line. Meaning never depends on colour alone.
- Test with the longest text you expect. If a headline wraps to 3 lines, shorten the text or widen the box before touching the motion.

## Composition

- The main element is the largest, brightest or most contrasted thing on screen.
- Frame 0 is already a finished picture, and the last frame works as a still.
- Each aspect ratio is its own layout. Never crop a 16:9 design into 9:16. 9:16 gets fewer elements, stacked.

## Transitions

- Between clips, a hard cut (see "Clips" in `SKILL.md`). Inside a graphic, use match cuts and wipes only where they mean something.
- After changing one part, check the cuts on both sides of it before watching the whole video.
- When a transition overlaps two parts, count the overlap in the total length.

## Sound

Graphics must work with the sound off, because feeds start muted. What sounds to use, and where, comes from the style and `SKILL.md`; this is what makes them sound right.

- One sound per meaningful change: a swoosh for movement, a pop for something appearing, a click for a click. Not on every graphic.
- Every effect sits at one level for the whole video, and all of them the same distance under the voice. Real recordings over synthesized ones.
- Keep sound cues in the same timing data as the graphics, so moving a graphic moves its sound.
- Line up a sound's loudest point with its event, not the start of the file. The picture may lead the sound by 1 frame, never trail it.
- With music: frames per beat = fps x 60 / BPM. Work out each beat from its time and round it, never add beats up. Bring in titles and cuts on the beat. Beat detection can lock onto the off-beat, so check the kicks on a waveform below 120 Hz and shift the grid if they don't line up.
- Mix: the voice loudest, effects above the music, music ducked under speech.

## Ban list

Unless the style asks for them:

- purple or blue gradients, glow, bloom, lens flares, neon, glowing orbs;
- decorative particles and bursts;
- everything fading in at once, or fade-and-slide-up on every element;
- a logo fading to black at the end;
- text that moves or blurs while it's being read;
- generic dark-space backgrounds, spinning 3D turntables;
- too much bouncing, objects that teleport;
- stock footage, generic AI images, made-up screens, numbers or slogans;
- linear easing on movement;
- sound effects made in code.

After each first render, add whatever generic look crept in anyway.

## Checking your work

Check stills at each graphic's first readable frame, its busiest moment and the last frame of the video. They go on the version's check sheet (see "Showing the work" in `SKILL.md`).

- The first and last frames work as stills.
- One thing owns the screen at a time.
- Every hold survives a read-aloud. Text is still, sharp and at 4.5:1 or better, worked out from the colours.
- Graphics start and end on a cut or a spoken word, never a few frames over a cut.
- No 3-line headlines. Everything reads at phone size.
- Motion settles before the text that depends on it. Overshoot only on position and size.
- Easing matches direction. No linear moves.
- Only real logos, pictures and numbers. Colours and fonts come from the style.
- The video works muted. Sounds peak on their events.

### When something looks off


| Symptom                   | Fix                                                                             |
| ------------------------- | ------------------------------------------------------------------------------- |
| Looks AI-made             | Name the generic choices it made, ban them, render again                        |
| Busy                      | One owner; the rest 0.1-0.15 s later at 60% of the travel                       |
| Text gone too soon        | Count from readable, read it aloud, extend                                      |
| Headline on 3 lines       | Fix the text or the box before the motion                                       |
| Smeared text              | Blur only during the entrance                                                   |
| Drags                     | Cut each hold by a beat, or pop 1.0 → 1.08 → 1.0 on the beat                    |
| Different between renders | A clock or unseeded randomness somewhere                                        |
| Cuts feel off the music   | Beat grid on the off-beat: recheck the kicks, shift the grid or the music start |
| Sound effect lands late   | Line up its loudest point, not its start                                        |
| Same error twice          | Stop and rethink the approach instead of retrying                               |



// Plans where the view looks while it zooms into a screen recording. It frames the thing he
// talks about in the part of the frame his picture leaves free. It glides from one zoom
// straight into the next. Inside a menu or dialog it follows the cursor the way Cap does: it
// holds while the cursor rests in view and glides once to where it settles. No imports and no
// files, so it runs in a Remotion project and in Node alike. Copy it into the project's src/
// together with zoom-camera.d.mts, its types.
//
//   import { zoomCamera } from "./zoom-camera.mjs";
//   const camera = zoomCamera({ screen, frame, placement, free, zooms, cursor, maxScale, maxSpeed });
//     screen     { width, height } of the screen recording, in its own pixels.
//     frame      { width, height } of the video.
//     placement  { x, y, width, height }: where the whole screen sits in the frame unzoomed.
//                Default: as big as fits, centred.
//     free       { x, y, width, height }: the part of the frame his picture leaves free, minus a
//                margin around his picture, in frame pixels. Default: the whole frame.
//     zooms      [{ from, to, box, follow, startsOnCut, endsOnCut, free }]
//                from, to: seconds. The view is fully in from `from` to `to`. It zooms in before
//                and out after. Zooms 2 s apart or closer glide into each other.
//                box: { x, y, width, height } of the element he talks about, in screen pixels.
//                It's centred in the free part and zoomed in until it fills it.
//                follow: he clicks around inside it, so the view follows the cursor.
//                startsOnCut, endsOnCut: a cut lands there, so the view switches on the cut.
//                free: this zoom's own free part, when his picture sits somewhere else.
//     cursor     [{ t, x, y }]: seconds and screen pixels, for zooms that follow. Use null for
//                x and y while the cursor is off the screen. It holds between samples.
//     maxScale   at most this much zoom. Default 3.
//     maxSpeed   the spot in the middle of the zoomed-in view never moves faster than this many
//                frame widths a second. Default 0.75. Long moves take longer instead of whipping.
//
//   camera.at(t)       { scale, x, y }: the screen layer's transform at t seconds, sub-pixel.
//                      Lay the layer out at `placement`, inside a box that hides what spills
//                      over, with transform-origin 0 0 and
//                      transform `translate(${x}px, ${y}px) scale(${scale})`.
//   camera.visible(t)  { x, y, width, height }: the part of the screen recording that fills the
//                      placement at t, in screen pixels. Crop to it to render with ffmpeg.
//   camera.moves       every move it plans: { start, end, kind }, kind being in, out, chain,
//                      follow or cut.
//
// Every glide eases in and out, lasts at least 0.5 s and never shows past the screen's edges.
// Zooms and cursor share one clock: the screen recording's own seconds keep each zoom on its
// moment whatever the cuts. The plan is worked out once, so the view at a time depends only on
// the inputs, never on the frames asked for before: seeking and parallel rendering match.
const STEP = 0.02; // seconds between the points the cursor is read at
const REST_TIME = 0.2; // the cursor rests once it stays this many seconds...
const REST_SPOT = 0.005; // ...within a spot this wide, as a share of the screen's width
const HOLD_EDGE = 0.05; // a rest this far inside the free part, as a share of its size, holds the view
const GLIDE_EDGE = 0.2; // a glide brings the cursor this far inside
const LOOKAHEAD = 2.5; // seconds of later rests one glide also takes in, when they fit
const CHAIN_GAP = 2;
const GLIDE = 0.5; // the shortest glide, in seconds
const MAX_ZOOM_RATE = 3; // at its fastest, a zoom grows or shrinks the picture by 3% every 10 ms
const ease = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const EASE_PEAK = 1.875; // the ease's steepest slope, halfway

const lastAtOrBefore = (list, t) => {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t <= t) lo = mid + 1;
    else hi = mid;
  }
  return list[lo - 1];
};
const grow = (b, p) =>
  b
    ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) }
    : { x0: p.x, y0: p.y, x1: p.x, y1: p.y };

export function zoomCamera({ screen, frame, placement, free, zooms = [], cursor = [], maxScale = 3, maxSpeed = 0.75 }) {
  const fit = Math.min(frame.width / screen.width, frame.height / screen.height);
  const place = placement ?? {
    x: (frame.width - screen.width * fit) / 2,
    y: (frame.height - screen.height * fit) / 2,
    width: screen.width * fit,
    height: screen.height * fit,
  };
  const k = place.width / screen.width;
  if (Math.abs(place.height - screen.height * k) > 1) throw new Error("placement must keep the screen's shape");
  const freeOf = (z) => {
    const r = z.free ?? free ?? { x: 0, y: 0, width: frame.width, height: frame.height };
    return { x0: r.x - place.x, y0: r.y - place.y, x1: r.x - place.x + r.width, y1: r.y - place.y + r.height };
  };
  const centre = (f) => ({ x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2 });

  // A view { s, x, y } shows screen point p at s * k * p + (x, y), relative to the placement.
  const wide = { s: 1, x: 0, y: 0 };
  const inBounds = ({ s, x, y }) => ({
    s,
    x: Math.min(0, Math.max(place.width * (1 - s), x)),
    y: Math.min(0, Math.max(place.height * (1 - s), y)),
  });
  const toFrame = (v, p) => ({ x: v.s * k * p.x + v.x, y: v.s * k * p.y + v.y });
  const toScreen = (v, q) => ({ x: (q.x - v.x) / (v.s * k), y: (q.y - v.y) / (v.s * k) });
  // Scale and position change together so one point of the frame stays put: zooming never
  // pans on top, and a view inside the screen at both ends stays inside all the way.
  const mix = (a, b, u) => {
    const r = b.s / a.s;
    const w = Math.abs(r - 1) < 1e-9 ? u : (1 - r ** u) / (1 - r);
    return { s: a.s * r ** u, x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const frameBox = (b, f) => {
    const fill = Math.min((f.x1 - f.x0) / (k * b.width), (f.y1 - f.y0) / (k * b.height));
    const s = Math.min(maxScale, Math.max(1, fill));
    const c = centre(f);
    return inBounds({ s, x: c.x - s * k * (b.x + b.width / 2), y: c.y - s * k * (b.y + b.height / 2) });
  };
  const inView = (v, p, f, edge) => {
    const q = toFrame(v, p);
    const mx = edge * (f.x1 - f.x0);
    const my = edge * (f.y1 - f.y0);
    return q.x >= f.x0 + mx && q.x <= f.x1 - mx && q.y >= f.y0 + my && q.y <= f.y1 - my;
  };
  const fits = (v, b, f) =>
    (b.x1 - b.x0) * v.s * k <= (1 - 2 * GLIDE_EDGE) * (f.x1 - f.x0) &&
    (b.y1 - b.y0) * v.s * k <= (1 - 2 * GLIDE_EDGE) * (f.y1 - f.y0);
  // The smallest shift that brings spot b GLIDE_EDGE inside f, or centres it when it's too big.
  const bringIn = (v, b, f) => {
    const shift = (t, lo, hi, f0, f1) => {
      const m = GLIDE_EDGE * (f1 - f0);
      const a = v.s * k * lo + t;
      const c = v.s * k * hi + t;
      if (c - a > f1 - f0 - 2 * m) return t + (f0 + f1 - a - c) / 2;
      return t + Math.max(0, f0 + m - a) + Math.min(0, f1 - m - c);
    };
    return inBounds({ s: v.s, x: shift(v.x, b.x0, b.x1, f.x0, f.x1), y: shift(v.y, b.y0, b.y1, f.y0, f.y1) });
  };
  // Long enough that the spot in the middle of the zoomed-in view, and the zoom, stay under their limits.
  const duration = (a, b, f) => {
    const spot = toScreen(b.s >= a.s ? b : a, centre(f));
    let peak = 0;
    let q = toFrame(a, spot);
    for (let i = 1; i <= 256; i++) {
      const next = toFrame(mix(a, b, ease(i / 256)), spot);
      peak = Math.max(peak, Math.hypot(next.x - q.x, next.y - q.y) * 256);
      q = next;
    }
    const zoom = (EASE_PEAK * Math.abs(Math.log(b.s / a.s))) / MAX_ZOOM_RATE;
    return Math.max(GLIDE, peak / (maxSpeed * frame.width), zoom);
  };

  const track = cursor.filter((c) => Number.isFinite(c.t)).sort((a, b) => a.t - b.t);
  const cursorAt = (t) => {
    const c = lastAtOrBefore(track, t);
    const onScreen = c && Number.isFinite(c.x) && Number.isFinite(c.y);
    return onScreen && c.x >= 0 && c.y >= 0 && c.x <= screen.width && c.y <= screen.height ? c : null;
  };
  const restsIn = (t0, t1) => {
    const time = (i) => t0 + i * STEP;
    const points = Array.from({ length: Math.floor((t1 - t0) / STEP) + 1 }, (_, i) => cursorAt(time(i)));
    const spot = REST_SPOT * screen.width;
    const rests = [];
    for (let i = 0; i < points.length; ) {
      let b = null;
      let j = i;
      for (; j < points.length && points[j]; j++) {
        const g = grow(b, points[j]);
        if (g.x1 - g.x0 > spot || g.y1 - g.y0 > spot) break;
        b = g;
      }
      if (b && time(j - 1) - time(i) >= REST_TIME) {
        rests.push({ start: time(i), end: time(j - 1), x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
        i = j;
      } else i++;
    }
    return rests;
  };

  const plan = [];
  let view = wide;
  let busy = -Infinity;
  const move = (start, to, kind, f, length = duration(view, to, f)) => {
    plan.push({ t: start, end: start + length, from: view, to, kind });
    view = to;
    busy = start + length;
  };
  const leave = (z) => (z.endsOnCut ? move(z.to, wide, "cut", freeOf(z), 0) : move(Math.max(busy, z.to), wide, "out", freeOf(z)));

  const list = [...zooms].sort((a, b) => a.from - b.from);
  list.forEach((z, i) => {
    const prev = list[i - 1];
    if (!(z.to > z.from) || !(z.box?.width > 0 && z.box?.height > 0)) throw new Error(`The zoom at ${z.from} s needs "to" after "from" and a box`);
    if (prev && z.from < prev.to) throw new Error(`Zooms overlap at ${z.from} s`);
    const f = freeOf(z);
    const chained = prev && !prev.endsOnCut && !z.startsOnCut && z.from - prev.to <= CHAIN_GAP;
    if (prev && !chained) leave(prev);

    const rests = z.follow ? restsIn(z.from - 1, z.to) : [];
    // The rests one glide takes in, and when the cursor last sits at one the view doesn't show yet.
    const spotFrom = (j, v) => {
      let box = grow(null, rests[j]);
      let end = rests[j].end;
      for (let n = j + 1; n < rests.length && rests[n].start <= Math.min(z.to, rests[j].start + LOOKAHEAD); n++) {
        const g = grow(box, rests[n]);
        if (!fits(v, g, f)) break;
        box = g;
        if (!inView(v, rests[n], f, HOLD_EDGE)) end = rests[n].end;
      }
      return { box, end };
    };
    // Aimed at where the cursor rests as the zoom lands, so it never pans right after zooming in.
    let first = frameBox(z.box, f);
    const landing = rests.findIndex((r) => r.end >= z.from && r.start <= z.from + GLIDE);
    if (landing >= 0 && !inView(first, rests[landing], f, HOLD_EDGE)) first = bringIn(first, spotFrom(landing, first).box, f);
    if (z.startsOnCut) move(z.from, first, "cut", f, 0);
    else {
      const length = duration(view, first, f);
      move(Math.max(busy, chained ? prev.to : -Infinity, z.from - length), first, chained ? "chain" : "in", f, length);
    }

    rests.forEach((r, j) => {
      if (r.end < z.from || r.start >= z.to || inView(view, r, f, HOLD_EDGE)) return;
      const spot = spotFrom(j, view);
      const to = bringIn(view, spot.box, f);
      if (Math.hypot(to.x - view.x, to.y - view.y) < 0.5) return;
      const length = duration(view, to, f);
      // Sets off when the cursor leaves the view, but no earlier than it needs to arrive as it settles.
      const floor = Math.max(z.from, rests[j - 1]?.end ?? -Infinity);
      let departed = floor;
      for (let n = 0; r.start - n * STEP >= floor; n++) {
        const c = cursorAt(r.start - n * STEP);
        if (c && inView(view, c, f, HOLD_EDGE)) {
          departed = r.start - n * STEP;
          break;
        }
      }
      const start = Math.max(busy, departed, r.start - length);
      if (start + length <= Math.min(spot.end, z.to)) move(start, to, "follow", f, length);
    });
  });
  if (list.length) leave(list.at(-1));
  plan.sort((a, b) => a.t - b.t);

  const at = (t) => {
    const m = lastAtOrBefore(plan, t);
    const v = !m ? wide : t >= m.end ? m.to : mix(m.from, m.to, ease((t - m.t) / (m.end - m.t)));
    const { s, x, y } = inBounds(v);
    return { scale: s, x, y };
  };
  const visible = (t) => {
    const v = at(t);
    const sk = v.scale * k;
    return { x: -v.x / sk, y: -v.y / sk, width: place.width / sk, height: place.height / sk };
  };
  return { at, visible, moves: plan.map(({ t, end, kind }) => ({ start: t, end, kind })) };
}

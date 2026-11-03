// Tests for zoom-camera.mjs, with made-up cursor paths.
//
//   node --test zoom-camera.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { zoomCamera } from "./zoom-camera.mjs";

const FPS = 25;
// A 4K screen filling a 1920x1080 video. His picture is 16% of the width, 5% from the right
// edge, and the free part stops 48 px short of it.
const setup = {
  screen: { width: 3840, height: 2160 },
  frame: { width: 1920, height: 1080 },
  free: { x: 48, y: 54, width: 1421, height: 972 },
};
const K = 0.5;
const MIDDLE = { x: 48 + 1421 / 2, y: 54 + 972 / 2 };
const dialog = { x: 1400, y: 700, width: 800, height: 500 };

// The cursor through [seconds, x, y] stops, in straight lines between them, 60 samples a second.
const path = (...stops) => {
  const out = [];
  stops.slice(1).forEach(([t1, x1, y1], i) => {
    const [t0, x0, y0] = stops[i];
    for (let n = 0; t0 + n / 60 < t1; n++) {
      const u = n / 60 / (t1 - t0);
      out.push({ t: t0 + n / 60, x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u });
    }
  });
  const [t, x, y] = stops.at(-1);
  return [...out, { t, x, y }];
};
const frames = (camera, from, to) => Array.from({ length: Math.round((to - from) * FPS) + 1 }, (_, i) => camera.at(from + i / FPS));
const onFrame = (v, p) => ({ x: v.scale * K * p.x + v.x, y: v.scale * K * p.y + v.y });
const onScreen = (v, q) => ({ x: (q.x - v.x) / (v.scale * K), y: (q.y - v.y) / (v.scale * K) });
const inFree = (v, p) => {
  const q = onFrame(v, p);
  return q.x >= 48 && q.x <= 1469 && q.y >= 54 && q.y <= 1026;
};
const follows = (camera) => camera.moves.filter((m) => m.kind === "follow");
const still = (views) => views.every((v) => v.scale === views[0].scale && v.x === views[0].x && v.y === views[0].y);

test("holds still while the cursor rests inside the view", () => {
  const cursor = path([0, 1500, 800], [3, 1500, 800], [3.3, 2100, 1100], [6, 2100, 1100], [6.2, 1800, 950], [10, 1800, 950]);
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 9, box: dialog, follow: true }], cursor });
  assert.equal(follows(camera).length, 0);
  assert.equal(camera.at(2).scale, 3);
  assert.ok(still(frames(camera, 2, 9)));
});

test("glides once, without overshoot, to where the cursor settles outside the view", () => {
  const cursor = path([0, 1800, 950], [4, 1800, 950], [4.25, 2700, 1000], [10, 2700, 1000]);
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 9, box: dialog, follow: true }], cursor });
  const [glide, ...more] = follows(camera);
  assert.equal(more.length, 0);
  assert.ok(glide.end - glide.start >= 0.5 && glide.end - glide.start < 1.5);
  const xs = [...frames(camera, glide.start, glide.end).map((v) => v.x), camera.at(glide.end).x];
  xs.slice(1).forEach((x, i) => assert.ok(x <= xs[i] + 1e-9 && x >= xs.at(-1) - 1e-9));
  assert.ok(inFree(camera.at(glide.end), { x: 2700, y: 1000 }));
  assert.ok(still(frames(camera, glide.end, 8.9)));
});

test("does not drift while the cursor wanders inside the view", () => {
  const circle = Array.from({ length: 601 }, (_, n) => ({ t: n / 60, x: 1800 + 250 * Math.cos((n / 60) * Math.PI), y: 950 + 250 * Math.sin((n / 60) * Math.PI) }));
  const corners = path([10, 1400, 680], [10.5, 1400, 680], [10.8, 2200, 680], [11.3, 2200, 680], [11.6, 2200, 1220], [12.1, 2200, 1220], [12.4, 1400, 1220], [13, 1400, 1220]);
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 13, box: dialog, follow: true }], cursor: [...circle, ...corners] });
  assert.equal(follows(camera).length, 0);
  assert.ok(still(frames(camera, 2, 13)));
});

test("never pans while zooming in, and lands where the cursor rests", () => {
  const cursor = path([0, 2600, 1000], [2.6, 2600, 1000], [2.8, 2300, 1200], [3, 2650, 1050], [10, 2650, 1050]);
  const camera = zoomCamera({ ...setup, zooms: [{ from: 3, to: 8, box: dialog, follow: true }], cursor });
  const zoomIn = camera.moves.find((m) => m.kind === "in");
  assert.ok(Math.abs(zoomIn.end - 3) < 1e-9);
  assert.equal(follows(camera).length, 0);
  const [a, b] = [camera.at(zoomIn.start), camera.at(zoomIn.end)];
  const r = b.scale / a.scale;
  const fixed = { x: (b.x - r * a.x) / (1 - r), y: (b.y - r * a.y) / (1 - r) };
  const pinned = onScreen(a, fixed);
  for (const v of frames(camera, zoomIn.start, zoomIn.end)) {
    const q = onFrame(v, pinned);
    assert.ok(Math.hypot(q.x - fixed.x, q.y - fixed.y) < 1e-6);
  }
  assert.ok(inFree(b, { x: 2650, y: 1050 }));
});

test("glides from one zoom into the next without zooming out", () => {
  const list = { x: 300, y: 300, width: 1100, height: 600 };
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 6, box: dialog }, { from: 7, to: 11, box: list }] });
  assert.deepEqual(camera.moves.map((m) => m.kind), ["in", "chain", "out"]);
  const second = camera.at(11).scale;
  assert.ok(second < 3 && frames(camera, 2, 11).every((v) => v.scale >= second - 1e-9));
});

test("moves in sub-pixel steps", () => {
  const nearby = { ...dialog, x: dialog.x + 40 };
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 4, box: dialog }, { from: 5, to: 7, box: nearby }] });
  const glide = camera.moves[1];
  const xs = frames(camera, glide.start, glide.end).map((v) => v.x);
  const steps = xs.slice(1).map((x, i) => xs[i] - x);
  assert.ok(xs.some((x) => !Number.isInteger(x)));
  assert.ok(steps.every((d) => d >= 0) && steps.some((d) => d > 0 && d < 1));
});

test("gives the same view whatever order the frames are asked in", () => {
  const input = () => ({
    ...setup,
    cursor: path([0, 1800, 950], [4, 1800, 950], [4.25, 2700, 1000], [6, 2700, 1000], [6.3, 1000, 600], [14, 1000, 600]),
    zooms: [{ from: 2, to: 7, box: dialog, follow: true }, { from: 8, to: 12, box: { x: 300, y: 300, width: 1100, height: 600 }, follow: true }],
  });
  const inOrder = frames(zoomCamera(input()), 0, 14);
  const camera = zoomCamera(input());
  const order = [...inOrder.keys()];
  let seed = 7;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffled = [];
  for (const i of order) shuffled[i] = camera.at(i / FPS);
  assert.deepEqual(shuffled, inOrder);
});

test("stays inside the screen and under the speed limit, even at 3x", () => {
  const cursor = path([0, 1800, 950], [5, 1800, 950], [5.3, 300, 300], [12, 300, 300]);
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 11, box: dialog, follow: true }], cursor });
  assert.equal(follows(camera).length, 1);
  const views = frames(camera, 0, 13);
  for (const v of views) {
    assert.ok(v.scale >= 1 && v.scale <= 3);
    assert.ok(v.x <= 0 && v.x >= 1920 * (1 - v.scale) - 1e-9 && v.y <= 0 && v.y >= 1080 * (1 - v.scale) - 1e-9);
  }
  for (const m of camera.moves) {
    const zoomedIn = [camera.at(m.start), camera.at(m.end)].sort((a, b) => b.scale - a.scale)[0];
    const spot = onScreen(zoomedIn, MIDDLE);
    const trail = frames(camera, m.start, m.end).map((v) => onFrame(v, spot));
    trail.slice(1).forEach((q, i) => assert.ok(Math.hypot(q.x - trail[i].x, q.y - trail[i].y) <= ((0.75 * 1920) / FPS) * 1.001));
  }
});

test("centres the box in the free part, zoomed in until it fills it, at most 3x", () => {
  const big = { x: 1000, y: 600, width: 1600, height: 900 };
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 4, box: big }, { from: 8, to: 10, box: dialog }] });
  const v = camera.at(3);
  assert.equal(v.scale, 1421 / 800);
  const c = onFrame(v, { x: 1800, y: 1050 });
  assert.ok(Math.abs(c.x - MIDDLE.x) < 1e-9 && Math.abs(c.y - MIDDLE.y) < 1e-9);
  assert.equal(camera.at(9).scale, 3);
});

test("switches on a cut instead of zooming", () => {
  const camera = zoomCamera({ ...setup, zooms: [{ from: 2, to: 6, box: dialog, startsOnCut: true, endsOnCut: true }] });
  assert.deepEqual([1.96, 2, 5.96, 6].map((t) => camera.at(t).scale), [1, 3, 3, 1]);
});

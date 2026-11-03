// Instagram Reels at 1080x1920, measured from a real iPhone screen: where text and key info
// stay readable, top to bottom. Tall phones trim about 98px off each side; the lower band
// narrows for the like/comment/share column. Graphics behind the speaker may run past it.

export type Band = { top: number; bottom: number; left: number; right: number };

export const SAFE_ZONE = {
  width: 1080,
  height: 1920,
  bands: [
    { top: 220, bottom: 890, left: 130, right: 950 },
    { top: 890, bottom: 1430, left: 130, right: 870 },
  ] satisfies Band[],
};

export type Position = "top" | "center" | "off-center" | "bottom";
type Anchor = { top: number } | { middle: number } | { bottom: number };

// The four heights a style can name. Each pins one edge (or the middle) of a block of text.
export const POSITIONS = {
  top: { top: 220 }, // top edge on the zone's top
  center: { middle: 960 }, // middle on the screen's middle
  "off-center": { middle: 1160 }, // middle in the middle of the lower band
  bottom: { bottom: 1430 }, // bottom edge on the zone's bottom
} satisfies Record<Position, Anchor>;

// The widest stretch centred on the screen that stays inside every band from `top` to `bottom`.
export const column = (top: number, bottom: number) => {
  const mid = SAFE_ZONE.width / 2;
  const bands = SAFE_ZONE.bands.filter((b) => b.top < bottom && top < b.bottom);
  const half = Math.min(...bands.map((b) => Math.min(mid - b.left, b.right - mid)));
  return { left: mid - half, width: 2 * half };
};

// The zone's outline: down the right side of each band, then back up the left.
export const zoneOutline = (bands: Band[]): [number, number][] => [
  ...bands.flatMap((b): [number, number][] => [
    [b.right, b.top],
    [b.right, b.bottom],
  ]),
  ...[...bands].reverse().flatMap((b): [number, number][] => [
    [b.left, b.bottom],
    [b.left, b.top],
  ]),
];

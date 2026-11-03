// Types for zoom-camera.mjs, so a Remotion project's TypeScript accepts it. Copy both together.
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Zoom {
  from: number;
  to: number;
  box: Box;
  follow?: boolean;
  startsOnCut?: boolean;
  endsOnCut?: boolean;
  free?: Box;
}

export interface CursorSample {
  t: number;
  x: number | null;
  y: number | null;
}

export interface Move {
  start: number;
  end: number;
  kind: "in" | "out" | "chain" | "follow" | "cut";
}

export function zoomCamera(options: {
  screen: { width: number; height: number };
  frame: { width: number; height: number };
  placement?: Box;
  free?: Box;
  zooms?: Zoom[];
  cursor?: CursorSample[];
  maxScale?: number;
  maxSpeed?: number;
}): {
  at(t: number): { scale: number; x: number; y: number };
  visible(t: number): Box;
  moves: Move[];
};

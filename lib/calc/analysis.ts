import { findRoot } from "../math/eval";

type F = (x: number) => number;

/**
 * Scan outward from `x0` for the nearest bracketed sign change, then refine.
 * This replaces the device's left-bound / right-bound / guess ritual with a
 * single press, which is what a pointer-driven graph makes possible.
 */
export function findZeroNear(f: F, x0: number, lo: number, hi: number): number | null {
  const steps = 400;
  const h = (hi - lo) / steps;
  let best: number | null = null;
  let bestDist = Infinity;

  let prevX = lo;
  let prevY = f(lo);

  for (let i = 1; i <= steps; i++) {
    const x = lo + i * h;
    const y = f(x);
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      // Reject asymptote crossings: a true root does not jump the whole window.
      const jump = Math.abs(y - prevY);
      const scale = Math.max(Math.abs(y), Math.abs(prevY));
      // A sample landing exactly on a root is a candidate like any other —
      // returning here would hand back the first root in scan order rather
      // than the one nearest the cursor.
      let root: number | null = null;
      if (prevY === 0) root = prevX;
      else if (prevY * y < 0 && (jump < scale * 4 || scale < 1e-6)) {
        root = findRoot(f, prevX, x);
      }
      if (root !== null) {
        const d = Math.abs(root - x0);
        if (d < bestDist) {
          bestDist = d;
          best = root;
        }
      }
    }
    prevX = x;
    prevY = y;
  }
  return best;
}

/** Golden-section search inside a bracket found by local scanning. */
export function findExtremum(
  f: F,
  x0: number,
  radius: number,
  minimum: boolean,
): number | null {
  const sign = minimum ? 1 : -1;
  const g = (x: number) => {
    const v = f(x);
    return Number.isFinite(v) ? sign * v : Infinity;
  };

  // Coarse scan for the best sample in the neighbourhood, then bracket it.
  const n = 200;
  let bestX = x0;
  let bestV = g(x0);
  for (let i = 0; i <= n; i++) {
    const x = x0 - radius + (2 * radius * i) / n;
    const v = g(x);
    if (v < bestV) {
      bestV = v;
      bestX = x;
    }
  }
  if (!Number.isFinite(bestV)) return null;

  const step = (2 * radius) / n;
  let a = bestX - step;
  let b = bestX + step;
  const phi = (Math.sqrt(5) - 1) / 2;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);

  for (let i = 0; i < 200; i++) {
    if (g(c) < g(d)) b = d;
    else a = c;
    c = b - phi * (b - a);
    d = a + phi * (b - a);
    if (Math.abs(b - a) < 1e-12) break;
  }
  const r = (a + b) / 2;
  return Number.isFinite(f(r)) ? r : null;
}

export function findIntersection(
  f: F,
  g: F,
  x0: number,
  lo: number,
  hi: number,
): number | null {
  return findZeroNear((x) => f(x) - g(x), x0, lo, hi);
}

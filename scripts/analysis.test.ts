import { describe, near, ok, reportIfMain } from "./harness";
import { findExtremum, findIntersection, findZeroNear } from "../lib/calc/analysis";

/** The searches behind CALC. Each promises "nearest the cursor" — so test that. */

const parabola = (x: number) => x * x - 4;
const cubic = (x: number) => x ** 3 - x;

describe("findZeroNear");
near("finds a root", findZeroNear(parabola, 1.5, -10, 10)!, 2, 1e-9);
near("and the other one from the other side", findZeroNear(parabola, -1.5, -10, 10)!, -2, 1e-9);
{
  // Regression: an exact hit on a scan sample used to return immediately,
  // handing back the first root in scan order rather than the nearest.
  near("an exact grid hit does not win over a nearer root", findZeroNear(parabola, 4.25, -10, 10)!, 2, 1e-9);
  near("symmetrically", findZeroNear(parabola, -4.25, -10, 10)!, -2, 1e-9);
}
{
  const roots = [-1, 0, 1];
  for (const guess of [-1.4, -0.4, 0.4, 1.4]) {
    const r = findZeroNear(cubic, guess, -5, 5)!;
    const nearest = roots.reduce((a, b) => (Math.abs(b - guess) < Math.abs(a - guess) ? b : a));
    near(`x³-x near ${guess} finds ${nearest}`, r, nearest, 1e-8);
  }
}
ok("no root means no answer", findZeroNear((x) => x * x + 1, 0, -10, 10) === null);
{
  // 1/x changes sign across the pole but has no root there.
  const r = findZeroNear((x) => 1 / x, 0.5, -5, 5);
  ok("an asymptote is not mistaken for a root", r === null);
}

describe("findExtremum");
near("finds a minimum", findExtremum(parabola, 1, 4, true)!, 0, 1e-6);
near("finds a maximum", findExtremum((x) => -parabola(x), 1, 4, false)!, 0, 1e-6);
near("of a cubic's local max", findExtremum(cubic, -0.5, 1, false)!, -Math.sqrt(1 / 3), 1e-5);
near("and its local min", findExtremum(cubic, 0.5, 1, true)!, Math.sqrt(1 / 3), 1e-5);

describe("findIntersection");
near(
  "where a line meets a parabola",
  findIntersection(parabola, () => 0, 1.5, -10, 10)!,
  2,
  1e-9,
);
near(
  "and where two lines cross",
  findIntersection((x) => 2 * x, (x) => x + 3, 0, -10, 10)!,
  3,
  1e-9,
);
ok(
  "parallel lines never meet",
  findIntersection((x) => x, (x) => x + 1, 0, -10, 10) === null,
);

reportIfMain(import.meta.url);

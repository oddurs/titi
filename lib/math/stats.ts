export interface StatRow {
  label: string;
  value: string;
  hint?: string;
}

export interface StatReport {
  title: string;
  rows: StatRow[];
  /** regression result written back into Y₁ */
  expr?: string;
}

import { formatNumber, superscript } from "./format";

const f = (x: number) => formatNumber(x, { notation: "normal", decimals: -1 });

/**
 * A frequency list, checked.
 *
 * The device lets a second list say how many times each value occurred. An
 * absent list means every value counts once; a present one has to line up and
 * hold whole counts, or the statistics it produces are meaningless rather than
 * merely wrong.
 */
export function weightsFor(n: number, freq?: number[]): number[] {
  if (!freq) return new Array(n).fill(1);
  if (freq.length !== n) throw new Error("ERR: DIM MISMATCH");
  if (freq.some((w) => w < 0 || !Number.isFinite(w))) throw new Error("ERR: DOMAIN");
  if (freq.every((w) => w === 0)) throw new Error("ERR: DIM MISMATCH");
  return freq;
}

/** Repeat each value by its weight — for the order statistics, which need it. */
export function expandBy(values: number[], freq?: number[]): number[] {
  const w = weightsFor(values.length, freq);
  if (!freq) return values;
  const out: number[] = [];
  values.forEach((v, i) => {
    // Fractional weights are allowed in the sums but cannot repeat a value;
    // the device rounds them here too.
    const times = Math.round(w[i]);
    for (let k = 0; k < times; k++) out.push(v);
  });
  if (!out.length) throw new Error("ERR: DIM MISMATCH");
  return out;
}

/** The middle value of an already sorted list. */
export function median(sorted: number[]): number {
  const n = sorted.length;
  if (!n) return NaN;
  const m = n >> 1;
  return n % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * The five-number summary.
 *
 * The device splits the sorted list at the median and takes the median of each
 * half, dropping the middle value when the count is odd — not the interpolated
 * quantile most libraries reach for, which puts Q₁ of 1,2,3,4,5 at 2 rather
 * than 1.5. The box plot and 1-Var Stats both read from here so they agree.
 */
export function quartiles(l: number[], freq?: number[]): {
  min: number; q1: number; med: number; q3: number; max: number;
} {
  // Order statistics have no weighted shortcut — a value that occurred four
  // times occupies four places in the sorted list, so it is put there.
  const s = expandBy(l, freq).sort((a, b) => a - b);
  const n = s.length;
  if (!n) return { min: NaN, q1: NaN, med: NaN, q3: NaN, max: NaN };
  if (n === 1) return { min: s[0], q1: s[0], med: s[0], q3: s[0], max: s[0] };
  const m = n >> 1;
  return {
    min: s[0],
    q1: median(s.slice(0, m)),
    med: median(s),
    q3: median(n % 2 ? s.slice(m + 1) : s.slice(m)),
    max: s[n - 1],
  };
}

export function oneVarStats(l: number[], freq?: number[]): StatReport {
  const w = weightsFor(l.length, freq);
  const n = w.reduce((s, k) => s + k, 0);
  const sum = l.reduce((s, x, i) => s + w[i] * x, 0);
  const sum2 = l.reduce((s, x, i) => s + w[i] * x * x, 0);
  const mean = sum / n;
  const ssd = n > 1 ? Math.sqrt((sum2 - (sum * sum) / n) / (n - 1)) : 0;
  const psd = Math.sqrt(sum2 / n - mean * mean);
  const five = quartiles(l, freq);

  return {
    title: "1‑Var Stats",
    rows: [
      { label: "x̄", value: f(mean), hint: "mean" },
      { label: "Σx", value: f(sum) },
      { label: "Σx²", value: f(sum2) },
      { label: "Sx", value: f(ssd), hint: "sample sd" },
      { label: "σx", value: f(psd), hint: "population sd" },
      { label: "n", value: f(n) },
      { label: "minX", value: f(five.min) },
      { label: "Q₁", value: f(five.q1) },
      { label: "Med", value: f(five.med) },
      { label: "Q₃", value: f(five.q3) },
      { label: "maxX", value: f(five.max) },
    ],
  };
}

export function twoVarStats(xs: number[], ys: number[], freq?: number[]): StatReport {
  const w = weightsFor(xs.length, freq);
  const n = w.reduce((s, k) => s + k, 0);
  const sx = xs.reduce((s, x, i) => s + w[i] * x, 0);
  const sy = ys.reduce((s, y, i) => s + w[i] * y, 0);
  const sx2 = xs.reduce((s, x, i) => s + w[i] * x * x, 0);
  const sy2 = ys.reduce((s, y, i) => s + w[i] * y * y, 0);
  const sxy = xs.reduce((s, x, i) => s + w[i] * x * ys[i], 0);

  return {
    title: "2‑Var Stats",
    rows: [
      { label: "x̄", value: f(sx / n) },
      { label: "ȳ", value: f(sy / n) },
      { label: "Σx", value: f(sx) },
      { label: "Σy", value: f(sy) },
      { label: "Σx²", value: f(sx2) },
      { label: "Σy²", value: f(sy2) },
      { label: "Σxy", value: f(sxy) },
      { label: "n", value: f(n) },
    ],
  };
}

export function linReg(xs: number[], ys: number[], freq?: number[]): StatReport {
  const w = weightsFor(xs.length, freq);
  const n = w.reduce((s, k) => s + k, 0);
  const sx = xs.reduce((s, x, i) => s + w[i] * x, 0);
  const sy = ys.reduce((s, y, i) => s + w[i] * y, 0);
  const sxy = xs.reduce((s, x, i) => s + w[i] * x * ys[i], 0);
  const sx2 = xs.reduce((s, x, i) => s + w[i] * x * x, 0);
  const sy2 = ys.reduce((s, y, i) => s + w[i] * y * y, 0);

  const denom = n * sx2 - sx * sx;
  const a = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  const r =
    (n * sxy - sx * sy) /
    Math.sqrt(Math.max(1e-300, (n * sx2 - sx * sx) * (n * sy2 - sy * sy)));

  const expr = `${f(a)}X+${f(b)}`.replace("+-", "-");
  return {
    title: "LinReg  y = ax + b",
    rows: [
      { label: "a", value: f(a), hint: "slope" },
      { label: "b", value: f(b), hint: "intercept" },
      { label: "r²", value: f(r * r) },
      { label: "r", value: f(r), hint: "correlation" },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr,
  };
}

/**
 * The three transform-and-fit regressions. Each linearises the data, runs the
 * same least-squares line, then maps the coefficients back.
 *   ExpReg  y = ab^x   fits ln y against x
 *   LnReg   y = a + b ln x
 *   PwrReg  y = ax^b   fits ln y against ln x
 */
function transformedFit(
  xs: number[],
  ys: number[],
  fx: (x: number) => number,
  fy: (y: number) => number,
  freq?: number[],
): { slope: number; intercept: number; r: number } {
  const w = weightsFor(xs.length, freq);
  const n = w.reduce((s, k) => s + k, 0);
  const u = xs.map(fx);
  const v = ys.map(fy);
  if (u.some((x) => !Number.isFinite(x)) || v.some((y) => !Number.isFinite(y))) {
    throw new Error("ERR: DOMAIN");
  }
  const su = u.reduce((s, x, i) => s + w[i] * x, 0);
  const sv = v.reduce((s, y, i) => s + w[i] * y, 0);
  const suv = u.reduce((s, x, i) => s + w[i] * x * v[i], 0);
  const su2 = u.reduce((s, x, i) => s + w[i] * x * x, 0);
  const sv2 = v.reduce((s, y, i) => s + w[i] * y * y, 0);

  const denom = n * su2 - su * su;
  const slope = denom === 0 ? 0 : (n * suv - su * sv) / denom;
  const intercept = (sv - slope * su) / n;
  const r =
    (n * suv - su * sv) /
    Math.sqrt(Math.max(1e-300, (n * su2 - su * su) * (n * sv2 - sv * sv)));
  return { slope, intercept, r };
}

export function expReg(xs: number[], ys: number[], freq?: number[]): StatReport {
  if (ys.some((y) => y <= 0)) throw new Error("ERR: DOMAIN");
  const { slope, intercept, r } = transformedFit(xs, ys, (x) => x, Math.log, freq);
  const a = Math.exp(intercept);
  const b = Math.exp(slope);
  return {
    title: "ExpReg  y = ab^x",
    rows: [
      { label: "a", value: f(a) },
      { label: "b", value: f(b), hint: "growth factor" },
      { label: "r²", value: f(r * r) },
      { label: "r", value: f(r) },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr: `${f(a)}*${f(b)}^X`,
  };
}

export function lnReg(xs: number[], ys: number[], freq?: number[]): StatReport {
  if (xs.some((x) => x <= 0)) throw new Error("ERR: DOMAIN");
  const { slope, intercept, r } = transformedFit(xs, ys, Math.log, (y) => y, freq);
  return {
    title: "LnReg  y = a + b ln x",
    rows: [
      { label: "a", value: f(intercept) },
      { label: "b", value: f(slope) },
      { label: "r²", value: f(r * r) },
      { label: "r", value: f(r) },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr: `${f(intercept)}+${f(slope)}*ln(X)`.replace("+-", "-"),
  };
}

export function pwrReg(xs: number[], ys: number[], freq?: number[]): StatReport {
  if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) throw new Error("ERR: DOMAIN");
  const { slope, intercept, r } = transformedFit(xs, ys, Math.log, Math.log, freq);
  const a = Math.exp(intercept);
  return {
    title: "PwrReg  y = ax^b",
    rows: [
      { label: "a", value: f(a) },
      { label: "b", value: f(slope), hint: "exponent" },
      { label: "r²", value: f(r * r) },
      { label: "r", value: f(r) },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr: `${f(a)}*X^${f(slope)}`,
  };
}

/** Least squares quadratic via the normal equations, solved by elimination. */
/**
 * Least squares for a polynomial of any degree, optionally weighted.
 *
 * The normal-equation system is built on the moments Σwxᵏ, which is the same
 * shape at every degree — so QuadReg, CubicReg and QuartReg are one function
 * with one number changed. It conditions badly as the degree climbs, which is
 * why the solve reports failure rather than returning something confident and
 * wrong.
 */
function polyReg(
  xs: number[],
  ys: number[],
  degree: number,
  freq?: number[],
): { coeffs: number[]; r2: number } {
  const w = weightsFor(xs.length, freq);
  const n = w.reduce((s, k) => s + k, 0);
  if (n <= degree) throw new Error("ERR: DIM MISMATCH");

  // moment(k) = Σ w·xᵏ, and cross(k) = Σ w·xᵏ·y
  const moment = (k: number) => xs.reduce((s, x, i) => s + w[i] * Math.pow(x, k), 0);
  const cross = (k: number) => xs.reduce((s, x, i) => s + w[i] * Math.pow(x, k) * ys[i], 0);

  const size = degree + 1;
  const m: number[][] = [];
  const rhs: number[] = [];
  for (let r = 0; r < size; r++) {
    // Highest power first, so the coefficients come back in the order the
    // device prints them: a for xⁿ, then down to the constant.
    m.push(Array.from({ length: size }, (_, c) => moment(2 * degree - r - c)));
    rhs.push(cross(degree - r));
  }

  const coeffs = solveLinear(m, rhs);
  if (!coeffs || coeffs.some((c) => !Number.isFinite(c))) {
    throw new Error("ERR: SINGULAR MAT");
  }

  const at = (x: number) => coeffs.reduce((s, c, i) => s + c * Math.pow(x, degree - i), 0);
  const meanY = ys.reduce((s, y, i) => s + w[i] * y, 0) / n;
  const ssTot = ys.reduce((s, y, i) => s + w[i] * (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + w[i] * (y - at(xs[i])) ** 2, 0);
  return { coeffs, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

/** The expression a polynomial fit writes into Y₁. */
function polyExpr(coeffs: number[]): string {
  const degree = coeffs.length - 1;
  return coeffs
    .map((c, i) => {
      const power = degree - i;
      // The faceplate has x² and x³ keys and nothing beyond, so anything
      // higher is written with the caret — which is also the only form that
      // parses back, since ⁴ is a glyph and not an operator.
      const term =
        power === 0 ? "" : power === 1 ? "X" : power <= 3 ? `X${superscript(power)}` : `X^${power}`;
      return `${f(c)}${term}`;
    })
    .join("+")
    .replace(/\+-/g, "-");
}

const POLY_NAMES: Record<number, [string, string]> = {
  2: ["QuadReg", "y = ax² + bx + c"],
  3: ["CubicReg", "y = ax³ + bx² + cx + d"],
  4: ["QuartReg", "y = ax⁴ + bx³ + cx² + dx + e"],
};

function polyReport(
  xs: number[],
  ys: number[],
  degree: number,
  freq?: number[],
): StatReport {
  const { coeffs, r2 } = polyReg(xs, ys, degree, freq);
  const [name, shape] = POLY_NAMES[degree];
  return {
    title: `${name}  ${shape}`,
    rows: [
      ...coeffs.map((c, i) => ({ label: "abcde"[i], value: f(c) })),
      { label: "R²", value: f(r2) },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr: polyExpr(coeffs),
  };
}

export const quadReg = (xs: number[], ys: number[], freq?: number[]) =>
  polyReport(xs, ys, 2, freq);
export const cubicReg = (xs: number[], ys: number[], freq?: number[]) =>
  polyReport(xs, ys, 3, freq);
export const quartReg = (xs: number[], ys: number[], freq?: number[]) =>
  polyReport(xs, ys, 4, freq);

/**
 * Med-Med — the resistant line.
 *
 * Sort by x, cut into three groups of as near equal size as the count allows,
 * and take the median x and median y of each independently, so a wild point
 * moves a median at most one place instead of dragging a mean. The slope comes
 * from the two outer summary points, and the intercept is the average of what
 * all three summary points would give — which pulls the line a third of the way
 * toward the middle group rather than ignoring it.
 *
 * This is the fit to reach for when LinReg is chasing an outlier.
 */
export function medMedReg(xs: number[], ys: number[], freq?: number[]): StatReport {
  const w = weightsFor(xs.length, freq);
  const points: { x: number; y: number }[] = [];
  xs.forEach((x, i) => {
    const times = freq ? Math.round(w[i]) : 1;
    for (let k = 0; k < times; k++) points.push({ x, y: ys[i] });
  });
  const n = points.length;
  if (n < 3) throw new Error("ERR: DIM MISMATCH");

  points.sort((p, q) => p.x - q.x);
  // The device puts the remainder in the middle group, so the outer two stay
  // the same size and the slope is symmetric.
  const outer = Math.floor(n / 3);
  const groups = [
    points.slice(0, outer),
    points.slice(outer, n - outer),
    points.slice(n - outer),
  ];
  const summary = groups.map((g) => ({
    x: median([...g.map((p) => p.x)].sort((a, b) => a - b)),
    y: median([...g.map((p) => p.y)].sort((a, b) => a - b)),
  }));
  const [left, middle, right] = summary;

  if (right.x === left.x) throw new Error("ERR: SINGULAR MAT");
  const a = (right.y - left.y) / (right.x - left.x);
  // Average the three intercepts the slope implies, one per summary point.
  const b = (left.y + middle.y + right.y - a * (left.x + middle.x + right.x)) / 3;

  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (a * p.x + b)) ** 2, 0);

  return {
    title: "Med-Med  y = ax + b",
    rows: [
      { label: "a", value: f(a), hint: "resistant slope" },
      { label: "b", value: f(b), hint: "intercept" },
      { label: "R²", value: f(ssTot === 0 ? 1 : 1 - ssRes / ssTot) },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr: `${f(a)}X+${f(b)}`.replace("+-", "-"),
  };
}

// ---------------------------------------------------------------------------
// The two regressions with no closed form.
//
// Both reduce to a search over one awkward parameter with an exact linear fit
// inside: for a fixed frequency a sinusoid is linear in its coefficients, and
// for a fixed ceiling a logistic straightens into a line. That keeps the
// search one-dimensional, which is what makes it reliable without needing the
// iteration count the device asks for.
// ---------------------------------------------------------------------------

/** Solve a small symmetric normal-equation system by Gaussian elimination. */
function solveLinear(m: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = m.map((row, i) => [...row, rhs[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < 1e-12) return null;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = a[r][c] / a[c][c];
      for (let j = c; j <= n; j++) a[r][j] -= k * a[c][j];
    }
  }
  return a.map((row, i) => row[n] / a[i][i]);
}

/** Least squares for y ≈ A·sin(bx) + B·cos(bx) + D at a fixed b. */
function sinusoidAt(xs: number[], ys: number[], b: number) {
  const basis = xs.map((x) => [Math.sin(b * x), Math.cos(b * x), 1]);
  const m = [0, 1, 2].map((i) => [0, 1, 2].map((j) =>
    basis.reduce((s, row) => s + row[i] * row[j], 0)));
  const rhs = [0, 1, 2].map((i) => basis.reduce((s, row, k) => s + row[i] * ys[k], 0));
  const c = solveLinear(m, rhs);
  if (!c) return null;
  const sse = ys.reduce((s, y, k) => {
    const p = c[0] * basis[k][0] + c[1] * basis[k][1] + c[2];
    return s + (y - p) * (y - p);
  }, 0);
  return { A: c[0], B: c[1], D: c[2], sse };
}

/**
 * SinReg  y = a sin(bx + c) + d
 *
 * The frequency is swept across everything the sample can resolve — one full
 * period over the whole span at the low end, two samples per period at the
 * high end — then the best is refined by bisecting around it. Any narrower a
 * sweep and a slow wave gets fitted as a fast one aliased down.
 */
export function sinReg(xs: number[], ys: number[]): StatReport {
  const n = xs.length;
  if (n < 4) throw new Error("ERR: DIM MISMATCH");
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo;
  if (span <= 0) throw new Error("ERR: DOMAIN");

  const sorted = [...xs].sort((p, q) => p - q);
  const gaps = sorted.slice(1).map((x, i) => x - sorted[i]).filter((g) => g > 0);
  const finest = Math.max(span / (n * 4), gaps.length ? Math.min(...gaps) : span / n);
  const bMin = (2 * Math.PI) / (span * 1.5);
  const bMax = Math.PI / finest;

  let best: { b: number; fit: NonNullable<ReturnType<typeof sinusoidAt>> } | null = null;
  const STEPS = 600;
  for (let i = 0; i <= STEPS; i++) {
    const b = bMin * Math.pow(bMax / bMin, i / STEPS);
    const fit = sinusoidAt(xs, ys, b);
    if (fit && (!best || fit.sse < best.fit.sse)) best = { b, fit };
  }
  if (!best) throw new Error("ERR: SINGULAR MAT");

  // Refine: halve the bracket around the winner a few dozen times.
  let width = best.b * (Math.pow(bMax / bMin, 1 / STEPS) - 1);
  for (let k = 0; k < 40 && width > 1e-12; k++) {
    const bracket: number[] = [best.b - width, best.b + width];
    for (const candidate of bracket) {
      if (candidate <= 0) continue;
      const fit = sinusoidAt(xs, ys, candidate);
      if (fit && fit.sse < best.fit.sse) best = { b: candidate, fit };
    }
    width /= 2;
  }

  const { A, B, D } = best.fit;
  const b: number = best.b;
  const a = Math.hypot(A, B);
  // a sin(bx + c) = A sin(bx) + B cos(bx) with A = a cos c, B = a sin c
  let c = Math.atan2(B, A);
  if (c <= -Math.PI) c += 2 * Math.PI;

  const expr = `${f(a)}sin(${f(b)}X+${f(c)})+${f(D)}`.split("+-").join("-");
  return {
    title: "SinReg  y = a sin(bx+c)+d",
    rows: [
      { label: "a", value: f(a), hint: "amplitude" },
      { label: "b", value: f(b), hint: "2π ÷ period" },
      { label: "c", value: f(c), hint: "phase" },
      { label: "d", value: f(D), hint: "offset" },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr,
  };
}

/**
 * LogisticReg  y = c / (1 + a·e^(-bx))
 *
 * Fix the ceiling and the curve straightens: ln(c/y - 1) is linear in x. So
 * the ceiling is the only thing searched over, from just above the largest
 * observation upwards, and the error is measured back in the original units
 * rather than in the log — otherwise a huge ceiling always wins.
 */
export function logisticReg(xs: number[], ys: number[]): StatReport {
  const n = xs.length;
  if (n < 3) throw new Error("ERR: DIM MISMATCH");
  if (ys.some((y) => y <= 0)) throw new Error("ERR: DOMAIN");
  const yMax = Math.max(...ys);

  const at = (c: number) => {
    const u: number[] = [];
    const v: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = c / ys[i] - 1;
      if (t <= 0) return null;
      u.push(xs[i]);
      v.push(Math.log(t));
    }
    const su = u.reduce((s, x) => s + x, 0);
    const sv = v.reduce((s, y) => s + y, 0);
    const suv = u.reduce((s, x, i) => s + x * v[i], 0);
    const su2 = u.reduce((s, x) => s + x * x, 0);
    const denom = n * su2 - su * su;
    if (Math.abs(denom) < 1e-12) return null;
    const slope = (n * suv - su * sv) / denom;
    const intercept = (sv - slope * su) / n;
    const a = Math.exp(intercept);
    const b = -slope;
    const sse = ys.reduce((s, y, i) => {
      const p = c / (1 + a * Math.exp(-b * xs[i]));
      return s + (y - p) * (y - p);
    }, 0);
    return { a, b, c, sse };
  };

  let best: NonNullable<ReturnType<typeof at>> | null = null;
  const STEPS = 400;
  for (let i = 0; i <= STEPS; i++) {
    // 1.001×max up to 20×max, geometrically — the useful ceilings are near
    // the data, and the tail only needs sampling coarsely.
    const c = yMax * (1.001 * Math.pow(20 / 1.001, i / STEPS));
    const fit = at(c);
    if (fit && (!best || fit.sse < best.sse)) best = fit;
  }
  if (!best) throw new Error("ERR: DOMAIN");

  let width = best.c * 0.05;
  for (let k = 0; k < 60 && width > 1e-9; k++) {
    const bracket: number[] = [best.c - width, best.c + width];
    for (const c of bracket) {
      if (c <= yMax) continue;
      const fit = at(c);
      if (fit && fit.sse < best.sse) best = fit;
    }
    width /= 2;
  }

  const expr = `${f(best.c)}/(1+${f(best.a)}e^(${f(-best.b)}X))`.split("+-").join("-");
  return {
    title: "Logistic  y = c/(1+ae^(-bx))",
    rows: [
      { label: "a", value: f(best.a) },
      { label: "b", value: f(best.b), hint: "growth rate" },
      { label: "c", value: f(best.c), hint: "ceiling" },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr,
  };
}

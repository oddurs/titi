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

import { formatNumber } from "./format";

const f = (x: number) => formatNumber(x, { notation: "normal", decimals: -1 });

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
export function quartiles(l: number[]): {
  min: number; q1: number; med: number; q3: number; max: number;
} {
  const s = [...l].sort((a, b) => a - b);
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

export function oneVarStats(l: number[]): StatReport {
  const n = l.length;
  const sum = l.reduce((s, x) => s + x, 0);
  const sum2 = l.reduce((s, x) => s + x * x, 0);
  const mean = sum / n;
  const ssd = n > 1 ? Math.sqrt((sum2 - (sum * sum) / n) / (n - 1)) : 0;
  const psd = Math.sqrt(sum2 / n - mean * mean);
  const five = quartiles(l);

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

export function twoVarStats(xs: number[], ys: number[]): StatReport {
  const n = xs.length;
  const sx = xs.reduce((s, x) => s + x, 0);
  const sy = ys.reduce((s, y) => s + y, 0);
  const sx2 = xs.reduce((s, x) => s + x * x, 0);
  const sy2 = ys.reduce((s, y) => s + y * y, 0);
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);

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

export function linReg(xs: number[], ys: number[]): StatReport {
  const n = xs.length;
  const sx = xs.reduce((s, x) => s + x, 0);
  const sy = ys.reduce((s, y) => s + y, 0);
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sx2 = xs.reduce((s, x) => s + x * x, 0);
  const sy2 = ys.reduce((s, y) => s + y * y, 0);

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
): { slope: number; intercept: number; r: number } {
  const n = xs.length;
  const u = xs.map(fx);
  const v = ys.map(fy);
  if (u.some((x) => !Number.isFinite(x)) || v.some((y) => !Number.isFinite(y))) {
    throw new Error("ERR: DOMAIN");
  }
  const su = u.reduce((s, x) => s + x, 0);
  const sv = v.reduce((s, y) => s + y, 0);
  const suv = u.reduce((s, x, i) => s + x * v[i], 0);
  const su2 = u.reduce((s, x) => s + x * x, 0);
  const sv2 = v.reduce((s, y) => s + y * y, 0);

  const denom = n * su2 - su * su;
  const slope = denom === 0 ? 0 : (n * suv - su * sv) / denom;
  const intercept = (sv - slope * su) / n;
  const r =
    (n * suv - su * sv) /
    Math.sqrt(Math.max(1e-300, (n * su2 - su * su) * (n * sv2 - sv * sv)));
  return { slope, intercept, r };
}

export function expReg(xs: number[], ys: number[]): StatReport {
  if (ys.some((y) => y <= 0)) throw new Error("ERR: DOMAIN");
  const { slope, intercept, r } = transformedFit(xs, ys, (x) => x, Math.log);
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

export function lnReg(xs: number[], ys: number[]): StatReport {
  if (xs.some((x) => x <= 0)) throw new Error("ERR: DOMAIN");
  const { slope, intercept, r } = transformedFit(xs, ys, Math.log, (y) => y);
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

export function pwrReg(xs: number[], ys: number[]): StatReport {
  if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) throw new Error("ERR: DOMAIN");
  const { slope, intercept, r } = transformedFit(xs, ys, Math.log, Math.log);
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
export function quadReg(xs: number[], ys: number[]): StatReport {
  const n = xs.length;
  const p = (k: number) => xs.reduce((s, x) => s + Math.pow(x, k), 0);
  const py = (k: number) => xs.reduce((s, x, i) => s + Math.pow(x, k) * ys[i], 0);

  const m: number[][] = [
    [p(4), p(3), p(2), py(2)],
    [p(3), p(2), p(1), py(1)],
    [p(2), p(1), n, py(0)],
  ];

  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let r = i + 1; r < 3; r++) {
      if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r;
    }
    [m[i], m[pivot]] = [m[pivot], m[i]];
    if (Math.abs(m[i][i]) < 1e-12) continue;
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const factor = m[r][i] / m[i][i];
      for (let c = i; c < 4; c++) m[r][c] -= factor * m[i][c];
    }
  }

  const a = m[0][0] ? m[0][3] / m[0][0] : 0;
  const b = m[1][1] ? m[1][3] / m[1][1] : 0;
  const c = m[2][2] ? m[2][3] / m[2][2] : 0;

  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => {
    const pred = a * xs[i] * xs[i] + b * xs[i] + c;
    return s + (y - pred) ** 2;
  }, 0);

  const expr = `${f(a)}X²+${f(b)}X+${f(c)}`.replace(/\+-/g, "-");
  return {
    title: "QuadReg  y = ax² + bx + c",
    rows: [
      { label: "a", value: f(a) },
      { label: "b", value: f(b) },
      { label: "c", value: f(c) },
      { label: "R²", value: f(ssTot === 0 ? 1 : 1 - ssRes / ssTot) },
      { label: "→", value: "Y₁", hint: "stored" },
    ],
    expr,
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

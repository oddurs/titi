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

export function oneVarStats(l: number[]): StatReport {
  const n = l.length;
  const sum = l.reduce((s, x) => s + x, 0);
  const sum2 = l.reduce((s, x) => s + x * x, 0);
  const mean = sum / n;
  const ssd = n > 1 ? Math.sqrt((sum2 - (sum * sum) / n) / (n - 1)) : 0;
  const psd = Math.sqrt(sum2 / n - mean * mean);
  const sorted = [...l].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  return {
    title: "1‑Var Stats",
    rows: [
      { label: "x̄", value: f(mean), hint: "mean" },
      { label: "Σx", value: f(sum) },
      { label: "Σx²", value: f(sum2) },
      { label: "Sx", value: f(ssd), hint: "sample sd" },
      { label: "σx", value: f(psd), hint: "population sd" },
      { label: "n", value: f(n) },
      { label: "minX", value: f(sorted[0]) },
      { label: "Q₁", value: f(q(0.25)) },
      { label: "Med", value: f(q(0.5)) },
      { label: "Q₃", value: f(q(0.75)) },
      { label: "maxX", value: f(sorted[sorted.length - 1]) },
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

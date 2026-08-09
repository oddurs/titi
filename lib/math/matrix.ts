/**
 * Dense real matrices, sized at construction. Everything here is pure — no
 * store, no DOM — so the test suite can exercise it directly.
 */

export interface Matrix {
  /** rows */
  r: number;
  /** columns */
  c: number;
  /** row-major cells, m[row][col] */
  m: number[][];
}

export class MatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatrixError";
  }
}

const err = (msg: string): never => {
  throw new MatrixError(msg);
};

export const isMatrix = (v: unknown): v is Matrix =>
  typeof v === "object" && v !== null && "m" in v && "r" in v && "c" in v;

export function matrix(rows: number[][]): Matrix {
  const r = rows.length;
  if (r === 0) err("ERR: INVALID DIM");
  const c = rows[0].length;
  if (c === 0) err("ERR: INVALID DIM");
  if (rows.some((row) => row.length !== c)) err("ERR: INVALID DIM");
  return { r, c, m: rows.map((row) => [...row]) };
}

export function zeros(r: number, c: number): Matrix {
  if (r < 1 || c < 1 || !Number.isInteger(r) || !Number.isInteger(c)) {
    err("ERR: INVALID DIM");
  }
  return { r, c, m: Array.from({ length: r }, () => new Array(c).fill(0)) };
}

export function identity(n: number): Matrix {
  const a = zeros(n, n);
  for (let i = 0; i < n; i++) a.m[i][i] = 1;
  return a;
}

export const clone = (a: Matrix): Matrix => ({
  r: a.r,
  c: a.c,
  m: a.m.map((row) => [...row]),
});

export function mapMatrix(a: Matrix, f: (x: number) => number): Matrix {
  return { r: a.r, c: a.c, m: a.m.map((row) => row.map(f)) };
}

export function zip(
  a: Matrix,
  b: Matrix,
  f: (x: number, y: number) => number,
): Matrix {
  if (a.r !== b.r || a.c !== b.c) err("ERR: DIM MISMATCH");
  return { r: a.r, c: a.c, m: a.m.map((row, i) => row.map((x, j) => f(x, b.m[i][j]))) };
}

export const add = (a: Matrix, b: Matrix) => zip(a, b, (x, y) => x + y);
export const sub = (a: Matrix, b: Matrix) => zip(a, b, (x, y) => x - y);
export const scale = (a: Matrix, k: number) => mapMatrix(a, (x) => x * k);

export function mul(a: Matrix, b: Matrix): Matrix {
  if (a.c !== b.r) err("ERR: DIM MISMATCH");
  const out = zeros(a.r, b.c);
  for (let i = 0; i < a.r; i++) {
    for (let k = 0; k < a.c; k++) {
      const aik = a.m[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < b.c; j++) out.m[i][j] += aik * b.m[k][j];
    }
  }
  return out;
}

export function transpose(a: Matrix): Matrix {
  const out = zeros(a.c, a.r);
  for (let i = 0; i < a.r; i++) {
    for (let j = 0; j < a.c; j++) out.m[j][i] = a.m[i][j];
  }
  return out;
}

/** Determinant by LU decomposition with partial pivoting. */
export function det(a: Matrix): number {
  if (a.r !== a.c) err("ERR: INVALID DIM");
  const n = a.r;
  const w = a.m.map((row) => [...row]);
  let sign = 1;

  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(w[k][i]) > Math.abs(w[pivot][i])) pivot = k;
    }
    if (Math.abs(w[pivot][i]) < 1e-14) return 0;
    if (pivot !== i) {
      [w[i], w[pivot]] = [w[pivot], w[i]];
      sign = -sign;
    }
    for (let k = i + 1; k < n; k++) {
      const f = w[k][i] / w[i][i];
      for (let j = i; j < n; j++) w[k][j] -= f * w[i][j];
    }
  }

  let d = sign;
  for (let i = 0; i < n; i++) d *= w[i][i];
  // LU accumulates noise; a determinant that is an integer to 1e-9 is one.
  const rounded = Math.round(d);
  return Math.abs(d - rounded) < 1e-9 * Math.max(1, Math.abs(d)) ? rounded : d;
}

/** Gauss-Jordan inverse. Throws ERR: SINGULAR MAT when there isn't one. */
export function inverse(a: Matrix): Matrix {
  if (a.r !== a.c) err("ERR: INVALID DIM");
  const n = a.r;
  const w = a.m.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(w[k][i]) > Math.abs(w[pivot][i])) pivot = k;
    }
    if (Math.abs(w[pivot][i]) < 1e-12) err("ERR: SINGULAR MAT");
    [w[i], w[pivot]] = [w[pivot], w[i]];

    const p = w[i][i];
    for (let j = 0; j < 2 * n; j++) w[i][j] /= p;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = w[k][i];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) w[k][j] -= f * w[i][j];
    }
  }

  return { r: n, c: n, m: w.map((row) => row.slice(n).map(tidy)) };
}

/**
 * Elimination leaves noise in the last couple of bits: 1.5 arrives as
 * 1.4999999999999998. Snap to the nearest integer when we are within 1e-10,
 * otherwise drop to twelve significant digits — still two more than the
 * display ever shows, so nothing visible is lost.
 */
function tidy(x: number): number {
  if (!Number.isFinite(x)) return x;
  const r = Math.round(x);
  if (Math.abs(x - r) < 1e-10) return r;
  return Number(x.toPrecision(12));
}

/** Reduced row echelon form. */
export function rref(a: Matrix): Matrix {
  const w = a.m.map((row) => [...row]);
  let lead = 0;

  for (let row = 0; row < a.r && lead < a.c; row++) {
    let i = row;
    while (Math.abs(w[i][lead]) < 1e-12) {
      i += 1;
      if (i === a.r) {
        i = row;
        lead += 1;
        if (lead === a.c) return { r: a.r, c: a.c, m: w.map((x) => x.map(tidy)) };
      }
    }
    [w[i], w[row]] = [w[row], w[i]];

    const p = w[row][lead];
    for (let j = 0; j < a.c; j++) w[row][j] /= p;

    for (let k = 0; k < a.r; k++) {
      if (k === row) continue;
      const f = w[k][lead];
      if (f === 0) continue;
      for (let j = 0; j < a.c; j++) w[k][j] -= f * w[row][j];
    }
    lead += 1;
  }

  return { r: a.r, c: a.c, m: w.map((x) => x.map(tidy)) };
}

/** Row echelon form — forward elimination only. */
export function ref(a: Matrix): Matrix {
  const w = a.m.map((row) => [...row]);
  let lead = 0;

  for (let row = 0; row < a.r && lead < a.c; row++) {
    let i = row;
    while (i < a.r && Math.abs(w[i][lead]) < 1e-12) i += 1;
    if (i === a.r) {
      lead += 1;
      row -= 1;
      continue;
    }
    [w[i], w[row]] = [w[row], w[i]];

    const p = w[row][lead];
    for (let j = 0; j < a.c; j++) w[row][j] /= p;

    for (let k = row + 1; k < a.r; k++) {
      const f = w[k][lead];
      if (f === 0) continue;
      for (let j = 0; j < a.c; j++) w[k][j] -= f * w[row][j];
    }
    lead += 1;
  }

  return { r: a.r, c: a.c, m: w.map((x) => x.map(tidy)) };
}

/** Side-by-side concatenation; both operands need the same row count. */
export function augment(a: Matrix, b: Matrix): Matrix {
  if (a.r !== b.r) err("ERR: DIM MISMATCH");
  return { r: a.r, c: a.c + b.c, m: a.m.map((row, i) => [...row, ...b.m[i]]) };
}

/** Integer powers, with negative exponents going through the inverse. */
export function power(a: Matrix, n: number): Matrix {
  if (a.r !== a.c) err("ERR: INVALID DIM");
  if (!Number.isInteger(n)) err("ERR: DOMAIN");
  if (n < 0) return power(inverse(a), -n);
  let result = identity(a.r);
  let base = clone(a);
  let e = n;
  while (e > 0) {
    if (e & 1) result = mul(result, base);
    base = mul(base, base);
    e >>= 1;
  }
  return mapMatrix(result, tidy);
}

/** Resize in place semantics: keep overlapping cells, zero-fill the rest. */
export function resize(a: Matrix, r: number, c: number): Matrix {
  const out = zeros(r, c);
  for (let i = 0; i < Math.min(r, a.r); i++) {
    for (let j = 0; j < Math.min(c, a.c); j++) out.m[i][j] = a.m[i][j];
  }
  return out;
}

/** Flatten column-major, the way Matr▸list reads a column out. */
export function column(a: Matrix, index: number): number[] {
  if (index < 1 || index > a.c) err("ERR: INVALID DIM");
  return a.m.map((row) => row[index - 1]);
}

export function fromColumns(cols: number[][]): Matrix {
  const r = cols[0]?.length ?? 0;
  if (r === 0) err("ERR: INVALID DIM");
  if (cols.some((col) => col.length !== r)) err("ERR: DIM MISMATCH");
  return {
    r,
    c: cols.length,
    m: Array.from({ length: r }, (_, i) => cols.map((col) => col[i])),
  };
}

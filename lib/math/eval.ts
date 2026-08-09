import type { Node } from "./ast";
import { parse } from "./parser";
import * as M from "./matrix";
import { MatrixError, isMatrix, type Matrix } from "./matrix";
import * as C from "./complex";
import { isComplex, type Complex } from "./complex";

export type Val = number | number[] | Matrix | Complex;
/** A scalar, real or complex. */
export type Scalar = number | Complex;

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcError";
  }
}

export interface Env {
  vars: Record<string, number>;
  lists: Record<string, number[]>;
  /** Y₁..Y₆ source expressions, keyed by their subscript glyph name. */
  ys: Record<string, string>;
  angle: "rad" | "deg";
  /** Real mode refuses non-real answers; a+bi returns them. */
  complex: "real" | "a+bi";
  ans: Val;
  /** [A]..[J] */
  mats: Record<string, Matrix>;
  /** term functions for u, v and w, so a definition can reference any of them */
  seqTerms?: Record<string, (n: number) => number>;
  /** When true, domain errors yield NaN instead of throwing (plotting/tables). */
  lenient: boolean;
}

export function makeEnv(partial: Partial<Env> = {}): Env {
  const vars: Record<string, number> = {};
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZθ") vars[c] = 0;
  vars.n = 0;
  vars.nMin = 1;
  return {
    vars,
    lists: {},
    ys: {},
    mats: {},
    angle: "rad",
    complex: "real",
    ans: 0,
    lenient: false,
    ...partial,
  };
}

type Fn = (env: Env) => Val;

const TAU = Math.PI * 2;

const num = (v: Val): number => {
  if (typeof v === "number") return v;
  if (isComplex(v) && v.im === 0) return v.re;
  throw new CalcError("ERR: DATA TYPE");
};

const isScalar = (v: Val): v is Scalar =>
  typeof v === "number" || isComplex(v);

/** Apply a complex function and collapse the result back to a real if it is one. */
const asVal = (z: Complex): Val => C.simplify(C.tidy(z));

const fail = (env: Env, msg: string): number => {
  if (env.lenient) return NaN;
  throw new CalcError(msg);
};

/** Apply a scalar function element-wise, so lists and matrices just work. */
function map1(v: Val, f: (x: number) => number): Val {
  if (typeof v === "number") return f(v);
  if (isMatrix(v)) return M.mapMatrix(v, f);
  if (isComplex(v)) throw new CalcError("ERR: DATA TYPE");
  return v.map(f);
}

/** True when either side is complex, in which case the real path cannot serve. */
const eitherComplex = (a: Val, b: Val) => isComplex(a) || isComplex(b);

/**
 * Both operands as complex, or a type error. A complex never combines with a
 * list or a matrix — those stay strictly real.
 */
function complexPair(a: Val, b: Val): [Complex, Complex] {
  if (!isScalar(a) || !isScalar(b)) throw new CalcError("ERR: DATA TYPE");
  return [C.toComplex(a), C.toComplex(b)];
}

function map2(a: Val, b: Val, f: (x: number, y: number) => number): Val {
  if (isMatrix(a) || isMatrix(b)) {
    if (isMatrix(a) && isMatrix(b)) return M.zip(a, b, f);
    if (isMatrix(a)) {
      if (typeof b !== "number") throw new CalcError("ERR: DATA TYPE");
      return M.mapMatrix(a, (x) => f(x, b));
    }
    if (typeof a !== "number") throw new CalcError("ERR: DATA TYPE");
    return M.mapMatrix(b as Matrix, (y) => f(a, y));
  }
  if (typeof a === "number" && typeof b === "number") return f(a, b);
  if (isComplex(a) || isComplex(b)) throw new CalcError("ERR: DATA TYPE");
  if (typeof a === "number") return (b as number[]).map((y) => f(a, y));
  if (typeof b === "number") return (a as number[]).map((x) => f(x, b));
  const la = a as number[];
  const lb = b as number[];
  if (la.length !== lb.length) throw new CalcError("ERR: DIM MISMATCH");
  return la.map((x, i) => f(x, lb[i]));
}

/** Scalar `^`, with the device's domain rules. */
function matPowScalar(env: Env, a: number, b: number): number {
  if (a < 0 && !Number.isInteger(b)) return fail(env, "ERR: NONREAL ANS");
  if (a === 0 && b < 0) return fail(env, "ERR: DIVIDE BY 0");
  return Math.pow(a, b);
}

const asMatrix = (v: Val): Matrix => {
  if (isMatrix(v)) return v;
  throw new CalcError("ERR: DATA TYPE");
};

const asList = (v: Val): number[] => {
  if (typeof v === "number") return [v];
  if (isMatrix(v) || isComplex(v)) throw new CalcError("ERR: DATA TYPE");
  return v;
};

/** Matrix errors are CalcErrors as far as the rest of the engine is concerned. */
function lift<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    if (e instanceof MatrixError) throw new CalcError(e.message);
    throw e;
  }
}

const toRad = (env: Env, x: number) => (env.angle === "deg" ? (x * Math.PI) / 180 : x);
const fromRad = (env: Env, x: number) => (env.angle === "deg" ? (x * 180) / Math.PI : x);

/** sin(π) is 1.2e-16 in floating point; snap it so the readout says 0. */
function snapTrig(x: number): number {
  const r = Math.round(x);
  return Math.abs(x - r) < 1e-14 ? r : x;
}

function gammaFn(x: number): number {
  // Lanczos approximation (g=7, n=9) — supports factorial of non-integers,
  // as the device does.
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const z = x - 1;
  let a = c[0];
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
  return Math.sqrt(TAU) * Math.pow(t, z + 0.5) * Math.exp(-t) * a;
}

/** Standard normal CDF, West's double-precision rational approximation (~1e-15). */
export function stdNormalCdf(x: number): number {
  const a = Math.abs(x);
  let c: number;
  if (a > 37) {
    c = 0;
  } else {
    const e = Math.exp((-a * a) / 2);
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688;
      b = b * a + 6.37396220353165;
      b = b * a + 33.912866078383;
      b = b * a + 112.079291497871;
      b = b * a + 221.213596169931;
      b = b * a + 220.206867912376;
      let d = 8.83883476483184e-2 * a + 1.75566716318264;
      d = d * a + 16.064177579207;
      d = d * a + 86.7807322029461;
      d = d * a + 296.564248779674;
      d = d * a + 637.333633378831;
      d = d * a + 793.826512519948;
      d = d * a + 440.413735824752;
      c = (e * b) / d;
    } else {
      let b = a + 0.65;
      b = a + 4 / b;
      b = a + 3 / b;
      b = a + 2 / b;
      b = a + 1 / b;
      c = e / (b * 2.506628274631);
    }
  }
  return x > 0 ? 1 - c : c;
}

export const normalCdf = (lo: number, hi: number, mu = 0, sd = 1) => {
  if (sd <= 0) throw new CalcError("ERR: DOMAIN");
  return stdNormalCdf((hi - mu) / sd) - stdNormalCdf((lo - mu) / sd);
};

export const normalPdf = (x: number, mu = 0, sd = 1) =>
  Math.exp(-((x - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(TAU));

export function invNorm(p: number, mu = 0, sd = 1): number {
  if (p <= 0 || p >= 1) throw new CalcError("ERR: DOMAIN");
  let lo = -40;
  let hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (stdNormalCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return mu + sd * ((lo + hi) / 2);
}

const nCr = (n: number, r: number) =>
  Math.round(gammaFn(n + 1) / (gammaFn(r + 1) * gammaFn(n - r + 1)));

const binomPdf = (n: number, p: number, k: number) =>
  nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);

/** Central-difference derivative with Richardson extrapolation. */
export function derivative(f: (x: number) => number, x: number, h = 1e-4): number {
  const d = (step: number) => (f(x + step) - f(x - step)) / (2 * step);
  const d1 = d(h);
  const d2 = d(h / 2);
  return (4 * d2 - d1) / 3;
}

/** Adaptive Simpson quadrature. */
export function integrate(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-8,
): number {
  if (a === b) return 0;
  const sign = b < a ? -1 : 1;
  if (b < a) [a, b] = [b, a];

  const simpson = (lo: number, hi: number, flo: number, fmid: number, fhi: number) =>
    ((hi - lo) / 6) * (flo + 4 * fmid + fhi);

  const rec = (
    lo: number,
    hi: number,
    flo: number,
    fmid: number,
    fhi: number,
    whole: number,
    eps: number,
    depth: number,
  ): number => {
    const mid = (lo + hi) / 2;
    const lmid = (lo + mid) / 2;
    const rmid = (mid + hi) / 2;
    const flm = f(lmid);
    const frm = f(rmid);
    const left = simpson(lo, mid, flo, flm, fmid);
    const right = simpson(mid, hi, fmid, frm, fhi);
    if (depth > 18 || Math.abs(left + right - whole) <= 15 * eps) {
      return left + right + (left + right - whole) / 15;
    }
    return (
      rec(lo, mid, flo, flm, fmid, left, eps / 2, depth + 1) +
      rec(mid, hi, fmid, frm, fhi, right, eps / 2, depth + 1)
    );
  };

  const fa = f(a);
  const fb = f(b);
  const fm = f((a + b) / 2);
  const whole = simpson(a, b, fa, fm, fb);
  return sign * rec(a, b, fa, fm, fb, whole, tol, 0);
}

/** Brent's method on a bracketed root. */
export function findRoot(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-12,
): number | null {
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null;

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;

  for (let iter = 0; iter < 200; iter++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b; b = c; c = a;
      fa = fb; fb = fc; fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + tol / 2;
    const xm = (c - b) / 2;
    if (Math.abs(xm) <= tol1 || fb === 0) return b;

    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : tol1 * Math.sign(xm);
    fb = f(b);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

const yCache = new Map<string, Fn>();

function compileY(env: Env, name: string): Fn {
  const src = env.ys[name];
  if (!src) throw new CalcError("ERR: UNDEFINED");
  const key = `${name}\u0000${src}`;
  let fn = yCache.get(key);
  if (!fn) {
    fn = compile(parse(src));
    yCache.set(key, fn);
    if (yCache.size > 64) yCache.delete(yCache.keys().next().value!);
  }
  return fn;
}

/** Evaluate `body` with `varName` temporarily bound to `x`. */
function withVar(env: Env, varName: string, x: number, body: Fn): number {
  const saved = env.vars[varName];
  env.vars[varName] = x;
  try {
    return num(body(env));
  } finally {
    env.vars[varName] = saved;
  }
}

export function compile(node: Node): Fn {
  switch (node.t) {
    case "num": {
      const v = node.v;
      return () => v;
    }

    case "const": {
      switch (node.name) {
        case "pi": return () => Math.PI;
        case "e": return () => Math.E;
        case "inf": return () => Infinity;
        case "rand": return () => Math.random();
        case "Ans": return (env) => env.ans;
        case "i": return () => C.cx(0, 1);
        case "E": return () => 10;
        default: return () => 0;
      }
    }

    case "var": {
      const n = node.name;
      return (env) => env.vars[n] ?? 0;
    }

    case "list": {
      const n = node.name;
      return (env) => {
        const l = env.lists[n];
        if (!l) throw new CalcError("ERR: UNDEFINED");
        return l;
      };
    }

    case "listlit": {
      const items = node.items.map(compile);
      return (env) => items.map((f) => num(f(env)));
    }

    case "yref": {
      const n = node.name;
      return (env) => compileY(env, n)(env);
    }

    case "seqref": {
      // A bare u without an index is not a value on its own.
      return () => {
        throw new CalcError("ERR: SYNTAX");
      };
    }

    case "matref": {
      const n = node.name;
      return (env) => {
        const m = env.mats[n];
        if (!m) throw new CalcError("ERR: UNDEFINED");
        return m;
      };
    }

    case "matlit": {
      const rows = node.rows.map((row) => row.map(compile));
      return (env) =>
        lift(() => M.matrix(rows.map((row) => row.map((f) => num(f(env))))));
    }

    case "neg": {
      const e = compile(node.e);
      return (env) => {
        const v = e(env);
        return isComplex(v) ? asVal(C.neg(v)) : map1(v, (x) => -x);
      };
    }

    case "post": {
      const e = compile(node.e);
      switch (node.op) {
        case "²":
          return (env) => {
            const v = e(env);
            if (isMatrix(v)) return lift(() => M.power(v, 2));
            if (isComplex(v)) return asVal(C.mul(v, v));
            return map1(v, (x) => x * x);
          };
        case "³":
          return (env) => {
            const v = e(env);
            if (isMatrix(v)) return lift(() => M.power(v, 3));
            return map1(v, (x) => x * x * x);
          };
        case "ᵀ":
          return (env) => lift(() => M.transpose(asMatrix(e(env))));
        case "⁻¹":
          return (env) => {
            const v = e(env);
            if (isMatrix(v)) return lift(() => M.inverse(v));
            if (isComplex(v)) return asVal(C.div(C.cx(1), v));
            return map1(v, (x) => (x === 0 ? fail(env, "ERR: DIVIDE BY 0") : 1 / x));
          };
        case "!":
          return (env) =>
            map1(e(env), (x) =>
              x < 0 && Number.isInteger(x) ? fail(env, "ERR: DOMAIN") : gammaFn(x + 1),
            );
        // The angle marks read a number in one unit and hand back the same
        // angle in whatever unit the device is set to.
        case "°":
          return (env) => map1(e(env), (x) => (env.angle === "deg" ? x : (x * Math.PI) / 180));
        case "′":
          return (env) => map1(e(env), (x) => (env.angle === "deg" ? x / 60 : (x * Math.PI) / 10800));
        case "″":
          return (env) => map1(e(env), (x) => (env.angle === "deg" ? x / 3600 : (x * Math.PI) / 648000));
        case "ʳ":
          return (env) => map1(e(env), (x) => (env.angle === "rad" ? x : (x * 180) / Math.PI));
        default: return e;
      }
    }

    case "store": {
      const e = compile(node.e);
      const target = node.target;
      return (env) => {
        const v = e(env);
        if (target.startsWith("[")) {
          env.mats[target] = lift(() => M.clone(asMatrix(v)));
        } else if (target.startsWith("L")) {
          env.lists[target] = asList(v).slice();
        } else {
          env.vars[target] = num(v);
        }
        return v;
      };
    }

    case "bin": {
      const l = compile(node.l);
      const r = compile(node.r);
      switch (node.op) {
        case "+":
          return (env) => {
            const a = l(env);
            const b = r(env);
            if (eitherComplex(a, b)) {
              return asVal(C.add(...complexPair(a, b)));
            }
            return map2(a, b, (x, y) => x + y);
          };
        case "-":
          return (env) => {
            const a = l(env);
            const b = r(env);
            if (eitherComplex(a, b)) {
              return asVal(C.sub(...complexPair(a, b)));
            }
            return map2(a, b, (x, y) => x - y);
          };
        case "*":
          return (env) => {
            const a = l(env);
            const b = r(env);
            // matrix × matrix is the real product, not element-wise
            if (isMatrix(a) && isMatrix(b)) return lift(() => M.mul(a, b));
            if (eitherComplex(a, b)) {
              return asVal(C.mul(...complexPair(a, b)));
            }
            return map2(a, b, (x, y) => x * y);
          };
        case "/":
          return (env) => {
            const a = l(env);
            const b = r(env);
            if (isMatrix(b)) throw new CalcError("ERR: DATA TYPE");
            if (eitherComplex(a, b)) {
              const [x, d] = complexPair(a, b);
              if (d.re === 0 && d.im === 0) return fail(env, "ERR: DIVIDE BY 0");
              return asVal(C.div(x, d));
            }
            return map2(a, b, (x, y) =>
              y === 0 ? fail(env, "ERR: DIVIDE BY 0") : x / y,
            );
          };
        case "^":
          return (env) => {
            const a = l(env);
            const b = r(env);
            if (isMatrix(a)) return lift(() => M.power(a, num(b)));
            if (eitherComplex(a, b)) {
              return asVal(C.pow(...complexPair(a, b)));
            }
            // A negative base to a fractional power leaves the reals.
            if (
              isScalar(a) && isScalar(b) &&
              typeof a === "number" && typeof b === "number" &&
              a < 0 && !Number.isInteger(b) && env.complex === "a+bi"
            ) {
              return asVal(C.pow(C.cx(a), C.cx(b)));
            }
            return map2(a, b, (x, y) => matPowScalar(env, x, y));
          };
        case "=": return (env) => map2(l(env), r(env), (a, b) => (a === b ? 1 : 0));
        case "≠": return (env) => map2(l(env), r(env), (a, b) => (a !== b ? 1 : 0));
        case "<": return (env) => map2(l(env), r(env), (a, b) => (a < b ? 1 : 0));
        case ">": return (env) => map2(l(env), r(env), (a, b) => (a > b ? 1 : 0));
        case "≤": return (env) => map2(l(env), r(env), (a, b) => (a <= b ? 1 : 0));
        case "≥": return (env) => map2(l(env), r(env), (a, b) => (a >= b ? 1 : 0));
        default: throw new CalcError("ERR: SYNTAX");
      }
    }

    case "call":
      return compileCall(node);
  }
}

function compileCall(node: Extract<Node, { t: "call" }>): Fn {
  const { name, args } = node;

  // ---- special forms: these need the unevaluated body ----------------------
  if (
    name === "nDeriv" || name === "fnInt" || name === "seq" ||
    name === "sum" || name === "prod" || name === "solve"
  ) {
    return compileSpecial(node);
  }

  if (name === "@seq") {
    const seqName = (args[0] as Extract<Node, { t: "seqref" }>).name;
    const arg = compile(args[1]);
    return (env) => {
      const term = env.seqTerms?.[seqName];
      if (!term) throw new CalcError("ERR: UNDEFINED");
      const n = num(arg(env));
      return term(n);
    };
  }

  if (name === "@y") {
    const yname = (args[0] as Extract<Node, { t: "yref" }>).name;
    const arg = compile(args[1]);
    return (env) => {
      const body = compileY(env, yname);
      return map1(arg(env), (x) => withVar(env, "X", x, body));
    };
  }

  // Matrix functions need whole-value access, not element-wise mapping.
  const MATRIX_FNS = new Set([
    "det", "identity", "rref", "ref", "augment", "dim", "Fill", "randM",
    "matr2list", "list2matr",
  ]);
  if (MATRIX_FNS.has(name)) return compileMatrixCall(node);

  const a = args.map(compile);

  const s1 = (f: (x: number, env: Env) => number): Fn => (env) =>
    map1(a[0](env), (x) => f(x, env));

  /**
   * An inverse circular function: the same escape rules as s1c, but the answer
   * is an angle, so both branches leave radians for the display unit.
   */
  const s1a = (
    real: (x: number) => number,
    complexFn: (z: Complex) => Complex,
    escapes: (x: number) => boolean = () => false,
  ): Fn => (env) => {
    const scale = env.angle === "deg" ? 180 / Math.PI : 1;
    const v = a[0](env);
    if (isComplex(v)) return asVal(C.mul(complexFn(v), C.cx(scale)));
    if (typeof v === "number" && escapes(v)) {
      if (env.complex !== "a+bi") return fail(env, "ERR: DOMAIN");
      return asVal(C.mul(complexFn(C.cx(v)), C.cx(scale)));
    }
    return map1(v, (x) => (escapes(x) ? fail(env, "ERR: DOMAIN") : fromRad(env, real(x))));
  };

  /**
   * A function that has a complex continuation. The real path runs unless the
   * argument is already complex, or the real input leaves the reals and the
   * mode allows following it.
   */
  const s1c = (
    real: (x: number, env: Env) => number,
    complexFn: (z: Complex) => Complex,
    escapes: (x: number) => boolean = () => false,
  ): Fn => (env) => {
    const v = a[0](env);
    if (isComplex(v)) return asVal(complexFn(v));
    if (typeof v === "number" && escapes(v) && env.complex === "a+bi") {
      return asVal(complexFn(C.cx(v)));
    }
    return map1(v, (x) => real(x, env));
  };

  switch (name) {
    case "sin":
      return s1c((x, env) => snapTrig(Math.sin(toRad(env, x))), C.sin);
    case "cos":
      return s1c((x, env) => snapTrig(Math.cos(toRad(env, x))), C.cos);
    case "tan":
      return (env) => {
        const v0 = a[0](env);
        if (isComplex(v0)) return asVal(C.tan(v0));
        return map1(v0, (x) => {
          const r = toRad(env, x);
          const c = Math.cos(r);
          if (Math.abs(c) < 1e-15) return fail(env, "ERR: DOMAIN");
          const s = Math.sin(r);
          return Math.abs(s) < 1e-15 ? 0 : s / c;
        });
      };
    // The inverse circular functions answer in the angle unit, and so does
    // their complex continuation — the device shows sin⁻¹(2) as 90-75.456i in
    // degree mode, not the radian pair.
    case "asin": return s1a(Math.asin, C.asin, (x) => Math.abs(x) > 1);
    case "acos": return s1a(Math.acos, C.acos, (x) => Math.abs(x) > 1);
    case "atan": return s1a(Math.atan, C.atan);
    case "sinh": return s1c(Math.sinh, C.sinh);
    case "cosh": return s1c(Math.cosh, C.cosh);
    case "tanh": return s1c(Math.tanh, C.tanh);
    // The inverse hyperbolics are pure numbers — no angle unit is involved.
    case "asinh": return s1c(Math.asinh, C.asinh);
    case "acosh":
      return s1c(
        (x, env) => (x < 1 ? fail(env, "ERR: DOMAIN") : Math.acosh(x)),
        C.acosh,
        (x) => x < 1,
      );
    case "atanh":
      return s1c(
        (x, env) => (Math.abs(x) >= 1 ? fail(env, "ERR: DOMAIN") : Math.atanh(x)),
        C.atanh,
        (x) => Math.abs(x) >= 1,
      );

    // R▸Pr( and friends: the angle argument and result follow the angle mode,
    // the lengths never do.
    case "rectToR":
      return (env) => map2(a[0](env), a[1](env), (x, y) => Math.hypot(x, y));
    case "rectToTheta":
      return (env) => map2(a[0](env), a[1](env), (x, y) => fromRad(env, Math.atan2(y, x)));
    case "polarToX":
      return (env) => map2(a[0](env), a[1](env), (r, t) => snapTrig(r * Math.cos(toRad(env, t))));
    case "polarToY":
      return (env) => map2(a[0](env), a[1](env), (r, t) => snapTrig(r * Math.sin(toRad(env, t))));

    case "log":
      if (a.length === 2) {
        return (env) => {
          const x = a[0](env);
          const b = a[1](env);
          if (eitherComplex(x, b)) {
            return asVal(C.logBase(...complexPair(x, b)));
          }
          return map2(x, b, (v, base) => Math.log(v) / Math.log(base));
        };
      }
      return s1c(
        (x, env) =>
          x <= 0 ? fail(env, x === 0 ? "ERR: DIVIDE BY 0" : "ERR: NONREAL ANS") : Math.log10(x),
        (z) => C.div(C.log(z), C.cx(Math.LN10)),
        (x) => x < 0,
      );
    case "ln":
      return s1c(
        (x, env) =>
          x <= 0 ? fail(env, x === 0 ? "ERR: DIVIDE BY 0" : "ERR: NONREAL ANS") : Math.log(x),
        C.log,
        (x) => x < 0,
      );
    case "sqrt":
      return s1c(
        (x, env) => (x < 0 ? fail(env, "ERR: NONREAL ANS") : Math.sqrt(x)),
        C.sqrt,
        (x) => x < 0,
      );
    case "cbrt": return s1(Math.cbrt);
    case "xroot":
      return (env) =>
        map2(a[0](env), a[1](env), (n, x) => {
          if (x < 0) {
            if (Number.isInteger(n) && Math.abs(n % 2) === 1) return -Math.pow(-x, 1 / n);
            return fail(env, "ERR: NONREAL ANS");
          }
          return Math.pow(x, 1 / n);
        });
    case "pow10":
      return s1c((x) => Math.pow(10, x), (z) => C.pow(C.cx(10), z));
    case "expe": return s1c(Math.exp, C.exp);
    case "abs":
      return (env) => {
        const v = a[0](env);
        // |a+bi| is the modulus, and it is real
        if (isComplex(v)) return C.abs(v);
        return map1(v, Math.abs);
      };
    case "conj":
      return (env) => {
        const v = a[0](env);
        return isComplex(v) ? asVal(C.conj(v)) : v;
      };
    case "real":
      return (env) => {
        const v = a[0](env);
        return isComplex(v) ? v.re : map1(v, (x) => x);
      };
    case "imag":
      return (env) => {
        const v = a[0](env);
        return isComplex(v) ? v.im : map1(v, () => 0);
      };
    case "angle":
      return (env) => {
        const v = a[0](env);
        const z = isComplex(v) ? v : C.cx(num(v));
        return fromRad(env, C.arg(z));
      };
    case "int": return s1(Math.floor);
    case "iPart": return s1(Math.trunc);
    case "fPart": return s1((x) => x - Math.trunc(x));
    case "round":
      if (a.length === 2) {
        return (env) =>
          map2(a[0](env), a[1](env), (x, d) => {
            const p = Math.pow(10, Math.round(d));
            return Math.round(x * p) / p;
          });
      }
      return s1((x) => Math.round(x * 1e9) / 1e9);

    case "max":
    case "min": {
      const pick = name === "max" ? Math.max : Math.min;
      if (a.length === 2) return (env) => map2(a[0](env), a[1](env), pick);
      return (env) => pick(...asList(a[0](env)));
    }
    case "lcm":
      return (env) => map2(a[0](env), a[1](env), (x, y) => Math.abs(x * y) / gcd2(x, y));
    case "gcd":
      return (env) => map2(a[0](env), a[1](env), gcd2);

    // SortA( and SortD( write back through a named list, the way the device
    // does — the sorted list is returned as well, so they compose.
    case "sortA":
    case "sortD": {
      const target = args[0].t === "list" ? args[0].name : null;
      const dir = name === "sortA" ? 1 : -1;
      return (env) => {
        const sorted = [...asList(a[0](env))].sort((p, q) => (p - q) * dir);
        if (target) env.lists[target] = sorted.slice();
        return sorted;
      };
    }

    case "cumSum":
      return (env) => {
        let run = 0;
        return asList(a[0](env)).map((x) => (run += x));
      };

    case "deltaList":
      return (env) => {
        const l = asList(a[0](env));
        if (l.length < 2) throw new CalcError("ERR: DIM MISMATCH");
        return l.slice(1).map((x, i) => x - l[i]);
      };

    case "mean": return (env) => stat(a[0](env), (l) => l.reduce((s, x) => s + x, 0) / l.length);
    case "median":
      return (env) =>
        stat(a[0](env), (l) => {
          const s = [...l].sort((p, q) => p - q);
          const m = s.length >> 1;
          return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
        });
    case "stdDev": return (env) => stat(a[0](env), (l) => Math.sqrt(sampleVar(l)));
    case "variance": return (env) => stat(a[0](env), sampleVar);

    case "randInt": {
      return (env) => {
        const lo = num(a[0](env));
        const hi = num(a[1](env));
        const n = a[2] ? num(a[2](env)) : 1;
        const draw = () => lo + Math.floor(Math.random() * (hi - lo + 1));
        if (n <= 1) return draw();
        return Array.from({ length: n }, draw);
      };
    }

    case "normalpdf":
      return (env) => {
        const mu = a[1] ? num(a[1](env)) : 0;
        const sd = a[2] ? num(a[2](env)) : 1;
        return map1(a[0](env), (x) => normalPdf(x, mu, sd));
      };
    case "normalcdf":
      return (env) => {
        const lo = num(a[0](env));
        const hi = num(a[1](env));
        const mu = a[2] ? num(a[2](env)) : 0;
        const sd = a[3] ? num(a[3](env)) : 1;
        return normalCdf(lo, hi, mu, sd);
      };
    case "invNorm":
      return (env) =>
        invNorm(num(a[0](env)), a[1] ? num(a[1](env)) : 0, a[2] ? num(a[2](env)) : 1);
    case "binompdf":
      return (env) => {
        const n = num(a[0](env));
        const p = num(a[1](env));
        if (!a[2]) return Array.from({ length: n + 1 }, (_, k) => binomPdf(n, p, k));
        return map1(a[2](env), (k) => binomPdf(n, p, k));
      };
    case "binomcdf":
      return (env) => {
        const n = num(a[0](env));
        const p = num(a[1](env));
        const cum = (k: number) => {
          let s = 0;
          for (let i = 0; i <= k; i++) s += binomPdf(n, p, i);
          return s;
        };
        if (!a[2]) return Array.from({ length: n + 1 }, (_, k) => cum(k));
        return map1(a[2](env), cum);
      };

    default:
      throw new CalcError("ERR: UNDEFINED");
  }
}

function compileMatrixCall(node: Extract<Node, { t: "call" }>): Fn {
  const { name, args } = node;
  const a = args.map(compile);

  switch (name) {
    case "det":
      return (env) => lift(() => M.det(asMatrix(a[0](env))));

    case "identity":
      return (env) => lift(() => M.identity(num(a[0](env))));

    case "rref":
      return (env) => lift(() => M.rref(asMatrix(a[0](env))));

    case "ref":
      return (env) => lift(() => M.ref(asMatrix(a[0](env))));

    case "augment":
      return (env) => {
        const l = a[0](env);
        const r = a[1](env);
        if (isMatrix(l) && isMatrix(r)) return lift(() => M.augment(l, r));
        // augment on two lists concatenates them
        return [...asList(l), ...asList(r)];
      };

    case "dim":
      return (env) => {
        const v = a[0](env);
        if (isMatrix(v)) return [v.r, v.c];
        return asList(v).length;
      };

    case "randM":
      return (env) =>
        lift(() =>
          M.mapMatrix(M.zeros(num(a[0](env)), num(a[1](env))), () =>
            Math.floor(Math.random() * 19) - 9,
          ),
        );

    case "Fill": {
      // Fill(value, [A]) writes through to the named matrix, as on the device,
      // and Fill(value, L₁) does the same for a list.
      const matTarget = args[1].t === "matref" ? args[1].name : null;
      const listTarget = args[1].t === "list" ? args[1].name : null;
      return (env) => {
        const value = num(a[0](env));
        const into = a[1](env);
        if (Array.isArray(into)) {
          const filled = into.map(() => value);
          if (listTarget) env.lists[listTarget] = filled.slice();
          return filled;
        }
        const filled = lift(() => M.mapMatrix(asMatrix(into), () => value));
        if (matTarget) env.mats[matTarget] = filled;
        return filled;
      };
    }

    case "matr2list":
      return (env) =>
        lift(() => M.column(asMatrix(a[0](env)), num(a[1](env))));

    case "list2matr":
      return (env) =>
        lift(() => M.fromColumns(a.map((f) => asList(f(env)))));

    default:
      throw new CalcError("ERR: UNDEFINED");
  }
}

function compileSpecial(node: Extract<Node, { t: "call" }>): Fn {
  const { name, args } = node;

  if (name === "nDeriv") {
    const body = compile(args[0]);
    const varName = varNameOf(args[1]);
    const at = compile(args[2]);
    const h = args[3] ? compile(args[3]) : null;
    return (env) => {
      const step = h ? num(h(env)) : 1e-4;
      return map1(at(env), (x) =>
        derivative((t) => withVar(env, varName, t, body), x, step),
      );
    };
  }

  if (name === "fnInt") {
    const body = compile(args[0]);
    const varName = varNameOf(args[1]);
    const lo = compile(args[2]);
    const hi = compile(args[3]);
    return (env) =>
      integrate(
        (t) => withVar(env, varName, t, body),
        num(lo(env)),
        num(hi(env)),
      );
  }

  if (name === "solve") {
    const body = compile(args[0]);
    const varName = varNameOf(args[1]);
    const guess = compile(args[2]);
    return (env) => {
      const g = num(guess(env));
      const f = (t: number) => withVar(env, varName, t, body);
      for (let span = 1; span <= 1e6; span *= 4) {
        const r = findRoot(f, g - span, g + span);
        if (r !== null) return r;
      }
      throw new CalcError("ERR: NO SIGN CHNG");
    };
  }

  if (name === "seq") {
    const body = compile(args[0]);
    const varName = varNameOf(args[1]);
    const lo = compile(args[2]);
    const hi = compile(args[3]);
    const st = args[4] ? compile(args[4]) : null;
    return (env) => {
      const a0 = num(lo(env));
      const b0 = num(hi(env));
      const step = st ? num(st(env)) : 1;
      const out: number[] = [];
      if (step === 0) throw new CalcError("ERR: INVALID");
      for (let x = a0; step > 0 ? x <= b0 + 1e-12 : x >= b0 - 1e-12; x += step) {
        out.push(withVar(env, varName, x, body));
        if (out.length > 999) break;
      }
      return out;
    };
  }

  // sum(list) and prod(list), each optionally over a 1-based slice
  const listF = compile(args[0]);
  const s = args[1] ? compile(args[1]) : null;
  const e = args[2] ? compile(args[2]) : null;
  const combine = name === "prod"
    ? (acc: number, x: number) => acc * x
    : (acc: number, x: number) => acc + x;
  const seed = name === "prod" ? 1 : 0;
  return (env) => {
    const l = asList(listF(env));
    const from = s ? num(s(env)) - 1 : 0;
    const to = e ? num(e(env)) : l.length;
    return l.slice(from, to).reduce(combine, seed);
  };
}

function varNameOf(n: Node): string {
  if (n.t === "var") return n.name;
  throw new CalcError("ERR: ARGUMENT");
}

function gcd2(x: number, y: number): number {
  let a = Math.abs(Math.round(x));
  let b = Math.abs(Math.round(y));
  while (b) [a, b] = [b, a % b];
  return a;
}

function stat(v: Val, f: (l: number[]) => number): number {
  const l = asList(v);
  if (l.length === 0) throw new CalcError("ERR: DIM MISMATCH");
  return f(l);
}

function sampleVar(l: number[]): number {
  if (l.length < 2) return 0;
  const m = l.reduce((s, x) => s + x, 0) / l.length;
  return l.reduce((s, x) => s + (x - m) ** 2, 0) / (l.length - 1);
}

export function evaluate(src: string, env: Env): Val {
  return compile(parse(src))(env);
}

/** Build a fast single-variable sampler, e.g. for plotting Y₁ against X. */
export function sampler(src: string, env: Env, varName = "X"): (x: number) => number {
  const fn = compile(parse(src));
  return (x: number) => {
    env.vars[varName] = x;
    const v = fn(env);
    return typeof v === "number" ? v : NaN;
  };
}

export function clearYCache() {
  yCache.clear();
}

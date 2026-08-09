/**
 * Complex arithmetic, used only where a real answer doesn't exist.
 *
 * Numbers stay plain JavaScript numbers on the fast path — plotting samples
 * a curve thousands of times and must not allocate. A Complex appears when
 * the user writes `i`, or when an operation leaves the reals and the mode
 * allows it.
 */

export interface Complex {
  re: number;
  im: number;
}

export const isComplex = (v: unknown): v is Complex =>
  typeof v === "object" && v !== null && "re" in v && "im" in v;

export const cx = (re: number, im = 0): Complex => ({ re, im });

/** Collapse to a real when the imaginary part is only rounding noise. */
export function simplify(z: Complex): Complex | number {
  if (Math.abs(z.im) < 1e-12 * Math.max(1, Math.abs(z.re))) return z.re;
  return z;
}

export const toComplex = (v: number | Complex): Complex =>
  typeof v === "number" ? { re: v, im: 0 } : v;

export const add = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

export const sub = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

export const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return { re: Infinity, im: Infinity };
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
}

export const neg = (a: Complex): Complex => ({ re: -a.re, im: -a.im });
export const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const arg = (a: Complex): number => Math.atan2(a.im, a.re);

export function exp(a: Complex): Complex {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
}

/** Principal branch: the cut runs along the negative real axis. */
export function log(a: Complex): Complex {
  return { re: Math.log(abs(a)), im: arg(a) };
}

export function pow(a: Complex, b: Complex): Complex {
  if (a.re === 0 && a.im === 0) {
    if (b.re === 0 && b.im === 0) return { re: 1, im: 0 };
    return { re: 0, im: 0 };
  }
  // Integer powers by repeated multiplication keep exact results exact:
  // (0+1i)² should be -1, not -1 + 1.2e-16i.
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    let result = cx(1);
    const n = Math.abs(b.re);
    for (let k = 0; k < n; k++) result = mul(result, a);
    return b.re < 0 ? div(cx(1), result) : result;
  }
  return exp(mul(b, log(a)));
}

export function sqrt(a: Complex): Complex {
  if (a.im === 0) {
    return a.re >= 0
      ? { re: Math.sqrt(a.re), im: 0 }
      : { re: 0, im: Math.sqrt(-a.re) };
  }
  const m = Math.sqrt(abs(a));
  const t = arg(a) / 2;
  return { re: m * Math.cos(t), im: m * Math.sin(t) };
}

export const sin = (a: Complex): Complex => ({
  re: Math.sin(a.re) * Math.cosh(a.im),
  im: Math.cos(a.re) * Math.sinh(a.im),
});

export const cos = (a: Complex): Complex => ({
  re: Math.cos(a.re) * Math.cosh(a.im),
  im: -Math.sin(a.re) * Math.sinh(a.im),
});

export const tan = (a: Complex): Complex => div(sin(a), cos(a));

export const sinh = (a: Complex): Complex => ({
  re: Math.sinh(a.re) * Math.cos(a.im),
  im: Math.cosh(a.re) * Math.sin(a.im),
});

export const cosh = (a: Complex): Complex => ({
  re: Math.cosh(a.re) * Math.cos(a.im),
  im: Math.sinh(a.re) * Math.sin(a.im),
});

export const tanh = (a: Complex): Complex => div(sinh(a), cosh(a));

/** log base b, for the two-argument form of log(. */
export const logBase = (a: Complex, b: Complex): Complex => div(log(a), log(b));

/** Round the parts the way the display rounds a real. */
export function tidy(z: Complex): Complex {
  const snap = (x: number) => {
    const r = Math.round(x);
    return Math.abs(x - r) < 1e-10 ? r : Number(x.toPrecision(12));
  };
  return { re: snap(z.re), im: snap(z.im) };
}

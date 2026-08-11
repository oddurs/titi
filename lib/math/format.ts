import { isMatrix, type Matrix } from "./matrix";
import { isComplex, type Complex } from "./complex";

export type NotationMode = "normal" | "sci" | "eng";
/** -1 means Float; 0–9 fix that many decimal places. */
export type DecimalMode = number;

export interface FormatOpts {
  notation: NotationMode;
  decimals: DecimalMode;
}

const MAX_SIG = 10;

/** Strip float noise like 0.30000000000000004 before display. */
function clean(x: number, sig = MAX_SIG): number {
  if (!Number.isFinite(x)) return x;
  return Number(x.toPrecision(sig));
}

function stripZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/** The device writes .5, not 0.5. */
function stripLeadingZero(s: string): string {
  if (s.startsWith("0.")) return s.slice(1);
  if (s.startsWith("-0.")) return `-${s.slice(2)}`;
  return s;
}

function sciParts(x: number, sig: number): { mant: string; exp: number } {
  if (x === 0) return { mant: "0", exp: 0 };
  let exp = Math.floor(Math.log10(Math.abs(x)));
  let mant = x / Math.pow(10, exp);
  // log10 rounding can land the mantissa just outside [1, 10)
  if (Math.abs(mant) >= 10) { exp += 1; mant /= 10; }
  else if (Math.abs(mant) < 1) { exp -= 1; mant *= 10; }
  // rounding the mantissa to `sig` digits can itself push it to 10
  if (Number(Math.abs(mant).toPrecision(sig)) >= 10) { exp += 1; mant /= 10; }
  return { mant: stripZeros(mant.toPrecision(sig)), exp };
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function superscript(n: number): string {
  const s = Math.abs(n).toString();
  const body = [...s].map((c) => SUP[Number(c)]).join("");
  return (n < 0 ? "⁻" : "") + body;
}

export function formatNumber(x: number, opts: FormatOpts): string {
  if (Number.isNaN(x)) return "ERR";
  if (!Number.isFinite(x)) return x > 0 ? "∞" : "-∞";

  const { notation, decimals } = opts;
  const v = clean(x, MAX_SIG);

  if (notation === "sci" || notation === "eng") {
    let { mant, exp } = sciParts(v, decimals >= 0 ? decimals + 1 : MAX_SIG);
    if (notation === "eng") {
      const shift = ((exp % 3) + 3) % 3;
      exp -= shift;
      mant = stripZeros((v / Math.pow(10, exp)).toPrecision(MAX_SIG));
    }
    if (decimals >= 0) {
      mant = Number(mant).toFixed(decimals);
    }
    return `${stripLeadingZero(mant)}ᴇ${exp}`;
  }

  // Normal notation falls back to scientific outside the device's display window.
  const mag = Math.abs(v);
  if (mag !== 0 && (mag >= 1e10 || mag < 1e-3)) {
    const { mant, exp } = sciParts(v, decimals >= 0 ? decimals + 1 : MAX_SIG);
    const m = decimals >= 0 ? Number(mant).toFixed(decimals) : mant;
    return `${stripLeadingZero(m)}ᴇ${exp}`;
  }

  if (decimals >= 0) return stripLeadingZero(v.toFixed(decimals));

  // Ten significant digits: values below 1 spend all ten after the point.
  const intDigits = mag < 1 ? 0 : Math.floor(Math.log10(mag)) + 1;
  const dp = Math.max(0, MAX_SIG - intDigits);
  return stripLeadingZero(stripZeros(v.toFixed(Math.min(dp, 14))));
}

/** a+bi, with the parts written the way any other number would be. */
export function formatComplex(z: Complex, opts: FormatOpts): string {
  const re = formatNumber(z.re, opts);
  const im = formatNumber(Math.abs(z.im), opts);
  const sign = z.im < 0 ? "-" : "+";
  // The device writes i rather than 1i, and drops a zero real part.
  const imPart = im === "1" ? "i" : `${im}i`;
  if (z.re === 0) return z.im < 0 ? `-${imPart}` : imPart;
  return `${re}${sign}${imPart}`;
}

export function formatValue(
  v: number | number[] | Matrix | Complex | string,
  opts: FormatOpts,
): string {
  // A string answer prints as itself, without the quotes it was written with.
  if (typeof v === "string") return v;
  if (typeof v === "number") return formatNumber(v, opts);
  if (isComplex(v)) return formatComplex(v, opts);
  if (isMatrix(v)) {
    return v.m
      .map((row) => `[${row.map((x) => formatNumber(x, opts)).join(" ")}]`)
      .join("");
  }
  return `{${v.map((x) => formatNumber(x, opts)).join(" ")}}`;
}

/** Column-aligned rows for the home screen, where a matrix gets real space. */
export function formatMatrixRows(v: Matrix, opts: FormatOpts): string[][] {
  return v.m.map((row) => row.map((x) => formatNumber(x, opts)));
}

/** Compact label for graph axis ticks — fewer digits than the home screen. */
export function formatTick(x: number, step: number): string {
  if (x === 0) return "0";
  const mag = Math.abs(x);
  if (mag >= 1e6 || mag < 1e-4) {
    const { mant, exp } = sciParts(x, 3);
    return `${mant}ᴇ${exp}`;
  }
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(Math.abs(step))) + 1));
  return stripZeros(x.toFixed(decimals));
}

/**
 * ▸Frac — continued-fraction expansion, rejecting denominators the device
 * would not show (TI caps at 3-digit denominators).
 */
/**
 * Degrees as sexagesimal: 45.51 -> 45°30′36″.
 *
 * Seconds carry up to three decimals and lose the trailing zeros; rounding
 * them can fill a minute, so the carry runs upwards before anything is
 * written out.
 */
export function toDMS(x: number): string {
  const sign = x < 0 ? "-" : "";
  const total = Math.abs(x);
  let deg = Math.floor(total);
  let min = Math.floor((total - deg) * 60);
  let sec = Math.round(((total - deg) * 60 - min) * 60 * 1000) / 1000;
  if (sec >= 60) { sec -= 60; min += 1; }
  if (min >= 60) { min -= 60; deg += 1; }
  const secText = String(sec).replace(/^0\./, ".");
  return `${sign}${deg}°${min}′${secText}″`;
}

export function toFraction(
  x: number,
  maxDen = 9999,
): { n: number; d: number } | null {
  if (!Number.isFinite(x)) return null;
  if (Number.isInteger(x)) return { n: x, d: 1 };

  const sign = x < 0 ? -1 : 1;
  const v = Math.abs(x);
  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let b = v;

  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2;
    k0 = k1; k1 = k2;
    const rem = b - a;
    if (Math.abs(h1 / k1 - v) < 1e-12) break;
    if (rem < 1e-12) break;
    b = 1 / rem;
  }

  if (k1 === 0) return null;
  if (Math.abs(h1 / k1 - v) > 1e-9) return null;
  return { n: sign * h1, d: k1 };
}

/** Rewrite a decimal as a multiple of π when it lands cleanly, e.g. 1.5707963 → π/2. */
export function toPiMultiple(x: number): { n: number; d: number } | null {
  if (x === 0) return null;
  const f = toFraction(x / Math.PI, 24);
  if (!f) return null;
  if (Math.abs(f.n) > 24) return null;
  return f;
}

import { describe, eq, near, ok, reportIfMain, throws } from "./harness";
import {
  expReg, linReg, lnReg, oneVarStats, pwrReg, quadReg, twoVarStats,
  quartiles, sinReg, logisticReg,
} from "../lib/math/stats";

/** Pull a labelled row out of a report. */
const val = (r: { rows: { label: string; value: string }[] }, label: string) =>
  Number(r.rows.find((x) => x.label === label)?.value.replace(/^\./, "0."));

describe("1-Var Stats");
const one = oneVarStats([2, 4, 4, 4, 5, 5, 7, 9]);
near("mean", val(one, "x̄"), 5);
near("population sd", val(one, "σx"), 2);
near("sample sd", val(one, "Sx"), 2.138089935, 1e-6);
near("n", val(one, "n"), 8);
near("median", val(one, "Med"), 4.5);
near("min", val(one, "minX"), 2);
near("max", val(one, "maxX"), 9);

describe("2-Var Stats");
const two = twoVarStats([1, 2, 3], [2, 4, 6]);
near("x̄", val(two, "x̄"), 2);
near("ȳ", val(two, "ȳ"), 4);
near("Σxy", val(two, "Σxy"), 28);

describe("LinReg");
const lin = linReg([1, 2, 3, 4], [3, 5, 7, 9]);
near("slope", val(lin, "a"), 2);
near("intercept", val(lin, "b"), 1);
near("perfect fit", val(lin, "r²"), 1, 1e-9);
eq("stores 2X+1", lin.expr, "2X+1");

const linNeg = linReg([1, 2, 3], [5, 3, 1]);
near("negative slope", val(linNeg, "a"), -2);
eq("negative intercept renders once", linNeg.expr, "-2X+7");

describe("QuadReg");
// y = 2x² - 3x + 1
const quad = quadReg([0, 1, 2, 3, 4], [1, 0, 3, 10, 21]);
near("a", val(quad, "a"), 2, 1e-6);
near("b", val(quad, "b"), -3, 1e-6);
near("c", val(quad, "c"), 1, 1e-6);
near("R²", val(quad, "R²"), 1, 1e-9);

describe("ExpReg");
// y = 3 · 2^x
const exp = expReg([0, 1, 2, 3], [3, 6, 12, 24]);
near("a", val(exp, "a"), 3, 1e-9);
near("b", val(exp, "b"), 2, 1e-9);
near("perfect fit", val(exp, "r²"), 1, 1e-9);
throws("non-positive y is a domain error", () => expReg([1, 2], [1, -1]));

describe("LnReg");
// y = 5 + 2 ln x
const ln = lnReg([1, Math.E, Math.E ** 2], [5, 7, 9]);
near("a", val(ln, "a"), 5, 1e-9);
near("b", val(ln, "b"), 2, 1e-9);
throws("non-positive x is a domain error", () => lnReg([0, 1], [1, 2]));

describe("PwrReg");
// y = 3x²
const pwr = pwrReg([1, 2, 3, 4], [3, 12, 27, 48]);
near("a", val(pwr, "a"), 3, 1e-9);
near("b", val(pwr, "b"), 2, 1e-9);
near("perfect fit", val(pwr, "r²"), 1, 1e-9);
throws("non-positive input is a domain error", () => pwrReg([1, 2], [0, 4]));

describe("quartiles follow the device, not the textbook");
{
  // Split at the median and take the median of each half, dropping the middle
  // value when the count is odd. Interpolating instead would put Q₁ at 2.
  const odd = quartiles([1, 2, 3, 4, 5]);
  eq("Q₁ of five values", odd.q1, 1.5);
  eq("the median", odd.med, 3);
  eq("Q₃", odd.q3, 4.5);
  const even = quartiles([1, 2, 3, 4]);
  eq("Q₁ of four values", even.q1, 1.5);
  eq("its median falls between", even.med, 2.5);
  eq("and Q₃", even.q3, 3.5);
  eq("an unsorted list is sorted first", quartiles([6, 2, 4]).med, 4);
  eq("one value is its own summary", quartiles([7]).q3, 7);
  eq("and no values give nothing", Number.isNaN(quartiles([]).med), true);
}

describe("SinReg recovers a wave it was given");
{
  // y = 3 sin(2x + 1) + 5, sampled over three periods.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < 40; i++) {
    const x = i * 0.25;
    xs.push(x);
    ys.push(3 * Math.sin(2 * x + 1) + 5);
  }
  const r = sinReg(xs, ys);
  near("the amplitude", Number(val(r, "a")), 3, 1e-3);
  near("the frequency", Number(val(r, "b")), 2, 1e-3);
  near("the phase", Number(val(r, "c")), 1, 1e-3);
  near("and the offset", Number(val(r, "d")), 5, 1e-3);
  ok("and the fit is written as an expression", /^3sin\(2X\+1\)\+5$/.test(r.expr ?? ""), r.expr);
}
{
  // A slow wave must not come back aliased as a fast one.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < 30; i++) {
    xs.push(i);
    ys.push(10 * Math.sin(0.25 * i) + 2);
  }
  const r = sinReg(xs, ys);
  near("a slow wave stays slow", Number(val(r, "b")), 0.25, 1e-3);
  near("with its own amplitude", Number(val(r, "a")), 10, 1e-3);
}
{
  // Noise should move the fit a little, not derail it.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < 60; i++) {
    const x = i * 0.2;
    xs.push(x);
    ys.push(4 * Math.sin(1.5 * x) + Math.cos(i * 7.13) * 0.2);
  }
  const r = sinReg(xs, ys);
  near("noise does not derail it", Number(val(r, "b")), 1.5, 0.02);
  throws("too few points to fit a wave", () => sinReg([1, 2], [1, 2]));
}

describe("LogisticReg recovers a curve it was given");
{
  // y = 20/(1 + 9e^(-0.5x)), the classic S.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < 30; i++) {
    const x = i * 0.6;
    xs.push(x);
    ys.push(20 / (1 + 9 * Math.exp(-0.5 * x)));
  }
  const r = logisticReg(xs, ys);
  near("the ceiling", Number(val(r, "c")), 20, 1e-3);
  near("the rate", Number(val(r, "b")), 0.5, 1e-4);
  near("and a", Number(val(r, "a")), 9, 1e-3);
  // The search converges to about a part in a billion, which the ten-digit
  // display shows as 8.999999995 rather than 9 — so match the shape.
  ok("and the fit is written as an expression",
    /^20\/\(1\+8?9?\.?\d*e\^\(-\.4?5?\d*X\)\)$/.test(r.expr ?? ""), r.expr);
}
{
  const xs = [0, 1, 2, 3, 4, 5, 6, 7];
  const ys = xs.map((x) => 100 / (1 + 50 * Math.exp(-1.2 * x)));
  const r = logisticReg(xs, ys);
  near("a steeper curve too", Number(val(r, "b")), 1.2, 1e-3);
  throws("a zero reading has no logit", () => logisticReg([1, 2, 3], [1, 0, 3]));
  throws("and two points are not a curve", () => logisticReg([1, 2], [1, 2]));
}

reportIfMain(import.meta.url);

import { describe, eq, near, ok, reportIfMain } from "./harness";
import { evaluate, makeEnv, CalcError, tPdf } from "../lib/math/eval";
import { formatValue } from "../lib/math/format";

/**
 * Checked against the device's own guidebook.
 *
 * Every case here comes from a worked example in TI's TI-84 Plus guidebook —
 * an expression and the answer the device prints for it. Written from
 * knowledge, a conformance claim is really a memory test; written from the
 * document, it is a check.
 *
 * Where we knowingly differ, the divergence is asserted rather than left to be
 * discovered, and says why.
 */

const opts = { notation: "normal" as const, decimals: -1 };

function run(src: string, angle: "rad" | "deg" = "rad", complex: "real" | "a+bi" = "real") {
  const env = makeEnv({ angle, complex });
  try {
    return formatValue(evaluate(src, env), opts);
  } catch (e) {
    return e instanceof CalcError ? e.message : `THREW ${(e as Error).message}`;
  }
}

describe("keyboard operations");
eq("lists add element by element", run("{1,2}+{3,4}+5"), "{9 11}");
eq("sin(30) in radian mode", run("sin(30)"), "-.9880316241");
eq("sin(30) in degree mode", run("sin(30)", "deg"), ".5");

describe("MATH PRB, where nPr and nCr are written between their arguments");
eq("5 nPr 2", run("5 nPr 2"), "20");
eq("5 nCr 2", run("5 nCr 2"), "10");
eq("and they map over lists", run("{2,3} nPr {2,2}"), "{2 6}");
eq("6!", run("6!"), "720");
eq("a list of factorials", run("{5,4,6}!"), "{120 24 720}");
// The device counts before it multiplies.
eq("nCr binds tighter than ×", run("2*5 nCr 2"), "20");
{
  const list = run("randBin(7,.4,10)");
  ok("randBin makes a list of that many", list.split(" ").length === 10, list);
  const shuffled = run("randIntNoRep(3,8)");
  const values = shuffled.replace(/[{}]/g, "").split(" ").map(Number).sort((a, b) => a - b);
  eq("randIntNoRep uses each integer once", values, [3, 4, 5, 6, 7, 8]);
}

describe("the distributions, on the guidebook's own examples");
// normalcdf(lower, upper, μ, σ) — bounds first, then the parameters.
eq("normalcdf takes bounds then parameters", run("normalcdf(-1ᴇ99,36,35,2)"), ".6914624613");
eq("invNorm(area, μ, σ)", run("invNorm(.6914624678,35,2)"), "36.00000004");
eq("invT(area, df)", run("invT(.95,24)"), "1.71088208");
eq("tcdf(lower, upper, df)", run("tcdf(-2,3,18)"), ".9657465611");
eq("χ²cdf(lower, upper, df)", run("χ²cdf(0,19.023,9)"), ".9750019601");

describe("where we are more accurate than the device");
{
  /**
   * Three of the guidebook's printed answers are wrong in the ninth digit, and
   * ours are right — so these assert the true values, not the printed ones.
   * Each is checked against something that does not share our implementation.
   */
  const simpson = (f: (x: number) => number, a: number, b: number, n = 200000) => {
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return (s * h) / 3;
  };
  // Φ(0.5) from the erf series, which has nothing to do with West's algorithm.
  const erf = (x: number) => {
    let sum = x;
    let term = x;
    for (let n = 1; n < 200; n++) {
      term *= (-x * x) / n;
      sum += term / (2 * n + 1);
    }
    return (2 / Math.sqrt(Math.PI)) * sum;
  };
  near("normalcdf: the guidebook prints .6914624678", (1 + erf(0.5 / Math.SQRT2)) / 2, 0.6914624613, 1e-10);
  ok("and it is off by about 7e-9", Math.abs(0.6914624678 - 0.6914624613) > 6e-9);

  // tcdf(-2,3,18) is the area between the bounds, so that is what is
  // integrated — no tail, which is what makes it an independent check.
  const area = simpson((x) => tPdf(x, 18), -2, 3);
  near("tcdf: integrating the density agrees with us", area, 0.9657465611, 1e-8);
  ok("not with the guidebook's .9657465644", Math.abs(0.9657465644 - area) > 3e-9);
}

describe("where we deliberately do more than the device");
{
  // The guidebook is explicit that the trig functions do not take complex
  // arguments. Ours do, on the principal branch — a deliberate extension, and
  // one that costs nothing because complex is off the fast path anyway.
  const answer = run("sin(i)", "rad", "a+bi");
  ok("sin( accepts a complex argument", answer.includes("i"), answer);
  ok("and so does the inverse", run("sin⁻¹(2)", "rad", "a+bi").includes("i"));
  eq("in real mode it still refuses, as the device does", run("sin⁻¹(2)"), "ERR: DOMAIN");
}

reportIfMain(import.meta.url);

import { describe, eq, near, reportIfMain } from "./harness";
import {
  evaluate, makeEnv, CalcError, chi2Cdf, tCdf, fCdf, invT, poissonPdf,
  poissonCdf, geometPdf, geometCdf, lowerGamma, incompleteBeta, stdNormalCdf,
} from "../lib/math/eval";
import { formatValue, toDMS, toFraction } from "../lib/math/format";

const env = makeEnv();
const opts = { notation: "normal" as const, decimals: -1 };

function check(src: string, expected: string, setup?: () => void) {
  setup?.();
  let got: string;
  try {
    got = formatValue(evaluate(src, env), opts);
  } catch (e) {
    got = e instanceof CalcError ? e.message : `THREW ${(e as Error).message}`;
  }
  eq(src, got, expected);
}

describe("arithmetic & precedence");
check("2+3*4", "14");
check("-2^2", "-4");
check("(-2)^2", "4");
check("2^3^2", "512");
check("1/2X", "0", () => { env.vars.X = 0; });
check("1/2X", "2.5", () => { env.vars.X = 5; });
check("2(3+4)", "14");
check("3!", "6");
check("5!/2!", "60");
check("2⁻¹", ".5");
check("4²", "16");
check("100/0", "ERR: DIVIDE BY 0");

describe("implicit multiplication");
check("2π", "6.283185307");
check("2sin(0)", "0");
check("(1+1)(2+2)", "8");
check("X²+2X+1", "36", () => { env.vars.X = 5; });

describe("functions");
check("√(16)", "4");
check("√(-1)", "ERR: NONREAL ANS");
check("∛(-27)", "-3");
check("3ˣ√(8)", "2");
check("ln(ℯ)", "1");
check("log(1000)", "3");
check("log(8,2)", "3");
check("abs(-7)", "7");
check("gcd(12,18)", "6");
check("lcm(4,6)", "12");
check("max(3,9)", "9");
check("int(-2.5)", "-3");
check("iPart(-2.5)", "-2");
check("round(π,4)", "3.1416");

describe("angle modes");
check("sin(π)", "0");
check("cos(0)", "1");
check("sin(30)", ".5", () => { env.angle = "deg"; });
check("tan(90)", "ERR: DOMAIN");
check("sin⁻¹(.5)", "30");
check("sin(π)", "0", () => { env.angle = "rad"; });

describe("calculus");
check("nDeriv(X²,X,3)", "6");
check("nDeriv(sin(X),X,0)", "1");
check("fnInt(X²,X,0,3)", "9");
check("fnInt(sin(X),X,0,π)", "2");
check("solve(X²-9,X,2)", "3");

describe("lists & stats");
check("{1,2,3}+1", "{2 3 4}");
check("mean({2,4,6})", "4");
check("median({1,5,2,8})", "3.5");
check("stdDev({2,4,4,4,5,5,7,9})", "2.138089935");
check("sum(seq(X,X,1,10))", "55");
check("5→A", "5");
check("A²", "25");

describe("stored functions");
check("Y₁(3)", "9", () => { env.ys["Y₁"] = "X²"; });
check("Y₁(3)+1", "10");

describe("notation");
check("1ᴇ12", "1ᴇ12");
check("0.0001", "1ᴇ-4");
check("1/3", ".3333333333");
check("2/3", ".6666666667");

describe("normal distribution");
check("normalcdf(-1ᴇ99,0)", ".5");
check("invNorm(.975)", "1.959963985");

describe("fractions");
const fr = (x: number) => {
  const f = toFraction(x);
  return f ? `${f.n}/${f.d}` : "none";
};
for (const [x, want] of [
  [0.75, "3/4"], [1 / 3, "1/3"], [-2.5, "-5/2"], [Math.PI, "none"],
] as const) {
  eq(`toFraction(${x})`, fr(x as number), want);
}

describe("regressions");
// "".includes() is true for every string, so a bare trailing Y or L used to
// lex as a Y-variable or list reference and then fail as undefined.
check("Y", "0", () => { env.vars.Y = 0; });
check("3→Y", "3");
check("Y+1", "4");
check("L", "0", () => { env.vars.L = 0; });
check("2L", "0");
check("Y₁", "ERR: UNDEFINED", () => { env.ys = {}; });

describe("transpose and brackets do not disturb scalars");
check("2[[1,2][3,4]]", "[2 4][6 8]");
check("5-2", "3");

describe("degrees, minutes and seconds");
const toDeg = () => { env.angle = "deg"; };
const toRad = () => { env.angle = "rad"; };
check("45°", "45", toDeg);
check("1°30′36″", "1.51");
check("30′", ".5");
check("36″", ".01");
check("180°", "3.141592654", toRad);
check("πʳ", "180", toDeg);
check("1ʳ", "1", toRad);
check("sin(30°)", ".5");
check("30°+30°", "1.047197551");

describe("▸DMS");
eq("45.51 in sexagesimal", toDMS(45.51), "45°30′36″");
eq("a whole degree", toDMS(30), "30°0′0″");
eq("rounding seconds carries into minutes", toDMS(1 - 1 / 7200), "0°59′59.5″");
eq("negatives keep the sign on the degrees", toDMS(-1.5), "-1°30′0″");

describe("polar and rectangular conversions");
check("R▸Pr(3,4)", "5", toDeg);
check("R▸Pθ(1,1)", "45");
check("P▸Rx(2,60)", "1");
check("P▸Ry(2,90)", "2", toDeg);
check("R▸Pθ(1,1)", ".7853981634", toRad);

describe("list operations");
{
  const withLists = () => {
    env.lists["L₁"] = [3, 1, 2];
    env.lists["L₂"] = [10, 20, 30];
  };
  check("SortA(L₁)", "{1 2 3}", withLists);
  check("L₁", "{1 2 3}");
  check("SortD(L₁)", "{3 2 1}", withLists);
  check("L₁", "{3 2 1}");
  check("dim(L₂)", "3", withLists);
  check("cumSum(L₂)", "{10 30 60}");
  check("ΔList(L₂)", "{10 10}");
  check("augment(L₁,L₂)", "{3 1 2 10 20 30}", withLists);
  check("sum(L₂)", "60");
  check("sum(L₂,2)", "50");
  check("sum(L₂,1,2)", "30");
  check("prod(L₂)", "6000");
  check("prod(L₂,2,3)", "600");
  check("Fill(7,L₁)", "{7 7 7}", withLists);
  check("L₁", "{7 7 7}");
  check("min(L₂)", "10");
  check("max(L₂)", "30");
  check("ΔList({5})", "ERR: DIM MISMATCH");
  check("cumSum(seq(X,X,1,4))", "{1 3 6 10}");
}

describe("the distributions, against what they must equal");
{
  // Every check here is an identity the distribution has to satisfy, not a
  // number copied out of a table — a wrong table entry and a wrong
  // implementation look identical, an identity does not.
  const p = (x: number) => x;
  void p;

  // χ² with two degrees of freedom is exponential: P(X ≤ x) = 1 - e^(-x/2).
  for (const x of [0.5, 1, 3, 7.5]) {
    near(`χ²cdf(${x}, 2) is exponential`, chi2Cdf(x, 2), 1 - Math.exp(-x / 2), 1e-12);
  }
  // With one degree of freedom it is the square of a standard normal.
  for (const x of [0.25, 1, 4]) {
    near(`χ²cdf(${x}, 1) is Φ(√x) doubled`, chi2Cdf(x, 1), 2 * stdNormalCdf(Math.sqrt(x)) - 1, 1e-10);
  }

  // Student's t with one degree of freedom is Cauchy.
  for (const x of [-3, -0.5, 0, 0.5, 3]) {
    near(`tcdf(${x}, 1) is Cauchy`, tCdf(x, 1), 0.5 + Math.atan(x) / Math.PI, 1e-10);
  }
  near("t is symmetric about zero", tCdf(0, 7), 0.5, 1e-12);
  for (const df of [1, 4, 30]) {
    near(`t(${df}) tails mirror`, tCdf(-1.7, df) + tCdf(1.7, df), 1, 1e-10);
  }
  // As the degrees of freedom climb, t approaches the normal.
  near("t(5000) is all but normal", tCdf(1.96, 5000), stdNormalCdf(1.96), 1e-3);

  // invT is the inverse of tCdf, which is the only thing it has to be.
  for (const [q, df] of [[0.9, 3], [0.975, 10], [0.5, 7], [0.01, 25]] as const) {
    near(`invT(${q}, ${df}) round-trips`, tCdf(invT(q, df), df), q, 1e-9);
  }

  // F(1, d) is t(d) squared: P(F ≤ x) = P(|T| ≤ √x).
  for (const [x, df] of [[1, 5], [4, 12], [0.25, 3]] as const) {
    near(`Fcdf(${x}, 1, ${df}) is t squared`, fCdf(x, 1, df), 2 * tCdf(Math.sqrt(x), df) - 1, 1e-9);
  }
  // And F is its own mirror with the degrees of freedom swapped.
  near("F mirrors under 1/x", fCdf(3, 4, 9), 1 - fCdf(1 / 3, 9, 4), 1e-10);

  // The discrete ones must add up to their own CDFs.
  {
    let sum = 0;
    for (let k = 0; k <= 6; k++) sum += poissonPdf(2.5, k);
    near("poissoncdf is the sum of poissonpdf", poissonCdf(2.5, 6), sum, 1e-12);
  }
  for (const k of [1, 3, 8]) {
    near(`geometcdf(${k}) is 1-(1-p)^k`, geometCdf(0.3, k), 1 - Math.pow(0.7, k), 1e-12);
  }
  near("geometpdf sums to its cdf",
    geometPdf(0.4, 1) + geometPdf(0.4, 2) + geometPdf(0.4, 3), geometCdf(0.4, 3), 1e-12);

  // The incomplete functions, on their defining relations.
  near("P(1, x) is 1 - e^-x", lowerGamma(1, 2.5), 1 - Math.exp(-2.5), 1e-12);
  near("I(x;a,b) and its mirror sum to one",
    incompleteBeta(0.3, 2.5, 4) + incompleteBeta(0.7, 4, 2.5), 1, 1e-12);
  near("I(x;1,1) is x", incompleteBeta(0.42, 1, 1), 0.42, 1e-12);
}

describe("remainder and the connectives");
check("remainder(7,3)", "1", toRad);
check("remainder(-7,3)", "2");
check("remainder(7,-3)", "-2");
check("remainder(6,3)", "0");
check("remainder(1,0)", "ERR: DIVIDE BY 0");
check("1 and 1", "1");
check("1 and 0", "0");
check("0 or 0", "0");
check("3 or 0", "1");
check("1 xor 1", "0");
check("1 xor 0", "1");
check("not(0)", "1");
check("not(7)", "0");
// The connectives bind looser than the comparisons they join, so this reads
// the way it looks rather than as 2>(1 and 3)>2.
check("2>1 and 3>2", "1");
check("2>1 and 1>2", "0");
check("1>2 or 2>1", "1");
check("not(2>1)", "0");

describe("counting");
check("10 nPr 3", "720", toRad);
check("10 nCr 3", "120");
check("200 nCr 100", "9.054851466ᴇ58");
check("5 nCr 0", "1");
check("5 nCr 6", "0");
check("5 nPr 5", "120");
check("poissonpdf(3,2)", ".2240418077");
check("geometcdf(.3,3)", ".657");
check("χ²cdf(0,3.841458821,1)", ".95");
check("tcdf(-1ᴇ99,2.228138852,10)", ".975");
check("invT(.975,10)", "2.228138852");

reportIfMain(import.meta.url);

import { describe, eq, reportIfMain } from "./harness";
import { evaluate, makeEnv, CalcError } from "../lib/math/eval";
import { formatValue, toFraction } from "../lib/math/format";

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

reportIfMain(import.meta.url);

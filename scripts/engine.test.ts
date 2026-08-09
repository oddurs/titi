import { evaluate, makeEnv, CalcError } from "../lib/math/eval";
import { formatValue, toFraction } from "../lib/math/format";

const env = makeEnv();
const opts = { notation: "normal" as const, decimals: -1 };

let pass = 0;
let fail = 0;

function check(src: string, expected: string, setup?: () => void) {
  setup?.();
  let got: string;
  try {
    got = formatValue(evaluate(src, env), opts);
  } catch (e) {
    got = e instanceof CalcError ? e.message : `THREW ${(e as Error).message}`;
  }
  if (got === expected) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`  ✗ ${src}\n      expected ${expected}\n      got      ${got}`);
  }
}

console.log("arithmetic & precedence");
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

console.log("implicit multiplication");
check("2π", "6.283185307");
check("2sin(0)", "0");
check("(1+1)(2+2)", "8");
check("X²+2X+1", "36", () => { env.vars.X = 5; });

console.log("functions");
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

console.log("angle modes");
check("sin(π)", "0");
check("cos(0)", "1");
check("sin(30)", ".5", () => { env.angle = "deg"; });
check("tan(90)", "ERR: DOMAIN");
check("sin⁻¹(.5)", "30");
check("sin(π)", "0", () => { env.angle = "rad"; });

console.log("calculus");
check("nDeriv(X²,X,3)", "6");
check("nDeriv(sin(X),X,0)", "1");
check("fnInt(X²,X,0,3)", "9");
check("fnInt(sin(X),X,0,π)", "2");
check("solve(X²-9,X,2)", "3");

console.log("lists & stats");
check("{1,2,3}+1", "{2 3 4}");
check("mean({2,4,6})", "4");
check("median({1,5,2,8})", "3.5");
check("stdDev({2,4,4,4,5,5,7,9})", "2.138089935");
check("sum(seq(X,X,1,10))", "55");
check("5→A", "5");
check("A²", "25");

console.log("stored functions");
check("Y₁(3)", "9", () => { env.ys["Y₁"] = "X²"; });
check("Y₁(3)+1", "10");

console.log("notation");
check("1ᴇ12", "1ᴇ12");
check("0.0001", "1ᴇ-4");
check("1/3", ".3333333333");
check("2/3", ".6666666667");

console.log("normal distribution");
check("normalcdf(-1ᴇ99,0)", ".5");
check("invNorm(.975)", "1.959963985");

console.log("fractions");
const fr = (x: number) => {
  const f = toFraction(x);
  return f ? `${f.n}/${f.d}` : "none";
};
for (const [x, want] of [[0.75, "3/4"], [1 / 3, "1/3"], [-2.5, "-5/2"], [Math.PI, "none"]] as const) {
  const got = fr(x as number);
  if (got === want) pass += 1;
  else { fail += 1; console.log(`  ✗ toFraction(${x}) expected ${want} got ${got}`); }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

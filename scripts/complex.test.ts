import { describe, eq, near, reportIfMain } from "./harness";
import { CalcError, evaluate, makeEnv } from "../lib/math/eval";
import { formatValue } from "../lib/math/format";
import * as C from "../lib/math/complex";

const opts = { notation: "normal" as const, decimals: -1 };

/** Evaluate in a given complex mode and format, the way the tape would. */
function run(src: string, mode: "real" | "a+bi" = "a+bi"): string {
  const env = makeEnv({ complex: mode });
  try {
    return formatValue(evaluate(src, env), opts);
  } catch (e) {
    return e instanceof CalcError ? e.message : `THREW ${(e as Error).message}`;
  }
}

describe("arithmetic on the module");
eq("addition", C.add(C.cx(1, 2), C.cx(3, 4)), C.cx(4, 6));
eq("subtraction", C.sub(C.cx(1, 2), C.cx(3, 4)), C.cx(-2, -2));
eq("multiplication", C.mul(C.cx(1, 2), C.cx(3, 4)), C.cx(-5, 10));
eq("i squared is -1", C.tidy(C.mul(C.cx(0, 1), C.cx(0, 1))), C.cx(-1, 0));
eq("division", C.tidy(C.div(C.cx(1, 2), C.cx(3, 4))), C.cx(0.44, 0.08));
near("modulus", C.abs(C.cx(3, 4)), 5);
near("argument", C.arg(C.cx(0, 1)), Math.PI / 2);
eq("conjugate", C.conj(C.cx(2, -3)), C.cx(2, 3));

describe("roots and powers");
eq("√(-1)", C.tidy(C.sqrt(C.cx(-1))), C.cx(0, 1));
eq("√(-4)", C.tidy(C.sqrt(C.cx(-4))), C.cx(0, 2));
eq("√4 stays real", C.tidy(C.sqrt(C.cx(4))), C.cx(2, 0));
eq("i³ is -i", C.tidy(C.pow(C.cx(0, 1), C.cx(3))), C.cx(0, -1));
eq("i⁴ is 1", C.tidy(C.pow(C.cx(0, 1), C.cx(4))), C.cx(1, 0));
eq("(1+i)² is 2i", C.tidy(C.pow(C.cx(1, 1), C.cx(2))), C.cx(0, 2));

describe("Euler");
// e^(iπ) + 1 = 0
const euler = C.tidy(C.add(C.exp(C.mul(C.cx(0, 1), C.cx(Math.PI))), C.cx(1)));
near("e^(iπ)+1 has no real part", euler.re, 0, 1e-9);
near("e^(iπ)+1 has no imaginary part", euler.im, 0, 1e-9);
eq("ln(-1) is iπ", C.tidy(C.log(C.cx(-1))).im, C.tidy(C.cx(0, Math.PI)).im);

describe("Real mode refuses to leave the reals");
eq("√(-1)", run("√(-1)", "real"), "ERR: NONREAL ANS");
eq("ln(-1)", run("ln(-1)", "real"), "ERR: NONREAL ANS");
eq("(-8)^(1/3)", run("(-8)^(1÷3)", "real"), "ERR: NONREAL ANS");
eq("real answers are unaffected", run("√(9)", "real"), "3");

describe("a+bi mode follows them");
eq("√(-1)", run("√(-1)"), "i");
eq("√(-4)", run("√(-4)"), "2i");
eq("√(-9)+1", run("√(-9)+1"), "1+3i");
eq("i is a constant", run("i"), "i");
eq("i²", run("i²"), "-1");
eq("3+4i", run("3+4i"), "3+4i");
eq("3-4i", run("3-4i"), "3-4i");
eq("multiplication", run("(1+2i)(3+4i)"), "-5+10i");
eq("division", run("(1+2i)/(3+4i)"), ".44+.08i");
eq("abs is the modulus", run("abs(3+4i)"), "5");
eq("conj flips the sign", run("conj(3+4i)"), "3-4i");
eq("real part", run("real(3+4i)"), "3");
eq("imaginary part", run("imag(3+4i)"), "4");
eq("a real result collapses", run("i*i*i*i"), "1");
eq("ln(-1)", run("ln(-1)"), "3.141592654i");

describe("the quadratic formula finds complex roots");
// x² + 2x + 5 = 0  →  -1 ± 2i
eq("first root", run("(-2+√(2²-4*1*5))/2"), "-1+2i");
eq("second root", run("(-2-√(2²-4*1*5))/2"), "-1-2i");

describe("display");
eq("unit imaginary drops its 1", run("√(-1)"), "i");
eq("negative pure imaginary", run("0-2i"), "-2i");
eq("zero imaginary collapses to a real", run("(1+i)+(1-i)"), "2");
eq("complex division by zero", run("(1+i)/0"), "ERR: DIVIDE BY 0");

describe("lists and matrices stay real");
eq("a complex in a list is a type error", run("{1,2}+i"), "ERR: DATA TYPE");

reportIfMain(import.meta.url);

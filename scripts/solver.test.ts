import { describe, eq, near, reportIfMain, throws } from "./harness";
import {
  equationVariables, solveEquation, toZeroForm,
} from "../lib/math/solver";
import { makeEnv } from "../lib/math/eval";

const env = makeEnv();
const solve = (
  equation: string,
  target: string,
  known: Record<string, number> = {},
  guess = 0,
  bound: [number, number] = [-1e5, 1e5],
) => solveEquation({ equation, target, known, guess, bound }, env).value;

describe("normalising an equation");
eq("no equals sign is already zero-form", toZeroForm("X²-4"), "X²-4");
eq("a=b becomes a-(b)", toZeroForm("X²=4"), "(X²)-(4)");
eq("whitespace is trimmed", toZeroForm(" A + B = C "), "(A + B)-(C)");
eq("equals inside a test is still split once", toZeroForm("Y=2X+1"), "(Y)-(2X+1)");

describe("finding the variables");
eq("in order of appearance", equationVariables("A+B=C"), ["A", "B", "C"]);
eq("no duplicates", equationVariables("X²+X+1"), ["X"]);
eq("functions are not variables", equationVariables("sin(X)+π"), ["X"]);
eq("sequence names are excluded", equationVariables("n+A"), ["A"]);

describe("solving");
near("linear", solve("2X+6=0", "X"), -3);
near("quadratic, root near the guess", solve("X²-4", "X", {}, 1), 2);
near("the other root", solve("X²-4", "X", {}, -5), -2);
near("transcendental", solve("cos(X)-X", "X", {}, 0.5), 0.7390851332, 1e-8);
near("solving for a coefficient", solve("A*3+6=0", "A"), -2);
near("with other variables pinned", solve("A+B=10", "A", { B: 4 }), 6);
near("exponential", solve("2^X=8", "X", {}, 1), 3, 1e-8);
near("respects radian mode", solve("sin(X)", "X", {}, 3), Math.PI, 1e-8);

describe("a root exactly at the guess is returned as is");
near("X-5 guessed at 5", solve("X-5", "X", {}, 5), 5);

describe("failures");
throws("no root in range", () => solve("X²+1", "X"), "ERR: NO SIGN CHNG");
throws(
  "an inverted bound is rejected",
  () => solve("X-1", "X", {}, 0, [5, -5]),
  "ERR: BOUND",
);

describe("the solver leaves the environment as it found it");
env.vars.X = 42;
solve("X-1", "X", {}, 0);
eq("X is untouched", env.vars.X, 42);

reportIfMain(import.meta.url);

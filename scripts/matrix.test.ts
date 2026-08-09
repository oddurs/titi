import { describe, eq, near, ok, reportIfMain, throws } from "./harness";
import * as M from "../lib/math/matrix";
import { CalcError, evaluate, makeEnv } from "../lib/math/eval";
import { formatValue } from "../lib/math/format";

const opts = { notation: "normal" as const, decimals: -1 };
const env = makeEnv();

/** Evaluate and format, so the tests read like the home screen does. */
const run = (src: string): string => {
  try {
    return formatValue(evaluate(src, env), opts);
  } catch (e) {
    return e instanceof CalcError ? e.message : `THREW ${(e as Error).message}`;
  }
};

const A = M.matrix([
  [1, 2],
  [3, 4],
]);
const B = M.matrix([
  [0, 1],
  [1, 0],
]);

// ---------------------------------------------------------------------------
describe("construction");
eq("dimensions", [A.r, A.c], [2, 2]);
eq("identity(3)", M.identity(3).m, [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]);
throws("ragged rows are rejected", () => M.matrix([[1, 2], [3]]), "ERR: INVALID DIM");
throws("empty is rejected", () => M.matrix([]), "ERR: INVALID DIM");

describe("arithmetic");
eq("A + A", M.add(A, A).m, [
  [2, 4],
  [6, 8],
]);
eq("A - A", M.sub(A, A).m, [
  [0, 0],
  [0, 0],
]);
eq("3A", M.scale(A, 3).m, [
  [3, 6],
  [9, 12],
]);
eq("A × B swaps columns", M.mul(A, B).m, [
  [2, 1],
  [4, 3],
]);
eq("A × I is A", M.mul(A, M.identity(2)).m, A.m);
throws(
  "mismatched inner dimensions",
  () => M.mul(A, M.matrix([[1, 2, 3]])),
  "ERR: DIM MISMATCH",
);

describe("transpose");
eq("non-square transpose", M.transpose(M.matrix([[1, 2, 3]])).m, [[1], [2], [3]]);
eq("double transpose is identity", M.transpose(M.transpose(A)).m, A.m);

describe("determinant");
near("det [[1,2][3,4]] = -2", M.det(A), -2);
near("det I = 1", M.det(M.identity(4)), 1);
near("singular det = 0", M.det(M.matrix([[1, 2], [2, 4]])), 0);
near(
  "3×3 determinant",
  M.det(M.matrix([[6, 1, 1], [4, -2, 5], [2, 8, 7]])),
  -306,
);
throws("non-square det", () => M.det(M.matrix([[1, 2, 3]])), "ERR: INVALID DIM");

describe("inverse");
eq("A⁻¹", M.inverse(A).m, [
  [-2, 1],
  [1.5, -0.5],
]);
// mul deliberately does not tidy — the display rounds to ten digits, so the
// round trip is asserted where the user actually sees it.
eq(
  "A A⁻¹ formats as I",
  formatValue(M.mul(A, M.inverse(A)), opts),
  "[1 0][0 1]",
);
throws(
  "singular matrices have no inverse",
  () => M.inverse(M.matrix([[1, 2], [2, 4]])),
  "ERR: SINGULAR MAT",
);

describe("echelon forms");
eq(
  "rref solves a 2×3 system",
  M.rref(M.matrix([[1, 1, 5], [1, -1, 1]])).m,
  [
    [1, 0, 3],
    [0, 1, 2],
  ],
);
eq(
  "rref of a rank-deficient matrix",
  M.rref(M.matrix([[1, 2], [2, 4]])).m,
  [
    [1, 2],
    [0, 0],
  ],
);
eq("ref leaves zeros below the pivots", M.ref(M.matrix([[2, 4], [1, 3]])).m, [
  [1, 2],
  [0, 1],
]);

describe("powers and augment");
eq("A² is the matrix product", M.power(A, 2).m, M.mul(A, A).m);
eq("A⁰ is the identity", M.power(A, 0).m, M.identity(2).m);
eq("A⁻¹ via power", M.power(A, -1).m, M.inverse(A).m);
eq("augment side by side", M.augment(A, M.identity(2)).m, [
  [1, 2, 1, 0],
  [3, 4, 0, 1],
]);
throws(
  "augment needs matching row counts",
  () => M.augment(A, M.matrix([[1, 2, 3]])),
  "ERR: DIM MISMATCH",
);

// ---------------------------------------------------------------------------
describe("expressions");
eq("literal round-trips", run("[[1,2][3,4]]"), "[1 2][3 4]");
eq("comma-separated rows also parse", run("[[1,2],[3,4]]"), "[1 2][3 4]");
eq("store into [A]", run("[[1,2][3,4]]→[A]"), "[1 2][3 4]");
eq("recall [A]", run("[A]"), "[1 2][3 4]");
eq("scalar multiply", run("2[A]"), "[2 4][6 8]");
eq("matrix product", run("[A]*[A]"), "[7 10][15 22]");
eq("addition", run("[A]+[A]"), "[2 4][6 8]");
eq("scalar broadcast add", run("[A]+1"), "[2 3][4 5]");
eq("negation", run("-[A]"), "[-1 -2][-3 -4]");
eq("determinant", run("det([A])"), "-2");
eq("inverse via x⁻¹", run("[A]⁻¹"), "[-2 1][1.5 -.5]");
eq("square via x²", run("[A]²"), "[7 10][15 22]");
eq("transpose", run("[A]ᵀ"), "[1 3][2 4]");
eq("identity(2)", run("identity(2)"), "[1 0][0 1]");
eq("dim returns rows and columns", run("dim([A])"), "{2 2}");
eq("augment", run("augment([A],identity(2))"), "[1 2 1 0][3 4 0 1]");
eq("rref", run("rref([[1,1,5][1,-1,1]])"), "[1 0 3][0 1 2]");
eq("Matr▸list pulls a column", run("Matr▸list([A],2)"), "{2 4}");
eq("List▸matr builds columns", run("List▸matr({1,3},{2,4})"), "[1 2][3 4]");
eq("abs maps element-wise", run("abs(-[A])"), "[1 2][3 4]");

describe("expression errors");
eq("dividing by a matrix", run("1/[A]"), "ERR: DATA TYPE");
eq("undefined matrix", run("[J]"), "ERR: UNDEFINED");
eq("dimension mismatch in a product", run("[A]*[[1,2,3]]"), "ERR: DIM MISMATCH");
eq("singular inverse", run("[[1,2][2,4]]⁻¹"), "ERR: SINGULAR MAT");

describe("solving a system with matrices");
// 2x +  y = 5
//  x - 3y = -8   →  x = 1, y = 3
ok("setup", run("[[2,1][1,-3]]→[B]") !== "");
ok("constants", run("[[5][-8]]→[C]") !== "");
eq("[B]⁻¹[C] gives the solution", run("[B]⁻¹*[C]"), "[1][3]");
eq("rref of the augmented system agrees", run("rref(augment([B],[C]))"), "[1 0 1][0 1 3]");

reportIfMain(import.meta.url);

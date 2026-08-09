import { describe, eq, near, reportIfMain, throws } from "./harness";
import {
  expReg, linReg, lnReg, oneVarStats, pwrReg, quadReg, twoVarStats,
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

reportIfMain(import.meta.url);

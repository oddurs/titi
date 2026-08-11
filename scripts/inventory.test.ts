import { readFileSync } from "node:fs";
import { describe, eq, ok, reportIfMain } from "./harness";
import { FUNCTIONS } from "../lib/math/lexer";
import { MENUS } from "../lib/calc/menus";

/**
 * How much of the device we actually answer to.
 *
 * `docs/ti84-commands.txt` is every function and instruction the guidebook
 * documents. This checks each one against what the engine, the menus and the
 * interpreter know, and requires anything still missing to be listed below
 * with a reason. So the score is a measurement rather than a claim, and a
 * command cannot be quietly forgotten: it is either built or it is written
 * down as not built, and this fails if it is neither.
 *
 * The conformance spec measures something different — how much of what we
 * *chose* to build is done. This measures against the whole device.
 */

/** Not built, and why. Every entry is a decision someone can argue with. */
const NOT_BUILT: Record<string, string> = {};
const because = (reason: string, names: string[]) => {
  for (const n of names) NOT_BUILT[n] = reason;
};

because("there is no second calculator to link to, and no Z80 to run", [
  "Archive", "UnArchive", "Asm(", "AsmComp(", "AsmPrgm", "Get(", "GetCalc(",
  "Send(", "GarbageCollect", "SetUpEditor",
]);
because("inference is a different product from a calculator", [
  "ANOVA(", "χ²-Test(", "χ²GOF-Test(", "LinRegTTest", "LinRegTInt", "TInterval",
  "T-Test", "ZInterval", "Z-Test(", "DiagnosticOff", "DiagnosticOn", "Manual-Fit",
  "Shadeχ²(", "ShadeNorm(", "Shade_t(",
]);
because("the time-value-of-money solver is out of scope, per CLAUDE.md", [
  "bal(", "dbd(", "irr(", "npv(", "Pmt_Bgn", "Pmt_End", "ΣInt(", "ΣPrn(",
]);
because("one panel, so there is nothing to split", ["Full", "G-T", "Horiz"]);
because("curves are drawn in one pass, so there is nothing to interleave", [
  "Sequential", "Simul",
]);
because("the panel is addressed in graph units, not pixels", [
  "Pxl-Change(", "Pxl-Off(", "Pxl-On(", "pxl-Test(",
]);
because("nothing to store a picture or a graph database into", [
  "StorePic", "RecallPic", "StoreGDB", "RecallGDB",
]);

/** Still to build. Kept apart from the above so the two never blur. */
const TODO: Record<string, string> = {};
const planned = (why: string, names: string[]) => {
  for (const n of names) TODO[n] = why;
};

planned("choosing points off a plot, which is interactive", ["Select("]);
planned("the elementary row operations", ["row+(", "rowSwap(", "*row(", "*row+("]);
planned("a clock, which a browser does have", [
  "ClockOff", "ClockOn", "checkTmr(", "dayOfWk(", "getDtStr(", "getTmStr(",
  "setDate(", "setDtFmt(", "setTime(", "setTmFmt(", "timeCnv(", "startTmr",
]);
planned("regression forms the STAT CALC menu does not reach", ["LinReg("]);

// ---------------------------------------------------------------------------

/** Everything the app answers to, by name. */
function implemented(): Set<string> {
  const out = new Set<string>(FUNCTIONS);
  for (const menu of Object.values(MENUS)) {
    for (const tab of menu.tabs) {
      for (const item of tab.items) {
        if (item.insert) out.add(item.insert.trim());
        out.add(item.label.trim());
      }
    }
  }
  const program = readFileSync("lib/math/program.ts", "utf8");
  for (const m of program.matchAll(/"([A-Za-z][A-Za-z0-9-]*\(?)"/g)) out.add(m[1]);
  for (const w of ["Ans", "rand", "and", "or", "xor", "not(", "nPr", "nCr", "i", "e", "°", "′", "″", "ʳ"]) {
    out.add(w);
  }
  return out;
}

const documented = readFileSync("docs/ti84-commands.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const ours = implemented();
const norm = (s: string) => s.replace(/‑/g, "-").toLowerCase();
const have = (name: string) => [...ours].some((o) => norm(o) === norm(name));

describe("the inventory is intact");
ok("it lists the whole device", documented.length > 200, `${documented.length}`);
eq("with nothing listed twice", new Set(documented).size, documented.length);

describe("every documented command is accounted for");
{
  const unexplained: string[] = [];
  for (const name of documented) {
    if (have(name)) continue;
    if (NOT_BUILT[name] || TODO[name]) continue;
    unexplained.push(name);
  }
  eq("nothing is missing without a reason or a plan", unexplained, []);
}
{
  // The other direction: a name cannot be claimed as both built and not.
  const contradictions = documented.filter((n) => have(n) && (NOT_BUILT[n] || TODO[n]));
  eq("nothing is both built and listed as missing", contradictions, []);
}
{
  const reasons = new Set(Object.values(NOT_BUILT));
  ok("every exclusion gives a reason", [...reasons].every((r) => r.length > 20));
  ok("and there are few enough of them to read", reasons.size <= 8, `${reasons.size}`);
}

describe("coverage");
{
  const built = documented.filter(have).length;
  const excluded = documented.filter((n) => !have(n) && NOT_BUILT[n]).length;
  const todo = documented.filter((n) => !have(n) && TODO[n]).length;
  const reachable = documented.length - excluded;
  console.log(
    `    ${built} of ${documented.length} documented commands built ` +
      `(${Math.round((built / documented.length) * 100)}%), ` +
      `${todo} to go, ${excluded} deliberately not — ` +
      `${Math.round((built / reachable) * 100)}% of what is reachable`,
  );
  eq("the three add up to the whole inventory", built + excluded + todo, documented.length);
  ok("most of the device answers", built / documented.length > 0.5);
}

reportIfMain(import.meta.url);

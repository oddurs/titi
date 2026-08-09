import { describe, eq, ok, reportIfMain } from "./harness";
import { GLYPHS, foldForDisplay } from "../lib/display/glyphs";
import { ALL_KEYS, ARROW_KEYS } from "../lib/calc/keys";
import { MENUS } from "../lib/calc/menus";
import { FUNCTIONS } from "../lib/math/lexer";
import { SAMPLE_PROGRAMS } from "../lib/math/program";
import { MODE_ROWS, WINDOW_LABELS } from "../lib/calc/layout";
import { slotLabels } from "../lib/calc/curves";
import { formatNumber, formatValue } from "../lib/math/format";
import {
  expReg, linReg, lnReg, oneVarStats, pwrReg, quadReg, twoVarStats,
} from "../lib/math/stats";

/**
 * The panel can only draw what the ROM holds. Rather than trusting a reading
 * of the code, this walks every string the app can put on screen and asserts
 * each character has a glyph — so adding a menu item or a stat label with a
 * new symbol fails here rather than showing up as a blank cell.
 */

const plain = { notation: "normal" as const, decimals: -1 };

/** Everything that can reach the panel. */
function collectSources(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, text?: string | null) => {
    if (text) out.push({ where, text });
  };

  for (const k of [...ALL_KEYS, ...ARROW_KEYS]) {
    add(`key ${k.id} label`, k.label);
    add(`key ${k.id} 2nd`, k.second);
    add(`key ${k.id} alpha`, k.alpha);
    add(`key ${k.id} ins`, k.ins);
    add(`key ${k.id} ins2`, k.ins2);
  }

  for (const [name, def] of Object.entries(MENUS)) {
    add(`menu ${name} title`, def.title);
    for (const tab of def.tabs) {
      add(`menu ${name} tab`, tab.name);
      for (const item of tab.items) {
        add(`menu ${name} item`, item.label);
        add(`menu ${name} insert`, item.insert);
        add(`menu ${name} hint`, item.hint);
      }
    }
  }

  for (const f of FUNCTIONS) add("lexer function", f);
  for (const p of SAMPLE_PROGRAMS) {
    add(`program ${p.name} name`, p.name);
    add(`program ${p.name} body`, p.body);
  }

  for (const row of MODE_ROWS) {
    add("mode hint", row.hint);
    for (const c of row.choices) add("mode choice", c.label);
  }
  for (const label of Object.values(WINDOW_LABELS)) add("window label", label);
  for (const mode of ["func", "par", "pol"] as const) {
    for (const l of slotLabels(mode)) add(`slot ${mode}`, l);
  }
  add("polar window label", "θmin θmax θstep");

  // Statistics put the widest range of symbols on screen.
  const xs = [1, 2, 3, 4];
  const ys = [3, 5, 7, 9];
  const reports = [
    oneVarStats(ys),
    twoVarStats(xs, ys),
    linReg(xs, ys),
    quadReg(xs, ys),
    expReg(xs, ys),
    lnReg(xs, ys),
    pwrReg(xs, ys),
  ];
  for (const r of reports) {
    add("stat title", r.title);
    for (const row of r.rows) {
      add("stat label", row.label);
      add("stat value", row.value);
      add("stat hint", row.hint);
    }
    add("stat expr", r.expr);
  }

  // Numbers, including the shapes only the formatter produces.
  for (const v of [
    0, 1, -1, 0.5, -0.5, 1 / 3, 1e12, -1e-9, 1234567890, Infinity, -Infinity, NaN,
  ]) {
    add("formatted number", formatNumber(v, plain));
  }
  add("formatted list", formatValue([1, -2.5, 3], plain));
  add("formatted sci", formatNumber(6.02e23, { notation: "sci", decimals: 2 }));
  add("formatted eng", formatNumber(0.000123, { notation: "eng", decimals: -1 }));

  // Every error string the engine and interpreter can raise.
  for (const e of [
    "ERR: SYNTAX", "ERR: DOMAIN", "ERR: NONREAL ANS", "ERR: DIVIDE BY 0",
    "ERR: DATA TYPE", "ERR: DIM MISMATCH", "ERR: INVALID DIM", "ERR: SINGULAR MAT",
    "ERR: UNDEFINED", "ERR: ARGUMENT", "ERR: LABEL", "ERR: ITERATIONS",
    "ERR: MEMORY", "ERR: NO SIGN CHNG", "ERR: INVALID", "ERR: NO FUNCTIONS",
    "ERR: NO EXTREMUM", "ERR: NEED 2 FUNCTIONS", "ERR: NO INTERSECTION",
    "ERR: NOT A FRACTION", "CALC needs Func mode", "Lists cleared",
    "RAM cleared", "Drag a box on the graph",
    "Move to the lower limit, then press enter",
    "Move to the upper limit, then press enter",
  ]) {
    add("message", e);
  }

  // Panel literals.
  for (const s of [
    "HOME", "GRAPH", "Y=", "WINDOW", "TABLE", "TBLSET", "MODE", "LIST",
    "MATRIX", "PRGM EDIT", "PRGM", "FORMAT", "READY", "TRACE", "RAD", "DEG",
    "PAR", "POL", "2ND", "A", "NO FUNCTIONS", "PRESS Y= TO ENTER ONE",
    "SET DIMENSIONS", "PROGRAM:", "PAUSED - PRESS ENTER", "PRESS ENTER",
    "DONE", "TblStart", "ΔTbl", "dy/dx", "∫f(x)dx", "X=", "Y=", "T=", "θ=",
    "x", "[", "]", "<", ">", ":",
  ]) {
    add("panel literal", s);
  }

  // Expressions a user can build from the keypad, echoed back on the tape.
  for (const s of [
    "2+3×4", "√(9)+3^4", "sin⁻¹(.5)", "X²-4", "5→A", "[[1,2][3,4]]",
    "det([A])", "[A]⁻¹", "[A]ᵀ", "{1,2,3}", "3ˣ√(8)", "Matr▸list([A],2)",
    "1.2ᴇ-5", "ℯ^(2)", "π÷6", "θ", "A≠B", "A≤B", "A≥B", "Σ", "∛(27)",
  ]) {
    add("expression", s);
  }

  return out;
}

describe("character ROM coverage");
const sources = collectSources();
const missing = new Map<string, string>();
for (const { where, text } of sources) {
  for (const ch of foldForDisplay(text)) {
    if (ch === " " || ch === "\n") continue;
    if (!GLYPHS[ch] && !missing.has(ch)) missing.set(ch, where);
  }
}
ok(
  `every character the app emits has a glyph (${sources.length} strings checked)`,
  missing.size === 0,
  missing.size
    ? [...missing.entries()]
        .map(([ch, where]) => `  ${JSON.stringify(ch)} U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}  first seen in ${where}`)
        .join("\n")
    : "",
);

describe("ROM shape");
for (const [ch, rows] of Object.entries(GLYPHS)) {
  if (rows.length !== 7) {
    ok(`${ch} has 7 rows`, false, `got ${rows.length}`);
  } else if (rows.some((r) => r.length !== 5)) {
    ok(`${ch} rows are 5 wide`, false, `got ${rows.map((r) => r.length).join(",")}`);
  } else if (rows.some((r) => /[^.#]/.test(r))) {
    ok(`${ch} uses only . and #`, false, rows.join("|"));
  } else {
    ok(`${ch} is well formed`, true);
  }
}

describe("printable ASCII is complete");
const asciiMissing: string[] = [];
for (let code = 33; code <= 126; code++) {
  const ch = String.fromCharCode(code);
  if (!GLYPHS[ch]) asciiMissing.push(ch);
}
eq("no gaps in printable ASCII", asciiMissing, []);

describe("folding");
eq("subscripts fold to digits", foldForDisplay("L₁ Y₆ X₁ₜ"), "L1 Y6 X1T");
eq("plain text is untouched", foldForDisplay("sin(X)"), "sin(X)");

reportIfMain(import.meta.url);

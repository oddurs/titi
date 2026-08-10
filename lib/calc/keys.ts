export type KeyRole =
  | "mod2nd"
  | "modalpha"
  | "soft"
  | "control"
  | "fn"
  | "digit"
  | "op"
  | "enter";

export interface KeyDef {
  id: string;
  /** face label */
  label: string;
  /** blue label printed above-left */
  second?: string;
  /** green label printed above-right */
  alpha?: string;
  role: KeyRole;
  /** text inserted at the caret on a plain press */
  ins?: string;
  /** text inserted when 2nd is active */
  ins2?: string;
  /** named action on a plain press (takes precedence over ins) */
  act?: string;
  /** named action when 2nd is active */
  act2?: string;
  /** text inserted when alpha is active; defaults to the alpha label */
  insA?: string;
}

/**
 * The TI-84 Plus faceplate, row by row. Rows 2–3 leave columns 4–5 empty —
 * the arrow cluster is rendered over that gap.
 */
export const KEY_ROWS: (KeyDef | null)[][] = [
  [
    { id: "yeq", label: "y=", second: "stat plot", role: "soft", act: "screen:yeq", act2: "menu:statplot" },
    { id: "window", label: "window", second: "tblset", role: "soft", act: "screen:window", act2: "screen:tblset" },
    { id: "zoom", label: "zoom", second: "format", role: "soft", act: "menu:zoom", act2: "screen:format" },
    { id: "trace", label: "trace", second: "calc", role: "soft", act: "trace", act2: "menu:calc" },
    { id: "graph", label: "graph", second: "table", role: "soft", act: "screen:graph", act2: "screen:table" },
  ],
  [
    { id: "2nd", label: "2nd", role: "mod2nd", act: "mod:2nd" },
    { id: "mode", label: "mode", second: "quit", role: "control", act: "screen:mode", act2: "quit" },
    { id: "del", label: "del", second: "ins", role: "control", act: "del", act2: "insertMode" },
    null,
    null,
  ],
  [
    { id: "alpha", label: "alpha", second: "A‑lock", role: "modalpha", act: "mod:alpha", act2: "mod:alphalock" },
    // Inserts whichever variable the current graph mode is written in.
    { id: "xtn", label: "X,T,θ,n", second: "link", role: "control", act: "xtn", act2: "noop" },
    { id: "stat", label: "stat", second: "list", role: "control", act: "menu:stat", act2: "menu:list" },
    null,
    null,
  ],
  [
    { id: "math", label: "math", second: "test", alpha: "A", role: "control", act: "menu:math", act2: "menu:test" },
    { id: "apps", label: "apps", second: "angle", alpha: "B", role: "control", act: "menu:apps", act2: "menu:angle" },
    { id: "prgm", label: "prgm", second: "draw", alpha: "C", role: "control", act: "menu:prgm", act2: "menu:draw" },
    { id: "vars", label: "vars", second: "distr", role: "control", act: "menu:vars", act2: "menu:distr" },
    { id: "clear", label: "clear", role: "control", act: "clear" },
  ],
  [
    { id: "inv", label: "x⁻¹", second: "matrix", alpha: "D", role: "fn", ins: "⁻¹", act2: "menu:matrix" },
    { id: "sin", label: "sin", second: "sin⁻¹", alpha: "E", role: "fn", ins: "sin(", ins2: "sin⁻¹(" },
    { id: "cos", label: "cos", second: "cos⁻¹", alpha: "F", role: "fn", ins: "cos(", ins2: "cos⁻¹(" },
    { id: "tan", label: "tan", second: "tan⁻¹", alpha: "G", role: "fn", ins: "tan(", ins2: "tan⁻¹(" },
    { id: "pow", label: "^", second: "π", alpha: "H", role: "op", ins: "^", ins2: "π" },
  ],
  [
    { id: "sq", label: "x²", second: "√", alpha: "I", role: "fn", ins: "²", ins2: "√(" },
    { id: "comma", label: ",", second: "ᴇ", alpha: "J", role: "op", ins: ",", ins2: "ᴇ" },
    { id: "lparen", label: "(", second: "{", alpha: "K", role: "op", ins: "(", ins2: "{" },
    { id: "rparen", label: ")", second: "}", alpha: "L", role: "op", ins: ")", ins2: "}" },
    { id: "div", label: "÷", second: "ℯ", alpha: "M", role: "op", ins: "÷", ins2: "ℯ" },
  ],
  [
    { id: "log", label: "log", second: "10ˣ", alpha: "N", role: "fn", ins: "log(", ins2: "10^(" },
    { id: "d7", label: "7", second: "u", alpha: "O", role: "digit", ins: "7", ins2: "u(" },
    { id: "d8", label: "8", second: "v", alpha: "P", role: "digit", ins: "8", ins2: "v(" },
    { id: "d9", label: "9", second: "w", alpha: "Q", role: "digit", ins: "9", ins2: "w(" },
    { id: "mul", label: "×", second: "[", alpha: "R", role: "op", ins: "×", ins2: "[" },
  ],
  [
    { id: "ln", label: "ln", second: "ℯˣ", alpha: "S", role: "fn", ins: "ln(", ins2: "ℯ^(" },
    { id: "d4", label: "4", second: "L₄", alpha: "T", role: "digit", ins: "4", ins2: "L₄" },
    { id: "d5", label: "5", second: "L₅", alpha: "U", role: "digit", ins: "5", ins2: "L₅" },
    { id: "d6", label: "6", second: "L₆", alpha: "V", role: "digit", ins: "6", ins2: "L₆" },
    { id: "sub", label: "−", second: "]", alpha: "W", role: "op", ins: "−", ins2: "]" },
  ],
  [
    { id: "sto", label: "sto▸", second: "rcl", alpha: "X", role: "control", ins: "→", act2: "recall" },
    { id: "d1", label: "1", second: "L₁", alpha: "Y", role: "digit", ins: "1", ins2: "L₁" },
    { id: "d2", label: "2", second: "L₂", alpha: "Z", role: "digit", ins: "2", ins2: "L₂" },
    { id: "d3", label: "3", second: "L₃", alpha: "θ", role: "digit", ins: "3", ins2: "L₃" },
    { id: "add", label: "+", second: "mem", alpha: '"', role: "op", ins: "+", act2: "menu:mem" },
  ],
  [
    { id: "on", label: "on", second: "off", role: "control", act: "reset" },
    { id: "d0", label: "0", second: "catalog", alpha: "␣", role: "digit", ins: "0", act2: "menu:catalog" },
    { id: "dot", label: ".", second: "i", alpha: ":", role: "digit", ins: ".", ins2: "i" },
    { id: "neg", label: "(−)", second: "ans", alpha: "?", role: "digit", ins: "-", ins2: "Ans" },
    { id: "enter", label: "enter", second: "entry", alpha: "solve", role: "enter", act: "enter", act2: "lastEntry" },
  ],
];

export const ALL_KEYS: KeyDef[] = KEY_ROWS.flat().filter(
  (k): k is KeyDef => k !== null,
);

export const ARROW_KEYS: KeyDef[] = [
  { id: "up", label: "▲", second: "lighter", role: "control", act: "up", act2: "contrast:up" },
  { id: "left", label: "◀", role: "control", act: "left" },
  { id: "right", label: "▶", role: "control", act: "right" },
  { id: "down", label: "▼", second: "darker", role: "control", act: "down", act2: "contrast:down" },
];

const BY_ID = new Map<string, KeyDef>(
  [...ALL_KEYS, ...ARROW_KEYS].map((k) => [k.id, k]),
);
export const keyById = (id: string) => BY_ID.get(id);

/** Physical keyboard → device key. Typing on a laptop should just work. */
export const KEYBOARD_MAP: Record<string, string> = {
  "0": "d0", "1": "d1", "2": "d2", "3": "d3", "4": "d4",
  "5": "d5", "6": "d6", "7": "d7", "8": "d8", "9": "d9",
  ".": "dot", "+": "add", "-": "sub", "*": "mul", "/": "div",
  "^": "pow", "(": "lparen", ")": "rparen", ",": "comma",
  Enter: "enter", Backspace: "del", Delete: "del", Escape: "quit",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
};

/**
 * Where every key sits, for moving focus between them.
 *
 * Fifty buttons would otherwise be fifty tab stops in front of everything else
 * on the page. The keypad is one stop instead and the arrows move inside it,
 * which is how a grid of controls is meant to behave — and happens to be how
 * the plastic one works too. The arrow cluster is a row of its own below the
 * keypad proper, so it can be reached the same way.
 */
export const NAV: { id: string; row: number; col: number }[] = [
  ...KEY_ROWS.flatMap((row, r) =>
    row.flatMap((k, c) => (k ? [{ id: k.id, row: r, col: c }] : [])),
  ),
  ...ARROW_KEYS.map((a, i) => ({ id: a.id, row: KEY_ROWS.length, col: i })),
];

/** The key nearest in the given direction, or the same one at an edge. */
export function stepFocus(fromId: string, dRow: number, dCol: number): string {
  const from = NAV.find((n) => n.id === fromId) ?? NAV[0];
  if (dCol) {
    const inRow = NAV.filter((n) => n.row === from.row).sort((a, b) => a.col - b.col);
    const at = inRow.findIndex((n) => n.id === from.id);
    return inRow[Math.min(inRow.length - 1, Math.max(0, at + dCol))].id;
  }
  // Vertically, take the nearest column in the first row that has anything —
  // the grid has gaps, so the row below is not always the row below.
  for (let r = from.row + dRow; r >= 0 && r <= KEY_ROWS.length; r += dRow) {
    const candidates = NAV.filter((n) => n.row === r);
    if (!candidates.length) continue;
    return candidates.reduce((best, n) =>
      Math.abs(n.col - from.col) < Math.abs(best.col - from.col) ? n : best,
    ).id;
  }
  return from.id;
}

/**
 * The code `getKey` reports for each key.
 *
 * The device numbers by position — ten times the row, plus the column, both
 * counted from one — so this is derived from the faceplate rather than typed
 * out again. The arrow cluster sits outside the grid and keeps the codes the
 * device gives it.
 */
const ARROW_CODES: Record<string, number> = { up: 25, left: 24, right: 26, down: 34 };

export const KEY_CODES: Record<string, number> = (() => {
  const out: Record<string, number> = { ...ARROW_CODES };
  KEY_ROWS.forEach((row, r) => {
    row.forEach((k, c) => {
      if (k) out[k.id] = (r + 1) * 10 + (c + 1);
    });
  });
  return out;
})();

export const keyCode = (id: string) => KEY_CODES[id] ?? 0;

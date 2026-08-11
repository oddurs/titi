import { ALL_KEYS, ARROW_KEYS } from "./keys";

/**
 * Guided tours of the device, as data.
 *
 * The store's `press` is the only way input reaches the calculator, so a demo
 * is just a list of keys with something to say about each group of them. That
 * keeps a tour honest: it drives the real device through the real keypad, so a
 * demo that still runs is a feature that still works.
 *
 * Keys are named by the label printed on them, and `2nd quit` arms the
 * modifier first — the same way the test harness reads, and the same way a
 * person would describe it out loud.
 */

export interface DemoStep {
  /** what this group of keys is for, shown while it runs */
  say: string;
  keys: string[];
  /** extra time to sit on the result, for the ones worth looking at */
  hold?: number;
}

export interface Demo {
  id: string;
  name: string;
  blurb: string;
  steps: DemoStep[];
}

export const DEMOS: Demo[] = [
  {
    id: "rose",
    name: "Polar rose",
    blurb: "MODE decides what the six Y= slots mean. In Pol they are radii.",
    steps: [
      { say: "MODE, then across to Pol", keys: ["mode", "right", "right"] },
      { say: "2nd QUIT to leave the mode screen", keys: ["2nd quit"] },
      { say: "Y= is now r₁, not Y₁", keys: ["y="] },
      { say: "r₁ = 4sin(3θ) — the X,T,θ,n key types θ here", keys: ["4", "sin", "3", "X,T,θ,n", ")"] },
      { say: "Commit the slot", keys: ["enter"] },
      { say: "Three petals", keys: ["graph"], hold: 2200 },
    ],
  },
  {
    id: "zero",
    name: "Trace and find a zero",
    blurb: "It computes rather than plots: CALC finds the root exactly.",
    steps: [
      { say: "Y₁ = X²−4", keys: ["y=", "X,T,θ,n", "x²", "−", "4", "enter"] },
      { say: "Draw it", keys: ["graph"], hold: 900 },
      { say: "TRACE walks the curve, reading out X and Y", keys: ["trace"] },
      {
        say: "Hold ▶ to move along it",
        keys: Array(20).fill("right"),
        hold: 700,
      },
      { say: "2nd CALC — the analysis menu", keys: ["2nd calc"], hold: 700 },
      { say: "Choose zero", keys: ["down", "enter"], hold: 2400 },
    ],
  },
  {
    id: "integral",
    name: "Shade an integral",
    blurb: "Pick two limits on the curve and it hatches the area between them.",
    steps: [
      { say: "Y₁ = X²−4 again", keys: ["y=", "X,T,θ,n", "x²", "−", "4", "enter", "graph"] },
      { say: "Trace back to the left", keys: ["trace", ...Array(6).fill("left")] },
      { say: "2nd CALC, then ∫f(x)dx", keys: ["2nd calc", ...Array(6).fill("down"), "enter"] },
      { say: "ENTER sets the lower limit", keys: ["enter"] },
      { say: "Walk to the upper limit", keys: Array(12).fill("right") },
      { say: "ENTER closes the region", keys: ["enter"], hold: 2600 },
    ],
  },
  {
    id: "stats",
    name: "Fit a line to data",
    blurb: "Type a list, plot it, and the regression writes itself into Y₁.",
    steps: [
      { say: "STAT, then Edit to open the list editor", keys: ["stat", "enter"] },
      { say: "L₁ — the x values", keys: ["1", "enter", "2", "enter", "3", "enter", "4", "enter", "5", "enter"] },
      { say: "Across to L₂ — the y values", keys: ["right"] },
      { say: "Roughly a line, with noise", keys: ["3", "enter", "5", "enter", "8", "enter", "9", "enter", "12", "enter"] },
      { say: "Back out", keys: ["2nd quit"] },
      { say: "2nd STAT PLOT, and switch Plot1 on as a scatter", keys: ["2nd stat plot", "down", "enter"], hold: 1400 },
      { say: "STAT ▸ CALC ▸ LinReg", keys: ["stat", "right", "down", "down", "enter"], hold: 2000 },
      { say: "The fit went into Y₁ — draw both", keys: ["graph"], hold: 2600 },
    ],
  },
  {
    id: "draw",
    name: "Draw on the graph",
    blurb: "DRAW puts a circle, a line and a label on top of whatever is plotted.",
    steps: [
      { say: "Y₁ = X²−4", keys: ["y=", "X,T,θ,n", "x²", "−", "4", "enter", "graph"] },
      { say: "2nd DRAW ▸ Circle(", keys: ["2nd draw", "down", "down", "down", "down", "enter"] },
      { say: "ENTER puts the centre where the cursor is", keys: ["enter"] },
      { say: "Move out to the rim and ENTER", keys: [...Array(14).fill("right"), "enter"], hold: 2400 },
    ],
  },
  {
    id: "program",
    name: "Run a program",
    blurb: "SHAPES offers a menu, then draws what you picked.",
    steps: [
      { say: "PRGM lists what is stored", keys: ["prgm"], hold: 900 },
      { say: "Down to SHAPES", keys: ["down", "down", "down"] },
      { say: "Run it — the program's menu is the device's menu", keys: ["enter"], hold: 1600 },
      { say: "Pick the wave", keys: ["down", "enter"], hold: 1200 },
      { say: "It drew onto the graph", keys: ["graph"], hold: 2600 },
    ],
  },
];

/** Every key on the faceplate, by the label printed on it. */
const BY_LABEL = new Map<string, string>();
for (const k of [...ALL_KEYS, ...ARROW_KEYS]) BY_LABEL.set(k.id, k.id);
for (const k of [...ALL_KEYS, ...ARROW_KEYS]) {
  if (!BY_LABEL.has(k.label)) BY_LABEL.set(k.label, k.id);
}
for (const k of [...ALL_KEYS, ...ARROW_KEYS]) {
  if (k.second && !BY_LABEL.has(k.second)) BY_LABEL.set(k.second, k.id);
  if (k.alpha && !BY_LABEL.has(k.alpha)) BY_LABEL.set(k.alpha, k.id);
}
for (const [alias, id] of [
  ["−", "sub"], ["0", "d0"], ["1", "d1"], ["2", "d2"], ["3", "d3"], ["4", "d4"],
  ["5", "d5"], ["6", "d6"], ["7", "d7"], ["8", "d8"], ["9", "d9"],
  [")", "rparen"], ["(", "lparen"],
] as const) {
  BY_LABEL.set(alias, id);
}

/**
 * Turn one written key into the presses it takes.
 *
 * `2nd calc` is two presses, and `12` is two digits — writing a demo should
 * read like describing it, not like listing key ids.
 */
export function pressesFor(key: string): string[] {
  for (const mod of ["2nd", "alpha"]) {
    if (key.startsWith(`${mod} `)) {
      return [mod, ...pressesFor(key.slice(mod.length + 1))];
    }
  }
  const direct = BY_LABEL.get(key);
  if (direct) return [direct];
  // A run of digits, so a demo can say "12" rather than "1", "2".
  if (/^\d+$/.test(key)) return [...key].map((d) => BY_LABEL.get(d)!);
  throw new Error(`no key labelled ${JSON.stringify(key)}`);
}

/** Every press a demo makes, in order. */
export const pressesIn = (demo: Demo): string[] =>
  demo.steps.flatMap((s) => s.keys.flatMap(pressesFor));

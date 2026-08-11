import type { Modes, TableSetup } from "./types";

/**
 * The settings, as commands.
 *
 * On the device every MODE and FORMAT choice is also an instruction you can
 * type or put in a program — a program that wants a polar graph says `Polar`,
 * it does not ask you to go and set it. The settings themselves already exist
 * and are already honoured; this is the table that gives each of them a name,
 * read by both the home screen and the interpreter so the two cannot drift.
 *
 * Adding a setting should mean adding a line here, not a branch anywhere.
 */

export interface ModeChange {
  modes?: Partial<Modes>;
  tbl?: Partial<TableSetup>;
}

/** The bare-word instructions: the whole line is the command. */
export const MODE_COMMANDS: Record<string, ModeChange> = {
  // number display
  Normal: { modes: { notation: "normal" } },
  Sci: { modes: { notation: "sci" } },
  Eng: { modes: { notation: "eng" } },
  Float: { modes: { decimals: -1 } },

  // angles
  Radian: { modes: { angle: "rad" } },
  Degree: { modes: { angle: "deg" } },

  // what the Y= slots mean
  Func: { modes: { graphMode: "func" } },
  Param: { modes: { graphMode: "par" } },
  Polar: { modes: { graphMode: "pol" } },
  Seq: { modes: { graphMode: "seq" } },

  // complex
  Real: { modes: { complex: "real" } },
  "a+bi": { modes: { complex: "a+bi" } },

  // how a curve is drawn
  Connected: { modes: { connected: true } },
  Dot: { modes: { connected: false } },

  // what else is on the graph
  AxesOn: { modes: { axes: true } },
  AxesOff: { modes: { axes: false } },
  LabelOn: { modes: { labelAxes: true } },
  LabelOff: { modes: { labelAxes: false } },
  GridOn: { modes: { grid: true } },
  GridOff: { modes: { grid: false } },
  CoordOn: { modes: { coordsOn: true } },
  CoordOff: { modes: { coordsOn: false } },
  ExprOn: { modes: { exprOn: true } },
  ExprOff: { modes: { exprOn: false } },
  RectGC: { modes: { coordFmt: "rect" } },
  PolarGC: { modes: { coordFmt: "polar" } },

  // the table
  IndpntAuto: { tbl: { auto: true } },
  IndpntAsk: { tbl: { auto: false } },
  DependAuto: { modes: { depend: "auto" } },
  DependAsk: { modes: { depend: "ask" } },
};

/**
 * `Fix 2` is the one that takes an argument, and the digit may be written
 * against the word or after a space.
 */
export function parseModeCommand(line: string): ModeChange | null {
  const src = line.trim();
  if (src in MODE_COMMANDS) return MODE_COMMANDS[src];

  const fix = /^Fix\s*(\d)$/.exec(src);
  if (fix) return { modes: { decimals: Number(fix[1]) } };

  return null;
}

/** Every name this module answers to, for the catalog and for the tests. */
export const MODE_COMMAND_NAMES = [...Object.keys(MODE_COMMANDS), "Fix"];

/**
 * Instructions that do something to the device rather than set a mode.
 *
 * Only the shape lives here — the name, and how many arguments it takes. What
 * each one *does* needs the store, and the store is not something this module
 * is allowed to know about, so it keeps the behaviour and reads the shapes.
 */
export const DEVICE_COMMANDS: Record<string, { args: [number, number] }> = {
  DispGraph: { args: [0, 0] },
  DispTable: { args: [0, 0] },
  ClrTable: { args: [0, 0] },
  ZoomStat: { args: [0, 0] },
  ZPrevious: { args: [0, 0] },
  FnOn: { args: [0, 6] },
  FnOff: { args: [0, 6] },
  PlotsOn: { args: [0, 3] },
  PlotsOff: { args: [0, 3] },
  "GraphStyle(": { args: [2, 2] },
  "Pt-Change(": { args: [2, 2] },
};

export const DEVICE_COMMAND_NAMES = Object.keys(DEVICE_COMMANDS);

/** The instruction on this line, with its arguments still unevaluated. */
export function parseDeviceCommand(
  line: string,
): { name: string; args: string[] } | null {
  const src = line.trim();
  for (const name of DEVICE_COMMAND_NAMES) {
    if (name.endsWith("(")) {
      if (!src.startsWith(name)) continue;
      const inner = src.slice(name.length).replace(/\)$/, "");
      return { name, args: splitArgs(inner) };
    }
    if (src !== name && !src.startsWith(`${name} `)) continue;
    return { name, args: splitArgs(src.slice(name.length)) };
  }
  return null;
}

/** Commas at the top level only, so Pt-Change(A,sum({1,2})) still splits in two. */
function splitArgs(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "{" || c === "[") depth += 1;
    else if (c === ")" || c === "}" || c === "]") depth -= 1;
    else if (c === "," && depth === 0) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  out.push(src.slice(start));
  return out.map((a) => a.trim()).filter((a) => a !== "");
}

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

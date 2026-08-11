import type { Modes } from "./types";

/**
 * Screen layout descriptions — which fields a screen shows and what they are
 * called. Kept out of the store so the display layer can read them without
 * pulling in zustand.
 */

export const WINDOW_FIELDS = [
  "nmin", "nmax",
  "tmin", "tmax", "tstep",
  "xmin", "xmax", "xscl", "ymin", "ymax", "yscl", "xres",
] as const;

const PLOT_FIELDS = WINDOW_FIELDS.slice(5);

/** Each mode shows only the bounds it actually uses. */
export const visibleWindowFields = (mode: Modes["graphMode"]) => {
  if (mode === "seq") return [...WINDOW_FIELDS.slice(0, 2), ...PLOT_FIELDS];
  if (mode === "func") return PLOT_FIELDS;
  return [...WINDOW_FIELDS.slice(2, 5), ...PLOT_FIELDS];
};
export type WindowField = (typeof WINDOW_FIELDS)[number];

export const WINDOW_LABELS: Record<WindowField, string> = {
  xmin: "Xmin", xmax: "Xmax", xscl: "Xscl",
  ymin: "Ymin", ymax: "Ymax", yscl: "Yscl", xres: "Xres",
  tmin: "Tmin", tmax: "Tmax", tstep: "Tstep",
  nmin: "nMin", nmax: "nMax",
};

/** Polar mode calls the same three fields θ rather than T. */
export const windowLabel = (
  field: WindowField,
  mode: Modes["graphMode"],
): string =>
  mode === "pol" && field.startsWith("t")
    ? WINDOW_LABELS[field].replace("T", "θ")
    : WINDOW_LABELS[field];

export interface ModeOption {
  key: keyof Modes;
  choices: { value: Modes[keyof Modes]; label: string }[];
  hint: string;
}

export const ALL_MODE_ROWS: ModeOption[] = [
  {
    key: "graphMode",
    hint: "what the Y= slots mean",
    choices: [
      { value: "func", label: "Func" },
      { value: "par", label: "Param" },
      { value: "pol", label: "Polar" },
      { value: "seq", label: "Seq" },
    ],
  },
  {
    key: "notation",
    hint: "how answers are written",
    choices: [
      { value: "normal", label: "Normal" },
      { value: "sci", label: "Sci" },
      { value: "eng", label: "Eng" },
    ],
  },
  {
    key: "decimals",
    hint: "digits after the point",
    choices: [
      { value: -1, label: "Float" },
      ...Array.from({ length: 10 }, (_, i) => ({ value: i, label: String(i) })),
    ],
  },
  {
    key: "angle",
    hint: "unit for trigonometry",
    choices: [
      { value: "rad", label: "Radian" },
      { value: "deg", label: "Degree" },
    ],
  },
  {
    key: "complex",
    hint: "answers outside the reals",
    choices: [
      { value: "real", label: "Real" },
      { value: "a+bi", label: "a+bi" },
    ],
  },
  {
    key: "connected",
    hint: "curve drawing",
    choices: [
      { value: true, label: "Connected" },
      { value: false, label: "Dot" },
    ],
  },
  {
    key: "grid",
    hint: "background rulings",
    choices: [
      { value: true, label: "Grid on" },
      { value: false, label: "Grid off" },
    ],
  },
  {
    key: "labelAxes",
    hint: "x and y captions",
    choices: [
      { value: true, label: "Labels on" },
      { value: false, label: "Labels off" },
    ],
  },
  {
    key: "coordsOn",
    hint: "readout under the cursor",
    choices: [
      { value: true, label: "Coords on" },
      { value: false, label: "Coords off" },
    ],
  },
  {
    key: "axes",
    hint: "the axes themselves",
    choices: [
      { value: true, label: "Axes on" },
      { value: false, label: "Axes off" },
    ],
  },
  {
    key: "exprOn",
    hint: "name the function while tracing",
    choices: [
      { value: true, label: "Expr on" },
      { value: false, label: "Expr off" },
    ],
  },
  {
    key: "coordFmt",
    hint: "which pair the trace reads out",
    choices: [
      { value: "rect", label: "RectGC" },
      { value: "polar", label: "PolarGC" },
    ],
  },
  {
    key: "depend",
    hint: "does the table fill its Y columns",
    choices: [
      { value: "auto", label: "Depend Auto" },
      { value: "ask", label: "Depend Ask" },
    ],
  },
];

/** One editable row per line of the solver screen. */
export interface SolverRow {
  kind: "equation" | "var" | "lower" | "upper";
  label: string;
  value: string;
  /** set for kind "var" */
  name?: string;
  /** the variable being solved for */
  isTarget?: boolean;
}

import type { SolverState } from "./types";
import { formatNumber } from "../math/format";

export function solverRows(s: SolverState): SolverRow[] {
  const plain = { notation: "normal" as const, decimals: -1 };
  const rows: SolverRow[] = [
    { kind: "equation", label: "0=", value: s.equation },
  ];
  for (const name of Object.keys(s.values)) {
    rows.push({
      kind: "var",
      label: `${name}=`,
      value: formatNumber(s.values[name], plain),
      name,
      isTarget: name === s.target,
    });
  }
  rows.push({ kind: "lower", label: "bound{", value: formatNumber(s.bound[0], plain) });
  rows.push({ kind: "upper", label: "bound}", value: formatNumber(s.bound[1], plain) });
  return rows;
}

/**
 * The device splits these across two screens: MODE is what the numbers and
 * the slots mean, FORMAT is what the graph looks like. They share one row
 * description because they are edited identically.
 */
const FORMAT_KEYS = [
  "grid", "axes", "labelAxes", "coordsOn", "exprOn", "coordFmt", "connected",
  "depend",
] as const;

export const MODE_ROWS = ALL_MODE_ROWS.filter(
  (r) => !FORMAT_KEYS.includes(r.key as (typeof FORMAT_KEYS)[number]),
);

export const FORMAT_ROWS = ALL_MODE_ROWS.filter((r) =>
  FORMAT_KEYS.includes(r.key as (typeof FORMAT_KEYS)[number]),
);

/** The rows a given screen edits. */
export const modeRowsFor = (screen: "mode" | "format") =>
  screen === "format" ? FORMAT_ROWS : MODE_ROWS;

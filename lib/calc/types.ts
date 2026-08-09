import type { NotationMode } from "../math/format";

export interface SolverState {
  equation: string;
  /** variable name → value; the target's value is the answer */
  values: Record<string, number>;
  target: string;
  bound: [number, number];
  /** how far the equation is from zero at the answer, once solved */
  residual: number | null;
}

export interface PrgmRun {
  name: string;
  output: string[];
  /** what the interpreter is waiting for, if anything */
  status: "input" | "pause" | "done" | "error";
  prompt?: string;
  message?: string;
}

export type ScreenId =
  | "home"
  | "graph"
  | "yeq"
  | "window"
  | "table"
  | "tblset"
  | "mode"
  | "stat"
  | "matrix"
  | "prgm"
  | "prgmrun"
  | "solver"
  | "format";

export type Modifier = "none" | "2nd" | "alpha" | "alpha-lock";

export interface Entry {
  text: string;
  caret: number;
}

export interface HistoryItem {
  id: number;
  input: string;
  output: string;
  isError: boolean;
  /** set when the answer was a matrix, so the tape can lay it out as a grid */
  rows?: string[][];
}

export type PlotStyle = "line" | "thick" | "dot";

export interface YFunction {
  id: string;
  /** display name, e.g. "Y₁" */
  name: string;
  expr: string;
  on: boolean;
  /** index into PLOT_COLORS */
  color: number;
  style: PlotStyle;
}

export interface GraphWindow {
  xmin: number;
  xmax: number;
  xscl: number;
  ymin: number;
  ymax: number;
  yscl: number;
  xres: number;
  /** parameter bounds for parametric and polar modes (T and θ share them) */
  tmin: number;
  tmax: number;
  tstep: number;
  /** index bounds for sequence mode */
  nmin: number;
  nmax: number;
}

export interface TableSetup {
  start: number;
  step: number;
  auto: boolean;
}

export interface Modes {
  graphMode: "func" | "par" | "pol" | "seq";
  angle: "rad" | "deg";
  complex: "real" | "a+bi";
  notation: NotationMode;
  decimals: number;
  connected: boolean;
  labelAxes: boolean;
  grid: boolean;
  coordsOn: boolean;
}

export interface TraceState {
  fn: number;
  x: number;
}

export interface CalcMark {
  kind: "point" | "area" | "tangent";
  label: string;
  x: number;
  y: number;
  /** for ∫f(x)dx shading */
  x2?: number;
  /** for dy/dx */
  slope?: number;
  fn: number;
}

/**
 * Something the user put on the graph by hand.
 *
 * Drawings sit above the curves and outlive a redraw, but not ClrDraw — the
 * same deal the device offers. They are deliberately not saved: a drawing is
 * about the window it was made in, and restoring one into a different window
 * would put it somewhere it was never placed.
 */
export interface Drawing {
  kind: "line" | "hline" | "vline" | "circle" | "point" | "text";
  x: number;
  y: number;
  /** the far end of a line, or a point on a circle's rim */
  x2?: number;
  y2?: number;
  /** for text */
  label?: string;
  /** Pt-Off knocks a hole rather than adding ink */
  erase?: boolean;
}

export interface StatPlot {
  on: boolean;
  /** hist and box read xList alone; scatter and line need both */
  type: "scatter" | "line" | "hist" | "box";
  xList: string;
  yList: string;
  color: number;
  mark: "box" | "cross" | "dot";
}

export interface MenuItem {
  label: string;
  /** text inserted at the caret when chosen */
  insert?: string;
  /** named action dispatched to the store */
  action?: string;
  hint?: string;
  disabled?: boolean;
}

export interface MenuTab {
  name: string;
  items: MenuItem[];
}

export interface MenuState {
  title: string;
  tabs: MenuTab[];
  tab: number;
  index: number;
}

/** Where the current edit buffer is committed on ENTER. */
export type EditTarget =
  | { kind: "home" }
  | { kind: "yeq"; row: number }
  | { kind: "window"; row: number }
  | { kind: "tblset"; row: number }
  | { kind: "stat"; col: number; row: number }
  /** row -1 addresses the dimension line, where col 0 is rows and 1 is columns */
  | { kind: "matrix"; name: string; row: number; col: number }
  | { kind: "prgm"; line: number }
  /** row 0 is the equation, then one row per variable, then the bounds */
  | { kind: "solver"; row: number };

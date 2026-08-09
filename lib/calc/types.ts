import type { NotationMode } from "../math/format";

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
}

export interface TableSetup {
  start: number;
  step: number;
  auto: boolean;
}

export interface Modes {
  graphMode: "func" | "par" | "pol";
  angle: "rad" | "deg";
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

export interface StatPlot {
  on: boolean;
  type: "scatter" | "line" | "hist";
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
  | { kind: "prgm"; line: number };

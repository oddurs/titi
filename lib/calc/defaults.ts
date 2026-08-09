import type { GraphWindow, Modes, StatPlot, YFunction } from "./types";
import { PLOT_COLORS } from "./colors";

/**
 * The state a device powers on with, and the small helpers that shape it.
 * Kept apart from the store so the graphing and program modules can reach
 * them without importing the store back.
 */

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const LIST_NAMES = ["L₁", "L₂", "L₃", "L₄", "L₅", "L₆"];
const Y_NAMES = ["Y₁", "Y₂", "Y₃", "Y₄", "Y₅", "Y₆"];

export const MATRIX_NAMES = "ABCDEFGHIJ".split("").map((c) => `[${c}]`);

export const STANDARD_WINDOW: GraphWindow = {
  xmin: -10, xmax: 10, xscl: 1,
  ymin: -10, ymax: 10, yscl: 1,
  xres: 1,
  tmin: 0, tmax: 2 * Math.PI, tstep: Math.PI / 48,
  nmin: 1, nmax: 10,
};

export const DEFAULT_MODES: Modes = {
  graphMode: "func",
  angle: "rad",
  complex: "real",
  notation: "normal",
  decimals: -1,
  connected: true,
  labelAxes: true,
  grid: true,
  coordsOn: true,
};

/** A full turn of the parameter, in whatever unit the angle mode uses. */
export function defaultParamWindow(modes: Modes) {
  const turn = modes.angle === "deg" ? 360 : 2 * Math.PI;
  return { tmin: 0, tmax: turn, tstep: turn / 96 };
}

export function freshYs(): YFunction[] {
  return Y_NAMES.map((name, i) => ({
    id: name,
    name,
    expr: "",
    on: true,
    color: i % PLOT_COLORS.length,
    style: "line" as const,
  }));
}

export function freshPlots(): StatPlot[] {
  return [
    { on: false, type: "scatter", xList: "L₁", yList: "L₂", color: 1, mark: "cross" },
  ];
}


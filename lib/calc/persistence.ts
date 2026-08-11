import { identity, isMatrix, type Matrix } from "../math/matrix";
import { SAMPLE_PROGRAMS, type ProgramSource } from "../math/program";
import {
  DEFAULT_MODES,
  freshPlots,
  freshYs,
  STANDARD_WINDOW,
} from "./defaults";
import type {
  GraphWindow,
  HistoryItem,
  Modes,
  SolverState,
  StatPlot,
  TableSetup,
  YFunction,
} from "./types";

/**
 * Reading and writing saved state.
 *
 * Two rules. A save carries its schema version, so a shape change has a place
 * to be handled rather than being absorbed by ever more defaults. And a field
 * that fails to validate is dropped on its own — a corrupt program list should
 * not cost someone their window settings, which is what the previous
 * all-or-nothing parse did.
 */

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = "titi.state.v1";

export interface SavedState {
  ys: YFunction[];
  win: GraphWindow;
  /** what ZoomSto put aside; null until it is used */
  savedWin: GraphWindow | null;
  modes: Modes;
  tbl: TableSetup;
  lists: number[][];
  plots: StatPlot[];
  statFreq: string | null;
  /** Str0..Str9 */
  strs: Record<string, string>;
  mats: Record<string, Matrix>;
  programs: ProgramSource[];
  solver: SolverState;
  history: HistoryItem[];
}

/** What a device with nothing saved starts from. */
export function defaultSave(): SavedState {
  return {
    ys: freshYs(),
    win: { ...STANDARD_WINDOW },
    savedWin: null,
    modes: { ...DEFAULT_MODES },
    tbl: { start: 0, step: 1, auto: true, ask: [] },
    lists: Array.from({ length: 6 }, () => [] as number[]),
    plots: freshPlots(),
    statFreq: null,
    strs: {},
    mats: { "[A]": identity(2) },
    programs: SAMPLE_PROGRAMS.map((p) => ({ ...p })),
    solver: {
      equation: "",
      values: {},
      target: "",
      bound: [-1e5, 1e5],
      residual: null,
    },
    history: [],
  };
}

export function serialize(state: SavedState): string {
  return JSON.stringify({
    v: SCHEMA_VERSION,
    ys: state.ys,
    win: state.win,
    savedWin: state.savedWin,
    modes: state.modes,
    tbl: state.tbl,
    lists: state.lists,
    plots: state.plots,
    statFreq: state.statFreq,
    strs: state.strs,
    mats: state.mats,
    programs: state.programs,
    solver: state.solver,
    history: state.history.slice(-30),
  });
}

type Raw = Record<string, unknown>;

/**
 * Forward migrations, applied in order. Key n turns a version-n save into a
 * version-(n+1) one.
 */
const MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  // v1 had no version field and no parameter window; a save from before
  // parametric mode would otherwise carry NaN bounds into the graph.
  1: (d) => ({
    ...d,
    win: { ...STANDARD_WINDOW, ...(isObject(d.win) ? d.win : {}) },
    modes: { ...DEFAULT_MODES, ...(isObject(d.modes) ? d.modes : {}) },
  }),
};

const isObject = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const isStr = (v: unknown): v is string => typeof v === "string";

const validYs = (v: unknown) =>
  Array.isArray(v) &&
  v.length === 6 &&
  v.every(
    (y) =>
      isObject(y) && isStr(y.expr) && typeof y.on === "boolean" && isNum(y.color),
  );

const validWin = (v: unknown) =>
  isObject(v) &&
  (["xmin", "xmax", "ymin", "ymax", "tmin", "tmax", "nmin", "nmax"] as const).every(
    (k) => isNum(v[k]),
  );

const validModes = (v: unknown) =>
  isObject(v) &&
  isStr(v.graphMode) &&
  isStr(v.angle) &&
  ["func", "par", "pol", "seq"].includes(v.graphMode as string);

const validLists = (v: unknown) =>
  Array.isArray(v) && v.length === 6 && v.every((l) => Array.isArray(l) && l.every(isNum));

const validMats = (v: unknown) =>
  isObject(v) && Object.values(v).every((m) => isMatrix(m) && Array.isArray(m.m));

const validPrograms = (v: unknown) =>
  Array.isArray(v) && v.every((p) => isObject(p) && isStr(p.name) && isStr(p.body));

const validHistory = (v: unknown) =>
  Array.isArray(v) &&
  v.every((h) => isObject(h) && isStr(h.input) && isStr(h.output));

const validSolver = (v: unknown) =>
  isObject(v) && isStr(v.equation) && Array.isArray(v.bound) && v.bound.length === 2;

const validTbl = (v: unknown) =>
  isObject(v) &&
  isNum(v.start) &&
  isNum(v.step) &&
  (v.ask === undefined || (Array.isArray(v.ask) && v.ask.every(isNum)));

const validPlots = (v: unknown) =>
  Array.isArray(v) && v.every((p) => isObject(p) && typeof p.on === "boolean");

const validStrs = (v: unknown) =>
  isObject(v) && Object.entries(v).every(([k, t]) => /^Str\d$/.test(k) && isStr(t));

const validFreq = (v: unknown) => v === null || (isStr(v) && /^L[₁-₆]$/.test(v));

export interface LoadResult {
  state: SavedState;
  /** fields that failed to validate and were replaced with defaults */
  rejected: string[];
  /** true when there was nothing usable to load at all */
  fresh: boolean;
}

export function deserialize(raw: string | null): LoadResult {
  const base = defaultSave();
  if (!raw) return { state: base, rejected: [], fresh: true };

  let data: Raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return { state: base, rejected: [], fresh: true };
    data = parsed;
  } catch {
    return { state: base, rejected: [], fresh: true };
  }

  // A save with no version predates versioning.
  let version = isNum(data.v) ? data.v : 1;

  // A save from a newer build cannot be understood, and guessing at it is
  // worse than starting clean.
  if (version > SCHEMA_VERSION) return { state: base, rejected: [], fresh: true };

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version += 1;
  }

  const rejected: string[] = [];
  const take = <K extends keyof SavedState>(
    key: K,
    ok: (v: unknown) => boolean,
  ): SavedState[K] => {
    if (data[key] === undefined) return base[key];
    if (ok(data[key])) return data[key] as SavedState[K];
    rejected.push(key);
    return base[key];
  };

  const state: SavedState = {
    ys: take("ys", validYs),
    win: { ...base.win, ...take("win", validWin) },
    savedWin: take("savedWin", (v) => v === null || validWin(v)),
    modes: { ...base.modes, ...take("modes", validModes) },
    tbl: take("tbl", validTbl),
    lists: take("lists", validLists),
    plots: take("plots", validPlots),
    statFreq: take("statFreq", validFreq),
    strs: take("strs", validStrs),
    mats: take("mats", validMats),
    programs: take("programs", validPrograms),
    solver: take("solver", validSolver),
    history: take("history", validHistory),
  };

  // An empty program list means the samples were deleted, not that the save
  // is old — but a save that never had the field should get them.
  if (data.programs === undefined) state.programs = base.programs;
  // Ask mode arrived after the first saves; an older tbl has no list.
  if (!Array.isArray(state.tbl.ask)) state.tbl = { ...state.tbl, ask: [] };
  // So did the plots' frequency lists.
  state.plots = state.plots.map((p) => ({ ...p, freqList: p.freqList ?? null }));

  return { state, rejected, fresh: false };
}

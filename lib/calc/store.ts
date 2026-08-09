"use client";

import { create } from "zustand";
import { CalcError, clearYCache, evaluate, makeEnv, sampler, type Env } from "../math/eval";
import { formatNumber, formatValue, toFraction } from "../math/format";
import { nextBoundary, prevBoundary } from "../math/lexer";
import { keyById } from "./keys";
import { MENUS } from "./menus";
import {
  linReg,
  oneVarStats,
  quadReg,
  twoVarStats,
  type StatReport,
} from "../math/stats";
import {
  findExtremum,
  findIntersection,
  findZeroNear,
} from "./analysis";
import type {
  CalcMark,
  EditTarget,
  Entry,
  GraphWindow,
  HistoryItem,
  MenuState,
  Modes,
  Modifier,
  ScreenId,
  StatPlot,
  TableSetup,
  TraceState,
  YFunction,
} from "./types";

export const PLOT_COLORS = [
  "#5AA9FF", // azure
  "#FF6B8A", // rose
  "#3FD99B", // mint
  "#FFB454", // amber
  "#B98CFF", // iris
  "#4FD8E8", // cyan
];

const Y_NAMES = ["Y₁", "Y₂", "Y₃", "Y₄", "Y₅", "Y₆"];
const LIST_NAMES = ["L₁", "L₂", "L₃", "L₄", "L₅", "L₆"];

export const WINDOW_FIELDS = [
  "xmin", "xmax", "xscl", "ymin", "ymax", "yscl", "xres",
] as const;
export type WindowField = (typeof WINDOW_FIELDS)[number];

export const WINDOW_LABELS: Record<WindowField, string> = {
  xmin: "Xmin", xmax: "Xmax", xscl: "Xscl",
  ymin: "Ymin", ymax: "Ymax", yscl: "Yscl", xres: "Xres",
};

export interface ModeOption {
  key: keyof Modes;
  choices: { value: Modes[keyof Modes]; label: string }[];
  hint: string;
}

export const MODE_ROWS: ModeOption[] = [
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
];

const STANDARD_WINDOW: GraphWindow = {
  xmin: -10, xmax: 10, xscl: 1,
  ymin: -10, ymax: 10, yscl: 1,
  xres: 1,
};

const DEFAULT_MODES: Modes = {
  angle: "rad",
  notation: "normal",
  decimals: -1,
  connected: true,
  labelAxes: true,
  grid: true,
  coordsOn: true,
};

function freshYs(): YFunction[] {
  return Y_NAMES.map((name, i) => ({
    id: name,
    name,
    expr: "",
    on: true,
    color: i % PLOT_COLORS.length,
    style: "line" as const,
  }));
}

function freshPlots(): StatPlot[] {
  return [
    { on: false, type: "scatter", xList: "L₁", yList: "L₂", color: 1, mark: "cross" },
  ];
}

export interface CalcState {
  screen: ScreenId;
  mod: Modifier;
  insertMode: boolean;
  entry: Entry;
  target: EditTarget;
  history: HistoryItem[];
  ys: YFunction[];
  win: GraphWindow;
  tbl: TableSetup;
  modes: Modes;
  menu: MenuState | null;
  trace: TraceState | null;
  marks: CalcMark[];
  plots: StatPlot[];
  lists: number[][];
  /** row cursor for the list-style screens */
  row: number;
  col: number;
  /** free-moving cursor on the graph when not tracing */
  cursor: { x: number; y: number } | null;
  graphPrompt: { op: string; stage: number; lower?: number } | null;
  message: string | null;
  statReport: StatReport | null;
  /** bumped whenever the plot needs a redraw */
  revision: number;
  env: Env;
  /** width ÷ height of the live plot canvas, so ZSquare can match scales */
  aspect: number;

  press: (id: string) => void;
  typeText: (text: string) => void;
  setWindow: (patch: Partial<GraphWindow>) => void;
  setTrace: (t: TraceState | null) => void;
  setCursor: (c: { x: number; y: number } | null) => void;
  dismissMessage: () => void;
  hydrate: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const STORAGE_KEY = "titi.state.v1";

export const useCalc = create<CalcState>((set, get) => {
  const env = makeEnv();

  /** Push env in sync with the reactive slices the math engine reads. */
  function syncEnv(s: Partial<CalcState> = {}) {
    const st = { ...get(), ...s };
    env.angle = st.modes.angle;
    env.ys = Object.fromEntries(
      st.ys.filter((y) => y.expr.trim()).map((y) => [y.name, y.expr]),
    );
    env.lists = Object.fromEntries(
      st.lists.map((l, i) => [LIST_NAMES[i], l]),
    );
    clearYCache();
  }

  function persist() {
    if (typeof window === "undefined") return;
    const { ys, win, modes, tbl, lists, plots, history } = get();
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ys, win, modes, tbl, lists, plots, history: history.slice(-30) }),
      );
    } catch {
      /* private mode — carry on without persistence */
    }
  }

  const fmt = () => ({
    notation: get().modes.notation,
    decimals: get().modes.decimals,
  });

  function note(message: string | null) {
    set({ message });
  }

  // -- edit buffer ----------------------------------------------------------

  function insert(text: string) {
    const { entry, insertMode } = get();
    const before = entry.text.slice(0, entry.caret);
    const after = insertMode
      ? entry.text.slice(entry.caret)
      : entry.text.slice(entry.caret + text.length);
    set({
      entry: { text: before + text + after, caret: entry.caret + text.length },
      message: null,
    });
  }

  function setEntry(text: string, caret = text.length) {
    set({ entry: { text, caret: clamp(caret, 0, text.length) } });
  }

  function backspace() {
    const { entry } = get();
    if (entry.caret === 0) return;
    const start = prevBoundary(entry.text, entry.caret);
    setEntry(
      entry.text.slice(0, start) + entry.text.slice(entry.caret),
      start,
    );
  }

  // -- committing edits -----------------------------------------------------

  function evalEntry(): { ok: boolean; text: string } {
    const src = get().entry.text.trim();
    if (!src) return { ok: false, text: "" };
    try {
      const v = evaluate(src, env);
      env.ans = v;
      env.vars.Ans = typeof v === "number" ? v : NaN;
      return { ok: true, text: formatValue(v, fmt()) };
    } catch (e) {
      return {
        ok: false,
        text: e instanceof CalcError ? e.message : "ERR: SYNTAX",
      };
    }
  }

  function commitHome() {
    const src = get().entry.text.trim();
    if (!src) return;
    const { ok, text } = evalEntry();
    const item: HistoryItem = {
      id: get().history.length + 1,
      input: src,
      output: text,
      isError: !ok,
    };
    set({
      history: [...get().history, item].slice(-80),
      entry: { text: "", caret: 0 },
    });
    // A store into a Y-variable should be reflected in the editor list.
    syncEnv();
    persist();
  }

  function numberFromEntry(): number | null {
    const src = get().entry.text.trim();
    if (!src) return null;
    try {
      const v = evaluate(src, env);
      return typeof v === "number" ? v : null;
    } catch {
      return null;
    }
  }

  function loadEditTarget(target: EditTarget) {
    const st = get();
    let text = "";
    if (target.kind === "yeq") text = st.ys[target.row]?.expr ?? "";
    else if (target.kind === "window") {
      text = formatNumber(st.win[WINDOW_FIELDS[target.row]], {
        notation: "normal",
        decimals: -1,
      });
    } else if (target.kind === "tblset") {
      const v = target.row === 0 ? st.tbl.start : st.tbl.step;
      text = formatNumber(v, { notation: "normal", decimals: -1 });
    } else if (target.kind === "stat") {
      const v = st.lists[target.col]?.[target.row];
      text = v === undefined ? "" : formatNumber(v, { notation: "normal", decimals: -1 });
    }
    set({ target, entry: { text, caret: text.length } });
  }

  function commitTarget() {
    const st = get();
    const t = st.target;

    if (t.kind === "yeq") {
      const ys = st.ys.map((y, i) =>
        i === t.row ? { ...y, expr: st.entry.text.trim() } : y,
      );
      set({ ys, marks: [], trace: null, revision: st.revision + 1 });
      syncEnv({ ys });
      persist();
      return;
    }

    if (t.kind === "window") {
      const v = numberFromEntry();
      if (v === null) {
        note("ERR: INVALID");
        return;
      }
      const field = WINDOW_FIELDS[t.row];
      const win = { ...st.win, [field]: field === "xres" ? clamp(Math.round(v), 1, 8) : v };
      set({ win, marks: [], revision: st.revision + 1 });
      persist();
      return;
    }

    if (t.kind === "tblset") {
      const v = numberFromEntry();
      if (v === null) {
        note("ERR: INVALID");
        return;
      }
      set({ tbl: t.row === 0 ? { ...st.tbl, start: v } : { ...st.tbl, step: v } });
      persist();
      return;
    }

    if (t.kind === "stat") {
      const v = numberFromEntry();
      const lists = st.lists.map((l) => [...l]);
      if (v === null) {
        if (st.entry.text.trim() === "") lists[t.col].splice(t.row, 1);
        else {
          note("ERR: INVALID");
          return;
        }
      } else {
        lists[t.col][t.row] = v;
        for (let i = 0; i < lists[t.col].length; i++) lists[t.col][i] ??= 0;
      }
      set({ lists, revision: st.revision + 1 });
      syncEnv({ lists });
      persist();
    }
  }

  /** Move the row cursor on a list screen, saving the current buffer first. */
  function moveRow(delta: number) {
    const st = get();
    commitTarget();
    const t = st.target;
    if (t.kind === "yeq") {
      loadEditTarget({ kind: "yeq", row: clamp(t.row + delta, 0, 5) });
      set({ row: clamp(t.row + delta, 0, 5) });
    } else if (t.kind === "window") {
      const row = clamp(t.row + delta, 0, WINDOW_FIELDS.length - 1);
      loadEditTarget({ kind: "window", row });
      set({ row });
    } else if (t.kind === "tblset") {
      const row = clamp(t.row + delta, 0, 1);
      loadEditTarget({ kind: "tblset", row });
      set({ row });
    } else if (t.kind === "stat") {
      const maxRow = Math.max(st.lists[t.col].length, 0);
      const row = clamp(t.row + delta, 0, maxRow);
      loadEditTarget({ kind: "stat", col: t.col, row });
      set({ row });
    }
  }

  function moveCol(delta: number) {
    const st = get();
    if (st.target.kind !== "stat") return false;
    commitTarget();
    const col = clamp(st.target.col + delta, 0, 5);
    const row = clamp(st.target.row, 0, get().lists[col].length);
    loadEditTarget({ kind: "stat", col, row });
    set({ col, row });
    return true;
  }

  // -- screens --------------------------------------------------------------

  function gotoScreen(screen: ScreenId) {
    const st = get();
    if (st.target.kind !== "home") commitTarget();

    if (screen === "yeq") {
      set({ screen, menu: null, row: 0 });
      loadEditTarget({ kind: "yeq", row: 0 });
    } else if (screen === "window") {
      set({ screen, menu: null, row: 0 });
      loadEditTarget({ kind: "window", row: 0 });
    } else if (screen === "tblset") {
      set({ screen, menu: null, row: 0 });
      loadEditTarget({ kind: "tblset", row: 0 });
    } else if (screen === "stat") {
      set({ screen, menu: null, row: 0, col: 0 });
      loadEditTarget({ kind: "stat", col: 0, row: 0 });
    } else if (screen === "table") {
      // The table's row is a scroll offset, not a field cursor — start at TblStart.
      set({ screen, menu: null, row: 0, target: { kind: "home" } });
    } else if (screen === "home") {
      set({ screen, menu: null, target: { kind: "home" }, entry: { text: "", caret: 0 } });
    } else {
      set({ screen, menu: null, target: { kind: "home" } });
    }
  }

  // -- graph helpers --------------------------------------------------------

  function enabledYs(): { index: number; y: YFunction }[] {
    return get()
      .ys.map((y, index) => ({ index, y }))
      .filter(({ y }) => y.on && y.expr.trim() !== "");
  }

  function makeSampler(index: number): ((x: number) => number) | null {
    const y = get().ys[index];
    if (!y || !y.expr.trim()) return null;
    const local = { ...env, lenient: true, vars: { ...env.vars } };
    try {
      return sampler(y.expr, local);
    } catch {
      return null;
    }
  }

  function zoomBy(factor: number) {
    const { win } = get();
    const cx = (win.xmin + win.xmax) / 2;
    const cy = (win.ymin + win.ymax) / 2;
    const hw = ((win.xmax - win.xmin) / 2) * factor;
    const hh = ((win.ymax - win.ymin) / 2) * factor;
    set({
      win: { ...win, xmin: cx - hw, xmax: cx + hw, ymin: cy - hh, ymax: cy + hh },
      revision: get().revision + 1,
    });
    persist();
  }

  function applyZoom(kind: string) {
    const st = get();
    const w = st.win;
    switch (kind) {
      case "standard":
        set({ win: { ...STANDARD_WINDOW }, screen: "graph", menu: null });
        break;
      case "decimal":
        set({
          win: { ...w, xmin: -4.7, xmax: 4.7, xscl: 1, ymin: -3.1, ymax: 3.1, yscl: 1 },
          screen: "graph", menu: null,
        });
        break;
      case "trig":
        set({
          win: {
            ...w,
            xmin: -2 * Math.PI, xmax: 2 * Math.PI, xscl: Math.PI / 2,
            ymin: -4, ymax: 4, yscl: 1,
          },
          screen: "graph", menu: null,
        });
        break;
      case "integer":
        set({
          win: { ...w, xmin: -47, xmax: 47, xscl: 10, ymin: -31, ymax: 31, yscl: 10 },
          screen: "graph", menu: null,
        });
        break;
      case "square": {
        // Match the y scale to x using the live canvas aspect ratio.
        const ratio = get().aspect || 1.6;
        const cy = (w.ymin + w.ymax) / 2;
        const hh = (w.xmax - w.xmin) / 2 / ratio;
        set({ win: { ...w, ymin: cy - hh, ymax: cy + hh }, screen: "graph", menu: null });
        break;
      }
      case "fit": {
        let lo = Infinity;
        let hi = -Infinity;
        for (const { index } of enabledYs()) {
          const f = makeSampler(index);
          if (!f) continue;
          for (let i = 0; i <= 300; i++) {
            const x = w.xmin + ((w.xmax - w.xmin) * i) / 300;
            const y = f(x);
            if (Number.isFinite(y)) {
              lo = Math.min(lo, y);
              hi = Math.max(hi, y);
            }
          }
        }
        if (!Number.isFinite(lo) || lo === hi) {
          note("ERR: NO FUNCTIONS");
          set({ menu: null });
          break;
        }
        const pad = (hi - lo) * 0.1;
        set({ win: { ...w, ymin: lo - pad, ymax: hi + pad }, screen: "graph", menu: null });
        break;
      }
      case "in":
        set({ screen: "graph", menu: null });
        zoomBy(0.25);
        break;
      case "out":
        set({ screen: "graph", menu: null });
        zoomBy(4);
        break;
      case "box":
        set({ screen: "graph", menu: null, graphPrompt: { op: "box", stage: 0 } });
        note("Drag a box on the graph");
        break;
    }
    set({ revision: get().revision + 1, trace: null, marks: [] });
    persist();
  }

  // -- CALC operations ------------------------------------------------------

  function currentTraceFn(): number {
    const t = get().trace;
    if (t) return t.fn;
    const first = enabledYs()[0];
    return first ? first.index : -1;
  }

  function runCalc(op: string) {
    const st = get();
    const idx = currentTraceFn();
    if (idx < 0) {
      note("ERR: NO FUNCTIONS");
      set({ menu: null, screen: "graph" });
      return;
    }
    const f = makeSampler(idx);
    if (!f) {
      note("ERR: SYNTAX");
      set({ menu: null, screen: "graph" });
      return;
    }
    const w = st.win;
    const x0 = st.trace?.x ?? st.cursor?.x ?? (w.xmin + w.xmax) / 2;
    const span = w.xmax - w.xmin;

    set({ menu: null, screen: "graph" });

    const mark = (m: CalcMark) =>
      set({ marks: [m], trace: { fn: idx, x: m.x }, revision: get().revision + 1 });

    switch (op) {
      case "value":
        set({ graphPrompt: { op: "value", stage: 0 }, entry: { text: "", caret: 0 } });
        note("x =");
        return;

      case "zero": {
        const r = findZeroNear(f, x0, w.xmin, w.xmax);
        if (r === null) return note("ERR: NO SIGN CHNG");
        return mark({ kind: "point", label: "zero", x: r, y: 0, fn: idx });
      }

      case "min":
      case "max": {
        const r = findExtremum(f, x0, span / 8, op === "min");
        if (r === null) return note("ERR: NO EXTREMUM");
        return mark({ kind: "point", label: op === "min" ? "minimum" : "maximum", x: r, y: f(r), fn: idx });
      }

      case "deriv": {
        const h = Math.max(1e-6, span * 1e-5);
        const slope = (f(x0 + h) - f(x0 - h)) / (2 * h);
        if (!Number.isFinite(slope)) return note("ERR: DOMAIN");
        return mark({ kind: "tangent", label: "dy/dx", x: x0, y: f(x0), slope, fn: idx });
      }

      case "intersect": {
        const others = enabledYs().filter((e) => e.index !== idx);
        if (!others.length) return note("ERR: NEED 2 FUNCTIONS");
        const g = makeSampler(others[0].index);
        if (!g) return note("ERR: SYNTAX");
        const r = findIntersection(f, g, x0, w.xmin, w.xmax);
        if (r === null) return note("ERR: NO INTERSECTION");
        return mark({ kind: "point", label: "intersect", x: r, y: f(r), fn: idx });
      }

      case "integral":
        set({ graphPrompt: { op: "integral", stage: 0 } });
        note("Move to the lower limit, then press enter");
        if (!get().trace) set({ trace: { fn: idx, x: x0 } });
        return;
    }
  }

  function resolveGraphPrompt() {
    const st = get();
    const p = st.graphPrompt;
    if (!p) return false;
    const idx = currentTraceFn();
    const f = idx >= 0 ? makeSampler(idx) : null;

    if (p.op === "value") {
      const x = numberFromEntry();
      if (x === null || !f) {
        note("ERR: INVALID");
        return true;
      }
      set({
        graphPrompt: null,
        entry: { text: "", caret: 0 },
        trace: { fn: idx, x },
        marks: [{ kind: "point", label: "value", x, y: f(x), fn: idx }],
        message: null,
        revision: st.revision + 1,
      });
      return true;
    }

    if (p.op === "integral" && f) {
      const x = st.trace?.x ?? 0;
      if (p.stage === 0) {
        set({ graphPrompt: { op: "integral", stage: 1, lower: x } });
        note("Move to the upper limit, then press enter");
        return true;
      }
      const lo = p.lower ?? x;
      const area = integrateSampled(f, lo, x);
      set({
        graphPrompt: null,
        marks: [{ kind: "area", label: "∫f(x)dx", x: lo, x2: x, y: area, fn: idx }],
        message: null,
        revision: st.revision + 1,
      });
      return true;
    }

    set({ graphPrompt: null });
    return false;
  }

  function integrateSampled(f: (x: number) => number, a: number, b: number): number {
    const n = 2000;
    const h = (b - a) / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const y = f(a + i * h);
      if (!Number.isFinite(y)) continue;
      const weight = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      s += weight * y;
    }
    return (s * h) / 3;
  }

  // -- trace ----------------------------------------------------------------

  function startTrace() {
    const active = enabledYs();
    if (!active.length) {
      set({ screen: "graph", menu: null });
      note("ERR: NO FUNCTIONS");
      return;
    }
    const { win, trace } = get();
    set({
      screen: "graph",
      menu: null,
      cursor: null,
      trace: trace ?? { fn: active[0].index, x: (win.xmin + win.xmax) / 2 },
      message: null,
    });
  }

  function stepTrace(dir: number) {
    const st = get();
    if (!st.trace) return false;
    const step = ((st.win.xmax - st.win.xmin) / 94) * st.win.xres;
    set({
      trace: { ...st.trace, x: clamp(st.trace.x + dir * step, st.win.xmin, st.win.xmax) },
    });
    return true;
  }

  function switchTraceFn(dir: number) {
    const st = get();
    if (!st.trace) return false;
    const active = enabledYs();
    if (active.length < 2) return true;
    const at = active.findIndex((e) => e.index === st.trace!.fn);
    const next = active[(at + dir + active.length) % active.length];
    set({ trace: { ...st.trace, fn: next.index } });
    return true;
  }

  // -- stats ----------------------------------------------------------------

  function runStat(kind: string) {
    const st = get();
    const l1 = st.lists[0];
    const l2 = st.lists[1];
    set({ menu: null });
    try {
      if (kind === "1var") {
        if (l1.length < 1) throw new CalcError("ERR: DIM MISMATCH");
        set({ statReport: oneVarStats(l1), screen: "home" });
      } else if (kind === "2var") {
        if (l1.length < 2 || l1.length !== l2.length) throw new CalcError("ERR: DIM MISMATCH");
        set({ statReport: twoVarStats(l1, l2), screen: "home" });
      } else if (kind === "linreg" || kind === "quadreg") {
        if (l1.length < 2 || l1.length !== l2.length) throw new CalcError("ERR: DIM MISMATCH");
        const report = kind === "linreg" ? linReg(l1, l2) : quadReg(l1, l2);
        const ys = st.ys.map((y, i) => (i === 0 ? { ...y, expr: report.expr!, on: true } : y));
        set({ statReport: report, ys, screen: "home", revision: st.revision + 1 });
        syncEnv({ ys });
        persist();
      } else if (kind === "clear") {
        const lists = st.lists.map(() => [] as number[]);
        set({ lists, statReport: null, revision: st.revision + 1 });
        syncEnv({ lists });
        persist();
        note("Lists cleared");
      } else if (kind === "sortA") {
        const lists = st.lists.map((l) => [...l]);
        const order = lists[0].map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
        for (let c = 0; c < 6; c++) {
          if (lists[c].length === order.length) {
            lists[c] = order.map(([, i]) => lists[c][i]);
          }
        }
        set({ lists, revision: st.revision + 1 });
        syncEnv({ lists });
        persist();
      }
    } catch (e) {
      note(e instanceof CalcError ? e.message : "ERR: INVALID");
    }
  }

  // -- menus ----------------------------------------------------------------

  function openMenu(name: string) {
    const def = MENUS[name];
    if (!def) return;
    set({ menu: { title: def.title, tabs: def.tabs, tab: 0, index: 0 } });
  }

  function chooseMenuItem() {
    const st = get();
    const m = st.menu;
    if (!m) return;
    const item = m.tabs[m.tab].items[m.index];
    set({ menu: null });
    if (!item) return;
    if (item.insert) {
      if (st.screen !== "home" && st.screen !== "yeq" && st.target.kind === "home") {
        gotoScreen("home");
      }
      insert(item.insert);
      return;
    }
    if (item.action) runAction(item.action);
  }

  // -- action dispatch ------------------------------------------------------

  function runAction(action: string) {
    const st = get();
    const [verb, arg, arg2] = action.split(":");

    switch (verb) {
      case "screen":
        gotoScreen(arg as ScreenId);
        return;
      case "menu":
        openMenu(arg);
        return;
      case "zoom":
        applyZoom(arg);
        return;
      case "calc":
        runCalc(arg);
        return;
      case "stat":
        runStat(arg);
        return;
      case "angle": {
        const modes = { ...st.modes, angle: arg as "rad" | "deg" };
        set({ modes, menu: null, revision: st.revision + 1 });
        syncEnv({ modes });
        persist();
        return;
      }
      case "plot": {
        const plots = st.plots.map((p, i) => {
          if (arg === "toggle" && i === Number(arg2)) return { ...p, on: !p.on };
          if (arg === "type") return { ...p, on: true, type: arg2 as StatPlot["type"] };
          if (arg === "off") return { ...p, on: false };
          return p;
        });
        set({ plots, screen: "graph", revision: st.revision + 1 });
        persist();
        return;
      }
      case "var": {
        const v = st.win[arg as WindowField];
        insert(formatNumber(v, { notation: "normal", decimals: -1 }));
        return;
      }
      case "draw":
        set({ marks: [], graphPrompt: null, revision: st.revision + 1, message: null });
        return;
      case "home":
        set({ history: [], statReport: null });
        persist();
        return;
    }

    switch (action) {
      case "mod:2nd":
        set({ mod: st.mod === "2nd" ? "none" : "2nd" });
        return;
      case "mod:alpha":
        set({ mod: st.mod === "alpha" ? "none" : "alpha" });
        return;
      case "mod:alphalock":
        set({ mod: st.mod === "alpha-lock" ? "none" : "alpha-lock" });
        return;

      case "quit":
        if (st.menu) return set({ menu: null });
        if (st.graphPrompt) return set({ graphPrompt: null, message: null });
        commitTarget();
        gotoScreen("home");
        return;

      case "insertMode":
        set({ insertMode: !st.insertMode });
        return;

      case "toFrac": {
        const { ok } = evalEntry();
        const raw = ok ? env.ans : null;
        if (typeof raw !== "number") return note("ERR: DATA TYPE");
        const f = toFraction(raw);
        if (!f) return note("ERR: NOT A FRACTION");
        set({
          history: [
            ...st.history,
            {
              id: st.history.length + 1,
              input: st.entry.text.trim() || formatNumber(raw, fmt()),
              output: f.d === 1 ? String(f.n) : `${f.n}/${f.d}`,
              isError: false,
            },
          ],
          entry: { text: "", caret: 0 },
          screen: "home",
        });
        return;
      }

      case "toDec": {
        const { ok, text } = evalEntry();
        if (!ok) return note(text || "ERR: SYNTAX");
        set({
          history: [
            ...st.history,
            { id: st.history.length + 1, input: st.entry.text.trim(), output: text, isError: false },
          ],
          entry: { text: "", caret: 0 },
          screen: "home",
        });
        return;
      }

      case "recall": {
        const last = st.history[st.history.length - 1];
        if (last) insert(last.output);
        return;
      }

      case "lastEntry": {
        const last = st.history[st.history.length - 1];
        if (last) setEntry(last.input);
        return;
      }

      case "trace":
        startTrace();
        return;

      case "clear":
        if (st.menu) return set({ menu: null });
        if (st.graphPrompt) return set({ graphPrompt: null, message: null });
        if (st.screen === "graph") {
          set({ marks: [], trace: null, cursor: null, message: null, revision: st.revision + 1 });
          return;
        }
        if (st.entry.text) {
          setEntry("");
          set({ message: null });
          if (st.target.kind !== "home") commitTarget();
          return;
        }
        if (st.screen === "home") set({ history: [], statReport: null, message: null });
        return;

      case "del":
        if (st.menu) return;
        backspace();
        return;

      case "enter":
        if (st.menu) return chooseMenuItem();
        if (st.screen === "graph") {
          if (resolveGraphPrompt()) return;
          return;
        }
        if (st.target.kind === "home") {
          if (st.graphPrompt) return void resolveGraphPrompt();
          commitHome();
          set({ screen: "home", statReport: null });
          return;
        }
        commitTarget();
        moveRow(1);
        return;

      case "up":
      case "down": {
        const dir = action === "up" ? -1 : 1;
        if (st.menu) {
          const items = st.menu.tabs[st.menu.tab].items;
          return set({
            menu: { ...st.menu, index: (st.menu.index + dir + items.length) % items.length },
          });
        }
        if (st.screen === "mode") {
          return set({ row: clamp(st.row + dir, 0, MODE_ROWS.length - 1) });
        }
        if (st.screen === "graph") {
          if (st.trace) return void switchTraceFn(dir);
          const step = (st.win.ymax - st.win.ymin) / 20;
          return set({
            win: { ...st.win, ymin: st.win.ymin - dir * step, ymax: st.win.ymax - dir * step },
            revision: st.revision + 1,
          });
        }
        if (st.screen === "table") {
          return set({ row: st.row + dir });
        }
        moveRow(dir);
        return;
      }

      case "left":
      case "right": {
        const dir = action === "left" ? -1 : 1;
        if (st.menu) {
          const tabs = st.menu.tabs.length;
          return set({ menu: { ...st.menu, tab: (st.menu.tab + dir + tabs) % tabs, index: 0 } });
        }
        if (st.screen === "mode") {
          const row = MODE_ROWS[st.row];
          const cur = row.choices.findIndex((c) => c.value === st.modes[row.key]);
          const next = clamp(cur + dir, 0, row.choices.length - 1);
          const modes = { ...st.modes, [row.key]: row.choices[next].value } as Modes;
          set({ modes, revision: st.revision + 1 });
          syncEnv({ modes });
          persist();
          return;
        }
        if (st.screen === "graph") {
          if (stepTrace(dir)) return;
          const step = (st.win.xmax - st.win.xmin) / 20;
          return set({
            win: { ...st.win, xmin: st.win.xmin + dir * step, xmax: st.win.xmax + dir * step },
            revision: st.revision + 1,
          });
        }
        if (st.screen === "stat" && moveCol(dir)) return;
        // Within an edit buffer the arrows walk the caret token by token.
        const { entry } = get();
        const caret =
          dir < 0 ? prevBoundary(entry.text, entry.caret) : nextBoundary(entry.text, entry.caret);
        set({ entry: { ...entry, caret } });
        return;
      }

      case "reset":
        set({
          screen: "home",
          history: [],
          entry: { text: "", caret: 0 },
          target: { kind: "home" },
          ys: freshYs(),
          win: { ...STANDARD_WINDOW },
          modes: { ...DEFAULT_MODES },
          lists: Array.from({ length: 6 }, () => [] as number[]),
          plots: freshPlots(),
          marks: [],
          trace: null,
          cursor: null,
          menu: null,
          statReport: null,
          message: "RAM cleared",
          revision: st.revision + 1,
        });
        syncEnv(get());
        persist();
        return;

      case "noop":
        return;
    }
  }

  return {
    screen: "home",
    mod: "none",
    insertMode: true,
    entry: { text: "", caret: 0 },
    target: { kind: "home" },
    history: [],
    ys: freshYs(),
    win: { ...STANDARD_WINDOW },
    tbl: { start: 0, step: 1, auto: true },
    modes: { ...DEFAULT_MODES },
    menu: null,
    trace: null,
    marks: [],
    plots: freshPlots(),
    lists: Array.from({ length: 6 }, () => [] as number[]),
    row: 0,
    col: 0,
    cursor: null,
    graphPrompt: null,
    message: null,
    statReport: null,
    revision: 0,
    env,
    aspect: 1.6,

    press(id: string) {
      const key = keyById(id);
      if (!key) return;
      const st = get();
      const mod = st.mod;

      const isModKey = key.role === "mod2nd" || key.role === "modalpha";
      // The modifier is consumed by the next keypress, exactly like the device.
      if (!isModKey && mod !== "alpha-lock") set({ mod: "none" });
      if (!isModKey && mod === "alpha-lock" && key.role === "enter") set({ mod: "none" });

      if (mod === "2nd") {
        if (key.act2) return runAction(key.act2);
        if (key.ins2) return insert(key.ins2);
        if (key.act) return runAction(key.act);
        if (key.ins) return insert(key.ins);
        return;
      }

      if ((mod === "alpha" || mod === "alpha-lock") && !isModKey) {
        const text = key.insA ?? key.alpha;
        if (text && text !== "␣") return insert(text);
        if (text === "␣") return insert(" ");
        // keys with no alpha label fall through to their normal behaviour
      }

      if (key.act) return runAction(key.act);
      if (key.ins) return insert(key.ins);
    },

    typeText(text: string) {
      const st = get();
      if (st.menu) return;
      if (st.screen !== "home" && st.target.kind === "home") gotoScreen("home");
      insert(text);
    },

    setWindow(patch) {
      set({ win: { ...get().win, ...patch }, revision: get().revision + 1 });
      persist();
    },

    setTrace(t) {
      set({ trace: t });
    },

    setCursor(c) {
      set({ cursor: c });
    },

    dismissMessage() {
      set({ message: null });
    },

    hydrate() {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          set({
            ys: saved.ys ?? freshYs(),
            win: saved.win ?? { ...STANDARD_WINDOW },
            modes: { ...DEFAULT_MODES, ...(saved.modes ?? {}) },
            tbl: saved.tbl ?? { start: 0, step: 1, auto: true },
            lists: saved.lists ?? Array.from({ length: 6 }, () => [] as number[]),
            plots: saved.plots ?? freshPlots(),
            history: saved.history ?? [],
          });
        }
      } catch {
        /* ignore corrupt saves */
      }
      syncEnv(get());
    },
  };
});

/** The canvas reports its aspect ratio so ZSquare can do the right thing. */
export function reportAspect(ratio: number) {
  if (Math.abs(useCalc.getState().aspect - ratio) > 1e-3) {
    useCalc.setState({ aspect: ratio });
  }
}

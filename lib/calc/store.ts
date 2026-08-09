"use client";

import { create, type StateCreator } from "zustand";
import { CalcError, clearYCache, evaluate, makeEnv, type Env } from "../math/eval";
import { formatMatrixRows, formatNumber, formatValue, toFraction } from "../math/format";
import { isMatrix } from "../math/matrix";
import { nextBoundary, prevBoundary } from "../math/lexer";
import { keyById } from "./keys";
import { MENUS } from "./menus";
import type { StatReport } from "../math/stats";
import { createReports } from "./reports";
import { deserialize, serialize, STORAGE_KEY } from "./persistence";
import { paramVar } from "./curves";
import { createGraphing } from "./graphing";
import {
  clamp,
  defaultParamWindow,
  DEFAULT_MODES,
  freshPlots,
  freshYs,
  LIST_NAMES,
  MATRIX_NAMES,
  STANDARD_WINDOW,
} from "./defaults";
import {
  MODE_ROWS,
  WINDOW_FIELDS,
  WINDOW_LABELS,
  solverRows,
  visibleWindowFields,
  windowLabel,
  type ModeOption,
  type WindowField,
} from "./layout";
import * as MX from "../math/matrix";
import type { Matrix } from "../math/matrix";
import { equationVariables } from "../math/solver";
import { SAMPLE_PROGRAMS, type ProgramSource } from "../math/program";
import { createPrograms } from "./programs";
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
  PrgmRun,
  SolverState,
  TraceState,
  YFunction,
} from "./types";

export { PLOT_COLORS } from "./colors";

export {
  clamp,
  MATRIX_NAMES,
  STANDARD_WINDOW,
  DEFAULT_MODES,
  defaultParamWindow,
} from "./defaults";
export {
  solverRows,
  MODE_ROWS,
  WINDOW_FIELDS,
  WINDOW_LABELS,
  visibleWindowFields,
  windowLabel,
};
export type { ModeOption, WindowField };

export interface CalcState {
  screen: ScreenId;
  mod: Modifier;
  insertMode: boolean;
  entry: Entry;
  /**
   * True when the buffer was pre-filled with a field's current value and the
   * user has not typed yet — the next character replaces it rather than
   * appending, which is how typing over WINDOW or a matrix cell behaves.
   */
  entryFresh: boolean;
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
  mats: Record<string, Matrix>;
  programs: ProgramSource[];
  prgmRun: PrgmRun | null;
  /** the program being edited, held as lines */
  prgmLines: string[];
  prgmName: string;
  solver: SolverState;
  /** row cursor for the list-style screens */
  row: number;
  col: number;
  /**
   * On the Y= screen the caret can sit on the `=` itself, where ENTER switches
   * the function on or off — the only place that control lives, as on the
   * device.
   */
  onEquals: boolean;
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
  /** tap-to-select on a list screen, now that the panel has no DOM rows */
  selectRow: (index: number) => void;
  typeText: (text: string) => void;
  setWindow: (patch: Partial<GraphWindow>) => void;
  setTrace: (t: TraceState | null) => void;
  setCursor: (c: { x: number; y: number } | null) => void;
  dismissMessage: () => void;
  hydrate: () => void;
}



/**
 * The store initialiser, named so it can be instantiated more than once.
 * Tests build a fresh store per case; the app uses the single instance below.
 */
const initCalc: StateCreator<CalcState> = (set, get) => {
  const env = makeEnv();

  /** Push env in sync with the reactive slices the math engine reads. */
  function syncEnv(s: Partial<CalcState> = {}) {
    const st = { ...get(), ...s };
    env.angle = st.modes.angle;
    env.complex = st.modes.complex;
    env.vars.nMin = st.win.nmin;
    env.vars.nMax = st.win.nmax;
    env.ys = Object.fromEntries(
      st.ys.filter((y) => y.expr.trim()).map((y) => [y.name, y.expr]),
    );
    env.lists = Object.fromEntries(
      st.lists.map((l, i) => [LIST_NAMES[i], l]),
    );
    env.mats = st.mats;
    clearYCache();
  }

  function persist() {
    if (typeof window === "undefined") return;
    const st = get();
    try {
      window.localStorage.setItem(STORAGE_KEY, serialize(st));
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
    const { entry, insertMode, entryFresh } = get();
    if (entryFresh) {
      set({ entry: { text, caret: text.length }, entryFresh: false, message: null });
      return;
    }
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
    set({ entry: { text, caret: clamp(caret, 0, text.length) }, entryFresh: false });
  }

  function backspace() {
    const { entry } = get();
    set({ entryFresh: false });
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
    const value = env.ans;
    const item: HistoryItem = {
      id: get().history.length + 1,
      input: src,
      output: text,
      isError: !ok,
      rows: ok && isMatrix(value) ? formatMatrixRows(value, fmt()) : undefined,
    };
    set({
      history: [...get().history, item].slice(-80),
      entry: { text: "", caret: 0 },
    });
    // A store into a Y-variable should be reflected in the editor list.
    syncEnv();
    persist();
  }

  /** null means unparseable; undefined means the field was left blank. */
  function numberFromEntry(): number | null | undefined {
    const src = get().entry.text.trim();
    if (!src) return undefined;
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
      const fields = visibleWindowFields(st.modes.graphMode);
      text = formatNumber(st.win[fields[target.row]], {
        notation: "normal",
        decimals: -1,
      });
    } else if (target.kind === "tblset") {
      const v = target.row === 0 ? st.tbl.start : st.tbl.step;
      text = formatNumber(v, { notation: "normal", decimals: -1 });
    } else if (target.kind === "stat") {
      const v = st.lists[target.col]?.[target.row];
      text = v === undefined ? "" : formatNumber(v, { notation: "normal", decimals: -1 });
    } else if (target.kind === "matrix") {
      const m = st.mats[target.name];
      if (!m) text = "";
      else if (target.row < 0) {
        text = String(target.col === 0 ? m.r : m.c);
      } else {
        text = formatNumber(m.m[target.row]?.[target.col] ?? 0, {
          notation: "normal",
          decimals: -1,
        });
      }
    } else if (target.kind === "prgm") {
      text = st.prgmLines[target.line] ?? "";
    } else if (target.kind === "solver") {
      const rows = solverRows(st.solver);
      const row = rows[target.row];
      text = row ? row.value : "";
    }
    if (target.kind !== "yeq") set({ onEquals: false });
    const replaceOnType =
      target.kind === "window" ||
      target.kind === "tblset" ||
      target.kind === "matrix" ||
      target.kind === "stat";
    set({
      target,
      entry: { text, caret: text.length },
      entryFresh: replaceOnType && text !== "",
    });
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
      if (v === undefined) return;
      if (v === null) {
        note("ERR: INVALID");
        return;
      }
      const field = visibleWindowFields(st.modes.graphMode)[t.row];
      const win = { ...st.win, [field]: field === "xres" ? clamp(Math.round(v), 1, 8) : v };
      set({ win, marks: [], revision: st.revision + 1 });
      syncEnv({ win });
      persist();
      return;
    }

    if (t.kind === "tblset") {
      const v = numberFromEntry();
      if (v === undefined) return;
      if (v === null) {
        note("ERR: INVALID");
        return;
      }
      set({ tbl: t.row === 0 ? { ...st.tbl, start: v } : { ...st.tbl, step: v } });
      persist();
      return;
    }

    if (t.kind === "matrix") {
      const v = numberFromEntry();
      if (v === undefined) return;
      if (v === null) return note("ERR: INVALID");
      const current = st.mats[t.name] ?? MX.identity(1);
      let next: Matrix;
      if (t.row < 0) {
        const size = clamp(Math.round(v), 1, 12);
        next = MX.resize(current, t.col === 0 ? size : current.r, t.col === 0 ? current.c : size);
      } else {
        next = MX.clone(current);
        if (next.m[t.row] === undefined) return;
        next.m[t.row][t.col] = v;
      }
      const mats = { ...st.mats, [t.name]: next };
      set({ mats, revision: st.revision + 1 });
      syncEnv({ mats });
      persist();
      return;
    }

    if (t.kind === "prgm") {
      const lines = [...st.prgmLines];
      lines[t.line] = st.entry.text;
      const programs = st.programs.map((p) =>
        p.name === st.prgmName ? { ...p, body: lines.join("\n") } : p,
      );
      set({ prgmLines: lines, programs });
      persist();
      return;
    }

    if (t.kind === "solver") {
      const rows = solverRows(st.solver);
      const row = rows[t.row];
      if (!row) return;
      if (row.kind === "equation") {
        const equation = st.entry.text.trim();
        // Keep any values the user already typed for variables that survive.
        const vars = equationVariables(equation);
        const values: Record<string, number> = {};
        for (const v of vars) values[v] = st.solver.values[v] ?? 0;
        set({
          solver: {
            ...st.solver,
            equation,
            values,
            target: vars.includes(st.solver.target) ? st.solver.target : (vars[0] ?? ""),
            residual: null,
          },
        });
        persist();
        return;
      }
      const v = numberFromEntry();
      if (v === undefined) return;
      if (v === null) return note("ERR: INVALID");
      if (row.kind === "var") {
        set({
          solver: {
            ...st.solver,
            values: { ...st.solver.values, [row.name!]: v },
            residual: null,
          },
        });
      } else {
        const bound: [number, number] = [...st.solver.bound];
        bound[row.kind === "lower" ? 0 : 1] = v;
        set({ solver: { ...st.solver, bound, residual: null } });
      }
      persist();
      return;
    }

    if (t.kind === "stat") {
      const v = numberFromEntry();
      const lists = st.lists.map((l) => [...l]);
      if (v === undefined) {
        lists[t.col].splice(t.row, 1);
      } else if (v === null) {
        note("ERR: INVALID");
        return;
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
      set({ row: clamp(t.row + delta, 0, 5), onEquals: false });
    } else if (t.kind === "window") {
      const count = visibleWindowFields(get().modes.graphMode).length;
      const row = clamp(t.row + delta, 0, count - 1);
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
    } else if (t.kind === "matrix") {
      const m = get().mats[t.name];
      const row = clamp(t.row + delta, -1, (m?.r ?? 1) - 1);
      const col = row < 0 ? Math.min(t.col, 1) : Math.min(t.col, (m?.c ?? 1) - 1);
      loadEditTarget({ kind: "matrix", name: t.name, row, col });
    } else if (t.kind === "prgm") {
      const line = clamp(t.line + delta, 0, Math.max(0, st.prgmLines.length - 1));
      loadEditTarget({ kind: "prgm", line });
    } else if (t.kind === "solver") {
      const count = solverRows(get().solver).length;
      loadEditTarget({ kind: "solver", row: clamp(t.row + delta, 0, count - 1) });
    }
  }

  function moveMatCol(delta: number): boolean {
    const st = get();
    if (st.target.kind !== "matrix") return false;
    commitTarget();
    const t = st.target;
    const m = get().mats[t.name];
    const width = t.row < 0 ? 2 : (m?.c ?? 1);
    const col = clamp(t.col + delta, 0, width - 1);
    loadEditTarget({ kind: "matrix", name: t.name, row: t.row, col });
    return true;
  }

  /** ENTER fills a matrix left to right, then drops to the next row. */
  function advanceMatrixCell() {
    const t = get().target;
    if (t.kind !== "matrix") return;
    const m = get().mats[t.name];
    if (!m) return;
    if (t.row < 0) {
      loadEditTarget({ kind: "matrix", name: t.name, row: t.col === 0 ? -1 : 0, col: t.col === 0 ? 1 : 0 });
      return;
    }
    let row = t.row;
    let col = t.col + 1;
    if (col >= m.c) {
      col = 0;
      row = Math.min(row + 1, m.r - 1);
    }
    loadEditTarget({ kind: "matrix", name: t.name, row, col });
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

  function gotoScreen(screen: ScreenId, matrixName?: string) {
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
    } else if (screen === "matrix") {
      const name =
        matrixName ?? (st.target.kind === "matrix" ? st.target.name : MATRIX_NAMES[0]);
      if (!get().mats[name]) {
        const mats = { ...get().mats, [name]: MX.identity(2) };
        set({ mats });
        syncEnv({ mats });
      }
      set({ screen, menu: null });
      loadEditTarget({ kind: "matrix", name, row: 0, col: 0 });
    } else if (screen === "solver") {
      set({ screen, menu: null, row: 0 });
      loadEditTarget({ kind: "solver", row: 0 });
    } else if (screen === "prgm") {
      set({ screen, menu: null });
      loadEditTarget({ kind: "prgm", line: 0 });
    } else if (screen === "table") {
      // The table's row is a scroll offset, not a field cursor — start at TblStart.
      set({ screen, menu: null, row: 0, target: { kind: "home" } });
    } else if (screen === "home") {
      set({
        screen,
        menu: null,
        target: { kind: "home" },
        entry: { text: "", caret: 0 },
        entryFresh: false,
      });
    } else {
      // MODE and TABLE both read `row`, so it has to start where they expect.
      set({ screen, menu: null, target: { kind: "home" }, entryFresh: false, row: 0 });
    }
  }

  const graphing = createGraphing({
    get, set, env, note, persist, numberFromEntry,
  });
  const {
    applyZoom, runCalc, resolveGraphPrompt,
    startTrace, stepTrace, switchTraceFn,
  } = graphing;

  const { runStat, runSolve } = createReports({
    get, set, env, note, persist, syncEnv, loadEditTarget,
  });

  /** Applying modes may need to reset the parameter window and clear marks. */
  function applyModes(modes: Modes) {
    const st = get();
    const changedGraph = modes.graphMode !== st.modes.graphMode;
    const changedAngle = modes.angle !== st.modes.angle;
    const win =
      changedGraph || changedAngle
        ? { ...st.win, ...defaultParamWindow(modes) }
        : st.win;
    set({
      modes,
      win,
      trace: null,
      marks: [],
      revision: st.revision + 1,
    });
    syncEnv({ modes });
    persist();
  }

  const {
    pumpProgram, startProgram, editProgram, newProgram,
    provideInput, resumeProgram,
  } = createPrograms({
    get, set, env, note, persist, syncEnv, gotoScreen,
  });

  // -- menus ----------------------------------------------------------------

  function openMenu(name: string) {
    // PRGM and MATRIX list what actually exists, so their tabs are built here.
    if (name === "prgm") {
      const programs = get().programs;
      const rows = (verb: string) =>
        programs.length
          ? programs.map((p) => ({ label: p.name, action: `prgm:${verb}:${p.name}` }))
          : [{ label: "No programs", action: "noop", hint: "create one under NEW" }];
      set({
        menu: {
          title: "prgm",
          tabs: [
            { name: "exec", items: rows("exec") },
            { name: "edit", items: rows("edit") },
            { name: "new", items: [{ label: "Create program", action: "prgm:new" }] },
          ],
          tab: 0,
          index: 0,
        },
      });
      return;
    }

    if (name === "matrix") {
      const mats = get().mats;
      set({
        menu: {
          title: "matrix",
          tabs: [
            {
              name: "names",
              items: MATRIX_NAMES.map((n) => ({
                label: n,
                insert: n,
                hint: mats[n] ? `${mats[n].r}×${mats[n].c}` : "empty",
              })),
            },
            { name: "math", items: MENUS.matrixmath.tabs[0].items },
            {
              name: "edit",
              items: MATRIX_NAMES.map((n) => ({
                label: n,
                action: `mat:edit:${n}`,
                hint: mats[n] ? `${mats[n].r}×${mats[n].c}` : "empty",
              })),
            },
          ],
          tab: 0,
          index: 0,
        },
      });
      return;
    }

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
      case "prgm":
        if (arg === "exec") startProgram(arg2);
        else if (arg === "edit") editProgram(arg2);
        else if (arg === "new") newProgram();
        return;

      case "mat": {
        // mat:edit:[A]
        set({ menu: null });
        gotoScreen("matrix", action.slice("mat:edit:".length));
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
        if (st.screen === "prgm" && st.target.kind === "prgm" && !st.entry.text) {
          // clearing an already-empty line removes it
          const at = st.target.line;
          const lines = st.prgmLines.filter((_, i) => i !== at);
          const next = lines.length ? lines : [""];
          const programs = st.programs.map((p) =>
            p.name === st.prgmName ? { ...p, body: next.join("\n") } : p,
          );
          set({ prgmLines: next, programs });
          persist();
          loadEditTarget({ kind: "prgm", line: clamp(at, 0, next.length - 1) });
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
        if (st.screen === "prgmrun") {
          const run = st.prgmRun;
          if (!run) return gotoScreen("home");
          if (run.status === "input") {
            provideInput(st.entry.text);
            set({ entry: { text: "", caret: 0 } });
            return pumpProgram();
          }
          if (run.status === "pause") {
            resumeProgram();
            return pumpProgram();
          }
          // done or error — ENTER returns to the home screen
          set({ prgmRun: null });
          return gotoScreen("home");
        }
        if (st.target.kind === "yeq" && st.onEquals) {
          const row = st.target.row;
          const ys = st.ys.map((y, i) => (i === row ? { ...y, on: !y.on } : y));
          set({ ys, marks: [], trace: null, revision: st.revision + 1 });
          syncEnv({ ys });
          persist();
          return;
        }
        if (st.target.kind === "solver") {
          commitTarget();
          const rows = solverRows(get().solver);
          const row = rows[st.target.row];
          if (row?.kind === "var" && row.name) runSolve(row.name);
          else moveRow(1);
          return;
        }
        if (st.target.kind === "prgm") {
          // ENTER opens a new line below, the way the program editor works
          commitTarget();
          const lines = [...get().prgmLines];
          const at = st.target.line;
          lines.splice(at + 1, 0, "");
          set({ prgmLines: lines });
          loadEditTarget({ kind: "prgm", line: at + 1 });
          return;
        }
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
        if (st.target.kind === "matrix") {
          commitTarget();
          advanceMatrixCell();
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
          applyModes(modes);
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
        if (st.screen === "matrix" && moveMatCol(dir)) return;
        if (st.target.kind === "yeq") {
          if (dir < 0 && st.entry.caret === 0 && !st.onEquals) {
            return set({ onEquals: true });
          }
          if (dir > 0 && st.onEquals) return set({ onEquals: false });
        }
        // Within an edit buffer the arrows walk the caret token by token.
        const { entry } = get();
        const caret =
          dir < 0 ? prevBoundary(entry.text, entry.caret) : nextBoundary(entry.text, entry.caret);
        set({ entry: { ...entry, caret }, entryFresh: false });
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
          mats: { "[A]": MX.identity(2) },
          programs: SAMPLE_PROGRAMS.map((p) => ({ ...p })),
          prgmRun: null,
          prgmLines: [],
          prgmName: "",
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

      case "xtn":
        insert(paramVar(st.modes.graphMode));
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
    entryFresh: false,
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
    mats: { "[A]": MX.identity(2) },
    programs: SAMPLE_PROGRAMS.map((p) => ({ ...p })),
    prgmRun: null,
    prgmLines: [],
    prgmName: "",
    solver: {
      equation: "",
      values: {},
      target: "",
      bound: [-1e5, 1e5],
      residual: null,
    },
    row: 0,
    col: 0,
    onEquals: false,
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

    selectRow(index: number) {
      const st = get();
      if (st.menu) return;
      if (st.screen === "mode") return set({ row: index });
      const t = st.target;
      if (t.kind === "yeq") { commitTarget(); loadEditTarget({ kind: "yeq", row: index }); }
      else if (t.kind === "window") { commitTarget(); loadEditTarget({ kind: "window", row: index }); }
      else if (t.kind === "tblset") { commitTarget(); loadEditTarget({ kind: "tblset", row: index }); }
      else if (t.kind === "prgm") { commitTarget(); loadEditTarget({ kind: "prgm", line: index }); }
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
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        /* storage unavailable — start clean */
      }
      const { state, rejected } = deserialize(raw);
      set(state);
      if (rejected.length) {
        // Say so rather than silently reverting part of someone's work.
        note(`Reset: ${rejected.join(", ")}`);
      }
      syncEnv(get());
    },
  };
};

/** A fresh, isolated device. */
export const createCalcStore = () => create<CalcState>(initCalc);

export const useCalc = createCalcStore();

/** The canvas reports its aspect ratio so ZSquare can do the right thing. */
export function reportAspect(ratio: number) {
  if (Math.abs(useCalc.getState().aspect - ratio) > 1e-3) {
    useCalc.setState({ aspect: ratio });
  }
}

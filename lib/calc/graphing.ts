import { sampler, type Env } from "../math/eval";
import { buildCurves, paramRange } from "./curves";
import { clamp, STANDARD_WINDOW } from "./defaults";
import { findExtremum, findIntersection, findZeroNear } from "./analysis";
import type { CalcMark, Drawing, Modes, YFunction } from "./types";
import type { CalcState } from "./store";

/**
 * Everything the graph screen does: the window, ZOOM, CALC and TRACE.
 *
 * It reaches the store through a handful of callbacks rather than importing
 * it, which is what keeps the dependency pointing one way and lets a test
 * drive it without a device.
 */
export interface GraphingCtx {
  get(): CalcState;
  set(patch: Partial<CalcState>): void;
  /** a running program asked for a point on the graph */
  provideProgramPoint(x: number, y: number): void;
  env: Env;
  note(message: string | null): void;
  persist(): void;
  /** null when unparseable, undefined when the field was left blank */
  numberFromEntry(): number | null | undefined;
}

export function createGraphing(ctx: GraphingCtx) {
  const { get, set, env, note, persist, numberFromEntry, provideProgramPoint } = ctx;

// -- graph helpers --------------------------------------------------------

function enabledYs(): { index: number; y: YFunction }[] {
  const st = get();
  // In parametric mode a curve owns two slots, so ask the curve builder
  // rather than reading the slots directly.
  const drawn = new Set(buildCurves(st.ys, st.modes, env).map((c) => c.index));
  return st.ys
    .map((y, index) => ({ index, y }))
    .filter(({ index }) => drawn.has(index));
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
      // Fit whatever the current mode actually draws: function mode keeps
      // the x window and fits y, the others fit both axes.
      const curves = buildCurves(st.ys, st.modes, env);
      if (!curves.length) {
        note("ERR: NO FUNCTIONS");
        set({ menu: null });
        break;
      }
      const { min, max } = paramRange(st.modes.graphMode, w);
      let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
      for (const c of curves) {
        for (let i = 0; i <= 400; i++) {
          const t = min + ((max - min) * i) / 400;
          const p = c.at(t);
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
          xLo = Math.min(xLo, p.x); xHi = Math.max(xHi, p.x);
          yLo = Math.min(yLo, p.y); yHi = Math.max(yHi, p.y);
        }
      }
      if (!Number.isFinite(yLo) || yLo === yHi) {
        // The slots are filled but nothing sampled — an undefined sequence
        // seed is the usual reason, and it is worth saying so.
        note("ERR: NOTHING TO FIT");
        set({ menu: null });
        break;
      }
      const padY = (yHi - yLo) * 0.1 || 1;
      const next = { ...w, ymin: yLo - padY, ymax: yHi + padY };
      if (st.modes.graphMode !== "func" && Number.isFinite(xLo) && xLo !== xHi) {
        const padX = (xHi - xLo) * 0.1 || 1;
        next.xmin = xLo - padX;
        next.xmax = xHi + padX;
      }
      set({ win: next, screen: "graph", menu: null });
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
    case "sto":
      set({ savedWin: { ...get().win }, screen: "graph", menu: null });
      note("Window stored");
      persist();
      return;
    case "rcl": {
      const saved = get().savedWin;
      set({ screen: "graph", menu: null });
      if (!saved) return note("No window stored");
      set({ win: { ...saved }, revision: get().revision + 1, trace: null, marks: [] });
      note("Window recalled");
      persist();
      return;
    }
    case "box":
      set({ screen: "graph", menu: null, graphPrompt: { op: "box", stage: 0 } });
      note("Drag a box on the graph");
      break;
  }
  set({ revision: get().revision + 1, trace: null, marks: [] });
  persist();
}

// -- DRAW operations ------------------------------------------------------

/** How many points each command needs before it can be drawn. */
const DRAW_POINTS: Record<string, number> = {
  line: 2, circle: 2, horizontal: 1, vertical: 1, pton: 1, ptoff: 1, text: 1,
};

/** These want typing, not pointing: an expression, and Shade( wants two. */
const DRAW_TYPED: Record<string, string> = {
  func: "Type an expression in X, then press enter",
  inv: "Type an expression in X, then press enter",
  shade: "Type the lower expression, then press enter",
};

const DRAW_PROMPT: Record<string, [string, string]> = {
  line: ["Move to one end, then press enter", "Move to the other end, then press enter"],
  circle: ["Move to the centre, then press enter", "Move out to the rim, then press enter"],
  horizontal: ["Move to the height, then press enter", ""],
  vertical: ["Move across, then press enter", ""],
  pton: ["Move to the point, then press enter", ""],
  ptoff: ["Move to the point to erase, then press enter", ""],
  text: ["Move to where the text goes, then press enter", "Type the text, then press enter"],
};

/** Where the free cursor should start when a draw command is chosen. */
function centreCursor() {
  const { win, cursor } = get();
  return cursor ?? { x: (win.xmin + win.xmax) / 2, y: (win.ymin + win.ymax) / 2 };
}

function startDraw(op: string) {
  if (op === "clear") {
    set({ drawings: [], marks: [], menu: null, screen: "graph", graphPrompt: null, revision: get().revision + 1 });
    note("Drawings cleared");
    return;
  }
  if (DRAW_TYPED[op]) {
    set({
      screen: "graph",
      menu: null,
      trace: null,
      cursor: null,
      entry: { text: "", caret: 0 },
      entryFresh: false,
      graphPrompt: { op: `draw:${op}`, stage: 0 },
    });
    note(DRAW_TYPED[op]);
    return;
  }
  if (!DRAW_POINTS[op]) return;
  set({
    screen: "graph",
    menu: null,
    trace: null,
    cursor: centreCursor(),
    graphPrompt: { op: `draw:${op}`, stage: 0 },
  });
  note(DRAW_PROMPT[op][0]);
}

/**
 * Arrows drive the free cursor while a draw command is waiting for a point,
 * rather than panning the window. A hundred steps across the field is fine by
 * hand and the pointer is there when it is not.
 */
function nudgeCursor(dx: number, dy: number): boolean {
  const st = get();
  const wants = st.graphPrompt?.op;
  if (!wants || (!wants.startsWith("draw:") && wants !== "prgm:point")) return false;
  // Text is typed once its place is chosen, so the arrows go back to editing.
  if (wants === "draw:text" && st.graphPrompt?.stage === 1) return false;
  const c = st.cursor ?? centreCursor();
  const w = st.win;
  set({
    cursor: {
      x: clamp(c.x + (dx * (w.xmax - w.xmin)) / 100, w.xmin, w.xmax),
      y: clamp(c.y + (dy * (w.ymax - w.ymin)) / 100, w.ymin, w.ymax),
    },
    revision: st.revision + 1,
  });
  return true;
}

/** ENTER during a draw command: place a point, or finish. */
function resolveDraw(op: string, stage: number): boolean {
  const st = get();
  const c = st.cursor ?? centreCursor();
  const add = (d: Drawing) => {
    set({
      drawings: [...st.drawings, d],
      graphPrompt: null,
      cursor: c,
      message: null,
      entry: { text: "", caret: 0 },
      revision: st.revision + 1,
    });
  };

  if (DRAW_TYPED[op]) {
    const text = st.entry.text.trim();
    if (!text) {
      set({ graphPrompt: null, entry: { text: "", caret: 0 } });
      note(null);
      return true;
    }
    if (op === "shade" && stage === 0) {
      set({
        graphPrompt: { op: "draw:shade", stage: 1 },
        // The first expression is kept on the prompt so it is not lost.
        drawings: [...st.drawings, { kind: "shade", x: 0, y: 0, expr: text }],
        entry: { text: "", caret: 0 },
      });
      note("Type the upper expression, then press enter");
      return true;
    }
    if (op === "shade") {
      // Finish the region opened a moment ago.
      const drawings = st.drawings.slice();
      const last = drawings[drawings.length - 1];
      if (last && last.kind === "shade") drawings[drawings.length - 1] = { ...last, expr2: text };
      set({
        drawings,
        graphPrompt: null,
        entry: { text: "", caret: 0 },
        message: null,
        revision: st.revision + 1,
      });
      return true;
    }
    add({ kind: "curve", x: 0, y: 0, expr: text, inverse: op === "inv" });
    return true;
  }

  if (op === "text" && stage === 1) {
    const label = st.entry.text.trim();
    const at = st.graphPrompt?.point ?? c;
    if (!label) {
      set({ graphPrompt: null, entry: { text: "", caret: 0 } });
      note(null);
      return true;
    }
    add({ kind: "text", x: at.x, y: at.y, label });
    return true;
  }

  if (DRAW_POINTS[op] === 2 && stage === 0) {
    set({ graphPrompt: { op: `draw:${op}`, stage: 1, point: c } });
    note(DRAW_PROMPT[op][1]);
    return true;
  }

  if (op === "text") {
    set({ graphPrompt: { op: "draw:text", stage: 1, point: c }, entry: { text: "", caret: 0 } });
    note(DRAW_PROMPT.text[1]);
    return true;
  }

  const first = st.graphPrompt?.point ?? c;
  switch (op) {
    case "line": add({ kind: "line", x: first.x, y: first.y, x2: c.x, y2: c.y }); break;
    case "circle": add({ kind: "circle", x: first.x, y: first.y, x2: c.x, y2: c.y }); break;
    case "horizontal": add({ kind: "hline", x: c.x, y: c.y }); break;
    case "vertical": add({ kind: "vline", x: c.x, y: c.y }); break;
    case "pton": add({ kind: "point", x: c.x, y: c.y }); break;
    case "ptoff": add({ kind: "point", x: c.x, y: c.y, erase: true }); break;
  }
  return true;
}

// -- CALC operations ------------------------------------------------------

function currentTraceFn(): number {
  const t = get().trace;
  if (t) return t.fn;
  const first = enabledYs()[0];
  return first ? first.index : -1;
}

/**
 * The operations that need a function of x.
 *
 * The device is the same: in Par, Pol and Seq mode its CALC menu offers the
 * value and the derivatives and nothing else, because "the zero" of a curve
 * that doubles back has no single meaning. So this refuses the rest by name
 * rather than refusing the whole menu.
 */
const FUNC_ONLY = new Set(["zero", "min", "max", "intersect", "integral"]);

/**
 * value and dy/dx along a parameterised curve.
 *
 * In Par and Pol mode the parameter is not x, so the slope has to come from
 * the curve: (dy/dt)/(dx/dt), by central difference. In Seq mode the terms are
 * whole numbers apart and there is no slope to speak of, so only value runs.
 */
function runCurveCalc(op: string, mode: Modes["graphMode"]) {
  const st = get();
  set({ menu: null, screen: "graph" });

  const curves = buildCurves(st.ys, st.modes, env);
  const active = st.trace ? curves.find((c) => c.index === st.trace!.fn) : curves[0];
  if (!active) return note("ERR: NO FUNCTIONS");

  if (op === "value") {
    set({ graphPrompt: { op: "curveValue", stage: 0 }, entry: { text: "", caret: 0 } });
    return note(`${paramName(mode)} =`);
  }
  if (op !== "deriv") return note("CALC needs Func mode");
  if (mode === "seq") return note("No slope in Seq mode");

  const { min, max } = paramRange(mode, st.win);
  const t = st.trace?.x ?? (min + max) / 2;
  const h = Math.max(1e-6, (max - min) * 1e-5);
  const a = active.at(t - h);
  const b = active.at(t + h);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx === 0) {
    return note("ERR: DOMAIN");
  }
  const here = active.at(t);
  set({
    marks: [{ kind: "tangent", label: "dy/dx", x: here.x, y: here.y, slope: dy / dx, fn: active.index }],
    trace: { fn: active.index, x: t },
    revision: get().revision + 1,
    message: null,
  });
}

const paramName = (mode: Modes["graphMode"]) => (mode === "par" ? "T" : mode === "pol" ? "θ" : "n");

function runCalc(op: string) {
  const st = get();
  if (st.modes.graphMode !== "func") {
    if (!FUNC_ONLY.has(op)) return runCurveCalc(op, st.modes.graphMode);
    set({ menu: null, screen: "graph" });
    return note("CALC needs Func mode");
  }
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
  if (p.op.startsWith("draw:")) return resolveDraw(p.op.slice(5), p.stage);
  if (p.op === "curveValue") {
    // The parameter was typed; put the trace and a mark on that point.
    const t = numberFromEntry();
    const curves = buildCurves(st.ys, st.modes, env);
    const active = st.trace ? curves.find((c) => c.index === st.trace!.fn) : curves[0];
    if (t === null || t === undefined || !active) {
      note("ERR: INVALID");
      return true;
    }
    const at = active.at(t);
    set({
      graphPrompt: null,
      entry: { text: "", caret: 0 },
      trace: { fn: active.index, x: t },
      marks: [{ kind: "point", label: "value", x: at.x, y: at.y, fn: active.index }],
      message: null,
      revision: st.revision + 1,
    });
    return true;
  }
  if (p.op === "prgm:point") {
    const c = st.cursor ?? centreCursor();
    provideProgramPoint(c.x, c.y);
    return true;
  }
  const idx = currentTraceFn();
  const f = idx >= 0 ? makeSampler(idx) : null;

  if (p.op === "value") {
    const x = numberFromEntry();
    if (x === null || x === undefined || !f) {
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
  const st = get();
  const mode = st.modes.graphMode;
  const start =
    mode === "func"
      ? (st.win.xmin + st.win.xmax) / 2
      : paramRange(mode, st.win).min;
  set({
    screen: "graph",
    menu: null,
    cursor: null,
    trace: st.trace ?? { fn: active[0].index, x: start },
    message: null,
  });
}

function stepTrace(dir: number) {
  const st = get();
  if (!st.trace) return false;
  const mode = st.modes.graphMode;
  if (mode === "func") {
    const step = ((st.win.xmax - st.win.xmin) / 94) * st.win.xres;
    set({
      trace: { ...st.trace, x: clamp(st.trace.x + dir * step, st.win.xmin, st.win.xmax) },
    });
    return true;
  }
  const { min, max, step } = paramRange(mode, st.win);
  set({ trace: { ...st.trace, x: clamp(st.trace.x + dir * step, min, max) } });
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

  return {
    enabledYs,
    makeSampler,
    startDraw,
    nudgeCursor,
    applyZoom,
    currentTraceFn,
    runCalc,
    resolveGraphPrompt,
    startTrace,
    stepTrace,
    switchTraceFn,
  };
}

import { formatNumber, formatTick } from "../math/format";
import { quartiles } from "../math/stats";
import { buildCurves, paramRange } from "../calc/curves";
import { PLOT_COLORS } from "../calc/colors";
import type {
  CalcMark, Drawing, GraphWindow, Modes, StatPlot, TraceState, YFunction,
} from "../calc/types";
import { sampler, type Env } from "../math/eval";
import { CHAR_H, CHAR_W, INK, Pen } from "./pen";

/** Everything the graph needs, passed in so this stays testable. */
export interface GraphInput {
  win: GraphWindow;
  ys: YFunction[];
  modes: Modes;
  marks: CalcMark[];
  drawings: Drawing[];
  trace: TraceState | null;
  /** the free cursor, shown while a DRAW command is waiting for a point */
  cursor: { x: number; y: number } | null;
  plots: StatPlot[];
  lists: number[][];
  env: Env;
  /** dot rows available below the status line */
  top: number;
}

/**
 * The panel thresholds alpha to one bit, so a dot is either lit or not —
 * translucency buys nothing. Depth comes from colour alone, which is why these
 * are three distinct shades rather than three opacities of one.
 */
const GRID_INK = "#24405c";
const AXIS_INK = "#7ba5cc";
const LABEL_INK = "#a8c6e4";

/** L₁…L₆ by name; anything unrecognised reads as empty rather than throwing. */
function listByName(lists: number[][], name: string): number[] {
  const i = "₁₂₃₄₅₆".indexOf(name.slice(-1));
  return i >= 0 ? (lists[i] ?? []) : [];
}

/** The three mark shapes the device offers for a scatter. */
function drawMark(
  pen: Pen,
  x: number,
  y: number,
  mark: StatPlot["mark"],
  ink: string,
) {
  if (mark === "dot") {
    pen.dot(x, y, ink);
    return;
  }
  if (mark === "box") {
    pen.hline(x - 1, x + 1, y - 1, ink);
    pen.hline(x - 1, x + 1, y + 1, ink);
    pen.vline(x - 1, y - 1, y + 1, ink);
    pen.vline(x + 1, y - 1, y + 1, ink);
    return;
  }
  pen.hline(x - 1, x + 1, y, ink);
  pen.vline(x, y - 1, y + 1, ink);
}

/** Compile an expression a drawing carries, lenient so gaps become gaps. */
function drawnSampler(env: Env, expr: string): ((x: number) => number) | null {
  try {
    return sampler(expr, { ...env, lenient: true, vars: { ...env.vars } });
  } catch {
    return null;
  }
}

function niceStep(range: number, targetCount: number): number {
  const raw = range / Math.max(1, targetCount);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

export function renderGraph(pen: Pen, g: GraphInput) {
  const { win } = g;
  const top = g.top;
  const h = pen.rows - top;
  const w = pen.cols;
  const spanX = win.xmax - win.xmin;
  const spanY = win.ymax - win.ymin;
  if (spanX <= 0 || spanY <= 0 || h <= 4) return;

  const px = (x: number) => ((x - win.xmin) / spanX) * (w - 1);
  const py = (y: number) => top + (h - 1) - ((y - win.ymin) / spanY) * (h - 1);

  // -- grid and axes --------------------------------------------------------
  const stepX =
    win.xscl > 0 && spanX / win.xscl <= 40 && spanX / win.xscl >= 2
      ? win.xscl
      : niceStep(spanX, Math.max(3, Math.round(w / 26)));
  const stepY =
    win.yscl > 0 && spanY / win.yscl <= 40 && spanY / win.yscl >= 2
      ? win.yscl
      : niceStep(spanY, Math.max(3, Math.round(h / 18)));

  if (g.modes.grid) {
    for (let i = Math.ceil(win.xmin / stepX); i * stepX <= win.xmax; i++) {
      pen.dottedV(Math.round(px(i * stepX)), top, top + h - 1, 4, GRID_INK);
    }
    for (let i = Math.ceil(win.ymin / stepY); i * stepY <= win.ymax; i++) {
      pen.dottedH(0, w - 1, Math.round(py(i * stepY)), 4, GRID_INK);
    }
  }

  const originVisibleX = win.xmin <= 0 && win.xmax >= 0;
  const originVisibleY = win.ymin <= 0 && win.ymax >= 0;
  const ax = Math.round(Math.min(Math.max(px(0), 0), w - 1));
  const ay = Math.round(Math.min(Math.max(py(0), top), top + h - 1));

  pen.hline(0, w - 1, ay, AXIS_INK);
  pen.vline(ax, top, top + h - 1, AXIS_INK);

  // tick marks along each axis
  for (let i = Math.ceil(win.xmin / stepX); i * stepX <= win.xmax; i++) {
    const x = Math.round(px(i * stepX));
    pen.vline(x, ay - 1, ay + 1, AXIS_INK);
  }
  for (let i = Math.ceil(win.ymin / stepY); i * stepY <= win.ymax; i++) {
    const y = Math.round(py(i * stepY));
    pen.hline(ax - 1, ax + 1, y, AXIS_INK);
  }

  // -- stat plots -----------------------------------------------------------
  // Box plots share the top of the field, one band each, so three of them can
  // be read against one another the way the device stacks them.
  let boxSlot = 0;

  for (const p of g.plots) {
    if (!p.on) continue;
    const xs = listByName(g.lists, p.xList);
    const ink = PLOT_COLORS[p.color % PLOT_COLORS.length];
    if (!xs.length) continue;
    // A frequency list says how many times each value occurred. It only makes
    // sense alongside a matching x list; a mismatched one is ignored rather
    // than allowed to draw something wrong.
    const rawFreq = p.freqList ? listByName(g.lists, p.freqList) : [];
    const freq = rawFreq.length === xs.length ? rawFreq : null;
    const weightAt = (i: number) => (freq ? freq[i] : 1);

    if (p.type === "hist") {
      // Xscl is the bin width, and the bars are counted from Xmin — the same
      // rule the device uses, which is why a bad Xscl gives a bad histogram
      // there too.
      const width = win.xscl > 0 ? win.xscl : niceStep(spanX, 10);
      const bins = Math.min(200, Math.ceil(spanX / width));
      const counts = new Array<number>(bins).fill(0);
      xs.forEach((v, i) => {
        const k = Math.floor((v - win.xmin) / width);
        if (k >= 0 && k < bins) counts[k] += weightAt(i);
      });
      const base = Math.round(py(Math.max(0, win.ymin)));
      for (let k = 0; k < bins; k++) {
        if (!counts[k]) continue;
        const left = Math.round(px(win.xmin + k * width));
        const right = Math.round(px(win.xmin + (k + 1) * width));
        const topY = Math.round(py(counts[k]));
        pen.vline(left, Math.min(topY, base), Math.max(topY, base), ink);
        pen.vline(right, Math.min(topY, base), Math.max(topY, base), ink);
        pen.hline(left, right, topY, ink);
      }
      continue;
    }

    if (p.type === "box" || p.type === "modbox") {
      const band = Math.max(9, Math.floor(h / 8));
      const mid = top + Math.round(band * (boxSlot + 0.5));
      boxSlot += 1;
      const half = Math.max(2, Math.floor(band / 3));
      const five = quartiles(xs, freq ?? undefined);

      // A modified box plot stops its whiskers at the last value within one
      // and a half interquartile ranges and draws what is beyond as points —
      // which is the only way a box plot shows you its outliers rather than
      // swallowing them into a long whisker.
      let lo = five.min;
      let hi = five.max;
      let outliers: number[] = [];
      if (p.type === "modbox") {
        const iqr = five.q3 - five.q1;
        const floor = five.q1 - 1.5 * iqr;
        const ceiling = five.q3 + 1.5 * iqr;
        const inside = xs.filter((v) => v >= floor && v <= ceiling);
        outliers = xs.filter((v) => v < floor || v > ceiling);
        lo = inside.length ? Math.min(...inside) : five.q1;
        hi = inside.length ? Math.max(...inside) : five.q3;
      }

      const [x0, x1, x2, x3, x4] = [lo, five.q1, five.med, five.q3, hi]
        .map((v) => Math.round(px(v)));
      // whiskers
      pen.hline(x0, x1, mid, ink);
      pen.hline(x3, x4, mid, ink);
      pen.vline(x0, mid - half + 1, mid + half - 1, ink);
      pen.vline(x4, mid - half + 1, mid + half - 1, ink);
      for (const v of outliers) drawMark(pen, Math.round(px(v)), mid, p.mark, ink);
      // the box, with the median across it
      pen.hline(x1, x3, mid - half, ink);
      pen.hline(x1, x3, mid + half, ink);
      pen.vline(x1, mid - half, mid + half, ink);
      pen.vline(x3, mid - half, mid + half, ink);
      pen.vline(x2, mid - half, mid + half, ink);
      continue;
    }

    const ys = listByName(g.lists, p.yList);
    const n = Math.min(xs.length, ys.length);
    if (p.type === "line") {
      for (let i = 1; i < n; i++) {
        pen.line(px(xs[i - 1]), py(ys[i - 1]), px(xs[i]), py(ys[i]), ink);
      }
    }
    for (let i = 0; i < n; i++) {
      // A weight of zero means the point was not observed, so it is not drawn.
      if (weightAt(i) === 0) continue;
      drawMark(pen, Math.round(px(xs[i])), Math.round(py(ys[i])), p.mark, ink);
    }
  }

  // -- curves ---------------------------------------------------------------
  const curves = buildCurves(g.ys, g.modes, g.env);
  for (const c of curves) {
    const ink = PLOT_COLORS[c.color % PLOT_COLORS.length];
    const dotted = c.style === "dot" || !g.modes.connected;
    const thick = c.style === "thick";

    const pts: { x: number; y: number; ok: boolean }[] = [];
    if (c.isFunction) {
      for (let i = 0; i <= w; i++) {
        const { y } = c.at(win.xmin + (i / (w - 1)) * spanX);
        pts.push({ x: i, y: py(y), ok: Number.isFinite(y) });
      }
    } else {
      const { min, max } = paramRange(g.modes.graphMode, win);
      const n = Math.min(4000, Math.max(60, w * 4));
      for (let i = 0; i <= n; i++) {
        const t = min + ((max - min) * i) / n;
        const p = c.at(t);
        pts.push({
          x: px(p.x),
          y: py(p.y),
          ok: Number.isFinite(p.x) && Number.isFinite(p.y),
        });
      }
    }

    const inRange = (y: number) => y >= top - 2 && y <= top + h + 1;
    let prev: { x: number; y: number } | null = null;

    for (const p of pts) {
      if (!p.ok) {
        prev = null;
        continue;
      }
      if (dotted) {
        if (inRange(p.y)) pen.dot(p.x, p.y, ink);
        prev = p;
        continue;
      }
      if (prev) {
        // A jump taller than the panel is an asymptote, not a segment.
        const jump = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (jump < h * 1.5) {
          pen.line(prev.x, prev.y, p.x, p.y, ink);
          if (thick) pen.line(prev.x, prev.y + 1, p.x, p.y + 1, ink);
        }
      } else if (inRange(p.y)) {
        pen.dot(p.x, p.y, ink);
      }
      prev = p;
    }
  }

  // -- calc marks -----------------------------------------------------------
  for (const m of g.marks) {
    const c = curves.find((cv) => cv.index === m.fn);
    const ink = INK.accent;

    if (m.kind === "area" && c && m.x2 !== undefined) {
      const a = Math.min(m.x, m.x2);
      const b = Math.max(m.x, m.x2);
      const zero = Math.round(py(0));
      for (let i = Math.round(px(a)); i <= Math.round(px(b)); i++) {
        const t = win.xmin + (i / (w - 1)) * spanX;
        const { y } = c.at(t);
        if (!Number.isFinite(y)) continue;
        const yy = Math.round(py(y));
        // hatch the region rather than flood it — a flat fill would swallow
        // the curve on a one-bit panel
        for (let k = Math.min(yy, zero); k <= Math.max(yy, zero); k += 3) {
          if ((i + k) % 2 === 0) pen.dot(i, k, ink);
        }
      }
      pen.vline(Math.round(px(a)), top, top + h - 1, ink);
      pen.vline(Math.round(px(b)), top, top + h - 1, ink);
    }

    if (m.kind === "tangent" && m.slope !== undefined) {
      const x0 = win.xmin;
      const x1 = win.xmax;
      pen.line(
        px(x0), py(m.y + m.slope * (x0 - m.x)),
        px(x1), py(m.y + m.slope * (x1 - m.x)),
        ink,
      );
    }

    const mx = Math.round(px(m.x));
    const my = Math.round(py(m.y));
    pen.dottedV(mx, top, top + h - 1, 2, ink);
    pen.dottedH(0, w - 1, my, 2, ink);
    pen.fill(mx - 1, my - 1, 3, 3, ink);
  }

  // -- drawings -------------------------------------------------------------
  // Above the curves, because a drawing is the last thing put on the glass.
  for (const d of g.drawings) {
    const x = Math.round(px(d.x));
    const y = Math.round(py(d.y));
    switch (d.kind) {
      case "line":
        pen.line(x, y, Math.round(px(d.x2 ?? d.x)), Math.round(py(d.y2 ?? d.y)), INK.on);
        break;
      case "hline":
        pen.hline(0, w - 1, y, INK.on);
        break;
      case "vline":
        pen.vline(x, top, top + h - 1, INK.on);
        break;
      case "circle": {
        // The radius is set in graph units and drawn in dots, so a window that
        // is not square gives an ellipse — which is what the device does too.
        const rx = Math.abs(px(d.x2 ?? d.x) - x);
        const ry = Math.abs(py(d.y2 ?? d.y) - y);
        const r = Math.hypot(rx, ry);
        if (r < 0.5) break;
        const steps = Math.max(24, Math.round(r * 6));
        let prev: [number, number] | null = null;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const p: [number, number] = [
            Math.round(x + r * Math.cos(t)),
            Math.round(y + r * Math.sin(t)),
          ];
          if (prev) pen.line(prev[0], prev[1], p[0], p[1], INK.on);
          prev = p;
        }
        break;
      }
      case "point":
        if (d.erase) pen.erase(x - 1, y - 1, 3, 3);
        else pen.fill(x - 1, y - 1, 3, 3, INK.on);
        break;
      case "text":
        if (d.label) pen.text(Math.round(x / CHAR_W), Math.round(y / CHAR_H), d.label, INK.on);
        break;

      case "curve": {
        // Drawn, not slotted: sampled here rather than by the plotter, since
        // it has no Y slot and no style to inherit.
        if (!d.expr) break;
        const f = drawnSampler(g.env, d.expr);
        if (!f) break;
        let prev: [number, number] | null = null;
        const steps = d.inverse ? h : w;
        for (let i = 0; i <= steps; i++) {
          // DrawInv reflects in y = x, so the roles of the axes swap: the
          // parameter runs down the y range and the value lands on x.
          const t = d.inverse
            ? win.ymin + (i / steps) * spanY
            : win.xmin + (i / steps) * spanX;
          const v = f(t);
          if (!Number.isFinite(v)) { prev = null; continue; }
          const at: [number, number] = d.inverse
            ? [Math.round(px(v)), Math.round(py(t))]
            : [Math.round(px(t)), Math.round(py(v))];
          if (prev) pen.line(prev[0], prev[1], at[0], at[1], INK.on);
          prev = at;
        }
        break;
      }

      case "shade": {
        // The region between two curves, hatched rather than flooded — a
        // flat fill would swallow both of them on a one-bit panel.
        if (!d.expr) break;
        const lower = drawnSampler(g.env, d.expr);
        const upper = d.expr2 ? drawnSampler(g.env, d.expr2) : null;
        if (!lower) break;
        for (let i = 0; i <= w; i++) {
          const t = win.xmin + (i / (w - 1)) * spanX;
          const a = lower(t);
          const b = upper ? upper(t) : win.ymax;
          if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
          const lo = Math.round(py(Math.max(a, b)));
          const hi = Math.round(py(Math.min(a, b)));
          for (let k = Math.min(lo, hi); k <= Math.max(lo, hi); k += 3) {
            if ((i + k) % 2 === 0) pen.dot(i, k, INK.on);
          }
        }
        break;
      }
    }
  }

  // -- the free cursor, while a DRAW command is placing a point -------------
  if (g.cursor && !g.trace) {
    const cx = Math.round(px(g.cursor.x));
    const cy = Math.round(py(g.cursor.y));
    pen.hline(cx - 3, cx + 3, cy, INK.accent);
    pen.vline(cx, cy - 3, cy + 3, INK.accent);
  }

  // -- trace cursor ---------------------------------------------------------
  if (g.trace) {
    const c = curves.find((cv) => cv.index === g.trace!.fn);
    if (c) {
      const p = c.at(g.trace.x);
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        const cx = Math.round(px(p.x));
        const cy = Math.round(py(p.y));
        pen.dottedV(cx, top, top + h - 1, 2, INK.on);
        pen.dottedH(0, w - 1, cy, 2, INK.on);
        // an open square reads as a cursor even sitting on the curve
        pen.frame(cx - 2, cy - 2, 5, 5, INK.on);
      }
    }
  }

  // -- axis labels ----------------------------------------------------------
  if (g.modes.labelAxes) {
    const gapX = Math.max(1, Math.ceil((CHAR_W * 5) / ((stepX / spanX) * w)));
    for (let i = Math.ceil(win.xmin / stepX); i * stepX <= win.xmax; i++) {
      if (i % gapX !== 0) continue;
      const v = i * stepX;
      if (v === 0) continue;
      const label = formatTick(v, stepX);
      const x = Math.round(px(v)) - (label.length * CHAR_W) / 2;
      if (x < 0 || x + label.length * CHAR_W > w) continue;
      const y = originVisibleY
        ? Math.min(ay + 2, top + h - CHAR_H)
        : top + h - CHAR_H;
      pen.textAt(x, y, label, LABEL_INK);
    }

    const gapY = Math.max(1, Math.ceil(CHAR_H * 1.6 / ((stepY / spanY) * h)));
    for (let i = Math.ceil(win.ymin / stepY); i * stepY <= win.ymax; i++) {
      if (i % gapY !== 0) continue;
      const v = i * stepY;
      if (v === 0) continue;
      const label = formatTick(v, stepY);
      const y = Math.round(py(v)) - 4;
      if (y < top || y + CHAR_H > top + h) continue;
      const x = originVisibleX
        ? Math.max(0, ax - 2 - label.length * CHAR_W)
        : w - label.length * CHAR_W;
      pen.textAt(x, y, label, LABEL_INK);
    }
  }
}

/** The bottom strip: which curve is traced and where the cursor sits. */
export function graphReadout(g: GraphInput): string[] | null {
  const fmt = {
    notation: g.modes.notation,
    decimals: g.modes.decimals >= 0 ? g.modes.decimals : 5,
  };
  const trim = (s: string) =>
    s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;

  if (!g.trace) return null;
  const curves = buildCurves(g.ys, g.modes, g.env);
  const c = curves.find((cv) => cv.index === g.trace!.fn);
  if (!c) return null;
  const p = c.at(g.trace.x);
  const finite = Number.isFinite(p.x) && Number.isFinite(p.y);
  const out = [c.label];
  if (!c.isFunction) {
    const label =
      g.modes.graphMode === "pol" ? "θ" : g.modes.graphMode === "seq" ? "n" : "T";
    out.push(`${label}=${trim(formatNumber(g.trace.x, fmt))}`);
  }
  out.push(`X=${finite ? trim(formatNumber(p.x, fmt)) : "-"}`);
  out.push(`Y=${finite ? trim(formatNumber(p.y, fmt)) : "-"}`);
  return out;
}

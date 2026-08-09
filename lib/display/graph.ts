import { formatNumber, formatTick } from "../math/format";
import { buildCurves, paramRange } from "../calc/curves";
import { PLOT_COLORS } from "../calc/colors";
import type { CalcMark, GraphWindow, Modes, StatPlot, TraceState, YFunction } from "../calc/types";
import type { Env } from "../math/eval";
import { CHAR_H, CHAR_W, INK, Pen } from "./pen";

/** Everything the graph needs, passed in so this stays testable. */
export interface GraphInput {
  win: GraphWindow;
  ys: YFunction[];
  modes: Modes;
  marks: CalcMark[];
  trace: TraceState | null;
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
  for (const p of g.plots) {
    if (!p.on) continue;
    const xs = g.lists[0];
    const ys = g.lists[1];
    const n = Math.min(xs.length, ys.length);
    const ink = PLOT_COLORS[p.color % PLOT_COLORS.length];
    if (p.type === "line") {
      for (let i = 1; i < n; i++) {
        pen.line(px(xs[i - 1]), py(ys[i - 1]), px(xs[i]), py(ys[i]), ink);
      }
    }
    for (let i = 0; i < n; i++) {
      const cx = Math.round(px(xs[i]));
      const cy = Math.round(py(ys[i]));
      pen.hline(cx - 1, cx + 1, cy, ink);
      pen.vline(cx, cy - 1, cy + 1, ink);
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
    const label = g.modes.graphMode === "pol" ? "θ" : "T";
    out.push(`${label}=${trim(formatNumber(g.trace.x, fmt))}`);
  }
  out.push(`X=${finite ? trim(formatNumber(p.x, fmt)) : "-"}`);
  out.push(`Y=${finite ? trim(formatNumber(p.y, fmt)) : "-"}`);
  return out;
}

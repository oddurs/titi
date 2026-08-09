"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sampler } from "@/lib/math/eval";
import { formatNumber, formatTick } from "@/lib/math/format";
import { PLOT_COLORS, reportAspect, useCalc } from "@/lib/calc/store";
import type { GraphWindow } from "@/lib/calc/types";

interface Curve {
  index: number;
  color: string;
  width: number;
  dotted: boolean;
  f: (x: number) => number;
}

const AXIS = "rgba(233,238,245,0.42)";
const GRID = "rgba(233,238,245,0.055)";
const GRID_STRONG = "rgba(233,238,245,0.1)";

/** Drop trailing zeros a fixed-decimal format leaves behind. */
const trim = (s: string) =>
  s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;

export default function Plot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const win = useCalc((s) => s.win);
  const ys = useCalc((s) => s.ys);
  const modes = useCalc((s) => s.modes);
  const marks = useCalc((s) => s.marks);
  const trace = useCalc((s) => s.trace);
  const plots = useCalc((s) => s.plots);
  const lists = useCalc((s) => s.lists);
  const cursor = useCalc((s) => s.cursor);
  const graphPrompt = useCalc((s) => s.graphPrompt);
  const revision = useCalc((s) => s.revision);
  const env = useCalc((s) => s.env);
  const setWindow = useCalc((s) => s.setWindow);
  const setTrace = useCalc((s) => s.setTrace);
  const setCursor = useCalc((s) => s.setCursor);

  // -- geometry -------------------------------------------------------------

  const { w, h } = size;
  const toPx = useCallback(
    (x: number) => ((x - win.xmin) / (win.xmax - win.xmin)) * w,
    [win.xmin, win.xmax, w],
  );
  const toPy = useCallback(
    (y: number) => h - ((y - win.ymin) / (win.ymax - win.ymin)) * h,
    [win.ymin, win.ymax, h],
  );
  const toX = useCallback(
    (px: number) => win.xmin + (px / w) * (win.xmax - win.xmin),
    [win.xmin, win.xmax, w],
  );
  const toY = useCallback(
    (py: number) => win.ymin + ((h - py) / h) * (win.ymax - win.ymin),
    [win.ymin, win.ymax, h],
  );

  const curves: Curve[] = useMemo(() => {
    const out: Curve[] = [];
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      if (!y.on || !y.expr.trim()) continue;
      try {
        const local = { ...env, lenient: true, vars: { ...env.vars } };
        out.push({
          index: i,
          color: PLOT_COLORS[y.color % PLOT_COLORS.length],
          width: y.style === "thick" ? 3.4 : 2.1,
          dotted: y.style === "dot" || !modes.connected,
          f: sampler(y.expr, local),
        });
      } catch {
        /* an unparseable Y is simply not drawn */
      }
    }
    return out;
    // env is mutated in place by the store; revision is the redraw signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ys, modes.connected, revision, env]);

  // -- resize ---------------------------------------------------------------

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
      reportAspect(r.width / Math.max(1, r.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -- draw -----------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Canvas can't read CSS variables, so resolve the mono stack once per draw.
    const monoFamily =
      getComputedStyle(canvas).getPropertyValue("--font-mono").trim() ||
      "ui-monospace";

    drawGrid(ctx, win, w, h, modes.grid);
    drawStatPlots(ctx, plots, lists, toPx, toPy);
    for (const c of curves) drawCurve(ctx, c, win, w, h, toPx, toPy);
    if (modes.labelAxes) drawAxisLabels(ctx, win, w, h, monoFamily);
    drawMarks(ctx, marks, curves, toPx, toPy, w, h);
    drawTrace(ctx, trace, curves, toPx, toPy, w, h, graphPrompt);
    if (box) drawZoomBox(ctx, box);
  }, [
    w, h, win, curves, modes.grid, modes.labelAxes, marks, trace, plots, lists,
    box, graphPrompt, revision, toPx, toPy,
  ]);

  // -- pointer --------------------------------------------------------------

  const drag = useRef<{
    mode: "pan" | "trace" | "box" | "pinch";
    startX: number;
    startY: number;
    win: GraphWindow;
    moved: boolean;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; win: GraphWindow; cx: number; cy: number } | null>(null);

  const localPoint = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        win: { ...win },
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      drag.current = null;
      return;
    }

    if (graphPrompt?.op === "box") {
      setBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      drag.current = { mode: "box", startX: p.x, startY: p.y, win: { ...win }, moved: false };
      return;
    }

    if (trace) {
      setTrace({ ...trace, x: toX(p.x) });
      drag.current = { mode: "trace", startX: p.x, startY: p.y, win: { ...win }, moved: false };
      return;
    }

    drag.current = { mode: "pan", startX: p.x, startY: p.y, win: { ...win }, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = localPoint(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const k = pinch.current.dist / Math.max(8, dist);
      const base = pinch.current.win;
      const ax = base.xmin + (pinch.current.cx / w) * (base.xmax - base.xmin);
      const ay = base.ymin + ((h - pinch.current.cy) / h) * (base.ymax - base.ymin);
      setWindow({
        xmin: ax + (base.xmin - ax) * k,
        xmax: ax + (base.xmax - ax) * k,
        ymin: ay + (base.ymin - ay) * k,
        ymax: ay + (base.ymax - ay) * k,
      });
      return;
    }

    const d = drag.current;
    if (!d) {
      if (!trace) setCursor({ x: toX(p.x), y: toY(p.y) });
      return;
    }
    if (Math.abs(p.x - d.startX) + Math.abs(p.y - d.startY) > 3) d.moved = true;

    if (d.mode === "box") {
      setBox({ x0: d.startX, y0: d.startY, x1: p.x, y1: p.y });
      return;
    }
    if (d.mode === "trace" && trace) {
      setTrace({ ...trace, x: toX(p.x) });
      return;
    }
    if (d.mode === "pan") {
      const dx = ((p.x - d.startX) / w) * (d.win.xmax - d.win.xmin);
      const dy = ((p.y - d.startY) / h) * (d.win.ymax - d.win.ymin);
      setWindow({
        xmin: d.win.xmin - dx,
        xmax: d.win.xmax - dx,
        ymin: d.win.ymin + dy,
        ymax: d.win.ymax + dy,
      });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;

    if (d?.mode === "box" && box) {
      const x0 = toX(Math.min(box.x0, box.x1));
      const x1 = toX(Math.max(box.x0, box.x1));
      const y0 = toY(Math.max(box.y0, box.y1));
      const y1 = toY(Math.min(box.y0, box.y1));
      setBox(null);
      useCalc.setState({ graphPrompt: null, message: null });
      if (Math.abs(x1 - x0) > 1e-9 && Math.abs(y1 - y0) > 1e-9) {
        setWindow({ xmin: x0, xmax: x1, ymin: y0, ymax: y1 });
      }
    }
  }

  function onWheel(e: React.WheelEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const k = Math.exp(e.deltaY * 0.0016);
    const ax = toX(px);
    const ay = toY(py);
    setWindow({
      xmin: ax + (win.xmin - ax) * k,
      xmax: ax + (win.xmax - ax) * k,
      ymin: ay + (win.ymin - ay) * k,
      ymax: ay + (win.ymax - ay) * k,
    });
  }

  // -- readout --------------------------------------------------------------

  const readout = useMemo(() => {
    // The readout bar is a fixed-width strip, so it gets its own tighter
    // precision rather than the home screen's ten significant digits.
    const fmt = {
      notation: modes.notation,
      decimals: modes.decimals >= 0 ? modes.decimals : 6,
    };
    if (trace) {
      const c = curves.find((cv) => cv.index === trace.fn);
      if (!c) return null;
      const y = c.f(trace.x);
      return {
        color: c.color,
        name: ys[trace.fn]?.name ?? "",
        x: trim(formatNumber(trace.x, fmt)),
        y: Number.isFinite(y) ? trim(formatNumber(y, fmt)) : "—",
      };
    }
    if (cursor && modes.coordsOn) {
      return {
        color: "var(--muted)",
        name: "",
        x: trim(formatNumber(cursor.x, fmt)),
        y: trim(formatNumber(cursor.y, fmt)),
      };
    }
    return null;
  }, [trace, cursor, curves, ys, modes]);

  const markChip = marks[0];
  const fmt = { notation: modes.notation, decimals: modes.decimals };

  return (
    <div
      ref={wrapRef}
      className="graph-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onWheel={onWheel}
    >
      <canvas ref={canvasRef} className="graph-canvas" />

      {readout && (
        <div className="readout-bar">
          {readout.name && <b style={{ color: readout.color }}>{readout.name}</b>}
          <span>
            <b>x</b> {readout.x}
          </span>
          <span>
            <b>y</b> {readout.y}
          </span>
        </div>
      )}

      {markChip && (
        <div
          className="readout"
          style={{
            left: 12,
            top: 12,
            borderColor: "color-mix(in oklab, var(--amber) 45%, transparent)",
          }}
        >
          <b style={{ color: "var(--amber)" }}>{markChip.label}</b>
          {markChip.kind === "area" ? (
            <span>{formatNumber(markChip.y, fmt)}</span>
          ) : markChip.kind === "tangent" ? (
            <span>{formatNumber(markChip.slope ?? 0, fmt)}</span>
          ) : (
            <>
              <span>
                <b>x</b> {formatNumber(markChip.x, fmt)}
              </span>
              <span>
                <b>y</b> {formatNumber(markChip.y, fmt)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// canvas painting
// ---------------------------------------------------------------------------

function niceStep(range: number, targetCount: number): number {
  const raw = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  win: GraphWindow,
  w: number,
  h: number,
  showGrid: boolean,
) {
  const spanX = win.xmax - win.xmin;
  const spanY = win.ymax - win.ymin;
  if (spanX <= 0 || spanY <= 0) return;

  // Honour Xscl/Yscl, but fall back to a readable step when they'd flood the
  // canvas or vanish entirely.
  const autoX = niceStep(spanX, Math.max(4, Math.round(w / 90)));
  const autoY = niceStep(spanY, Math.max(3, Math.round(h / 70)));
  const stepX = win.xscl > 0 && spanX / win.xscl <= 60 && spanX / win.xscl >= 3 ? win.xscl : autoX;
  const stepY = win.yscl > 0 && spanY / win.yscl <= 60 && spanY / win.yscl >= 3 ? win.yscl : autoY;

  const px = (x: number) => ((x - win.xmin) / spanX) * w;
  const py = (y: number) => h - ((y - win.ymin) / spanY) * h;

  if (showGrid) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(win.xmin / stepX); i * stepX <= win.xmax; i++) {
      const x = Math.round(px(i * stepX)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let i = Math.ceil(win.ymin / stepY); i * stepY <= win.ymax; i++) {
      const y = Math.round(py(i * stepY)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.strokeStyle = GRID;
    ctx.stroke();
  }

  // axes, pinned to the edge when the origin is off-screen
  const ax = Math.min(Math.max(px(0), 0.5), w - 0.5);
  const ay = Math.min(Math.max(py(0), 0.5), h - 0.5);

  ctx.lineWidth = 1.25;
  ctx.strokeStyle = AXIS;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(ay) + 0.5);
  ctx.lineTo(w, Math.round(ay) + 0.5);
  ctx.moveTo(Math.round(ax) + 0.5, 0);
  ctx.lineTo(Math.round(ax) + 0.5, h);
  ctx.stroke();

  // ticks
  ctx.strokeStyle = GRID_STRONG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = Math.ceil(win.xmin / stepX); i * stepX <= win.xmax; i++) {
    const x = Math.round(px(i * stepX)) + 0.5;
    ctx.moveTo(x, ay - 4);
    ctx.lineTo(x, ay + 4);
  }
  for (let i = Math.ceil(win.ymin / stepY); i * stepY <= win.ymax; i++) {
    const y = Math.round(py(i * stepY)) + 0.5;
    ctx.moveTo(ax - 4, y);
    ctx.lineTo(ax + 4, y);
  }
  ctx.stroke();

}

/**
 * Tick captions, painted after the curves with a dark halo so a busy plot
 * never swallows the scale.
 */
function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  win: GraphWindow,
  w: number,
  h: number,
  monoFamily: string,
) {
  const spanX = win.xmax - win.xmin;
  const spanY = win.ymax - win.ymin;
  if (spanX <= 0 || spanY <= 0) return;

  const autoX = niceStep(spanX, Math.max(4, Math.round(w / 90)));
  const autoY = niceStep(spanY, Math.max(3, Math.round(h / 70)));
  const stepX = win.xscl > 0 && spanX / win.xscl <= 60 && spanX / win.xscl >= 3 ? win.xscl : autoX;
  const stepY = win.yscl > 0 && spanY / win.yscl <= 60 && spanY / win.yscl >= 3 ? win.yscl : autoY;

  const px = (x: number) => ((x - win.xmin) / spanX) * w;
  const py = (y: number) => h - ((y - win.ymin) / spanY) * h;

  const ax = Math.min(Math.max(px(0), 0.5), w - 0.5);
  const ay = Math.min(Math.max(py(0), 0.5), h - 0.5);
  const originVisibleX = win.xmin <= 0 && win.xmax >= 0;
  const originVisibleY = win.ymin <= 0 && win.ymax >= 0;

  ctx.save();
  ctx.font = `10px ${monoFamily}, ui-monospace, monospace`;
  ctx.fillStyle = "rgba(233,238,245,0.55)";
  ctx.shadowColor = "rgba(8,13,21,0.95)";
  ctx.shadowBlur = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const labelGapX = Math.max(1, Math.ceil(48 / ((stepX / spanX) * w)));
  for (let i = Math.ceil(win.xmin / stepX); i * stepX <= win.xmax; i++) {
    if (i % labelGapX !== 0) continue;
    const v = i * stepX;
    if (v === 0) continue;
    const x = px(v);
    if (x < 14 || x > w - 14) continue;
    const yPos = originVisibleY ? Math.min(ay + 6, h - 14) : h - 14;
    ctx.fillText(formatTick(v, stepX), x, yPos);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const labelGapY = Math.max(1, Math.ceil(28 / ((stepY / spanY) * h)));
  for (let i = Math.ceil(win.ymin / stepY); i * stepY <= win.ymax; i++) {
    if (i % labelGapY !== 0) continue;
    const v = i * stepY;
    if (v === 0) continue;
    const y = py(v);
    if (y < 10 || y > h - 10) continue;
    const xPos = originVisibleX ? Math.max(ax - 7, 34) : w - 6;
    ctx.fillText(formatTick(v, stepY), xPos, y);
  }

  if (originVisibleX && originVisibleY) {
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("0", ax - 6, ay + 5);
  }
  ctx.restore();
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  c: Curve,
  win: GraphWindow,
  w: number,
  h: number,
  toPx: (x: number) => number,
  toPy: (y: number) => number,
) {
  const step = Math.max(0.4, 0.5 * win.xres);
  const spanX = win.xmax - win.xmin;

  if (c.dotted) {
    ctx.fillStyle = c.color;
    for (let px = 0; px <= w; px += Math.max(2.5, step * 4)) {
      const y = c.f(win.xmin + (px / w) * spanX);
      if (!Number.isFinite(y)) continue;
      const py = toPy(y);
      if (py < -20 || py > h + 20) continue;
      ctx.beginPath();
      ctx.arc(px, py, c.width * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const path = new Path2D();
  let drawing = false;
  let prevY = NaN;
  let prevPy = NaN;

  for (let px = 0; px <= w + step; px += step) {
    const x = win.xmin + (px / w) * spanX;
    const y = c.f(x);

    if (!Number.isFinite(y)) {
      drawing = false;
      prevY = NaN;
      continue;
    }

    const py = Math.max(-1e5, Math.min(1e5, toPy(y)));

    // Break at a pole: a huge jump that flips sign is an asymptote, not a line.
    if (drawing && Number.isFinite(prevY)) {
      const jump = Math.abs(py - prevPy);
      if (jump > h * 1.5 && prevY * y < 0) drawing = false;
    }

    if (!drawing) {
      path.moveTo(px, py);
      drawing = true;
    } else {
      path.lineTo(px, py);
    }
    prevY = y;
    prevPy = py;
  }

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = c.color;

  // a soft bloom, then the crisp core — the curve reads as emitted light
  ctx.shadowColor = c.color;
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = c.width;
  ctx.stroke(path);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.lineWidth = c.width;
  ctx.stroke(path);
  ctx.restore();
}

function drawStatPlots(
  ctx: CanvasRenderingContext2D,
  plots: { on: boolean; type: string; color: number; mark: string }[],
  lists: number[][],
  toPx: (x: number) => number,
  toPy: (y: number) => number,
) {
  for (const p of plots) {
    if (!p.on) continue;
    const xs = lists[0];
    const ys = lists[1];
    const n = Math.min(xs.length, ys.length);
    if (n === 0) continue;
    const color = PLOT_COLORS[p.color % PLOT_COLORS.length];

    if (p.type === "line") {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = toPx(xs[i]);
        const py = toPy(ys[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const px = toPx(xs[i]);
      const py = toPy(ys[i]);
      ctx.beginPath();
      ctx.moveTo(px - 4, py);
      ctx.lineTo(px + 4, py);
      ctx.moveTo(px, py - 4);
      ctx.lineTo(px, py + 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawMarks(
  ctx: CanvasRenderingContext2D,
  marks: { kind: string; x: number; y: number; x2?: number; slope?: number; fn: number }[],
  curves: Curve[],
  toPx: (x: number) => number,
  toPy: (y: number) => number,
  w: number,
  h: number,
) {
  for (const m of marks) {
    const c = curves.find((cv) => cv.index === m.fn);
    const color = c?.color ?? "#FFB454";

    if (m.kind === "area" && c && m.x2 !== undefined) {
      const a = Math.min(m.x, m.x2);
      const b = Math.max(m.x, m.x2);
      const pa = toPx(a);
      const pb = toPx(b);
      const zero = toPy(0);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `${color}44`);
      grad.addColorStop(1, `${color}12`);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pa, zero);
      for (let px = pa; px <= pb; px += 1) {
        const y = c.f(a + ((px - pa) / Math.max(1, pb - pa)) * (b - a));
        ctx.lineTo(px, Number.isFinite(y) ? toPy(y) : zero);
      }
      ctx.lineTo(pb, zero);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = `${color}66`;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pa, 0);
      ctx.lineTo(pa, h);
      ctx.moveTo(pb, 0);
      ctx.lineTo(pb, h);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    if (m.kind === "tangent" && m.slope !== undefined) {
      ctx.save();
      ctx.strokeStyle = "#FFB454";
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      const spanScreen = w;
      const x0 = m.x - spanScreen;
      const x1 = m.x + spanScreen;
      ctx.moveTo(toPx(x0), toPy(m.y + m.slope * (x0 - m.x)));
      ctx.lineTo(toPx(x1), toPy(m.y + m.slope * (x1 - m.x)));
      ctx.stroke();
      ctx.restore();
    }

    const px = toPx(m.x);
    const py = toPy(m.y);
    ctx.save();
    ctx.strokeStyle = "#FFB454";
    ctx.fillStyle = "#FFB454";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(8,13,21,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  trace: { fn: number; x: number } | null,
  curves: Curve[],
  toPx: (x: number) => number,
  toPy: (y: number) => number,
  w: number,
  h: number,
  prompt: { op: string; stage: number; lower?: number } | null,
) {
  if (!trace) return;
  const c = curves.find((cv) => cv.index === trace.fn);
  if (!c) return;
  const y = c.f(trace.x);
  const px = toPx(trace.x);
  const py = toPy(y);

  if (prompt?.op === "integral" && prompt.lower !== undefined) {
    const pl = toPx(prompt.lower);
    ctx.save();
    ctx.fillStyle = `${c.color}18`;
    ctx.fillRect(Math.min(pl, px), 0, Math.abs(px - pl), h);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(233,238,245,0.28)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(px + 0.5, 0);
  ctx.lineTo(px + 0.5, h);
  if (Number.isFinite(y)) {
    ctx.moveTo(0, py + 0.5);
    ctx.lineTo(w, py + 0.5);
  }
  ctx.stroke();
  ctx.restore();

  if (!Number.isFinite(y)) return;

  ctx.save();
  ctx.shadowColor = c.color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#080d15";
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawZoomBox(
  ctx: CanvasRenderingContext2D,
  box: { x0: number; y0: number; x1: number; y1: number },
) {
  const x = Math.min(box.x0, box.x1);
  const y = Math.min(box.y0, box.y1);
  const bw = Math.abs(box.x1 - box.x0);
  const bh = Math.abs(box.y1 - box.y0);
  ctx.save();
  ctx.fillStyle = "rgba(90,169,255,0.1)";
  ctx.strokeStyle = "rgba(90,169,255,0.8)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeRect(x + 0.5, y + 0.5, bw, bh);
  ctx.restore();
}

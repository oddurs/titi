"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DotPanel } from "@/lib/display/panel";
import { CHAR_H, Pen } from "@/lib/display/pen";
import { renderFailure, renderScreen, type HitRegion } from "@/lib/display/screens";
import { useCalc } from "@/lib/calc/store";
import type { GraphWindow } from "@/lib/calc/types";

/**
 * The display is a single dot-matrix panel. Every screen renders into it —
 * there is no DOM inside the glass, because a real panel has none. Taps are
 * mapped back to rows through the hit regions each renderer reports.
 */
export default function Screen() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<DotPanel | null>(null);
  const hitsRef = useRef<HitRegion[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [transcript, setTranscript] = useState<string[]>([]);
  // Almost everything comes from the character ROM, but canvas cannot resolve
  // CSS variables in ctx.font and never triggers a font download on its own —
  // so the fallback stack is resolved and loaded before the first paint.
  const [fontStack, setFontStack] = useState("8px monospace");

  // Subscribing to the whole store is right here: any change repaints the glass.
  const state = useCalc();

  useEffect(() => {
    let cancelled = false;
    const css = getComputedStyle(document.body);
    const mono = css.getPropertyValue("--font-mono").trim();
    const stack = `8px ${mono}, ui-monospace, monospace`;

    Promise.all([document.fonts.load(`8px ${mono}`)])
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setFontStack(stack);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -- paint ----------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w < 8 || size.h < 8) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    if (!panelRef.current) panelRef.current = new DotPanel();
    const panel = panelRef.current;
    const m = panel.resize(size.w, size.h, dpr);

    canvas.width = m.cols * m.dot;
    canvas.height = m.rows * m.dot;
    canvas.style.width = `${m.cssWidth}px`;
    canvas.style.height = `${m.cssHeight}px`;

    const target = canvas.getContext("2d");
    if (!target) return;

    panel.begin();
    const pen = new Pen(panel.ctx, m.cols, m.rows, fontStack);
    try {
      hitsRef.current = renderScreen(pen, state);
    } catch (e) {
      // One bad frame must not leave the glass blank with no way back.
      panel.begin();
      hitsRef.current = [];
      renderFailure(
        new Pen(panel.ctx, m.cols, m.rows, fontStack),
        e instanceof Error ? e.message : String(e),
      );
    }
    panel.present(target);
    setTranscript(pen.transcript());
  }, [size, state, fontStack]);

  // -- pointer --------------------------------------------------------------

  const toDot = useCallback((e: React.PointerEvent) => {
    const panel = panelRef.current;
    const canvas = canvasRef.current;
    if (!panel || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    const scale = panel.metrics.cols / r.width;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
  }, []);

  const graphGeom = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return null;
    const { cols, rows } = panel.metrics;
    const top = CHAR_H + 2;
    return { cols, rows, top, h: rows - top };
  }, []);

  const drag = useRef<{
    mode: "pan" | "trace";
    startX: number;
    startY: number;
    win: GraphWindow;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; win: GraphWindow; cx: number; cy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    const p = toDot(e);
    if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, p);

    const hit = hitsRef.current.find(
      (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
    );
    if (hit) {
      const s = useCalc.getState();
      if (hit.kind === "menuTab" && s.menu) {
        useCalc.setState({ menu: { ...s.menu, tab: hit.index, index: 0 } });
        return;
      }
      if (hit.kind === "menuItem" && s.menu) {
        useCalc.setState({ menu: { ...s.menu, index: hit.index } });
        s.press("enter");
        return;
      }
      if (hit.kind === "row") {
        s.selectRow(hit.index);
        return;
      }
    }

    if (state.screen !== "graph") return;

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        win: { ...state.win },
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      drag.current = null;
      return;
    }

    const g = graphGeom();
    if (!g) return;
    if (state.trace && state.modes.graphMode === "func") {
      const x = state.win.xmin + (p.x / (g.cols - 1)) * (state.win.xmax - state.win.xmin);
      state.setTrace({ ...state.trace, x });
      drag.current = { mode: "trace", startX: p.x, startY: p.y, win: { ...state.win } };
      return;
    }
    drag.current = { mode: "pan", startX: p.x, startY: p.y, win: { ...state.win } };
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toDot(e);
    if (!p) return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    const g = graphGeom();
    if (!g) return;

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const k = pinch.current.dist / Math.max(4, dist);
      const base = pinch.current.win;
      const ax = base.xmin + (pinch.current.cx / (g.cols - 1)) * (base.xmax - base.xmin);
      const ay =
        base.ymin +
        ((g.top + g.h - 1 - pinch.current.cy) / (g.h - 1)) * (base.ymax - base.ymin);
      state.setWindow({
        xmin: ax + (base.xmin - ax) * k,
        xmax: ax + (base.xmax - ax) * k,
        ymin: ay + (base.ymin - ay) * k,
        ymax: ay + (base.ymax - ay) * k,
      });
      return;
    }

    const d = drag.current;
    if (!d) return;

    if (d.mode === "trace" && state.trace) {
      const x = state.win.xmin + (p.x / (g.cols - 1)) * (state.win.xmax - state.win.xmin);
      state.setTrace({ ...state.trace, x });
      return;
    }
    if (d.mode === "pan") {
      const dx = ((p.x - d.startX) / (g.cols - 1)) * (d.win.xmax - d.win.xmin);
      const dy = ((p.y - d.startY) / (g.h - 1)) * (d.win.ymax - d.win.ymin);
      state.setWindow({
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
    drag.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    if (state.screen !== "graph") return;
    const panel = panelRef.current;
    const canvas = canvasRef.current;
    const g = graphGeom();
    if (!panel || !canvas || !g) return;
    const r = canvas.getBoundingClientRect();
    const scale = panel.metrics.cols / r.width;
    const px = (e.clientX - r.left) * scale;
    const py = (e.clientY - r.top) * scale;
    const k = Math.exp(e.deltaY * 0.0016);
    const ax = state.win.xmin + (px / (g.cols - 1)) * (state.win.xmax - state.win.xmin);
    const ay =
      state.win.ymin + ((g.top + g.h - 1 - py) / (g.h - 1)) * (state.win.ymax - state.win.ymin);
    state.setWindow({
      xmin: ax + (state.win.xmin - ax) * k,
      xmax: ax + (state.win.xmax - ax) * k,
      ymin: ay + (state.win.ymin - ay) * k,
      ymax: ay + (state.win.ymax - ay) * k,
    });
  }

  return (
    <div className="bezel">
      <div className="screen">
        <span className="glass" aria-hidden />
        <div
          className="panel-wrap"
          ref={wrapRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <canvas
            ref={canvasRef}
            className="panel"
            role="img"
            aria-label={`Calculator display: ${transcript.join(". ")}`}
          />
        </div>
        {/* The panel is a canvas, so its contents are mirrored here for
            assistive technology. */}
        <div className="sr-only" role="status" aria-live="polite">
          {transcript.join(". ")}
        </div>
      </div>
    </div>
  );
}

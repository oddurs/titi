import { formatNumber } from "../math/format";
import { evaluate } from "../math/eval";
import { slotLabels } from "../calc/curves";
import { PLOT_COLORS } from "../calc/colors";
import { MODE_ROWS, solverRows, visibleWindowFields, windowLabel } from "../calc/layout";
import type { CalcState } from "../calc/store";
import { CHAR_H, CHAR_W, INK, Pen } from "./pen";
import { graphReadout, renderGraph } from "./graph";

/**
 * Every screen is a character-cell layout, the way a real device lays one out.
 * Selection is inverse video; there is no other affordance, because there is
 * no other affordance on a one-bit panel.
 */

/** Regions the user can tap, in dot coordinates. */
export interface HitRegion {
  kind: "menuItem" | "menuTab" | "row" | "col";
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const plain = { notation: "normal" as const, decimals: -1 };

const TITLES: Record<string, string> = {
  home: "HOME",
  graph: "GRAPH",
  yeq: "Y=",
  window: "WINDOW",
  table: "TABLE",
  tblset: "TBLSET",
  mode: "MODE",
  stat: "LIST",
  matrix: "MATRIX",
  prgm: "PRGM EDIT",
  prgmrun: "PRGM",
  solver: "SOLVER",
  format: "FORMAT",
};

/** Status line, then a rule. Content starts at the returned dot row. */
function chrome(pen: Pen, s: CalcState): number {
  const title = TITLES[s.screen] ?? s.screen.toUpperCase();
  pen.text(0, 0, title, INK.dim);

  const bits: string[] = [];
  if (s.screen === "graph" && s.trace) bits.push("TRACE");
  bits.push(s.modes.angle === "rad" ? "RAD" : "DEG");
  const modeTag = { func: "", par: "PAR", pol: "POL", seq: "SEQ" } as const;
  if (modeTag[s.modes.graphMode]) bits.push(modeTag[s.modes.graphMode]);
  if (s.mod === "2nd") bits.push("2ND");
  if (s.mod === "alpha" || s.mod === "alpha-lock") bits.push("A");

  const status = bits.join(" ");
  pen.textRight(pen.textCols, 0, status, s.mod === "none" ? INK.dim : INK.accent);

  const y = CHAR_H;
  pen.hline(0, pen.cols - 1, y, "#3f6488");
  return y + 2;
}

/** Dot row → text row, for content that starts below the chrome. */
const rowAt = (top: number, i: number) => top + i * CHAR_H;

/**
 * Draw a failure on the panel itself.
 *
 * A screen that throws would otherwise leave the glass blank with no way back,
 * so the device reports its own fault the way it reports any other error.
 */
export function renderFailure(pen: Pen, message: string): void {
  pen.text(0, 0, "ERROR", INK.rose);
  pen.hline(0, pen.cols - 1, CHAR_H, "#3f6488");
  const width = pen.textCols;
  const words = message.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line = `${line} ${w}`;
    }
  }
  if (line.trim()) lines.push(line.trim());

  lines.slice(0, pen.textRows - 4).forEach((l, i) => {
    pen.text(0, 2 + i, pen.clip(l, width), INK.on);
  });
  pen.text(0, pen.textRows - 1, "PRESS ON TO RESET", INK.dim);
}

export function renderScreen(pen: Pen, s: CalcState): HitRegion[] {
  const hits: HitRegion[] = [];
  const top = chrome(pen, s);

  switch (s.screen) {
    case "graph":
      renderGraph(pen, {
        win: s.win, ys: s.ys, modes: s.modes, marks: s.marks, trace: s.trace,
        drawings: s.drawings, cursor: s.graphPrompt ? s.cursor : null,
        plots: s.plots, lists: s.lists, env: s.env, top,
      });
      renderGraphStrip(pen, s);
      break;
    case "home": renderHome(pen, s, top); break;
    case "yeq": renderYeq(pen, s, top, hits); break;
    case "window": renderWindow(pen, s, top, hits); break;
    case "tblset": renderTblSet(pen, s, top, hits); break;
    case "table": renderTable(pen, s, top); break;
    case "mode":
    case "format": renderMode(pen, s, top, hits); break;
    case "stat": renderStat(pen, s, top); break;
    case "matrix": renderMatrix(pen, s, top); break;
    case "prgm": renderPrgmEdit(pen, s, top, hits); break;
    case "prgmrun": renderPrgmRun(pen, s, top); break;
    case "solver": renderSolver(pen, s, top, hits); break;
  }

  if (s.message) renderToast(pen, s.message);
  if (s.menu) {
    hits.length = 0;
    renderMenu(pen, s, hits);
  }
  return hits;
}

// ---------------------------------------------------------------------------

function renderGraphStrip(pen: Pen, s: CalcState) {
  const parts = graphReadout({
    win: s.win, ys: s.ys, modes: s.modes, marks: s.marks, trace: s.trace,
    drawings: s.drawings, cursor: s.cursor,
    plots: s.plots, lists: s.lists, env: s.env, top: 0,
  });
  const mark = s.marks[0];
  let line: string | null = null;

  if (parts) line = parts.join(" ");
  else if (mark) {
    const f = { notation: s.modes.notation, decimals: s.modes.decimals };
    line =
      mark.kind === "area"
        ? `${mark.label}=${formatNumber(mark.y, f)}`
        : mark.kind === "tangent"
          ? `dy/dx=${formatNumber(mark.slope ?? 0, f)}`
          : `${mark.label} X=${formatNumber(mark.x, f)} Y=${formatNumber(mark.y, f)}`;
  }
  if (!line) return;

  const row = pen.textRows - 1;
  const y = rowAt(0, row) - 1;
  pen.fill(0, y, pen.cols, pen.rows - y, "#070c13");
  pen.hline(0, pen.cols - 1, y - 1, "#33526f");
  pen.text(0, row, pen.clip(line, pen.textCols), INK.on);
}

function renderToast(pen: Pen, message: string) {
  const row = pen.textRows - 1;
  const text = pen.clip(message, pen.textCols);
  const ink = message.startsWith("ERR") ? INK.rose : INK.accent;
  const y = rowAt(0, row) - 1;
  pen.fill(0, y, pen.cols, pen.rows - y, "#070c13");
  pen.hline(0, pen.cols - 1, y - 1, "#33526f");
  pen.text(0, row, text, ink);
}

// ---------------------------------------------------------------------------

function renderHome(pen: Pen, s: CalcState, top: number) {
  const width = pen.textCols;
  const first = Math.ceil(top / CHAR_H);
  const lastRow = pen.textRows - 2;

  // Build the tape bottom-up so the newest entry is always visible.
  const lines: { text: string; ink: string; right?: boolean }[] = [];
  for (const h of s.history) {
    lines.push({ text: h.input, ink: INK.dim });
    if (h.rows) {
      for (const r of h.rows) {
        lines.push({ text: `[${r.join(" ")}]`, ink: h.isError ? INK.rose : INK.on, right: true });
      }
    } else {
      lines.push({ text: h.output, ink: h.isError ? INK.rose : INK.on, right: true });
    }
  }
  if (s.statReport) {
    lines.push({ text: s.statReport.title, ink: INK.dim });
    for (const r of s.statReport.rows) {
      lines.push({ text: `${r.label}=${r.value}`, ink: INK.on });
    }
  }
  if (!lines.length) {
    lines.push({ text: "READY", ink: INK.dim });
  }

  const visible = lines.slice(Math.max(0, lines.length - (lastRow - first + 1)));
  visible.forEach((l, i) => {
    const row = lastRow - visible.length + 1 + i;
    if (row < first) return;
    const text = pen.clip(l.text, width);
    if (l.right) pen.textRight(width, row, text, l.ink);
    else pen.text(0, row, text, l.ink);
  });

  // The entry line always owns the last row.
  const row = pen.textRows - 1;
  const prompt = s.graphPrompt?.op === "value" ? "X=" : ">";
  pen.text(0, row, prompt, INK.accent);
  const avail = width - prompt.length;
  const shown = tailFit(s.entry.text, s.entry.caret, avail);
  pen.text(prompt.length, row, shown.text, INK.on);
  pen.cursor(prompt.length + shown.caret, row);
}

/** Keep the caret on screen by scrolling a long entry line. */
function tailFit(text: string, caret: number, width: number) {
  if (text.length < width) return { text, caret };
  const start = Math.max(0, caret - width + 1);
  return { text: text.slice(start, start + width), caret: caret - start };
}

// ---------------------------------------------------------------------------

function renderYeq(pen: Pen, s: CalcState, top: number, hits: HitRegion[]) {
  const first = Math.ceil(top / CHAR_H);
  const labels = slotLabels(s.modes.graphMode);
  const active = s.target.kind === "yeq" ? s.target.row : -1;

  s.ys.forEach((y, i) => {
    const row = first + i;
    if (row >= pen.textRows) return;
    const label = labels[i];
    const mark = y.on ? "=" : ":";
    const head = `${label}${mark}`;
    pen.text(0, row, head, y.on ? INK.on : INK.dim);
    // The caret can rest on the = itself, where enter switches the plot on.
    if (i === active && s.onEquals) {
      pen.inverse(label.length, row, 1, mark, INK.accent);
    }
    // a colour tick so the slot and its curve are connected
    pen.fill(0, rowAt(0, row) + CHAR_H - 3, CHAR_W - 2, 1,
      PLOT_COLORS[y.color % PLOT_COLORS.length]);

    const bodyCol = head.length;
    const width = pen.textCols - bodyCol;
    if (i === active) {
      const shown = tailFit(s.entry.text, s.entry.caret, width);
      pen.text(bodyCol, row, shown.text, INK.on);
      pen.cursor(bodyCol + shown.caret, row);
    } else {
      pen.text(bodyCol, row, pen.clip(y.expr, width), y.on ? INK.on : INK.dim);
    }

    hits.push({ kind: "row", index: i, x: 0, y: rowAt(0, row) - 1, w: pen.cols, h: CHAR_H });
  });
}

function renderFieldList(
  pen: Pen,
  s: CalcState,
  top: number,
  hits: HitRegion[],
  fields: { label: string; value: string }[],
  active: number,
) {
  const first = Math.ceil(top / CHAR_H);
  fields.forEach((f, i) => {
    const row = first + i;
    if (row >= pen.textRows) return;
    const label = `${f.label}=`;
    pen.text(0, row, label, INK.dim);
    const col = label.length;
    const width = pen.textCols - col;
    if (i === active) {
      const shown = tailFit(s.entry.text, s.entry.caret, width);
      pen.text(col, row, shown.text, INK.on);
      pen.cursor(col + shown.caret, row);
    } else {
      pen.text(col, row, pen.clip(f.value, width), INK.on);
    }
    hits.push({ kind: "row", index: i, x: 0, y: rowAt(0, row) - 1, w: pen.cols, h: CHAR_H });
  });
}

function renderWindow(pen: Pen, s: CalcState, top: number, hits: HitRegion[]) {
  const fields = visibleWindowFields(s.modes.graphMode).map((f) => ({
    label: windowLabel(f, s.modes.graphMode),
    value: formatNumber(s.win[f], plain),
  }));
  renderFieldList(pen, s, top, hits, fields, s.target.kind === "window" ? s.target.row : -1);
}

function renderTblSet(pen: Pen, s: CalcState, top: number, hits: HitRegion[]) {
  const fields = [
    { label: "TblStart", value: formatNumber(s.tbl.start, plain) },
    { label: "ΔTbl", value: formatNumber(s.tbl.step, plain) },
  ];
  const active = s.target.kind === "tblset" ? s.target.row : -1;
  renderFieldList(pen, s, top, hits, fields, active > 1 ? -1 : active);

  // Indpnt is a choice, not a number, so it is drawn as two chips with the
  // live one in inverse — the way the device shows every either/or.
  const row = Math.ceil(top / CHAR_H) + fields.length;
  const label = "Indpnt:";
  pen.text(0, row, label, active === 2 ? INK.on : INK.dim);
  let col = label.length + 1;
  for (const [name, isAuto] of [["Auto", true], ["Ask", false]] as const) {
    if (isAuto === s.tbl.auto) pen.inverse(col, row, name.length, name, INK.on);
    else pen.text(col, row, name, INK.dim);
    col += name.length + 1;
  }
  hits.push({
    kind: "row", index: 2, x: 0, y: rowAt(0, row) - 1, w: pen.cols, h: CHAR_H,
  });
}

// ---------------------------------------------------------------------------

function renderTable(pen: Pen, s: CalcState, top: number) {
  const first = Math.ceil(top / CHAR_H);
  const shown = s.ys.filter((y) => y.expr.trim());
  const labels = slotLabels(s.modes.graphMode);

  if (!shown.length) {
    pen.text(0, first, "NO FUNCTIONS", INK.dim);
    pen.text(0, first + 2, "PRESS Y= TO ENTER ONE", INK.dim);
    return;
  }

  const cols = Math.min(shown.length, Math.max(1, Math.floor(pen.textCols / 9) - 1));
  const colWidth = Math.floor(pen.textCols / (cols + 1));
  const fmt = { notation: s.modes.notation, decimals: s.modes.decimals };

  pen.text(0, first, "X".padEnd(colWidth), INK.dim);
  for (let c = 0; c < cols; c++) {
    pen.text((c + 1) * colWidth, first, labels[s.ys.indexOf(shown[c])], INK.dim);
  }
  pen.hline(0, pen.cols - 1, rowAt(0, first) + CHAR_H - 1, "#33526f");

  const rows = pen.textRows - first - 1;
  // In Ask mode the X column is whatever has been typed, plus the line being
  // typed now; in Auto it walks from TblStart by ΔTbl.
  const asked = s.tbl.auto ? null : s.tbl.ask;

  for (let r = 0; r < rows; r++) {
    const row = first + 1 + r;
    if (asked) {
      const i = s.row + r;
      if (i > asked.length) break;
      if (i === asked.length) {
        // the line being typed
        const shown = tailFit(s.entry.text, s.entry.caret, colWidth - 1);
        pen.text(0, row, shown.text, INK.on);
        pen.cursor(shown.caret, row);
        break;
      }
    }
    const x = asked ? asked[s.row + r] : s.tbl.start + (s.row + r) * s.tbl.step;
    pen.text(0, row, pen.clip(formatNumber(x, fmt), colWidth - 1), INK.dim);
    for (let c = 0; c < cols; c++) {
      let v = "-";
      try {
        const local = { ...s.env, lenient: true, vars: { ...s.env.vars, X: x } };
        const out = evaluate(shown[c].expr, local);
        if (typeof out === "number" && Number.isFinite(out)) v = formatNumber(out, fmt);
      } catch {
        /* undefined here just prints a dash */
      }
      pen.text((c + 1) * colWidth, row, pen.clip(v, colWidth - 1), INK.on);
    }
  }
  if (asked && !asked.length) {
    pen.text(0, pen.textRows - 1, "TYPE AN X VALUE", INK.dim);
  }
}

// ---------------------------------------------------------------------------

function renderMode(pen: Pen, s: CalcState, top: number, hits: HitRegion[]) {
  const first = Math.ceil(top / CHAR_H);
  MODE_ROWS.forEach((m, i) => {
    const row = first + i;
    if (row >= pen.textRows) return;
    let col = 0;
    for (const c of m.choices) {
      const label = c.label;
      if (col + label.length > pen.textCols) break;
      const selected = s.modes[m.key] === c.value;
      if (selected) pen.inverse(col, row, label.length, label, INK.on);
      else pen.text(col, row, label, i === s.row ? INK.on : INK.dim);
      col += label.length + 1;
    }
    if (i === s.row) pen.text(pen.textCols - 1, row, "<", INK.accent);
    hits.push({ kind: "row", index: i, x: 0, y: rowAt(0, row) - 1, w: pen.cols, h: CHAR_H });
  });
}

// ---------------------------------------------------------------------------

function renderStat(pen: Pen, s: CalcState, top: number) {
  const first = Math.ceil(top / CHAR_H);
  const names = ["L1", "L2", "L3", "L4", "L5", "L6"];
  const col = s.target.kind === "stat" ? s.target.col : 0;
  const row = s.target.kind === "stat" ? s.target.row : 0;

  const shown = Math.max(1, Math.min(3, Math.floor(pen.textCols / 9)));
  const startCol = Math.max(0, Math.min(col - 1, names.length - shown));
  const width = Math.floor(pen.textCols / shown);

  for (let c = 0; c < shown; c++) {
    const idx = startCol + c;
    pen.text(c * width, first, names[idx], idx === col ? INK.accent : INK.dim);
  }
  pen.hline(0, pen.cols - 1, rowAt(0, first) + CHAR_H - 1, "#33526f");

  const depth = pen.textRows - first - 1;
  const startRow = Math.max(0, row - depth + 2);
  for (let r = 0; r < depth; r++) {
    const dataRow = startRow + r;
    const line = first + 1 + r;
    for (let c = 0; c < shown; c++) {
      const idx = startCol + c;
      const v = s.lists[idx]?.[dataRow];
      const text =
        idx === col && dataRow === row
          ? s.entry.text
          : v === undefined
            ? ""
            : formatNumber(v, plain);
      const clipped = pen.clip(text, width - 1);
      if (idx === col && dataRow === row) {
        pen.text(c * width, line, clipped, INK.on);
        pen.cursor(c * width + clipped.length, line);
      } else {
        pen.text(c * width, line, clipped, INK.on);
      }
    }
  }
}

// ---------------------------------------------------------------------------

function renderMatrix(pen: Pen, s: CalcState, top: number) {
  if (s.target.kind !== "matrix") return;
  const first = Math.ceil(top / CHAR_H);
  const { name, row, col } = s.target;
  const m = s.mats[name];

  const dims = m ? `${m.r}x${m.c}` : "0x0";
  pen.text(0, first, name, INK.accent);
  const dimCol = name.length + 1;
  if (row < 0) {
    const parts = [String(m?.r ?? 0), String(m?.c ?? 0)];
    parts[col] = s.entry.text || "_";
    pen.text(dimCol, first, parts[0], col === 0 ? INK.on : INK.dim);
    pen.text(dimCol + parts[0].length, first, "x", INK.dim);
    pen.text(dimCol + parts[0].length + 1, first, parts[1], col === 1 ? INK.on : INK.dim);
    pen.text(pen.textCols - 1, first, "<", INK.accent);
  } else {
    pen.text(dimCol, first, dims, INK.dim);
  }
  pen.hline(0, pen.cols - 1, rowAt(0, first) + CHAR_H - 1, "#33526f");

  if (!m) {
    pen.text(0, first + 2, "SET DIMENSIONS", INK.dim);
    return;
  }

  const depth = pen.textRows - first - 1;
  // Wide enough for the widest entry, not simply the panel split evenly — a
  // 2×2 of small integers should not sprawl across the whole screen.
  const widest = m.m.reduce(
    (w, row) =>
      row.reduce((x, v) => Math.max(x, formatNumber(v, plain).length), w),
    1,
  );
  const cellW = Math.min(10, Math.max(4, widest + 2));
  const shownCols = Math.max(1, Math.min(m.c, Math.floor((pen.textCols - 2) / cellW)));
  const startCol = Math.max(0, Math.min(col - shownCols + 1, m.c - shownCols));
  const startRow = Math.max(0, Math.min(row - depth + 2, Math.max(0, m.r - depth + 1)));

  for (let r = 0; r < Math.min(depth, m.r - startRow); r++) {
    const dataRow = startRow + r;
    const line = first + 1 + r;
    pen.text(0, line, "[", INK.dim);
    for (let c = 0; c < shownCols; c++) {
      const dataCol = startCol + c;
      const at = 1 + c * cellW;
      const live = dataRow === row && dataCol === col;
      const text = live
        ? s.entry.text
        : formatNumber(m.m[dataRow][dataCol], plain);
      const clipped = pen.clip(text, cellW - 1);
      if (live) {
        pen.text(at, line, clipped, INK.on);
        pen.cursor(at + clipped.length, line);
      } else {
        pen.text(at, line, clipped, INK.on);
      }
    }
    pen.text(1 + shownCols * cellW, line, "]", INK.dim);
  }
}

// ---------------------------------------------------------------------------

function renderSolver(pen: Pen, s: CalcState, top: number, hits: HitRegion[]) {
  const first = Math.ceil(top / CHAR_H);
  const rows = solverRows(s.solver);
  const active = s.target.kind === "solver" ? s.target.row : -1;

  rows.forEach((r, i) => {
    const row = first + i;
    if (row >= pen.textRows - 1) return;
    // The variable being solved for is marked, as it is on the device.
    const mark = r.kind === "var" && r.isTarget ? "*" : " ";
    const label = `${mark}${r.label}`;
    pen.text(0, row, label, r.isTarget ? INK.accent : INK.dim);

    const col = label.length;
    const width = pen.textCols - col;
    if (i === active) {
      const shown = tailFit(s.entry.text, s.entry.caret, width);
      pen.text(col, row, shown.text, INK.on);
      pen.cursor(col + shown.caret, row);
    } else {
      pen.text(col, row, pen.clip(r.value, width), INK.on);
    }
    hits.push({ kind: "row", index: i, x: 0, y: rowAt(0, row) - 1, w: pen.cols, h: CHAR_H });
  });

  const foot = pen.textRows - 1;
  if (s.solver.residual !== null) {
    pen.text(0, foot, pen.clip(`left-rt=${formatNumber(s.solver.residual, plain)}`, pen.textCols), INK.dim);
  } else if (!s.solver.equation.trim()) {
    pen.text(0, foot, "ENTER AN EQUATION", INK.dim);
  } else {
    pen.text(0, foot, "ENTER ON A VAR SOLVES", INK.dim);
  }
}

function renderPrgmEdit(pen: Pen, s: CalcState, top: number, hits: HitRegion[]) {
  const first = Math.ceil(top / CHAR_H);
  const active = s.target.kind === "prgm" ? s.target.line : 0;
  pen.text(0, first, pen.clip(`PROGRAM:${s.prgmName}`, pen.textCols), INK.accent);
  pen.hline(0, pen.cols - 1, rowAt(0, first) + CHAR_H - 1, "#33526f");

  const depth = pen.textRows - first - 1;
  const start = Math.max(0, Math.min(active - depth + 2, s.prgmLines.length - depth));
  for (let r = 0; r < depth; r++) {
    const idx = Math.max(0, start) + r;
    if (idx >= s.prgmLines.length) break;
    const line = first + 1 + r;
    pen.text(0, line, ":", INK.dim);
    const width = pen.textCols - 1;
    if (idx === active) {
      const shown = tailFit(s.entry.text, s.entry.caret, width);
      pen.text(1, line, shown.text, INK.on);
      pen.cursor(1 + shown.caret, line);
    } else {
      pen.text(1, line, pen.clip(s.prgmLines[idx], width), INK.on);
    }
    hits.push({ kind: "row", index: idx, x: 0, y: rowAt(0, line) - 1, w: pen.cols, h: CHAR_H });
  }
}

function renderPrgmRun(pen: Pen, s: CalcState, top: number) {
  const run = s.prgmRun;
  if (!run) return;
  const first = Math.ceil(top / CHAR_H);
  const lastRow = pen.textRows - 2;

  const lines = [...run.output];
  if (run.status === "error") lines.push(run.message ?? "ERR");
  if (run.status === "done") lines.push("DONE");

  const visible = lines.slice(Math.max(0, lines.length - (lastRow - first + 1)));
  visible.forEach((l, i) => {
    const row = lastRow - visible.length + 1 + i;
    if (row < first) return;
    const isErr = run.status === "error" && i === visible.length - 1;
    pen.text(0, row, pen.clip(l, pen.textCols), isErr ? INK.rose : INK.on);
  });

  const row = pen.textRows - 1;
  if (run.status === "input") {
    const prompt = pen.clip(run.prompt ?? "?", 8);
    pen.text(0, row, prompt, INK.accent);
    const width = pen.textCols - prompt.length;
    const shown = tailFit(s.entry.text, s.entry.caret, width);
    pen.text(prompt.length, row, shown.text, INK.on);
    pen.cursor(prompt.length + shown.caret, row);
  } else if (run.status === "pause") {
    pen.text(0, row, "PAUSED - PRESS ENTER", INK.accent);
  } else {
    pen.text(0, row, "PRESS ENTER", INK.dim);
  }
}

// ---------------------------------------------------------------------------

function renderMenu(pen: Pen, s: CalcState, hits: HitRegion[]) {
  const menu = s.menu;
  if (!menu) return;

  // The menu owns the whole panel, as it does on the device.
  pen.fill(0, 0, pen.cols, pen.rows, "#070c13");

  let col = 0;
  menu.tabs.forEach((t, i) => {
    const label = t.name.toUpperCase();
    if (col + label.length > pen.textCols) return;
    if (i === menu.tab) pen.inverse(col, 0, label.length, label, INK.on);
    else pen.text(col, 0, label, INK.dim);
    hits.push({
      kind: "menuTab", index: i,
      x: col * CHAR_W, y: 0, w: label.length * CHAR_W, h: CHAR_H,
    });
    col += label.length + 1;
  });
  pen.hline(0, pen.cols - 1, CHAR_H, "#3f6488");

  const items = menu.tabs[menu.tab].items;
  const first = 2;
  // The last row explains the highlighted item, which is where the hints went
  // when the menu lost room for a second column.
  const hint = items[menu.index]?.hint;
  const depth = pen.textRows - first - (hint ? 1 : 0);
  const start = Math.max(0, Math.min(menu.index - depth + 2, items.length - depth));

  for (let r = 0; r < depth; r++) {
    const idx = Math.max(0, start) + r;
    if (idx >= items.length) break;
    const row = first + r;
    const item = items[idx];
    const label = `${idx + 1}:${item.label}`;
    const text = pen.clip(label, pen.textCols);
    // A disabled item is still shown — it is telling you something — but it
    // is drawn dim so it never reads as a choice.
    if (idx === menu.index) pen.inverse(0, row, pen.textCols, text, item.disabled ? INK.dim : INK.on);
    else pen.text(0, row, text, item.disabled ? INK.dim : INK.on);
    hits.push({
      kind: "menuItem", index: idx,
      x: 0, y: rowAt(0, row) - 1, w: pen.cols, h: CHAR_H,
    });
  }

  if (hint) {
    pen.text(0, pen.textRows - 1, pen.clip(hint, pen.textCols), INK.dim);
  }
}

/**
 * A dot-matrix panel.
 *
 * Everything is drawn into an offscreen buffer where one canvas pixel is one
 * physical dot. That buffer is then thresholded to one bit of *coverage* —
 * a dot is either lit or it isn't — while keeping its colour, which is how a
 * colour LCD actually behaves. The result is blown up with smoothing off and
 * the gaps between dots are cut back out, so the grid stays visible at any
 * size.
 *
 * Drawing at logical resolution rather than scaling down a smooth image is the
 * whole point: curves land on real dots, and text is quantised the same way
 * the glyph ROM of a real device would quantise it.
 */

export interface PanelMetrics {
  /** dots across and down */
  cols: number;
  rows: number;
  /** device pixels per dot — always an integer, so dots never blur */
  dot: number;
  /** css pixels the panel occupies */
  cssWidth: number;
  cssHeight: number;
}

/** Aim for roughly this many dots across, whatever the panel size. */
const TARGET_COLS = 160;
const MIN_DOT = 2;
const MAX_DOT = 7;

export function measurePanel(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): PanelMetrics {
  const idealCssPitch = cssWidth / TARGET_COLS;
  const dot = Math.max(MIN_DOT, Math.min(MAX_DOT, Math.round(idealCssPitch * dpr)));
  const cols = Math.max(24, Math.floor((cssWidth * dpr) / dot));
  const rows = Math.max(16, Math.floor((cssHeight * dpr) / dot));
  return {
    cols,
    rows,
    dot,
    cssWidth: (cols * dot) / dpr,
    cssHeight: (rows * dot) / dpr,
  };
}

export interface PanelTheme {
  /** the unlit glass */
  background: string;
  /** an unlit dot — just visible, which is what makes the grid read */
  offDot: string;
  /** default lit colour */
  onDot: string;
}

export const LCD_THEME: PanelTheme = {
  background: "#070c13",
  offDot: "rgba(120, 170, 220, 0.055)",
  onDot: "#cfe6ff",
};

export class DotPanel {
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  metrics: PanelMetrics = {
    cols: 1, rows: 1, dot: 3, cssWidth: 1, cssHeight: 1,
  };

  /** tiles built once per geometry change */
  private offTile: CanvasPattern | null = null;
  private gapTile: CanvasPattern | null = null;

  constructor(private theme: PanelTheme = LCD_THEME) {
    this.buffer = document.createElement("canvas");
    const ctx = this.buffer.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): PanelMetrics {
    const m = measurePanel(cssWidth, cssHeight, dpr);
    const changed =
      m.cols !== this.metrics.cols ||
      m.rows !== this.metrics.rows ||
      m.dot !== this.metrics.dot;
    this.metrics = m;
    if (changed) {
      this.buffer.width = m.cols;
      this.buffer.height = m.rows;
      this.offTile = null;
      this.gapTile = null;
    }
    return m;
  }

  /** Clear the buffer ready for a frame. */
  begin() {
    const { cols, rows } = this.metrics;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, cols, rows);
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Collapse partial coverage to lit-or-not. Antialiased text and strokes both
   * pass through here, which is what makes every source of ink agree.
   *
   * The cutoff is deliberately low: a glyph stem that lands between two dots
   * should light both rather than neither, which is what a real glyph ROM
   * would have done when the face was fitted to the grid.
   */
  private threshold(cutoff = 64) {
    const { cols, rows } = this.metrics;
    if (cols < 1 || rows < 1) return;
    const img = this.ctx.getImageData(0, 0, cols, rows);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      d[i] = d[i] >= cutoff ? 255 : 0;
    }
    this.ctx.putImageData(img, 0, 0);
  }

  private buildTiles(target: CanvasRenderingContext2D) {
    const { dot } = this.metrics;
    // A dot fills most of its cell; the remainder is the grid gap.
    const inset = dot >= 4 ? 1 : dot >= 3 ? 0.6 : 0.4;
    const size = Math.max(0.5, dot - inset);
    const r = dot >= 5 ? 1 : 0;

    const off = document.createElement("canvas");
    off.width = dot;
    off.height = dot;
    const octx = off.getContext("2d")!;
    octx.fillStyle = this.theme.offDot;
    roundRect(octx, (dot - size) / 2, (dot - size) / 2, size, size, r);
    octx.fill();
    this.offTile = target.createPattern(off, "repeat");

    // The inverse: everything except the dot, painted in the glass colour, so
    // it can be laid over lit cells to cut the gaps back in.
    const gap = document.createElement("canvas");
    gap.width = dot;
    gap.height = dot;
    const gctx = gap.getContext("2d")!;
    gctx.fillStyle = this.theme.background;
    gctx.fillRect(0, 0, dot, dot);
    gctx.globalCompositeOperation = "destination-out";
    roundRect(gctx, (dot - size) / 2, (dot - size) / 2, size, size, r);
    gctx.fill();
    this.gapTile = target.createPattern(gap, "repeat");
  }

  /** Threshold the buffer and paint it onto the visible canvas. */
  present(target: CanvasRenderingContext2D) {
    const { cols, rows, dot } = this.metrics;
    const w = cols * dot;
    const h = rows * dot;

    this.threshold();
    if (!this.offTile || !this.gapTile) this.buildTiles(target);

    target.setTransform(1, 0, 0, 1, 0, 0);
    target.imageSmoothingEnabled = false;

    target.fillStyle = this.theme.background;
    target.fillRect(0, 0, w, h);

    // the unlit grid
    target.fillStyle = this.offTile!;
    target.fillRect(0, 0, w, h);

    // lit dots, as full cells first
    target.drawImage(this.buffer, 0, 0, cols, rows, 0, 0, w, h);

    // then cut the gaps back in
    target.fillStyle = this.gapTile!;
    target.fillRect(0, 0, w, h);

    // a little bloom, the way a backlit panel bleeds
    target.save();
    target.globalAlpha = 0.3;
    target.globalCompositeOperation = "lighter";
    target.filter = `blur(${Math.max(1, dot * 0.6)}px)`;
    target.drawImage(this.buffer, 0, 0, cols, rows, 0, 0, w, h);
    target.restore();
    target.filter = "none";
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

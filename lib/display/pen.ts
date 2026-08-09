/**
 * The only way anything reaches the panel.
 *
 * Coordinates are dots, and every primitive lands on integers — a line is
 * plotted with Bresenham rather than stroked, so nothing depends on the
 * threshold to look straight. Text goes through the browser's renderer at
 * glyph size and is quantised by the threshold, which is what lets the whole
 * character set survive without hand-authoring a glyph ROM.
 */

/**
 * A 5×7 glyph in a 6×9 cell. Every glyph comes from the ROM table, so nothing
 * depends on how the browser happens to rasterise a font.
 *
 * The extra row over a bare 6×8 cell is leading: with only one blank dot row
 * between them, consecutive lines of digits run together and a dense screen
 * like TABLE becomes unreadable.
 */
export const CHAR_W = 6;
export const CHAR_H = 9;
/** Baseline offset inside a cell, for the rare glyph with no ROM entry. */
const BASELINE = 7;

export const INK = {
  on: "#cfe6ff",
  dim: "#5f7f9e",
  accent: "#ffb454",
  blue: "#5aa9ff",
  green: "#3fd99b",
  rose: "#ff6b8a",
} as const;

export type Ink = string;

import { GLYPHS, foldForDisplay } from "./glyphs";

export class Pen {
  /**
   * Every string drawn, with where it landed. A canvas says nothing to a
   * screen reader, so this is replayed into a live region — the panel's
   * contents in words, straight from the same call that drew them.
   */
  readonly spoken: { x: number; y: number; text: string }[] = [];

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly cols: number,
    readonly rows: number,
    private fontStack: string,
  ) {}

  /** The panel's text, reading order, one string per line. */
  transcript(): string[] {
    const lines = new Map<number, { x: number; text: string }[]>();
    for (const item of this.spoken) {
      const row = Math.round(item.y / CHAR_H);
      if (!lines.has(row)) lines.set(row, []);
      lines.get(row)!.push(item);
    }
    return [...lines.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, parts]) =>
        parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.text)
          .join(" ")
          .trim(),
      )
      .filter((l) => l !== "");
  }

  /** Character columns and rows that fit on this panel. */
  get textCols(): number {
    return Math.floor(this.cols / CHAR_W);
  }
  get textRows(): number {
    return Math.floor(this.rows / CHAR_H);
  }

  // -- primitives -----------------------------------------------------------

  dot(x: number, y: number, ink: Ink = INK.on) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.cols || py >= this.rows) return;
    this.ctx.fillStyle = ink;
    this.ctx.fillRect(px, py, 1, 1);
  }

  fill(x: number, y: number, w: number, h: number, ink: Ink = INK.on) {
    this.ctx.fillStyle = ink;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  frame(x: number, y: number, w: number, h: number, ink: Ink = INK.on) {
    this.hline(x, x + w - 1, y, ink);
    this.hline(x, x + w - 1, y + h - 1, ink);
    this.vline(x, y, y + h - 1, ink);
    this.vline(x + w - 1, y, y + h - 1, ink);
  }

  hline(x0: number, x1: number, y: number, ink: Ink = INK.on) {
    const a = Math.round(Math.min(x0, x1));
    const b = Math.round(Math.max(x0, x1));
    this.fill(a, y, b - a + 1, 1, ink);
  }

  vline(x: number, y0: number, y1: number, ink: Ink = INK.on) {
    const a = Math.round(Math.min(y0, y1));
    const b = Math.round(Math.max(y0, y1));
    this.fill(x, a, 1, b - a + 1, ink);
  }

  /** Every nth dot lit — used for gridlines and the trace crosshair. */
  dottedH(x0: number, x1: number, y: number, every: number, ink: Ink = INK.on) {
    const a = Math.round(Math.min(x0, x1));
    const b = Math.round(Math.max(x0, x1));
    for (let x = a; x <= b; x += every) this.dot(x, y, ink);
  }

  dottedV(x: number, y0: number, y1: number, every: number, ink: Ink = INK.on) {
    const a = Math.round(Math.min(y0, y1));
    const b = Math.round(Math.max(y0, y1));
    for (let y = a; y <= b; y += every) this.dot(x, y, ink);
  }

  line(x0: number, y0: number, x1: number, y1: number, ink: Ink = INK.on) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    let guard = 0;

    for (;;) {
      this.dot(x, y, ink);
      if ((x === ex && y === ey) || guard++ > 8000) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // -- text -----------------------------------------------------------------

  /** Draw at a dot position. Returns the width consumed, in dots. */
  textAt(x: number, y: number, s: string, ink: Ink = INK.on): number {
    if (!s) return 0;
    const text = foldForDisplay(s);
    if (s.trim()) this.spoken.push({ x, y, text: s.trim() });
    this.ctx.fillStyle = ink;
    this.ctx.font = this.fontStack;
    this.ctx.textBaseline = "alphabetic";
    this.ctx.textAlign = "left";

    // One cell per character, so columns line up whatever the glyph source is.
    let cx = Math.round(x);
    const top = Math.round(y);
    for (const ch of text) {
      if (ch === " ") {
        cx += CHAR_W;
        continue;
      }
      const bitmap = GLYPHS[ch];
      if (bitmap) {
        this.ctx.fillStyle = ink;
        for (let r = 0; r < bitmap.length; r++) {
          const row = bitmap[r];
          for (let c = 0; c < row.length; c++) {
            if (row[c] === "#") this.ctx.fillRect(cx + c, top + r, 1, 1);
          }
        }
      } else {
        this.ctx.fillText(ch, cx, top + BASELINE);
      }
      cx += CHAR_W;
    }
    return text.length * CHAR_W;
  }

  /** Draw at a character cell. */
  text(col: number, row: number, s: string, ink: Ink = INK.on) {
    this.textAt(col * CHAR_W, row * CHAR_H, s, ink);
  }

  textRight(colEnd: number, row: number, s: string, ink: Ink = INK.on) {
    this.text(Math.max(0, colEnd - s.length), row, s, ink);
  }

  /** Selected rows are drawn in inverse video, as on the device. */
  inverse(col: number, row: number, width: number, s: string, ink: Ink = INK.on) {
    this.fill(col * CHAR_W, row * CHAR_H - 1, width * CHAR_W, CHAR_H, ink);
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-out";
    this.textAt(col * CHAR_W, row * CHAR_H, s, "#000");
    this.ctx.restore();
  }

  /**
   * Take ink away. On a one-bit panel there is no such thing as drawing in
   * the background colour, so Pt-Off has to knock the dots out.
   */
  erase(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-out";
    this.fill(x, y, w, h, "#000");
    this.ctx.restore();
  }

  /** A filled block, used for the entry cursor. */
  cursor(col: number, row: number, ink: Ink = INK.accent) {
    this.fill(col * CHAR_W, row * CHAR_H - 1, CHAR_W - 1, CHAR_H - 1, ink);
  }

  /** Truncate to fit, with no ellipsis — the device simply runs out of screen. */
  clip(s: string, width: number): string {
    return s.length <= width ? s : s.slice(0, Math.max(0, width));
  }
}

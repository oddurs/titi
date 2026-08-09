import { Pen } from "../lib/display/pen";
import { renderScreen, type HitRegion } from "../lib/display/screens";
import type { CalcState } from "../lib/calc/store";

/**
 * A panel you can render into from a test.
 *
 * The display only ever fills one-dot rectangles, so a recording context is
 * enough to reproduce it exactly — no canvas, no browser. What comes back is
 * the lit dot map, the text the pen recorded, and the tappable regions, which
 * between them are everything a screen is.
 */

export interface RenderedPanel {
  cols: number;
  rows: number;
  /** lit dots, keyed "x,y" → colour */
  dots: Map<string, string>;
  /** the text the pen drew, in reading order */
  transcript: string[];
  hits: HitRegion[];
  /** true when a dot is lit */
  lit(x: number, y: number): boolean;
  /** how many dots are lit */
  count(): number;
  /** the grid as text, for eyeballing a failure */
  art(x?: number, y?: number, w?: number, h?: number): string;
  /** a stable digest of the lit dots, for goldens */
  digest(): string;
}

/**
 * Records fills instead of painting them. `destination-out` erases, which is
 * how the pen knocks text out of an inverse-video bar.
 */
class RecordingContext {
  fillStyle = "#000";
  font = "";
  textBaseline = "alphabetic";
  textAlign = "left";
  globalCompositeOperation = "source-over";
  readonly dots = new Map<string, string>();
  private stack: string[] = [];
  /** characters the ROM lacked and had to fall back to a font for */
  readonly fellBack: string[] = [];

  save() {
    this.stack.push(this.globalCompositeOperation);
  }
  restore() {
    this.globalCompositeOperation = this.stack.pop() ?? "source-over";
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const erase = this.globalCompositeOperation === "destination-out";
    for (let i = 0; i < Math.round(w); i++) {
      for (let j = 0; j < Math.round(h); j++) {
        const key = `${Math.round(x) + i},${Math.round(y) + j}`;
        if (erase) this.dots.delete(key);
        else this.dots.set(key, this.fillStyle);
      }
    }
  }

  fillText(ch: string) {
    // Every glyph should come from the ROM; anything here is a coverage hole.
    this.fellBack.push(ch);
  }
}

export function renderPanel(
  state: CalcState,
  cols = 176,
  rows = 190,
): RenderedPanel {
  const ctx = new RecordingContext();
  const pen = new Pen(
    ctx as unknown as CanvasRenderingContext2D,
    cols,
    rows,
    "8px monospace",
  );
  const hits = renderScreen(pen, state);

  if (ctx.fellBack.length) {
    throw new Error(
      `panel fell back to a font for: ${[...new Set(ctx.fellBack)].join(" ")}`,
    );
  }

  const lit = (x: number, y: number) => ctx.dots.has(`${x},${y}`);

  return {
    cols,
    rows,
    dots: ctx.dots,
    transcript: pen.transcript(),
    hits,
    lit,
    count: () => ctx.dots.size,
    art(x = 0, y = 0, w = cols, h = rows) {
      const lines: string[] = [];
      for (let j = y; j < y + h; j++) {
        let line = "";
        for (let i = x; i < x + w; i++) line += lit(i, j) ? "#" : ".";
        lines.push(line);
      }
      return lines.join("\n");
    },
    digest() {
      // FNV-1a over the sorted lit coordinates and their colours.
      let hash = 0x811c9dc5;
      for (const key of [...ctx.dots.keys()].sort()) {
        const s = `${key}:${ctx.dots.get(key)}`;
        for (let i = 0; i < s.length; i++) {
          hash ^= s.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
      }
      return hash.toString(16).padStart(8, "0");
    },
  };
}

/** Does the panel show this text anywhere? */
export const shows = (p: RenderedPanel, text: string): boolean =>
  p.transcript.some((line) => line.includes(text));

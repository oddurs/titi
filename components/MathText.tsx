"use client";

import type { ReactNode } from "react";
import { lex, type Token } from "@/lib/math/lexer";

/**
 * Typesets a linear TI expression the way a textbook would: variables in true
 * italic, function names upright, exponents raised, radicals under a real
 * overbar. The caret stays a plain string index, so editing logic never has to
 * reason about the two-dimensional layout.
 */

interface Props {
  text: string;
  caret?: number;
  /** draw a block caret when the editor is in overwrite mode */
  overwrite?: boolean;
  className?: string;
}

const RELATIONS = new Set(["=", "≠", "<", ">", "≤", "≥"]);

/** Pretty glyphs for operators typed as ASCII. */
const OP_GLYPH: Record<string, string> = {
  "-": "−",
  "*": "×",
  "/": "÷",
};

function classify(t: Token): string {
  switch (t.kind) {
    case "num": return "mt-num";
    case "var": return "mt-var";
    case "fn": return "mt-fn";
    case "list":
    case "yref": return "mt-var";
    // π and e are constants, not variables — convention sets them upright.
    case "const": return "mt-num";
    case "lparen":
    case "rparen": return "mt-paren";
    case "op": return RELATIONS.has(t.value) ? "mt-rel" : "mt-op";
    case "postfix": return "mt-num";
    default: return "";
  }
}

/** Index of the token that closes the group opened at `openIdx`. */
function matchParen(toks: Token[], openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < toks.length; i++) {
    if (toks[i].kind === "lparen" || toks[i].kind === "fn") depth += 1;
    else if (toks[i].kind === "rparen") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return toks.length; // unclosed group — runs to the end, as it does mid-typing
}

/**
 * How far an exponent reaches: a balanced group, or the run that follows.
 * `2^10` raises both digits; `2^X+1` raises only X.
 */
function exponentEnd(toks: Token[], start: number): number {
  const t = toks[start];
  if (!t) return start - 1;
  if (t.kind === "lparen" || t.kind === "fn") return matchParen(toks, start);
  if (t.kind === "op" && t.value === "-") return exponentEnd(toks, start + 1);
  let i = start;
  while (i + 1 < toks.length && toks[i + 1].kind === "postfix") i += 1;
  return i;
}

interface Ctx {
  toks: Token[];
  caret?: number;
  overwrite: boolean;
  /** the caret is one position; once emitted it must not be emitted again */
  placed: boolean;
  seq: number;
}

function caretAt(ctx: Ctx, pos: number): ReactNode | null {
  if (ctx.placed || ctx.caret === undefined || ctx.caret !== pos) return null;
  ctx.placed = true;
  return <i className="caret" data-overwrite={ctx.overwrite} key={`c${ctx.seq++}`} aria-hidden />;
}

/** Renders tokens [from, to] inclusive. */
function renderRange(ctx: Ctx, from: number, to: number): ReactNode[] {
  const out: ReactNode[] = [];
  const { toks } = ctx;
  let i = from;

  const push = (n: ReactNode | null) => {
    if (n) out.push(n);
  };

  while (i <= to && i < toks.length) {
    const t = toks[i];
    push(caretAt(ctx, t.start));

    // Radical: √( … ) becomes a surd plus an overbar across the radicand.
    if (t.kind === "fn" && (t.value === "sqrt" || t.value === "cbrt")) {
      const close = Math.min(matchParen(toks, i), to + 1);
      const inner = renderRange(ctx, i + 1, close - 1);
      // a caret resting just inside the closing paren belongs to the radicand
      const tail = caretAt(ctx, toks[close]?.start ?? t.end);
      if (tail) inner.push(tail);
      out.push(
        <span className="mt-radical" key={`r${ctx.seq++}`}>
          <span className="mt-surd">{t.value === "cbrt" ? "∛" : "√"}</span>
          <span className="mt-radicand">{inner.length ? inner : " "}</span>
        </span>,
      );
      i = close + 1;
      continue;
    }

    // Exponent: raise the group that follows `^`.
    if (t.kind === "op" && t.value === "^") {
      const end = Math.min(exponentEnd(toks, i + 1), to);
      const inner = end >= i + 1 ? renderRange(ctx, i + 1, end) : [];
      const tail = caretAt(ctx, toks[end + 1]?.start ?? -1);
      if (tail) inner.push(tail);
      out.push(
        <span className="mt-sup" key={`s${ctx.seq++}`}>
          {inner.length ? inner : "□"}
        </span>,
      );
      i = end + 1;
      continue;
    }

    const glyph = t.kind === "op" ? OP_GLYPH[t.value] ?? t.text : t.text;
    out.push(
      <span className={classify(t)} key={`t${ctx.seq++}`}>
        {glyph}
      </span>,
    );
    i += 1;
  }

  return out;
}

export default function MathText({ text, caret, overwrite, className }: Props) {
  const toks = lex(text);
  const ctx: Ctx = { toks, caret, overwrite: overwrite ?? false, placed: false, seq: 0 };
  const nodes = renderRange(ctx, 0, toks.length - 1);

  // Anything still unplaced sits at the end of the line.
  const trailing = caret !== undefined && !ctx.placed
    ? <i className="caret" data-overwrite={overwrite ?? false} aria-hidden />
    : null;

  return (
    <span className={className ? `math ${className}` : "math"}>
      {nodes}
      {trailing}
      {!nodes.length && !trailing && <span className="mt-num">&nbsp;</span>}
    </span>
  );
}

/** A stacked fraction, used for ▸Frac answers. */
export function Fraction({ n, d }: { n: number | string; d: number | string }) {
  return (
    <span className="mt-frac">
      <span className="mt-num">{n}</span>
      <span className="mt-num">{d}</span>
    </span>
  );
}

/** Renders an answer, stacking it when the engine produced `a/b`. */
export function AnswerText({ value }: { value: string }) {
  const m = /^(-?\d+)\/(\d+)$/.exec(value);
  if (m) {
    return (
      <span className="math">
        {m[1].startsWith("-") && <span className="mt-op">−</span>}
        <Fraction n={m[1].replace("-", "")} d={m[2]} />
      </span>
    );
  }
  return <MathText text={value} />;
}

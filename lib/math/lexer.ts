// Longest-match lexer for TI-style linear input.
// Tokens carry source spans so the editor can delete a whole token at a time
// ("sin(" disappears in one DEL press, exactly like the device).

export type TokKind =
  | "num"
  | "var"
  | "fn"
  | "op"
  | "postfix"
  | "lparen"
  | "rparen"
  | "comma"
  | "store"
  | "const"
  | "list"
  | "yref"
  | "unknown";

export interface Token {
  kind: TokKind;
  text: string;
  /** canonical name for fn/var/const */
  value: string;
  start: number;
  end: number;
}

/** Functions that open with a paren on the device, e.g. `sin(`. */
export const FUNCTIONS = [
  "sin⁻¹(",
  "cos⁻¹(",
  "tan⁻¹(",
  "sinh⁻¹(",
  "cosh⁻¹(",
  "tanh⁻¹(",
  "sinh(",
  "cosh(",
  "tanh(",
  "sin(",
  "cos(",
  "tan(",
  "log(",
  "ln(",
  "√(",
  "∛(",
  "ˣ√(",
  "abs(",
  "round(",
  "iPart(",
  "fPart(",
  "int(",
  "max(",
  "min(",
  "lcm(",
  "gcd(",
  "nDeriv(",
  "fnInt(",
  "sum(",
  "seq(",
  "mean(",
  "median(",
  "stdDev(",
  "variance(",
  "randInt(",
  "normalpdf(",
  "normalcdf(",
  "invNorm(",
  "binompdf(",
  "binomcdf(",
  "10^(",
  "e^(",
  "solve(",
  "conj(",
] as const;

const FN_CANON: Record<string, string> = {
  "sin⁻¹(": "asin",
  "cos⁻¹(": "acos",
  "tan⁻¹(": "atan",
  "sinh⁻¹(": "asinh",
  "cosh⁻¹(": "acosh",
  "tanh⁻¹(": "atanh",
  "√(": "sqrt",
  "∛(": "cbrt",
  "ˣ√(": "xroot",
  "10^(": "pow10",
  "e^(": "expe",
  "stdDev(": "stdDev",
};

/** Two-character postfix / operator glyphs and misc singles. */
const OPERATORS = [
  "⁻¹",
  "≤",
  "≥",
  "≠",
  "→",
  "²",
  "³",
  "!",
  "+",
  "-",
  "−",
  "*",
  "×",
  "/",
  "÷",
  "^",
  "=",
  "<",
  ">",
] as const;

const POSTFIX = new Set(["⁻¹", "²", "³", "!"]);

const CONSTS: Record<string, string> = {
  "π": "pi",
  "Ans": "Ans",
  "ᴇ": "E",
  "ℯ": "e",
  "rand": "rand",
  "∞": "inf",
};

const VAR_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZθ";

const isDigit = (c: string) => c >= "0" && c <= "9";

export function lex(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;

  const push = (kind: TokKind, text: string, value: string, start: number) =>
    out.push({ kind, text, value, start, end: start + text.length });

  outer: while (i < src.length) {
    const c = src[i];

    if (c === " ") {
      i += 1;
      continue;
    }

    // Number literal, including the EE exponent glyph: 1.2ᴇ-5
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? ""))) {
      const start = i;
      while (i < src.length && isDigit(src[i])) i += 1;
      if (src[i] === ".") {
        i += 1;
        while (i < src.length && isDigit(src[i])) i += 1;
      }
      if (src[i] === "ᴇ") {
        const save = i;
        i += 1;
        if (src[i] === "-" || src[i] === "−") i += 1;
        if (isDigit(src[i] ?? "")) {
          while (i < src.length && isDigit(src[i])) i += 1;
        } else {
          i = save;
        }
      }
      const text = src.slice(start, i);
      push("num", text, text.replace("ᴇ", "e").replace("−", "-"), start);
      continue;
    }

    // Function heads (longest first — FUNCTIONS is authored in that order)
    for (const fn of FUNCTIONS) {
      if (src.startsWith(fn, i)) {
        const canon = FN_CANON[fn] ?? fn.slice(0, -1);
        push("fn", fn, canon, i);
        i += fn.length;
        continue outer;
      }
    }

    // Multi-char constants
    if (src.startsWith("Ans", i)) {
      push("const", "Ans", "Ans", i);
      i += 3;
      continue;
    }
    if (src.startsWith("rand", i)) {
      push("const", "rand", "rand", i);
      i += 4;
      continue;
    }

    // List and function references: L₁..L₆, Y₁..Y₆
    if ((c === "L" || c === "Y") && "₀₁₂₃₄₅₆₇₈₉".includes(src[i + 1] ?? "")) {
      const text = src.slice(i, i + 2);
      push(c === "L" ? "list" : "yref", text, text, i);
      i += 2;
      continue;
    }

    if (CONSTS[c]) {
      push("const", c, CONSTS[c], i);
      i += 1;
      continue;
    }

    if (VAR_CHARS.includes(c)) {
      push("var", c, c, i);
      i += 1;
      continue;
    }

    if (c === "(") {
      push("lparen", c, "(", i);
      i += 1;
      continue;
    }
    if (c === ")") {
      push("rparen", c, ")", i);
      i += 1;
      continue;
    }
    if (c === ",") {
      push("comma", c, ",", i);
      i += 1;
      continue;
    }
    if (c === "{" || c === "}") {
      push(c === "{" ? "lparen" : "rparen", c, c, i);
      i += 1;
      continue;
    }

    for (const op of OPERATORS) {
      if (src.startsWith(op, i)) {
        const kind: TokKind =
          op === "→" ? "store" : POSTFIX.has(op) ? "postfix" : "op";
        push(kind, op, normalizeOp(op), i);
        i += op.length;
        continue outer;
      }
    }

    push("unknown", c, c, i);
    i += 1;
  }

  return out;
}

function normalizeOp(op: string): string {
  switch (op) {
    case "−":
      return "-";
    case "×":
      return "*";
    case "÷":
      return "/";
    default:
      return op;
  }
}

/**
 * Index of the token boundary immediately left of `caret`, used by DEL and ◀
 * so multi-character tokens behave as one unit.
 */
export function prevBoundary(src: string, caret: number): number {
  if (caret <= 0) return 0;
  const toks = lex(src);
  let best = caret - 1;
  for (const t of toks) {
    if (t.end === caret) return t.start;
    if (t.start < caret && caret < t.end) return t.start;
    if (t.end < caret) best = t.end;
  }
  return Math.max(0, Math.min(best, caret - 1));
}

export function nextBoundary(src: string, caret: number): number {
  if (caret >= src.length) return src.length;
  const toks = lex(src);
  for (const t of toks) {
    if (t.start === caret) return t.end;
    if (t.start < caret && caret < t.end) return t.end;
    if (t.start > caret) return t.start;
  }
  return src.length;
}

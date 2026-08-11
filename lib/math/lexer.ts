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
  | "matref"
  | "seqref"
  | "lbracket"
  | "rbracket"
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
  "det(",
  "identity(",
  "rref(",
  "ref(",
  "augment(",
  "dim(",
  "Fill(",
  "randM(",
  "Matr▸list(",
  "List▸matr(",
  "real(",
  "imag(",
  "angle(",
  "remainder(",
  "not(",
  "poissonpdf(",
  "poissoncdf(",
  "geometpdf(",
  "geometcdf(",
  "tpdf(",
  "tcdf(",
  "invT(",
  "χ²pdf(",
  "χ²cdf(",
  "Fpdf(",
  "Fcdf(",
  "fMin(",
  "fMax(",
  "randNorm(",
  "randBin(",
  "randIntNoRep(",
  "SortA(",
  "SortD(",
  "cumSum(",
  "ΔList(",
  "prod(",
  "R▸Pr(",
  "R▸Pθ(",
  "P▸Rx(",
  "P▸Ry(",
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
  "Matr▸list(": "matr2list",
  "List▸matr(": "list2matr",
  "χ²pdf(": "chi2pdf",
  "χ²cdf(": "chi2cdf",
  "SortA(": "sortA",
  "SortD(": "sortD",
  "ΔList(": "deltaList",
  "R▸Pr(": "rectToR",
  "R▸Pθ(": "rectToTheta",
  "P▸Rx(": "polarToX",
  "P▸Ry(": "polarToY",
};

/** Two-character postfix / operator glyphs and misc singles. */
const OPERATORS = [
  "⁻¹",
  "ᵀ",
  "≤",
  "≥",
  "≠",
  "→",
  "²",
  "³",
  "!",
  "°",
  "′",
  "″",
  "ʳ",
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

const POSTFIX = new Set(["⁻¹", "²", "³", "!", "ᵀ", "°", "′", "″", "ʳ"]);

const CONSTS: Record<string, string> = {
  "π": "pi",
  "Ans": "Ans",
  "ᴇ": "E",
  "ℯ": "e",
  "rand": "rand",
  "∞": "inf",
  "i": "i",
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

    // Words that operate: nPr and nCr are written between their arguments,
    // and the connectives join comparisons. All of them start with a letter,
    // so they have to be found before `n` is taken as the sequence variable
    // or a bare letter becomes a variable.
    for (const word of ["and", "or", "xor", "nPr", "nCr"]) {
      if (src.startsWith(word, i) && !VAR_CHARS.includes(src[i + word.length] ?? "")) {
        push("op", word, word, i);
        i += word.length;
        continue outer;
      }
    }

    // Sequence names and their index variable.
    if (src.startsWith("nMin", i)) {
      push("var", "nMin", "nMin", i);
      i += 4;
      continue;
    }
    if (src.startsWith("nMax", i)) {
      push("var", "nMax", "nMax", i);
      i += 4;
      continue;
    }
    if (c === "n") {
      push("var", "n", "n", i);
      i += 1;
      continue;
    }
    if (c === "u" || c === "v" || c === "w") {
      push("seqref", c, c, i);
      i += 1;
      continue;
    }

    // Multi-char constants
    if (src.startsWith("Ans", i)) {
      push("const", "Ans", "Ans", i);
      i += 3;
      continue;
    }
    if (src.startsWith("getKey", i)) {
      push("const", "getKey", "getKey", i);
      i += 6;
      continue;
    }
    if (src.startsWith("rand", i)) {
      push("const", "rand", "rand", i);
      i += 4;
      continue;
    }

    // List and function references: L₁..L₆, Y₁..Y₆.
    // The subscript must actually be there — "".includes() is true for every
    // string, so a bare trailing L or Y used to lex as a reference.
    const sub = src[i + 1];
    if ((c === "L" || c === "Y") && sub !== undefined && "₀₁₂₃₄₅₆₇₈₉".includes(sub)) {
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

    // [A]..[J] is a matrix name; a bare [ opens a literal like [[1,2][3,4]]
    if (c === "[") {
      const name = src[i + 1];
      if (name >= "A" && name <= "J" && src[i + 2] === "]") {
        const text = src.slice(i, i + 3);
        push("matref", text, text, i);
        i += 3;
        continue;
      }
      push("lbracket", c, "[", i);
      i += 1;
      continue;
    }
    if (c === "]") {
      push("rbracket", c, "]", i);
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
 *
 * A number is the exception: its digits each step separately, because a person
 * editing 1234 expects to reach the 3, not to lose the lot. Everything else —
 * `sin(`, `⁻¹`, `L₁` — moves and deletes whole.
 */
export function prevBoundary(src: string, caret: number): number {
  if (caret <= 0) return 0;
  const toks = lex(src);
  let best = caret - 1;
  for (const t of toks) {
    const inside = t.start < caret && caret <= t.end;
    if (inside) return t.kind === "num" ? caret - 1 : t.start;
    if (t.end < caret) best = t.end;
  }
  return Math.max(0, Math.min(best, caret - 1));
}

export function nextBoundary(src: string, caret: number): number {
  if (caret >= src.length) return src.length;
  const toks = lex(src);
  for (const t of toks) {
    const inside = t.start <= caret && caret < t.end;
    if (inside) return t.kind === "num" ? caret + 1 : t.end;
    if (t.start > caret) return t.start;
  }
  return src.length;
}

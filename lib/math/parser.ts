import { lex, type Token } from "./lexer";
import { ParseError, type Node } from "./ast";

/**
 * Precedence-climbing parser for TI linear syntax.
 *
 * Notable device behaviours reproduced here:
 *  - negation binds looser than `^`, so -2^2 is -4
 *  - implicit multiplication shares precedence with `*`, so 1/2X is (1/2)X
 *  - closing parens are optional at end of input ("sin(X" parses)
 */

const ARITY: Record<string, [number, number]> = {
  sin: [1, 1], cos: [1, 1], tan: [1, 1],
  asin: [1, 1], acos: [1, 1], atan: [1, 1],
  sinh: [1, 1], cosh: [1, 1], tanh: [1, 1],
  asinh: [1, 1], acosh: [1, 1], atanh: [1, 1],
  log: [1, 2], ln: [1, 1], sqrt: [1, 1], cbrt: [1, 1], xroot: [2, 2],
  abs: [1, 1], round: [1, 2], iPart: [1, 1], fPart: [1, 1], int: [1, 1],
  max: [1, 2], min: [1, 2], lcm: [2, 2], gcd: [2, 2],
  nDeriv: [3, 4], fnInt: [4, 5], sum: [1, 3], seq: [4, 5],
  mean: [1, 2], median: [1, 2], stdDev: [1, 2], variance: [1, 2],
  randInt: [2, 3], pow10: [1, 1], expe: [1, 1], conj: [1, 1],
  det: [1, 1], identity: [1, 1], rref: [1, 1], ref: [1, 1],
  augment: [2, 2], dim: [1, 1], Fill: [2, 2], randM: [2, 2],
  matr2list: [2, 2], list2matr: [1, 9],
  real: [1, 1], imag: [1, 1], angle: [1, 1], "@seq": [2, 2],
  rectToR: [2, 2], rectToTheta: [2, 2], polarToX: [2, 2], polarToY: [2, 2],
  sortA: [1, 1], sortD: [1, 1], cumSum: [1, 1], deltaList: [1, 1], prod: [1, 3],
  normalpdf: [1, 3], normalcdf: [2, 4], invNorm: [1, 3],
  binompdf: [2, 3], binomcdf: [2, 3], solve: [2, 4],
};

const COMPARE = new Set(["=", "≠", "<", ">", "≤", "≥"]);

class Parser {
  private i = 0;
  constructor(private toks: Token[], private src: string) {}

  private peek(): Token | undefined {
    return this.toks[this.i];
  }
  private at(kind: string, value?: string): boolean {
    const t = this.peek();
    return !!t && t.kind === kind && (value === undefined || t.value === value);
  }
  private next(): Token {
    const t = this.toks[this.i];
    if (!t) throw new ParseError("ERR: SYNTAX", this.src.length);
    this.i += 1;
    return t;
  }
  private eat(kind: string, value?: string): boolean {
    if (this.at(kind, value)) {
      this.i += 1;
      return true;
    }
    return false;
  }
  private here(): number {
    return this.peek()?.start ?? this.src.length;
  }

  parse(): Node {
    if (this.toks.length === 0) throw new ParseError("ERR: SYNTAX", 0);
    const e = this.parseStore();
    if (this.i < this.toks.length) {
      throw new ParseError("ERR: SYNTAX", this.here());
    }
    return e;
  }

  private parseStore(): Node {
    const e = this.parseCompare();
    if (this.at("store")) {
      this.next();
      const t = this.peek();
      if (
        !t ||
        (t.kind !== "var" &&
          t.kind !== "list" &&
          t.kind !== "yref" &&
          t.kind !== "matref")
      ) {
        throw new ParseError("ERR: SYNTAX", this.here());
      }
      this.next();
      return { t: "store", e, target: t.value };
    }
    return e;
  }

  private parseCompare(): Node {
    let l = this.parseSum();
    while (this.peek() && this.peek()!.kind === "op" && COMPARE.has(this.peek()!.value)) {
      const op = this.next().value;
      l = { t: "bin", op, l, r: this.parseSum() };
    }
    return l;
  }

  private parseSum(): Node {
    let l = this.parseProduct();
    for (;;) {
      if (this.at("op", "+")) {
        this.next();
        l = { t: "bin", op: "+", l, r: this.parseProduct() };
      } else if (this.at("op", "-")) {
        this.next();
        l = { t: "bin", op: "-", l, r: this.parseProduct() };
      } else return l;
    }
  }

  private parseProduct(): Node {
    let l = this.parseUnary();
    for (;;) {
      if (this.at("op", "*")) {
        this.next();
        l = { t: "bin", op: "*", l, r: this.parseUnary() };
      } else if (this.at("op", "/")) {
        this.next();
        l = { t: "bin", op: "/", l, r: this.parseUnary() };
      } else if (this.startsImplicitFactor()) {
        l = { t: "bin", op: "*", l, r: this.parseUnary(), implicit: true };
      } else return l;
    }
  }

  /** A value-starting token directly after a value means juxtaposition: 2π, 3sin(X), (X+1)(X-1). */
  private startsImplicitFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    return (
      t.kind === "num" ||
      t.kind === "var" ||
      t.kind === "fn" ||
      t.kind === "const" ||
      t.kind === "list" ||
      t.kind === "yref" ||
      t.kind === "matref" ||
      t.kind === "seqref" ||
      t.kind === "lbracket" ||
      t.kind === "lparen"
    );
  }

  private parseUnary(): Node {
    if (this.at("op", "-")) {
      this.next();
      return { t: "neg", e: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePostfix();
    if (this.at("op", "^")) {
      this.next();
      // right-associative, and the exponent may be negated: 2^-3
      return { t: "bin", op: "^", l: base, r: this.parseUnary() };
    }
    return base;
  }

  private parsePostfix(): Node {
    let e = this.parsePrimary();
    // Y₁(3) applies the stored function rather than multiplying by it.
    if (e.t === "yref" && this.at("lparen")) {
      this.next();
      const arg = this.parseSum();
      this.closeParen();
      e = { t: "call", name: "@y", args: [{ t: "yref", name: e.name }, arg] };
    }
    // u(n-1) is a term of a sequence, not u times (n-1).
    if (e.t === "seqref" && this.at("lparen")) {
      this.next();
      const arg = this.parseSum();
      this.closeParen();
      e = { t: "call", name: "@seq", args: [{ t: "seqref", name: e.name }, arg] };
    }
    for (;;) {
      const t = this.peek();
      if (t && t.kind === "postfix") {
        this.next();
        // 1°2′3″ is one angle, not three factors, so the minutes and seconds
        // are folded in here rather than left to implicit multiplication.
        e = t.value === "°" ? { t: "post", op: "°", e: this.dmsTail(e) } : { t: "post", op: t.value, e };
      } else if (t && t.kind === "fn" && t.value === "xroot") {
        // ˣ√( — index precedes the radical: 3ˣ√(8)
        this.next();
        const arg = this.parseSum();
        this.closeParen();
        e = { t: "call", name: "xroot", args: [e, arg] };
      } else return e;
    }
  }

  /**
   * After a `°`, absorb any `m′` and `s″` that follow, as degrees.
   * The device only accepts literal numbers in those places, and so does this.
   */
  private dmsTail(deg: Node): Node {
    let e = deg;
    for (const [mark, per] of [["′", 60], ["″", 3600]] as const) {
      const num = this.peek();
      const unit = this.toks[this.i + 1];
      if (!num || num.kind !== "num") break;
      if (!unit || unit.kind !== "postfix" || unit.value !== mark) break;
      this.i += 2;
      e = {
        t: "bin",
        op: "+",
        l: e,
        r: { t: "bin", op: "/", l: { t: "num", v: Number(num.value), raw: num.text }, r: { t: "num", v: per, raw: String(per) } },
      };
    }
    return e;
  }

  private closeParen() {
    // Trailing parens are optional, matching the device's forgiving ENTER.
    if (!this.eat("rparen") && this.i < this.toks.length) {
      throw new ParseError("ERR: SYNTAX", this.here());
    }
  }

  /** [[1,2][3,4]] — rows may also be comma-separated, as the device allows. */
  private parseMatrixLiteral(): Node {
    const open = this.peek()!;
    this.next();
    const rows: Node[][] = [];

    while (this.at("lbracket")) {
      this.next();
      const row: Node[] = [];
      if (!this.at("rbracket")) {
        row.push(this.parseSum());
        while (this.eat("comma")) row.push(this.parseSum());
      }
      if (!this.eat("rbracket") && this.i < this.toks.length) {
        throw new ParseError("ERR: SYNTAX", this.here());
      }
      rows.push(row);
      this.eat("comma");
    }

    if (rows.length === 0) throw new ParseError("ERR: INVALID DIM", open.start);
    // the outer bracket may be left unclosed mid-typing
    this.eat("rbracket");
    return { t: "matlit", rows };
  }

  private parsePrimary(): Node {
    const t = this.peek();
    if (!t) throw new ParseError("ERR: SYNTAX", this.src.length);

    if (t.kind === "num") {
      this.next();
      const v = Number(t.value);
      if (!Number.isFinite(v) && t.value !== "Infinity") {
        throw new ParseError("ERR: SYNTAX", t.start);
      }
      return { t: "num", v, raw: t.text };
    }

    if (t.kind === "const") {
      this.next();
      return { t: "const", name: t.value };
    }
    if (t.kind === "var") {
      this.next();
      return { t: "var", name: t.value };
    }
    if (t.kind === "list") {
      this.next();
      return { t: "list", name: t.value };
    }
    if (t.kind === "yref") {
      this.next();
      return { t: "yref", name: t.value };
    }
    if (t.kind === "matref") {
      this.next();
      return { t: "matref", name: t.value };
    }
    if (t.kind === "seqref") {
      this.next();
      return { t: "seqref", name: t.value };
    }
    if (t.kind === "lbracket") return this.parseMatrixLiteral();

    if (t.kind === "fn") {
      this.next();
      const args: Node[] = [];
      if (!this.at("rparen") && this.i < this.toks.length) {
        args.push(this.parseSum());
        while (this.eat("comma")) args.push(this.parseSum());
      }
      this.closeParen();
      const range = ARITY[t.value];
      if (range && (args.length < range[0] || args.length > range[1])) {
        throw new ParseError("ERR: ARGUMENT", t.start);
      }
      if (!range) throw new ParseError("ERR: UNDEFINED", t.start);
      return { t: "call", name: t.value, args };
    }

    if (t.kind === "lparen") {
      this.next();
      if (t.text === "{") {
        const items: Node[] = [];
        if (!this.at("rparen")) {
          items.push(this.parseSum());
          while (this.eat("comma")) items.push(this.parseSum());
        }
        this.eat("rparen");
        return { t: "listlit", items };
      }
      const inner = this.parseCompare();
      this.closeParen();
      return inner;
    }

    throw new ParseError("ERR: SYNTAX", t.start);
  }
}

export function parse(src: string): Node {
  return new Parser(lex(src), src).parse();
}

export function tryParse(src: string): Node | null {
  try {
    return parse(src);
  } catch {
    return null;
  }
}

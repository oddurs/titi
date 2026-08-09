import { CalcError, compile, findRoot, type Env } from "./eval";
import { lex } from "./lexer";
import { parse } from "./parser";

/**
 * The equation solver.
 *
 * An equation is held as `0 = expr`, the way the device holds it. Solving for
 * a variable means finding a root of that expression with every other variable
 * pinned, so this is a thin, testable layer over the root finder the graph
 * already uses.
 */

/** Variables an equation mentions, in the order they first appear. */
export function equationVariables(src: string): string[] {
  const seen: string[] = [];
  for (const t of lex(src)) {
    if (t.kind !== "var") continue;
    // n and nMin belong to sequence graphing, not to a solver equation
    if (t.value === "n" || t.value === "nMin" || t.value === "nMax") continue;
    if (!seen.includes(t.value)) seen.push(t.value);
  }
  return seen;
}

/**
 * Normalise `a = b` into the expression `a - (b)`, so a root of the result is
 * a solution of the equation. An expression with no `=` is already in that form.
 */
export function toZeroForm(src: string): string {
  const parts = splitOnTopLevelEquals(src);
  if (parts.length === 1) return parts[0];
  if (parts.length !== 2) throw new CalcError("ERR: SYNTAX");
  return `(${parts[0]})-(${parts[1]})`;
}

function splitOnTopLevelEquals(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (const t of lex(src)) {
    if (t.kind === "lparen" || t.kind === "fn" || t.kind === "lbracket") depth += 1;
    else if (t.kind === "rparen" || t.kind === "rbracket") depth -= 1;
    else if (depth === 0 && t.kind === "op" && t.value === "=") {
      out.push(src.slice(start, t.start));
      start = t.end;
    }
  }
  out.push(src.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== "");
}

export interface SolveRequest {
  /** the equation as typed, with or without an `=` */
  equation: string;
  /** which variable to solve for */
  target: string;
  /** values for every other variable */
  known: Record<string, number>;
  /** starting point, and the interval searched around it */
  guess: number;
  bound: [number, number];
}

export interface SolveResult {
  value: number;
  /** how far the equation is from zero at the answer */
  residual: number;
}

/**
 * Solve for one variable. Scans outward from the guess for a sign change and
 * refines it — a bracketing method, so a reported root is always real.
 */
export function solveEquation(req: SolveRequest, env: Env): SolveResult {
  const body = compile(parse(toZeroForm(req.equation)));
  const saved = { ...env.vars };

  const f = (x: number): number => {
    env.vars = { ...saved, ...req.known, [req.target]: x };
    const v = body(env);
    return typeof v === "number" ? v : NaN;
  };

  try {
    const [lo, hi] = req.bound;
    if (!(lo < hi)) throw new CalcError("ERR: BOUND");

    const span = hi - lo;
    const start = Math.min(Math.max(req.guess, lo), hi);
    const atGuess = f(start);
    if (Number.isFinite(atGuess) && Math.abs(atGuess) < 1e-12) {
      return { value: start, residual: atGuess };
    }

    // Search outward from the guess in doubling radii, sampling each window
    // finely. Starting coarse and widening finds whichever root happens to
    // fall in the first big bracket; starting fine finds the nearest one,
    // which is what "solve near this guess" should mean.
    const SAMPLES = 256;
    let found: number | null = null;
    const first = Math.max(span / 1e6, 1e-6);

    for (let r = first; found === null && r < span * 2; r *= 2) {
      const a0 = Math.max(lo, start - r);
      const b0 = Math.min(hi, start + r);
      const h = (b0 - a0) / SAMPLES;
      if (h <= 0) break;

      let best: number | null = null;
      let bestDist = Infinity;
      let prevX = a0;
      let prevY = f(a0);

      for (let k = 1; k <= SAMPLES; k++) {
        const x = a0 + k * h;
        const y = f(x);
        if (Number.isFinite(prevY) && Number.isFinite(y)) {
          let root: number | null = null;
          if (prevY === 0) root = prevX;
          else if (y === 0) root = x;
          else if (prevY * y < 0) root = findRoot(f, prevX, x);

          if (root !== null) {
            const d = Math.abs(root - start);
            if (d < bestDist) {
              bestDist = d;
              best = root;
            }
          }
        }
        prevX = x;
        prevY = y;
      }

      if (best !== null) found = best;
      if (a0 <= lo && b0 >= hi) break;
    }

    if (found === null) throw new CalcError("ERR: NO SIGN CHNG");
    return { value: found, residual: f(found) };
  } finally {
    env.vars = saved;
  }
}

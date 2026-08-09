import { sampler, type Env } from "../math/eval";
import type { GraphWindow, Modes, YFunction } from "./types";

/**
 * Every graph mode reduces to the same thing: a parameter running over a
 * range, and a function turning it into a point. Function mode parameterises
 * by x, polar by θ, parametric by t — so the plotter, the trace and the table
 * all share one code path.
 *
 * The six Y slots are reinterpreted rather than duplicated:
 *   func   Y₁..Y₆  are y(x)
 *   pol    r₁..r₆  are r(θ)
 *   par    slots pair up — (Y₁,Y₂) is (X₁ₜ,Y₁ₜ), and so on
 *   seq    u,v,w   are sequences in n, and may refer to their own previous
 *                  term as u(n-1), so they are evaluated forwards and cached
 */

export type GraphMode = "func" | "par" | "pol" | "seq";

export interface Curve {
  /** index of the Y slot this curve draws from (the x-slot, in parametric) */
  index: number;
  label: string;
  color: number;
  style: YFunction["style"];
  /** parameter → point, or null where the function is undefined */
  at: (t: number) => { x: number; y: number };
  /** true when the parameter is x, which lets the plotter sample per pixel */
  isFunction: boolean;
}

export interface ParamRange {
  min: number;
  max: number;
  step: number;
}

/** Slot labels for the Y= editor and the trace readout. */
export function slotLabels(mode: GraphMode): string[] {
  if (mode === "pol") return ["r₁", "r₂", "r₃", "r₄", "r₅", "r₆"];
  if (mode === "par") {
    return ["X₁ₜ", "Y₁ₜ", "X₂ₜ", "Y₂ₜ", "X₃ₜ", "Y₃ₜ"];
  }
  if (mode === "seq") return ["u", "v", "w", "u(nMin)", "v(nMin)", "w(nMin)"];
  return ["Y₁", "Y₂", "Y₃", "Y₄", "Y₅", "Y₆"];
}

/** The three sequences and the slots holding their initial terms. */
export const SEQ_NAMES = ["u", "v", "w"] as const;

/** The variable a slot's expression is written in. */
export const paramVar = (mode: GraphMode): string =>
  mode === "func" ? "X" : mode === "pol" ? "θ" : mode === "seq" ? "n" : "T";

export function paramRange(mode: GraphMode, win: GraphWindow): ParamRange {
  if (mode === "func") {
    return { min: win.xmin, max: win.xmax, step: (win.xmax - win.xmin) / 200 };
  }
  // n is a counter, so it always steps by one.
  if (mode === "seq") return { min: win.nmin, max: win.nmax, step: 1 };
  return { min: win.tmin, max: win.tmax, step: win.tstep };
}

/** A lenient clone, so a domain error yields NaN instead of throwing per sample. */
function localEnv(env: Env): Env {
  return { ...env, lenient: true, vars: { ...env.vars } };
}

/**
 * Sequences are evaluated forwards from nMin, with each term cached, so a
 * recursive definition like u(n-1)+u(n-2) costs one pass rather than
 * exponential re-entry. Terms before nMin come from the initial-value slots.
 */
function buildSequences(ys: YFunction[], env: Env): Curve[] {
  const nMin = env.vars.nMin ?? 1;
  const local = localEnv(env);
  local.vars.nMin = nMin;

  // Every sequence's term function is registered before any of them runs, so a
  // definition may reference itself or either of the others.
  const terms: Record<string, (n: number) => number> = {};
  local.seqTerms = terms;

  const defined: { index: number; name: string; slot: YFunction }[] = [];
  for (let i = 0; i < SEQ_NAMES.length; i++) {
    const slot = ys[i];
    if (!slot?.on || !slot.expr.trim()) continue;
    defined.push({ index: i, name: SEQ_NAMES[i], slot });
  }

  for (const { index, name, slot } of defined) {
    const body = tryCompile(slot.expr, local, "n");
    if (!body) continue;

    // Terms before nMin come from the matching initial-value slot, newest first.
    const seedExpr = ys[index + 3]?.expr?.trim();
    const seeds = seedExpr
      ? seedExpr
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((p) => evaluateQuiet(p, local))
      : [];

    const cache = new Map<number, number>();
    let evaluating = false;

    terms[name] = (n: number): number => {
      const key = Math.round(n);
      if (key < nMin) return seeds[nMin - key - 1] ?? NaN;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      // Walk forward from nMin so a recursive definition only ever asks for
      // terms that are already cached — no re-entry, no exponential blowup.
      if (evaluating) return NaN;
      evaluating = true;
      try {
        for (let k = nMin; k <= key; k++) {
          if (cache.has(k)) continue;
          local.vars.n = k;
          cache.set(k, Number(body(k)));
        }
      } finally {
        evaluating = false;
      }
      return cache.get(key) ?? NaN;
    };
  }

  return defined
    .filter(({ name }) => terms[name])
    .map(({ index, name, slot }) => ({
      index,
      label: name,
      color: slot.color,
      style: slot.style,
      isFunction: false,
      at: (n: number) => ({ x: n, y: terms[name](n) }),
    }));
}

/** Evaluate a seed without letting a bad one take the whole graph down. */
function evaluateQuiet(src: string, env: Env): number {
  try {
    const f = tryCompile(src, env, "n");
    return f ? f(0) : NaN;
  } catch {
    return NaN;
  }
}

function tryCompile(expr: string, env: Env, varName: string) {
  if (!expr.trim()) return null;
  try {
    return sampler(expr, localEnv(env), varName);
  } catch {
    return null;
  }
}

/**
 * Build the drawable curves for the current mode. Slots with empty or
 * unparseable expressions are skipped, as are half-finished parametric pairs.
 */
export function buildCurves(
  ys: YFunction[],
  modes: Pick<Modes, "graphMode">,
  env: Env,
): Curve[] {
  const mode = modes.graphMode;
  const labels = slotLabels(mode);
  const v = paramVar(mode);
  const out: Curve[] = [];

  if (mode === "seq") return buildSequences(ys, env);

  if (mode === "par") {
    for (let i = 0; i + 1 < ys.length; i += 2) {
      const xs = ys[i];
      const yss = ys[i + 1];
      if (!xs.on && !yss.on) continue;
      const fx = tryCompile(xs.expr, env, v);
      const fy = tryCompile(yss.expr, env, v);
      // both halves of the pair are needed for a point
      if (!fx || !fy) continue;
      out.push({
        index: i,
        label: `${labels[i]}, ${labels[i + 1]}`,
        color: xs.color,
        style: xs.style,
        isFunction: false,
        at: (t) => ({ x: fx(t), y: fy(t) }),
      });
    }
    return out;
  }

  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    if (!y.on) continue;
    const f = tryCompile(y.expr, env, v);
    if (!f) continue;

    if (mode === "pol") {
      out.push({
        index: i,
        label: labels[i],
        color: y.color,
        style: y.style,
        isFunction: false,
        at: (th) => {
          const r = f(th);
          // θ is measured in whatever the angle mode says, so convert before
          // resolving the point.
          const rad = env.angle === "deg" ? (th * Math.PI) / 180 : th;
          return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
        },
      });
    } else {
      out.push({
        index: i,
        label: labels[i],
        color: y.color,
        style: y.style,
        isFunction: true,
        at: (x) => ({ x, y: f(x) }),
      });
    }
  }

  return out;
}

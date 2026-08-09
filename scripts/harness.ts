/** Shared assertion helpers for the suites under scripts/. */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0;
let fail = 0;
let suite = "";
const failures: string[] = [];

export function describe(name: string) {
  suite = name;
  console.log(name);
}

export function ok(label: string, condition: boolean, detail = "") {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    const msg = `  ✗ ${suite} — ${label}${detail ? `\n      ${detail}` : ""}`;
    failures.push(msg);
    console.log(msg);
  }
}

export function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  ok(label, g === w, g === w ? "" : `expected ${w}\n      got      ${g}`);
}

/** Floating-point comparison for anything that goes through an iterative solver. */
export function near(label: string, got: number, want: number, tol = 1e-9) {
  const good = Number.isFinite(got) && Math.abs(got - want) <= tol;
  ok(label, good, good ? "" : `expected ${want} ± ${tol}\n      got      ${got}`);
}

export function throws(label: string, f: () => unknown, message?: string) {
  try {
    const v = f();
    ok(label, false, `expected a throw, got ${JSON.stringify(v)}`);
  } catch (e) {
    const actual = (e as Error).message;
    if (message === undefined) ok(label, true);
    else ok(label, actual === message, `expected "${message}", got "${actual}"`);
  }
}

export function report(): never {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

/**
 * Suites end with this so they report when run alone, but stay quiet when
 * scripts/test.ts imports them and reports once at the end.
 *
 * Compare resolved paths, not suffixes — "engine.test.ts" ends with "test.ts",
 * which made every suite think it was the entry point.
 */
export function reportIfMain(moduleUrl: string) {
  const entry = process.argv[1];
  if (!entry) return;
  if (resolve(fileURLToPath(moduleUrl)) === resolve(entry)) report();
}

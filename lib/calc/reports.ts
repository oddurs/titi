import { CalcError, type Env } from "../math/eval";
import { solveEquation } from "../math/solver";
import { solverRows } from "./layout";
import {
  expReg, linReg, lnReg, logisticReg, oneVarStats, pwrReg, quadReg, sinReg,
  twoVarStats, type StatReport,
} from "../math/stats";
import type { EditTarget } from "./types";
import type { CalcState } from "./store";

/** Every regression writes its fit into Y₁, so they share one code path. */
const REGRESSIONS: Record<string, (xs: number[], ys: number[]) => StatReport> = {
  linreg: linReg,
  quadreg: quadReg,
  expreg: expReg,
  lnreg: lnReg,
  pwrreg: pwrReg,
  sinreg: sinReg,
  logisticreg: logisticReg,
};

/**
 * The two things that compute a result and then put it on screen: the
 * statistics menu and the equation solver. Both read state, run something
 * from lib/math, and write a report back.
 */
export interface ReportsCtx {
  get(): CalcState;
  set(patch: Partial<CalcState>): void;
  env: Env;
  note(message: string | null): void;
  persist(): void;
  syncEnv(patch?: Partial<CalcState>): void;
  loadEditTarget(target: EditTarget): void;
}

export function createReports(ctx: ReportsCtx) {
  const { get, set, env, note, persist, syncEnv, loadEditTarget } = ctx;

// -- stats ----------------------------------------------------------------

function runStat(kind: string) {
  const st = get();
  const l1 = st.lists[0];
  const l2 = st.lists[1];
  set({ menu: null });
  try {
    if (kind === "1var") {
      if (l1.length < 1) throw new CalcError("ERR: DIM MISMATCH");
      set({ statReport: oneVarStats(l1), screen: "home" });
    } else if (kind === "2var") {
      if (l1.length < 2 || l1.length !== l2.length) throw new CalcError("ERR: DIM MISMATCH");
      set({ statReport: twoVarStats(l1, l2), screen: "home" });
    } else if (REGRESSIONS[kind]) {
      if (l1.length < 2 || l1.length !== l2.length) throw new CalcError("ERR: DIM MISMATCH");
      const report = REGRESSIONS[kind](l1, l2);
      const ys = st.ys.map((y, i) => (i === 0 ? { ...y, expr: report.expr!, on: true } : y));
      set({ statReport: report, ys, screen: "home", revision: st.revision + 1 });
      syncEnv({ ys });
      persist();
    } else if (kind === "clear") {
      const lists = st.lists.map(() => [] as number[]);
      set({ lists, statReport: null, revision: st.revision + 1 });
      syncEnv({ lists });
      persist();
      note("Lists cleared");
    } else if (kind === "sortA") {
      const lists = st.lists.map((l) => [...l]);
      const order = lists[0].map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
      for (let c = 0; c < 6; c++) {
        if (lists[c].length === order.length) {
          lists[c] = order.map(([, i]) => lists[c][i]);
        }
      }
      set({ lists, revision: st.revision + 1 });
      syncEnv({ lists });
      persist();
    }
  } catch (e) {
    note(e instanceof CalcError ? e.message : "ERR: INVALID");
  }
}

/** Solve the equation for one variable and write the answer back into it. */
function runSolve(target: string) {
  const st = get();
  const { equation, values, bound } = st.solver;
  if (!equation.trim()) return note("ERR: NO EQUATION");
  syncEnv();
  const known: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k !== target) known[k] = v;
  }
  try {
    const { value, residual } = solveEquation(
      { equation, target, known, guess: values[target] ?? 0, bound },
      env,
    );
    set({
      solver: {
        ...st.solver,
        target,
        values: { ...values, [target]: value },
        residual,
      },
      message: null,
    });
    // show the answer in the row that was just solved
    const at = solverRows(get().solver).findIndex(
      (r) => r.kind === "var" && r.name === target,
    );
    if (at >= 0) loadEditTarget({ kind: "solver", row: at });
    persist();
  } catch (e) {
    note(e instanceof CalcError ? e.message : "ERR: SYNTAX");
  }
}

  return { runStat, runSolve };
}

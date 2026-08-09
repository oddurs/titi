import { Interpreter } from "../math/program";
import type { Env } from "../math/eval";
import type { ScreenId } from "./types";
import type { CalcState } from "./store";

/**
 * Running and editing programs.
 *
 * The live interpreter is held here, in a closure variable rather than in
 * reactive state — putting it in the store would clone it on every set, and
 * a program counter does not survive being cloned.
 */
export interface ProgramsCtx {
  get(): CalcState;
  set(patch: Partial<CalcState>): void;
  env: Env;
  note(message: string | null): void;
  persist(): void;
  syncEnv(patch?: Partial<CalcState>): void;
  gotoScreen(screen: ScreenId): void;
}

export function createPrograms(ctx: ProgramsCtx) {
  const { get, set, env, note, persist, syncEnv, gotoScreen } = ctx;

// -- programs ---------------------------------------------------------------

/** The live interpreter is deliberately outside reactive state. */
let vm: Interpreter | null = null;

function pumpProgram() {
  if (!vm) return;
  const st = get();
  const status = vm.run();
  const base = { name: st.prgmRun?.name ?? "", output: [...vm.output] };

  if (status.kind === "input") {
    set({
      prgmRun: { ...base, status: "input", prompt: status.prompt },
      entry: { text: "", caret: 0 },
    });
  } else if (status.kind === "pause") {
    set({ prgmRun: { ...base, status: "pause" } });
  } else if (status.kind === "error") {
    set({ prgmRun: { ...base, status: "error", message: status.message } });
    vm = null;
  } else {
    set({ prgmRun: { ...base, status: "done" } });
    vm = null;
  }
  // A program can store into Y-vars, lists or matrices.
  set({ mats: { ...env.mats }, revision: get().revision + 1 });
  persist();
}

function startProgram(name: string) {
  const st = get();
  const src = st.programs.find((p) => p.name === name);
  if (!src) return note("ERR: UNDEFINED");
  syncEnv();
  vm = new Interpreter(
    src,
    env,
    { notation: st.modes.notation, decimals: st.modes.decimals },
    (n) => get().programs.find((p) => p.name === n),
  );
  set({
    screen: "prgmrun",
    menu: null,
    message: null,
    target: { kind: "home" },
    entry: { text: "", caret: 0 },
    prgmRun: { name, output: [], status: "pause" },
  });
  pumpProgram();
}

function editProgram(name: string) {
  const src = get().programs.find((p) => p.name === name);
  if (!src) return note("ERR: UNDEFINED");
  const lines = src.body.split("\n");
  set({ prgmName: name, prgmLines: lines.length ? lines : [""], menu: null });
  gotoScreen("prgm");
}

function newProgram() {
  const st = get();
  let n = 1;
  while (st.programs.some((p) => p.name === `PRGM${n}`)) n += 1;
  const name = `PRGM${n}`;
  const programs = [...st.programs, { name, body: "" }];
  set({ programs, prgmName: name, prgmLines: [""], menu: null });
  persist();
  gotoScreen("prgm");
}

  return {
    pumpProgram,
    startProgram,
    editProgram,
    newProgram,
    /** Hand the running program the value it asked for. */
    provideInput: (text: string) => vm?.provideInput(text),
    /** Continue past a Pause. */
    resumeProgram: () => vm?.resume(),
  };
}

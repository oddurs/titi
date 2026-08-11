import { Interpreter, type DrawCommand } from "../math/program";
import { parseModeCommand } from "./instructions";
import type { Env } from "../math/eval";
import type { Drawing, MenuState, ScreenId } from "./types";
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
/** The pending re-pump while a program watches the keyboard. */
let keyTimer: ReturnType<typeof setTimeout> | null = null;

function cancelResume() {
  if (keyTimer !== null) clearTimeout(keyTimer);
  keyTimer = null;
}

function scheduleResume() {
  cancelResume();
  // About a frame. Fast enough to feel live, slow enough that a program
  // spinning on getKey costs nothing.
  keyTimer = setTimeout(() => {
    keyTimer = null;
    if (vm && get().screen === "prgmrun" && get().prgmRun?.status === "key") {
      pumpProgram();
    }
  }, 16);
}

/** Turn what a program asked for into something the graph can draw. */
function toDrawing(c: DrawCommand): Drawing | null {
  const [a = 0, b = 0, c2 = 0, d = 0] = c.args;
  switch (c.cmd) {
    case "line": return { kind: "line", x: a, y: b, x2: c2, y2: d };
    case "hline": return { kind: "hline", x: 0, y: a };
    case "vline": return { kind: "vline", x: a, y: 0 };
    // Circle(x, y, r) gives a radius; the panel wants a point on the rim.
    case "circle": return { kind: "circle", x: a, y: b, x2: a + c2, y2: b };
    case "point": return { kind: "point", x: a, y: b, erase: c2 === 1 };
    // Text( takes a row and a column on the device, so the arguments arrive
    // the other way round from every other drawing command.
    case "text": return { kind: "text", x: b, y: a, label: c.text ?? "" };
    default: return null;
  }
}

/** Apply the mode instructions a program used since the last pump. */
function drainModes() {
  if (!vm || !vm.modeChanges.length) return;
  let modes = { ...get().modes };
  let tbl = { ...get().tbl };
  for (const line of vm.modeChanges) {
    const change = parseModeCommand(line);
    if (!change) continue;
    modes = { ...modes, ...change.modes };
    tbl = { ...tbl, ...change.tbl };
  }
  vm.modeChanges.length = 0;
  set({ modes, tbl });
  syncEnv({ modes });
}

/** Apply everything the program drew since the last pump. */
function drainDraws() {
  if (!vm || !vm.draws.length) return;
  let drawings = [...get().drawings];
  for (const c of vm.draws) {
    if (c.cmd === "clear") drawings = [];
    else {
      const d = toDrawing(c);
      if (d) drawings.push(d);
    }
  }
  vm.draws.length = 0;
  set({ drawings });
}

function pumpProgram() {
  if (!vm) return;
  const st = get();
  const status = vm.run();
  drainModes();
  drainDraws();
  const base = {
    name: st.prgmRun?.name ?? "",
    output: [...vm.output],
    placed: vm.placed.map((p) => ({ ...p })),
  };

  if (status.kind === "menu") {
    // A program's menu is the device's menu, so it uses the same one.
    const menu: MenuState = {
      title: status.title || "menu",
      tabs: [{
        name: status.title ? status.title.toLowerCase() : "menu",
        items: status.options.map((o) => ({
          label: o.label,
          action: `prgm:menu:${o.target}`,
        })),
      }],
      tab: 0,
      index: 0,
    };
    set({ prgmRun: { ...base, status: "pause" }, menu });
  } else if (status.kind === "input") {
    set({
      prgmRun: { ...base, status: "input", prompt: status.prompt },
      entry: { text: "", caret: 0 },
    });
  } else if (status.kind === "point") {
    // Hand the graph over with a free cursor on it; ENTER there resumes.
    const win = st.win;
    set({
      prgmRun: { ...base, status: "point" },
      screen: "graph",
      trace: null,
      cursor: st.cursor ?? { x: (win.xmin + win.xmax) / 2, y: (win.ymin + win.ymax) / 2 },
      graphPrompt: { op: "prgm:point", stage: 0 },
      message: "Move to a point, then press enter",
    });
  } else if (status.kind === "key") {
    // The program is watching the keyboard. Give the screen back, then run it
    // again in a moment — a keypress in between lands in env.lastKey.
    set({ prgmRun: { ...base, status: "key" } });
    scheduleResume();
  } else if (status.kind === "pause") {
    set({ prgmRun: { ...base, status: "pause" } });
  } else if (status.kind === "error") {
    cancelResume();
    set({ prgmRun: { ...base, status: "error", message: status.message } });
    vm = null;
  } else {
    cancelResume();
    set({ prgmRun: { ...base, status: "done" } });
    vm = null;
  }
  // A program can store into Y-vars, lists or matrices.
  set({ mats: { ...env.mats }, revision: get().revision + 1 });
  persist();
}

function startProgram(name: string) {
  cancelResume();
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
  // lib/math has no idea what a device mode is, so it asks.
  vm.isModeCommand = (line) => parseModeCommand(line) !== null;
  set({
    screen: "prgmrun",
    menu: null,
    message: null,
    target: { kind: "home" },
    entry: { text: "", caret: 0 },
    prgmRun: { name, output: [], placed: [], status: "pause" },
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
    /**
     * Hand a keypress to a program that is watching for one. Returns true when
     * the program took it, so the key does not also do its usual job.
     */
    offerKey: (code: number) => {
      if (!vm || get().prgmRun?.status !== "key") return false;
      env.lastKey = code;
      cancelResume();
      pumpProgram();
      return true;
    },
    /** The cursor was placed for a bare Input; store it and carry on. */
    provideProgramPoint: (x: number, y: number) => {
      if (!vm) return;
      vm.providePoint(x, y);
      set({ screen: "prgmrun", graphPrompt: null, message: null });
      pumpProgram();
    },
    /** Stop the re-pump when the program screen is left behind. */
    stopProgram: () => {
      cancelResume();
      vm = null;
    },
    /** A choice was made in a program's Menu(; continue from its label. */
    chooseProgramMenu: (target: string) => {
      vm?.chooseMenu(target);
      set({ menu: null });
      pumpProgram();
    },
  };
}

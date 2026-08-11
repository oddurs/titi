import { CalcError, evaluate, type Env } from "./eval";
import { formatValue, type FormatOpts } from "./format";

/**
 * A TI-BASIC interpreter that can suspend.
 *
 * `Input`, `Prompt` and `Pause` all need the user, and the calculator is a
 * synchronous state machine, so this is a program counter with an explicit
 * call stack rather than a recursive walk. `run()` executes until the program
 * finishes, errors, or needs something; the caller then supplies it and calls
 * `run()` again.
 */

export type Status =
  | { kind: "done" }
  | { kind: "error"; message: string; line: number }
  | { kind: "input"; prompt: string; target: string }
  | { kind: "menu"; title: string; options: { label: string; target: string }[] }
  /** the program looked at the keyboard and found nothing; run it again soon */
  | { kind: "key" }
  /** a bare Input: show the graph and store where the cursor lands */
  | { kind: "point" }
  | { kind: "pause" };

/**
 * A drawing a program asked for.
 *
 * Deliberately not the display layer's `Drawing`: this module is pure maths
 * and must not know about the device, so it emits coordinates and lets the
 * store turn them into something the graph can draw.
 */
/** A mode instruction a program used; the caller applies it. */
export interface ModeCommand {
  line: string;
}

export interface DrawCommand {
  cmd: "line" | "hline" | "vline" | "circle" | "point" | "text" | "clear";
  args: number[];
  text?: string;
}

interface Block {
  /** index of the matching End */
  end: number;
  /** index of the Else, for If/Then blocks that have one */
  elseAt?: number;
  /** for an End, the index of the block opener */
  start?: number;
}

interface Frame {
  name: string;
  lines: string[];
  blocks: Map<number, Block>;
  labels: Map<string, number>;
  pc: number;
  /** live For-loop bounds, keyed by the line index of the For */
  loops: Map<number, { name: string; limit: number; step: number }>;
}

export interface ProgramSource {
  name: string;
  body: string;
}

/** Split on a delimiter that is not inside quotes, parens or brackets. */
export function splitTop(src: string, delim = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === "(" || c === "[" || c === "{")) depth += 1;
    else if (!quoted && (c === ")" || c === "]" || c === "}")) depth -= 1;
    else if (!quoted && depth === 0 && c === delim) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  out.push(src.slice(start));
  return out.map((s) => s.trim()).filter((s, i, a) => s !== "" || a.length === 1);
}

const isString = (s: string) => s.startsWith('"');
const unquote = (s: string) => s.replace(/^"|"$/g, "");

/** The keyword a line starts with, or "" for a bare expression. */
function keyword(line: string): string {
  const t = line.trim();
  for (const k of [
    "Disp", "Output(", "Input", "Prompt", "If", "Then", "Else", "End",
    "For(", "While", "Repeat", "Lbl", "Goto", "Pause", "Stop", "Return",
    "ClrHome", "ClrList", "DelVar", "prgm", "Menu(", "IS>(", "DS<(",
    "Line(", "Horizontal", "Vertical", "Circle(", "Text(", "Pt-On(", "Pt-Off(",
    "ClrDraw",
  ]) {
    if (
      t === k ||
      t.startsWith(k + " ") ||
      (k.endsWith("(") && t.startsWith(k)) ||
      (k === "prgm" && t.startsWith(k))
    ) {
      return k;
    }
  }
  return "";
}

const argsOf = (line: string, kw: string) =>
  line.trim().slice(kw.length).replace(/^\(|\)$/g, "").trim();

/** Match block openers to their End (and Else), once, before execution. */
function analyse(lines: string[]): { blocks: Map<number, Block>; labels: Map<string, number> } {
  const blocks = new Map<number, Block>();
  const labels = new Map<string, number>();
  const stack: number[] = [];

  lines.forEach((line, i) => {
    const kw = keyword(line);
    if (kw === "Lbl") labels.set(argsOf(line, "Lbl"), i);

    if (kw === "Then" || kw === "For(" || kw === "While" || kw === "Repeat") {
      stack.push(i);
      blocks.set(i, { end: -1 });
    } else if (kw === "Else") {
      const top = stack[stack.length - 1];
      if (top !== undefined) blocks.get(top)!.elseAt = i;
    } else if (kw === "End") {
      const top = stack.pop();
      if (top !== undefined) {
        blocks.get(top)!.end = i;
        blocks.set(i, { end: i, start: top });
      }
    }
  });

  return { blocks, labels };
}

export function parseProgram(name: string, body: string): Frame {
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^:/, "").trim());
  const { blocks, labels } = analyse(lines);
  return { name, lines, blocks, labels, pc: 0, loops: new Map() };
}

export class Interpreter {
  readonly output: string[] = [];
  /** what the program has asked to be drawn, for the caller to drain */
  readonly draws: DrawCommand[] = [];
  /**
   * Mode instructions the program used. lib/math must not know what a device
   * mode is, so the line is handed out and the caller decides what it means.
   */
  readonly modeChanges: string[] = [];
  /**
   * Text put somewhere specific by Output(, as opposed to Disp's scroll.
   * The device has one screen and both write to it, so they are kept apart
   * here and laid over one another when drawn.
   */
  readonly placed: { row: number; col: number; text: string }[] = [];
  private stack: Frame[] = [];
  private pending: { target: string; prompt: string } | null = null;
  private steps = 0;
  private halted = false;

  constructor(
    entry: ProgramSource,
    private env: Env,
    private fmt: FormatOpts,
    /** resolves prgmNAME calls */
    private lookup: (name: string) => ProgramSource | undefined = () => undefined,
    private maxSteps = 200_000,
  ) {
    this.stack.push(parseProgram(entry.name, entry.body));
  }

  /** Set by the caller: which lines are mode instructions rather than maths. */
  isModeCommand: (line: string) => boolean = () => false;

  /** Store where the cursor was left, for a bare Input. */
  providePoint(x: number, y: number) {
    this.env.vars.X = x;
    this.env.vars.Y = y;
  }

  /** Continue from the label a Menu( choice named. */
  chooseMenu(target: string) {
    const f = this.frame;
    if (!f) return;
    const at = f.labels.get(target.trim());
    if (at === undefined) {
      this.halted = true;
      return;
    }
    f.pc = at;
  }

  private get frame(): Frame | undefined {
    return this.stack[this.stack.length - 1];
  }

  private print(text: string) {
    this.output.push(text);
    if (this.output.length > 400) this.output.shift();
  }

  private value(src: string): string {
    if (isString(src)) return unquote(src);
    return formatValue(evaluate(src, this.env), this.fmt);
  }

  /** Supply the value an `Input`/`Prompt` was waiting for. */
  provideInput(text: string) {
    if (!this.pending) return;
    const { target } = this.pending;
    this.pending = null;
    const src = text.trim() === "" ? "0" : text;
    evaluate(`${src}→${target}`, this.env);
    if (this.frame) this.frame.pc += 1;
  }

  /** Continue past a `Pause`. */
  resume() {
    if (this.frame) this.frame.pc += 1;
  }

  run(): Status {
    while (!this.halted) {
      if (this.steps++ > this.maxSteps) {
        return { kind: "error", message: "ERR: ITERATIONS", line: this.frame?.pc ?? 0 };
      }

      const f = this.frame;
      if (!f) return { kind: "done" };

      if (f.pc >= f.lines.length) {
        this.stack.pop();
        if (this.stack.length) this.stack[this.stack.length - 1].pc += 1;
        continue;
      }

      const line = f.lines[f.pc];
      if (line === "") {
        f.pc += 1;
        continue;
      }

      try {
        this.env.keyEmpty = false;
        const status = this.exec(f, line);
        // A statement that read getKey and found nothing hands the screen
        // back, so the display paints and a keypress can arrive. The caller
        // runs it again — which is what makes `Repeat getKey` a loop the user
        // can actually escape, rather than a spin to the step limit.
        if (!status && this.env.keyEmpty) return { kind: "key" };
        if (status) return status;
      } catch (e) {
        this.halted = true;
        const message = e instanceof CalcError ? e.message : "ERR: SYNTAX";
        return { kind: "error", message, line: f.pc };
      }
    }
    return { kind: "done" };
  }

  /** Returns a Status when the program needs to suspend, otherwise undefined. */
  private exec(f: Frame, line: string): Status | undefined {
    // A mode instruction is the whole line and means nothing to the maths, so
    // it is recorded for the caller before anything tries to evaluate it.
    if (this.isModeCommand(line.trim())) {
      this.modeChanges.push(line.trim());
      f.pc += 1;
      return;
    }

    const kw = keyword(line);

    switch (kw) {
      case "Disp": {
        for (const arg of splitTop(argsOf(line, "Disp"))) {
          if (arg !== "") this.print(this.value(arg));
        }
        f.pc += 1;
        return;
      }

      case "Output(": {
        // Output(row, column, thing) — the device counts both from one.
        const parts = splitTop(argsOf(line, "Output("));
        if (parts.length < 3) throw new CalcError("ERR: ARGUMENT");
        const at = parts.slice(0, 2).map((a) => {
          const v = evaluate(a, this.env);
          if (typeof v !== "number") throw new CalcError("ERR: DATA TYPE");
          return Math.round(v);
        });
        const text = parts.slice(2).map((a) => this.value(a)).join("");
        const row = at[0] - 1;
        const col = at[1] - 1;
        if (row < 0 || col < 0) throw new CalcError("ERR: DOMAIN");
        // Writing over the same spot replaces what was there, as it would on
        // a real screen — otherwise a loop that counts down leaves a trail.
        const existing = this.placed.findIndex((p) => p.row === row && p.col === col);
        if (existing >= 0) this.placed.splice(existing, 1);
        this.placed.push({ row, col, text });
        f.pc += 1;
        return;
      }

      case "Input":
      case "Prompt": {
        const parts = splitTop(argsOf(line, kw));
        // A bare Input asks for a place rather than a value: the device shows
        // the graph and stores where the cursor is left.
        if (kw === "Input" && (!parts.length || parts[0] === "")) {
          f.pc += 1;
          return { kind: "point" };
        }
        if (kw === "Prompt") {
          // Prompt A,B asks for each in turn; ask for the first still unset.
          const target = parts[0];
          this.pending = { target, prompt: `${target}=` };
          if (parts.length > 1) {
            f.lines[f.pc] = `Prompt ${parts.slice(1).join(",")}`;
            f.pc -= 1; // re-enter this line for the remaining variables
          }
          return { kind: "input", prompt: `${target}=`, target };
        }
        const hasPrompt = parts.length > 1 && isString(parts[0]);
        const target = parts[parts.length - 1];
        const prompt = hasPrompt ? unquote(parts[0]) : "?";
        this.pending = { target, prompt };
        return { kind: "input", prompt, target };
      }

      case "Menu(": {
        // Menu("TITLE","CHOICE",LBL,"CHOICE",LBL,…) — the caller shows it and
        // says which label was picked, which is the same shape as Input.
        const parts = splitTop(argsOf(line, "Menu("));
        const title = parts.length && isString(parts[0]) ? unquote(parts[0]) : "";
        const options: { label: string; target: string }[] = [];
        for (let i = 1; i + 1 < parts.length; i += 2) {
          options.push({ label: unquote(parts[i]), target: parts[i + 1] });
        }
        if (!options.length) throw new CalcError("ERR: SYNTAX");
        // Land on the line after the menu when the chosen label is resumed.
        f.pc += 1;
        return { kind: "menu", title, options };
      }

      case "IS>(":
      case "DS<(": {
        // IS>(A,10): add one to A, and if it is now past 10, skip the next
        // line. DS<( counts the other way. The skip is the whole point — it is
        // how a loop is written without a For.
        const [name, boundSrc] = splitTop(argsOf(line, kw));
        if (!name || boundSrc === undefined) throw new CalcError("ERR: SYNTAX");
        const step = kw === "IS>(" ? 1 : -1;
        const next = (this.env.vars[name.trim()] ?? 0) + step;
        this.env.vars[name.trim()] = next;
        const bound = evaluate(boundSrc, this.env);
        if (typeof bound !== "number") throw new CalcError("ERR: DATA TYPE");
        const skip = step > 0 ? next > bound : next < bound;
        f.pc += skip ? 2 : 1;
        return;
      }

      case "ClrDraw":
        this.draws.push({ cmd: "clear", args: [] });
        f.pc += 1;
        return;

      case "Line(":
      case "Circle(":
      case "Pt-On(":
      case "Pt-Off(":
      case "Horizontal":
      case "Vertical":
      case "Text(": {
        const parts = splitTop(argsOf(line, kw));
        const nums = (from = 0, to = parts.length) =>
          parts.slice(from, to).map((a) => {
            const v = evaluate(a, this.env);
            if (typeof v !== "number") throw new CalcError("ERR: DATA TYPE");
            return v;
          });
        if (kw === "Text(") {
          // Text(row, col, thing) — the last argument is what to write.
          const at = nums(0, 2);
          const body = parts.slice(2).map((a) => this.value(a)).join("");
          this.draws.push({ cmd: "text", args: at, text: body });
        } else if (kw === "Horizontal") {
          this.draws.push({ cmd: "hline", args: nums() });
        } else if (kw === "Vertical") {
          this.draws.push({ cmd: "vline", args: nums() });
        } else if (kw === "Line(") {
          this.draws.push({ cmd: "line", args: nums() });
        } else if (kw === "Circle(") {
          this.draws.push({ cmd: "circle", args: nums() });
        } else {
          this.draws.push({ cmd: "point", args: [...nums(), kw === "Pt-Off(" ? 1 : 0] });
        }
        f.pc += 1;
        return;
      }

      case "If": {
        const cond = evaluate(argsOf(line, "If"), this.env);
        const truthy = typeof cond === "number" ? cond !== 0 : true;
        const next = f.lines[f.pc + 1] ?? "";

        if (keyword(next) === "Then") {
          const block = f.blocks.get(f.pc + 1);
          if (truthy) {
            f.pc += 2;
          } else if (block?.elseAt !== undefined) {
            f.pc = block.elseAt + 1;
          } else {
            f.pc = (block?.end ?? f.pc + 1) + 1;
          }
        } else {
          // single-statement form: the next line is the body
          f.pc += truthy ? 1 : 2;
        }
        return;
      }

      case "Then":
        f.pc += 1;
        return;

      case "Else": {
        // reached by falling out of the then-branch
        const block = [...f.blocks.entries()].find(([, b]) => b.elseAt === f.pc);
        f.pc = (block?.[1].end ?? f.pc) + 1;
        return;
      }

      case "For(": {
        const parts = splitTop(argsOf(line, "For("));
        if (parts.length < 3) throw new CalcError("ERR: SYNTAX");
        const name = parts[0];
        const start = Number(evaluate(parts[1], this.env));
        const limit = Number(evaluate(parts[2], this.env));
        const step = parts[3] ? Number(evaluate(parts[3], this.env)) : 1;

        if (!f.loops.has(f.pc)) {
          this.env.vars[name] = start;
          f.loops.set(f.pc, { name, limit, step });
        }
        const done = step >= 0 ? this.env.vars[name] > limit : this.env.vars[name] < limit;
        if (done) {
          f.loops.delete(f.pc);
          f.pc = (f.blocks.get(f.pc)?.end ?? f.pc) + 1;
        } else {
          f.pc += 1;
        }
        return;
      }

      case "While": {
        const cond = evaluate(argsOf(line, "While"), this.env);
        const truthy = typeof cond === "number" ? cond !== 0 : true;
        f.pc = truthy ? f.pc + 1 : (f.blocks.get(f.pc)?.end ?? f.pc) + 1;
        return;
      }

      case "Repeat":
        // Repeat always runs its body once, then tests at the End.
        f.pc += 1;
        return;

      case "End": {
        const start = f.blocks.get(f.pc)?.start;
        if (start === undefined) {
          f.pc += 1;
          return;
        }
        const openKw = keyword(f.lines[start]);

        if (openKw === "For(") {
          const loop = f.loops.get(start);
          if (loop) {
            this.env.vars[loop.name] += loop.step;
            f.pc = start;
          } else {
            f.pc += 1;
          }
        } else if (openKw === "While") {
          f.pc = start;
        } else if (openKw === "Repeat") {
          const cond = evaluate(argsOf(f.lines[start], "Repeat"), this.env);
          const truthy = typeof cond === "number" ? cond !== 0 : true;
          f.pc = truthy ? f.pc + 1 : start + 1;
        } else {
          f.pc += 1;
        }
        return;
      }

      case "Lbl":
        f.pc += 1;
        return;

      case "Goto": {
        const target = f.labels.get(argsOf(line, "Goto"));
        if (target === undefined) throw new CalcError("ERR: LABEL");
        f.pc = target + 1;
        return;
      }

      case "Pause": {
        const arg = argsOf(line, "Pause");
        if (arg) this.print(this.value(arg));
        return { kind: "pause" };
      }

      case "Stop":
        this.halted = true;
        return { kind: "done" };

      case "Return": {
        this.stack.pop();
        if (this.stack.length) this.stack[this.stack.length - 1].pc += 1;
        else this.halted = true;
        return;
      }

      case "ClrHome":
        this.placed.length = 0;
        this.output.length = 0;
        f.pc += 1;
        return;

      case "ClrList": {
        for (const name of splitTop(argsOf(line, "ClrList"))) {
          this.env.lists[name] = [];
        }
        f.pc += 1;
        return;
      }

      case "DelVar": {
        for (const name of splitTop(argsOf(line, "DelVar"))) {
          this.env.vars[name] = 0;
        }
        f.pc += 1;
        return;
      }

      case "prgm": {
        const name = line.trim().slice(4).trim();
        const src = this.lookup(name);
        if (!src) throw new CalcError("ERR: UNDEFINED");
        if (this.stack.length > 16) throw new CalcError("ERR: MEMORY");
        this.stack.push(parseProgram(src.name, src.body));
        return;
      }

      default: {
        // A bare expression displays its value; a store is silent.
        const v = evaluate(line, this.env);
        this.env.ans = v;
        if (typeof v === "number") this.env.vars.Ans = v;
        if (!line.includes("→")) this.print(formatValue(v, this.fmt));
        f.pc += 1;
        return;
      }
    }
  }
}

/** Programs that ship with the calculator so PRGM is not an empty room. */
export const SAMPLE_PROGRAMS: ProgramSource[] = [
  {
    name: "QUADRAT",
    body: [
      'Disp "AX²+BX+C=0"',
      'Prompt A,B,C',
      'B²-4AC→D',
      'If D<0',
      'Then',
      'Disp "NO REAL ROOTS"',
      'Else',
      '(-B+√(D))/(2A)→X',
      '(-B-√(D))/(2A)→Y',
      'Disp "ROOTS",X,Y',
      'End',
    ].join("\n"),
  },
  {
    name: "COLLATZ",
    body: [
      'Prompt N',
      '0→C',
      'While N≠1',
      'If fPart(N/2)=0',
      'Then',
      'N/2→N',
      'Else',
      '3N+1→N',
      'End',
      'C+1→C',
      'End',
      'Disp "STEPS",C',
    ].join("\n"),
  },
  {
    name: "FIB",
    body: [
      'Prompt N',
      '0→A',
      '1→B',
      'For(I,1,N)',
      'A+B→C',
      'B→A',
      'C→B',
      'End',
      'Disp A',
    ].join("\n"),
  },
  {
    name: "SHAPES",
    body: [
      'Menu("DRAW WHAT?","TARGET",A,"WAVE",B)',
      'Lbl A',
      'ClrDraw',
      'For(R,1,5)',
      'Circle(0,0,R)',
      'End',
      'Line(-8,0,8,0)',
      'Text(1,1,"TARGET")',
      'Stop',
      'Lbl B',
      'ClrDraw',
      'For(X,-9,9,.5)',
      'Pt-On(X,4sin(X))',
      'End',
      'Text(1,1,"WAVE")',
    ].join("\n"),
  },
  {
    name: "KEYPAD",
    body: [
      'ClrHome',
      'Output(1,1,"PRESS A KEY")',
      '0→K',
      'Repeat K',
      'getKey→K',
      'End',
      'Output(3,1,"CODE")',
      'Output(3,6,K)',
      'Output(5,1,"ON QUITS")',
    ].join("\n"),
  },
];

import { describe, eq, ok, reportIfMain } from "./harness";
import { Interpreter, SAMPLE_PROGRAMS, splitTop, type ProgramSource } from "../lib/math/program";
import { makeEnv } from "../lib/math/eval";

const fmt = { notation: "normal" as const, decimals: -1 };

/**
 * Run a program to completion, feeding `inputs` to each Input/Prompt in turn.
 * Returns the output lines, or the error string if it failed.
 */
function run(body: string, inputs: string[] = [], extra: ProgramSource[] = []) {
  const env = makeEnv();
  const all = [...extra];
  const vm = new Interpreter(
    { name: "TEST", body },
    env,
    fmt,
    (name) => all.find((p) => p.name === name),
  );

  let guard = 0;
  for (;;) {
    if (guard++ > 200) return ["ERR: TEST LOOP"];
    const s = vm.run();
    if (s.kind === "done") return vm.output;
    if (s.kind === "error") return [s.message];
    if (s.kind === "pause") {
      vm.resume();
      continue;
    }
    vm.provideInput(inputs.shift() ?? "0");
  }
}

/** Same, but hand back the environment so stores can be inspected. */
function runEnv(body: string, inputs: string[] = []) {
  const env = makeEnv();
  const vm = new Interpreter({ name: "TEST", body }, env, fmt);
  let guard = 0;
  for (;;) {
    if (guard++ > 200) break;
    const s = vm.run();
    if (s.kind === "done" || s.kind === "error") break;
    if (s.kind === "pause") vm.resume();
    else vm.provideInput(inputs.shift() ?? "0");
  }
  return env;
}

describe("argument splitting");
eq("plain", splitTop("A,B,C"), ["A", "B", "C"]);
eq("nested parens are not split", splitTop("max(1,2),B"), ["max(1,2)", "B"]);
eq("quoted commas survive", splitTop('"A,B",C'), ['"A,B"', "C"]);
eq("brackets are not split", splitTop("[[1,2][3,4]],X"), ["[[1,2][3,4]]", "X"]);

describe("output");
eq("Disp a literal", run('Disp "HELLO"'), ["HELLO"]);
eq("Disp a value", run("Disp 6*7"), ["42"]);
eq("Disp several arguments", run('Disp "A",1,2'), ["A", "1", "2"]);
eq("a bare expression displays", run("2+2"), ["4"]);
eq("a store is silent", run("5→A"), []);
eq("Output ignores position", run('Output(1,1,"X")'), ["X"]);
eq("ClrHome wipes earlier output", run('Disp "A"\nClrHome\nDisp "B"'), ["B"]);

describe("stores and variables");
eq("store then read", run("7→A\nDisp A"), ["7"]);
eq("arithmetic across lines", run("3→A\n4→B\nDisp A²+B²"), ["25"]);
ok("store lands in the env", runEnv("9→Z").vars.Z === 9);
eq("DelVar zeroes", run("5→A\nDelVar A\nDisp A"), ["0"]);

describe("input");
eq("Input assigns", run("Input A\nDisp A*2", ["21"]), ["42"]);
eq("Input with a prompt", run('Input "N=",N\nDisp N', ["8"]), ["8"]);
eq("Prompt takes several", run("Prompt A,B\nDisp A+B", ["3", "4"]), ["7"]);

describe("If / Then / Else");
eq("single-statement true", run('1→A\nIf A=1\nDisp "YES"'), ["YES"]);
eq("single-statement false skips one line", run('0→A\nIf A=1\nDisp "YES"\nDisp "AFTER"'), ["AFTER"]);
eq("block then", run('If 1\nThen\nDisp "T"\nEnd\nDisp "AFTER"'), ["T", "AFTER"]);
eq("block else", run('If 0\nThen\nDisp "T"\nElse\nDisp "F"\nEnd'), ["F"]);
eq("then branch skips the else", run('If 1\nThen\nDisp "T"\nElse\nDisp "F"\nEnd\nDisp "Z"'), ["T", "Z"]);
eq(
  "nested blocks",
  run('1→A\n0→B\nIf A\nThen\nIf B\nThen\nDisp "AB"\nElse\nDisp "A"\nEnd\nEnd'),
  ["A"],
);

describe("For");
eq("counts up", run('For(I,1,3)\nDisp I\nEnd'), ["1", "2", "3"]);
eq("respects a step", run("For(I,0,10,5)\nDisp I\nEnd"), ["0", "5", "10"]);
eq("counts down", run("For(I,3,1,-1)\nDisp I\nEnd"), ["3", "2", "1"]);
eq("zero iterations", run('For(I,5,1)\nDisp I\nEnd\nDisp "AFTER"'), ["AFTER"]);
eq("accumulates", run("0→S\nFor(I,1,10)\nS+I→S\nEnd\nDisp S"), ["55"]);
eq(
  "nested loops",
  run("0→C\nFor(I,1,3)\nFor(J,1,3)\nC+1→C\nEnd\nEnd\nDisp C"),
  ["9"],
);

describe("While and Repeat");
eq("While counts", run("1→I\nWhile I≤3\nDisp I\nI+1→I\nEnd"), ["1", "2", "3"]);
eq("While never entered", run('While 0\nDisp "NO"\nEnd\nDisp "OK"'), ["OK"]);
eq("Repeat always runs once", run('1→I\nRepeat I≥1\nDisp "ONCE"\nI+1→I\nEnd'), ["ONCE"]);
eq(
  "Repeat until the condition holds",
  run("0→I\nRepeat I≥3\nI+1→I\nEnd\nDisp I"),
  ["3"],
);

describe("Lbl / Goto / Stop / Return");
eq("Goto skips forward", run('Goto A\nDisp "SKIPPED"\nLbl A\nDisp "HERE"'), ["HERE"]);
eq("Goto loops back", run('0→I\nLbl A\nI+1→I\nIf I<3\nGoto A\nDisp I'), ["3"]);
eq("Stop halts", run('Disp "A"\nStop\nDisp "B"'), ["A"]);
eq("missing label errors", run("Goto Q"), ["ERR: LABEL"]);

describe("subprograms");
eq(
  "prgm calls another program",
  run('Disp "MAIN"\nprgmSUB\nDisp "BACK"', [], [
    { name: "SUB", body: 'Disp "SUB"' },
  ]),
  ["MAIN", "SUB", "BACK"],
);
eq("calling a missing program errors", run("prgmNOPE"), ["ERR: UNDEFINED"]);

describe("errors and safety");
eq("division by zero surfaces", run("Disp 1/0"), ["ERR: DIVIDE BY 0"]);
eq("syntax errors surface", run("Disp 2+"), ["ERR: SYNTAX"]);
eq("runaway loops are cut off", run("Lbl A\nGoto A"), ["ERR: ITERATIONS"]);

describe("bundled programs");
const quad = SAMPLE_PROGRAMS.find((p) => p.name === "QUADRAT")!;
eq(
  "QUADRAT solves x²-3x+2",
  run(quad.body, ["1", "-3", "2"]).slice(-3),
  ["ROOTS", "2", "1"],
);
eq(
  "QUADRAT reports no real roots",
  run(quad.body, ["1", "0", "1"]).slice(-1),
  ["NO REAL ROOTS"],
);

const fib = SAMPLE_PROGRAMS.find((p) => p.name === "FIB")!;
eq("FIB(10) is 55", run(fib.body, ["10"]), ["55"]);
eq("FIB(1) is 1", run(fib.body, ["1"]), ["1"]);

const collatz = SAMPLE_PROGRAMS.find((p) => p.name === "COLLATZ")!;
eq("COLLATZ(6) takes 8 steps", run(collatz.body, ["6"]), ["STEPS", "8"]);
eq("COLLATZ(1) takes 0 steps", run(collatz.body, ["1"]), ["STEPS", "0"]);

reportIfMain(import.meta.url);

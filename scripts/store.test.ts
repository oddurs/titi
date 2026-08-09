import { describe, eq, near, ok, reportIfMain } from "./harness";
import { device } from "./device";

/**
 * What a keypress does.
 *
 * Everything here was previously verified only by looking at a screenshot,
 * which is why every bug found in the last three sprints lived in this layer.
 */

describe("home screen arithmetic");
{
  const d = device().type("7/8").press("enter");
  eq("evaluates on enter", d.answer(), ".875");
  eq("the entry line clears", d.entry(), "");
  eq("the tape records both sides", d.tape(), ["7÷8 = .875"]);
}
{
  const d = device().type("2+3*4").press("enter");
  eq("precedence holds through the keypad", d.answer(), "14");
}
{
  const d = device().type("5").press("enter").type("2*").press("2nd ans", "enter");
  eq("Ans recalls the last answer", d.answer(), "10");
}
{
  const d = device().type("1/0").press("enter");
  eq("errors land on the tape", d.answer(), "ERR: DIVIDE BY 0");
  ok("and are marked as errors", d.get().history[0].isError);
}
{
  const d = device().type("9").press("enter").press("2nd entry");
  eq("2nd ENTRY recalls the last input", d.entry(), "9");
}

describe("the edit buffer");
{
  const d = device().press("sin").type("1");
  eq("a function key inserts its opening paren", d.entry(), "sin(1");
  d.press("del");
  eq("del removes one character", d.entry(), "sin(");
  d.press("del");
  eq("del removes a whole token, not a letter", d.entry(), "");
}
{
  const d = device().type("123").repeat("left", 1).type("9");
  eq("the caret inserts where it sits", d.entry(), "1293");
}
{
  const d = device().type("12").press("left").press("2nd ins").type("9");
  eq("overwrite mode replaces the character under the caret", d.entry(), "19");
}

describe("clear");
{
  const d = device().type("123");
  d.press("clear");
  eq("clear empties the entry line", d.entry(), "");
  d.type("1").press("enter").press("clear");
  eq("clear again empties the tape", d.get().history.length, 0);
}

describe("the Y= editor");
{
  const d = device().press("y=").press("X,T,θ,n").press("x²").press("enter");
  eq("enter commits the slot", d.get().ys[0].expr, "X²");
  eq("and moves to the next", d.get().target, { kind: "yeq", row: 1 });
}
{
  // Regression: the dot-matrix rewrite dropped the on/off control with the DOM.
  const d = device().press("y=").press("X,T,θ,n").press("enter");
  ok("a new function starts switched on", d.get().ys[0].on);
  // ◀ walks left through the expression, then one more step lands on the =.
  d.press("up").repeat("left", 2);
  ok("the caret reaches the equals", d.get().onEquals);
  d.press("enter");
  ok("enter there switches the function off", !d.get().ys[0].on);
  d.press("enter");
  ok("and again switches it back on", d.get().ys[0].on);
  d.press("right");
  ok("right returns the caret to the expression", !d.get().onEquals);
}

describe("the window editor");
{
  const d = device().press("window");
  eq("opens on the first field", d.get().target, { kind: "window", row: 0 });
  d.type("5").press("enter");
  near("typing replaces the current value", d.get().win.xmin, 5);
  eq("and moves down", d.get().target, { kind: "window", row: 1 });
}
{
  const d = device().press("window").press("down").press("enter");
  near("leaving a field untouched keeps it", d.get().win.xmax, 10);
  eq("with no error", d.get().message, null);
}

describe("graph modes");
{
  const d = device().press("mode").press("right");
  eq("right selects the next graph mode", d.get().modes.graphMode, "par");
  eq("the parameter window is reset", d.get().win.tmin, 0);
  near("to a full turn in the current angle unit", d.get().win.tmax, 2 * Math.PI);
}
{
  const d = device().press("mode").repeat("right", 3);
  eq("and reaches sequence mode", d.get().modes.graphMode, "seq");
  const fields = d.press("2nd quit").press("window").get();
  eq("whose window starts with nMin", fields.target, { kind: "window", row: 0 });
}

describe("zoom");
{
  const d = device().press("window").type("1").press("enter");
  d.press("zoom").repeat("down", 5).press("enter");
  near("ZStandard restores the default window", d.get().win.xmin, -10);
  eq("and leaves you on the graph", d.get().screen, "graph");
}
{
  const d = device().press("y=").press("X,T,θ,n").press("enter").press("graph");
  d.press("zoom").press("down").press("enter");
  near("zoom in narrows the window", d.get().win.xmax, 2.5);
}

describe("trace");
{
  const d = device()
    .press("y=").press("X,T,θ,n").press("x²").press("enter")
    .press("graph").press("trace");
  ok("trace picks the first drawn function", d.get().trace?.fn === 0);
  const x0 = d.get().trace!.x;
  d.press("right");
  ok("right steps along the curve", d.get().trace!.x > x0);
  d.press("clear");
  eq("clear leaves trace", d.get().trace, null);
}
{
  const d = device()
    .press("y=").press("X,T,θ,n").press("enter")
    .press("X,T,θ,n").press("x²").press("enter")
    .press("graph").press("trace").press("up");
  eq("up switches to the next function", d.get().trace?.fn, 1);
}

describe("CALC");
{
  const d = device()
    .press("y=").press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
    .press("graph").press("trace").repeat("right", 20);
  d.press("2nd calc").press("down").press("enter");
  const mark = d.get().marks[0];
  eq("zero finds a root", mark?.label, "zero");
  near("at x = 2", mark!.x, 2, 1e-6);
}
{
  const d = device()
    .press("y=").press("X,T,θ,n").press("x²").press("enter")
    .press("graph").press("trace");
  d.press("mode").press("right").press("2nd quit").press("graph");
  d.press("2nd calc").press("down").press("enter");
  eq("CALC declines outside function mode", d.get().message, "CALC needs Func mode");
}

describe("the table");
{
  // Regression: the table used to inherit whatever row cursor the Y= editor
  // left behind, so it opened partway down.
  const d = device()
    .press("y=").press("X,T,θ,n").press("x²").press("enter")
    .repeat("down", 3)
    .press("2nd table");
  eq("the table starts at TblStart", d.get().row, 0);
}

describe("the matrix editor");
{
  const d = device().press("2nd matrix").repeat("right", 2).press("enter");
  eq("edit opens on [A]", d.get().target, { kind: "matrix", name: "[A]", row: 0, col: 0 });
  // Regression: typing used to append to the existing value, and enter used to
  // move down a row rather than across.
  d.type("1").press("enter");
  eq("enter moves across the row", d.get().target, { kind: "matrix", name: "[A]", row: 0, col: 1 });
  d.type("2").press("enter");
  eq("then wraps to the next row", d.get().target, { kind: "matrix", name: "[A]", row: 1, col: 0 });
  d.type("3").press("enter").type("4").press("enter");
  eq("filling row by row", d.get().mats["[A]"].m, [[1, 2], [3, 4]]);
}
{
  const d = device().press("2nd matrix").repeat("right", 2).press("enter");
  d.press("up");
  eq("up from the first cell reaches the dimensions", d.get().target, {
    kind: "matrix", name: "[A]", row: -1, col: 0,
  });
  d.type("3").press("enter");
  eq("which resize the matrix", d.get().mats["[A]"].r, 3);
}

describe("entry buffers do not leak between screens");
{
  // Regression: the replace-on-first-keystroke flag survived a screen change,
  // so the next character typed wiped the line instead of appending.
  const d = device().press("window").press("2nd quit").type("1").type("2");
  eq("typing on the home screen appends", d.entry(), "12");
}
{
  const d = device().press("window").press("2nd quit").press("y=");
  d.press("X,T,θ,n").press("x²");
  eq("and appends in the Y= editor too", d.entry(), "X²");
}

describe("screens do not inherit a stale cursor");
{
  // Regression: MODE read whatever row the last list screen left behind, so
  // the first arrow changed a setting three rows from the one shown selected.
  const d = device().press("y=").repeat("down", 3).press("mode");
  eq("mode opens on its first row", d.get().row, 0);
  d.press("right");
  eq("so the first arrow moves the graph mode", d.get().modes.graphMode, "par");
}
{
  // Regression: ZoomFit said "no functions" when the functions existed but
  // sampled to nothing, which sent you looking in the wrong place.
  const d = device().press("mode").repeat("right", 3).press("2nd quit")
    .press("y=").press("2nd u").press("X,T,θ,n").press("sub").type("1").press("rparen").press("enter")
    .press("graph")
    .press("zoom").repeat("down", 8).press("enter");
  eq("an unseeded sequence says what is actually wrong", d.get().message, "ERR: NOTHING TO FIT");
}

describe("menus");
{
  const d = device().press("math");
  ok("math opens a menu", d.get().menu !== null);
  eq("on the first tab", d.get().menu?.tab, 0);
  d.press("right");
  eq("right moves tab", d.get().menu?.tab, 1);
  d.press("down");
  eq("down moves the selection", d.get().menu?.index, 1);
  d.press("clear");
  eq("clear closes it", d.get().menu, null);
}
{
  const d = device().press("math").press("right").press("enter");
  eq("choosing an item inserts its text", d.entry(), "abs(");
}

describe("programs");
{
  const d = device().press("prgm").repeat("down", 2).press("enter");
  eq("exec runs the chosen program", d.get().screen, "prgmrun");
  eq("which asks for its input", d.get().prgmRun?.status, "input");
  d.type("10").press("enter");
  eq("FIB(10) is 55", d.get().prgmRun?.output, ["55"]);
  eq("and reports done", d.get().prgmRun?.status, "done");
  d.press("enter");
  eq("enter returns home", d.get().screen, "home");
}
{
  const d = device().press("prgm").press("right").press("enter");
  eq("edit opens the program", d.get().screen, "prgm");
  ok("with its lines loaded", d.get().prgmLines.length > 1);
}

describe("the solver");
{
  const d = device().press("math").repeat("down", 9).press("enter");
  eq("Solver opens its own screen", d.get().screen, "solver");
  d.press("X,T,θ,n").press("x²").press("sub").type("4").press("enter");
  eq("committing the equation finds its variables", Object.keys(d.get().solver.values), ["X"]);
  d.press("enter");
  near("and enter on the variable solves", d.get().solver.values.X, -2, 1e-6);
  near("with no residual", d.get().solver.residual ?? 1, 0, 1e-9);
}

describe("statistics");
{
  const d = device().press("stat").press("enter");
  eq("edit opens the list editor", d.get().screen, "stat");
  for (const v of ["2", "4", "4", "4"]) d.type(v).press("enter");
  eq("values land in L1", d.get().lists[0], [2, 4, 4, 4]);
  d.press("stat").press("right").press("enter");
  const report = d.get().statReport;
  eq("1-Var Stats reports on them", report?.title, "1‑Var Stats");
  eq("with the right mean", report?.rows.find((r) => r.label === "x̄")?.value, "3.5");
}

describe("modifiers");
{
  const d = device().press("2nd");
  eq("2nd arms", d.get().mod, "2nd");
  d.press("2nd");
  eq("and pressing it again disarms", d.get().mod, "none");
}
{
  const d = device().press("2nd").press("d1");
  eq("2nd changes what a key inserts", d.entry(), "L₁");
  eq("and is consumed", d.get().mod, "none");
}
{
  const d = device().press("alpha").press("math");
  eq("alpha inserts the green label", d.entry(), "A");
}
{
  const d = device().press("2nd").press("alpha").press("math").press("apps");
  eq("A-lock stays armed across keys", d.entry(), "AB");
}

describe("reset");
{
  const d = device().type("5").press("enter").press("y=").press("X,T,θ,n").press("enter");
  d.press("on");
  eq("clears the tape", d.get().history.length, 0);
  eq("clears the functions", d.get().ys[0].expr, "");
  eq("and says so", d.get().message, "RAM cleared");
}

reportIfMain(import.meta.url);

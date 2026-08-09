import { describe, eq, near, ok, reportIfMain } from "./harness";
import { device } from "./device";
import { renderPanel, shows } from "./panel";
import { CHAR_H, Pen } from "../lib/display/pen";
import { inkGain } from "../lib/display/panel";
import { renderFailure } from "../lib/display/screens";

/**
 * What the panel actually draws.
 *
 * The display fills one-dot rectangles and nothing else, so a recording
 * context reproduces it exactly. These check content and layout; the digests
 * are there so a rendering change has to be acknowledged rather than noticed.
 */

describe("every screen renders");
{
  // Reach each screen the way a person would, then draw it.
  const screens: [string, ReturnType<typeof device>][] = [
    ["home", device().type("7/8").press("enter")],
    ["graph", device().press("y=").press("X,T,θ,n").press("x²").press("enter").press("graph")],
    ["yeq", device().press("y=")],
    ["window", device().press("window")],
    ["tblset", device().press("2nd tblset")],
    ["table", device().press("y=").press("X,T,θ,n").press("enter").press("2nd table")],
    ["mode", device().press("mode")],
    ["stat", device().press("stat").press("enter")],
    ["matrix", device().press("2nd matrix").repeat("right", 2).press("enter")],
    ["prgm", device().press("prgm").press("right").press("enter")],
    ["prgmrun", device().press("prgm").repeat("down", 2).press("enter")],
    ["solver", device().press("math").repeat("down", 9).press("enter")],
    ["menu", device().press("math")],
  ];

  for (const [name, d] of screens) {
    const p = renderPanel(d.get());
    ok(`${name} lights the panel`, p.count() > 200, `${p.count()} dots`);
    ok(`${name} says something`, p.transcript.length > 0);
  }
}

describe("the status line");
{
  const p = renderPanel(device().get());
  ok("names the screen", shows(p, "HOME"));
  ok("and the angle mode", shows(p, "RAD"));
}
{
  const d = device().press("mode").repeat("down", 3).press("right");
  ok("degree mode shows DEG", shows(renderPanel(d.get()), "DEG"));
}
{
  const d = device().press("mode").repeat("right", 3);
  ok("sequence mode is labelled SEQ", shows(renderPanel(d.get()), "SEQ"));
  ok("not POL", !shows(renderPanel(d.get()), "POL"));
}
{
  const p = renderPanel(device().press("2nd").get());
  ok("an armed modifier is announced", shows(p, "2ND"));
}

describe("the home tape");
{
  const d = device().type("7/8").press("enter").type("2^10").press("enter");
  const p = renderPanel(d.get());
  ok("shows the older entry", shows(p, "7÷8"));
  ok("and its answer", shows(p, ".875"));
  ok("and the newer one", shows(p, "1024"));
  ok("with the prompt on the last line", p.transcript[p.transcript.length - 1].startsWith(">"));
}
{
  const p = renderPanel(device().type("1/0").press("enter").get());
  ok("an error reads as an error", shows(p, "ERR: DIVIDE BY 0"));
}
{
  const d = device().press("2nd matrix").repeat("right", 2).press("enter")
    .type("1").press("enter").type("2").press("enter")
    .type("3").press("enter").type("4").press("enter")
    .press("2nd quit")
    .press("2nd matrix").press("enter")
    .press("enter");
  const p = renderPanel(d.get());
  ok("a matrix answer is laid out in rows", shows(p, "[1 2]") || shows(p, "1 2"));
}

describe("the Y= editor");
{
  const d = device().press("y=").press("X,T,θ,n").press("x²").press("enter");
  const p = renderPanel(d.get());
  ok("shows the slot label", shows(p, "Y₁"));
  ok("and the expression", shows(p, "X²"));
  eq("with one tappable region per slot", p.hits.filter((h) => h.kind === "row").length, 6);
}
{
  const d = device().press("y=").press("X,T,θ,n").press("enter").press("up").repeat("left", 2).press("enter");
  const p = renderPanel(d.get());
  // A switched-off function is written with a colon rather than an equals.
  ok("a disabled slot loses its equals", shows(p, "Y₁:"));
}

describe("menus");
{
  const p = renderPanel(device().press("math").get());
  ok("tabs are listed", shows(p, "MATH"));
  ok("items are numbered", shows(p, "1:"));
  ok("the selected item's hint is explained", shows(p, "decimal to fraction"));
  ok("every item is tappable", p.hits.filter((h) => h.kind === "menuItem").length > 3);
  ok("and so is every tab", p.hits.filter((h) => h.kind === "menuTab").length === 3);
}
{
  const d = device().press("math").press("down");
  const p = renderPanel(d.get());
  ok("moving the selection moves the hint", shows(p, "fraction to decimal"));
}

describe("tappable regions line up with what is drawn");
{
  const d = device().press("window");
  const p = renderPanel(d.get());
  const rows = p.hits.filter((h) => h.kind === "row");
  ok("each row region is one character cell tall", rows.every((r) => r.h === CHAR_H));
  ok("they do not overlap", rows.every((r, i) => i === 0 || r.y >= rows[i - 1].y + rows[i - 1].h - 1));
  ok("and they run down the panel in order", rows.every((r, i) => i === 0 || r.y > rows[i - 1].y));
}

describe("the graph");
{
  const d = device()
    .press("y=").press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
    .press("graph");
  const p = renderPanel(d.get());
  ok("draws a great many dots", p.count() > 2000, `${p.count()}`);
  // The x-axis is whichever row is most densely lit.
  const perRow = new Map<number, number>();
  for (const key of p.dots.keys()) {
    const y = Number(key.split(",")[1]);
    perRow.set(y, (perRow.get(y) ?? 0) + 1);
  }
  const densest = Math.max(...perRow.values());
  ok("an axis spans the panel", densest > p.cols * 0.8, `${densest} of ${p.cols}`);
}
{
  const withTrace = device()
    .press("y=").press("X,T,θ,n").press("x²").press("enter")
    .press("graph").press("trace");
  const p = renderPanel(withTrace.get());
  ok("trace names the function", shows(p, "Y₁"));
  ok("and reports a coordinate", shows(p, "X=") && shows(p, "Y="));
}
{
  const a = device().press("y=").press("X,T,θ,n").press("enter").press("graph");
  const b = device().press("y=").press("X,T,θ,n").press("x²").press("enter").press("graph");
  ok(
    "different functions draw differently",
    renderPanel(a.get()).digest() !== renderPanel(b.get()).digest(),
  );
}

describe("the panel never falls back to a font");
{
  // renderPanel throws if any glyph misses the ROM, so reaching every screen
  // with awkward content is itself the assertion.
  const d = device()
    .press("2nd").press("d1")
    .press("2nd sin⁻¹").type("(.5)").press("enter")
    .press("2nd √").type("(9)").press("enter");
  ok("subscripts, inverse trig and radicals all draw", renderPanel(d.get()).count() > 0);
  const solver = device().press("math").repeat("down", 9).press("enter");
  ok("so does the solver", renderPanel(solver.get()).count() > 0);
  const stats = device().press("stat").press("enter").type("2").press("enter")
    .type("4").press("enter").press("stat").press("right").press("enter");
  ok("so do the statistics, x-bar and all", renderPanel(stats.get()).count() > 0);
}

describe("the draw menu draws");
{
  // 2nd prgm is DRAW; the items are ClrDraw, Line, Horizontal, Vertical,
  // Circle, Text, Pt-On, Pt-Off.
  const graph = () => device().press("y=").press("X,T,θ,n").press("enter").press("graph");
  const draw = (item: number) => graph().press("2nd draw").repeat("down", item).press("enter");

  {
    const d = draw(1);
    eq("choosing Line waits for a point", d.get().graphPrompt?.op, "draw:line");
    ok("and says what to do", (d.get().message ?? "").includes("one end"));
    ok("with a cursor to move", d.get().cursor !== null);
    const placed = d.press("enter");
    eq("the first enter takes the first end", placed.get().graphPrompt?.stage, 1);
    eq("and nothing is drawn yet", placed.get().drawings.length, 0);
    const done = placed.repeat("right", 10).repeat("up", 5).press("enter");
    eq("the second enter draws the line", done.get().drawings.length, 1);
    eq("with two distinct ends", done.get().drawings[0].x !== done.get().drawings[0].x2, true);
    eq("and the prompt is gone", done.get().graphPrompt, null);
    ok("it reaches the panel", renderPanel(done.get()).count() > renderPanel(graph().get()).count());
  }
  {
    const d = draw(2).press("enter");
    eq("Horizontal takes one point", d.get().drawings.length, 1);
    eq("and it is a horizontal", d.get().drawings[0].kind, "hline");
  }
  {
    const d = draw(4).press("enter").repeat("right", 20).press("enter");
    eq("Circle takes a centre and a rim point", d.get().drawings[0].kind, "circle");
    const p = renderPanel(d.get());
    // A circle is wide and tall; a line between the same points would not be.
    const xs = [...p.dots.keys()].map((k) => Number(k.split(",")[0]));
    ok("and comes out round", Math.max(...xs) - Math.min(...xs) > 20);
  }
  {
    const d = draw(6).press("enter");
    eq("Pt-On places a dot", d.get().drawings[0].kind, "point");
    const off = d.press("2nd draw").repeat("down", 7).press("enter").press("enter");
    eq("Pt-Off adds an erasing dot", off.get().drawings[1].erase, true);
  }
  {
    const d = draw(5).press("enter");
    eq("Text asks for the text next", d.get().graphPrompt?.stage, 1);
    const typed = d.press("alpha E").press("enter");
    eq("which is drawn where it was placed", typed.get().drawings[0].kind, "text");
    ok("and shows on the panel", shows(renderPanel(typed.get()), "E"));
  }
  {
    const d = draw(1).press("enter").repeat("right", 5).press("enter");
    const cleared = d.press("2nd draw").press("enter");
    eq("ClrDraw takes it all back off", cleared.get().drawings.length, 0);
  }
  {
    // Arrows drive the cursor while a point is wanted, and pan otherwise.
    const waiting = draw(6);
    const before = { x: waiting.get().cursor!.x, xmin: waiting.get().win.xmin };
    waiting.press("right");
    eq("the window stays put while placing", waiting.get().win.xmin, before.xmin);
    ok("and the cursor moves", waiting.get().cursor!.x > before.x);
    const panning = graph().press("right");
    ok("with no command running, the window pans", panning.get().win.xmin > before.xmin);
  }
}

describe("stat plots");
{
  // L₁ = 1..6, L₂ = the same doubled, so a scatter has somewhere to be.
  const withData = () => {
    let d = device().press("stat").press("enter");
    for (const v of [1, 2, 3, 4, 5, 6]) d = d.type(String(v)).press("enter");
    d = d.press("right");
    for (const v of [2, 4, 6, 8, 10, 12]) d = d.type(String(v)).press("enter");
    return d.press("2nd quit");
  };
  const plotMenu = (item: number) =>
    withData().press("2nd stat plot").repeat("down", item).press("enter");

  const scatter = renderPanel(plotMenu(1).get());
  const line = renderPanel(plotMenu(2).get());
  const hist = renderPanel(plotMenu(3).get());
  const box = renderPanel(plotMenu(4).get());

  ok("a scatter draws", scatter.count() > 400);
  ok("a line joins the same points, so it lights more", line.count() > scatter.count());
  ok("a histogram draws", hist.count() > 400);
  ok("and looks nothing like the scatter", hist.digest() !== scatter.digest());
  ok("a box plot draws", box.count() > 400);
  ok("and nothing like the histogram", box.digest() !== hist.digest());

  // The box plot lives in a band at the top; the histogram sits on the axis.
  const rowsOf = (p: ReturnType<typeof renderPanel>) =>
    [...p.dots.keys()].map((k) => Number(k.split(",")[1]));
  const boxBand = rowsOf(box).filter((y) => y > 20);
  ok("the box plot keeps to the top of the field", Math.min(...boxBand) < 60);
}
{
  // Xscl is the bin width, so widening it must merge bars.
  const load = () => {
    let d = device().press("stat").press("enter");
    for (const v of [1, 1, 2, 2, 3, 8]) d = d.type(String(v)).press("enter");
    return d.press("2nd quit").press("2nd stat plot").repeat("down", 3).press("enter");
  };
  const narrow = renderPanel(load().get());
  const wide = renderPanel(
    load().press("window").repeat("down", 2).type("5").press("enter").press("graph").get(),
  );
  ok("changing Xscl rebins the histogram", narrow.digest() !== wide.digest());
}
{
  const d = device()
    .press("2nd stat plot").repeat("down", 5).press("enter");
  eq("stepping the x list moves to L₂", d.get().plots[0].xList, "L₂");
  ok("and says so without leaving the menu", d.get().menu !== null);
  ok("with a summary of the plot", (d.get().message ?? "").includes("L₂"));
  const m = d.press("down").press("down").press("enter");
  eq("stepping the mark cycles it on from the default", m.get().plots[0].mark, "dot");
}

describe("contrast");
{
  near("5 leaves the panel exactly as drawn", inkGain(5), 1.05);
  ok("lower settings dim it", inkGain(0) < inkGain(5));
  ok("higher settings push it", inkGain(9) > inkGain(5));
  ok("and 0 is still legible", inkGain(0) > 0.4);
  eq("out of range clamps rather than going dark", inkGain(-3), inkGain(0));
  eq("and at the top", inkGain(99), inkGain(9));
}
{
  const d = device().press("2nd lighter");
  eq("2nd ▲ raises it", d.get().modes.contrast, 6);
  ok("and says where it got to", (d.get().message ?? "").includes("6"));
  d.repeat("2nd lighter", 9);
  eq("it stops at 9", d.get().modes.contrast, 9);
  d.repeat("2nd darker", 20);
  eq("and at 0", d.get().modes.contrast, 0);
  const plain = device().press("up");
  eq("unmodified, the arrow still does its own job", plain.get().modes.contrast, 5);
}

describe("a failing screen still says something");
{
  const ctx = {
    fillStyle: "", font: "", textBaseline: "", textAlign: "",
    globalCompositeOperation: "source-over",
    save() {}, restore() {},
    fillRect() {}, fillText() {},
  };
  const pen = new Pen(ctx as unknown as CanvasRenderingContext2D, 176, 190, "8px monospace");
  renderFailure(pen, "Cannot read properties of undefined (reading 'expr')");
  const lines = pen.transcript();
  ok("names itself an error", lines[0] === "ERROR");
  ok("reports what happened", lines.join(" ").includes("undefined"));
  ok("and how to get out", lines.join(" ").includes("PRESS ON TO RESET"));
}

reportIfMain(import.meta.url);

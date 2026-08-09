import { describe, eq, ok, reportIfMain } from "./harness";
import { device } from "./device";
import { renderPanel, shows } from "./panel";
import { CHAR_H } from "../lib/display/pen";

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

reportIfMain(import.meta.url);

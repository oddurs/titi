import { device, type Device } from "./device";

/**
 * A named device state per screen, reached the way a person would reach it.
 *
 * These are the subjects of the golden panels. Keep them deterministic — no
 * randomness, no clock — because a golden that drifts on its own teaches
 * everyone to ignore it.
 */
/** L₁ filled by hand, the way a person would, then back to the home screen. */
function withList(values: number[]): Device {
  let d = device().press("stat").press("enter");
  for (const v of values) d = d.type(String(v)).press("enter");
  return d.press("2nd quit");
}

export const FIXTURES: Record<string, () => Device> = {
  "home-empty": () => device(),

  "home-tape": () =>
    device().type("7/8").press("enter").type("2^10").press("enter"),

  "home-error": () => device().type("1/0").press("enter"),

  "home-complex": () =>
    device()
      .press("mode").repeat("down", 4).press("right").press("2nd quit")
      .press("2nd √").press("(−)").type("9").press("rparen").press("enter"),

  "home-matrix-answer": () =>
    device()
      .press("2nd matrix").repeat("right", 2).press("enter")
      .type("1").press("enter").type("2").press("enter")
      .type("3").press("enter").type("4").press("enter")
      .press("2nd quit")
      .press("2nd matrix").press("enter").press("2nd matrix").press("enter")
      .press("enter"),

  "yeq-empty": () => device().press("y="),

  "yeq-filled": () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
      .press("sin").press("X,T,θ,n").press("enter"),

  "yeq-disabled": () =>
    device()
      .press("y=").press("X,T,θ,n").press("enter")
      .press("up").repeat("left", 2).press("enter"),

  "window-func": () => device().press("window"),

  "window-seq": () =>
    device().press("mode").repeat("right", 3).press("2nd quit").press("window"),

  tblset: () => device().press("2nd tblset"),

  "table-ask": () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("enter")
      .press("2nd tblset").repeat("down", 2).press("right")
      .press("2nd table")
      .type("3").press("enter").type("5").press("enter").type("8").press("enter"),

  table: () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("enter")
      .press("sin").press("X,T,θ,n").press("enter")
      .press("2nd table"),

  mode: () => device().press("mode"),

  "graph-func": () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
      .press("sin").press("X,T,θ,n").press("enter")
      .press("graph"),

  "graph-trace": () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("enter")
      .press("graph").press("trace").repeat("right", 8),

  "graph-zero": () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
      .press("graph").press("trace").repeat("right", 20)
      .press("2nd calc").press("down").press("enter"),

  "graph-polar": () =>
    device()
      .press("mode").repeat("right", 2).press("2nd quit")
      .press("y=").type("4").press("sin").type("3").press("X,T,θ,n").press("rparen").press("enter")
      .press("graph"),

  "graph-parametric": () =>
    device()
      .press("mode").press("right").press("2nd quit")
      .press("y=").press("sin").type("3").press("X,T,θ,n").press("rparen").press("enter")
      .press("cos").type("2").press("X,T,θ,n").press("rparen").press("enter")
      .press("graph"),

  "graph-sequence": () =>
    device()
      .press("mode").repeat("right", 3).press("2nd quit")
      .press("y=")
      .type("1.5*").press("2nd u").press("X,T,θ,n").press("sub").type("1").press("rparen")
      .press("enter").repeat("down", 2).type("1").press("enter")
      .press("graph"),

  "graph-drawn": () =>
    device()
      .press("y=").press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
      .press("graph")
      .press("2nd draw").repeat("down", 4).press("enter")
      .press("enter").repeat("right", 15).press("enter")
      .press("2nd draw").repeat("down", 2).press("enter")
      .repeat("up", 12).press("enter"),

  "graph-drawing-prompt": () =>
    device()
      .press("y=").press("X,T,θ,n").press("enter").press("graph")
      .press("2nd draw").press("down").press("enter"),

  "stat-lists": () =>
    device()
      .press("stat").press("enter")
      .type("2").press("enter").type("4").press("enter").type("6").press("enter"),

  "stat-report": () =>
    device()
      .press("stat").press("enter")
      .type("2").press("enter").type("4").press("enter").type("6").press("enter")
      .press("stat").press("right").choose("1‑Var Stats"),

  "graph-histogram": () =>
    withList([1, 1, 2, 2, 2, 3, 5, 8])
      .press("2nd stat plot").choose("Histogram"),

  "graph-boxplot": () =>
    withList([1, 2, 3, 4, 5, 6, 7, 12])
      .press("2nd stat plot").choose("Boxplot"),

  "graph-modbox": () =>
    withList([1, 2, 3, 4, 5, 6, 7, 22])
      .press("2nd stat plot").choose("ModBoxplot"),

  "graph-weighted-hist": () =>
    device().press("stat").press("enter")
      .type("1").press("enter").type("2").press("enter").type("3").press("enter")
      .press("right")
      .type("1").press("enter").type("4").press("enter").type("2").press("enter")
      .press("2nd quit")
      .press("2nd stat plot").choose("Histogram")
      .press("2nd stat plot").choose("Freq ▸").choose("Freq ▸").press("graph"),

  "stat-report-weighted": () =>
    device().press("stat").press("enter")
      .type("2").press("enter").type("5").press("enter").type("9").press("enter")
      .press("right")
      .type("3").press("enter").type("1").press("enter").type("2").press("enter")
      .press("2nd quit")
      .press("stat").press("right").choose("Freq ▸").press("2nd quit")
      .press("stat").press("right").choose("1‑Var Stats"),

  // Nine points on y = 2x+1 with the last thrown far off: enough for three
  // groups of three, which is where the resistant line earns its name.
  "stat-medmed": () => {
    let d = device().press("stat").press("enter");
    for (const x of [1, 2, 3, 4, 5, 6, 7, 8, 9]) d = d.type(String(x)).press("enter");
    d = d.press("right");
    for (const y of [3, 5, 7, 9, 11, 13, 15, 17, 200]) d = d.type(String(y)).press("enter");
    return d.press("2nd quit").press("stat").press("right").choose("Med‑Med");
  },

  "graph-scatter": () =>
    withList([1, 2, 3, 4]).press("stat").press("enter").press("right")
      .type("2").press("enter").type("5").press("enter")
      .type("7").press("enter").type("11").press("enter")
      .press("2nd quit").press("2nd stat plot").choose("Scatter"),

  "matrix-editor": () =>
    device().press("2nd matrix").repeat("right", 2).press("enter"),

  "prgm-editor": () => device().press("prgm").press("right").press("enter"),

  "prgm-running": () => device().press("prgm").repeat("down", 2).press("enter"),

  "prgm-done": () =>
    device().press("prgm").repeat("down", 2).press("enter").type("10").press("enter"),

  "prgm-menu": () => device().press("prgm").repeat("down", 3).press("enter"),

  "prgm-drawn": () =>
    device().press("prgm").repeat("down", 3).press("enter").press("enter").press("graph"),

  "prgm-waiting-for-a-key": () => device().press("prgm").choose("KEYPAD"),

  "prgm-output-placed": () =>
    device().press("prgm").choose("KEYPAD").press("7"),

  solver: () =>
    device()
      .press("math").repeat("down", 9).press("enter")
      .press("X,T,θ,n").press("x²").press("sub").type("4").press("enter")
      .press("enter"),

  "menu-math": () => device().press("math"),
  "menu-zoom": () => device().press("zoom"),
  "menu-matrix": () => device().press("2nd matrix"),
  "menu-prgm": () => device().press("prgm"),

  "modifier-2nd": () => device().press("2nd"),
  "modifier-alpha": () => device().press("alpha"),
};

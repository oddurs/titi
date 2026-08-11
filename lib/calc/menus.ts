import { FUNCTIONS } from "../math/lexer";
import { MODE_COMMAND_NAMES } from "./instructions";
import type { MenuItem, MenuTab } from "./types";

const ins = (label: string, insert: string, hint?: string) => ({ label, insert, hint });
const act = (label: string, action: string, hint?: string) => ({ label, action, hint });

/**
 * Everything the engine can be asked for, in one alphabetical list.
 *
 * Built from the lexer's own tables rather than typed out again, so a function
 * added to the engine appears here without anyone remembering to add it. The
 * device sorts symbols before letters and ignores case, and so does this.
 */
function catalogItems(): MenuItem[] {
  const hints: Record<string, string> = {
    "ΔList(": "differences between neighbours",
    "cumSum(": "running totals",
    "fnInt(": "definite integral",
    "nDeriv(": "numeric derivative",
    "solve(": "root near a guess",
    "randInt(": "lower, upper, n",
    "seq(": "expr, var, from, to, step",
    "rref(": "reduced row echelon",
  };
  // The mode instructions are commands too, and the device lists them here.
  const extras = ["π", "ℯ", "Ans", "rand", "θ", "∞", ...MODE_COMMAND_NAMES];
  const key = (label: string) => {
    const first = label[0];
    const isLetter = /[A-Za-z]/.test(first);
    // Symbols sort ahead of every letter, as on the device.
    return `${isLetter ? "1" : "0"}${label.toLowerCase()}`;
  };
  return [...FUNCTIONS, ...extras]
    .filter((label, i, all) => all.indexOf(label) === i)
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .map((label) => ({ label, insert: label, hint: hints[label] }));
}

export const MENUS: Record<string, { title: string; tabs: MenuTab[] }> = {
  math: {
    title: "math",
    tabs: [
      {
        name: "math",
        items: [
          act("▸Frac", "toFrac", "decimal to fraction"),
          act("▸Dec", "toDec", "fraction to decimal"),
          ins("x³", "³", "cube"),
          ins("∛(", "∛(", "cube root"),
          ins("ˣ√(", "ˣ√(", "nth root"),
          ins("fMin(", "fMin(", "expr, var, lower, upper"),
          ins("fMax(", "fMax(", "expr, var, lower, upper"),
          ins("nDeriv(", "nDeriv(", "numeric derivative"),
          ins("fnInt(", "fnInt(", "definite integral"),
          ins("solve(", "solve(", "root near a guess"),
          act("Solver...", "screen:solver", "solve an equation for any variable"),
        ],
      },
      {
        name: "num",
        items: [
          ins("abs(", "abs(", "absolute value"),
          ins("round(", "round(", "round to n places"),
          ins("iPart(", "iPart(", "integer part"),
          ins("fPart(", "fPart(", "fractional part"),
          ins("int(", "int(", "greatest integer"),
          ins("min(", "min("),
          ins("max(", "max("),
          ins("lcm(", "lcm("),
          ins("gcd(", "gcd("),
          ins("remainder(", "remainder(", "sign of the divisor"),
        ],
      },
      {
        name: "cpx",
        items: [
          ins("conj(", "conj(", "a-bi"),
          ins("real(", "real(", "the real part"),
          ins("imag(", "imag(", "the imaginary part"),
          ins("angle(", "angle(", "the argument"),
          ins("abs(", "abs(", "the modulus"),
          ins("i", "i", "√(-1)"),
        ],
      },
      {
        name: "prb",
        items: [
          ins("rand", "rand", "uniform 0–1"),
          ins("nPr", " nPr ", "permutations, written between"),
          ins("nCr", " nCr ", "combinations, written between"),
          ins("!", "!", "factorial"),
          ins("randInt(", "randInt(", "lower, upper, n"),
          ins("randNorm(", "randNorm(", "μ, σ, n"),
          ins("randBin(", "randBin(", "trials, p, simulations"),
          ins("randIntNoRep(", "randIntNoRep(", "a shuffled range"),
        ],
      },
    ],
  },

  test: {
    title: "test",
    tabs: [
      {
        name: "test",
        items: [
          ins("=", "="), ins("≠", "≠"), ins(">", ">"),
          ins("≥", "≥"), ins("<", "<"), ins("≤", "≤"),
        ],
      },
      {
        name: "logic",
        items: [
          ins("and", " and ", "both non-zero"),
          ins("or", " or ", "either non-zero"),
          ins("xor", " xor ", "one but not both"),
          ins("not(", "not(", "zero becomes one"),
        ],
      },
    ],
  },

  angle: {
    title: "angle",
    tabs: [
      {
        name: "angle",
        items: [
          ins("°", "°", "degrees, whatever the mode"),
          ins("′", "′", "minutes"),
          ins("″", "″", "seconds"),
          ins("ʳ", "ʳ", "radians, whatever the mode"),
          act("▸DMS", "toDMS", "show the answer as degrees, minutes, seconds"),
          ins("R▸Pr(", "R▸Pr(", "x, y to radius"),
          ins("R▸Pθ(", "R▸Pθ(", "x, y to angle"),
          ins("P▸Rx(", "P▸Rx(", "r, θ to x"),
          ins("P▸Ry(", "P▸Ry(", "r, θ to y"),
          act("Radian", "angle:rad", "set angle mode"),
          act("Degree", "angle:deg", "set angle mode"),
        ],
      },
    ],
  },

  zoom: {
    title: "zoom",
    tabs: [
      {
        name: "zoom",
        items: [
          act("ZBox", "zoom:box", "drag a box on the graph"),
          act("Zoom In", "zoom:in", "×0.25 about centre"),
          act("Zoom Out", "zoom:out", "×4 about centre"),
          act("ZDecimal", "zoom:decimal", "Δx = .1"),
          act("ZSquare", "zoom:square", "equal pixel scale"),
          act("ZStandard", "zoom:standard", "−10 … 10"),
          act("ZTrig", "zoom:trig", "π-scaled axes"),
          act("ZInteger", "zoom:integer", "Δx = 1"),
          act("ZoomFit", "zoom:fit", "fit y to the window"),
          act("ZoomSto", "zoom:sto", "put this window aside"),
          act("ZoomRcl", "zoom:rcl", "bring it back"),
        ],
      },
    ],
  },

  calc: {
    title: "calculate",
    tabs: [
      {
        name: "calc",
        items: [
          act("value", "calc:value", "evaluate at x"),
          act("zero", "calc:zero", "root nearest the cursor"),
          act("minimum", "calc:min"),
          act("maximum", "calc:max"),
          act("intersect", "calc:intersect", "between two functions"),
          act("dy/dx", "calc:deriv", "slope at x"),
          act("∫f(x)dx", "calc:integral", "area over an interval"),
        ],
      },
    ],
  },

  vars: {
    title: "vars",
    tabs: [
      {
        name: "y‑vars",
        items: [
          ins("Y₁", "Y₁"), ins("Y₂", "Y₂"), ins("Y₃", "Y₃"),
          ins("Y₄", "Y₄"), ins("Y₅", "Y₅"), ins("Y₆", "Y₆"),
        ],
      },
      {
        name: "window",
        items: [
          act("Xmin", "var:xmin"), act("Xmax", "var:xmax"), act("Xscl", "var:xscl"),
          act("Ymin", "var:ymin"), act("Ymax", "var:ymax"), act("Yscl", "var:yscl"),
        ],
      },
      {
        name: "lists",
        items: [
          ins("L₁", "L₁"), ins("L₂", "L₂"), ins("L₃", "L₃"),
          ins("L₄", "L₄"), ins("L₅", "L₅"), ins("L₆", "L₆"),
        ],
      },
    ],
  },

  distr: {
    title: "distr",
    tabs: [
      {
        name: "distr",
        items: [
          ins("normalpdf(", "normalpdf(", "x, μ, σ"),
          ins("normalcdf(", "normalcdf(", "lower, upper, μ, σ"),
          ins("invNorm(", "invNorm(", "area, μ, σ"),
          ins("invT(", "invT(", "area, df"),
          ins("tpdf(", "tpdf(", "x, df"),
          ins("tcdf(", "tcdf(", "lower, upper, df"),
          ins("χ²pdf(", "χ²pdf(", "x, df"),
          ins("χ²cdf(", "χ²cdf(", "lower, upper, df"),
          ins("Fpdf(", "Fpdf(", "x, df₁, df₂"),
          ins("Fcdf(", "Fcdf(", "lower, upper, df₁, df₂"),
          ins("binompdf(", "binompdf(", "n, p, k"),
          ins("binomcdf(", "binomcdf(", "n, p, k"),
          ins("poissonpdf(", "poissonpdf(", "μ, k"),
          ins("poissoncdf(", "poissoncdf(", "μ, k"),
          ins("geometpdf(", "geometpdf(", "p, k"),
          ins("geometcdf(", "geometcdf(", "p, k"),
        ],
      },
    ],
  },

  stat: {
    title: "stat",
    tabs: [
      {
        name: "edit",
        items: [
          act("Edit…", "screen:stat", "type values into L₁–L₆"),
          act("ClrList", "stat:clear", "empty every list"),
          act("SortA(", "stat:sortA", "sort L₁ ascending"),
        ],
      },
      {
        name: "calc",
        items: [
          act("1‑Var Stats", "stat:1var", "on L₁"),
          act("2‑Var Stats", "stat:2var", "on L₁, L₂"),
          act("LinReg(ax+b)", "stat:linreg", "fit and store to Y₁"),
          act("QuadReg", "stat:quadreg", "y = ax² + bx + c"),
          act("ExpReg", "stat:expreg", "y = ab^x"),
          act("LnReg", "stat:lnreg", "y = a + b ln x"),
          act("PwrReg", "stat:pwrreg", "y = ax^b"),
          act("CubicReg", "stat:cubicreg", "y = ax³ + bx² + cx + d"),
          act("QuartReg", "stat:quartreg", "y = ax⁴ + … + e"),
          act("Med‑Med", "stat:medmed", "a line the outliers cannot drag"),
          act("Logistic", "stat:logisticreg", "y = c/(1+ae^(-bx))"),
          act("SinReg", "stat:sinreg", "y = a sin(bx+c)+d"),
          act("Freq ▸", "freq", "step the list that weights L₁"),
        ],
      },
    ],
  },

  list: {
    title: "list",
    // NAMES, OPS and MATH, the way the device splits them: what a list is
    // called, what rearranges one, and what reduces one to a number.
    tabs: [
      {
        name: "names",
        items: [
          ins("L₁", "L₁"), ins("L₂", "L₂"), ins("L₃", "L₃"),
          ins("L₄", "L₄"), ins("L₅", "L₅"), ins("L₆", "L₆"),
        ],
      },
      {
        name: "ops",
        items: [
          ins("SortA(", "SortA(", "sort a list in place, ascending"),
          ins("SortD(", "SortD(", "the same, descending"),
          ins("dim(", "dim(", "how many entries"),
          ins("Fill(", "Fill(", "value, list"),
          ins("seq(", "seq(", "expr, var, from, to, step"),
          ins("cumSum(", "cumSum(", "running totals"),
          ins("ΔList(", "ΔList(", "differences between neighbours"),
          ins("augment(", "augment(", "one list after another"),
          ins("List▸matr(", "List▸matr(", "lists to columns"),
          ins("Matr▸list(", "Matr▸list(", "matrix, column"),
        ],
      },
      {
        name: "math",
        items: [
          ins("min(", "min("),
          ins("max(", "max("),
          ins("mean(", "mean("),
          ins("median(", "median("),
          ins("sum(", "sum(", "optionally over a slice"),
          ins("prod(", "prod("),
          ins("stdDev(", "stdDev("),
          ins("variance(", "variance("),
        ],
      },
    ],
  },

  statplot: {
    title: "stat plots",
    // One tab per plot, because every setting on the device's plot editor
    // belongs to a particular plot — there is no global "the plot".
    tabs: [0, 1, 2].map((i) => ({
      name: `plot${i + 1}`,
      items: [
        act("On/Off", `plot:toggle:${i}`, "draw this plot with the graph"),
        act("Scatter", `plot:type:${i}:scatter`, "x list against y list"),
        act("xyLine", `plot:type:${i}:line`, "the same, joined in order"),
        act("Histogram", `plot:type:${i}:hist`, "x list, binned by Xscl"),
        act("Boxplot", `plot:type:${i}:box`, "x list, five-number summary"),
        act("ModBoxplot", `plot:type:${i}:modbox`, "the same, with the outliers shown"),
        act("Xlist ▸", `plot:xlist:${i}`, "step to the next list"),
        act("Ylist ▸", `plot:ylist:${i}`, "step to the next list"),
        act("Mark ▸", `plot:mark:${i}`, "box, cross or dot"),
        act("Freq ▸", `plot:freq:${i}`, "step the list that weights this one"),
        act("PlotsOff", "plot:off", "switch all three off"),
      ],
    })),
  },

  draw: {
    title: "draw",
    tabs: [
      {
        name: "draw",
        items: [
          act("ClrDraw", "draw:clear", "take everything drawn back off"),
          act("Line(", "draw:line", "between two points"),
          act("Horizontal", "draw:horizontal", "all the way across"),
          act("Vertical", "draw:vertical", "all the way down"),
          act("Circle(", "draw:circle", "centre, then a point on the rim"),
          act("Text(", "draw:text", "a label where you put it"),
          act("Pt‑On(", "draw:pton", "one dot"),
          act("Pt‑Off(", "draw:ptoff", "take one dot away"),
          act("DrawF", "draw:func", "a curve without a Y slot"),
          act("DrawInv", "draw:inv", "the same curve reflected in y = x"),
          act("Shade(", "draw:shade", "hatch between two expressions"),
        ],
      },
      {
        name: "on graph",
        items: [
          act("Tangent(", "calc:deriv", "the slope where you are"),
          act("Shade ∫", "calc:integral", "the area between two limits"),
        ],
      },
    ],
  },

  apps: {
    title: "apps",
    // Nothing is installed, and nothing is meant to be — offering a choice
    // that does nothing is worse than saying so.
    tabs: [
      {
        name: "apps",
        items: [
          {
            label: "No apps installed",
            action: "noop",
            hint: "this device ships without them",
            disabled: true,
          },
        ],
      },
    ],
  },

  prgm: {
    // Only reached when there are none; the real tabs are built from state.
    title: "prgm",
    tabs: [{
      name: "exec",
      items: [{
        label: "No programs",
        action: "noop",
        hint: "create one under NEW",
        disabled: true,
      }],
    }],
  },

  /** The MATH tab of the MATRIX menu; NAMES and EDIT are built from state. */
  matrixmath: {
    title: "matrix math",
    tabs: [
      {
        name: "math",
        items: [
          ins("det(", "det(", "determinant"),
          ins("ᵀ", "ᵀ", "transpose"),
          ins("dim(", "dim(", "rows and columns"),
          ins("Fill(", "Fill(", "value, matrix"),
          ins("identity(", "identity(", "n × n"),
          ins("randM(", "randM(", "rows, columns"),
          ins("augment(", "augment(", "side by side"),
          ins("Matr▸list(", "Matr▸list(", "matrix, column"),
          ins("List▸matr(", "List▸matr(", "lists to columns"),
          ins("rref(", "rref(", "reduced row echelon"),
          ins("ref(", "ref(", "row echelon"),
        ],
      },
    ],
  },

  mem: {
    title: "memory",
    tabs: [
      {
        name: "mem",
        items: [
          act("Mem Mgmt", "mem", "see what is stored, and delete it"),
          act("ClrAllLists", "stat:clear"),
          act("ClrHome", "home:clear"),
          act("Reset RAM", "reset"),
        ],
      },
    ],
  },

  catalog: {
    title: "catalog",
    tabs: [{ name: "a–z", items: catalogItems() }],
  },
};

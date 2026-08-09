import type { MenuTab } from "./types";

const ins = (label: string, insert: string, hint?: string) => ({ label, insert, hint });
const act = (label: string, action: string, hint?: string) => ({ label, action, hint });

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
          ins("fMin(", "solve(", "minimum"),
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
        ],
      },
      {
        name: "prb",
        items: [
          ins("rand", "rand", "uniform 0–1"),
          ins("n!", "!", "factorial"),
          ins("randInt(", "randInt(", "lower, upper, n"),
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
    ],
  },

  angle: {
    title: "angle",
    tabs: [
      {
        name: "angle",
        items: [
          act("Radian", "angle:rad", "set angle mode"),
          act("Degree", "angle:deg", "set angle mode"),
          ins("π", "π"),
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
          ins("binompdf(", "binompdf(", "n, p, k"),
          ins("binomcdf(", "binomcdf(", "n, p, k"),
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
        ],
      },
    ],
  },

  list: {
    title: "list",
    tabs: [
      {
        name: "ops",
        items: [
          ins("seq(", "seq(", "expr, var, from, to, step"),
          ins("sum(", "sum("),
          ins("mean(", "mean("),
          ins("median(", "median("),
          ins("stdDev(", "stdDev("),
          ins("variance(", "variance("),
        ],
      },
      {
        name: "names",
        items: [
          ins("L₁", "L₁"), ins("L₂", "L₂"), ins("L₃", "L₃"),
          ins("L₄", "L₄"), ins("L₅", "L₅"), ins("L₆", "L₆"),
        ],
      },
    ],
  },

  statplot: {
    title: "stat plots",
    tabs: [
      {
        name: "plots",
        items: [
          act("Plot1 on/off", "plot:toggle:0", "scatter of L₁ vs L₂"),
          act("Plot1 scatter", "plot:type:scatter"),
          act("Plot1 xyLine", "plot:type:line"),
          act("PlotsOff", "plot:off"),
        ],
      },
    ],
  },

  draw: {
    title: "draw",
    tabs: [
      {
        name: "draw",
        items: [
          act("ClrDraw", "draw:clear", "remove calc marks"),
          act("Tangent", "calc:deriv", "draw tangent at cursor"),
          act("Shade ∫", "calc:integral"),
        ],
      },
    ],
  },

  apps: {
    title: "apps",
    tabs: [
      {
        name: "apps",
        items: [
          act("Finance", "app:finance", "time value of money"),
          act("Inequalz", "app:none", "not installed", ),
        ],
      },
    ],
  },

  prgm: {
    title: "prgm",
    tabs: [{ name: "exec", items: [act("No programs", "app:none", "")] }],
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
          act("ClrAllLists", "stat:clear"),
          act("ClrHome", "home:clear"),
          act("Reset RAM", "reset"),
        ],
      },
    ],
  },

  catalog: {
    title: "catalog",
    tabs: [
      {
        name: "a–z",
        items: [
          ins("abs(", "abs("), ins("binomcdf(", "binomcdf("),
          ins("binompdf(", "binompdf("), ins("cos(", "cos("),
          ins("fnInt(", "fnInt("), ins("gcd(", "gcd("),
          ins("invNorm(", "invNorm("), ins("lcm(", "lcm("),
          ins("ln(", "ln("), ins("log(", "log("),
          ins("max(", "max("), ins("mean(", "mean("),
          ins("median(", "median("), ins("min(", "min("),
          ins("nDeriv(", "nDeriv("), ins("normalcdf(", "normalcdf("),
          ins("normalpdf(", "normalpdf("), ins("randInt(", "randInt("),
          ins("round(", "round("), ins("seq(", "seq("),
          ins("sin(", "sin("), ins("solve(", "solve("),
          ins("stdDev(", "stdDev("), ins("sum(", "sum("),
          ins("tan(", "tan("), ins("variance(", "variance("),
        ],
      },
    ],
  },
};

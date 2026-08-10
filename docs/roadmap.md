# What is left, and in what order

`docs/conformance.md` says what the device is supposed to do and how far along
each part is. This says when we intend to do the rest.

Every row here names a row there, verbatim. `scripts/roadmap.test.ts` checks
both directions: nothing is scheduled that the spec does not list as `todo` or
`partial`, and — the part that matters — **every `todo` in the spec appears in
exactly one sprint**. A feature cannot quietly fall off the end.

Sizes are rough and mean what they usually mean: `S` is an afternoon, `M` is a
day with tests, `L` needs a design decision first.

---

## Shipped

| Sprint | What it was | Landed |
| --- | --- | --- |
| 1 | Testing the untested half — a headless device and a recording panel | `81 new assertions` |
| 2 | Regression safety — versioned storage, golden panels, a survivable bad frame, a font diet | `9cdf968` |
| 3 | Finishing the TI-84 surface — DMS, complex inverse trig, histograms and box plots, a DRAW menu that draws, SinReg and Logistic | `1b50953` |
| 4 | The long tail — LIST OPS, a generated catalog, contrast, the keypad as one tab stop | `ac610ce` |
| 5 | The things that were stored and ignored — `Indpnt: Ask`, programs that ask and draw, offline and installable | `bfc35e8` |
| — | The spec itself, and a test that keeps it honest | `bc417cb` |
| 6 | The rest of the statistics — frequency lists, Med-Med, CubicReg and QuartReg, modified box plots | pending |

---

## Sprint 7 — Distributions and probability

**Why now.** `DISTR` has the normal and the binomial and stops, which covers
about half of what the menu is reached for. The infrastructure is already
there — `stdNormalCdf` is West's algorithm and the Lanczos gamma is in place —
so the remaining distributions are mostly continued fractions on top of code
that exists and is tested.

| Spec row | What it takes | Size |
| --- | --- | --- |
| `poissonpdf(` `geometpdf(` and the t/χ²/F family | Poisson and geometric are closed form. Student's t, χ² and F need the regularised incomplete beta and gamma — one continued fraction each, on the Lanczos gamma already here. Plus `invT`. | L |
| `MATH ▸ PRB` | `nPr`, `nCr` and `randNorm(`. The first two are the existing gamma; the third is Box–Muller. | S |

## Sprint 8 — Programs that react

**Why now.** The interpreter suspends for `Input`, `Prompt`, `Pause` and now
`Menu(`, which means the hard part — a program counter with an explicit call
stack — is built and proven. `getKey` is the one thing that needs more than
that, and it is what separates a program that computes from a program you can
play with.

| Spec row | What it takes | Size |
| --- | --- | --- |
| `getKey` | A value inside an expression, so the interpreter needs a yield point mid-expression rather than only between statements. That is the design decision; everything after it is small. Do not fake it — a version that always returns 0 spins to the step limit. | L |
| `Input` into a graph screen | `Input` with no argument puts a free cursor on the graph and stores where it lands. The cursor and the prompt machinery both exist from DRAW. | M |
| `IS>(` `DS<(` | Increment or decrement, then skip the next line on the comparison. Small once the statement table is open. | S |
| `Disp` `Output(` | `Output(` takes a row and column and currently ignores both. Honouring them means the program output area is addressed rather than scrolled. | M |

## Sprint 9 — The graph's last controls

**Why now.** The graph is the most finished part of the app and these are the
gaps you notice only once you are using it seriously — recalling a window you
liked, shading a region, tracing a parametric curve. `CALC` refusing anything
but function mode is the one that most looks like a missing feature rather than
a choice.

| Spec row | What it takes | Size |
| --- | --- | --- |
| `CALC` | zero, minimum, maximum and intersect in parametric, polar and sequence mode. `curves.ts` already parameterises all four, so the analysis has to move from sampling `f(x)` to sampling the curve. | L |
| Shading between curves | `Shade(` and the region between two functions. The hatching from `∫f(x)dx` is the drawing half; picking and clipping the region is the rest. | M |
| `ZOOM ▸ ZoomRcl` / `ZoomSto` | Store one window and get it back. Trivial state, except it should survive a reload, which means a line in the schema and a migration. | S |
| `DrawInv` `DrawF` | Draw a function, or its reflection in `y=x`, without giving it a `Y` slot. Both are curves the plotter can already draw; they need somewhere to live that is not a slot. | M |
| Grid, axes, labels, coordinates | These live in `MODE` here and on a separate `FORMAT` screen there. Moving them is a screen, not a behaviour — worth doing when `2ND FORMAT` has somewhere to go. | S |

## Sprint 10 — Editing, memory and the engine's leftovers

**Why now.** What is left: the things that make a mistake cheap and a session
recoverable. None of it is glamorous and all of it is felt. `Goto` after an
error in particular is the difference between fixing a typo and retyping a
line.

| Spec row | What it takes | Size |
| --- | --- | --- |
| Error `Goto` | On an error, offer `Goto`, and put the caret on the offending character. `ParseError` already carries the position — nothing reads it yet. | M |
| `2ND RCL` | Recall any variable, list or matrix into the line, not just the last answer. Needs a small picker, which the menu machinery gives for free. | S |
| `Mem Mgmt` | Browse what is stored and delete individual variables. A screen over `env` plus the list, matrix and program tables. | M |
| `LOGIC` | `and`, `or`, `xor`, `not(` — comparisons already return 1 and 0, so this is precedence and four operators. | S |
| `MATH ▸ NUM ▸ remainder(` | Two arguments, sign of the divisor. Genuinely one line and a test. | S |
| `MATH ▸ CPX` | The complex operations exist under their own names; this is the menu tab that gathers them where the device puts them. | S |

---

## Not scheduled

The `out-of-scope` rows in the spec are not here on purpose, and each one gives
its reason there. If one of them should be built, change its status first —
this file only schedules what the spec admits is missing.

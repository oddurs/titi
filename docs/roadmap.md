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
| 6 | The rest of the statistics — frequency lists, Med-Med, CubicReg and QuartReg, modified box plots | `6d5ad82` |
| 7 | Distributions and probability — Poisson, geometric, t, χ², F, invT, and the counting functions | `88639e0` |
| 8 | Programs that react — getKey, a placed Output(, IS>( and DS<(, and Input on the graph | `2516be5` |
| 9 | The graph's last controls — a FORMAT screen, ZoomSto and ZoomRcl, DrawF, DrawInv, Shade(, and CALC in every mode | `997cf6b` |
| 10 | Editing, memory and the engine's leftovers — error Goto, a real RCL, Mem Mgmt, the logic connectives, remainder(, the CPX tab | `63835b9` |
| 11 | Modes as instructions — thirty settings given names, plus the axes, the traced expression, the coordinate format and Depend | pending |

---

## Sprint 12 — Graph and table instructions

**Why now.** The other half of what makes a program able to drive the device
rather than only compute. Everything here already exists behind a keypress;
this gives it a name.

| Spec row | What it takes | Size |
| --- | --- | --- |
| Graph and table instructions | `DispGraph`, `DispTable`, `ClrTable`, `FnOn`, `FnOff`, `GraphStyle(`, `Select(`, `ZoomStat`, `ZPrevious`, `PlotsOn`, `Pt-Change(`. Each maps onto something the store already does; `ZoomStat` needs a window fitted to the stat lists, and `ZPrevious` one more slot beside ZoomSto. | M |

## Sprint 13 — Strings

**Why now.** The one architectural piece left. TI-BASIC leans on strings
heavily and the value type does not exist, so this is the sprint that changes
the engine rather than adding to it — worth doing while the test suite is
thick enough to catch what it disturbs.

| Spec row | What it takes | Size |
| --- | --- | --- |
| Strings | A string in `Val`, which `map1`/`map2` must refuse rather than map over, ten string variables, and `expr(`, `sub(`, `length(`, `inString(`, `Equ▸String(`, `String▸Equ(`. `expr(` evaluates its own argument, so the engine ends up able to call itself. | L |

## Sprint 14 — The clock

**Why now.** Refusing it was wrong: a browser has a clock. Twelve commands,
all of them thin over `Date`, and they make the date and time formats on the
MODE screen mean something.

| Spec row | What it takes | Size |
| --- | --- | --- |
| The clock | `ClockOn`, `ClockOff`, `getTmStr(`, `getDtStr(`, `setTime(`, `setDate(`, `setTmFmt(`, `setDtFmt(`, `dayOfWk(`, `timeCnv(`, `startTmr`, `checkTmr(`. The device keeps its own offset from the host clock so setting the time means something. | M |

## Sprint 15 — Row operations

**Why now.** Four functions, pure arithmetic on a matrix, and the last of the
MATRX MATH menu. Small enough to finish the list on.

| Spec row | What it takes | Size |
| --- | --- | --- |
| Row operations | `rowSwap(`, `row+(`, `*row(`, `*row+(` — exchange, add, scale, and scale-and-add. `matrix.ts` already has the elimination that uses all four internally. | S |

---

## Not scheduled

The `out-of-scope` rows in the spec are not here on purpose, and each one gives
its reason there. If one of them should be built, change its status first —
this file only schedules what the spec admits is missing.

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
| 10 | Editing, memory and the engine's leftovers — error Goto, a real RCL, Mem Mgmt, the logic connectives, remainder(, the CPX tab | pending |

---

## Nothing scheduled

The spec has no `todo` rows left: everything it admits is missing has been
built, and what remains is the `out-of-scope` list, which stays out on purpose
and gives its reasons there. If one of those should be built, change its status
in the spec first — this file only schedules what the spec admits is missing.

## Not scheduled

The `out-of-scope` rows in the spec are not here on purpose, and each one gives
its reason there. If one of them should be built, change its status first —
this file only schedules what the spec admits is missing.

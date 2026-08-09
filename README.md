# titi

A scientific and graphing calculator for the browser, with the TI-84 Plus's
keypad and workflow — every key in its real position, `2ND` and `ALPHA`
modifiers, the `Y=` → `WINDOW` → `GRAPH` → `TRACE` loop.

The display is a real dot-matrix panel: everything is drawn at one dot per
physical pixel, thresholded to lit-or-not, and blown up with the grid between
dots left visible. In colour, so curves keep theirs. Works on a phone and a
laptop.

## Run it

```bash
npm install
npm run dev        # http://localhost:9991
```

```bash
npm run check      # typecheck + lint + engine tests
npm run build      # static export to ./out
```

## What it does

**Arithmetic and algebra.** A real parser, not `eval`: implicit multiplication
(`2π`, `3sin(X)`, `(X+1)(X-1)`), TI's precedence (`-2^2` is `-4`, `1/2X` is
`(1/2)X`), factorials, roots, logs to any base, `Ans`, and `A`–`Z` variables via
`STO▸`. Answers carry ten significant digits and drop the leading zero, so `7÷8`
reads `.875`.

**Graphing.** Function, parametric and polar, chosen under `MODE`. The six
slots are reinterpreted rather than duplicated: `Y₁`–`Y₆` in function mode,
`r₁`–`r₆` in polar, and pairs of `Xₙₜ`/`Yₙₜ` in parametric. Per-pixel adaptive
sampling with pole detection, so `tan(X)` breaks at its asymptotes instead of
drawing vertical lines. Drag to pan, wheel or pinch to zoom, drag to trace. The
full `ZOOM` menu including `ZBox`, `ZSquare` and a `ZoomFit` that fits both axes
when the mode calls for it.

**Matrices.** `[A]`–`[J]` with a dimension-aware editor, and literals like
`[[1,2][3,4]]` typed straight into an expression. Products, powers, scalar
broadcast, `det(`, inverse via `x⁻¹`, transpose via `ᵀ`, `rref(`, `ref(`,
`augment(`, `identity(`, `dim(`, `Fill(`, `randM(`, and conversion to and from
lists. Solve a system with `[A]⁻¹[B]` or `rref(augment([A],[B]))`.

**Programs.** A TI-BASIC interpreter with `Disp`, `Input`, `Prompt`, `Output(`,
`If`/`Then`/`Else`, `For(`, `While`, `Repeat`, `Lbl`/`Goto`, `Pause`, `Stop`,
`Return`, `DelVar`, `ClrHome` and `prgm` calls into other programs. It suspends
rather than blocking, so input prompts are real. `QUADRAT`, `COLLATZ` and `FIB`
ship with it; `PRGM ▸ NEW` writes your own.

**Calculus and analysis.** `CALC` gives zero, minimum, maximum, intersect,
`dy/dx` and `∫f(x)dx` with shaded area — backed by Brent's method,
golden-section search and adaptive Simpson quadrature. `nDeriv(`, `fnInt(` and
`solve(` are available as expressions too.

**Statistics.** A six-list editor, 1-Var and 2-Var stats, and five regressions —
`LinReg(ax+b)`, `QuadReg`, `ExpReg`, `LnReg` and `PwrReg` — each writing its fit
back into `Y₁`. Scatter and xyLine stat plots. Normal and binomial
distributions under `DISTR`.

**Tables and modes.** `TABLE` with `TBLSET`, and `MODE` for Normal/Sci/Eng,
Float/Fix, Radian/Degree, Connected/Dot, grid, labels and coordinates.

Your functions, window, lists and modes persist in `localStorage`.

### Keyboard

Digits and operators type straight through. Letters insert variables. `Enter`
evaluates, `Backspace` deletes a whole token, `Esc` closes a menu, and the arrow
keys drive the cursor, the trace and the menus.

## Layout

```
app/                 route, fonts, and the whole stylesheet
components/
  Device.tsx         shell, brand rail, layout
  Screen.tsx         hosts the panel, routes pointer input
  Keypad.tsx         key grid, modifier state, physical keyboard
lib/
  display/           the dot-matrix panel
    panel.ts         buffer, threshold, dot grid, bloom
    pen.ts           dots, lines, character cells
    glyphs.ts        the 5×7 character ROM
    screens.ts       every screen as a character-cell layout
    graph.ts         the plot, drawn dot by dot
  math/              lexer → parser → AST → compiled closures
    lexer.ts         longest-match tokeniser with source spans
    parser.ts        precedence climbing, TI's associativity rules
    eval.ts          AST → (env) => value, plus root/integral solvers
    matrix.ts        dense real linear algebra
    program.ts       the suspendable TI-BASIC interpreter
    format.ts        ten-significant-digit display, ▸Frac
    stats.ts         1-Var, 2-Var, and five regressions
  calc/
    store.ts         the device state machine (zustand)
    curves.ts        one parameterisation for all three graph modes
    keys.ts          the faceplate as data
    menus.ts         menu descriptors
    analysis.ts      zero, extremum and intersection search
scripts/
  test.ts            runs every suite and reports one total
  harness.ts         assertions
  *.test.ts          engine, matrix, program, stats, curves
```

Nothing under `lib/math/` touches React or the DOM, and `lib/calc/curves.ts`
takes its state as arguments — so the suites exercise the real code paths
directly under `tsx`. 235 assertions at last count.

## Design

Dark, moulded, lit from a single source above. Surfaces declare which plane they
sit on: the keypad plate and display well are milled into the shell, keycaps are
raised out of apertures in the plate. The body is warm graphite; the screen is
cool ink. Hardware is tactile, and everything on the screen stays flat.

The display is a dot-matrix panel. Everything renders into a buffer at one
pixel per dot, gets thresholded so a dot is either lit or it isn't, and is then
blown up with the inter-dot gaps cut back in. Because the threshold is on alpha
alone, colour survives — so curves, the trace cursor and error text each keep
their own hue while sharing one grid.

The hardware is lettered in Barlow, a low-contrast grotesque from the signage
lineage, narrow enough to fit `stat plot` on a keycap. The panel has no
typeface at all — it draws from a 5×7 character ROM, the way the device it is
modelled on does, so every glyph lands exactly on the dot grid.

Blue means `2ND` and green means `ALPHA`, and those two colours appear nowhere
else — so a glance at the keypad always answers what a key will do right now.
Arming a modifier promotes its labels onto the caps and dims the keys it does
not reach.

## Deploying

Pushing to `main` builds a static export and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. Enable it once under **Settings → Pages →
Source → GitHub Actions**.

`NEXT_PUBLIC_BASE_PATH` handles the project-site subpath; the workflow fills it
in from `actions/configure-pages`, and it stays empty for local builds, user
sites and custom domains.

## Not implemented

There is no complex-number mode, so `√(-1)` returns `ERR: NONREAL ANS`, as the
device does in real mode. `CALC` is defined against `y(x)` and says so rather
than guessing in parametric and polar modes. Sequence graphing, the finance
solver and `APPS` are absent.

## License

MIT

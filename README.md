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

**Graphing.** Function, parametric, polar and sequence, chosen under `MODE`.
Move the cursor onto a slot's `=` and press enter to switch that plot off.
The six slots are reinterpreted rather than duplicated: `Y₁`–`Y₆` in function
mode, `r₁`–`r₆` in polar, pairs of `Xₙₜ`/`Yₙₜ` in parametric, and `u`, `v`, `w`
with their initial terms in sequence mode — where a definition may refer to
`u(n-1)` or to either of the other two. Per-pixel adaptive
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
`solve(` are available as expressions too, and `MATH ▸ Solver` opens an
equation editor that will solve for any variable in it.

**Complex numbers.** `MODE` switches between Real and `a+bi`. In Real mode
`√(-1)` is an error, as it is on the device; in `a+bi` it is `i`, and the
arithmetic, roots, logs, exponentials, hyperbolics and the inverse trig all
follow — `sin⁻¹(2)` and `tanh⁻¹(2)` answer instead of erroring, on the
principal branch. `abs(` returns the modulus, and `conj(`, `real(`, `imag(`
and `angle(` do what they say.

**Angles.** `ANGLE` carries the `°`, `′`, `″` and `ʳ` marks, so `1°30′36″` is
one angle whatever the mode is set to, and `▸DMS` reads a number of degrees
back out as sexagesimal. `R▸Pr(`, `R▸Pθ(`, `P▸Rx(` and `P▸Ry(` convert between
rectangular and polar.

**Statistics.** A six-list editor, 1-Var and 2-Var stats, and seven
regressions — `LinReg(ax+b)`, `QuadReg`, `ExpReg`, `LnReg`, `PwrReg`,
`Logistic` and `SinReg` — each writing its fit back into `Y₁`. The last two
have no closed form, so they search: the logistic over its ceiling and the
sinusoid over its frequency, with an exact linear fit inside each step. Three
stat plots, each a scatter, xyLine, histogram or box plot over any pair of
lists. Quartiles follow the device's median-of-halves rule rather than the
interpolated quantile. Normal and binomial distributions under `DISTR`.

**Drawing.** `DRAW` puts `Line(`, `Horizontal`, `Vertical`, `Circle(`,
`Text(`, `Pt‑On(` and `Pt‑Off(` on the graph. Each waits for you to place its
points — arrows move a free cursor, `ENTER` sets one — and `ClrDraw` takes it
all back off.

**Lists.** `LIST` splits into NAMES, OPS and MATH the way the device does.
`SortA(` and `SortD(` write back through the list they were given, and `dim(`,
`Fill(`, `seq(`, `cumSum(`, `ΔList(`, `augment(` and the `List▸matr(` pair do
the rest. `sum(` and `prod(` take an optional slice.

**Catalog.** `2nd CATALOG` lists everything the engine knows — built from the
lexer's own tables, so a function added to the engine appears there without
anyone remembering to add it. It opens with A-lock on, and a letter jumps to
that letter; pressing it again walks the run.

**Programs.** A TI-BASIC interpreter that suspends rather than blocks, so
`Input`, `Prompt` and `Pause` work without freezing anything. `Menu(` offers a
choice using the device's own menu, and `Line(`, `Horizontal`, `Vertical`,
`Circle(`, `Text(`, `Pt‑On(`, `Pt‑Off(` and `ClrDraw` put the result on the
graph. `PRGM ▸ SHAPES` is a bundled example of both.

**Tables and modes.** `TABLE` with `TBLSET` — including `Indpnt: Ask`, where
the X column is yours to type and the rest of the row follows — and `MODE` for
Normal/Sci/Eng,
Float/Fix, Radian/Degree, Connected/Dot, grid, labels and coordinates. `2nd ▲`
and `2nd ▼` set the contrast, which is remembered — alpha on the panel is one
bit, so contrast scales the ink rather than fading it.

`2nd ENTRY` walks back through what you have typed, one entry per press, and
wraps at the end.

Your functions, window, lists and modes persist in `localStorage`, under a
schema version — a save from an older build is migrated, and a field that no
longer validates is replaced on its own rather than costing you the rest.
Drawings are deliberately not saved: a drawing belongs to the window it was
made in.

### Offline

There is no server behind this, so there is no reason for it to need the
network twice. It ships a manifest and a service worker: install it to a home
screen, and after one visit it opens with the radio off. Pages are fetched
fresh when they can be, so an update lands on the next visit; the build's
hashed assets are served from the cache at once. The icons are drawn from the
same 5×7 ROM the panel uses — `npm run icons` regenerates them.

### Keyboard

Digits and operators type straight through. Letters insert variables. `Enter`
evaluates, `Backspace` deletes a whole token, `Esc` closes a menu, and the arrow
keys drive the cursor, the trace and the menus.

The keypad is a single tab stop rather than fifty. Tab into it and the arrows
move between keys, `Enter` or `Space` presses one, and `Home` and `End` jump to
the ends; tab away and the arrows go back to driving the calculator.

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
    complex.ts       complex arithmetic, used only off the real line
    solver.ts        equation solving over the root finder
    program.ts       the suspendable TI-BASIC interpreter
    format.ts        ten-significant-digit display, ▸Frac
    stats.ts         1-Var, 2-Var, quartiles, and seven regressions
  calc/
    store.ts         editing, navigation, menus, dispatch
    graphing.ts      window, ZOOM, CALC, TRACE
    programs.ts      running and editing programs
    reports.ts       statistics and the solver
    defaults.ts      the state a device powers on with
    curves.ts        one parameterisation for all three graph modes
    keys.ts          the faceplate as data
    menus.ts         menu descriptors
    analysis.ts      zero, extremum and intersection search
scripts/
  test.ts            runs every suite and reports one total
  harness.ts         assertions
  device.ts          an isolated device, driven by keypress
  panel.ts           a screen rendered through a recording context
  *.test.ts          engine, matrix, program, stats, curves, complex,
                     solver, glyphs, analysis, store, display
```

Nothing under `lib/math/` touches React or the DOM, the `lib/calc` modules take
their state as arguments, and the display only ever fills one-dot rectangles —
so every layer is exercised directly under `tsx`, including the store and the
panel. 606 assertions at last count.

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

## Accessibility

The display is a canvas, so it would say nothing to a screen reader on its own.
The pen records every string it draws, and that transcript is mirrored into a
live region — the panel's contents in words, from the same call that drew them.
The keypad is real buttons throughout, labelled with whatever the active
modifier makes them do.

## Not implemented

`CALC` is defined against `y(x)` and says so rather than guessing in the other
graph modes. The finance solver and `APPS` are absent, and complex values stay
out of lists and matrices.

## License

MIT

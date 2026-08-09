# titi

A scientific and graphing calculator for the browser. It keeps the TI-84 Plus's
keypad and workflow — every key in its real position, `2ND` and `ALPHA`
modifiers, the `Y=` → `WINDOW` → `GRAPH` → `TRACE` loop — and throws away the
96×64 dot-matrix display.

Expressions typeset like a textbook. Curves are drawn as antialiased vector
paths with real axis labels. Works on a phone and a laptop.

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

**Graphing.** Six functions with independent colour and line style. Per-pixel
adaptive sampling with pole detection, so `tan(X)` breaks at its asymptotes
instead of drawing vertical lines. Drag to pan, wheel or pinch to zoom, drag to
trace. The full `ZOOM` menu including `ZBox`, `ZSquare` and `ZoomFit`.

**Calculus and analysis.** `CALC` gives zero, minimum, maximum, intersect,
`dy/dx` and `∫f(x)dx` with shaded area — backed by Brent's method,
golden-section search and adaptive Simpson quadrature. `nDeriv(`, `fnInt(` and
`solve(` are available as expressions too.

**Statistics.** A six-list editor, 1-Var and 2-Var stats, `LinReg(ax+b)` and
`QuadReg` that write their fit back into `Y₁`, plus scatter and xyLine stat
plots. Normal and binomial distributions under `DISTR`.

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
  Screen.tsx         picks a screen, hosts menus and toasts
  Keypad.tsx         key grid, modifier state, physical keyboard
  Plot.tsx           canvas renderer and pointer interaction
  MathText.tsx       linear expression → typeset math
  screens/           home, Y=, window, table, mode, stat editor
lib/
  math/              lexer → parser → AST → compiled closures
    lexer.ts         longest-match tokeniser with source spans
    parser.ts        precedence climbing, TI's associativity rules
    eval.ts          AST → (env) => value, plus root/integral solvers
    format.ts        ten-significant-digit display, ▸Frac
    stats.ts         1-Var, 2-Var, LinReg, QuadReg
  calc/
    store.ts         the device state machine (zustand)
    keys.ts          the faceplate as data
    menus.ts         menu descriptors
    analysis.ts      zero, extremum and intersection search
scripts/
  engine.test.ts     60 assertions over the math engine
```

The math engine has no React or DOM dependency — `scripts/engine.test.ts` runs
it directly under `tsx`.

## Design

Dark, moulded, lit from a single source above. Surfaces declare which plane they
sit on: the keypad plate and display well are milled into the shell, keycaps are
raised out of apertures in the plate. The body is warm graphite; the screen is
cool ink. Hardware is tactile, and everything on the screen stays flat.

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

Matrices and programs are menu stubs — both are large surfaces better built
deliberately than faked. There is no complex-number mode, so `√(-1)` returns
`ERR: NONREAL ANS`, as the device does in real mode.

## License

MIT

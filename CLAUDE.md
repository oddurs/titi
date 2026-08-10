# titi

A browser graphing calculator modelled on the TI-84 Plus. Next.js App Router,
static export, no server. Read `README.md` first for what it does.

## Commands

```bash
npm run dev        # http://localhost:9991 — always use this port
npm run check      # typecheck + lint + tests; run before declaring done
npm test           # every suite in one process, one total
npm run build      # static export to ./out
npm run icons      # redraw public/*.png from the glyph ROM
npm run verify     # build, then check it in a real browser
```

`npm run verify` is the half `npm test` cannot reach: both viewports, hydration,
overflow, the keypad's single tab stop, an offline load with the network cut,
and the numbers — page weight, first paint, keystroke to paint. It needs Chrome
on the machine and leaves screenshots in `.verify/`.

Suites live in `scripts/` and share `harness.ts`. Each ends with
`reportIfMain(import.meta.url)` so it reports when run alone and stays quiet
when `scripts/test.ts` imports it. Run one directly with
`npx tsx scripts/matrix.test.ts`.

**Two harnesses make the non-pure layers testable without a browser.**

`scripts/device.ts` builds an isolated store and drives it by keypress:

```ts
const d = device().press("y=").press("X,T,θ,n").press("x²").press("enter");
eq("commits the slot", d.get().ys[0].expr, "X²");
```

Keys are addressed by the label printed on them, and `"2nd calc"` (or
`"alpha E"`) arms the modifier first — so a case reads as the sequence a person performs. Reach for
`type("7/8")` for runs of digits and operators.

`scripts/panel.ts` renders a screen through a recording context. The display
only ever fills one-dot rectangles, so this reproduces it exactly:

```ts
const p = renderPanel(d.get());
ok("shows the answer", shows(p, ".875"));
ok("axis spans the panel", p.count() > 2000);
console.log(p.art(0, 0, 60, 20));   // ASCII dump when a case fails
```

`renderPanel` **throws if any glyph misses the ROM**, so reaching a screen with
awkward content is itself an assertion. `p.digest()` hashes the lit dots, for
goldens.

## Architecture

Three layers, and the boundaries matter:

1. **`lib/math/`** — pure. Lexer → parser → AST → compiled closures, plus
   `matrix.ts` and the `program.ts` interpreter. No React, no DOM, no store
   import. The suites run it directly under `tsx`, which is why it must stay
   pure. `lib/calc/curves.ts` follows the same rule: it takes state as
   arguments so the graph modes are testable without a canvas.
2. **`lib/calc/`** — the device state machine. `press(keyId)` is the single
   entry point for input; UI components dispatch into it and never implement
   key behaviour themselves. `store.ts` holds the edit buffer, screen
   navigation, menus and the action dispatcher; the self-contained parts live
   beside it and take a small context of callbacks rather than importing the
   store back:

   | module | owns |
   | --- | --- |
   | `graphing.ts` | the window, ZOOM, CALC, TRACE |
   | `programs.ts` | running and editing programs, and the live interpreter |
   | `reports.ts` | statistics and the equation solver |
   | `defaults.ts` | the state a device powers on with |

   `createCalcStore()` builds an isolated instance; `useCalc` is the app's
   single one. Tests use the factory.
3. **`lib/display/`** — the panel. Screens are functions that draw into a
   buffer; there is no DOM inside the glass.
4. **`components/`** — the hardware around the glass, and the keypad.

`lib/calc/keys.ts` is the faceplate as data (label, 2nd label, alpha label, what
each inserts or invokes). `lib/calc/menus.ts` is the menus as data. Adding a key
or a menu item should mean editing data, not adding a branch.

## The spec

`docs/conformance.md` lists every part of the device and its status — `done`,
`partial`, `todo`, `out-of-scope` — with the file it lives in. Adding a feature
means moving its row, and `scripts/conformance.test.ts` fails if a `done` row
names a command the engine does not know, a menu tab that is not there, or a
file that has moved. Reach for it when deciding what to build next; it is the
closest thing here to a product backlog.

`docs/roadmap.md` schedules the rest. It names spec rows verbatim, and
`scripts/roadmap.test.ts` enforces both directions: nothing is scheduled that
the spec has not admitted is missing, and every `todo` in the spec sits in
exactly one sprint. So finishing something means moving its row to `done` in
the spec *and* taking it off the roadmap — the tests fail otherwise.

TI's guidebook is the authority on the device and is linked from the spec, not
vendored — it is their document.

## Things that are load-bearing

**The `env` object is mutated in place.** `store.env` is a stable reference the
math engine writes into (variables, `Ans`, lists). React does not see those
mutations, so anything that must trigger a redraw bumps `revision`. If a graph
or table goes stale, that's the missing piece.

**Plotting clones the env.** `sampler()` sets `env.vars.X` on every call, so
`Plot.tsx` builds its curves against `{ ...env, lenient: true, vars: { ...env.vars } }`.
`lenient: true` turns domain errors into `NaN` instead of throwing — never
sample with a strict env.

**The caret is a plain string index.** `MathText` typesets a linear expression
(raised exponents, radical overbars) but never changes the 1-D cursor model.
Keep it that way; two-dimensional editing is not worth the complexity.

**DEL and the arrows move by token — except inside a number.** `prevBoundary` /
`nextBoundary` in `lib/math/lexer.ts` do this, so `sin(` disappears in one press
but `1234` still lets you reach the 3. Treating a whole number as one token made
the caret unable to enter it at all.

**The only way to switch a function off is the `=` on the Y= screen.** ◀ from
the start of the line puts the caret on it (`onEquals`), ENTER toggles, ▶ steps
back. There is no other control, because the panel has no DOM to hang one on.

**Values are `number | number[] | Matrix | Complex`.** `map1`/`map2` in
`eval.ts` handle the real cases, so element-wise operations work on matrices for
free. Matrix × matrix is the real product and is special-cased; division by a
matrix is a data-type error rather than an inverse.

**Complex is off the fast path on purpose.** Plain numbers stay plain numbers —
plotting samples a curve thousands of times and must not allocate. A `Complex`
appears only when the user writes `i` or an operation leaves the reals *and*
`env.complex === "a+bi"`. Complex never combines with a list or a matrix;
`complexPair` enforces that. Results collapse back to a real when the imaginary
part is rounding noise.

**The interpreter never imports the device.** `Menu(` returns a status the
store turns into a real menu, and the drawing statements push `DrawCommand`s
that `programs.ts` maps to `Drawing`s. `lib/math` stays pure: it emits
coordinates and lets the caller decide what they mean.

**The service worker reads the page to find the build.** Asset names are
hashed, so `public/sw.js` fetches the start page at install and precaches every
same-origin `src`/`href` it names. Without that, the first offline load finds
an empty cache — a worker only controls the visits *after* the one that
installed it.

**The program interpreter suspends, it does not block.** `run()` returns a
status; the store supplies input and calls `run()` again. The live `Interpreter`
lives in a closure variable in the store, not in reactive state — putting it in
state would clone it on every set.

**Sequences are evaluated forwards and cached.** `buildSequences` registers all
three term functions before any of them runs, so a definition can reference
itself or the others. Each term walks from nMin filling a cache, which is what
keeps a recursive definition linear instead of exponential.

**Drawings sit above the curves and are never saved.** `state.drawings` holds
what DRAW put on the glass. They outlive a redraw but not `ClrDraw`, and they
are left out of `persistence.ts` on purpose — a drawing is placed in graph
units against a particular window, so restoring one into a different window
puts it somewhere it was never put.

**The keypad owns its own arrows, but only while focused.** `NAV` and
`stepFocus` in `keys.ts` are the focus model; `Keypad.tsx` uses them for a
roving tabindex, so fifty buttons are one tab stop. The global key handler bows
out of Arrow, Enter and Space whenever focus is inside the keypad — otherwise
the two fight over the same keys and neither wins.

**The catalog is generated, not written.** `catalogItems()` in `menus.ts` builds
it from the lexer's `FUNCTIONS`, so adding a function to the engine puts it in
the catalog. A letter key in any open menu jumps the selection rather than
typing; the catalog just happens to be the menu that needs it.

**Actions are one namespace, dispatched on the verb.** `runAction` splits on
`:` and switches on the first part, so `rcl:A` is the `rcl` case with an
argument. There used to be a second switch on the whole string; between them a
case could land in the wrong one and never run, and a new case could shadow a
key's own — both happened. `scripts/actions.test.ts` now reads the case labels
out of the source and fails on a duplicate verb, on a label containing a colon,
and on any action in `keys.ts` or `menus.ts` that no case answers to.

**A menu closes before its action runs.** `chooseMenuItem` clears `menu` and
then dispatches, so an action that means to stay open (stepping a stat plot's
list, say) reads `menuBeforeAction` — the menu it was chosen from, live only
for that turn.

**Graph modes reinterpret the same six Y slots.** `lib/calc/curves.ts` turns
them into parameterised curves; the plotter, trace and ZoomFit all consume that
rather than reading slots directly. Add a mode there, not in `Plot.tsx`.

**`entryFresh` makes typing replace a pre-filled field.** Set when a WINDOW,
matrix or stat cell loads its current value; the first keystroke replaces
rather than appends. Clear it whenever you set `entry` outside
`loadEditTarget`, or it leaks into the next screen.

**Screens share one edit buffer.** `entry` plus `target` says where ENTER
commits. `row` is a cursor on list screens but a scroll offset on the table —
reset it when entering the table.

**The home screen is a `.pane-stack`, not a `.pane`.** A scrolling `.tape`
above a fixed `.entry-dock`. Both centre on the same `46ch` measure, so the
prompt lines up with the column above it — change one, change both. Every other
screen still uses the absolutely positioned `.pane`.

## TI behaviours the engine reproduces deliberately

Do not "fix" these — they are tested:

- `-2^2` is `-4` (negation binds looser than `^`)
- `1/2X` is `(1/2)X` (implicit multiplication shares precedence with `*`)
- `2^3^2` is `512` (right associative)
- Answers show ten significant digits with no leading zero: `.875`, `.3333333333`
- Trailing parens are optional: `sin(X` parses
- Errors are TI strings: `ERR: SYNTAX`, `ERR: DOMAIN`, `ERR: NONREAL ANS`
- A bare trailing `Y` or `L` is a variable, not `Y₁`/`L₁` — the subscript must
  actually be present (`"".includes()` is true for every string, which is how
  that bug got in)
- Q₁ and Q₃ split the sorted list at the median and take the median of each
  half, dropping the middle value when the count is odd — not the interpolated
  quantile, which would put Q₁ of 1,2,3,4,5 at 2 rather than 1.5
- `▸DMS` is a display format on a number of degrees, not a conversion; reaching
  it from radians means writing the `ʳ` mark
- ENTER ends A-lock and acts as ENTER — it never types its own `solve` label

## The display

Everything on screen is drawn into an offscreen canvas at **one pixel per dot**,
thresholded, then blown up. Three consequences worth knowing before touching it:

- **Alpha is binary, so colour is the only brightness control.** A translucent
  ink does not come out dimmer — it comes out lit or absent. Use a darker RGB
  instead. This is why the graph has three distinct greys rather than three
  opacities of one, and why contrast (`inkGain` in `panel.ts`) scales the RGB
  of lit dots in the same pass that thresholds them.
- **Draw on integers.** `Pen` plots lines with Bresenham rather than stroking,
  so nothing relies on the threshold to look straight.
- **Text comes from a character ROM, not a font.** `lib/display/glyphs.ts` holds
  every glyph as a 5×7 bitmap in a 6×9 cell. Rasterising a pixel font and
  thresholding it looked close but never landed — a stem falling between two
  dots either doubles or vanishes, which is what made round glyphs like 6 and 8
  malformed. Add a symbol to the table, not to the font stack. Subscripts fold
  to plain digits because a 5×7 cell has no room for them.
- **`ctx.font` cannot resolve CSS variables**, and canvas alone never triggers a
  font download. `Screen.tsx` resolves the fallback stack from
  `getComputedStyle` and calls `document.fonts.load` before the first paint.

A screen renderer returns hit regions so taps can still select rows — the panel
has no DOM, so that is the only pointer affordance.

`Pen` also records every string it draws. `pen.transcript()` turns that into
reading-order lines, which `Screen.tsx` mirrors into a live region — the only
thing a screen reader has to go on, since a canvas exposes nothing. Draw text
through `Pen`, never straight to the context, or it vanishes from that mirror.

## CSS

One stylesheet, `app/globals.css`, in plain CSS with custom properties. Tailwind
is installed but unused for this UI — do not mix approaches. It now styles only
the hardware: shell, bezel, keypad, arrow cluster. Anything inside the glass is
drawn, not styled.

**The phone block lives at the end of the file and must stay there.** It
overrides base rules by source order, not specificity. A rule added below it
will silently win on mobile.

Material rules: one light source above and slightly left; every surface declares
its plane (stage < shell < plate < key; shell > well > screen). Blue and green
are reserved for `2ND` and `ALPHA` state and must not be used decoratively.

The screen is an edge-lit panel: `.screen` stays dark and even, and the lamp is
a short falloff on `.screen-body::before`. Do not put a large glow on `.screen`
itself — it fogs the whole field.

Two type roles: `--font-ui` (Barlow) letters the hardware; `--font-mono`
(IBM Plex Mono) is the panel's fallback for anything missing from the ROM. The
panel itself has no typeface.

## Verifying UI work

Screenshots, not assumptions. Playwright with system Chrome is already set up in
the session scratchpad (`shot.mjs` captures desktop 1440×900 and mobile 390×844
in one run and flags viewport overflow). Check both — mobile has caught every
layout bug in this project so far.

Note that a key's accessible name follows the armed modifier: after pressing
`2nd`, the trace key is named `calc`, not `trace`.

## Scope

No finance solver or APPS. `CALC` is function-mode only and says so. Complex
values stay out of lists and matrices.

# titi

A browser graphing calculator modelled on the TI-84 Plus. Next.js App Router,
static export, no server. Read `README.md` first for what it does.

## Commands

```bash
npm run dev        # http://localhost:9991 — always use this port
npm run check      # typecheck + lint + tests; run before declaring done
npm test           # every suite in one process, one total
npm run build      # static export to ./out
```

Suites live in `scripts/` and share `harness.ts`. Each ends with
`reportIfMain(import.meta.url)` so it reports when run alone and stays quiet
when `scripts/test.ts` imports it. Run one directly with
`npx tsx scripts/matrix.test.ts`.

## Architecture

Three layers, and the boundaries matter:

1. **`lib/math/`** — pure. Lexer → parser → AST → compiled closures, plus
   `matrix.ts` and the `program.ts` interpreter. No React, no DOM, no store
   import. The suites run it directly under `tsx`, which is why it must stay
   pure. `lib/calc/curves.ts` follows the same rule: it takes state as
   arguments so the graph modes are testable without a canvas.
2. **`lib/calc/`** — the device state machine. One zustand store owns every
   screen, the edit buffer, modifier state and menus. `press(keyId)` is the
   single entry point for input; UI components dispatch into it and never
   implement key behaviour themselves.
3. **`components/`** — rendering only. Read from the store, call `press`.

`lib/calc/keys.ts` is the faceplate as data (label, 2nd label, alpha label, what
each inserts or invokes). `lib/calc/menus.ts` is the menus as data. Adding a key
or a menu item should mean editing data, not adding a branch.

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

**DEL and the arrows move by token, not character.** `prevBoundary` /
`nextBoundary` in `lib/math/lexer.ts` do this, so `sin(` disappears in one press.

**Values are `number | number[] | Matrix`.** `map1`/`map2` in `eval.ts` handle
all three, so element-wise operations work on matrices for free. Matrix × matrix
is the real product and is special-cased; division by a matrix is a data-type
error rather than an inverse.

**The program interpreter suspends, it does not block.** `run()` returns a
status; the store supplies input and calls `run()` again. The live `Interpreter`
lives in a closure variable in the store, not in reactive state — putting it in
state would clone it on every set.

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

## CSS

One stylesheet, `app/globals.css`, in plain CSS with custom properties. Tailwind
is installed but unused for this UI — do not mix approaches.

**The phone block lives at the end of the file and must stay there.** It
overrides base rules by source order, not specificity. A rule added below it
will silently win on mobile.

Material rules: one light source above and slightly left; every surface declares
its plane (stage < shell < plate < key; shell > well > screen). Blue and green
are reserved for `2ND` and `ALPHA` state and must not be used decoratively.

The screen is an edge-lit panel: `.screen` stays dark and even, and the lamp is
a short falloff on `.screen-body::before`. Do not put a large glow on `.screen`
itself — it fogs the whole field.

Three type roles: `--font-ui` (Barlow) is hardware lettering, `--font-math`
(IBM Plex Sans) is screen content, `--font-mono` (IBM Plex Mono) is readouts
and tables. Hardware and screen are deliberately different faces.

## Verifying UI work

Screenshots, not assumptions. Playwright with system Chrome is already set up in
the session scratchpad (`shot.mjs` captures desktop 1440×900 and mobile 390×844
in one run and flags viewport overflow). Check both — mobile has caught every
layout bug in this project so far.

Note that a key's accessible name follows the armed modifier: after pressing
`2nd`, the trace key is named `calc`, not `trace`.

## Scope

No complex-number mode; it would touch every numeric path. No sequence
graphing, finance solver or APPS. `CALC` is function-mode only and says so.

# What this device is supposed to do

titi is modelled on the TI-84 Plus. This is the spec that says what that means
in practice: every menu, key and behaviour we intend to reproduce, what state
it is in, and where it lives.

**On the manual.** Texas Instruments publishes the authoritative guidebook, and
it is theirs — it is not vendored here. Read it alongside this file:
[TI-84 Plus and TI-84 Plus Silver Edition Guidebook](https://education.ti.com/html/eguides/graphing/84Plus/PDFs/TI-84-Plus-guidebook_EN.pdf)
(TI's [guidebook index](https://education.ti.com/en/product-resources/guidebooks/graphing-calculators)
has the rest). What follows is our own restatement of the *behaviour* — the
inventory of commands and what they do — written to be worked from, not read
for pleasure.

**On the two scores.** This file measures how much of what we *chose* to build
is done. `docs/ti84-commands.txt` and `scripts/inventory.test.ts` measure
something harder: every function and instruction the guidebook documents,
whether we answer to it, and — if not — whether that is planned or refused.
That second number is the honest one for "how much of the device is this", and
it is lower. Both are printed by `npm test`.

**On checking.** `scripts/manual.test.ts` runs the guidebook's own worked
examples — an expression and the answer the device prints for it. Three of
those printed answers are wrong in the ninth digit and ours are right, so that
suite asserts the true values and says which they are. Where we deliberately do
more than the device, the row says so rather than claiming conformance.

**On status.** Four values, and they mean exactly this:

| Status | Meaning |
| --- | --- |
| `done` | Built, and something in `scripts/` fails if it breaks |
| `partial` | Built, but narrower than the device — the row says how |
| `todo` | Not built; a fair thing to want |
| `out-of-scope` | Deliberately not built; the row says why |

`scripts/conformance.test.ts` reads this file. It checks that every status is
one of those four, that every backticked command in a `done` row is something
the engine actually knows, that every menu path named here exists with that
tab, and that every file referenced exists. A row that lies fails the build.

---

## The keyboard

50 keys, `lib/calc/keys.ts`, addressed by the label printed on them.

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Key faces | Each key carries a face label, a `2ND` label and an `ALPHA` label | done | `lib/calc/keys.ts` |
| `2ND` / `ALPHA` | Arm the next keypress; `ALPHA` twice locks | done | `lib/calc/store.ts` |
| A-lock and ENTER | ENTER ends the lock and acts as ENTER, never typing its alpha label | done | `scripts/store.test.ts` |
| Physical keyboard | Digits and operators type through, letters insert variables, `Esc` closes a menu | done | `components/Keypad.tsx` |
| Keypad focus | One tab stop; arrows move between keys, Enter or Space presses one | done | `lib/calc/keys.ts` |
| `2ND ▲` / `2ND ▼` | Contrast, 0–9, remembered | done | `lib/display/panel.ts` |
| `ON` | Clears RAM and returns to the home screen | done | `lib/calc/store.ts` |
| `2ND OFF` | The panel goes dark and the keypad stops answering until `ON`; not saved, so a reload hands back a working calculator | done | `scripts/store.test.ts` |
| `2ND LINK` | There is no second device to link to | out-of-scope | — |

## The home screen

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Entry and answer tape | Scrolling history above a fixed prompt | done | `lib/display/screens.ts` |
| Ten significant digits | `.875`, `.3333333333`, no leading zero | done | `lib/math/format.ts` |
| `2ND ENTRY` | Walks back through previous inputs and wraps | done | `scripts/store.test.ts` |
| `2ND ANS` | The last answer, as a value | done | `lib/calc/keys.ts` |
| `STO▸` | Stores into a variable, list, matrix or `Y` slot | done | `lib/math/eval.ts` |
| Implicit multiplication | `1/2X` is `(1/2)X`; juxtaposition binds like `*` | done | `lib/math/parser.ts` |
| Negation precedence | `-2^2` is `-4` | done | `scripts/engine.test.ts` |
| Right-associative power | `2^3^2` is `512` | done | `scripts/engine.test.ts` |
| Optional closing paren | `sin(X` parses | done | `lib/math/parser.ts` |
| TI error strings | `ERR: SYNTAX`, `ERR: DOMAIN`, `ERR: NONREAL ANS` and friends | done | `lib/math/eval.ts` |
| `2ND RCL` | A picker of everything stored: a scalar comes back as its value, a list or matrix as its name | done | `lib/calc/store.ts` |
| Error `Goto` | An error offers Quit or Goto; Goto brings the line back with the caret on the offending character | done | `scripts/store.test.ts` |

## MATH

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `MATH ▸ MATH` | `▸Frac`, `▸Dec`, `x³`, `∛(`, `ˣ√(`, `fMin(`, `fMax(`, `nDeriv(`, `fnInt(`, `solve(`, Solver | done | `lib/calc/menus.ts` |
| `MATH ▸ NUM` | `abs(`, `round(`, `iPart(`, `fPart(`, `int(`, `min(`, `max(`, `lcm(`, `gcd(` | done | `lib/math/eval.ts` |
| `MATH ▸ PRB` | `rand`, `nPr`, `nCr`, `!`, `randInt(`, `randNorm(`, `randBin(`, `randIntNoRep(` — the two counters are written between their arguments, as on the device | done | `scripts/manual.test.ts` |
| `MATH ▸ CPX` | The complex operations gathered where the device puts them | done | `lib/calc/menus.ts` |
| `remainder(` | Two arguments, taking the sign of the divisor | done | `lib/math/eval.ts` |

## ANGLE

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `°` `′` `″` | Degrees, minutes, seconds; `1°30′36″` is one angle | done | `lib/math/parser.ts` |
| `ʳ` | Marks radians whatever the mode | done | `lib/math/eval.ts` |
| `▸DMS` | Displays a number of degrees as sexagesimal | done | `lib/math/format.ts` |
| `R▸Pr(` `R▸Pθ(` | Rectangular to polar | done | `lib/math/eval.ts` |
| `P▸Rx(` `P▸Ry(` | Polar to rectangular | done | `lib/math/eval.ts` |
| Radian / Degree | Sets the angle mode from the menu | done | `lib/calc/menus.ts` |

## TEST and logic

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `TEST` | `=`, `≠`, `>`, `≥`, `<`, `≤` returning 1 or 0 | done | `lib/math/parser.ts` |
| `LOGIC` | `and`, `or`, `xor`, `not(`, binding looser than the comparisons they join | done | `lib/math/parser.ts` |

## Graphing

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `Y=` | Six slots, each switchable with the `=` on the line | done | `lib/display/screens.ts` |
| Graph modes | Func, Par, Pol, Seq — all six slots reinterpreted | done | `lib/calc/curves.ts` |
| `WINDOW` | Bounds per mode, including `Tmin`/`Tmax`/`Tstep` and `nMin`/`nMax` | done | `lib/calc/layout.ts` |
| `ZOOM` | ZBox, In, Out, ZDecimal, ZSquare, ZStandard, ZTrig, ZInteger, ZoomFit | done | `lib/calc/graphing.ts` |
| `TRACE` | Walks a curve, reports the coordinate, switches between curves | done | `lib/calc/graphing.ts` |
| `CALC` | value and `dy/dx` in every mode; zero, minimum, maximum, intersect and `∫f(x)dx` need a function of x, as they do on the device | done | `lib/calc/graphing.ts` |
| `FORMAT` | Its own screen: grid, axes, labels, coordinates, the traced expression, rectangular or polar readout, connected or dot | done | `lib/calc/layout.ts` |
| Plot styles | Line, thick, dot | done | `lib/calc/types.ts` |
| Shading between curves | `Shade(` hatches the region between two typed expressions | done | `lib/display/graph.ts` |
| `ZoomSto` / `ZoomRcl` | One window put aside and brought back, saved with the rest | done | `lib/calc/graphing.ts` |

## DRAW

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `ClrDraw` | Takes everything drawn back off | done | `lib/calc/graphing.ts` |
| `Line(` | Between two placed points | done | `lib/display/graph.ts` |
| `Horizontal` `Vertical` | Across or down the whole field | done | `lib/display/graph.ts` |
| `Circle(` | Centre, then a point on the rim | done | `lib/display/graph.ts` |
| `Text(` | A label where you put it | done | `lib/display/graph.ts` |
| `Pt-On(` `Pt-Off(` | One dot, added or erased | done | `lib/display/graph.ts` |
| Placing points | Arrows drive a free cursor, ENTER sets one | done | `scripts/display.test.ts` |
| Tangent | Draws the tangent at the cursor | done | `lib/calc/graphing.ts` |
| `DrawInv` `DrawF` | A curve drawn without a Y slot, or reflected in y = x | done | `lib/display/graph.ts` |
| `Pxl-On(` and the pixel commands | The panel is addressed in graph units, not pixels | out-of-scope | — |
| `StorePic` / `RecallPic` | Nothing to store a picture into | out-of-scope | — |

## TABLE

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `TABLE` | A column per switched-on function | done | `lib/display/screens.ts` |
| `TBLSET` | `TblStart`, `ΔTbl` | done | `lib/display/screens.ts` |
| `Indpnt: Ask` | The X column is typed; ENTER adds a row, DEL takes one back | done | `scripts/store.test.ts` |
| `Depend: Ask` | The Y columns stay empty rather than filling themselves in | done | `lib/display/screens.ts` |
| Graph and table instructions | `DispGraph`, `DispTable`, `ClrTable`, `FnOn`, `FnOff`, `GraphStyle(`, `ZoomStat`, `ZPrevious`, `PlotsOn`, `Pt-Change(` | done | `lib/calc/instructions.ts` |
| `Select(` | Choosing a range of points off a scatter plot and copying them into two lists | todo | — |

## Statistics

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| List editor | Six lists, typed in place | done | `lib/display/screens.ts` |
| `1-Var Stats` | Mean, both deviations, the five-number summary | done | `lib/math/stats.ts` |
| `2-Var Stats` | The paired sums and means | done | `lib/math/stats.ts` |
| Quartiles | Median of halves, dropping the middle when the count is odd | done | `scripts/stats.test.ts` |
| `LinReg(ax+b)` | With `r` and `r²` | done | `lib/math/stats.ts` |
| `QuadReg` `ExpReg` `LnReg` `PwrReg` | Each writing its fit into `Y₁` | done | `lib/math/stats.ts` |
| `Logistic` | `c/(1+ae^(-bx))`, fitted by searching the ceiling | done | `scripts/stats.test.ts` |
| `SinReg` | `a sin(bx+c)+d`, fitted by searching the frequency | done | `scripts/stats.test.ts` |
| `SortA(` `SortD(` | Sort a list, writing back through it | done | `lib/math/eval.ts` |
| Stat plots | Three, each scatter, xyLine, histogram or box plot over any pair of lists | done | `lib/display/graph.ts` |
| Modified box plot | Whiskers stop at 1.5 IQR and the outliers beyond are drawn with the plot's mark | done | `lib/display/graph.ts` |
| `CubicReg` `QuartReg` | One polynomial fit at any degree, so all three share a solve | done | `lib/math/stats.ts` |
| `Med-Med` | The resistant line: median of three groups, fitted through the outer two | done | `scripts/stats.test.ts` |
| Frequency lists | A second list weighting the first, through every statistic and both plots | done | `lib/math/stats.ts` |
| `STAT TESTS` | Inference is a different product | out-of-scope | — |

## DISTR

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `normalpdf(` `normalcdf(` `invNorm(` | With West's normal CDF behind them | done | `lib/math/eval.ts` |
| `binompdf(` `binomcdf(` | — | done | `lib/math/eval.ts` |
| `poissonpdf(` `geometpdf(` and the t/χ²/F family | Plus `invT(`, on the regularised incomplete gamma and beta | done | `lib/math/eval.ts` |

## LIST

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `LIST ▸ NAMES` | `L₁`–`L₆` | done | `lib/calc/menus.ts` |
| `LIST ▸ OPS` | `SortA(`, `SortD(`, `dim(`, `Fill(`, `seq(`, `cumSum(`, `ΔList(`, `augment(`, `List▸matr(`, `Matr▸list(` | done | `lib/math/eval.ts` |
| `LIST ▸ MATH` | `min(`, `max(`, `mean(`, `median(`, `sum(`, `prod(`, `stdDev(`, `variance(` | done | `lib/math/eval.ts` |
| Element-wise arithmetic | A list op a list, or a list op a scalar | done | `lib/math/eval.ts` |
| Named lists beyond `L₁`–`L₆` | — | out-of-scope | six is the faceplate |

## MATRIX

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Editor | Dimensions and cells, ENTER walking across then down | done | `lib/display/screens.ts` |
| `det(` `ᵀ` `dim(` `Fill(` `identity(` `randM(` `augment(` | — | done | `lib/math/matrix.ts` |
| `rref(` `ref(` | — | done | `lib/math/matrix.ts` |
| `Matr▸list(` `List▸matr(` | — | done | `lib/math/matrix.ts` |
| Matrix arithmetic | Real product for `×`; inverse via `⁻¹`; division by a matrix is a data-type error | done | `scripts/matrix.test.ts` |
| Row operations | `row+(`, `rowSwap(`, `*row(`, `*row+(` — the elementary ones | todo | — |
| Complex entries | Complex stays out of lists and matrices, on purpose | out-of-scope | `lib/math/complex.ts` |

## Complex numbers

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `MODE` Real / `a+bi` | Real refuses to leave the reals, as the device does | done | `lib/math/eval.ts` |
| Arithmetic, roots, logs, powers | — | done | `lib/math/complex.ts` |
| Trig and hyperbolics | The guidebook says the trig functions do not take complex arguments; ours do, on the principal branch — a deliberate extension | done | `lib/math/complex.ts` |
| Inverse trig and hyperbolics | Principal branch, cuts where they belong; also beyond the device | done | `scripts/complex.test.ts` |
| `conj(` `real(` `imag(` `angle(` `abs(` | — | done | `lib/math/eval.ts` |
| `re^θi` display mode | `a+bi` is the only complex display | out-of-scope | — |

## Programs

`lib/math/program.ts` — a TI-BASIC interpreter that suspends rather than blocks.

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Editor | Line-based, in the panel | done | `lib/display/screens.ts` |
| `Disp` `Output(` | `Disp` scrolls, `Output(` is placed at a row and column and laid over it | done | `lib/math/program.ts` |
| `Input` `Prompt` | Suspend for the user and resume | done | `scripts/program.test.ts` |
| `If` `Then` `Else` `End` | — | done | `scripts/program.test.ts` |
| `For(` `While` `Repeat` | — | done | `scripts/program.test.ts` |
| `Lbl` `Goto` `Pause` `Stop` `Return` | — | done | `scripts/program.test.ts` |
| `Menu(` | Offers a choice using the device's own menu | done | `scripts/program.test.ts` |
| `ClrHome` `ClrList` `DelVar` | — | done | `lib/math/program.ts` |
| `prgm` | Calls another program, with a real call stack | done | `scripts/program.test.ts` |
| Drawing from a program | `Line(`, `Horizontal`, `Vertical`, `Circle(`, `Text(`, `Pt-On(`, `Pt-Off(`, `ClrDraw` | done | `lib/calc/programs.ts` |
| `getKey` | Reads and clears the last key, and hands the screen back on an empty keyboard so the loop stays escapable | done | `scripts/program.test.ts` |
| `IS>(` `DS<(` | Count, then skip the next line past the bound | done | `lib/math/program.ts` |
| `Input` into a graph screen | A bare `Input` hands over the graph and stores the cursor in X and Y | done | `lib/calc/programs.ts` |
| `Asm(` | There is no Z80 here | out-of-scope | — |
| Strings | A string value in the engine, with `expr(`, `sub(`, `length(`, `inString(`, `Equ▸String(` and `String▸Equ(` | todo | — |

## MODE

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Mode settings as instructions | Thirty of them, from one table read by both the home screen and the interpreter; `Fix n` takes a digit | done | `lib/calc/instructions.ts` |
| Normal / Sci / Eng | — | done | `lib/math/format.ts` |
| Float / Fix 0–9 | — | done | `lib/math/format.ts` |
| Radian / Degree | — | done | `lib/calc/layout.ts` |
| Func / Par / Pol / Seq | — | done | `lib/calc/curves.ts` |
| Connected / Dot | — | done | `lib/display/graph.ts` |
| Real / `a+bi` | — | done | `lib/calc/layout.ts` |
| Grid, axes, labels, coordinates | On their own `2ND FORMAT` screen, as on the device | done | `lib/calc/layout.ts` |
| Sequential / Simul | Curves are drawn in one pass; there is nothing to interleave | out-of-scope | — |
| `Full` / `Horiz` / `G-T` split screens | One panel, one screen | out-of-scope | — |

## MEMORY

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| `ClrAllLists` `ClrHome` | — | done | `lib/calc/menus.ts` |
| `Reset RAM` | Back to a powered-on device | done | `lib/calc/store.ts` |
| The clock | `ClockOn`, `getTmStr(`, `setDate(`, `dayOfWk(`, `timeCnv(` and the rest — a browser does have a clock, which is why this is not refused | todo | — |
| `Mem Mgmt` | Lists what is stored and deletes one at a time, staying open for the next | done | `lib/calc/store.ts` |

## APPS

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Finance / TVM | — | out-of-scope | stated in `CLAUDE.md` |
| Anything else in the APPS list | Nothing is installed, and the menu says so rather than offering a dead choice | out-of-scope | `lib/calc/menus.ts` |

## CATALOG

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Every command in one list | Generated from the engine's own tables | done | `lib/calc/menus.ts` |
| Letter jump | Opens with A-lock; a letter jumps, again walks the run | done | `scripts/store.test.ts` |

## The panel

Not the manual's territory, but it is the half of the product you look at.

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Dot matrix | One buffer pixel per dot, thresholded to one bit of coverage, blown up | done | `lib/display/panel.ts` |
| Character ROM | 5×7 in a 6×9 cell; no typeface on the panel | done | `lib/display/glyphs.ts` |
| Contrast | Scales the ink, because alpha is binary | done | `lib/display/panel.ts` |
| Screen reader | Every string drawn is mirrored into a live region | done | `lib/display/pen.ts` |
| Failure on the glass | A screen that throws draws its own fault, with `ON` to reset | done | `lib/display/screens.ts` |

## Beyond the device

| Item | Behaviour | Status | Where |
| --- | --- | --- | --- |
| Installable | Manifest and icons drawn from the glyph ROM | done | `public/manifest.webmanifest` |
| Offline | A service worker that precaches the build it reads off the page | done | `public/sw.js` |
| Persistence | Versioned, migrated, validated field by field | done | `lib/calc/persistence.ts` |

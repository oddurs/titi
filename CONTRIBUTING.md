# Contributing

Thanks for looking. Issues and pull requests are both welcome.

## Getting set up

```bash
npm install
npm run dev        # http://localhost:9991
```

## Before you open a pull request

```bash
npm run check      # types, lint, and every suite — about a second
npm run verify     # builds, then checks it in a real browser
```

`check` is fast enough to run constantly and there is no reason not to. `verify`
takes longer because it builds and drives a browser; run it when you have
touched anything that ends up on screen.

## How the tests are arranged

Everything under `scripts/` runs under `tsx` with no browser, which is what
keeps it quick. Two harnesses do most of the work:

- `scripts/device.ts` builds an isolated calculator and drives it by keypress,
  addressed by the label printed on the key — `press("2nd calc")`,
  `choose("SinReg")`. Write cases as the sequence a person would perform, and
  address menu items by label rather than by counting presses down.
- `scripts/panel.ts` renders a screen through a recording canvas and hands back
  the lit dots, the text, and the tappable regions. It throws if a glyph is
  missing from the character ROM, so reaching an awkward screen is itself an
  assertion.

There are also three scoreboards that fail rather than rot: the conformance spec
is checked against the code, the roadmap against the spec, and the command
inventory against the engine.

## What to read first

`CLAUDE.md` is the architecture guide — three layers, what is load-bearing in
each, and the handful of decisions that look odd until you know why. The section
called "Things that are load-bearing" is the one that saves the most time.

## Style

Match the surrounding code. Comments explain why something is the way it is,
not what the line does; several of them exist because a plausible-looking
alternative was tried and did not work.

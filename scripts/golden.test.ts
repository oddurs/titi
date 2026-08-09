import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, ok, reportIfMain } from "./harness";
import { FIXTURES } from "./fixtures";
import { renderPanel } from "./panel";

/**
 * Golden panels.
 *
 * The display is a fixed dot grid, so a rendering is exactly reproducible —
 * which makes a digest of the lit dots a precise regression signal, and the
 * transcript a readable one. When a golden fails, the transcript diff usually
 * says what changed without anyone opening a browser.
 *
 * Rewrite them deliberately with `npm run test:goldens`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, "goldens.json");
const UPDATE = process.env.UPDATE_GOLDENS === "1";

type Golden = { digest: string; transcript: string[] };

const previous: Record<string, Golden> = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, "utf8"))
  : {};
const current: Record<string, Golden> = {};

describe(UPDATE ? "golden panels (updating)" : "golden panels");

for (const [name, build] of Object.entries(FIXTURES)) {
  const panel = renderPanel(build().get());
  const golden: Golden = { digest: panel.digest(), transcript: panel.transcript };
  current[name] = golden;

  if (UPDATE) {
    ok(`${name} recorded`, true);
    continue;
  }

  const before = previous[name];
  if (!before) {
    ok(`${name} has a golden`, false, "no baseline — run npm run test:goldens");
    continue;
  }

  if (before.digest === golden.digest) {
    ok(name, true);
    continue;
  }

  // Lead with the text difference; it is almost always the readable one.
  const added = golden.transcript.filter((l) => !before.transcript.includes(l));
  const removed = before.transcript.filter((l) => !golden.transcript.includes(l));
  const detail = [
    `digest ${before.digest} → ${golden.digest}`,
    ...removed.map((l) => `  - ${l}`),
    ...added.map((l) => `  + ${l}`),
  ].join("\n      ");
  ok(name, false, detail);
}

if (UPDATE) {
  writeFileSync(FILE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`  wrote ${Object.keys(current).length} goldens`);
}

describe("the fixtures cover every screen");
{
  const screens = new Set(
    Object.values(FIXTURES).map((build) => build().get().screen),
  );
  for (const s of [
    "home", "graph", "yeq", "window", "table", "tblset", "mode",
    "stat", "matrix", "prgm", "prgmrun", "solver",
  ]) {
    ok(`${s} has a fixture`, screens.has(s as never));
  }
}

reportIfMain(import.meta.url);

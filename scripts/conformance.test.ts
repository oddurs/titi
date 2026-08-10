import { existsSync, readFileSync } from "node:fs";
import { describe, ok, reportIfMain } from "./harness";
import { FUNCTIONS } from "../lib/math/lexer";
import { MENUS } from "../lib/calc/menus";

/**
 * The spec, checked against the code.
 *
 * `docs/conformance.md` says what the device is supposed to do and how far
 * along each part is. A document like that rots the moment nobody is checking
 * it, so this reads it back: a row claiming `done` has to name a command the
 * engine actually knows and a file that actually exists, and every menu it
 * mentions has to be in `menus.ts` with that tab.
 *
 * The point is not to police prose. It is that deleting a function, renaming a
 * menu tab or moving a file should fail here rather than leaving the spec
 * quietly describing a calculator we no longer ship.
 */

const SPEC = "docs/conformance.md";
const source = readFileSync(SPEC, "utf8");

interface Row {
  section: string;
  item: string;
  behaviour: string;
  status: string;
  where: string;
}

/** Every table row under its `##` heading. */
function rows(): Row[] {
  const out: Row[] = [];
  let section = "";
  for (const line of source.split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    if (!line.startsWith("| ") || line.startsWith("| ---")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4) continue;
    if (cells[0] === "Item" || cells[0] === "Status") continue;
    out.push({ section, item: cells[0], behaviour: cells[1], status: cells[2], where: cells[3] });
  }
  return out;
}

const STATUSES = ["done", "partial", "todo", "out-of-scope"];
const all = rows();

describe("the spec is well formed");
ok("it has rows", all.length > 100, `${all.length}`);
for (const status of new Set(all.map((r) => r.status))) {
  ok(`"${status}" is a status we recognise`, STATUSES.includes(status));
}
ok("every row says something about behaviour", all.every((r) => r.behaviour.length > 0));
ok("and every row belongs to a section", all.every((r) => r.section.length > 0));

describe("nothing claims to be done without somewhere to live");
for (const r of all.filter((x) => x.status === "done")) {
  ok(`${r.section}: ${r.item} names where it lives`, r.where !== "—" && r.where.length > 1);
}

describe("every file the spec points at exists");
{
  const paths = new Set<string>();
  for (const r of all) {
    for (const m of r.where.matchAll(/`([^`]+)`/g)) {
      if (/\.(ts|tsx|css|js|webmanifest|md)$/.test(m[1])) paths.add(m[1]);
    }
  }
  ok("it points at a fair number of them", paths.size > 20, `${paths.size}`);
  for (const p of [...paths].sort()) ok(`${p} is there`, existsSync(p));
}

describe("every command called done is one the engine knows");
{
  // Anything backticked that looks like a function head, e.g. `abs(`.
  const heads = new Set<string>();
  for (const r of all.filter((x) => x.status === "done")) {
    for (const m of `${r.item} ${r.behaviour}`.matchAll(/`([^`]+)`/g)) {
      const token = m[1];
      if (token.endsWith("(") && !token.includes(" ")) heads.add(token);
    }
  }
  ok("there are commands to check", heads.size > 25, `${heads.size}`);

  // A head counts as known if the lexer opens on it, or a menu inserts it, or
  // the interpreter treats it as a statement.
  const known = new Set<string>(FUNCTIONS);
  for (const menu of Object.values(MENUS)) {
    for (const tab of menu.tabs) {
      for (const item of tab.items) {
        if (item.insert) known.add(item.insert);
        known.add(item.label);
      }
    }
  }
  const program = readFileSync("lib/math/program.ts", "utf8");
  for (const p of [...heads].sort()) {
    // The device prints a non-breaking hyphen on some faces; compare on the
    // plain one so `Pt-On(` and `Pt‑On(` are the same command.
    const plain = p.replace(/‑/g, "-");
    const inProgram = program.includes(`"${plain}"`);
    const inEngine = [...known].some((k) => k.replace(/‑/g, "-") === plain);
    ok(`${p} exists`, inEngine || inProgram);
  }
}

describe("every menu the spec names is really there");
{
  // "MATH ▸ NUM" means MENUS.math has a tab called num. Only done rows have to
  // resolve — a todo row naming a tab we have not built is the whole point.
  const paths = new Set<string>();
  for (const r of all.filter((x) => x.status === "done")) {
    for (const m of r.item.matchAll(/`([A-Z][A-Za-z]*) ▸ ([A-Za-z]+)`/g)) {
      paths.add(`${m[1]}/${m[2]}`);
    }
  }
  ok("some are named", paths.size > 3, `${paths.size}`);
  for (const path of [...paths].sort()) {
    const [menu, tab] = path.split("/");
    const def = MENUS[menu.toLowerCase()];
    ok(`${menu} is a menu`, !!def);
    ok(
      `${menu} has a ${tab} tab`,
      !!def?.tabs.some((t) => t.name.toLowerCase() === tab.toLowerCase()),
    );
  }
}

describe("out-of-scope means a reason was given");
for (const r of all.filter((x) => x.status === "out-of-scope")) {
  ok(
    `${r.section}: ${r.item} says why`,
    r.behaviour.length > 1 || r.where !== "—",
    `"${r.behaviour}"`,
  );
}

describe("coverage");
{
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const done = count("done");
  const partial = count("partial");
  const todo = count("todo");
  const out = count("out-of-scope");
  const built = done + partial;
  const wanted = built + todo;
  console.log(
    `    ${done} done, ${partial} partial, ${todo} to do, ${out} out of scope ` +
      `— ${Math.round((built / wanted) * 100)}% of what we mean to build`,
  );
  ok("most of the device is built", built / wanted > 0.75);
  // Nothing left to do is a legitimate state, and the roadmap test is the one
  // that checks the plan agrees. What must hold here is that every row still
  // carries a status and out-of-scope still carries a reason, both above.
  ok("and something is actually built", done > 50, `${done}`);
}

reportIfMain(import.meta.url);

import { readFileSync } from "node:fs";
import { describe, eq, ok, reportIfMain } from "./harness";

/**
 * The roadmap, checked against the spec.
 *
 * `docs/roadmap.md` schedules the work `docs/conformance.md` admits is
 * missing. Two documents that describe the same thing drift apart the moment
 * nobody is comparing them, so this compares them:
 *
 *   - nothing is scheduled that the spec does not list as todo or partial
 *   - every todo in the spec is scheduled in exactly one sprint
 *
 * The second is the one worth having. Without it a feature can be dropped from
 * the plan and nothing anywhere says so.
 */

const SPEC = "docs/conformance.md";
const ROADMAP = "docs/roadmap.md";

/** Table rows under their `##` heading, for either document. */
function rows(path: string, width: number): { section: string; cells: string[] }[] {
  const out: { section: string; cells: string[] }[] = [];
  let section = "";
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    if (!line.startsWith("| ") || line.startsWith("| ---")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== width) continue;
    out.push({ section, cells });
  }
  return out;
}

const spec = rows(SPEC, 4)
  .filter((r) => !["Item", "Status"].includes(r.cells[0]))
  .map((r) => ({ section: r.section, item: r.cells[0], status: r.cells[2] }));

const sprints = rows(ROADMAP, 3)
  .filter((r) => r.cells[0] !== "Spec row" && r.section.startsWith("Sprint "))
  .map((r) => ({ sprint: r.section, item: r.cells[0], takes: r.cells[1], size: r.cells[2] }));

describe("the roadmap is well formed");
// The plan empties as it is worked through. An empty one is correct exactly
// when the spec has nothing left to do — which the section below enforces from
// the other side.
const outstandingTodo = spec.filter((r) => r.status === "todo").length;
ok(
  "it schedules whatever is left",
  outstandingTodo === 0 ? sprints.length === 0 : sprints.length > 0,
  `${sprints.length} scheduled for ${outstandingTodo} missing`,
);
for (const size of new Set(sprints.map((s) => s.size))) {
  ok(`"${size}" is a size we use`, ["S", "M", "L"].includes(size));
}
ok("every item says what it takes", sprints.every((s) => s.takes.length > 20));

describe("the sprints run in order without gaps");
{
  const numbers = [...new Set(sprints.map((s) => Number(s.sprint.match(/Sprint (\d+)/)?.[1])))];
  ok("each heading is numbered", numbers.every((n) => Number.isFinite(n)), `${numbers}`);
  const sorted = [...numbers].sort((a, b) => a - b);
  eq("they are written in order", numbers, sorted);
  eq("and nothing is skipped", sorted, sorted.map((_, i) => sorted[0] + i));
  const shipped = rows(ROADMAP, 3)
    .filter((r) => r.section === "Shipped" && /^\d+$/.test(r.cells[0]))
    .map((r) => Number(r.cells[0]));
  ok("every sprint that shipped says where", shipped.length > 0);
  // The plan starts where the shipped list stops — otherwise a sprint can be
  // finished and quietly left on the roadmap, or dropped without shipping.
  if (sorted.length) {
    eq("the plan starts where the shipped list stops", sorted[0], Math.max(...shipped) + 1);
  }
}

describe("nothing is scheduled that the spec has not admitted to");
{
  const byItem = new Map(spec.map((r) => [r.item, r]));
  for (const s of sprints) {
    const match = byItem.get(s.item);
    ok(`${s.sprint}: "${s.item}" is a row in the spec`, !!match);
    if (match) {
      ok(
        `and the spec calls it todo or partial, not ${match.status}`,
        match.status === "todo" || match.status === "partial",
      );
    }
  }
}

describe("nothing the spec is missing falls off the plan");
{
  const scheduled = sprints.map((s) => s.item);
  for (const r of spec.filter((x) => x.status === "todo")) {
    const times = scheduled.filter((i) => i === r.item).length;
    eq(`${r.section}: "${r.item}" is scheduled once`, times, 1);
  }
  // A partial is already usable, so scheduling it is a choice — but it must
  // not be scheduled twice either.
  for (const r of spec.filter((x) => x.status === "partial")) {
    ok(
      `${r.section}: "${r.item}" is scheduled at most once`,
      scheduled.filter((i) => i === r.item).length <= 1,
    );
  }
}

describe("the sprints are worth doing separately");
{
  const bySprint = new Map<string, number>();
  for (const s of sprints) bySprint.set(s.sprint, (bySprint.get(s.sprint) ?? 0) + 1);
  for (const [name, count] of bySprint) {
    // One row can stand for a whole bucket of commands now — "Strings" is six
    // functions and a value type — so the useful bound is the upper one.
    ok(`${name} has something in it`, count >= 1, `${count} items`);
    ok(`${name} is not a dumping ground`, count <= 8, `${count} items`);
  }
  // The plan shrinks as sprints ship, so the useful invariant is not "several"
  // but "one for as long as anything is missing".
  const outstanding = spec.filter((r) => r.status === "todo").length;
  ok(
    "there is a sprint for as long as anything is missing",
    outstanding === 0 || bySprint.size >= 1,
    `${bySprint.size} sprints for ${outstanding} missing`,
  );
}

describe("what is left");
{
  const todo = spec.filter((r) => r.status === "todo").length;
  const partial = spec.filter((r) => r.status === "partial").length;
  const sizes = sprints.reduce(
    (acc, s) => ({ ...acc, [s.size]: (acc[s.size] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  console.log(
    `    ${todo} missing and ${partial} narrow, over ` +
      `${new Set(sprints.map((s) => s.sprint)).size} sprints ` +
      `(${sizes.S ?? 0} small, ${sizes.M ?? 0} medium, ${sizes.L ?? 0} large)`,
  );
  ok("and every one of them has a home", sprints.length >= todo);
}

reportIfMain(import.meta.url);

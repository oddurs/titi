import { readFileSync } from "node:fs";
import { describe, eq, ok, reportIfMain } from "./harness";
import { ALL_KEYS, ARROW_KEYS } from "../lib/calc/keys";
import { MENUS } from "../lib/calc/menus";

/**
 * Every action goes somewhere, and no two go to the same place.
 *
 * `press` and the menus both dispatch by name into one switch in the store.
 * That switch is not typed — a name with no case does nothing at all, quietly.
 * Two bugs shipped that way in one afternoon: a new `del:` case shadowed the
 * DEL key's own action, because the first matching case in a switch wins; and
 * three parameterised cases landed in a second switch that matched whole
 * action strings rather than verbs, so they never ran.
 *
 * So this reads the dispatcher's case labels out of the source and checks
 * every action the app can raise against them. It is a coarse tool — parsing
 * source with a regular expression usually is — but it is checking exactly the
 * thing that has no other check.
 */

const source = readFileSync("lib/calc/store.ts", "utf8");

/** The case labels of the one dispatcher switch. */
function dispatcherVerbs(): string[] {
  const start = source.indexOf("function runAction(action: string)");
  ok("the dispatcher is where it is expected", start > 0);
  const body = source.slice(start);
  const end = body.indexOf("\n  }\n");
  return [...body.slice(0, end).matchAll(/^      case "([^"]+)":/gm)].map((m) => m[1]);
}

const verbs = dispatcherVerbs();

describe("the dispatcher is one namespace");
ok("it answers to a good few verbs", verbs.length > 30, `${verbs.length}`);
{
  // The bug that shipped: two cases with the same label, the second dead.
  const seen = new Set<string>();
  const twice = verbs.filter((v) => (seen.has(v) ? true : (seen.add(v), false)));
  eq("no verb is claimed twice", twice, []);
}
{
  // The other bug: a case whose label carries its own argument can only ever
  // match by accident, since the switch is on the verb alone.
  eq("no case label contains a colon", verbs.filter((v) => v.includes(":")), []);
}

describe("every action the app can raise reaches a handler");
{
  const known = new Set(verbs);
  const raised = new Map<string, string>();
  const add = (action: string | undefined, where: string) => {
    if (action) raised.set(action, where);
  };

  for (const k of [...ALL_KEYS, ...ARROW_KEYS]) {
    add(k.act, `key ${k.id}`);
    add(k.act2, `key ${k.id} (2nd)`);
  }
  for (const [name, def] of Object.entries(MENUS)) {
    for (const tab of def.tabs) {
      for (const item of tab.items) add(item.action, `menu ${name}/${tab.name}`);
    }
  }

  ok("there are plenty to check", raised.size > 60, `${raised.size}`);
  for (const [action, where] of [...raised].sort()) {
    const verb = action.split(":")[0];
    ok(`${where}: ${action} is handled`, known.has(verb), `no case for "${verb}"`);
  }
}

describe("the dynamic actions too");
{
  // These are built from state rather than written in the menus, so they are
  // named here — the point being that a rename has to break something.
  const known = new Set(verbs);
  for (const action of [
    "prgm:exec:NAME", "prgm:edit:NAME", "prgm:new", "prgm:menu:LBL",
    "mat:edit:[A]", "rcl:A", "memdel:A", "goto:3", "plot:type:0:box",
    "plot:xlist:0", "plot:freq:0", "zoom:sto", "zoom:rcl", "draw:line",
    "calc:value", "stat:medmed", "screen:home", "menu:catalog", "angle:deg",
    "var:xmin", "contrast:up", "freq",
  ]) {
    ok(`${action} is handled`, known.has(action.split(":")[0]), action);
  }
}

reportIfMain(import.meta.url);

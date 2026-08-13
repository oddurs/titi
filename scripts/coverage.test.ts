import { readFileSync } from "node:fs";
import { describe, eq, ok, reportIfMain } from "./harness";
import { reachedVerbs, reachedCommands } from "../lib/calc/store";
import { DEVICE_COMMAND_NAMES } from "../lib/calc/instructions";

/**
 * Every branch of the dispatcher has to have been used by the time we get here.
 *
 * `actions.test.ts` checks that every action *resolves* to a case. That is a
 * weaker promise than it sounds: a case can resolve and still never run, and
 * seven of them never did — including ▸Frac and ▸Dec, which turned out to be
 * broken for the commonest way of reaching them. Nothing said so, because
 * nothing had asked.
 *
 * This must be imported last in `scripts/test.ts`, since it reads what the
 * suites before it happened to touch.
 */

const source = readFileSync("lib/calc/store.ts", "utf8");

/** The case labels of the dispatcher, in source order. */
function dispatcherVerbs(): string[] {
  const start = source.indexOf("function runAction(action: string)");
  const body = source.slice(start, source.indexOf("\n  return {", start));
  return [...new Set([...body.matchAll(/^      case "([^"]+)":/gm)].map((m) => m[1]))];
}

describe("every action the device can take is exercised somewhere");
{
  const verbs = dispatcherVerbs();
  ok("there are branches to check", verbs.length > 30, `${verbs.length}`);
  const cold = verbs.filter((v) => !reachedVerbs.has(v));
  eq("none of them are untouched", cold.sort(), []);
}

describe("and so is every instruction that acts on the device");
{
  const cold = DEVICE_COMMAND_NAMES.filter((n) => !reachedCommands.has(n));
  eq("none of them are untouched", cold.sort(), []);
}

describe("coverage");
{
  const verbs = dispatcherVerbs();
  console.log(
    `    ${reachedVerbs.size}/${verbs.length} dispatcher branches and ` +
      `${reachedCommands.size}/${DEVICE_COMMAND_NAMES.length} device instructions run`,
  );
}

reportIfMain(import.meta.url);

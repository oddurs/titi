import { describe, eq, ok, reportIfMain } from "./harness";
import { DEMOS, pressesFor, pressesIn } from "../lib/calc/demo";
import { keyById } from "../lib/calc/keys";
import { createCalcStore } from "../lib/calc/store";
import { renderPanel } from "./panel";

/**
 * The tours have to still work.
 *
 * A demo is the thing you run in front of someone, which is exactly when you
 * cannot afford it to have rotted. Each one is driven here through the same
 * store the browser drives, and the screen it ends on is rendered — so a
 * renamed key, a reordered menu or a screen that throws fails a test rather
 * than a demonstration.
 */

describe("every key a demo names is on the faceplate");
for (const demo of DEMOS) {
  for (const step of demo.steps) {
    for (const key of step.keys) {
      let ids: string[] = [];
      let threw = "";
      try {
        ids = pressesFor(key);
      } catch (e) {
        threw = (e as Error).message;
      }
      ok(`${demo.id}: "${key}" resolves`, ids.length > 0, threw);
      for (const id of ids) ok(`${demo.id}: ${id} is a key`, !!keyById(id));
    }
  }
}

describe("every demo says what it is doing");
for (const demo of DEMOS) {
  ok(`${demo.id} has a name`, demo.name.length > 2);
  ok(`${demo.id} has a blurb`, demo.blurb.length > 20);
  ok(`${demo.id} has steps`, demo.steps.length >= 3);
  ok(`${demo.id} captions every step`, demo.steps.every((s) => s.say.length > 5));
  ok(`${demo.id} presses something in every step`, demo.steps.every((s) => s.keys.length > 0));
}
{
  const ids = new Set(DEMOS.map((d) => d.id));
  eq("their ids are distinct", ids.size, DEMOS.length);
}

describe("every demo runs, and leaves something on the screen");
for (const demo of DEMOS) {
  const store = createCalcStore();
  let threw = "";
  try {
    for (const id of pressesIn(demo)) store.getState().press(id);
  } catch (e) {
    threw = (e as Error).message;
  }
  ok(`${demo.id} runs without throwing`, threw === "", threw);

  const panel = renderPanel(store.getState());
  // Every tour is meant to end on something worth looking at, and the graph
  // ones fill the field — so a demo that quietly ends on an empty screen is a
  // demo that has stopped demonstrating.
  ok(`${demo.id} ends with a lit panel`, panel.count() > 600, `${panel.count()} dots`);
}

describe("the tours end where they say they do");
{
  const ended = (id: string) => {
    const demo = DEMOS.find((d) => d.id === id)!;
    const store = createCalcStore();
    for (const key of pressesIn(demo)) store.getState().press(key);
    return store.getState();
  };

  eq("the rose ends in polar mode", ended("rose").modes.graphMode, "pol");
  eq("and on the graph", ended("rose").screen, "graph");

  const zero = ended("zero");
  eq("the zero tour marks a point", zero.marks.length, 1);
  eq("at the root", Math.round(zero.marks[0].x * 1e6) / 1e6, 2);

  const integral = ended("integral");
  eq("the integral tour shades a region", integral.marks[0]?.kind, "area");

  const stats = ended("stats");
  ok("the regression wrote into Y₁", stats.ys[0].expr.includes("X"), stats.ys[0].expr);
  ok("and switched the slot on", stats.ys[0].on);
  ok("with the plot on too", stats.plots[0].on);

  ok("the drawing tour drew something", ended("draw").drawings.length > 0);
  ok("the program tour drew a great deal", ended("program").drawings.length > 20);
}

reportIfMain(import.meta.url);

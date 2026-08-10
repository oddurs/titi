import { SAMPLE_PROGRAMS } from "../lib/math/program";
import { describe, eq, near, ok, reportIfMain } from "./harness";
import {
  defaultSave, deserialize, serialize, SCHEMA_VERSION,
} from "../lib/calc/persistence";

/**
 * Saved state has to survive shape changes and corruption. A field that fails
 * to validate is dropped on its own — losing someone's programs should not
 * also lose their window.
 */

describe("round trip");
{
  const save = defaultSave();
  save.win.xmin = -42;
  save.ys[0].expr = "X²";
  save.lists[0] = [1, 2, 3];
  const { state, fresh, rejected } = deserialize(serialize(save));
  ok("a save just written loads", !fresh);
  eq("with nothing rejected", rejected, []);
  near("the window survives", state.win.xmin, -42);
  eq("the functions survive", state.ys[0].expr, "X²");
  eq("the lists survive", state.lists[0], [1, 2, 3]);
}
{
  const raw = JSON.parse(serialize(defaultSave()));
  eq("the version is written", raw.v, SCHEMA_VERSION);
}
{
  const save = defaultSave();
  save.history = Array.from({ length: 100 }, (_, i) => ({
    id: i, input: String(i), output: String(i), isError: false,
  }));
  const { state } = deserialize(serialize(save));
  eq("history is capped", state.history.length, 30);
  eq("keeping the newest", state.history[29].input, "99");
}

describe("nothing saved");
{
  const { state, fresh } = deserialize(null);
  ok("starts fresh", fresh);
  eq("with the sample programs", state.programs.map((p) => p.name), SAMPLE_PROGRAMS.map((p) => p.name));
  eq("and an identity in [A]", state.mats["[A]"].m, [[1, 0], [0, 1]]);
}

describe("corrupt saves");
for (const [label, raw] of [
  ["not json", "{oh no"],
  ["json but not an object", "[1,2,3]"],
  ["json null", "null"],
  ["empty string", ""],
] as const) {
  const { fresh } = deserialize(raw);
  ok(`${label} starts fresh instead of throwing`, fresh);
}

describe("one bad field does not take the rest");
{
  const good = JSON.parse(serialize(defaultSave()));
  good.win.xmin = -42;
  good.programs = "not an array";
  const { state, rejected } = deserialize(JSON.stringify(good));
  eq("the bad field is named", rejected, ["programs"]);
  near("the good ones are kept", state.win.xmin, -42);
  eq("and the bad one falls back", state.programs.length, SAMPLE_PROGRAMS.length);
}
{
  const bad = JSON.parse(serialize(defaultSave()));
  bad.ys = [{ expr: 5 }];
  bad.lists = [[1], ["two"], [], [], [], []];
  bad.mats = { "[A]": "nope" };
  const { state, rejected } = deserialize(JSON.stringify(bad));
  eq("each bad field is reported", rejected.sort(), ["lists", "mats", "ys"]);
  eq("functions reset", state.ys.length, 6);
  eq("lists reset", state.lists[0], []);
  ok("matrices reset", state.mats["[A]"] !== undefined);
}

describe("a save from before versioning");
{
  // The v1 shape: flat, no version, and no parameter or sequence window.
  const legacy = {
    ys: defaultSave().ys,
    win: { xmin: -5, xmax: 5, xscl: 1, ymin: -5, ymax: 5, yscl: 1, xres: 1 },
    modes: { angle: "deg", notation: "normal", decimals: -1, connected: true },
    lists: defaultSave().lists,
  };
  const { state, fresh } = deserialize(JSON.stringify(legacy));
  ok("loads", !fresh);
  near("keeping what it had", state.win.xmin, -5);
  eq("keeping its modes", state.modes.angle, "deg");
  // Regression: a v1 save has no tmin/nmin, and NaN bounds blank the graph.
  near("and gaining the parameter window", state.win.tmax, 2 * Math.PI);
  near("and the sequence window", state.win.nmin, 1);
  eq("and the graph mode it never had", state.modes.graphMode, "func");
}

describe("a save from a newer build");
{
  const future = JSON.parse(serialize(defaultSave()));
  future.v = SCHEMA_VERSION + 1;
  future.win.xmin = -999;
  const { state, fresh } = deserialize(JSON.stringify(future));
  ok("is not guessed at", fresh);
  near("so the defaults stand", state.win.xmin, -10);
}

describe("an empty program list is a choice, not a gap");
{
  const save = defaultSave();
  save.programs = [];
  const { state } = deserialize(serialize(save));
  eq("deleting every program sticks", state.programs, []);
  const noField = JSON.parse(serialize(defaultSave()));
  delete noField.programs;
  eq(
    "but a save that never had the field gets the samples",
    deserialize(JSON.stringify(noField)).state.programs.length,
    SAMPLE_PROGRAMS.length,
  );
}

reportIfMain(import.meta.url);

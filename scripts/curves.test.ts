import { describe, eq, near, ok, reportIfMain } from "./harness";
import { buildCurves, paramRange, paramVar, slotLabels } from "../lib/calc/curves";
import { makeEnv } from "../lib/math/eval";
import type { GraphWindow, Modes, YFunction } from "../lib/calc/types";

const win: GraphWindow = {
  xmin: -10, xmax: 10, xscl: 1, ymin: -10, ymax: 10, yscl: 1, xres: 1,
  tmin: 0, tmax: 2 * Math.PI, tstep: Math.PI / 48,
};

const slot = (expr: string, on = true): YFunction => ({
  id: expr, name: "Y", expr, on, color: 0, style: "line",
});

const modes = (graphMode: Modes["graphMode"]) => ({ graphMode });

describe("slot labelling");
eq("function slots", slotLabels("func").slice(0, 2), ["Y₁", "Y₂"]);
eq("polar slots", slotLabels("pol").slice(0, 2), ["r₁", "r₂"]);
eq("parametric slots pair up", slotLabels("par").slice(0, 4), ["X₁ₜ", "Y₁ₜ", "X₂ₜ", "Y₂ₜ"]);
eq("parameter variables", [paramVar("func"), paramVar("par"), paramVar("pol")], ["X", "T", "θ"]);

describe("function mode");
{
  const env = makeEnv();
  const cs = buildCurves([slot("X²"), slot(""), slot(""), slot(""), slot(""), slot("")], modes("func"), env);
  eq("one curve", cs.length, 1);
  ok("parameterised by x", cs[0].isFunction);
  near("at x = 3", cs[0].at(3).y, 9);
  near("x passes through", cs[0].at(3).x, 3);
}
{
  const env = makeEnv();
  const cs = buildCurves([slot("X", false), slot("2X")], modes("func"), env);
  eq("switched-off slots are skipped", cs.length, 1);
  near("the remaining curve is 2X", cs[0].at(4).y, 8);
}
{
  const env = makeEnv();
  const cs = buildCurves([slot("X+")], modes("func"), env);
  eq("unparseable slots are skipped", cs.length, 0);
}

describe("polar mode");
{
  const env = makeEnv();
  // r = 2 is a circle of radius 2
  const cs = buildCurves([slot("2")], modes("pol"), env);
  eq("one curve", cs.length, 1);
  ok("not parameterised by x", !cs[0].isFunction);
  near("θ = 0 lands on (2, 0)", cs[0].at(0).x, 2);
  near("θ = 0 has no height", cs[0].at(0).y, 0);
  near("θ = π/2 lands on (0, 2)", cs[0].at(Math.PI / 2).y, 2, 1e-12);
  near("radius is constant", Math.hypot(cs[0].at(1).x, cs[0].at(1).y), 2, 1e-12);
}
{
  const env = makeEnv({ angle: "deg" });
  const cs = buildCurves([slot("2")], modes("pol"), env);
  near("degree mode: θ = 90 lands on (0, 2)", cs[0].at(90).y, 2, 1e-12);
  near("degree mode: θ = 90 has no width", cs[0].at(90).x, 0, 1e-12);
}

describe("parametric mode");
{
  const env = makeEnv();
  // (cos T, sin T) is the unit circle
  const cs = buildCurves(
    [slot("cos(T"), slot("sin(T"), slot(""), slot(""), slot(""), slot("")],
    modes("par"),
    env,
  );
  eq("one curve from the pair", cs.length, 1);
  eq("labelled as a pair", cs[0].label, "X₁ₜ, Y₁ₜ");
  near("T = 0 is (1, 0)", cs[0].at(0).x, 1);
  near("T = π/2 is (0, 1)", cs[0].at(Math.PI / 2).y, 1, 1e-12);
  near("on the unit circle", Math.hypot(cs[0].at(2).x, cs[0].at(2).y), 1, 1e-12);
}
{
  const env = makeEnv();
  const cs = buildCurves([slot("cos(T"), slot("")], modes("par"), env);
  eq("a half-filled pair draws nothing", cs.length, 0);
}
{
  const env = makeEnv();
  const cs = buildCurves(
    [slot("T"), slot("T²"), slot("2T"), slot("T")],
    modes("par"),
    env,
  );
  eq("two pairs, two curves", cs.length, 2);
  eq("second curve starts at slot 2", cs[1].index, 2);
  near("second curve at T = 3", cs[1].at(3).x, 6);
}

describe("parameter ranges");
eq("function mode spans the x window", paramRange("func", win).min, -10);
eq("polar mode spans the parameter window", paramRange("pol", win).max, 2 * Math.PI);
near("parametric step follows Tstep", paramRange("par", win).step, Math.PI / 48);

reportIfMain(import.meta.url);

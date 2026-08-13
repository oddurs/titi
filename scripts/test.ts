/** Runs every suite in one process and reports a single total. */
import "./engine.test";
import "./matrix.test";
import "./program.test";
import "./stats.test";
import "./curves.test";
import "./glyphs.test";
import "./complex.test";
import "./solver.test";
import "./store.test";
import "./analysis.test";
import "./display.test";
import "./persistence.test";
import "./golden.test";
import "./pwa.test";
import "./actions.test";
import "./demo.test";
import "./manual.test";
import "./inventory.test";
import "./conformance.test";
import "./roadmap.test";
// Last, because it reads what everything above it happened to reach.
import "./coverage.test";
import { report } from "./harness";

report();

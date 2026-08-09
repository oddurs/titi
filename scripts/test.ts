/** Runs every suite in one process and reports a single total. */
import "./engine.test";
import "./matrix.test";
import "./program.test";
import "./stats.test";
import "./curves.test";
import "./glyphs.test";
import "./complex.test";
import "./solver.test";
import { report } from "./harness";

report();

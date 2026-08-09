"use client";

import { useEffect, useRef } from "react";
import MathText from "@/components/MathText";
import { useCalc } from "@/lib/calc/store";

/** PRGM EDIT — one line per row, with the shared edit buffer on the active one. */
export function ProgramEditor() {
  const lines = useCalc((s) => s.prgmLines);
  const name = useCalc((s) => s.prgmName);
  const entry = useCalc((s) => s.entry);
  const target = useCalc((s) => s.target);
  const active = target.kind === "prgm" ? target.line : -1;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div className="pane">
      <div className="prgm-title">
        <span className="row-label">prgm</span>
        <b>{name}</b>
        <span className="prgm-count">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>

      <div className="prgm-lines" ref={listRef}>
        {lines.map((line, i) => (
          <div className="prgm-line" key={i} data-active={i === active}>
            <span className="prgm-gutter">{i + 1}</span>
            <span className="prgm-colon">:</span>
            <span className="prgm-code">
              {i === active ? (
                <>
                  {entry.text}
                  <i className="caret" aria-hidden />
                </>
              ) : (
                line || <span className="placeholder">empty</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="mat-hint">
        <kbd>enter</kbd> opens a new line. <kbd>clear</kbd> on an empty line
        deletes it. <kbd>2nd</kbd> <kbd>mode</kbd> saves and leaves.
      </p>
    </div>
  );
}

/** PRGM EXEC — output as it accumulates, with a prompt when the program asks. */
export function ProgramRunner() {
  const run = useCalc((s) => s.prgmRun);
  const entry = useCalc((s) => s.entry);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [run?.output.length, run?.status]);

  if (!run) return null;

  return (
    <div className="pane-stack">
      <div className="tape">
        <div className="tape-inner">
          <div className="prgm-title">
            <span className="row-label">prgm</span>
            <b>{run.name}</b>
          </div>

          <div className="prgm-out">
            {run.output.map((line, i) => (
              <div className="prgm-out-line" key={i}>
                <MathText text={line} />
              </div>
            ))}
            {run.output.length === 0 && run.status !== "error" && (
              <p className="placeholder">no output yet</p>
            )}
          </div>

          {run.status === "error" && (
            <div className="prgm-error">{run.message}</div>
          )}
          {run.status === "done" && (
            <div className="prgm-done">Done — press enter</div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="entry-dock">
        <div className="entry-dock-inner">
          <span className="entry-prompt">
            {run.status === "input"
              ? run.prompt
              : run.status === "pause"
                ? "paused"
                : "▸"}
          </span>
          <div className="entry-scroll">
            {run.status === "input" ? (
              <MathText text={entry.text} caret={entry.caret} />
            ) : (
              <span className="placeholder">
                {run.status === "pause" ? "press enter to continue" : "press enter"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

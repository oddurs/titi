"use client";

import { useEffect, useRef } from "react";
import MathText, { AnswerText } from "@/components/MathText";
import { useCalc } from "@/lib/calc/store";

/**
 * The home screen is a tape: entries accumulate upward from an entry line
 * docked at the foot of the panel. The dock never scrolls away, so the caret
 * stays where you left it no matter how long the tape gets.
 */
const EXAMPLES: { expr: string; note: string }[] = [
  { expr: "2+2×√(9)", note: "order of operations" },
  { expr: "sin(π÷6)", note: "radians by default" },
  { expr: "fnInt(X²,X,0,3)", note: "definite integral" },
  { expr: "8!÷(3!5!)", note: "combinations" },
];

function QuickStart() {
  return (
    <div className="quickstart">
      <p className="quickstart-lede">
        Every key behaves like a TI‑84. Tap an example, or press <kbd>y=</kbd> to
        plot a function.
      </p>
      <ul className="quickstart-list">
        {EXAMPLES.map((e) => (
          <li key={e.expr}>
            <button
              onClick={() =>
                useCalc.setState({ entry: { text: e.expr, caret: e.expr.length } })
              }
            >
              <MathText text={e.expr} />
              <span className="quickstart-note">{e.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomeScreen() {
  const history = useCalc((s) => s.history);
  const entry = useCalc((s) => s.entry);
  const insertMode = useCalc((s) => s.insertMode);
  const report = useCalc((s) => s.statReport);
  const graphPrompt = useCalc((s) => s.graphPrompt);
  const tape = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tape.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, report]);

  return (
    <div className="pane-stack">
      <div className="tape" ref={tape}>
        <div className="tape-inner">
          {history.length === 0 && !report && <QuickStart />}

          {history.map((h) => (
            <div className="hist-row" key={h.id}>
              <div className="hist-in">
                <MathText text={h.input} />
              </div>
              <div className="hist-out" data-error={h.isError}>
                {h.isError ? h.output : <AnswerText value={h.output} />}
              </div>
            </div>
          ))}

          {report && (
            <div className="stat-report">
              <h3>{report.title}</h3>
              {report.rows.map((r) => (
                <div key={r.label} style={{ display: "contents" }}>
                  <span className="stat-key">{r.label}</span>
                  <span className="stat-val">
                    {r.value}
                    {r.hint && <span className="stat-hint">{r.hint}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="entry-dock">
        <div className="entry-dock-inner">
          <span className="entry-prompt">
            {graphPrompt?.op === "value" ? "x =" : "▸"}
          </span>
          <div className="entry-scroll">
            <MathText text={entry.text} caret={entry.caret} overwrite={!insertMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

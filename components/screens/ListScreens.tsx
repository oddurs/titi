"use client";

import MathText from "@/components/MathText";
import { evaluate } from "@/lib/math/eval";
import { formatNumber } from "@/lib/math/format";
import {
  MODE_ROWS,
  PLOT_COLORS,
  WINDOW_FIELDS,
  WINDOW_LABELS,
  useCalc,
} from "@/lib/calc/store";

const plain = { notation: "normal" as const, decimals: -1 };

/** Y= — six function slots, each with its own colour and on/off state. */
export function YEditor() {
  const ys = useCalc((s) => s.ys);
  const entry = useCalc((s) => s.entry);
  const insertMode = useCalc((s) => s.insertMode);
  const target = useCalc((s) => s.target);
  const active = target.kind === "yeq" ? target.row : -1;

  return (
    <div className="pane">
      <div className="rows">
        {ys.map((y, i) => (
          <div className="row" key={y.id} data-active={i === active}>
            <button
              className="y-toggle"
              data-on={y.on}
              style={{ ["--swatch" as string]: PLOT_COLORS[y.color % PLOT_COLORS.length] }}
              onClick={() =>
                useCalc.setState((s) => ({
                  ys: s.ys.map((f, j) => (j === i ? { ...f, on: !f.on } : f)),
                  revision: s.revision + 1,
                }))
              }
              aria-pressed={y.on}
              aria-label={`${y.name} ${y.on ? "shown" : "hidden"}`}
            >
              <span className="swatch" />
              {y.name}
            </button>

            <div className="row-value">
              {i === active ? (
                <MathText text={entry.text} caret={entry.caret} overwrite={!insertMode} />
              ) : y.expr ? (
                <MathText text={y.expr} />
              ) : (
                <span className="placeholder">empty</span>
              )}
            </div>

            <button
              className="y-toggle"
              data-on={y.style !== "line"}
              style={{ ["--swatch" as string]: PLOT_COLORS[y.color % PLOT_COLORS.length] }}
              onClick={() =>
                useCalc.setState((s) => ({
                  ys: s.ys.map((f, j) =>
                    j === i
                      ? {
                          ...f,
                          style:
                            f.style === "line" ? "thick" : f.style === "thick" ? "dot" : "line",
                        }
                      : f,
                  ),
                  revision: s.revision + 1,
                }))
              }
              aria-label={`${y.name} line style: ${y.style}`}
            >
              {y.style}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** WINDOW — the seven numbers that define the viewport. */
export function WindowEditor() {
  const win = useCalc((s) => s.win);
  const entry = useCalc((s) => s.entry);
  const insertMode = useCalc((s) => s.insertMode);
  const target = useCalc((s) => s.target);
  const active = target.kind === "window" ? target.row : -1;

  return (
    <div className="pane">
      <div className="rows">
        {WINDOW_FIELDS.map((f, i) => (
          <div className="row" key={f} data-active={i === active}>
            <span className="row-label">{WINDOW_LABELS[f]}</span>
            <div className="row-value">
              {i === active ? (
                <MathText text={entry.text} caret={entry.caret} overwrite={!insertMode} />
              ) : (
                <MathText text={formatNumber(win[f], plain)} />
              )}
            </div>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

/** TBLSET — where the table starts and how far it steps. */
export function TblSetEditor() {
  const tbl = useCalc((s) => s.tbl);
  const entry = useCalc((s) => s.entry);
  const target = useCalc((s) => s.target);
  const active = target.kind === "tblset" ? target.row : -1;
  const rows = [
    { label: "TblStart", value: tbl.start },
    { label: "ΔTbl", value: tbl.step },
  ];

  return (
    <div className="pane">
      <div className="rows">
        {rows.map((r, i) => (
          <div className="row" key={r.label} data-active={i === active}>
            <span className="row-label">{r.label}</span>
            <div className="row-value">
              {i === active ? (
                <MathText text={entry.text} caret={entry.caret} />
              ) : (
                <MathText text={formatNumber(r.value, plain)} />
              )}
            </div>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

/** MODE — one row per setting, arrows pick a value. */
export function ModeScreen() {
  const modes = useCalc((s) => s.modes);
  const row = useCalc((s) => s.row);

  return (
    <div className="pane">
      <div className="rows">
        {MODE_ROWS.map((m, i) => (
          <div className="mode-row" key={m.key} data-active={i === row}>
            {m.choices.map((c) => (
              <button
                key={String(c.value)}
                className="mode-choice"
                data-on={modes[m.key] === c.value}
                onClick={() =>
                  useCalc.setState((s) => ({
                    modes: { ...s.modes, [m.key]: c.value },
                    row: i,
                    revision: s.revision + 1,
                  }))
                }
              >
                {c.label}
              </button>
            ))}
            <span className="mode-hint">{m.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** TABLE — Y values sampled from TblStart in ΔTbl steps. */
export function TableScreen() {
  const tbl = useCalc((s) => s.tbl);
  const ys = useCalc((s) => s.ys);
  const row = useCalc((s) => s.row);
  const modes = useCalc((s) => s.modes);
  const env = useCalc((s) => s.env);
  useCalc((s) => s.revision);

  const shown = ys.filter((y) => y.expr.trim());
  const fmt = { notation: modes.notation, decimals: modes.decimals };
  const rows = Array.from({ length: 24 }, (_, i) => tbl.start + (row + i) * tbl.step);

  const evalAt = (expr: string, x: number): string => {
    try {
      const local = { ...env, lenient: true, vars: { ...env.vars, X: x } };
      const v = evaluate(expr, local);
      return typeof v === "number" && Number.isFinite(v) ? formatNumber(v, fmt) : "—";
    } catch {
      return "—";
    }
  };

  if (!shown.length) {
    return (
      <div className="pane">
        <p className="empty-note">
          No functions yet. Press <kbd>y=</kbd> and enter one, then come back with{" "}
          <kbd>2nd</kbd> <kbd>graph</kbd>.
        </p>
      </div>
    );
  }

  return (
    <div className="pane">
      <table className="table">
        <thead>
          <tr>
            <th>X</th>
            {shown.map((y) => (
              <th key={y.id} style={{ color: PLOT_COLORS[y.color % PLOT_COLORS.length] }}>
                {y.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={x} data-active={i === 0}>
              <td>{formatNumber(x, fmt)}</td>
              {shown.map((y) => {
                const v = evalAt(y.expr, x);
                return (
                  <td key={y.id} className={v === "—" ? "err" : undefined}>
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** STAT edit — six lists, entered column by column. */
export function StatEditor() {
  const lists = useCalc((s) => s.lists);
  const entry = useCalc((s) => s.entry);
  const target = useCalc((s) => s.target);
  const col = target.kind === "stat" ? target.col : 0;
  const row = target.kind === "stat" ? target.row : 0;
  const names = ["L₁", "L₂", "L₃", "L₄", "L₅", "L₆"];
  const depth = Math.max(6, ...lists.map((l) => l.length + 1));

  return (
    <div className="pane">
      <table className="table">
        <thead>
          <tr>
            <th />
            {names.map((n, c) => (
              <th key={n} style={{ color: c === col ? "var(--blue)" : undefined }}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: depth }, (_, r) => (
            <tr key={r}>
              <td>{r + 1}</td>
              {names.map((n, c) => (
                <td
                  key={n}
                  style={
                    c === col && r === row
                      ? { background: "rgba(90,169,255,0.14)", color: "var(--text)" }
                      : undefined
                  }
                >
                  {c === col && r === row
                    ? entry.text || "▮"
                    : lists[c][r] !== undefined
                      ? formatNumber(lists[c][r], plain)
                      : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

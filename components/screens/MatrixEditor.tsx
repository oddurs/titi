"use client";

import MathText from "@/components/MathText";
import { formatNumber } from "@/lib/math/format";
import { MATRIX_NAMES, useCalc } from "@/lib/calc/store";

const plain = { notation: "normal" as const, decimals: -1 };

/**
 * MATRIX EDIT — the dimension line sits above the grid at row −1, so the up
 * arrow walks off the top of the cells straight into it.
 */
export default function MatrixEditor() {
  const mats = useCalc((s) => s.mats);
  const entry = useCalc((s) => s.entry);
  const target = useCalc((s) => s.target);

  if (target.kind !== "matrix") return null;
  const { name, row, col } = target;
  const m = mats[name];

  const cell = (r: number, c: number) =>
    r === row && c === col ? (
      <span className="cell-live">{entry.text || "▮"}</span>
    ) : (
      formatNumber(m?.m[r]?.[c] ?? 0, plain)
    );

  return (
    <div className="pane">
      <div className="mat-head">
        <div className="mat-names">
          {MATRIX_NAMES.map((n) => (
            <button
              key={n}
              className="mat-name"
              data-on={n === name}
              data-filled={!!mats[n]}
              onClick={() =>
                useCalc.setState({ target: { kind: "matrix", name: n, row: 0, col: 0 } })
              }
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mat-dims" data-active={row < 0}>
          <span className="row-label">dim</span>
          <span className="mat-dim" data-on={row < 0 && col === 0}>
            {row < 0 && col === 0 ? entry.text || "▮" : (m?.r ?? 0)}
          </span>
          <span className="mat-times">×</span>
          <span className="mat-dim" data-on={row < 0 && col === 1}>
            {row < 0 && col === 1 ? entry.text || "▮" : (m?.c ?? 0)}
          </span>
        </div>
      </div>

      {m ? (
        <div className="mat-grid-wrap">
          <span className="mat-bracket" aria-hidden />
          <table className="mat-grid">
            <tbody>
              {Array.from({ length: m.r }, (_, r) => (
                <tr key={r}>
                  {Array.from({ length: m.c }, (_, c) => (
                    <td key={c} data-on={r === row && c === col}>
                      {cell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <span className="mat-bracket" data-side="right" aria-hidden />
        </div>
      ) : (
        <p className="empty-note">
          {name} is empty. Set its dimensions above, then type the entries.
        </p>
      )}

      <p className="mat-hint">
        <MathText text={name} /> is usable in any expression —{" "}
        <MathText text={`det(${name})`} />, <MathText text={`${name}⁻¹`} />,{" "}
        <MathText text={`${name}ᵀ`} />.
      </p>
    </div>
  );
}

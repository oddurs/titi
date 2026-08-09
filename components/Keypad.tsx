"use client";

import { useCallback, useEffect, useState } from "react";
import { ARROW_KEYS, KEY_ROWS, KEYBOARD_MAP, type KeyDef } from "@/lib/calc/keys";
import { useCalc } from "@/lib/calc/store";

export default function Keypad() {
  const mod = useCalc((s) => s.mod);
  const press = useCalc((s) => s.press);
  const typeText = useCalc((s) => s.typeText);
  const [flash, setFlash] = useState<string | null>(null);

  const hit = useCallback(
    (id: string) => {
      press(id);
      setFlash(id);
      window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 110);
    },
    [press],
  );

  // Physical keyboard: digits and operators type straight through, letters
  // insert variables, and the named keys map onto their device equivalents.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

      const mapped = KEYBOARD_MAP[e.key];
      if (mapped) {
        e.preventDefault();
        hit(mapped === "quit" ? "mode" : mapped);
        if (mapped === "quit") hit("mode");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        useCalc.setState({ menu: null, mod: "none" });
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        typeText(e.key.toUpperCase());
        return;
      }
      if (e.key === "=") {
        e.preventDefault();
        hit("enter");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hit, typeText]);

  return (
    <div className="keypad" data-mod={mod} role="group" aria-label="Calculator keypad">
      {KEY_ROWS.map((row, r) =>
        row.map((k, c) =>
          k ? (
            <Key
              key={k.id}
              k={k}
              mod={mod}
              pressed={flash === k.id}
              onHit={hit}
              row={r + 1}
              col={c + 1}
            />
          ) : null,
        ),
      )}

      <div className="arrows">
        <div className="arrow-ring">
          <span className="arrow-hub" aria-hidden />
          {ARROW_KEYS.map((a) => (
            <button
              key={a.id}
              className="arrow"
              data-dir={a.id}
              data-pressed={flash === a.id}
              onPointerDown={(e) => {
                e.preventDefault();
                hit(a.id);
              }}
              aria-label={a.id}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Key({
  k,
  mod,
  pressed,
  onHit,
  row,
  col,
}: {
  k: KeyDef;
  mod: string;
  pressed: boolean;
  onHit: (id: string) => void;
  row: number;
  col: number;
}) {
  const armed =
    (k.role === "mod2nd" && mod === "2nd") ||
    (k.role === "modalpha" && (mod === "alpha" || mod === "alpha-lock"));

  // Announce what the key will actually do in the current modifier state.
  const effective =
    mod === "2nd" && k.second
      ? k.second
      : (mod === "alpha" || mod === "alpha-lock") && k.alpha
        ? k.alpha
        : k.label;

  return (
    <button
      className="key"
      data-role={k.role}
      data-pressed={pressed}
      data-armed={armed}
      data-inert={
        !armed &&
        k.role !== "mod2nd" &&
        k.role !== "modalpha" &&
        ((mod === "2nd" && !k.second) ||
          ((mod === "alpha" || mod === "alpha-lock") && !k.alpha))
      }
      style={{ gridRow: row, gridColumn: col }}
      onPointerDown={(e) => {
        e.preventDefault();
        onHit(k.id);
      }}
      aria-label={effective}
    >
      <span className="key-sheen" aria-hidden />
      {k.second && <span className="key-sub key-2nd">{k.second}</span>}
      {k.alpha && <span className="key-sub key-alpha">{k.alpha}</span>}
      <span className="key-face">{k.label}</span>
    </button>
  );
}

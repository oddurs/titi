"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARROW_KEYS, KEY_ROWS, KEYBOARD_MAP, NAV, stepFocus, type KeyDef,
} from "@/lib/calc/keys";
import { useCalc } from "@/lib/calc/store";

export default function Keypad() {
  const mod = useCalc((s) => s.mod);
  const press = useCalc((s) => s.press);
  const typeText = useCalc((s) => s.typeText);
  const [flash, setFlash] = useState<string | null>(null);
  const [focused, setFocused] = useState<string>(NAV[0].id);
  const padRef = useRef<HTMLDivElement | null>(null);

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
      // While focus is inside the keypad, the keypad owns the keys that
      // operate a grid of buttons — arrows to move, Enter and Space to press.
      // Everywhere else they drive the calculator directly.
      const inPad = !!t && !!padRef.current?.contains(t);
      if (inPad && (e.key.startsWith("Arrow") || e.key === "Enter" || e.key === " ")) {
        return;
      }

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

  /** Arrows move focus; the browser handles Enter and Space on the button. */
  const onPadKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
    };
    const move = moves[e.key];
    const next = move
      ? stepFocus(focused, move[0], move[1])
      : e.key === "Home"
        ? NAV[0].id
        : e.key === "End"
          ? NAV[NAV.length - 1].id
          : null;
    if (!next) return;
    e.preventDefault();
    setFocused(next);
    padRef.current?.querySelector<HTMLButtonElement>(`[data-key="${next}"]`)?.focus();
  };

  return (
    <div
      className="keypad"
      data-mod={mod}
      role="group"
      aria-label="Calculator keypad"
      ref={padRef}
      onKeyDown={onPadKeyDown}
    >
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
              focused={focused === k.id}
              onFocused={setFocused}
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
              data-key={a.id}
              data-pressed={flash === a.id}
              tabIndex={focused === a.id ? 0 : -1}
              onFocus={() => setFocused(a.id)}
              onPointerDown={(e) => {
                e.preventDefault();
                hit(a.id);
              }}
              onClick={(e) => {
                if (e.detail === 0) hit(a.id);
              }}
              aria-label={mod === "2nd" && a.second ? a.second : a.id}
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
  focused,
  onFocused,
}: {
  k: KeyDef;
  mod: string;
  pressed: boolean;
  onHit: (id: string) => void;
  row: number;
  col: number;
  focused: boolean;
  onFocused: (id: string) => void;
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
      data-key={k.id}
      tabIndex={focused ? 0 : -1}
      onFocus={() => onFocused(k.id)}
      onPointerDown={(e) => {
        e.preventDefault();
        onHit(k.id);
      }}
      // A pointer press is handled on pointerdown; this is the keyboard path.
      onClick={(e) => {
        if (e.detail === 0) onHit(k.id);
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

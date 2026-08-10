"use client";

import { useEffect } from "react";
import Keypad from "./Keypad";
import Screen from "./Screen";
import { useCalc } from "@/lib/calc/store";

export default function Device() {
  const mod = useCalc((s) => s.mod);
  const modes = useCalc((s) => s.modes);
  const hydrate = useCalc((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Keep the whole calculator on the device. Only in a real build — in dev the
  // worker would cache chunks that hot reload is about to replace.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      /* an unavailable worker just means the app needs the network */
    });
  }, []);

  return (
    <main className="stage">
      <div className="device">
        <span className="grain" aria-hidden />

        <header className="brand">
          <div className="wordmark">
            titi<small>graphing system</small>
          </div>
          <div className="status-rail">
            <span
              className="chip"
              data-on={mod === "2nd"}
              style={{ ["--chip-color" as string]: "var(--blue)" }}
            >
              2nd
            </span>
            <span
              className="chip"
              data-on={mod === "alpha" || mod === "alpha-lock"}
              style={{ ["--chip-color" as string]: "var(--green)" }}
            >
              {mod === "alpha-lock" ? "a‑lock" : "alpha"}
            </span>
            <span className="chip">{modes.angle}</span>
          </div>
        </header>

        <div className="seam" aria-hidden />

        <div className="device-body">
          <Screen />
          <Keypad />
        </div>
      </div>
    </main>
  );
}

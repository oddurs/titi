"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMOS, pressesFor, type Demo } from "@/lib/calc/demo";
import { useCalc } from "@/lib/calc/store";

/**
 * A guided tour of the device, for showing it to someone.
 *
 * Hidden unless asked for — add #demo to the address — because it is a tool
 * for the person who built the thing, not part of the thing. It lives on the
 * shell rather than inside the glass, for the same reason every other control
 * does: the panel has no DOM, and a DEMO key would be a lie on the faceplate.
 *
 * It drives the real store through the real `press`, one key at a time, so a
 * tour that still runs is a feature that still works.
 */

/** How long each key is held down, and how long a caption sits before moving. */
const PER_KEY = 130;
const PER_STEP = 950;

export default function DemoBar() {
  const [armed, setArmed] = useState(false);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const cancelled = useRef(false);

  // Only appear when asked for, and keep appearing if the hash is edited.
  useEffect(() => {
    const read = () => setArmed(window.location.hash.toLowerCase() === "#demo");
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    setDemo(null);
    setStepIndex(0);
  }, []);

  const run = useCallback(async (chosen: Demo) => {
    cancelled.current = true;
    // Let any run in flight notice before starting another.
    await new Promise((r) => setTimeout(r, PER_KEY));
    cancelled.current = false;

    const press = useCalc.getState().press;
    // Start from a device nobody has touched, so a tour is repeatable.
    useCalc.getState().press("on");
    setDemo(chosen);

    for (let i = 0; i < chosen.steps.length; i++) {
      if (cancelled.current) return;
      setStepIndex(i);
      const step = chosen.steps[i];
      for (const key of step.keys) {
        for (const id of pressesFor(key)) {
          if (cancelled.current) return;
          press(id);
          await new Promise((r) => setTimeout(r, PER_KEY));
        }
      }
      await new Promise((r) => setTimeout(r, step.hold ?? PER_STEP));
    }
    if (!cancelled.current) setDemo(null);
  }, []);

  useEffect(() => () => { cancelled.current = true; }, []);

  if (!armed) return null;

  const step = demo?.steps[stepIndex];

  return (
    <aside className="demo" aria-label="Demo runner">
      <div className="demo-row">
        <span className="demo-tag">demo</span>
        {DEMOS.map((d) => (
          <button
            key={d.id}
            className="demo-pick"
            data-running={demo?.id === d.id}
            onClick={() => run(d)}
            title={d.blurb}
          >
            {d.name}
          </button>
        ))}
        <button className="demo-stop" onClick={stop} disabled={!demo}>
          Stop
        </button>
      </div>

      {/* The caption is the point: it says what is being pressed and why. */}
      <p className="demo-say" role="status">
        {demo && step ? (
          <>
            <span className="demo-count">
              {stepIndex + 1}/{demo.steps.length}
            </span>
            {step.say}
          </>
        ) : (
          <span className="demo-idle">
            Pick a tour. It drives the keypad for real — press any key to take over.
          </span>
        )}
      </p>
    </aside>
  );
}

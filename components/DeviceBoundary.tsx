"use client";

import { Component, type ReactNode } from "react";

import { STORAGE_KEY } from "@/lib/calc/persistence";

/**
 * The outer net.
 *
 * The panel catches a bad frame and draws the fault on the glass, which keeps
 * the device usable. This is for everything else — a failure in the keypad or
 * the shell, where there is no glass left to draw on.
 */
export default class DeviceBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  private reset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
    window.location.reload();
  };

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <main className="stage">
        <div className="fault" role="alert">
          <p className="fault-label">The calculator stopped</p>
          <p className="fault-message">{this.state.message}</p>
          <button className="fault-action" onClick={this.reset}>
            Clear saved state and restart
          </button>
        </div>
      </main>
    );
  }
}

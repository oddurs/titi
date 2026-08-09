"use client";

import HomeScreen from "./screens/HomeScreen";
import {
  ModeScreen,
  StatEditor,
  TableScreen,
  TblSetEditor,
  WindowEditor,
  YEditor,
} from "./screens/ListScreens";
import MenuOverlay from "./MenuOverlay";
import Plot from "./Plot";
import { useCalc } from "@/lib/calc/store";

const TITLES: Record<string, string> = {
  home: "home",
  graph: "graph",
  yeq: "function editor",
  window: "window",
  table: "table",
  tblset: "table setup",
  mode: "mode",
  stat: "list editor",
  format: "format",
};

export default function Screen() {
  const screen = useCalc((s) => s.screen);
  const modes = useCalc((s) => s.modes);
  const message = useCalc((s) => s.message);
  const menu = useCalc((s) => s.menu);
  const trace = useCalc((s) => s.trace);
  const insertMode = useCalc((s) => s.insertMode);

  const isError = message?.startsWith("ERR");

  return (
    <div className="bezel">
      <div className="screen">
        <span className="glass" aria-hidden />

        <div className="screen-head">
          <b>{TITLES[screen] ?? screen}</b>
          <span style={{ display: "flex", gap: 10 }}>
            {screen === "graph" && trace && <span style={{ color: "var(--amber)" }}>trace</span>}
            {!insertMode && <span>overwrite</span>}
            <span>{modes.angle === "rad" ? "rad" : "deg"}</span>
            <span>{modes.notation}</span>
            <span>{modes.decimals < 0 ? "float" : `fix ${modes.decimals}`}</span>
          </span>
        </div>

        <div className="screen-body">
          {screen === "home" && <HomeScreen />}
          {screen === "graph" && <Plot />}
          {screen === "yeq" && <YEditor />}
          {screen === "window" && <WindowEditor />}
          {screen === "tblset" && <TblSetEditor />}
          {screen === "table" && <TableScreen />}
          {screen === "mode" && <ModeScreen />}
          {screen === "stat" && <StatEditor />}
          {screen === "format" && <ModeScreen />}

          {message && (
            <div className="graph-toast" data-error={isError}>
              {message}
            </div>
          )}

          {menu && <MenuOverlay />}
        </div>
      </div>
    </div>
  );
}

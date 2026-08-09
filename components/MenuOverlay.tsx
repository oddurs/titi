"use client";

import { useEffect, useRef } from "react";
import { useCalc } from "@/lib/calc/store";

export default function MenuOverlay() {
  const menu = useCalc((s) => s.menu);
  const press = useCalc((s) => s.press);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-on="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [menu?.index, menu?.tab]);

  if (!menu) return null;
  const items = menu.tabs[menu.tab].items;

  return (
    <div className="menu-scrim" role="dialog" aria-label={menu.title}>
      <div className="menu-tabs">
        {menu.tabs.map((t, i) => (
          <button
            key={t.name}
            className="menu-tab"
            data-on={i === menu.tab}
            onClick={() => useCalc.setState({ menu: { ...menu, tab: i, index: 0 } })}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="menu-list" ref={listRef}>
        {items.map((item, i) => (
          <button
            key={item.label}
            className="menu-item"
            data-on={i === menu.index}
            onClick={() => {
              useCalc.setState({ menu: { ...menu, index: i } });
              press("enter");
            }}
          >
            <span className="menu-index">{i + 1}</span>
            <span className="menu-label">{item.label}</span>
            <span className="menu-hint">{item.hint ?? ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

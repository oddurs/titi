import { createCalcStore } from "../lib/calc/store";
import type { CalcState } from "../lib/calc/store";
import { ALL_KEYS, ARROW_KEYS } from "../lib/calc/keys";

/**
 * A device you can drive from a test.
 *
 * The store runs without a DOM, so a case is just: build one, press keys,
 * assert state. Keys are addressed by the label printed on them, which keeps
 * a test readable as the sequence a person would actually perform.
 */

const BY_LABEL = new Map<string, string>();
// Ids and face labels win; the blue and green labels fill in the rest, so
// "2nd ans" resolves the same way a person reading the faceplate would.
for (const k of [...ALL_KEYS, ...ARROW_KEYS]) BY_LABEL.set(k.id, k.id);
for (const k of [...ALL_KEYS, ...ARROW_KEYS]) {
  if (!BY_LABEL.has(k.label)) BY_LABEL.set(k.label, k.id);
}
for (const k of [...ALL_KEYS, ...ARROW_KEYS]) {
  if (k.second && !BY_LABEL.has(k.second)) BY_LABEL.set(k.second, k.id);
  if (k.alpha && !BY_LABEL.has(k.alpha)) BY_LABEL.set(k.alpha, k.id);
}
// Friendlier aliases for keys whose printed label is awkward to type.
for (const [alias, id] of [
  ["-", "neg"], ["(-)", "neg"], ["*", "mul"], ["/", "div"],
  ["up", "up"], ["down", "down"], ["left", "left"], ["right", "right"],
  ["0", "d0"], ["1", "d1"], ["2", "d2"], ["3", "d3"], ["4", "d4"],
  ["5", "d5"], ["6", "d6"], ["7", "d7"], ["8", "d8"], ["9", "d9"],
] as const) {
  BY_LABEL.set(alias, id);
}

export interface Device {
  get(): CalcState;
  /**
   * Press keys in order, by label or id. Prefix with `2nd ` or `alpha ` to
   * arm that modifier first.
   */
  press(...keys: string[]): Device;
  /** Press a key n times. */
  repeat(key: string, n: number): Device;
  /** Type a run of digits and operators, e.g. "7/8" or "2^10". */
  type(text: string): Device;
  /**
   * Pick an item out of the open menu by the label printed on it, walking
   * there with the arrows the way a person would. Addressing by label rather
   * than by how many times to press down means adding a menu item does not
   * quietly re-point every test that walks past it.
   */
  choose(label: string): Device;
  /** The current entry line. */
  entry(): string;
  /** The last answer on the tape. */
  answer(): string | undefined;
  /** Every line of the tape, as "input = output". */
  tape(): string[];
}

const TYPE_MAP: Record<string, string[]> = {
  "0": ["d0"], "1": ["d1"], "2": ["d2"], "3": ["d3"], "4": ["d4"],
  "5": ["d5"], "6": ["d6"], "7": ["d7"], "8": ["d8"], "9": ["d9"],
  ".": ["dot"], "+": ["add"], "-": ["sub"], "*": ["mul"], "/": ["div"],
  "^": ["pow"], "(": ["lparen"], ")": ["rparen"], ",": ["comma"],
  X: ["xtn"], "=": ["enter"],
};

export function device(): Device {
  const store = createCalcStore();

  const hit = (key: string) => {
    // "2nd x" and "alpha x" arm the modifier first, the way a person would.
    for (const mod of ["2nd", "alpha"]) {
      if (key.startsWith(`${mod} `)) {
        store.getState().press(mod);
        hit(key.slice(mod.length + 1));
        return;
      }
    }
    const id = BY_LABEL.get(key);
    if (!id) throw new Error(`no key labelled ${JSON.stringify(key)}`);
    store.getState().press(id);
  };

  const d: Device = {
    get: () => store.getState(),
    press(...keys) {
      for (const k of keys) hit(k);
      return d;
    },
    choose(label) {
      const m = store.getState().menu;
      if (!m) throw new Error(`no menu is open to choose ${JSON.stringify(label)} from`);
      const same = (a: string) => a.replace(/‑/g, "-") === label.replace(/‑/g, "-");
      const tab = m.tabs.findIndex((t) => t.items.some((i) => same(i.label)));
      if (tab < 0) throw new Error(`no menu item labelled ${JSON.stringify(label)}`);
      for (let k = (tab - m.tab + m.tabs.length) % m.tabs.length; k > 0; k--) hit("right");
      const items = store.getState().menu!.tabs[tab].items;
      const index = items.findIndex((i) => same(i.label));
      const from = store.getState().menu!.index;
      for (let k = (index - from + items.length) % items.length; k > 0; k--) hit("down");
      hit("enter");
      return d;
    },
    repeat(key, n) {
      for (let i = 0; i < n; i++) hit(key);
      return d;
    },
    type(text) {
      for (const ch of text) {
        const ids = TYPE_MAP[ch];
        if (!ids) throw new Error(`cannot type ${JSON.stringify(ch)}`);
        for (const id of ids) store.getState().press(id);
      }
      return d;
    },
    entry: () => store.getState().entry.text,
    answer: () => {
      const h = store.getState().history;
      return h[h.length - 1]?.output;
    },
    tape: () =>
      store.getState().history.map((h) => `${h.input} = ${h.output}`),
  };

  return d;
}

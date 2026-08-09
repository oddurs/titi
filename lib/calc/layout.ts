import type { Modes } from "./types";

/**
 * Screen layout descriptions — which fields a screen shows and what they are
 * called. Kept out of the store so the display layer can read them without
 * pulling in zustand.
 */

export const WINDOW_FIELDS = [
  "tmin", "tmax", "tstep",
  "xmin", "xmax", "xscl", "ymin", "ymax", "yscl", "xres",
] as const;

/** The parameter bounds only exist in parametric and polar modes. */
export const visibleWindowFields = (mode: Modes["graphMode"]) =>
  mode === "func" ? WINDOW_FIELDS.slice(3) : WINDOW_FIELDS;
export type WindowField = (typeof WINDOW_FIELDS)[number];

export const WINDOW_LABELS: Record<WindowField, string> = {
  xmin: "Xmin", xmax: "Xmax", xscl: "Xscl",
  ymin: "Ymin", ymax: "Ymax", yscl: "Yscl", xres: "Xres",
  tmin: "Tmin", tmax: "Tmax", tstep: "Tstep",
};

/** Polar mode calls the same three fields θ rather than T. */
export const windowLabel = (
  field: WindowField,
  mode: Modes["graphMode"],
): string =>
  mode === "pol" && field.startsWith("t")
    ? WINDOW_LABELS[field].replace("T", "θ")
    : WINDOW_LABELS[field];

export interface ModeOption {
  key: keyof Modes;
  choices: { value: Modes[keyof Modes]; label: string }[];
  hint: string;
}

export const MODE_ROWS: ModeOption[] = [
  {
    key: "graphMode",
    hint: "what the Y= slots mean",
    choices: [
      { value: "func", label: "Func" },
      { value: "par", label: "Parametric" },
      { value: "pol", label: "Polar" },
    ],
  },
  {
    key: "notation",
    hint: "how answers are written",
    choices: [
      { value: "normal", label: "Normal" },
      { value: "sci", label: "Sci" },
      { value: "eng", label: "Eng" },
    ],
  },
  {
    key: "decimals",
    hint: "digits after the point",
    choices: [
      { value: -1, label: "Float" },
      ...Array.from({ length: 10 }, (_, i) => ({ value: i, label: String(i) })),
    ],
  },
  {
    key: "angle",
    hint: "unit for trigonometry",
    choices: [
      { value: "rad", label: "Radian" },
      { value: "deg", label: "Degree" },
    ],
  },
  {
    key: "connected",
    hint: "curve drawing",
    choices: [
      { value: true, label: "Connected" },
      { value: false, label: "Dot" },
    ],
  },
  {
    key: "grid",
    hint: "background rulings",
    choices: [
      { value: true, label: "Grid on" },
      { value: false, label: "Grid off" },
    ],
  },
  {
    key: "labelAxes",
    hint: "x and y captions",
    choices: [
      { value: true, label: "Labels on" },
      { value: false, label: "Labels off" },
    ],
  },
  {
    key: "coordsOn",
    hint: "readout under the cursor",
    choices: [
      { value: true, label: "Coords on" },
      { value: false, label: "Coords off" },
    ],
  },
];

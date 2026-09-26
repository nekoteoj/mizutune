import { createEffect, createStore, deep } from "solid-js";

export type Mode = "chromatic" | "guitar" | "ukulele";

export type Tuning = {
  id: string;
  label: string;
  mode: "guitar" | "ukulele";
  strings: { name: string; midi: number }[];
};

export type Settings = {
  a4: number;
  mode: Mode;
  tuningId: string;
};

export const SETTINGS_KEY = "mizutune.settings";

export const TUNINGS: readonly Tuning[] = [
  {
    id: "standard",
    label: "Standard",
    mode: "guitar",
    strings: [
      { name: "E2", midi: 40 },
      { name: "A2", midi: 45 },
      { name: "D3", midi: 50 },
      { name: "G3", midi: 55 },
      { name: "B3", midi: 59 },
      { name: "E4", midi: 64 },
    ],
  },
  {
    id: "half-down",
    label: "½-step down",
    mode: "guitar",
    strings: [
      { name: "Eb2", midi: 39 },
      { name: "Ab2", midi: 44 },
      { name: "Db3", midi: 49 },
      { name: "Gb3", midi: 54 },
      { name: "Bb3", midi: 58 },
      { name: "Eb4", midi: 63 },
    ],
  },
  {
    id: "drop-d",
    label: "Drop D",
    mode: "guitar",
    strings: [
      { name: "D2", midi: 38 },
      { name: "A2", midi: 45 },
      { name: "D3", midi: 50 },
      { name: "G3", midi: 55 },
      { name: "B3", midi: 59 },
      { name: "E4", midi: 64 },
    ],
  },
  {
    id: "gcea",
    label: "GCEA",
    mode: "ukulele",
    strings: [
      { name: "G4", midi: 67 },
      { name: "C4", midi: 60 },
      { name: "E4", midi: 64 },
      { name: "A4", midi: 69 },
    ],
  },
];

const DEFAULT_SETTINGS: Settings = {
  a4: 440,
  mode: "guitar",
  tuningId: "standard",
};

const MODES: readonly Mode[] = ["chromatic", "guitar", "ukulele"];

function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

export function clampA4(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.a4;
  return Math.min(450, Math.max(430, Math.round(n)));
}

export function tuningsFor(mode: Mode) {
  if (mode === "chromatic") return [];
  return TUNINGS.filter((t) => t.mode === mode);
}

function defaultTuning(mode: Exclude<Mode, "chromatic">) {
  return TUNINGS.find((t) => t.mode === mode)?.id ?? "standard";
}

function tuningIdFor(mode: Mode, stored: string) {
  if (mode === "chromatic") {
    return TUNINGS.some((t) => t.id === stored) ? stored : DEFAULT_SETTINGS.tuningId;
  }
  return TUNINGS.some((t) => t.id === stored && t.mode === mode) ? stored : defaultTuning(mode);
}

export function parseSettings(value: unknown): Settings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const mode = isMode(raw.mode) ? raw.mode : DEFAULT_SETTINGS.mode;
  const a4 = clampA4(typeof raw.a4 === "number" ? raw.a4 : DEFAULT_SETTINGS.a4);
  const stored = typeof raw.tuningId === "string" ? raw.tuningId : DEFAULT_SETTINGS.tuningId;
  return { a4, mode, tuningId: tuningIdFor(mode, stored) };
}

export function applyMode(settings: Settings, mode: Mode): Settings {
  if (mode === "chromatic") return { ...settings, mode };
  const ok = TUNINGS.some((t) => t.id === settings.tuningId && t.mode === mode);
  return { ...settings, mode, tuningId: ok ? settings.tuningId : defaultTuning(mode) };
}

export function applyTuning(settings: Settings, tuningId: string): Settings {
  if (settings.mode === "chromatic") return settings;
  const t = TUNINGS.find((x) => x.id === tuningId);
  if (!t || t.mode !== settings.mode) return settings;
  return { ...settings, tuningId };
}

type Bucket = Pick<Storage, "getItem" | "setItem">;

function safeStorage(): Bucket | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadSettings(storage: Bucket | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return parseSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function createSettings(storage: Bucket | null = safeStorage()) {
  const [state, setState] = createStore(loadSettings(storage));

  createEffect(
    () => deep(state),
    (value) => {
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify(value));
      } catch {
        // ponytail: private mode / quota — in-memory for this session only
      }
    },
  );

  return {
    state,
    setA4(n: number) {
      const a4 = clampA4(n);
      setState((d) => {
        d.a4 = a4;
      });
    },
    setMode(mode: string) {
      if (!isMode(mode)) return;
      setState((d) => {
        const next = applyMode(d, mode);
        d.mode = next.mode;
        d.tuningId = next.tuningId;
      });
    },
    setTuning(id: string) {
      setState((d) => {
        d.tuningId = applyTuning(d, id).tuningId;
      });
    },
  };
}

import { createEffect, createSignal } from "solid-js";
import { TUNINGS, type Settings } from "./settings";

export const IN_TUNE_CENTS = 5;
// ponytail: confident YIN dip (d' ≤ 0.2). Lower if a real guitar blanks.
export const CLARITY_MIN = 0.8;
// Matches the WASM rms gate in audio/session.ts.
export const RMS_GATE = 0.01;
export const SMOOTH_ALPHA = 0.25;

const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"] as const;

export type PitchFrame = { hz: number; clarity: number; rms: number };

export type RawReading = {
  key: string;
  note: string;
  octave: number;
  midi: number;
  cents: number;
  flats: boolean;
};

export type Smooth = { key: string; cents: number };

export type TunerView = {
  live: boolean;
  inTune: boolean;
  note: string;
  octave: number;
  midi: number;
  cents: number;
  flats: boolean;
};

export const IDLE_TUNER: TunerView = {
  live: false,
  inTune: false,
  note: "",
  octave: 0,
  midi: 0,
  cents: 0,
  flats: false,
};

export function spell(midi: number, flats: boolean) {
  const n = ((midi % 12) + 12) % 12;
  const name = (flats ? FLAT : SHARP)[n];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, label: `${name}${octave}` };
}

function stringsFor(mode: Settings["mode"], tuningId: string) {
  if (mode === "chromatic") return null;
  return (
    TUNINGS.find((t) => t.id === tuningId && t.mode === mode) ?? TUNINGS.find((t) => t.mode === mode)
  )?.strings;
}

export function mapPitch(frame: PitchFrame, settings: Settings): RawReading | null {
  const a4 = settings.a4;
  const mode = settings.mode;
  const tuningId = settings.tuningId;
  if (!(frame.hz > 0) || !(frame.clarity >= CLARITY_MIN) || !(frame.rms >= RMS_GATE)) return null;
  if (!(a4 > 0)) return null;
  const midi = 69 + 12 * Math.log2(frame.hz / a4);
  if (!Number.isFinite(midi)) return null;

  if (mode === "chromatic") {
    const target = Math.round(midi);
    const named = spell(target, false);
    return {
      key: String(target),
      note: named.name,
      octave: named.octave,
      midi: target,
      cents: 100 * (midi - target),
      flats: false,
    };
  }

  const strings = stringsFor(mode, tuningId);
  if (!strings || strings.length === 0) return null;
  let best = strings[0];
  let bestAbs = Math.abs(midi - best.midi);
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i];
    const abs = Math.abs(midi - s.midi);
    if (abs < bestAbs) {
      best = s;
      bestAbs = abs;
    }
  }
  const flats = best.name.includes("b") || best.name.includes("♭");
  const named = spell(best.midi, flats);
  return {
    key: String(best.midi),
    note: named.name,
    octave: named.octave,
    midi: best.midi,
    cents: 100 * (midi - best.midi),
    flats,
  };
}

export function stepSmooth(prev: Smooth | null, raw: RawReading | null, alpha = SMOOTH_ALPHA): Smooth | null {
  if (!raw) return null;
  if (!prev || prev.key !== raw.key) return { key: raw.key, cents: raw.cents };
  return { key: raw.key, cents: prev.cents + alpha * (raw.cents - prev.cents) };
}

export function createTuner(source: { pitch: () => PitchFrame; settings: Settings }) {
  const [view, setView] = createSignal<TunerView>(IDLE_TUNER);
  let smooth: Smooth | null = null;

  createEffect(
    () => mapPitch(source.pitch(), source.settings),
    (raw) => {
      smooth = stepSmooth(smooth, raw);
      if (!raw || !smooth) {
        setView(IDLE_TUNER);
        return;
      }
      setView({
        live: true,
        inTune: Math.abs(smooth.cents) <= IN_TUNE_CENTS,
        note: raw.note,
        octave: raw.octave,
        midi: raw.midi,
        cents: smooth.cents,
        flats: raw.flats,
      });
    },
  );

  return view;
}

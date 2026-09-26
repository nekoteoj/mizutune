import { createEffect, createSignal } from "solid-js";
import { TUNINGS, type Settings } from "./settings";

export const IN_TUNE_CENTS = 5;
// Acquire. Phone B/E dips often land around 0.4–0.6 clarity. 0.8 was sine-only.
export const CLARITY_MIN = 0.4;
export const RMS_SHOW = 0.003;
// Same note, already showing. Also the WASM floor so a thin-string tail is not zeroed.
export const CLARITY_KEEP = 0.3;
export const RMS_GATE = 0.001;
export const SMOOTH_ALPHA = 0.25;
// ponytail: hop count, not a timer. 50 frames ≈ 1 s at the 20 ms hop.
export const HOLD_HOPS = 50;
// One rumble frame must not replace the note and then hang for a second.
export const SWITCH_FRAMES = 3;

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

export function mapPitch(frame: PitchFrame, settings: Settings, keep = false): RawReading | null {
  const a4 = settings.a4;
  const mode = settings.mode;
  const tuningId = settings.tuningId;
  const clarityMin = keep ? CLARITY_KEEP : CLARITY_MIN;
  const rmsMin = keep ? RMS_GATE : RMS_SHOW;
  if (!(frame.hz > 0) || !(frame.clarity >= clarityMin) || !(frame.rms >= rmsMin)) return null;
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

function reading(raw: RawReading, cents: number, fresh: boolean): TunerView {
  return {
    live: true,
    inTune: fresh && Math.abs(cents) <= IN_TUNE_CENTS,
    note: raw.note,
    octave: raw.octave,
    midi: raw.midi,
    cents,
    flats: raw.flats,
  };
}

export function createTuner(source: {
  pitch: () => PitchFrame;
  settings: Settings;
  power?: () => boolean;
}) {
  const [view, setView] = createSignal<TunerView>(IDLE_TUNER);
  let smooth: Smooth | null = null;
  let shown: RawReading | null = null;
  let hang = 0;
  let agreeKey = "";
  let agreeN = 0;

  createEffect(
    () => {
      const frame = source.pitch();
      return {
        on: source.power?.() ?? true,
        strict: mapPitch(frame, source.settings),
        weak: mapPitch(frame, source.settings, true),
      };
    },
    ({ on, strict, weak }) => {
      if (!on) {
        smooth = null;
        shown = null;
        hang = 0;
        agreeKey = "";
        agreeN = 0;
        setView(IDLE_TUNER);
        return;
      }
      let raw = strict ?? (shown && weak?.key === shown.key ? weak : null);
      if (strict && shown && strict.key !== shown.key) {
        if (strict.key === agreeKey) agreeN += 1;
        else {
          agreeKey = strict.key;
          agreeN = 1;
        }
        if (agreeN < SWITCH_FRAMES) raw = null;
        else {
          agreeKey = "";
          agreeN = 0;
        }
      } else {
        agreeKey = "";
        agreeN = 0;
      }
      if (raw) {
        const next = stepSmooth(smooth, raw);
        if (!next) {
          setView(IDLE_TUNER);
          return;
        }
        smooth = next;
        shown = raw;
        hang = HOLD_HOPS;
        setView(reading(raw, next.cents, strict != null));
        return;
      }
      if (hang > 0 && shown && smooth) {
        hang -= 1;
        setView(reading(shown, smooth.cents, false));
        return;
      }
      smooth = null;
      shown = null;
      hang = 0;
      setView(IDLE_TUNER);
    },
  );

  return view;
}

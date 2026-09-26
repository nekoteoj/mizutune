import { createRoot, createSignal, createStore, flush } from "solid-js";
import { expect, test } from "vitest";
import {
  CLARITY_MIN,
  HOLD_HOPS,
  IDLE_TUNER,
  IN_TUNE_CENTS,
  RMS_GATE,
  SMOOTH_ALPHA,
  createTuner,
  mapPitch,
  stepSmooth,
  type PitchFrame,
} from "./map";
import { TUNINGS, type Settings } from "./settings";

function hzOf(midi: number, a4 = 440, cents = 0) {
  return a4 * 2 ** ((midi - 69) / 12 + cents / 1200);
}

function frame(hz: number, clarity = 1, rms = 0.1): PitchFrame {
  return { hz, clarity, rms };
}

const chromatic: Settings = { a4: 440, mode: "chromatic", tuningId: "standard" };

test("chromatic nearest 12-TET follows A4", () => {
  for (const midi of [40, 45, 50, 55, 59, 64, 69]) {
    for (const a4 of [440, 432]) {
      const reading = mapPitch(frame(hzOf(midi, a4)), { ...chromatic, a4 });
      expect(reading?.midi).toBe(midi);
      expect(reading?.cents).toBeCloseTo(0, 5);
      expect(reading?.flats).toBe(false);
    }
  }
  const shifted = mapPitch(frame(440), { ...chromatic, a4: 432 });
  expect(shifted?.note).toBe("A");
  expect(shifted?.octave).toBe(4);
  expect(shifted?.cents).toBeCloseTo(1200 * Math.log2(440 / 432), 5);

  const half = mapPitch(frame(hzOf(69.5)), chromatic);
  expect(half?.midi).toBe(70);
  expect(half?.note).toBe("A♯");
  expect(half?.cents).toBeCloseTo(-50, 4);
  expect(mapPitch(frame(hzOf(61)), chromatic)?.note).toBe("C♯");
});

test("guitar and ukulele snap to the nearest preset string", () => {
  for (const tuning of TUNINGS) {
    for (const s of tuning.strings) {
      const reading = mapPitch(frame(hzOf(s.midi)), {
        a4: 440,
        mode: tuning.mode,
        tuningId: tuning.id,
      });
      const flats = s.name.includes("b");
      expect(reading?.midi).toBe(s.midi);
      expect(reading?.cents).toBeCloseTo(0, 5);
      expect(reading?.flats).toBe(flats);
      expect(`${reading?.note}${reading?.octave}`).toBe(reading?.flats ? s.name.replace("b", "♭") : s.name);
    }
  }

  const drop = mapPitch(frame(hzOf(40)), { a4: 440, mode: "guitar", tuningId: "drop-d" });
  expect(drop?.midi).toBe(38);
  expect(drop?.note).toBe("D");
  expect(drop?.cents).toBeCloseTo(200, 4);

  const tie = mapPitch(frame(hzOf(62)), { a4: 440, mode: "ukulele", tuningId: "gcea" });
  expect(tie?.midi).toBe(60);

  const fallback = mapPitch(frame(hzOf(40)), { a4: 440, mode: "guitar", tuningId: "nope" });
  expect(fallback?.midi).toBe(40);
});

test("gate blanks the note; ±5¢ is the in-tune window", () => {
  expect(mapPitch(frame(440, CLARITY_MIN, RMS_GATE), chromatic)?.midi).toBe(69);
  expect(mapPitch(frame(440, CLARITY_MIN - 0.01, 1), chromatic)).toBeNull();
  expect(mapPitch(frame(440, 1, RMS_GATE - 0.001), chromatic)).toBeNull();
  expect(mapPitch(frame(0, 1, 1), chromatic)).toBeNull();
  expect(mapPitch(frame(Number.NaN), chromatic)).toBeNull();

  const edge = mapPitch(frame(hzOf(69, 440, IN_TUNE_CENTS)), chromatic);
  const over = mapPitch(frame(hzOf(69, 440, IN_TUNE_CENTS + 0.1)), chromatic);
  expect(Math.abs(edge!.cents)).toBeLessThanOrEqual(IN_TUNE_CENTS);
  expect(Math.abs(over!.cents)).toBeGreaterThan(IN_TUNE_CENTS);
});

test("one-pole resets when the note changes", () => {
  const sharp = mapPitch(frame(hzOf(40, 440, 40)), chromatic)!;
  const center = mapPitch(frame(hzOf(40)), chromatic)!;
  const next = mapPitch(frame(hzOf(45, 440, 20)), chromatic)!;
  let smooth = stepSmooth(null, sharp);
  expect(smooth?.cents).toBeCloseTo(40, 4);
  smooth = stepSmooth(smooth, center);
  expect(smooth?.cents).toBeCloseTo(40 * (1 - SMOOTH_ALPHA), 4);
  expect(stepSmooth(smooth, next)?.cents).toBeCloseTo(20, 4);
  expect(stepSmooth(smooth, null)).toBeNull();
});

test("tuner store maps hz and tracks settings", () => {
  const run = createRoot((dispose) => {
    const [pitch, setPitch] = createSignal<PitchFrame>({ hz: 0, clarity: 0, rms: 0 });
    const [settings, setSettings] = createStore<Settings>({ ...chromatic });
    const view = createTuner({ pitch, settings });
    return { view, setPitch, setSettings, dispose };
  });
  flush();
  expect(run.view()).toEqual(IDLE_TUNER);

  run.setPitch(frame(hzOf(40)));
  flush();
  expect(run.view().live).toBe(true);
  expect(run.view().note).toBe("E");
  expect(run.view().octave).toBe(2);
  expect(run.view().inTune).toBe(true);
  expect(run.view().cents).toBeCloseTo(0, 5);

  run.setPitch(frame(hzOf(40, 440, 40)));
  flush();
  expect(run.view().cents).toBeCloseTo(40 * SMOOTH_ALPHA, 3);
  expect(run.view().inTune).toBe(false);

  run.setPitch(frame(hzOf(45)));
  flush();
  expect(run.view().note).toBe("A");
  expect(run.view().cents).toBeCloseTo(0, 5);

  run.setPitch(frame(0, 0, 0));
  flush();
  expect(run.view().live).toBe(true);
  expect(run.view().note).toBe("A");
  expect(run.view().inTune).toBe(false);
  run.setPitch(frame(hzOf(45, 440, 20)));
  flush();
  expect(run.view().cents).toBeCloseTo(20 * SMOOTH_ALPHA, 3);

  run.setPitch(frame(440));
  flush();
  expect(run.view().note).toBe("A");
  expect(run.view().cents).toBeCloseTo(0, 4);

  run.setSettings((d) => {
    d.a4 = 432;
  });
  flush();
  const raw = 1200 * Math.log2(440 / 432);
  expect(run.view().note).toBe("A");
  expect(run.view().cents).toBeCloseTo(raw * SMOOTH_ALPHA, 3);

  run.setSettings((d) => {
    d.mode = "guitar";
    d.tuningId = "drop-d";
  });
  run.setPitch(frame(hzOf(38, 432)));
  flush();
  expect(run.view().note).toBe("D");
  expect(run.view().octave).toBe(2);
  expect(run.view().inTune).toBe(true);

  run.setPitch(frame(hzOf(69, 432, IN_TUNE_CENTS + 1), 0.2, 1));
  flush();
  expect(run.view().live).toBe(true);
  expect(run.view().note).toBe("D");
  expect(run.view().inTune).toBe(false);
  run.dispose();
});

test("one dropout holds E4; the 13th null clears and the next frame restarts", () => {
  const run = createRoot((dispose) => {
    const [pitch, setPitch] = createSignal<PitchFrame>({ hz: 0, clarity: 0, rms: 0 });
    const view = createTuner({ pitch, settings: chromatic });
    return { view, setPitch, dispose };
  });
  flush();

  run.setPitch(frame(hzOf(64)));
  flush();
  expect(run.view().note).toBe("E");
  expect(run.view().octave).toBe(4);
  expect(run.view().inTune).toBe(true);

  run.setPitch(frame(0, 0, 0));
  flush();
  expect(run.view().live).toBe(true);
  expect(run.view().octave).toBe(4);
  expect(run.view().cents).toBeCloseTo(0, 5);
  expect(run.view().inTune).toBe(false);

  run.setPitch(frame(hzOf(64, 440, 40)));
  flush();
  expect(run.view().cents).toBeCloseTo(40 * SMOOTH_ALPHA, 3);
  expect(run.view().inTune).toBe(false);

  for (let i = 0; i < HOLD_HOPS; i++) {
    run.setPitch(frame(0, 0, 0));
    flush();
    expect(run.view().live).toBe(true);
    expect(run.view().note).toBe("E");
  }
  run.setPitch(frame(0, 0, 0));
  flush();
  expect(run.view()).toEqual(IDLE_TUNER);

  run.setPitch(frame(hzOf(64, 440, 20)));
  flush();
  expect(run.view().cents).toBeCloseTo(20, 3);
  run.dispose();
});

test("power off clears a held note without waiting out the hang", () => {
  const run = createRoot((dispose) => {
    const [pitch] = createSignal<PitchFrame>(frame(hzOf(64)));
    const [power, setPower] = createSignal(true);
    const view = createTuner({ pitch, settings: chromatic, power });
    return { view, setPower, dispose };
  });
  flush();
  expect(run.view().live).toBe(true);

  run.setPower(false);
  flush();
  expect(run.view()).toEqual(IDLE_TUNER);
  run.dispose();
});

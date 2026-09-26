import { createRoot, flush } from "solid-js";
import { expect, test } from "vitest";
import { createAudioSession, yinSampleRate } from "./session";

test("does not start audio on create", () => {
  createRoot((dispose) => {
    const audio = createAudioSession();
    flush();
    expect(audio.power()).toBe(false);
    expect(audio.pitch()).toEqual({ hz: 0, clarity: 0, rms: 0 });
    expect(audio.error()).toBe(null);
    expect(audio.rate()).toBe(0);
    dispose();
  });
});

test("a labeled 48k iPhone clock is one semitone sharp", () => {
  expect(yinSampleRate(48000, true)).toBeCloseTo(48000 / 2 ** (1 / 12), 5);
  expect(yinSampleRate(44100, true)).toBe(44100);
  expect(yinSampleRate(48000, false)).toBe(48000);
});

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

test("a 48k iOS clock on 44.1k samples is the semitone error", () => {
  expect(yinSampleRate(48000, undefined, true)).toBe(44100);
  expect(yinSampleRate(48000, 44100, true)).toBe(44100);
  expect(yinSampleRate(48000, 48000, true)).toBe(44100);
  expect(yinSampleRate(44100, undefined, true)).toBe(44100);
  expect(yinSampleRate(48000, undefined, false)).toBe(48000);
  expect(yinSampleRate(48000, 44100, false)).toBe(48000);
});

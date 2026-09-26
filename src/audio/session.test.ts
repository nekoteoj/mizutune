import { createRoot, flush } from "solid-js";
import { expect, test } from "vitest";
import { createAudioSession } from "./session";

test("does not start audio on create", () => {
  createRoot((dispose) => {
    const audio = createAudioSession();
    flush();
    expect(audio.power()).toBe(false);
    expect(audio.pitch()).toEqual({ hz: 0, clarity: 0, rms: 0 });
    expect(audio.error()).toBe(null);
    dispose();
  });
});

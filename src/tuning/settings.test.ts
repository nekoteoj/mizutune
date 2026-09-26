import { createRoot, flush } from "solid-js";
import { expect, test } from "vitest";
import {
  SETTINGS_KEY,
  TUNINGS,
  applyMode,
  applyTuning,
  clampA4,
  createSettings,
  parseSettings,
} from "./settings";

test("v1 presets are the locked string sets", () => {
  expect(TUNINGS.map((t) => [t.id, t.label, t.strings.map((s) => s.midi)])).toEqual([
    ["standard", "Standard", [40, 45, 50, 55, 59, 64]],
    ["half-down", "½-step down", [39, 44, 49, 54, 58, 63]],
    ["drop-d", "Drop D", [38, 45, 50, 55, 59, 64]],
    ["gcea", "GCEA", [67, 60, 64, 69]],
  ]);
});

test("clamps A4 and rejects a bad blob", () => {
  expect(clampA4(429)).toBe(430);
  expect(clampA4(450.6)).toBe(450);
  expect(clampA4(Number.NaN)).toBe(440);
  expect(parseSettings({ a4: 999, mode: "nope", tuningId: "gcea", extra: 1 })).toEqual({
    a4: 450,
    mode: "guitar",
    tuningId: "standard",
  });
  expect(parseSettings(null)).toEqual({ a4: 440, mode: "guitar", tuningId: "standard" });
});

test("mode change keeps a matching preset and snaps the rest", () => {
  const drop = { a4: 440, mode: "guitar" as const, tuningId: "drop-d" };
  expect(applyMode(drop, "chromatic").tuningId).toBe("drop-d");
  expect(applyMode(applyMode(drop, "chromatic"), "guitar").tuningId).toBe("drop-d");
  expect(applyMode(drop, "ukulele").tuningId).toBe("gcea");
  expect(applyTuning({ ...drop, mode: "ukulele" }, "drop-d").tuningId).toBe("drop-d");
  expect(applyTuning(drop, "gcea").tuningId).toBe("drop-d");
});

test("bad stored json falls back to defaults", () => {
  const mem = new Map<string, string>([[SETTINGS_KEY, "{"]]);
  const storage = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
  };
  const run = createRoot((dispose) => {
    const settings = createSettings(storage);
    return { settings, dispose };
  });
  flush();
  expect(run.settings.state.a4).toBe(440);
  expect(run.settings.state.mode).toBe("guitar");
  expect(JSON.parse(mem.get(SETTINGS_KEY)!)).toEqual({
    a4: 440,
    mode: "guitar",
    tuningId: "standard",
  });
  run.dispose();
});

test("persists one json blob and reloads it", () => {
  const mem = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes += 1;
      mem.set(key, value);
    },
  };

  const first = createRoot((dispose) => {
    const settings = createSettings(storage);
    return { settings, dispose };
  });
  flush();
  first.settings.setA4(432);
  first.settings.setMode("ukulele");
  flush();
  first.dispose();

  expect(writes).toBe(2);
  expect([...mem.keys()]).toEqual([SETTINGS_KEY]);
  expect(JSON.parse(mem.get(SETTINGS_KEY)!)).toEqual({
    a4: 432,
    mode: "ukulele",
    tuningId: "gcea",
  });

  const second = createRoot((dispose) => {
    const settings = createSettings(storage);
    return { settings, dispose };
  });
  flush();
  expect(second.settings.state.a4).toBe(432);
  expect(second.settings.state.mode).toBe("ukulele");
  expect(second.settings.state.tuningId).toBe("gcea");
  second.dispose();
});

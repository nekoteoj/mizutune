# P08 Stable pitch
Status: on-going
Phase: 8
Depends: P05

## Symptom

Real guitar, power on:

- String 1 (E4, ~330 Hz) and string 2 (B3, ~247 Hz) never appear.
- Strings 3–6 appear for a short time, then the LCD goes back to `—`.
- Same note flashes on, blanks, comes back. The scale jumps instead of gliding.

## Why (do not treat these as separate bugs)

YIN already tracks open B and high E. `dsp/tests/test_pitch.cpp` asserts midi 59 and 64 sines to < 1 cent. `k_f_max` is 1400 Hz. This is not a missing high-string range.

The LCD is a hard gate with no memory.

1. **One bad hop clears the pedal.** `mapPitch` returns null unless `clarity >= 0.8` and `rms >= 0.01`. `stepSmooth` then returns null, and `createTuner` writes `IDLE_TUNER`. Hop is 20 ms. A decaying pluck, a noisy attack, or one shallow YIN dip blanks the meter. The next good hop starts the one-pole over, so cents jump. That is the flicker and the non-smooth scale.
2. **0.8 clarity is stricter than the detector.** Native tests only require `clarity > 0.5` on pure sines. The UI comment already says to lower 0.8 if a real guitar blanks. A mic pluck is not a sine. High E and B are the quietest, shortest notes, so they are the first to miss both gates for every hop. Louder wound strings clear them only while the attack is hot.
3. **RMS 0.01 is about −40 dBFS.** Fine for a close loud pluck. Easy to miss an open B or high E, especially unplugged electric or a phone mic a bit away. WASM applies the same gate, so those hops arrive as `hz = 0` and the UI cannot tell "quiet string" from "silence".
4. **Browser processing may still be on.** Constraints are `{ ideal: false }` for echo cancel, noise suppression, and AGC. That is a hint. Chrome often keeps AGC and noise suppression anyway. AGC pumps the gate. Noise suppression hits short bright notes harder than a ringing low E.

Not this phase: a new pitch algorithm, a longer window, or polyphonic detection. Switch only if the debug line below shows YIN itself is wrong.

## Tasks

Do in order. Stop after task 2 if a real guitar is already stable.

1. **`?debug` on the status line.** While power is on and `location.search` has `debug`, show the last frame: `hz`, `clarity`, `rms`, and whether the worklet reported `wasm` or `pcm`. No panel. This is how we tell the three failure modes apart:
   - high E pluck, `rms` under the gate, `hz = 0` → gate / mic level
   - `hz` near 247 or 330, `clarity` 0.5–0.8 → UI gate, detector is fine
   - `hz` near 0 or a wrong octave while `rms` is clearly above the gate → DSP, task 4
2. **Hold the last good reading. Lower the show-gate.** TS only.
   - Show a note at `clarity >= 0.5` and `rms >= 0.003`. Keep in-tune at ±5¢, and only on a fresh frame (held silence must not stay green).
   - Hang the last good note ~250 ms (about 12 hops). Freeze cents during the hang. Do not reset the one-pole unless the note key changes or the hang expires.
   - Drop `RMS_GATE` in `src/audio/session.ts` to the same 0.003 so WASM stops zeroing quiet strings before the UI can see them. One constant, both sides.
   - Vitest: a single null frame between two E4 frames does not clear the view or restart cents; 13 null frames do; in-tune goes false on the first null.
3. **Turn processing off for real, without breaking iOS.** Try `echoCancellation` / `noiseSuppression` / `autoGainControl` as `false`. On `OverconstrainedError`, retry once with the current `{ ideal: false }` set. Do not add a third retry. Confirm on the debug line that a high-E pluck still reaches the worklet.
4. **DSP only if task 1 says the Hz is wrong.** Do not start here.
   - Add one native case: decaying harmonic pluck (fundamental + 2nd + 3rd, exponential decay, amplitude under the old 0.01 gate) at B3 and E4. Must stay on the fundamental.
   - If the debug Hz is ~2× the string, reject an upward octave (check `τ/2`) the same way the code already prefers `2τ`. Do not retune the whole threshold table.
   - If the dip is real but shallow, raise the YIN search threshold from 0.10 to 0.15 so the first valley wins over a noise global-min. Leave parabolic interpolation alone.
   - No MPM, no YINFFT, no extra window size. Those stay in `plan/backlog/`.

## Done when

- Open strings 1–6 on a real guitar each hold on the LCD for the ring of the note, without flashing to `—` mid-note.
- High E and B show the right note, not silence and not an octave up.
- Cents glide while the note holds. A rest longer than the hang returns to `—`.
- `yarn test:dsp` and Vitest still pass, including the hang test.
- `?debug` still works. No other UI.

## Progress

Tasks 1–3 are in `317cf7e`. Task 4 not started — no guitar trace yet.

- Show gate is clarity 0.5 / rms 0.003. `RMS_GATE` lives in `src/tuning/map.ts`; the worklet gets the same number.
- Hang is 12 failed hops. Cents freeze. In-tune is fresh frames only. Power off clears immediately, so the last note does not sit on a dark LCD. Vitest covers the E4 hold and power-off.
- `?debug` status is `329.6Hz c0.62 r0.004 wasm` (or `pcm` / `…`).
- Mic constraints are exact `false`, one `OverconstrainedError` retry to `{ ideal: false }`.

Still open: real guitar. Power on with `?debug` and pluck high E. Read the status line before touching C++.

## Out of scope

- Median smoother, unless the hang still leaves a jumpy needle. Then one 3-tap median on raw cents, nothing else.
- New tunings, bass, poly, metering of the raw waveform.

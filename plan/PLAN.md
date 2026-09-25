# Mizutune — v1 plan

Standalone SolidJS 2 PWA: analog stompbox guitar tuner. Mic in → pitch → in-tune / sharp / flat. No backend.

Greenfield. Toolchain already in `flake.nix`: Node 26, Yarn, Emscripten, CMake, Ninja, binaryen, wabt.

---

## Defaults (challenge these)

| Decision | Default | Why |
|---|---|---|
| Pitch | **Monophonic** (locked) | Poly F0 is a different detector. Backlog. |
| iOS | **Required for v1** (locked) | Mic + worklet + PWA standalone on iPhone. |
| Presets | Standard / ½-step / Drop D / uke GCEA (locked) | More tunings in backlog. |
| Runtime | Client-only PWA | Tuner does not need a server. |
| DSP | C++ → WASM, **YIN** | See DSP section. FFT-peak is the wrong first algorithm. |
| Mapping | Hz from WASM; note/cents/tuning in TS | DSP stays a pure `samples → {hz, clarity, rms}`. Easy to test both sides. |
| Package manager | Yarn (Nix `yarn` = classic 1.x) | Do not switch to Berry unless asked. |
| UI lib | SolidJS 2 (`solid-js@2.0.0-rc.8` + matching `@solidjs/web` + `@solidjs/vite-plugin`) | Client SPA. No router, no SSR. |
| Audio | `AudioWorklet` + WASM inside the worklet | Main-thread DSP janks the needle. Fallback: worklet posts PCM, main runs WASM. |
| Persist settings | `localStorage` | One JSON blob. |
| In-tune window | **±5 cents** | Typical stompbox. |
| A4 | 440, range 430–450 | Common. |
| Tests | Native C++ asserts for pitch; Vitest for note math | UI e2e later. |

Still open (does not block start): in-tune window 5¢ vs 3¢ vs user-set. Default ±5¢.

---

## Non-goals (v1)

- Polyphonic “all strings at once”
- Cable / USB audio interfaces as a special case (default mic is enough)
- Account, cloud, analytics
- Custom IR / amp sim / metronome / drone
- Perfect 12-string / 7-string / bass (bass needs a longer window; backlog)
- New npm DSP packages (`pitchfinder`, `ml5`, etc.) — we own C++

---

## Shape of the product

```
┌─────────────────────────────────────────┐
│  mobile = fullscreen  │  desktop = box  │
│                                         │
│         FRONT (power on)                │
│   ┌─────────────────────────────────┐   │
│   │   moving note scale (analog)    │   │
│   │            │ needle at 0¢       │   │
│   │         E  4     +12¢           │   │
│   │            MIZUTUNE             │   │
│   └─────────────────────────────────┘   │
│      [ POWER ]          [ SETUP ]       │
│                                         │
│         BACK (flipped 180°)             │
│   A4 Hz  ·  mode  ·  tuning preset      │
│                    [ BACK ]             │
└─────────────────────────────────────────┘
```

- Ocean palette: deep teal / sea-glass LCD / dark enclosure. No extra illustration.
- Flip: CSS `transform: rotateY(180deg)` on a 3D card. One boolean `face`.
- Front SETUP → back. Back BACK → front. Same 3D flip both ways.
- Power off: mute DSP, dark LCD, keep the enclosure.

Meter (requested): **needle fixed at center (0 cents). The note scale slides under it.** CSS `translateX` on a tick strip, not a rotating needle (needle-rotate is the other analog style; we do moving-scale).

---

## Stack (minimum)

```
src/                 Solid 2 SPA (Vite)
  audio/             getUserMedia, AudioContext, worklet loader
  ui/                Pedal, Display, Footswitch, Settings
  tuning/            A4, note names, presets, cents — pure TS
dsp/                 C++ pitch (native tests + emcc wasm)
public/              manifest, icons, worklet.js, mizutune.wasm
```

Yarn + Vite at repo root. CMake in `dsp/` produces:

1. `mizutune_dsp_test` — native binary, run in CI / `yarn test:dsp`
2. `mizutune.wasm` (+ tiny JS glue if emcc needs it) — copied into `public/`

No extra UI kit. No Solid router. PWA = `manifest.webmanifest` + a small service worker that precaches the shell. Skip `vite-plugin-pwa` until the SW file gets annoying.

---

## DSP — how we detect the note

### Why not “just FFT”

Open low E is **82.41 Hz**. A 2048-point FFT at 48 kHz is **~23 Hz/bin**. Parabolic interpolation on a magnitude peak still:

- is coarse on the low strings (tens of cents),
- often locks onto a **harmonic** (guitar fundamentals are weak).

FFT is useful later (YIN difference via Wiener–Khinchin, or a spectrum overlay). It is not the pitch estimator.

### Proposed detector: YIN (de Cheveigné & Kawahara, 2002)

Time-domain, built for speech/music, standard in tuners (`aubio`, SuperCollider, etc.).

1. **Difference function** `d(τ) = Σ (x[j] − x[j+τ])²`
2. **CMNDF** `d'(τ) = d(τ) / ((1/τ) Σ d(k))`  — normalizes so threshold is stable
3. **Absolute threshold** (~0.1–0.15): first dip below threshold, else global min
4. **Parabolic interpolation** around that `τ` → sub-sample period
5. `f0 = sampleRate / τ`

Optional speedup (same math): compute `d(τ)` via FFT (YINFFT). Add only if the naive O(W·τmax) misses the audio quantum.

**Not v1 unless YIN octave-errors on real guitar:** McLeod Pitch Method (NSMDF / Tartini). Swap inside `dsp/`, UI unchanged.

### Pipeline around YIN

```
PCM (float32, hop ~20 ms, window 4096 @ 48 kHz ≈ 85 ms)
  → RMS gate          silence → {hz: 0, clarity: 0}
  → DC / rumble HP    ~60 Hz 1-pole
  → YIN + interpolate
  → octave check      prefer τ vs 2τ using CMNDF
  → { hz, clarity, rms }
```

Window 4096 covers ~70 Hz (bass-ish E1 is backlog). Hop 512–1024 samples so the needle is ~10–20 Hz UI, not 375 Hz worklet rate.

### Smoothing (TS, after Hz)

Guitar attack is noisy. Do not smooth inside YIN.

- Convert `hz` → cents vs target (chromatic nearest, or nearest string in preset)
- If note name changes, **reset** the smoother (do not glide E→F)
- One-pole on cents: `cents += α * (raw − cents)`, α ≈ 0.25
- Optional 3-tap median on raw cents if still jittery
- `inTune = abs(cents) ≤ 5` **and** `clarity ≥ threshold` **and** `rms ≥ gate`

### Accuracy bar (tests must fail if we miss this)

| Signal | Expect |
|---|---|
| Sine at each open-string Hz ± 0, ±10, ±50 cents | error **< 1 cent** |
| Sine + weak 2nd/3rd harmonic | still the fundamental, **< 2 cents** |
| Silence / noise below gate | no pitch (`clarity = 0`) |
| Jump 110 Hz → 196 Hz | note change within 2 hops, no stuck octave |

Use synthetic buffers in C++. Add one or two recorded guitar clips later if we have them; do not block on recordings.

### WASM boundary (stable)

```c
struct PitchResult { float hz; float clarity; float rms; };

PitchResult pitch_yin(
  const float* samples, int n,
  float sample_rate,
  float yin_threshold,     // ~0.1
  float rms_gate
);
```

No note names in C++. No A4. No tunings.

Worklet calls this every hop, `postMessage`s the struct. Solid reads it into signals.

---

## Tuning model (TS)

```ts
type Mode = "chromatic" | "guitar" | "ukulele";

type Tuning = { id: string; label: string; strings: { name: string; midi: number }[] };
```

v1 presets:

- Guitar: Standard (E2 A2 D3 G3 B3 E4), ½-step down, Drop D
- Ukulele: Standard GCEA (high G)

Chromatic: nearest 12-TET pitch at current A4.

`midi = 69 + 12 * log2(hz / A4)`  
`cents = 100 * (midi − round(midi))` in chromatic; vs nearest string MIDI in fixed mode.

Settings persist `{ a4, mode, tuningId }`.

---

## UI / reactivity (Solid 2)

Components run once. Live values are signals/stores.

```
createAudioSession()     // mic, context, worklet, power
createTunerState()       // store: { power, face, a4, mode, tuningId, hz, cents, note }
```

- `createEffect(compute, apply)` if we subscribe to worklet messages — compute reads `power()`, apply adds/removes the listener.
- Display is dumb: `note`, `cents`, `inTune`, `live`.
- Flip: class on the 3D wrapper, CSS handles animation.
- Desktop: centered pedal, max-width ~360px, aspect close to a compact tuner stomp (taller than wide).
- Mobile: enclosure is `100dvh`, respect safe-area.

A11y minimum: power and setup are real `<button>`s, `aria-pressed` on power, `aria-live` on the note readout.

---

## Test plan

**DSP (native, required from phase 2)**  
`dsp/tests/test_pitch.cpp` — generate sines, assert cents. `ctest` / a binary. This is the one check that must exist; if YIN breaks, this fails.

**Tuning math (Vitest)**  
`src/tuning/*.test.ts` — A4=440 and A4=432, chromatic rounding, Drop D nearest-string, gate/in-tune flags.

**Solid (light)**  
`createRoot` + `flush()` for the store that maps `{hz, a4, mode} → {note, cents}`. No component snapshot tests in v1.

**Manual**  
Real guitar, Chrome desktop, then phone. Checklist on the PWA card.

Do not stand up Playwright until the pedal is clickable.

---

## Phases

Do in order. One phase in `on-going/` at a time.

| Phase | Card | Outcome |
|---|---|---|
| 0 | `P00` scaffold | Vite + Solid 2 + Yarn + empty CMake wasm hello |
| 1 | `P01` DSP | YIN + native tests green on sines |
| 2 | `P02` audio | Mic → worklet → Hz in a debug readout |
| 3 | `P03` front | Pedal enclosure, LCD moving-scale, power, Mizutune wordmark |
| 4 | `P04` flip | 3D flip, A4 + mode + presets, persist |
| 5 | `P05` wire | Debug readout gone; live meter + chromatic/fixed |
| 6 | `P06` PWA | Manifest, SW, mobile fullscreen, polish |

Cards live in `plan/plan/` until picked.

---

## Latency / devices (known ceilings)

- Mic permission requires a user gesture → **power footswitch starts audio**, not page load.
- Worklet + 4096 window ≈ 85 ms algorithmic delay. Fine for a tuner, bad for monitoring. We are not monitoring.
- iOS is a v1 gate: resume `AudioContext` on touch; standalone PWA; if worklet cannot instantiate WASM, use the PCM-to-main fallback and **test on a real iPhone** before calling P06 done.
- Hardware clocks drift — A4 is the calibration knob. Leave it.

---

## Suggested first implementation slice

After this plan is accepted: **P00 then P01**. UI mock with fake cents can parallel P01, but do not polish CSS before Hz is real.

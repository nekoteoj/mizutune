# Mizutune — agent notes

Standalone SolidJS 2 PWA: analog stompbox guitar tuner. Mic → C++ WASM pitch → in-tune / sharp / flat. No backend.

Read `plan/PLAN.md` before writing code. Cards: `plan/plan/` → `plan/on-going/` → `plan/finished/`. One phase at a time.

## Status

P02 done. Next: **P03** front. Toolchain in `flake.nix` (Node 26, Yarn classic, Emscripten, CMake, Ninja).

## Locked (do not reopen)

- Monophonic pitch (not Polytune poly)
- YIN in C++ WASM; `{ hz, clarity, rms }` only — note/cents/tunings in TS
- Yarn classic (Nix). Not Berry, not npm
- SolidJS **2** (`solid-js` + `@solidjs/web` + `@solidjs/vite-plugin` RC pair, jsxImportSource `@solidjs/web`)
- iPhone Safari / add-to-home-screen is a **v1 gate**
- Presets: guitar Standard, ½-step down, Drop D; ukulele GCEA
- Client-only. No router, no SSR, no UI kit

## Stack / layout (target)

```
src/       Solid 2 SPA (Vite)
  audio/   mic, AudioContext, worklet
  ui/      pedal, display, footswitches, settings
  tuning/  A4, notes, presets, cents — pure TS
dsp/       C++ YIN, native tests + emcc wasm
public/    manifest, worklet, wasm
plan/      kanban
```

Package manager: **yarn**. Dev shell: `direnv` / `nix develop`.

## DSP

YIN + CMNDF + parabolic τ + RMS gate. Window ~4096 @ 48 kHz, hop ~20 ms. FFT peak picking is wrong for guitar. MPM / YINFFT / poly-F0 are backlog (`plan/backlog/`).

Accuracy bar: synthetic sines of open-string pitches **< 1 cent**. Silence → `clarity = 0`.

Power footswitch starts audio (user gesture). Do not auto-start the mic.

## UI

Ocean stompbox. Desktop = centered box; mobile = fullscreen pedal. CSS 3D `rotateY` flip front/back. Meter: **needle fixed at 0¢, scale translates**. Wordmark MIZUTUNE. Settings in `localStorage`.

Solid 2: components run once; live values in signals/stores; `createEffect(compute, apply)`; `createStore` from `solid-js`; DOM from `@solidjs/web`. Skill: `.agents/skills/solidjs-v2/`.

## Tests

- Native C++ sine tests on YIN (`yarn test:dsp`) — required from P01
- Vitest on tuning math
- Light Solid: `createRoot` + `flush()` for mapping store
- No Playwright until the pedal is clickable
- Real guitar + **real iPhone** before P06 is done

## Do not

- Add pitch npm libs, extra tunings, poly detect, bass, metronome, accounts
- Put note names or A4 in C++
- Start AudioContext on page load
- Invent Solid 1.x APIs (`onMount` patterns from 1.x, `createStore` from `solid-js/store`)

## Phases

P00 scaffold → P01 YIN → P02 worklet → P03 front → P04 flip/settings → P05 wire → P06 PWA+iOS.

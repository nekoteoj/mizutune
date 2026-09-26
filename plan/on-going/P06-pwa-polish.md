# P06 PWA + polish
Status: on-going
Phase: 6
Depends: P05

## Done when

- `manifest.webmanifest` + icons + theme color
- Small service worker precaches the shell (offline tuner)
- Mobile safe-area, no browser chrome surprises in standalone
- AudioContext resume on first gesture
- **iOS required:** mic + live pitch + flip + offline shell in Safari / add-to-home-screen
- Manual check: real guitar on desktop **and** iPhone

## Notes

Shell is in. Do not move to finished until the iPhone gate is checked.

- Manifest, 180/192/512 icons, theme `#0e4a50`, apple standalone meta, `viewport-fit=cover`
- `sw.js` is emitted by the Vite build. No `vite-plugin-pwa`. Precaches `/`, hashed JS/CSS, worklet, wasm, icons
- Service worker registers only in production. Check with `yarn build && yarn preview`
- Mic constraints are `ideal: false`. Exact `false` is `OverconstrainedError` on iOS, and a retry is past the gesture
- WASM-in-worklet still falls back to PCM (P02). Do not add a second path
- `pointerdown` resumes `AudioContext` if iOS left it `suspended` or `interrupted`

Manual, before finished:

- Desktop: real guitar, in-tune meter
- iPhone Safari over **HTTPS** (LAN `http://` will not get a mic or a service worker): mic, live pitch, flip, Add to Home Screen, then airplane-mode reload still shows the pedal

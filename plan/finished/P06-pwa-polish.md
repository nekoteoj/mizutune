# P06 PWA + polish
Status: finished
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

Checked at `https://nekoteoj.github.io/mizutune/`. LAN `http://` will not get a mic or a service worker.

- Manifest, 180/192/512 icons, theme `#0e4a50`, apple standalone meta, `viewport-fit=cover`
- `sw.js` is emitted by the Vite build. No `vite-plugin-pwa`
- Service worker registers only in production
- Mic constraints are `ideal: false`. Exact `false` is `OverconstrainedError` on iOS
- WASM-in-worklet still falls back to PCM (P02)
- `pointerdown` resumes `AudioContext` if iOS left it `suspended` or `interrupted`

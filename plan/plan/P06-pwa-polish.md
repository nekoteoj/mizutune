# P06 PWA + polish
Status: plan
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

Hand-written SW first. `vite-plugin-pwa` only if the file gets painful.
If WASM-in-worklet fails on Safari, ship P02’s PCM-to-main fallback — v1 does not ship without iPhone.

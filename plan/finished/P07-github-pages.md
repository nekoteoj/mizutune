# P07 GitHub Pages
Status: finished
Phase: 7
Depends: P06 shell (not the iPhone check — this URL is how that check gets HTTPS)

## Done when

- `https://nekoteoj.github.io/mizutune/` serves the built tuner over HTTPS
- Actions runs `yarn build:wasm` then `yarn build`. Do not commit `public/mizutune.wasm`
- That job sets Vite `base` to `/mizutune/`. Local `yarn dev` / `preview` stay at `/`
- Service worker, manifest scope, worklet, and wasm follow `import.meta.env.BASE_URL`. Nothing hardcoded at `/sw.js`
- Pages source is GitHub Actions, not a Jekyll `gh-pages` branch
- A phone can open that URL and reach the mic prompt

## Notes

Project page, not `nekoteoj.github.io`. A service worker at `/sw.js` cannot control `/mizutune/`.
CI uses `nix develop`. `BASE_PATH=/mizutune/` is CI-only. No `vite-plugin-pwa`. No custom domain.

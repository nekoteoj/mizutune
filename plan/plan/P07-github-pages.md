# P07 GitHub Pages
Status: plan
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

CI uses `nix develop` so Node, Yarn classic, and emcc stay the flake. No second emscripten pin. No `vite-plugin-pwa`. No custom domain.

P06's iPhone check uses this URL once it is live.

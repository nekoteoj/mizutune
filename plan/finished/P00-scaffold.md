# P00 Scaffold
Status: finished
Phase: 0
Depends: —

## Done when

- Yarn + Vite + TypeScript SPA boots a blank page
- `solid-js` / `@solidjs/web` / `@solidjs/vite-plugin` are the v2 RC pair (see skill: `2.0.0-rc.8`)
- `jsxImportSource` is `@solidjs/web`
- `dsp/` CMake builds a native hello and an emcc wasm that JS can instantiate
- `yarn test` runs Vitest (empty/ok); `yarn test:dsp` runs the native binary

## Notes

Keep tree flat: `src/`, `dsp/`, `public/`. No router, no UI kit, no PWA plugin yet.
Use Nix Yarn (classic). Do not add Berry.

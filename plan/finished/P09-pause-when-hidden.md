# P09 Pause mic when hidden
Status: finished
Phase: 9
Depends: P08

## Symptom

Power on, then switch browser tab or leave the app on the phone: the tuner keeps the microphone. Chrome shows the tab mic icon. iPhone shows the orange mic dot. DSP may already be dead (iOS often suspends `AudioContext` in background) while the **track** is still capturing.

## Why this is possible

`document.visibilityState` / `visibilitychange` fire when the tab is backgrounded, another tab is selected, or (on current iOS) the browser / standalone PWA is left for another app.

That is enough. Do not use `blur` / `focus` (alerts and the on-screen keyboard false-trigger). Do not add a setting.

## What actually stops recording

`AudioContext.suspend()` is **not** enough. WebKit keeps capture going in the background when a page has a live `MediaStreamTrack` (orange / red indicator). `track.enabled = false` often leaves the indicator on too.

Must `track.stop()` (same as power-off already does in `release()`). Re-`getUserMedia` when visible again — permission is already granted, no second prompt.

Keep `power()` true. User did not hit Power. LCD goes idle because pitch is silent. Existing `pointerdown` resume stays for iOS `AudioContext` `suspended` / `interrupted`.

## Approach (smallest)

In `createAudioSession` only:

1. Listen to `visibilitychange` (and `pagehide` / `pageshow` as a belt for iOS if `visibilitychange` is late). Ignore unless `power()` or a graph exists.
2. **Hidden:** stop tracks, disconnect the `MediaStreamAudioSourceNode`, `setPitch(SILENT)`. Leave `AudioContext` + worklet node. Do not `stop()` — that flips power off.
3. **Visible:** if power still on, `openMic()`, new source → existing worklet, `ctx.resume()`. If resume is ignored until a tap, that is already handled.
4. If hidden mid-`start()`, existing `token` abort still wins; do not leave a live track behind.
5. If the user powered off while hidden, do nothing on visible.

Do not rebuild the whole graph on every hide. Do not invent a third power state.

## iOS (v1 gate — confirm on a real iPhone)

- Tab switch in Safari: `visibilitychange` → hidden. Orange dot must go.
- Home / other app, including add-to-home-screen: same. If JS is frozen before the handler runs, iOS may keep the dot until Safari is killed — note it, do not add a native wrapper.
- Foreground `getUserMedia` without a gesture is OK with existing permission. `AudioContext.resume()` from the visibility handler often is **not**. First tap on the pedal already resumes.
- Do not call `start()` from visibility (that path assumes a gesture for the first `AudioContext()`). Only re-open the mic onto the live graph.

## Tests / manual

- Vitest: with a fake `document`, hide while “powered” stops tracks and silences pitch; show re-opens; power-off while hidden does not restart. No Playwright.
- Manual: Chrome desktop tab switch — mic icon off, come back, pluck works.
- Manual: iPhone Safari + standalone PWA — orange dot off after leaving, pluck works after return (tap if the context is suspended).

## Done when

- Power on + hide tab/app → mic tracks stopped, no capture indicator, LCD idle, power LED still on.
- Show again → listening resumes without another permission prompt. iOS may need the existing tap-to-resume.
- Power off still fully tears down. Hidden does not auto-start a cold pedal.
- `yarn test:dsp` and Vitest still pass.

## Notes

Confirmed in use.

- Hide stops tracks and disconnects the source. `AudioContext` + worklet stay. `power()` stays true.
- `mic()` goes false so the tuner drops the hang immediately (otherwise the last note sits for ~1 s).
- Show calls `getUserMedia` again onto the live worklet and `resume()`. No second permission prompt.
- Hide during `start()` bumps the token; the in-flight `abort()` stops the track. Power stays off.
- `pagehide` / `pageshow` sit next to `visibilitychange` for iOS.

## Out of scope

- A “keep listening in background” toggle
- `blur` / Page Lifecycle `freeze` extra states
- Changing iOS audio-session / Now Playing
- Fixing `plan/backlog/ios-semitone-swap.md`

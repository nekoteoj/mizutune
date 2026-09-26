# P10 3D box flip
Status: on-going
Phase: 10
Depends: P09

## Ask

Setup / Back should feel like a physical stompbox, not a playing card.

1. Zoom the pedal out
2. Rotate it as a **box with thickness** (side faces visible at mid-flip)
3. Zoom back in to the other face

## Possible?

Yes. Pure CSS 3D. No WebGL, no Three, no extra deps. The current flip is already `perspective` + `rotateY(180deg)` + `preserve-3d`; it is just **zero-depth** (front/back both sit at `translateZ(1px)`).

## Now

```
.flip (perspective: 1200px)
  .rotor  (transition rotateY)
    .pedal.front   backface-hidden, translateZ(1px)
    .pedal.rear    rotateY(180) translateZ(1px)
```

`face` boolean in `App.tsx`. Mobile = fullscreen slab (`border-radius: 0`). Desktop = centered card.

## Approach (smallest)

Keep `face`. Do not touch audio, settings, or the meter.

### 1. Box, not card

Add four empty side faces (left / right / top / bottom) next to front and rear.

Depth token `--d: ~1.35rem` (stompbox-ish, not a cube). Centered on Z:

- front: `translateZ(calc(var(--d) / 2))`
- rear: `rotateY(180deg) translateZ(calc(var(--d) / 2))`
- sides hinged on the parent edges so **fluid width/height still work** (no JS measuring):

```css
.edge.right {
  position: absolute;
  top: 0; bottom: 0;
  width: var(--d);
  left: 100%;
  margin-left: calc(var(--d) / -2);
  transform: rotateY(90deg);
}
```

Same idea for left (`rotateY(-90deg)`), top / bottom (`rotateX`). Paint sides a darker enclosure teal. No screws, no controls on the edges.

Drop the old `translateZ(1px)` z-fight hack; real depth replaces it.

`backface-visibility: hidden` stays on front/rear (and sides). `transform-style: preserve-3d` on `.rotor`. No `overflow` / `filter` / `opacity` on 3D ancestors (those flatten Safari).

### 2. Zoom out → flip → zoom in

A CSS **transition cannot** do scale 1 → 0.8 → 1 on one class toggle. Use a short keyframe for the zoom envelope; keep rotateY as the existing `.rotor.back` transition.

```
.flip
  .zoom          /* @keyframes: 1 → 0.8 (hold) → 1, ~0.85s */
    .rotor       /* rotateY 0↔180, ~0.5s, delay ~0.15s so spin starts after shrink */
      faces
```

Scale ~0.78–0.82. Perspective stays on `.flip`.

Trigger: on Setup/Back, add a class for the zoom animation, remove it on `animationend`. First paint must **not** play the zoom (idle front).

`prefers-reduced-motion: reduce`: no zoom, no spin — instant face swap (already `transition: none` on `.rotor`).

### 3. Mobile vs desktop

At rest, mobile stays fullscreen. Zoom-out is what reveals the box in space (wood floor around it). Mid-flip projected size is **smaller** than rest (`rotateY` never exceeds width; scale < 1), so existing `overflow: hidden` on `html, body` is fine.

Optional polish: slight `border-radius` while zooming so the floating object reads as a pedal. Not required for the effect.

## iOS (v1 gate)

`preserve-3d` + six faces is the risky bit on Safari. Confirm on a real iPhone (Safari + add-to-home-screen), both directions.

If sides flatten or vanish: keep zoom + `rotateY` (thin card that still dollies out). Do not add a JS/WebGL fallback.

Need `-webkit-backface-visibility` (already there). Do not put `overflow: hidden` on `.flip` / `.rotor` / `.zoom`.

## Files

- `src/ui/Pedal.tsx` — four edge nodes; zoom class on face change
- `src/ui/pedal.css` — depth faces, zoom keyframes, delayed rotate

No new components, no store, no tests beyond a glance (animation). DSP / Vitest unchanged.

## Done when

- Setup and Back: zoom out, box spin with visible thickness, zoom in
- Resting front/back look as they do now (fullscreen mobile, centered desktop)
- Controls on the hidden face stay `inert`; no click-through mid-flip
- Reduced motion: instant swap
- Real iPhone: either the box or the zoom+card fallback, both ways

## Out of scope

- WebGL / Three / extra npm
- Lighting, shadows that track the spin, inner box faces
- Changing A4 / presets / power / PWA
- Playwright

# P04 Flip + settings
Status: finished
Phase: 4
Depends: P03

## Done when

- Setup / Back 3D-flips the pedal (`rotateY`)
- Back: A4 (430–450), mode (chromatic / guitar / ukulele), tuning preset
- v1 presets: Standard, ½-step down, Drop D, ukulele GCEA
- Settings survive reload (`localStorage`)
- Back button returns to front

## Notes

One boolean `face` (not persisted). No router. One JSON blob `mizutune.settings`: `{ a4, mode, tuningId }`.
Tuning ids: `standard`, `half-down`, `drop-d`, `gcea`.

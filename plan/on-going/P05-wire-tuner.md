# P05 Wire tuner
Status: on-going
Phase: 5
Depends: P02, P03, P04

## Done when

- Debug Hz readout removed
- Live `{hz,clarity}` → note / cents / in-tune (±5¢, gated)
- Chromatic = nearest 12-TET at current A4
- Guitar/ukulele = nearest string in the selected preset
- Cents one-pole smoother; reset on note change
- Vitest covers mapping + presets

## Notes

All mapping in TS. DSP still only returns Hz.

# P01 DSP YIN
Status: on-going
Phase: 1
Depends: P00

## Done when

- `pitch_yin(samples, n, sr, threshold, rms_gate) → { hz, clarity, rms }`
- Native tests (synthetic sines) meet the accuracy bar in `PLAN.md`
- Silence / below-gate → `clarity = 0`, `hz = 0`
- No note names, A4, or tunings in C++
- WASM export of the same function

## Notes

YIN + CMNDF + parabolic interpolation + RMS gate. FFT-accelerated difference only if the naive loop is too slow. MPM is backlog.

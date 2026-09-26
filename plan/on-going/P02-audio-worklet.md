# P02 Audio I/O
Status: on-going
Phase: 2
Depends: P01

## Done when

- Power-on (user gesture) asks for mic, starts `AudioContext` + worklet
- Worklet runs WASM (fallback: post PCM to main if instantiate-in-worklet fails)
- Hop ~20 ms, window 4096
- A temporary on-screen `hz / clarity / rms` proves the pipe
- Power-off stops the graph and releases the mic

## Notes

Do not start audio on page load. iOS resume-on-touch is P06.

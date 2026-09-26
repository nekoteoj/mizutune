#pragma once

// samples → {hz, clarity, rms}. No notes, A4, or tunings.
struct PitchResult {
  float hz;
  float clarity;
  float rms;
};

// WASM clang sret: first arg is PitchResult*. See dsp/check_wasm.mjs.
extern "C" PitchResult pitch_yin(
    const float* samples,
    int n,
    float sample_rate,
    float yin_threshold,
    float rms_gate);

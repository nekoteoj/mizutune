#include "pitch.h"

#include <math.h>

namespace {

// ponytail: guitar window 70–1400 Hz. Widen if bass or high frets miss.
constexpr float k_f_min = 70.f;
constexpr float k_f_max = 1400.f;
constexpr float k_hp_hz = 60.f;
// Rumble hides d'(τ) above the search threshold while d'(4τ) looks perfect.
// Climb only from a low lock, and only to a divisor that is still a valley.
constexpr float k_climb_hz = 150.f;
constexpr double k_climb = 0.45;
// ponytail: static scratch, not re-entrant. Cap 8192; keep the newest samples past that.
constexpr int k_max_n = 8192;

float g_x[k_max_n];
double g_d[k_max_n / 2];

PitchResult gated(float rms) { return {0.f, 0.f, rms}; }

}  // namespace

extern "C" PitchResult pitch_yin(
    const float* samples,
    int n,
    float sample_rate,
    float yin_threshold,
    float rms_gate) {
  if (!samples || n < 4 || !(sample_rate > 0.f)) return gated(0.f);
  if (n > k_max_n) {
    samples += n - k_max_n;
    n = k_max_n;
  }

  double energy = 0;
  for (int i = 0; i < n; ++i) energy += (double)samples[i] * samples[i];
  const float rms = (float)sqrt(energy / n);
  if (!(rms > 0.f) || rms < rms_gate) return gated(rms);

  // 1-pole rumble highpass. Steady-state sine frequency is unchanged.
  const float dt = 1.f / sample_rate;
  const float rc = 1.f / (2.f * 3.14159265f * k_hp_hz);
  const float a = rc / (rc + dt);
  float y = 0.f;
  float prev = samples[0];
  g_x[0] = 0.f;
  for (int i = 1; i < n; ++i) {
    y = a * (y + samples[i] - prev);
    prev = samples[i];
    g_x[i] = y;
  }

  // Drop the HP transient so it cannot pull τ off by a fraction of a sample.
  int start = (int)(sample_rate / k_hp_hz);
  if (start > n / 4) start = n / 4;
  const int len = n - start;
  const float* in = g_x + start;

  int tau_min = (int)(sample_rate / k_f_max);
  if (tau_min < 2) tau_min = 2;
  int tau_max = (int)(sample_rate / k_f_min);
  if ((float)tau_max * k_f_min < sample_rate) ++tau_max;
  const int limit = len / 2 - 1;
  if (tau_max > limit) tau_max = limit;
  if (tau_max <= tau_min + 1 || tau_max >= k_max_n / 2) return gated(rms);

  const int w = len - tau_max;
  for (int tau = 1; tau <= tau_max; ++tau) {
    double sum = 0;
    const float* a_ptr = in;
    const float* b_ptr = in + tau;
    for (int j = 0; j < w; ++j) {
      const double diff = (double)a_ptr[j] - (double)b_ptr[j];
      sum += diff * diff;
    }
    g_d[tau] = sum;
  }

  double acc = 0;
  bool any = false;
  for (int tau = 1; tau <= tau_max; ++tau) {
    acc += g_d[tau];
    if (acc > 0) {
      g_d[tau] = g_d[tau] * (double)tau / acc;
      any = true;
    } else {
      g_d[tau] = 1;
    }
  }
  if (!any) return gated(rms);

  // Absolute threshold: first valley below the threshold, else global min.
  int tau = -1;
  for (int t = tau_min; t <= tau_max; ++t) {
    if (g_d[t] < yin_threshold) {
      while (t + 1 <= tau_max && g_d[t + 1] < g_d[t]) ++t;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    tau = tau_min;
    for (int t = tau_min + 1; t <= tau_max; ++t)
      if (g_d[t] < g_d[tau]) tau = t;
  }

  // ponytail: fixed margin. Prefer 2τ only when it is a clearly better dip —
  // pure sines have d'(τ) ≈ d'(2τ) ≈ 0 and must stay on τ.
  if (tau > 0 && g_d[tau] > 0.05 && tau * 2 <= tau_max) {
    int t2 = tau * 2;
    while (t2 + 1 <= tau_max && g_d[t2 + 1] < g_d[t2]) ++t2;
    if (g_d[t2] + 0.02 < g_d[tau]) tau = t2;
  }

  // E4 + a little 70–90 Hz energy otherwise reports E2/F2/C#2. A real low E
  // has no valley at τ/2, so this does not octave-up the wound strings.
  if (tau > tau_min && sample_rate / (float)tau < k_climb_hz) {
    int climbed = tau;
    for (int div = 2; div <= 4 && tau / div >= tau_min; ++div) {
      const int origin = tau / div;
      const int slack = origin / 8 + 2;
      int lo = origin - slack;
      int hi = origin + slack;
      if (lo < tau_min) lo = tau_min;
      if (hi > tau_max) hi = tau_max;
      int t = lo;
      for (int i = lo + 1; i <= hi; ++i)
        if (g_d[i] < g_d[t]) t = i;
      if (t <= tau_min || t >= tau_max) continue;
      if (g_d[t] > g_d[t - 1] || g_d[t] > g_d[t + 1]) continue;
      if (g_d[t] < k_climb && t < climbed) climbed = t;
    }
    tau = climbed;
  }

  double tau_f = tau;
  if (tau > tau_min && tau < tau_max) {
    const double s0 = g_d[tau - 1];
    const double s1 = g_d[tau];
    const double s2 = g_d[tau + 1];
    const double denom = s0 - 2 * s1 + s2;
    if (denom != 0) {
      double delta = 0.5 * (s0 - s2) / denom;
      if (delta > 1) delta = 1;
      if (delta < -1) delta = -1;
      tau_f = tau + delta;
    }
  }

  PitchResult out = gated(rms);
  if (tau_f >= 1) {
    out.hz = (float)(sample_rate / tau_f);
    float clarity = (float)(1.0 - g_d[tau]);
    if (clarity < 0.f) clarity = 0.f;
    if (clarity > 1.f) clarity = 1.f;
    out.clarity = clarity;
  }
  return out;
}

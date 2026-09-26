#include "pitch.h"

#include <cmath>
#include <cstdio>
#include <cstdint>
#include <vector>

namespace {

constexpr float k_sr = 48000.f;
constexpr int k_n = 4096;
constexpr float k_threshold = 0.1f;
constexpr float k_gate = 0.01f;

int g_fails = 0;
double g_worst = 0;

double hz_of(int midi, double cents) {
  return 440.0 * std::pow(2.0, (midi - 69) / 12.0 + cents / 1200.0);
}

double cents_err(double got, double expect) {
  if (!(got > 0) || !(expect > 0)) return 1e9;
  return 1200.0 * std::log2(got / expect);
}

void add_sine(std::vector<float>& b, double hz, double amp, double phase) {
  const double w = 2.0 * 3.14159265358979323846 * hz / k_sr;
  for (int i = 0; i < (int)b.size(); ++i)
    b[i] += (float)(amp * std::sin(w * i + phase));
}

void expect_hz(const char* label, const std::vector<float>& b, double expect, double limit) {
  const PitchResult r = pitch_yin(b.data(), (int)b.size(), k_sr, k_threshold, k_gate);
  const double err = std::fabs(cents_err(r.hz, expect));
  if (err < 1e8 && err > g_worst) g_worst = err;
  if (!(err < limit) || !(r.clarity > 0.5f)) {
    std::printf("FAIL %s expect %.3f got %.3f err %.3f cent clarity %.3f\n",
                label, expect, r.hz, err, r.clarity);
    ++g_fails;
  }
}

void expect_silent(const char* label, const std::vector<float>& b) {
  const PitchResult r = pitch_yin(b.data(), (int)b.size(), k_sr, k_threshold, k_gate);
  if (r.hz != 0.f || r.clarity != 0.f) {
    std::printf("FAIL %s hz %.3f clarity %.3f rms %.5f\n", label, r.hz, r.clarity, r.rms);
    ++g_fails;
  }
}

}  // namespace

int main() {
  const int open_midi[] = {40, 45, 50, 55, 59, 64};
  const double offsets[] = {0, 10, -10, 50, -50};
  const double phases[] = {0.0, 0.7};

  for (int midi : open_midi) {
    for (double cents : offsets) {
      for (double phase : phases) {
        const double expect = hz_of(midi, cents);
        std::vector<float> b(k_n, 0.f);
        add_sine(b, expect, 0.5, phase);
        char label[64];
        std::snprintf(label, sizeof(label), "midi %d %+.0f cent phase %.1f", midi, cents, phase);
        expect_hz(label, b, expect, 1.0);
      }
    }
  }

  for (int midi : open_midi) {
    const double expect = hz_of(midi, 0);
    std::vector<float> b(k_n, 0.f);
    add_sine(b, expect, 0.5, 0.2);
    add_sine(b, expect * 2, 0.15, 0.2);
    add_sine(b, expect * 3, 0.08, 0.2);
    char label[64];
    std::snprintf(label, sizeof(label), "harmonics midi %d", midi);
    expect_hz(label, b, expect, 2.0);
  }

  expect_silent("silence", std::vector<float>(k_n, 0.f));

  std::vector<float> noise(k_n);
  uint32_t s = 1;
  for (float& v : noise) {
    s = s * 1664525u + 1013904223u;
    v = ((s >> 8) & 0xffff) / 65535.f * 2.f - 1.f;
    v *= 0.001f;
  }
  expect_silent("noise below gate", noise);

  std::vector<float> quiet(k_n, 0.f);
  add_sine(quiet, 110.0, 0.001, 0);
  expect_silent("sine below gate", quiet);

  std::vector<float> a(k_n, 0.f);
  std::vector<float> b(k_n, 0.f);
  add_sine(a, 110.0, 0.5, 0);
  add_sine(b, 196.0, 0.5, 0.4);
  expect_hz("jump 110", a, 110.0, 1.0);
  expect_hz("jump 196", b, 196.0, 1.0);

  // Far mic: weak high string plus low-frequency energy. Must not fall to E2.
  const double e4 = hz_of(64, 0);
  const double b3 = hz_of(59, 0);
  const double e2 = hz_of(40, 0);
  std::vector<float> rumble(k_n, 0.f);
  add_sine(rumble, e4, 0.04, 0.2);
  add_sine(rumble, 78.0, 0.03, 0.5);
  expect_hz("E4 under rumble", rumble, e4, 20.0);

  std::vector<float> hum(k_n, 0.f);
  add_sine(hum, e4, 0.04, 0.2);
  add_sine(hum, 69.3, 0.06, 0.8);
  expect_hz("E4 over C#2 hum", hum, e4, 20.0);

  std::vector<float> both(k_n, 0.f);
  add_sine(both, e4, 0.05, 0.2);
  add_sine(both, e2, 0.04, 0.4);
  expect_hz("E4 over E2", both, e4, 50.0);

  std::vector<float> b_rumble(k_n, 0.f);
  add_sine(b_rumble, b3, 0.04, 0.3);
  add_sine(b_rumble, 70.0, 0.03, 0.8);
  expect_hz("B3 under rumble", b_rumble, b3, 60.0);

  // Climb must not octave-up a real low E whose harmonic is louder than the fundamental.
  std::vector<float> buried(k_n, 0.f);
  add_sine(buried, e2, 0.05, 0.2);
  add_sine(buried, e2 * 2, 0.25, 0.4);
  add_sine(buried, e2 * 3, 0.15, 0.2);
  expect_hz("E2 buried fundamental", buried, e2, 2.0);

  if (g_fails) {
    std::printf("%d failed\n", g_fails);
    return 1;
  }
  std::printf("dsp ok (worst %.3f cent)\n", g_worst);
  return 0;
}

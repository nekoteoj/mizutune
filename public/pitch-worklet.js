// Mic hop → pitch_yin. WASM in this scope; PCM to main if instantiate fails.
// ponytail: YIN on the audio thread (~1 ms / 4096). Longer window: reuse the pcm path.
// sret: result pointer is the first arg. Same call as dsp/check_wasm.mjs.

class PitchProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.window = o.window || 4096;
    this.hop = Math.max(1, Math.round(sampleRate * (o.hopSec || 0.02)));
    this.threshold = o.threshold == null ? 0.1 : o.threshold;
    this.rmsGate = o.rmsGate == null ? 0.001 : o.rmsGate;
    this.buf = new Float32Array(this.window);
    this.write = 0;
    this.filled = 0;
    this.since = 0;
    this.mode = "loading";
    this.exports = null;
    this.view = null;
    this.samplesPtr = 0;
    this.outPtr = 0;
    // ponytail: no fetch here. AudioWorkletGlobalScope has no fetch; main passes bytes.
    if (o.forcePcm) {
      this.mode = "pcm";
      this.port.postMessage({ type: "mode", mode: "pcm" });
    } else {
      this.initWasm(o.wasm);
    }
  }

  initWasm(bytes) {
    const fail = (err) => {
      this.mode = "pcm";
      this.port.postMessage({
        type: "mode",
        mode: "pcm",
        error: err && err.message ? String(err.message) : String(err),
      });
    };
    if (!bytes || typeof WebAssembly === "undefined" || !WebAssembly.instantiate) {
      fail(new Error("wasm unavailable"));
      return;
    }
    try {
      WebAssembly.instantiate(bytes).then(({ instance }) => {
        const exp = instance.exports;
        if (exp._initialize) exp._initialize();
        const samplesPtr = exp.malloc(this.window * 4);
        const outPtr = exp.malloc(16);
        if (!samplesPtr || !outPtr) throw new Error("wasm malloc failed");
        this.exports = exp;
        this.samplesPtr = samplesPtr;
        this.outPtr = outPtr;
        this.view = new Float32Array(exp.memory.buffer, samplesPtr, this.window);
        this.mode = "wasm";
        this.port.postMessage({ type: "mode", mode: "wasm" });
      }).catch(fail);
    } catch (err) {
      fail(err);
    }
  }

  copyInto(into) {
    const w = this.write;
    into.set(this.buf.subarray(w), 0);
    if (w) into.set(this.buf.subarray(0, w), this.window - w);
  }

  postPitch() {
    this.copyInto(this.view);
    this.exports.pitch_yin(
      this.outPtr,
      this.samplesPtr,
      this.window,
      sampleRate,
      this.threshold,
      this.rmsGate,
    );
    const out = new Float32Array(this.exports.memory.buffer, this.outPtr, 3);
    this.port.postMessage({ type: "pitch", hz: out[0], clarity: out[1], rms: out[2] });
  }

  postPcm() {
    const samples = new Float32Array(this.window);
    this.copyInto(samples);
    this.port.postMessage({ type: "pcm", sampleRate, samples }, [samples.buffer]);
  }

  process(inputs, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (out) out.fill(0);
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.write] = ch[i];
      this.write++;
      if (this.write === this.window) this.write = 0;
      if (this.filled < this.window) this.filled++;
      this.since++;
    }
    if (this.mode === "loading" || this.filled < this.window || this.since < this.hop) return true;
    // ponytail: one analysis per quantum. Hop is ~8 quanta; drop a backlog instead of stalling.
    this.since %= this.hop;
    try {
      if (this.mode === "wasm") this.postPitch();
      else this.postPcm();
    } catch (err) {
      this.mode = "pcm";
      this.port.postMessage({
        type: "mode",
        mode: "pcm",
        error: err && err.message ? String(err.message) : String(err),
      });
      try {
        this.postPcm();
      } catch {
        // keep the processor alive
      }
    }
    return true;
  }
}

registerProcessor("mizutune-pitch", PitchProcessor);

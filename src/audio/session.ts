import { createSignal, onCleanup } from "solid-js";
import { RMS_GATE } from "../tuning/map";

export const WINDOW = 4096;
export const HOP_SEC = 0.02;
export const YIN_THRESHOLD = 0.1;

const WASM_URL = `${import.meta.env.BASE_URL}mizutune.wasm`;
const WORKLET_URL = `${import.meta.env.BASE_URL}pitch-worklet.js`;
const SILENT = { hz: 0, clarity: 0, rms: 0 };

export type PitchFrame = { hz: number; clarity: number; rms: number };

export type Mode = "wasm" | "pcm";
type WorkletMessage =
  | { type: "mode"; mode: Mode; error?: string }
  | { type: "pitch"; hz: number; clarity: number; rms: number }
  | { type: "pcm"; sampleRate: number; samples: Float32Array };

type Graph = {
  ctx: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  mute: GainNode;
};

type WasmExports = {
  memory: WebAssembly.Memory;
  pitch_yin: (
    outPtr: number,
    samplesPtr: number,
    n: number,
    sampleRate: number,
    threshold: number,
    rmsGate: number,
  ) => void;
  malloc: (bytes: number) => number;
  _initialize?: () => void;
};

function release(graph: Graph | null) {
  if (!graph) return;
  graph.node.port.onmessage = null;
  graph.source.disconnect();
  graph.node.disconnect();
  graph.mute.disconnect();
  for (const track of graph.stream.getTracks()) track.stop();
  void graph.ctx.close().catch(() => {});
}

function abort(ctx: AudioContext, stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
  void ctx.close().catch(() => {});
}

async function fetchWasmBytes() {
  const res = await fetch(WASM_URL);
  if (!res.ok) throw new Error(`wasm ${res.status}`);
  return res.arrayBuffer();
}

async function loadPitchWasm(bytes: ArrayBuffer) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const exp = instance.exports as WasmExports;
  exp._initialize?.();
  const samplesPtr = exp.malloc(WINDOW * 4);
  const outPtr = exp.malloc(16);
  if (!samplesPtr || !outPtr) throw new Error("wasm malloc failed");
  return {
    run(samples: Float32Array, sampleRate: number): PitchFrame {
      new Float32Array(exp.memory.buffer, samplesPtr, WINDOW).set(samples);
      // clang wasm sret: result pointer is the first argument. See dsp/check_wasm.mjs.
      exp.pitch_yin(outPtr, samplesPtr, WINDOW, sampleRate, YIN_THRESHOLD, RMS_GATE);
      const out = new Float32Array(exp.memory.buffer, outPtr, 3);
      return { hz: out[0], clarity: out[1], rms: out[2] };
    },
  };
}

const MIC_OFF = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};
const MIC_IDEAL = {
  echoCancellation: { ideal: false },
  noiseSuppression: { ideal: false },
  autoGainControl: { ideal: false },
};

function overconstrained(err: unknown) {
  return err instanceof Error && err.name === "OverconstrainedError";
}

async function openMic() {
  // ponytail: one retry. If iOS rejects exact false past the gesture, drop exact and keep ideal.
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: MIC_OFF });
  } catch (err) {
    if (!overconstrained(err)) throw err;
    return navigator.mediaDevices.getUserMedia({ audio: MIC_IDEAL });
  }
}

export function debugStatus(frame: PitchFrame, mode: Mode | null) {
  return `${frame.hz.toFixed(1)}Hz c${frame.clarity.toFixed(2)} r${frame.rms.toFixed(3)} ${mode ?? "…"}`;
}

export function createAudioSession() {
  const [power, setPower] = createSignal(false);
  const [pitch, setPitch] = createSignal<PitchFrame>(SILENT);
  const [mode, setMode] = createSignal<Mode | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  let graph: Graph | null = null;
  let token = 0;
  let starting = false;
  let analyzing = false;
  let wasmBytes: ArrayBuffer | null = null;
  let runner: ReturnType<typeof loadPitchWasm> | null = null;

  function stop() {
    token++;
    release(graph);
    graph = null;
    runner = null;
    wasmBytes = null;
    analyzing = false;
    setPower(false);
    setPitch(SILENT);
    setMode(null);
  }

  async function onPcm(samples: Float32Array, sampleRate: number, gen: number) {
    // ponytail: drop a hop if the previous one is still in WASM. 20 ms is the budget.
    if (analyzing || gen !== token) return;
    analyzing = true;
    try {
      if (!wasmBytes) throw new Error("wasm missing");
      runner ??= loadPitchWasm(wasmBytes);
      const wasm = await runner;
      if (gen !== token) return;
      setPitch(wasm.run(samples, sampleRate));
    } catch (err) {
      runner = null;
      if (gen === token) setError(err instanceof Error ? err.message : String(err));
    } finally {
      analyzing = false;
    }
  }

  async function start() {
    if (power() || starting) return;
    starting = true;
    const gen = ++token;
    setError(null);
    // Context + resume stay in the gesture. Permission await must not come first.
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const wasmReady = fetchWasmBytes();
    void wasmReady.catch(() => {});
    let stream: MediaStream | null = null;
    let node: AudioWorkletNode | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("microphone unavailable");
      stream = await openMic();
      if (gen !== token) return abort(ctx, stream);
      wasmBytes = await wasmReady;
      if (gen !== token) return abort(ctx, stream);
      await ctx.audioWorklet.addModule(WORKLET_URL);
      if (gen !== token) return abort(ctx, stream);
      node = new AudioWorkletNode(ctx, "mizutune-pitch", {
        processorOptions: {
          window: WINDOW,
          hopSec: HOP_SEC,
          threshold: YIN_THRESHOLD,
          rmsGate: RMS_GATE,
          forcePcm: new URLSearchParams(location.search).has("pcm"),
          wasm: wasmBytes,
        },
      });
      node.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
        if (gen !== token) return;
        const data = event.data;
        if (data.type === "mode") {
          setMode(data.mode);
          return;
        }
        if (data.type === "pitch") {
          setPitch({ hz: data.hz, clarity: data.clarity, rms: data.rms });
          return;
        }
        void onPcm(data.samples, data.sampleRate, gen);
      };
      const source = ctx.createMediaStreamSource(stream);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node);
      node.connect(mute);
      mute.connect(ctx.destination);
      if (ctx.state !== "running") await ctx.resume().catch(() => {});
      if (gen !== token) {
        release({ ctx, stream, source, node, mute });
        return;
      }
      graph = { ctx, stream, source, node, mute };
      setPower(true);
    } catch (err) {
      if (node) node.port.onmessage = null;
      abort(ctx, stream);
      if (gen === token) setError(err instanceof Error ? err.message : String(err));
    } finally {
      starting = false;
    }
  }

  const resume = () => {
    const ctx = graph?.ctx;
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
  };
  const doc = globalThis.document;
  if (doc) {
    doc.addEventListener("pointerdown", resume, true);
    onCleanup(() => doc.removeEventListener("pointerdown", resume, true));
  }

  onCleanup(() => {
    token++;
    release(graph);
    graph = null;
  });

  return { power, pitch, mode, error, start, stop };
}

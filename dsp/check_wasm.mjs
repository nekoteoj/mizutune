import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wasmPath = join(dirname(fileURLToPath(import.meta.url)), "../public/mizutune.wasm");
const { instance } = await WebAssembly.instantiate(await readFile(wasmPath));
const { memory, pitch_yin, malloc, free, _initialize } = instance.exports;
_initialize?.();

const n = 4096;
const sr = 48000;
const hz = 110;
const samplesPtr = malloc(n * 4);
const outPtr = malloc(16);
const samples = new Float32Array(memory.buffer, samplesPtr, n);
for (let i = 0; i < n; i++) samples[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / sr);

// clang wasm sret: result pointer is the first argument.
pitch_yin(outPtr, samplesPtr, n, sr, 0.1, 0.01);
const [got, clarity, rms] = new Float32Array(memory.buffer, outPtr, 3);
const cents = Math.abs(1200 * Math.log2(got / hz));
if (!(cents < 1) || !(clarity > 0.5) || !(rms > 0)) {
  throw new Error(`wasm pitch got ${got} clarity ${clarity} rms ${rms} (${cents.toFixed(3)} cent)`);
}
samples.fill(0);
pitch_yin(outPtr, samplesPtr, n, sr, 0.1, 0.01);
const silent = new Float32Array(memory.buffer, outPtr, 3);
if (silent[0] !== 0 || silent[1] !== 0) {
  throw new Error(`wasm silence hz ${silent[0]} clarity ${silent[1]}`);
}
free(samplesPtr);
free(outPtr);
process.stdout.write(`wasm ok ${got.toFixed(2)} Hz\n`);

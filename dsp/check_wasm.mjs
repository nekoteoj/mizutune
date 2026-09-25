import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wasmPath = join(dirname(fileURLToPath(import.meta.url)), "../public/mizutune.wasm");
const { instance } = await WebAssembly.instantiate(await readFile(wasmPath));
const add = instance.exports.add ?? instance.exports._add;
if (typeof add !== "function" || add(2, 3) !== 5) {
  throw new Error("wasm add(2, 3) !== 5");
}
console.log("wasm ok");

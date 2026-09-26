import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import solid from "@solidjs/vite-plugin";
import { defineConfig, type Plugin } from "vitest/config";

// Node's export condition loads solid-js/dist/server.js, where store writes are no-ops.
const solidClient = new URL("./node_modules/solid-js/dist/solid.dev.js", import.meta.url).pathname;

const PUBLIC_SHELL = [
  "/manifest.webmanifest",
  "/pitch-worklet.js",
  "/mizutune.wasm",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

function publicStamp() {
  const hash = createHash("sha256");
  for (const url of PUBLIC_SHELL) {
    const path = `public${url}`;
    hash.update(existsSync(path) ? readFileSync(path) : url);
  }
  return hash.digest("hex").slice(0, 8);
}

function serviceWorker(): Plugin {
  let base = "/";
  return {
    name: "mizutune-sw",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
      const at = (path: string) => `${prefix}${path}`;
      const urls = [at("/"), ...PUBLIC_SHELL.map(at)];
      for (const item of Object.values(bundle)) {
        if (item.type === "chunk" || item.fileName.endsWith(".css")) urls.push(at(`/${item.fileName}`));
      }
      if (!urls.some((url) => url.endsWith(".js") && url.includes("/assets/"))) {
        this.error("service worker shell is missing the app script");
      }
      // ponytail: stamp stable names (wasm, worklet). URL list alone would keep a stale wasm.
      const cache = `mizutune-${publicStamp()}-${createHash("sha256").update(urls.join("\0")).digest("hex").slice(0, 8)}`;
      const swPath = at("/sw.js");
      const shellPath = at("/");
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE = ${JSON.stringify(cache)};
const SHELL = ${JSON.stringify(urls)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname === ${JSON.stringify(swPath)}) return;
  if (req.headers.has("range")) return;
  event.respondWith(load(req));
});

async function load(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (err) {
    if (req.mode === "navigate") {
      const shell = await cache.match(${JSON.stringify(shellPath)});
      if (shell) return shell;
    }
    throw err;
  }
}
`,
      });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [solid(), serviceWorker()],
  test: {
    environment: "node",
    alias: { "solid-js": solidClient },
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});

import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vitest/config";

// Node's export condition loads solid-js/dist/server.js, where store writes are no-ops.
const solidClient = new URL("./node_modules/solid-js/dist/solid.dev.js", import.meta.url).pathname;

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: "node",
    alias: { "solid-js": solidClient },
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});

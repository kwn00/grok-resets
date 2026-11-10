import { defineConfig } from "vitest/config";
import { writeApi } from "./scripts/generate-api";

export default defineConfig({
  plugins: [
    {
      name: "grok-resets-api",
      buildStart() {
        if (process.env.VITEST) return;
        writeApi();
      },
      configureServer() {
        writeApi();
      },
    },
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

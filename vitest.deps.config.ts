import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.deps.test.ts"],
    testTimeout: 60_000,
  },
});

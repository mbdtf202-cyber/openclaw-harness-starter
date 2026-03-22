import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.fault.test.ts"],
    testTimeout: 60_000,
  },
});

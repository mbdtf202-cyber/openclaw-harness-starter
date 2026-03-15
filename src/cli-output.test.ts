import { describe, expect, it } from "vitest";
import { captureProcessWrites } from "./harness/cli-output.js";

describe("cli output harness", () => {
  it("captures stdout and stderr without per-test spies", async () => {
    const { stdout, stderr } = await captureProcessWrites({
      run: async () => {
        process.stdout.write("hello stdout\n");
        process.stderr.write("hello stderr\n");
      },
    });

    expect(stdout).toContain("hello stdout");
    expect(stderr).toContain("hello stderr");
  });
});

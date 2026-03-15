import { describe, expect, it } from "vitest";
import { captureProcessWrites } from "openclaw/plugin-sdk/test-utils";

describe("cli output harness", () => {
  it("captures stdout and stderr without custom spies in every test", async () => {
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

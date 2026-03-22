import { describe, expect, it } from "vitest";
import { resolveParallelsScript } from "./harness/vm/parallels.js";

describe("vm runner", () => {
  it("maps each vm lane to the expected OpenClaw Parallels script", () => {
    expect(resolveParallelsScript("macos")).toBe("scripts/e2e/parallels-macos-smoke.sh");
    expect(resolveParallelsScript("windows")).toBe("scripts/e2e/parallels-windows-smoke.sh");
    expect(resolveParallelsScript("linux")).toBe("scripts/e2e/parallels-linux-smoke.sh");
  });
});

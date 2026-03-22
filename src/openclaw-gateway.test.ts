import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnOpenClawGateway } from "./harness/openclaw-gateway.js";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("spawnOpenClawGateway", () => {
  it("surfaces startup failures with captured process diagnostics", async () => {
    const repoDir = await makeTempDir("openclaw-starter-gateway-fail-");
    await fs.writeFile(path.join(repoDir, "package.json"), JSON.stringify({ name: "openclaw" }), "utf8");
    await fs.mkdir(path.join(repoDir, "dist"), { recursive: true });
    await fs.writeFile(
      path.join(repoDir, "dist", "index.js"),
      'console.error("starter harness bootstrap failed"); process.exit(42);\n',
      "utf8",
    );

    await expect(
      spawnOpenClawGateway({
        name: "fail-fast",
        repoDir,
      }),
    ).rejects.toThrow("starter harness bootstrap failed");
  });
});

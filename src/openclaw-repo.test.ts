import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOpenClawRepo } from "./harness/openclaw-repo.js";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function writeOpenClawRepo(root: string, withDist = true): Promise<void> {
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "openclaw" }), "utf8");
  if (!withDist) {
    return;
  }
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  await fs.writeFile(path.join(root, "dist", "index.js"), "export {};\n", "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("resolveOpenClawRepo", () => {
  it("auto-discovers an ancestor openclaw checkout from nested starter paths", async () => {
    const root = await makeTempDir("openclaw-starter-auto-");
    await writeOpenClawRepo(root);
    const nested = path.join(root, "related", "openclaw-harness-starter");
    await fs.mkdir(nested, { recursive: true });

    const resolved = await resolveOpenClawRepo({ cwd: nested, env: {} });

    expect(resolved.repoDir).toBe(root);
    expect(resolved.source).toBe("auto");
    expect(resolved.entryPath).toBe(path.join(root, "dist", "index.js"));
  });

  it("prefers OPENCLAW_REPO_DIR when provided", async () => {
    const root = await makeTempDir("openclaw-starter-env-");
    await writeOpenClawRepo(root);

    const resolved = await resolveOpenClawRepo({
      cwd: await makeTempDir("openclaw-starter-env-cwd-"),
      env: { OPENCLAW_REPO_DIR: root },
    });

    expect(resolved.repoDir).toBe(root);
    expect(resolved.source).toBe("env");
  });

  it("throws a helpful error when the repo exists but dist output is missing", async () => {
    const root = await makeTempDir("openclaw-starter-missing-dist-");
    await writeOpenClawRepo(root, false);

    await expect(
      resolveOpenClawRepo({
        cwd: root,
        env: { OPENCLAW_REPO_DIR: root },
      }),
    ).rejects.toThrow("Run `pnpm build` inside the OpenClaw checkout first.");
  });

  it("throws a helpful error when no openclaw checkout can be found", async () => {
    const cwd = await makeTempDir("openclaw-starter-missing-repo-");

    await expect(resolveOpenClawRepo({ cwd, env: {} })).rejects.toThrow(
      "Could not locate an OpenClaw checkout.",
    );
  });
});

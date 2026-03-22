import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type StarterManifest = {
  starterVersion: string;
  files: string[];
};

describe("starter.manifest.json", () => {
  it("declares the starter version and only tracked scaffold files", async () => {
    const root = path.resolve(import.meta.dirname, "..");
    const manifestPath = path.join(root, "starter.manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as StarterManifest;

    expect(manifest.starterVersion).toBe("2026.3.23.0");
    expect(manifest.files.length).toBeGreaterThan(0);

    for (const relativePath of manifest.files) {
      await expect(fs.access(path.join(root, relativePath))).resolves.toBeUndefined();
    }
  });
});

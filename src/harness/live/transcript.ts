import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LiveRunSummary } from "./types.js";

export async function createLiveArtifactsDir(channel: string): Promise<string> {
  const root = process.env.OPENCLAW_HARNESS_ARTIFACT_DIR
    ? path.resolve(process.env.OPENCLAW_HARNESS_ARTIFACT_DIR)
    : path.join(os.tmpdir(), "openclaw-harness-artifacts");
  const artifactsDir = path.join(root, "live", channel, Date.now().toString());
  await fs.mkdir(artifactsDir, { recursive: true });
  return artifactsDir;
}

export async function writeLiveArtifact(
  artifactsDir: string,
  fileName: string,
  content: string,
): Promise<string> {
  const filePath = path.join(artifactsDir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

export async function writeLiveSummary(
  artifactsDir: string,
  summary: LiveRunSummary,
): Promise<string> {
  return await writeLiveArtifact(
    artifactsDir,
    "summary.json",
    `${JSON.stringify(summary, null, 2)}\n`,
  );
}

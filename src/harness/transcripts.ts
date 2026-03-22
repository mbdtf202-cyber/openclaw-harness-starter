import fs from "node:fs/promises";
import path from "node:path";

export type TranscriptSearchMatch = {
  file: string;
  line: string;
};

async function collectTranscriptFiles(rootDir: string): Promise<string[]> {
  const matches: string[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && fullPath.endsWith(".jsonl")) {
        matches.push(fullPath);
      }
    }
  }

  try {
    await walk(rootDir);
  } catch {
    return [];
  }
  return matches.sort();
}

export async function findTextInTranscripts(
  stateDir: string,
  needle: string,
): Promise<TranscriptSearchMatch[]> {
  const transcriptFiles = await collectTranscriptFiles(stateDir);
  const matches: TranscriptSearchMatch[] = [];
  for (const file of transcriptFiles) {
    const text = await fs.readFile(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (line.includes(needle)) {
        matches.push({ file, line });
      }
    }
  }
  return matches;
}

export async function waitForTextInTranscripts(params: {
  stateDir: string;
  needle: string;
  timeoutMs?: number;
}): Promise<TranscriptSearchMatch[]> {
  const timeoutMs = params.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const matches = await findTextInTranscripts(params.stateDir, params.needle);
    if (matches.length > 0) {
      return matches;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for transcript text: ${params.needle}`);
}

import fs from "node:fs/promises";
import path from "node:path";

export type OpenClawRepoResolution = {
  repoDir: string;
  entryPath: string;
  source: "explicit" | "env" | "auto";
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isOpenClawRepo(repoDir: string): Promise<boolean> {
  const packageJsonPath = path.join(repoDir, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return false;
  }

  try {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { name?: unknown };
    return pkg.name === "openclaw";
  } catch {
    return false;
  }
}

async function resolveOpenClawEntry(repoDir: string): Promise<string> {
  for (const candidate of [path.join(repoDir, "dist/index.js"), path.join(repoDir, "dist/index.mjs")]) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `OpenClaw build output was not found under ${path.join(repoDir, "dist")}. ` +
      `Run \`pnpm build\` inside the OpenClaw checkout first.`,
  );
}

export async function resolveOpenClawRepo(params: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  repoDir?: string;
} = {}): Promise<OpenClawRepoResolution> {
  const cwd = params.cwd ?? process.cwd();
  const env = params.env ?? process.env;

  const candidates = [
    { dir: params.repoDir, source: "explicit" as const },
    { dir: env.OPENCLAW_REPO_DIR, source: "env" as const },
  ];

  for (const candidate of candidates) {
    if (typeof candidate.dir !== "string" || !candidate.dir.trim()) {
      continue;
    }
    const repoDir = path.resolve(candidate.dir);
    if (!(await isOpenClawRepo(repoDir))) {
      continue;
    }
    return {
      repoDir,
      entryPath: await resolveOpenClawEntry(repoDir),
      source: candidate.source,
    };
  }

  let current = path.resolve(cwd);
  while (true) {
    for (const candidateDir of [current, path.join(current, "openclaw")]) {
      if (!(await isOpenClawRepo(candidateDir))) {
        continue;
      }
      return {
        repoDir: candidateDir,
        entryPath: await resolveOpenClawEntry(candidateDir),
        source: "auto",
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    "Could not locate an OpenClaw checkout. " +
      "Set OPENCLAW_REPO_DIR=/absolute/path/to/openclaw or run this starter " +
      "from inside or beneath an `openclaw` checkout.",
  );
}

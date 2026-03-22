import path from "node:path";
import { spawn } from "node:child_process";
import { resolveOpenClawRepo } from "../openclaw-repo.js";

export type VmOs = "macos" | "windows" | "linux";

export function resolveParallelsScript(os: VmOs): string {
  switch (os) {
    case "macos":
      return "scripts/e2e/parallels-macos-smoke.sh";
    case "windows":
      return "scripts/e2e/parallels-windows-smoke.sh";
    case "linux":
      return "scripts/e2e/parallels-linux-smoke.sh";
  }
}

export async function runVmLane(params: {
  os: VmOs;
  forwardedArgs?: string[];
  repoDir?: string;
}): Promise<void> {
  const repo = await resolveOpenClawRepo({
    cwd: process.cwd(),
    env: process.env,
    repoDir: params.repoDir,
  });
  const scriptPath = path.join(repo.repoDir, resolveParallelsScript(params.os));

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("bash", [scriptPath, ...(params.forwardedArgs ?? [])], {
      cwd: repo.repoDir,
      env: process.env,
      stdio: "inherit",
    });
    proc.once("error", reject);
    proc.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`VM lane ${params.os} failed with exit code ${String(code)}.`));
    });
  });
}

import { parseArgs } from "node:util";
import { resolveParallelsScript, runVmLane, type VmOs } from "./parallels.js";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: "boolean" },
      os: { type: "string" },
    },
  });

  const targets: VmOs[] = values.all
    ? ["macos", "windows", "linux"]
    : values.os
      ? [values.os as VmOs]
      : [];

  if (targets.length === 0) {
    throw new Error("Pass --all or --os <macos|windows|linux>.");
  }

  for (const os of targets) {
    process.stdout.write(`Running ${os} via ${resolveParallelsScript(os)}\n`);
    await runVmLane({
      os,
      forwardedArgs: positionals,
    });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

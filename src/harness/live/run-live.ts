import { parseArgs } from "node:util";
import { runLiveRoundtrip } from "./runner.js";
import { resolveChannelList } from "./provider-utils.js";
import type { LiveChannel, LiveRunSummary } from "./types.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      all: { type: "boolean" },
      channel: { type: "string" },
    },
  });

  const channels = values.all
    ? resolveChannelList()
    : values.channel
      ? [values.channel as LiveChannel]
      : [];

  if (channels.length === 0) {
    throw new Error("Pass --all or --channel <discord|telegram|slack|mattermost>.");
  }

  const summaries: LiveRunSummary[] = [];
  for (const channel of channels) {
    summaries.push(await runLiveRoundtrip(channel));
  }

  process.stdout.write(`${JSON.stringify(summaries, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

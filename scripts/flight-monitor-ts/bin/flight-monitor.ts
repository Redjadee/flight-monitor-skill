#!/usr/bin/env node
import { cmdSetup } from "../commands/setup.js";
import { cmdAdd } from "../commands/add.js";
import { cmdList } from "../commands/list.js";
import { cmdRemove } from "../commands/remove.js";
import { cmdSetCron } from "../commands/set-cron.js";
import { cmdCheck } from "../commands/check.js";
import { cmdDebug } from "../commands/debug.js";
import { cmdVersion, VERSION } from "../commands/version.js";

function usage(): void {
  process.stdout.write(`flight-monitor ${VERSION} — Amadeus flight price monitor for OpenClaw

Usage:
  flight-monitor setup      --client-id <id> --client-secret <secret>
                            [--currency CNY] [--bin-path /usr/local/bin/flight-monitor]
                            [--no-install]

  flight-monitor add        --origin <IATA|city> --destination <IATA|city>
                            --depart-date <YYYY-MM-DD> --discord-channel <channel-id>
                            [--alert-days 7] [--flex-days 3] [--return-date <YYYY-MM-DD>]
                            [--cabin ECONOMY|BUSINESS|FIRST|PREMIUM_ECONOMY]
                            [--adults 1] [--nonstop] [--airlines CA,CX]
                            [--check-interval 1d]

  flight-monitor list
  flight-monitor remove     <monitor-id>
  flight-monitor set-cron   --monitor-id <id> --cron-id <cron-job-id>
  flight-monitor check      <monitor-id>
  flight-monitor debug      [<origin> <destination> <YYYY-MM-DD>]
  flight-monitor version

Data: ~/.flight-monitor/
`);
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;

  switch (cmd) {
    case "setup":           await cmdSetup(rest); break;
    case "add":             await cmdAdd(rest); break;
    case "list":            cmdList(); break;
    case "remove":          cmdRemove(rest); break;
    case "set-cron":        cmdSetCron(rest); break;
    case "check":           await cmdCheck(rest); break;
    case "debug":           await cmdDebug(rest); break;
    case "version":         cmdVersion(); break;
    case "-h":
    case "--help":
    case "help":            usage(); break;
    case undefined:         usage(); break;
    default:
      process.stderr.write(`{"error":"Unknown command: ${cmd}. Run 'flight-monitor help'"}\n`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`{"error":"${String(err)}"}\n`);
  process.exit(1);
});

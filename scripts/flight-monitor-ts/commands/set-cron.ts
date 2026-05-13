import { readFileSync, writeFileSync } from "node:fs";
import { MONITORS_FILE, type Monitor } from "../lib/config.js";
import { die, ensureDirs } from "../lib/utils.js";

export function cmdSetCron(args: string[]): void {
  let monitorId = "";
  let cronId = "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--monitor-id": monitorId = args[++i]; break;
      case "--cron-id":    cronId = args[++i]; break;
      default: die(`Unknown option: ${args[i]}`);
    }
  }

  if (!monitorId) die("--monitor-id is required");
  if (!cronId) die("--cron-id is required");

  ensureDirs();

  const monitors = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  const idx = monitors.findIndex((m) => m.id === monitorId);
  if (idx === -1) die(`Monitor not found: ${monitorId}`);

  monitors[idx].cron_job_id = cronId;
  writeFileSync(MONITORS_FILE, JSON.stringify(monitors, null, 2), "utf8");

  process.stdout.write(
    JSON.stringify({ status: "ok", monitor_id: monitorId, cron_job_id: cronId }) + "\n"
  );
}

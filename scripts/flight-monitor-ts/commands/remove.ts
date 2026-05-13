import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HISTORY_DIR, MONITORS_FILE, type Monitor } from "../lib/config.js";
import { die, ensureDirs } from "../lib/utils.js";

export function cmdRemove(args: string[]): void {
  const monitorId = args[0];
  if (!monitorId) die("Usage: flight-monitor remove <monitor-id>");

  ensureDirs();

  const monitors = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  const monitor = monitors.find((m) => m.id === monitorId);
  if (!monitor) die(`Monitor not found: ${monitorId}`);

  const cronId = monitor.cron_job_id ?? "";
  const updated = monitors.filter((m) => m.id !== monitorId);
  writeFileSync(MONITORS_FILE, JSON.stringify(updated, null, 2), "utf8");

  const histFile = join(HISTORY_DIR, `${monitorId}.csv`);
  const historyRemoved = existsSync(histFile);
  if (historyRemoved) rmSync(histFile);

  process.stdout.write(
    JSON.stringify({ status: "ok", removed: monitorId, cron_job_id: cronId, history_removed: historyRemoved }) + "\n"
  );
}

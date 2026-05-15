import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HISTORY_DIR, MONITORS_FILE, type Monitor } from "./config.js";
import { nowIso } from "./utils.js";
import type { Offer } from "./search.js";

export function appendHistory(monitorId: string, offer: Offer): void {
  const histFile = join(HISTORY_DIR, `${monitorId}.csv`);
  if (!existsSync(histFile)) {
    writeFileSync(histFile, "timestamp,date,price,currency,carrier,flight,duration\n", "utf8");
  }

  const monitors = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  const monitor = monitors.find((m) => m.id === monitorId);
  const currency = monitor?.currency ?? "USD";

  appendFileSync(
    histFile,
    `${nowIso()},${offer.date},${offer.price},${currency},${offer.carrier},${offer.flight},${offer.duration}\n`,
    "utf8"
  );
}

export function calcAveragePrice(monitorId: string, days: number): number | null {
  const histFile = join(HISTORY_DIR, `${monitorId}.csv`);
  if (!existsSync(histFile)) return null;

  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

  const lines = readFileSync(histFile, "utf8").split("\n").slice(1); // skip header
  const prices: number[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols[0] >= cutoff) {
      const p = parseFloat(cols[2]);
      if (!isNaN(p)) prices.push(p);
    }
  }

  if (!prices.length) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

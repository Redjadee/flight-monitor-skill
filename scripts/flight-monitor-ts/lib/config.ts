import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { die } from "./utils.js";

export const FM_DIR = join(homedir(), ".flight-monitor");
export const CONFIG_FILE = join(FM_DIR, "config");
export const MONITORS_FILE = join(FM_DIR, "monitors.json");
export const HISTORY_DIR = join(FM_DIR, "history");
export const TOKEN_CACHE = join(FM_DIR, ".token_cache");

export const AMADEUS_BASE = "https://api.amadeus.com";
export const INSTALL_BIN = "/usr/local/bin/flight-monitor";

export interface Credentials {
  clientId: string;
  clientSecret: string;
  currency: string;
}

export function loadCredentials(): Credentials {
  if (existsSync(CONFIG_FILE)) {
    const lines = readFileSync(CONFIG_FILE, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1).replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }

  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  const currency = process.env.AMADEUS_CURRENCY ?? "CNY";

  if (!clientId || !clientSecret) {
    die("Not configured. Run: flight-monitor setup --client-id <id> --client-secret <secret>");
  }

  return { clientId, clientSecret, currency };
}

export interface Monitor {
  id: string;
  origin: string;
  destination: string;
  depart_date: string;
  flex_days: number;
  return_date: string | null;
  cabin: string;
  adults: number;
  nonstop: boolean;
  airlines: string[];
  alert_days: number;
  discord_channel_id: string;
  currency: string;
  check_interval: string;
  cron_job_id: string | null;
  status: string;
  created_at: string;
  last_checked: string | null;
  last_price: number | null;
  last_flight: string | null;
}

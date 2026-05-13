import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { MONITORS_FILE, FM_DIR, HISTORY_DIR } from "./config.js";

export function die(msg: string): never {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  process.exit(1);
}

export function info(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

/** Unix epoch of today's midnight UTC (no time-of-day component). */
export function todayMidnightEpoch(): number {
  return dateToEpoch(new Date().toISOString().slice(0, 10));
}

export function genId(): string {
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

export function ensureDirs(): void {
  mkdirSync(FM_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });
  if (!existsSync(MONITORS_FILE)) {
    writeFileSync(MONITORS_FILE, "[]", "utf8");
  }
}

export function flightsLink(
  origin: string,
  dest: string,
  date: string,
  cabin: string,
  returnDate?: string
): string {
  const cabinCodes: Record<string, string> = {
    PREMIUM_ECONOMY: "p",
    BUSINESS: "j",
    FIRST: "f",
  };
  const c = cabinCodes[cabin] ?? "e";
  if (returnDate) {
    return `https://www.google.com/flights#flt=${origin}.${dest}.${date};${dest}.${origin}.${returnDate};c:${c};e:1`;
  }
  return `https://www.google.com/flights#flt=${origin}.${dest}.${date};c:${c};e:1`;
}

/** Shift a YYYY-MM-DD date by offsetDays. */
export function shiftDate(dateStr: string, offsetDays: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string into a Unix epoch (seconds). */
export function dateToEpoch(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

import { readFileSync } from "node:fs";
import { MONITORS_FILE } from "../lib/config.js";
import { ensureDirs } from "../lib/utils.js";

export function cmdList(): void {
  ensureDirs();
  const data = readFileSync(MONITORS_FILE, "utf8");
  process.stdout.write(JSON.stringify(JSON.parse(data), null, 2) + "\n");
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function readVersion(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  // walk up to find package.json (works both from src and dist)
  let cur = dir;
  while (true) {
    const candidate = join(cur, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8"));
      if (pkg.name === "flight-monitor") return pkg.version ?? "unknown";
    } catch {}
    const parent = dirname(cur);
    if (parent === cur) return "unknown";
    cur = parent;
  }
}

export const VERSION = readVersion();

export function cmdVersion(): void {
  process.stdout.write(`flight-monitor ${VERSION}\n`);
}

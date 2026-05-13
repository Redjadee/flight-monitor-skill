import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONFIG_FILE } from "../lib/config.js";
import { die, info, ensureDirs } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

function findPkgDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) die("Could not locate package root");
    dir = parent;
  }
}

export async function cmdSetup(args: string[]): Promise<void> {
  let clientId = "";
  let clientSecret = "";
  let currency = "";
  let installCli = true;

  const req = (flag: string, val: string | undefined): string => {
    if (!val) die(`${flag} requires a value`);
    return val;
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--client-id":     clientId = req("--client-id", args[++i]); break;
      case "--client-secret": clientSecret = req("--client-secret", args[++i]); break;
      case "--currency":      currency = req("--currency", args[++i]); break;
      case "--no-install":    installCli = false; break;
      default: die(`Unknown option: ${args[i]}`);
    }
  }

  // Load existing config so re-running without flags reuses saved credentials
  if (existsSync(CONFIG_FILE)) {
    for (const line of readFileSync(CONFIG_FILE, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1).replace(/^"|"$/g, "");
      if (key === "AMADEUS_CLIENT_ID" && !clientId) clientId = val;
      if (key === "AMADEUS_CLIENT_SECRET" && !clientSecret) clientSecret = val;
      if (key === "AMADEUS_CURRENCY" && !currency) currency = val;
    }
  }

  if (!currency) currency = "CNY";
  if (!clientId) die("--client-id is required (or run setup after credentials are already configured)");
  if (!clientSecret) die("--client-secret is required (or run setup after credentials are already configured)");

  ensureDirs();

  info("Validating Amadeus credentials...");
  process.env.AMADEUS_CLIENT_ID = clientId;
  process.env.AMADEUS_CLIENT_SECRET = clientSecret;
  await getToken(clientId, clientSecret);
  info("  ✓ Credentials valid");

  const configContent = `AMADEUS_CLIENT_ID="${clientId}"\nAMADEUS_CLIENT_SECRET="${clientSecret}"\nAMADEUS_CURRENCY="${currency}"\n`;
  writeFileSync(CONFIG_FILE, configContent, "utf8");
  chmodSync(CONFIG_FILE, 0o600);
  info(`  ✓ Config written to ${CONFIG_FILE}`);

  if (installCli) {
    const pkgDir = findPkgDir();
    info(`Installing flight-monitor CLI globally...`);
    try {
      execSync(`npm install -g "${pkgDir}"`, { stdio: "pipe" });
      info(`  ✓ Installed globally`);
    } catch {
      info("  ✗ Permission denied. Retrying with sudo...");
      try {
        execSync(`sudo npm install -g "${pkgDir}"`, { stdio: "pipe" });
        info(`  ✓ Installed globally (via sudo)`);
      } catch {
        info(`  ✗ Could not install globally. Run manually: npm install -g "${pkgDir}"`);
      }
    }
  }

  process.stdout.write(JSON.stringify({ status: "ok", message: "flight-monitor ready", config: CONFIG_FILE }) + "\n");
}

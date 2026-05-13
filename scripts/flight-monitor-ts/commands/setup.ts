import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CONFIG_FILE } from "../lib/config.js";
import { die, info, ensureDirs } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

export async function cmdSetup(args: string[]): Promise<void> {
  let clientId = "";
  let clientSecret = "";
  let currency = "";
  let installCli = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--client-id":     clientId = args[++i]; break;
      case "--client-secret": clientSecret = args[++i]; break;
      case "--currency":      currency = args[++i]; break;
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
    // Resolve package root from dist/commands/setup.js → two levels up
    const pkgDir = fileURLToPath(new URL("../../", import.meta.url));
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

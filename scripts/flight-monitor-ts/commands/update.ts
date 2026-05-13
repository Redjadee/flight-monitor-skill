import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { die, info } from "../lib/utils.js";

function findPkgDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) die("Could not locate package root");
    dir = parent;
  }
}

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) die("Could not locate git repository root");
    dir = parent;
  }
}

function currentVersion(pkgDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function cmdUpdate(args: string[]): Promise<void> {
  let binPath = "";

  const req = (flag: string, val: string | undefined): string => {
    if (!val) die(`${flag} requires a value`);
    return val;
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--bin-path": binPath = req("--bin-path", args[++i]); break;
      default: die(`Unknown option: ${args[i]}`);
    }
  }

  const pkgDir = findPkgDir();
  const repoRoot = findRepoRoot(pkgDir);
  const versionBefore = currentVersion(pkgDir);

  info(`Pulling latest changes from remote...`);
  try {
    const output = execSync(`git pull`, { cwd: repoRoot, stdio: "pipe" }).toString().trim();
    info(`  ✓ ${output}`);
  } catch (err) {
    die(`git pull failed: ${(err as { stderr?: Buffer }).stderr?.toString().trim() || String(err)}`);
  }

  const versionAfter = currentVersion(pkgDir);

  info(`Installing dependencies...`);
  try {
    execSync(`npm install`, { cwd: pkgDir, stdio: "pipe" });
    info(`  ✓ Dependencies installed`);
  } catch (err) {
    die(`npm install failed: ${(err as { stderr?: Buffer }).stderr?.toString().trim() || String(err)}`);
  }

  info(`Building...`);
  try {
    execSync(`"${join(pkgDir, "node_modules/.bin/tsc")}"`, { cwd: pkgDir, stdio: "pipe" });
    info(`  ✓ Built successfully`);
  } catch (err) {
    die(`Build failed: ${(err as { stderr?: Buffer }).stderr?.toString().trim() || String(err)}`);
  }

  const distBin = join(pkgDir, "dist/bin/flight-monitor.js");

  if (binPath) {
    const { copyFileSync, chmodSync } = await import("node:fs");
    try {
      copyFileSync(distBin, binPath);
      chmodSync(binPath, 0o755);
      info(`  ✓ Installed to ${binPath}`);
    } catch {
      die(`Could not write to ${binPath}. Check the path exists and is writable.`);
    }
  } else {
    info(`Reinstalling CLI globally...`);
    try {
      execSync(`npm install -g "${pkgDir}" --ignore-scripts`, { stdio: "pipe" });
      info(`  ✓ Installed globally`);
    } catch {
      info("  ✗ Permission denied. Retrying with sudo...");
      try {
        execSync(`sudo npm install -g "${pkgDir}" --ignore-scripts`, { stdio: "pipe" });
        info(`  ✓ Installed globally (via sudo)`);
      } catch {
        die(`Could not install globally. Use --bin-path ~/.local/bin/flight-monitor to install without sudo.`);
      }
    }
  }

  const versionMsg =
    versionBefore !== versionAfter
      ? `${versionBefore} → ${versionAfter}`
      : versionAfter;

  process.stdout.write(
    JSON.stringify({ status: "ok", message: "flight-monitor updated", version: versionMsg }) + "\n"
  );
}

# flight-monitor

Amadeus flight price monitor for OpenClaw. Watches flight prices and notifies you via your Gateway-configured channel when they drop below a target.

## Requirements

- Node.js 18+
- `tsx` (installed automatically via `npm install`)
- OpenClaw (for cron notifications)
- Amadeus production API credentials

## Install

```bash
cd scripts/flight-monitor-ts
npm install
```

Then run setup:

```bash
npx tsx bin/flight-monitor.ts setup \
  --client-id YOUR_AMADEUS_CLIENT_ID \
  --client-secret YOUR_AMADEUS_CLIENT_SECRET
```

Setup validates your Amadeus credentials, writes them to `~/.flight-monitor/config`, and installs the CLI to `/usr/local/bin`. Optional flags:

```bash
npx tsx bin/flight-monitor.ts setup \
  --client-id YOUR_AMADEUS_CLIENT_ID \
  --client-secret YOUR_AMADEUS_CLIENT_SECRET \
  --currency USD \
  --bin-path ~/.local/bin/flight-monitor
```

If you've already run setup before, you can re-run it without flags to reinstall the CLI — existing credentials will be reused from `~/.flight-monitor/config`:

```bash
npx tsx bin/flight-monitor.ts setup
```

After setup, `flight-monitor` is available globally:

```bash
flight-monitor version
```

## Register the Skill with OpenClaw

Point OpenClaw at wherever you downloaded this folder. Edit `~/.openclaw/openclaw.json`:

```json5
{
  "skills": {
    "load": {
      "extraDirs": ["/path/to/flight-monitor"]
    }
  }
}
```

Or symlink into your workspace skills dir:

```bash
ln -s /path/to/flight-monitor ~/.openclaw/skills/flight-monitor
```

Then reload: `openclaw skills refresh` or restart the Gateway.

## Update

Pull the latest code, rebuild, and reinstall the CLI in one step:

```bash
flight-monitor update
```

If you installed to a custom path, pass the same flag used during setup:

```bash
flight-monitor update --bin-path ~/.local/bin/flight-monitor
```

## Usage

```bash
# Add a monitor
flight-monitor add \
  --origin PEK --destination LHR \
  --depart-date 2025-06-15 --flex-days 3 \
  --cabin BUSINESS \
  --discord-channel 1234567890

# List all monitors
flight-monitor list

# Remove a monitor
flight-monitor remove fm-abc123

# Manual price check
flight-monitor check fm-abc123
```

## Code Structure

```
scripts/flight-monitor-ts/
  bin/flight-monitor.ts      # entrypoint & command dispatcher
  commands/
    setup.ts                 # setup command
    add.ts                   # add command
    list.ts                  # list command
    remove.ts                # remove command
    set-cron.ts              # set-cron command
    check.ts                 # check command
    debug.ts                 # debug command
    version.ts               # version command
  lib/
    auth.ts                  # Amadeus token fetch & cache
    config.ts                # paths, credential loading, Monitor type
    history.ts               # CSV history write & average calculation
    search.ts                # IATA resolve, single-date & flexible search
    utils.ts                 # shared utilities (die, info, dates, etc.)
```

## Data

Everything lives in `~/.flight-monitor/`:
- `config` — Amadeus credentials and default currency
- `monitors.json` — all monitor tasks
- `history/<monitor-id>.csv` — price history per route

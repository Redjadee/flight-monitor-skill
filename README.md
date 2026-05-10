# flight-monitor

Amadeus flight price monitor for OpenClaw. Watches flight prices and notifies you via your Gateway-configured channel when they drop below a target.

## Install

Download this folder anywhere you like, then run setup from inside it:

```bash
cd /path/to/flight-monitor
bash scripts/flight-monitor setup \
  --client-id YOUR_AMADEUS_CLIENT_ID \
  --client-secret YOUR_AMADEUS_CLIENT_SECRET
```

Setup validates your Amadeus credentials, writes them to `~/.flight-monitor/config`, and installs the CLI to `/usr/local/bin`. Optional flags:

```bash
bash scripts/flight-monitor setup \
  --client-id YOUR_AMADEUS_CLIENT_ID \
  --client-secret YOUR_AMADEUS_CLIENT_SECRET \
  --currency USD \
  --bin-path ~/.local/bin/flight-monitor
```

If you've already run setup before, you can re-run it without flags to reinstall the CLI — existing credentials will be reused from `~/.flight-monitor/config`:

```bash
bash scripts/flight-monitor setup
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

## Data

Everything lives in `~/.flight-monitor/`:
- `config` — Amadeus credentials and default currency
- `monitors.json` — all monitor tasks
- `history/<monitor-id>.csv` — price history per route

## Requirements

- `bash` 4+
- `curl`
- `jq`
- OpenClaw (for cron notifications)
- Amadeus production API credentials

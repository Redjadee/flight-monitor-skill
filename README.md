# flight-monitor

Amadeus flight price monitor for OpenClaw. Watches flight prices and notifies you via your Gateway-configured channel when they drop below a target.

## Install

Download this folder anywhere you like, then run setup from inside it:

```bash
cd /path/to/flight-monitor
bash scripts/flight-monitor setup
```

Setup creates the data directory and installs the CLI to `/usr/local/bin` so it's available globally. If you want a different install location:

```bash
bash scripts/flight-monitor setup --bin-path ~/.local/bin/flight-monitor
```

After setup, `flight-monitor` is available globally:

```bash
flight-monitor version
```

## Credentials

Add your Amadeus production credentials to `~/.openclaw/.env`:

```env
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
```

Restart the Gateway after editing. The Gateway loads this file on start and all agent turns (including cron) inherit the environment automatically.

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
  --cabin BUSINESS --target-price 5000

# List all monitors
flight-monitor list

# Remove a monitor
flight-monitor remove fm-abc123

# Manual price check
flight-monitor check fm-abc123
```

## Data

Everything lives in `~/.flight-monitor/`:
- `monitors.json` — all monitor tasks
- `history/<monitor-id>.csv` — price history per route

## Requirements

- `bash` 4+
- `curl`
- `jq`
- OpenClaw (for cron notifications)
- Amadeus production API credentials

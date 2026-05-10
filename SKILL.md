---
name: flight-monitor
description: >
  Monitor flight prices using the Amadeus API. Use this skill whenever the user wants to
  track, watch, alert on, or be notified about flight prices. Triggers include: "monitor
  this flight", "alert me when tickets drop below X", "watch PEK to LHR prices", "set up
  a price alert", "track cheapest dates", "notify me when flights are cheap", or any request
  to repeatedly check airfare. Also triggers for "list my flight monitors", "stop monitoring",
  "show flight alerts", or managing existing monitor tasks. On first use, checks that
  flight-monitor CLI is installed and configured.
---

# Flight Monitor Skill

Monitors flight prices via Amadeus API. Uses the `flight-monitor` CLI (must be installed and configured via `flight-monitor setup`). Notifies the user through OpenClaw cron when prices drop below a target.

## Quick Reference

| Action | Command |
|--------|---------|
| Add monitor | `flight-monitor add ...` → register cron → `flight-monitor set-cron` |
| List monitors | `flight-monitor list` |
| View cron job | `openclaw cron show <cron_job_id>` |
| Edit cron job | `openclaw cron edit <cron_job_id> --message "..."` |
| Remove monitor | `flight-monitor remove <id>` → `openclaw cron remove <cron_job_id>` |
| Manual check | `flight-monitor check <id>` |

---

## Step 0 — Preflight Check

Before anything, verify the CLI is available:

```bash
flight-monitor version
```

If the command is not found, tell the user:
> "`flight-monitor` is not installed or not on PATH. Download the script and run `flight-monitor setup` first — it will install the CLI globally."

If the CLI is found but `~/.flight-monitor/config` is missing, tell the user to run `flight-monitor setup`.

---

## Step 1 — Adding a Monitor

### Extract Parameters

Parse the user's request. Required:
- `origin` — IATA code or city name (the CLI resolves city names automatically)
- `destination` — IATA code or city name
- `depart_date` — exact date in YYYY-MM-DD
- `target_price` — numeric threshold in the configured currency

Optional — only ask if ambiguous or user mentioned them:
- `cabin` — ECONOMY (default) / BUSINESS / FIRST / PREMIUM_ECONOMY
- `adults` — integer, default 1
- `nonstop` — flag, default off
- `return_date` — for round trips
- `airlines` — comma-separated IATA carrier codes (e.g. `CA,CX`)
- `flex_days` — days ± around depart_date to search (default 0; set 3 if user says "around", "±", "flexible")
- `check_interval` — how often to poll, default `6h`

**Flexible date signals**: "around June 15", "mid-June", "±3 days", "anytime in June" → set `--flex-days 3` (or as specified).

### Run add

```bash
flight-monitor add \
  --origin PEK \
  --destination LHR \
  --depart-date 2025-06-15 \
  --target-price 5000 \
  --flex-days 3 \
  --cabin BUSINESS \
  [--return-date 2025-06-30] \
  [--nonstop] \
  [--airlines CA,CX] \
  [--check-interval 6h]
```

Note the `monitor_id` from the JSON output.

### Register Cron Job

```bash
openclaw cron add \
  --name "flight-monitor-<MONITOR_ID>" \
  --every <check_interval> \
  --session isolated \
  --agent kay \
  --message "Run: flight-monitor check <MONITOR_ID>. If below_target is true in the output, send a notification to the user with the price, flight, and google_flights link." \
  --announce \
  --to <channel-id-or-user-id>
```

Flag notes:
- `--every` takes a bare interval value: `6h`, `1d`, `30m` — no quotes needed
- `--agent` (not `--agentId`) targets the correct agent for cron-triggered runs
- `--announce` + `--to` deliver the result to the user; `--to` is required when `--announce` is set

Then capture the cron job ID and save it:

```bash
CRON_ID=$(openclaw cron list --json | jq -r '.[] | select(.name=="flight-monitor-<MONITOR_ID>") | .id')

flight-monitor set-cron --monitor-id <MONITOR_ID> --cron-id "${CRON_ID}"
```

### Confirm to User

```
✅ Flight monitor created

🔍 Monitor: fm-abc123
✈️  PEK → LHR | 15 Jun ±3 days | Business
💰 Alert below ¥5,000
⏰ Checking every 6 hours
📊 Current lowest: ¥6,240 (CA937, 16 Jun)

I'll notify you here when the price drops.
```

---

## Step 2 — Listing Monitors

```bash
flight-monitor list
```

Format the JSON as a readable table: ID, route, date/flex, cabin, target, last price, last checked, status.

---

## Step 3 — Viewing / Modifying Cron Jobs

**List all cron jobs:**
```bash
openclaw cron list
openclaw cron list --json   # machine-readable output
```

**Inspect a specific job:**
```bash
openclaw cron show <cron_job_id>
```

**Edit a job's message or model:**
```bash
openclaw cron edit <cron_job_id> --message "updated prompt"
```

**View execution history:**
```bash
openclaw cron runs --id <cron_job_id> --limit 10
```

---

## Step 4 — Removing a Monitor

1. Find the monitor (by ID or by route description)
2. Get `cron_job_id` from the record
3. Cancel cron: `openclaw cron remove <cron_job_id>`
4. Remove record: `flight-monitor remove <monitor_id>`
5. Confirm to user

---

## Step 5 — Cron-Triggered Check

When woken by cron with a `flight-monitor check <ID>` instruction:

1. Run `flight-monitor check <MONITOR_ID>`
2. Read `below_target` from JSON output
3. **If `true`** → compose and send notification:

```
✈️ Price Alert!
PEK → LHR | 16 Jun | Business
Current lowest: ¥4,820 (CA937)
🎯 Below your target of ¥5,000!

Book → <google_flights link>
```

4. **If `false`** → do nothing. Never send "price is still high" messages on cron runs.

---

## Error Reference

| Error | Action |
|-------|--------|
| `command not found: flight-monitor` | Tell user to install via `flight-monitor setup` |
| `Not configured` | Tell user to run `flight-monitor setup` |
| `Amadeus auth failed` | Tell user to re-run `flight-monitor setup` with correct credentials |
| `Could not resolve location` | Ask user for the exact IATA code |
| No flights found (null offer) | Route may not be served or date too far out — inform user |

---

## Data Locations

- Config & monitors: `~/.flight-monitor/`
- Price history CSVs: `~/.flight-monitor/history/<monitor-id>.csv`
- Credentials in OpenClaw: `skills.entries.flight-monitor.env` in `~/.openclaw/openclaw.json`

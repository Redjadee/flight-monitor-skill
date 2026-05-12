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

Monitors flight prices via Amadeus API. Uses the `flight-monitor` CLI (must be installed and configured via `flight-monitor setup`). Sends a price update to the user's Discord channel on every cron run, and flags when the current price drops below the N-day historical average.

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
- `discord_channel` — Discord channel ID to send price updates to

Optional — only ask if ambiguous or user mentioned them:
- `alert_days` — compare current price against the average of the last N days (default 7); set lower if user wants a shorter window
- `cabin` — ECONOMY (default) / BUSINESS / FIRST / PREMIUM_ECONOMY
- `adults` — integer, default 1
- `nonstop` — flag, default off
- `return_date` — for round trips
- `airlines` — comma-separated IATA carrier codes (e.g. `CA,CX`)
- `flex_days` — days ± around depart_date to search (default 0; set 3 if user says "around", "±", "flexible")
- `check_interval` — how often to poll, default `1d`

**Flexible date signals**: "around June 15", "mid-June", "±3 days", "anytime in June" → set `--flex-days 3` (or as specified).

### Run add

```bash
flight-monitor add \
  --origin <ORIGIN_IATA> \
  --destination <DEST_IATA> \
  --depart-date <YYYY-MM-DD> \
  --discord-channel <channel-id> \
  --alert-days 7 \
  --flex-days 3 \
  --cabin ECONOMY \
  [--return-date <YYYY-MM-DD>] \
  [--nonstop] \
  [--airlines XX,YY] \
  [--check-interval 1d]
```

Note the `monitor_id` from the JSON output.

### Register Cron Job

Use the `discord_channel_id` from the `flight-monitor add` output as the `--to` value. This binds the monitor to its channel: every cron run delivers the agent's reply there automatically via `--announce`.

```bash
openclaw cron add \
  --name "flight-monitor-<MONITOR_ID>" \
  --every <check_interval> \
  --session isolated \
  --agent kay \
  --message "Run: flight-monitor check <MONITOR_ID>. Then report the current price update (see Step 5 in the flight-monitor skill)." \
  --announce \
  --to <discord_channel_id>
```

Flag notes:
- `--every` takes a bare interval value: `6h`, `1d`, `30m` — no quotes needed
- `--agent` (not `--agentId`) targets the correct agent for cron-triggered runs
- `--announce` + `--to` deliver the agent's reply to the Discord channel; `--to` is required when `--announce` is set
- Never call `openclaw discord send` manually — the `--announce` mechanism handles delivery

Then capture the cron job ID and save it:

```bash
CRON_ID=$(openclaw cron list --json | jq -r '.[] | select(.name=="flight-monitor-<MONITOR_ID>") | .id')

flight-monitor set-cron --monitor-id <MONITOR_ID> --cron-id "${CRON_ID}"
```

### Confirm to User

```
✅ Flight monitor created

🔍 Monitor: {monitor_id}
✈️  {origin} → {destination} | {depart_date} ±{flex_days} days | {cabin}
📉 Alert when price drops below {alert_days}-day average
⏰ Checking every {check_interval}
📊 Current lowest: {currency}{current_offer.price} ({current_offer.flight}, {current_offer.date})

I'll send price updates to your Discord channel.
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
2. **Always** compose and send a reply — the `--announce` flag on the cron job delivers it to the bound Discord channel. Never skip the reply.
3. Format the reply based on the JSON output:

**If `below_average` is `true`:**
```
✈️ Price Drop Alert!
{origin} → {destination} | {offer.date} | {cabin}
Current lowest: {currency}{offer.price} ({offer.flight})
📉 Below {days_in_avg}-day average of {currency}{average_price}

Book → {google_flights}
```

**If `below_average` is `false`:**
```
✈️ Flight Price Update
{origin} → {destination} | {offer.date} | {cabin}
Current lowest: {currency}{offer.price} ({offer.flight})
📊 {days_in_avg}-day average: {currency}{average_price} (currently above average)

Book → {google_flights}
```

**If `price` is `null` (no flights found):**
```
✈️ Flight Price Update
{origin} → {destination} | {cabin}
No flights found for this check — will retry next run.
```

**If `status` is `"expired"` (depart_date is in the past):**
```
⚠️ Flight monitor {monitor_id} has expired.
The departure date {depart_date} is in the past.
Please remove this monitor and add a new one with an updated date.
```

Notes:
- When `average_price` is `null` (first ever check or no history in window), omit the average line and just report the current price; `below_average` will also be `null`
- When `fallback_price` is `true`, the price is for the cheapest available cabin (not the requested cabin class) because no seats were found in the requested class. Append a note: "⚠️ No {cabin} seats found — price shown is cheapest available cabin." Do not report `below_average` in this case since the price is not comparable to the cabin-specific history

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

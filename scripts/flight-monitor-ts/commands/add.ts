import { readFileSync, writeFileSync } from "node:fs";
import { MONITORS_FILE, loadCredentials, type Monitor } from "../lib/config.js";
import { die, ensureDirs, genId, nowIso, flightsLink, dateToEpoch, todayMidnightEpoch } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";
import { resolveIata, searchFlexible } from "../lib/search.js";
import { appendHistory } from "../lib/history.js";

export async function cmdAdd(args: string[]): Promise<void> {
  let origin = "";
  let dest = "";
  let departDate = "";
  let flexDays = 0;
  let returnDate = "";
  let cabin = "ECONOMY";
  let adults = 1;
  let nonstop = false;
  let airlines = "";
  let checkInterval = "1d";
  let alertDays = 7;
  let discordChannel = "";
  let currency = "";

  const req = (flag: string, val: string | undefined): string => {
    if (!val) die(`${flag} requires a value`);
    return val;
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--origin":           origin = req("--origin", args[++i]); break;
      case "--destination":      dest = req("--destination", args[++i]); break;
      case "--depart-date":      departDate = req("--depart-date", args[++i]); break;
      case "--flex-days": {
        const v = parseInt(args[++i], 10);
        if (isNaN(v) || v < 0) die("--flex-days must be a non-negative integer");
        flexDays = v;
        break;
      }
      case "--return-date":      returnDate = req("--return-date", args[++i]); break;
      case "--cabin": {
        const raw = args[++i];
        if (!raw) die("--cabin requires a value");
        const v = raw.toUpperCase();
        const valid = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"];
        if (!valid.includes(v)) die(`--cabin must be one of: ${valid.join(", ")}`);
        cabin = v;
        break;
      }
      case "--adults": {
        const v = parseInt(args[++i], 10);
        if (isNaN(v) || v < 1) die("--adults must be a positive integer");
        adults = v;
        break;
      }
      case "--nonstop":          nonstop = true; break;
      case "--airlines":         airlines = req("--airlines", args[++i]); break;
      case "--check-interval":   checkInterval = req("--check-interval", args[++i]); break;
      case "--alert-days": {
        const v = parseInt(args[++i], 10);
        if (isNaN(v) || v < 1) die("--alert-days must be a positive integer");
        alertDays = v;
        break;
      }
      case "--discord-channel":  discordChannel = req("--discord-channel", args[++i]); break;
      case "--currency":         currency = req("--currency", args[++i]); break;
      default: die(`Unknown option: ${args[i]}`);
    }
  }

  if (!origin) die("--origin is required");
  if (!dest) die("--destination is required");
  if (!departDate) die("--depart-date is required");
  if (!discordChannel) die("--discord-channel is required");

  const departEpoch = dateToEpoch(departDate);
  if (isNaN(departEpoch)) die(`--depart-date '${departDate}' is not a valid date (expected YYYY-MM-DD)`);
  if (departEpoch < todayMidnightEpoch()) die(`--depart-date ${departDate} is in the past`);

  if (returnDate) {
    const returnEpoch = dateToEpoch(returnDate);
    if (isNaN(returnEpoch)) die(`--return-date '${returnDate}' is not a valid date (expected YYYY-MM-DD)`);
    if (returnEpoch <= departEpoch) die(`--return-date ${returnDate} must be after --depart-date ${departDate}`);
  }

  const creds = loadCredentials();
  ensureDirs();

  const token = await getToken(creds.clientId, creds.clientSecret);
  origin = await resolveIata(origin, token);
  dest = await resolveIata(dest, token);

  const monitorId = `fm-${genId()}`;
  if (!currency) currency = creds.currency;
  const airlinesArr = airlines ? airlines.split(",") : [];

  const newMonitor: Monitor = {
    id: monitorId,
    origin,
    destination: dest,
    depart_date: departDate,
    flex_days: flexDays,
    return_date: returnDate || null,
    cabin,
    adults,
    nonstop,
    airlines: airlinesArr,
    alert_days: alertDays,
    discord_channel_id: discordChannel,
    currency,
    check_interval: checkInterval,
    cron_job_id: null,
    status: "active",
    created_at: nowIso(),
    last_checked: null,
    last_price: null,
    last_flight: null,
  };

  const monitors = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  monitors.push(newMonitor);
  writeFileSync(MONITORS_FILE, JSON.stringify(monitors, null, 2), "utf8");

  const offer = await searchFlexible(monitorId, token);

  if (offer) {
    const fallback = offer.fallback ?? false;
    const monitorsUpdated = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
    const idx = monitorsUpdated.findIndex((m) => m.id === monitorId);
    if (idx !== -1) {
      if (!fallback) {
        appendHistory(monitorId, offer);
        monitorsUpdated[idx].last_price = offer.price;
        monitorsUpdated[idx].last_flight = offer.flight;
      }
      monitorsUpdated[idx].last_checked = nowIso();
      writeFileSync(MONITORS_FILE, JSON.stringify(monitorsUpdated, null, 2), "utf8");
    }
  }

  const link = offer
    ? flightsLink(origin, dest, offer.date, cabin, offer.return_date)
    : null;

  process.stdout.write(
    JSON.stringify({
      status: "ok",
      monitor_id: monitorId,
      discord_channel_id: discordChannel,
      currency,
      current_offer: offer ?? null,
      google_flights: link,
    }) + "\n"
  );
}

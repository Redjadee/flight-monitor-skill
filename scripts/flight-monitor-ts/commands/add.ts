import { readFileSync, writeFileSync } from "node:fs";
import { MONITORS_FILE } from "../lib/config.js";
import { loadCredentials, type Monitor } from "../lib/config.js";
import { die, ensureDirs, genId, nowIso, flightsLink, dateToEpoch, nowEpoch } from "../lib/utils.js";
import { requireCmds } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";
import { resolveIata, searchFlexible } from "../lib/search.js";
import { appendHistory } from "../lib/history.js";

export async function cmdAdd(args: string[]): Promise<void> {
  requireCmds("curl", "jq");

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

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--origin":           origin = args[++i]; break;
      case "--destination":      dest = args[++i]; break;
      case "--depart-date":      departDate = args[++i]; break;
      case "--flex-days":        flexDays = parseInt(args[++i], 10); break;
      case "--return-date":      returnDate = args[++i]; break;
      case "--cabin":            cabin = args[++i].toUpperCase(); break;
      case "--adults":           adults = parseInt(args[++i], 10); break;
      case "--nonstop":          nonstop = true; break;
      case "--airlines":         airlines = args[++i]; break;
      case "--check-interval":   checkInterval = args[++i]; break;
      case "--alert-days":       alertDays = parseInt(args[++i], 10); break;
      case "--discord-channel":  discordChannel = args[++i]; break;
      default: die(`Unknown option: ${args[i]}`);
    }
  }

  if (!origin) die("--origin is required");
  if (!dest) die("--destination is required");
  if (!departDate) die("--depart-date is required");
  if (!discordChannel) die("--discord-channel is required");

  const departEpoch = dateToEpoch(departDate);
  if (isNaN(departEpoch)) die(`--depart-date '${departDate}' is not a valid date (expected YYYY-MM-DD)`);
  if (departEpoch < nowEpoch()) die(`--depart-date ${departDate} is in the past`);

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
  const currency = creds.currency;
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

    if (!fallback) {
      appendHistory(monitorId, offer);
      monitorsUpdated[idx].last_price = offer.price;
      monitorsUpdated[idx].last_flight = offer.flight;
    }
    monitorsUpdated[idx].last_checked = nowIso();
    writeFileSync(MONITORS_FILE, JSON.stringify(monitorsUpdated, null, 2), "utf8");
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

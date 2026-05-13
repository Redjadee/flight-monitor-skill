import { readFileSync, writeFileSync } from "node:fs";
import { MONITORS_FILE, loadCredentials, type Monitor } from "../lib/config.js";
import { die, ensureDirs, flightsLink, nowIso, todayMidnightEpoch, dateToEpoch } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";
import { searchFlexible } from "../lib/search.js";
import { appendHistory, calcAveragePrice } from "../lib/history.js";

export async function cmdCheck(args: string[]): Promise<void> {
  const monitorId = args[0];
  if (!monitorId) die("Usage: flight-monitor check <monitor-id>");

  const creds = loadCredentials();
  ensureDirs();

  const monitors = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  const monitor = monitors.find((m) => m.id === monitorId);
  if (!monitor) die(`Monitor not found: ${monitorId}`);

  if (monitor.status !== "active") {
    process.stdout.write(JSON.stringify({ status: "skipped", reason: "monitor is not active" }) + "\n");
    return;
  }

  // Detect fully-expired monitors before hitting the API
  const baseEpoch = dateToEpoch(monitor.depart_date);
  const todayEpoch = todayMidnightEpoch();
  const cappedFlex = Math.min(monitor.flex_days, 7);
  const latestCandidate = baseEpoch + cappedFlex * 86400;

  if (latestCandidate < todayEpoch) {
    process.stdout.write(
      JSON.stringify({
        status: "expired",
        monitor_id: monitorId,
        discord_channel_id: monitor.discord_channel_id,
        reason: `depart_date ${monitor.depart_date} (+/-${cappedFlex} days) is in the past — update the monitor with a future date`,
      }) + "\n"
    );
    return;
  }

  const token = await getToken(creds.clientId, creds.clientSecret);
  const offer = await searchFlexible(monitorId, token);

  if (!offer) {
    process.stdout.write(
      JSON.stringify({
        status: "ok",
        monitor_id: monitorId,
        discord_channel_id: monitor.discord_channel_id,
        currency: monitor.currency,
        price: null,
        average_price: null,
        days_in_avg: null,
        below_average: null,
        fallback_price: null,
        offer: null,
        google_flights: null,
      }) + "\n"
    );
    return;
  }

  const fallback = offer.fallback ?? false;

  // Calculate average BEFORE appending current price
  let averagePrice: number | null = null;
  let belowAverage: boolean | null = null;
  let daysInAvg: number | null = null;

  if (!fallback) {
    averagePrice = calcAveragePrice(monitorId, monitor.alert_days);
    if (averagePrice !== null) {
      daysInAvg = monitor.alert_days;
      belowAverage = offer.price < averagePrice;
    }
  }

  // Update history and monitor state
  const monitorsUpdated = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  const idx = monitorsUpdated.findIndex((m) => m.id === monitorId);

  if (!fallback) {
    appendHistory(monitorId, offer);
    monitorsUpdated[idx].last_price = offer.price;
    monitorsUpdated[idx].last_flight = offer.flight;
  }
  monitorsUpdated[idx].last_checked = nowIso();
  writeFileSync(MONITORS_FILE, JSON.stringify(monitorsUpdated, null, 2), "utf8");

  const link = flightsLink(monitor.origin, monitor.destination, offer.date, monitor.cabin, offer.return_date);

  process.stdout.write(
    JSON.stringify({
      status: "ok",
      monitor_id: monitorId,
      discord_channel_id: monitor.discord_channel_id,
      currency: monitor.currency,
      price: offer.price,
      average_price: averagePrice,
      days_in_avg: daysInAvg,
      below_average: belowAverage,
      fallback_price: fallback,
      offer,
      google_flights: link,
    }) + "\n"
  );
}

import { AMADEUS_BASE, MONITORS_FILE, type Monitor } from "./config.js";
import { die, info, todayMidnightEpoch, shiftDate, dateToEpoch } from "./utils.js";
import { readFileSync } from "node:fs";

export interface Offer {
  date: string;
  price: number;
  carrier: string;
  flight: string;
  duration: string;
  return_date?: string;
  fallback?: boolean;
}

export async function resolveIata(input: string, token: string): Promise<string> {
  if (/^[A-Z]{3}$/.test(input)) return input;

  const url = `${AMADEUS_BASE}/v1/reference-data/locations?keyword=${encodeURIComponent(input)}&subType=CITY,AIRPORT&page%5Blimit%5D=5`;
  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    die(`Location lookup failed for: ${input}`);
  }

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    die(`Amadeus location lookup error ${resp.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await resp.json()) as { data?: Array<{ subType: string; iataCode: string }> };
  const airports = (data.data ?? []).filter((d) => d.subType === "AIRPORT");
  const iata = airports[0]?.iataCode ?? data.data?.[0]?.iataCode;
  if (!iata) die(`Could not resolve location: ${input}`);
  return iata;
}

export async function searchOneDate(
  origin: string,
  dest: string,
  date: string,
  token: string,
  extraParams?: string,
  adults = 1
): Promise<Offer | null> {
  const base = `${AMADEUS_BASE}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${date}&adults=${adults}`;
  const url = extraParams ? `${base}&${extraParams}` : base;

  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return null;
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    info(`Amadeus flight-offers error ${resp.status}: ${body.slice(0, 300)}`);
    return null;
  }

  const data = (await resp.json()) as {
    data?: Array<{
      price: { grandTotal?: string; total?: string };
      itineraries: Array<{
        duration: string;
        segments: Array<{ carrierCode: string; number: string }>;
      }>;
    }>;
  };

  if (!data.data?.length) return null;

  const first = data.data[0];
  const price = parseFloat(first.price.grandTotal ?? first.price.total ?? "");
  if (isNaN(price)) return null;

  const seg = first.itineraries[0].segments[0];
  const carrier = seg.carrierCode;
  const flight = `${carrier}${seg.number}`;
  const duration = first.itineraries[0].duration;

  return { date, price, carrier, flight, duration };
}

async function searchWithParams(
  monitor: Monitor,
  token: string,
  paramsBase: string
): Promise<Offer | null> {
  const flexDays = Math.min(monitor.flex_days, 7);
  const baseEpoch = dateToEpoch(monitor.depart_date);
  const todayEpoch = todayMidnightEpoch();
  const returnEpoch = monitor.return_date ? dateToEpoch(monitor.return_date) : 0;

  let bestPrice: number | null = null;
  let bestOffer: Offer | null = null;

  for (let offset = -flexDays; offset <= flexDays; offset++) {
    const checkEpoch = baseEpoch + offset * 86400;
    if (checkEpoch < todayEpoch) continue;
    const checkDate = shiftDate(monitor.depart_date, offset);

    let iterParams = paramsBase;
    let iterReturnDate: string | undefined;
    if (returnEpoch > 0) {
      iterReturnDate = shiftDate(monitor.return_date!, offset);
      iterParams = `${iterParams}&returnDate=${iterReturnDate}`;
    }

    const offer = await searchOneDate(monitor.origin, monitor.destination, checkDate, token, iterParams, monitor.adults);
    await new Promise((r) => setTimeout(r, 500));
    if (!offer) continue;

    if (iterReturnDate) offer.return_date = iterReturnDate;

    if (bestPrice === null || offer.price < bestPrice) {
      bestPrice = offer.price;
      bestOffer = offer;
    }
  }

  return bestOffer;
}

export async function searchFlexible(monitorId: string, token: string): Promise<Offer | null> {
  const monitors = JSON.parse(readFileSync(MONITORS_FILE, "utf8")) as Monitor[];
  const monitor = monitors.find((m) => m.id === monitorId);
  if (!monitor) die(`Monitor not found: ${monitorId}`);

  const airlines = monitor.airlines?.join(",") ?? "";
  let paramsBase = `travelClass=${monitor.cabin}&currencyCode=${monitor.currency}&max=5`;
  if (monitor.nonstop) paramsBase += "&nonStop=true";
  if (airlines) paramsBase += `&includedAirlineCodes=${airlines}`;

  const offer = await searchWithParams(monitor, token, paramsBase);
  if (offer) return offer;

  // Fallback: strip travelClass / nonStop / airlines
  const fallbackParams = `currencyCode=${monitor.currency}&max=5`;
  const fallbackOffer = await searchWithParams(monitor, token, fallbackParams);
  if (fallbackOffer) return { ...fallbackOffer, fallback: true };

  return null;
}

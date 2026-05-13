import { AMADEUS_BASE, loadCredentials } from "../lib/config.js";
import { die, info, ensureDirs, shiftDate } from "../lib/utils.js";

export async function cmdDebug(args: string[]): Promise<void> {
  const origin = args[0] ?? "PEK";
  const dest = args[1] ?? "LAX";
  const date = args[2] ?? shiftDate(new Date().toISOString().slice(0, 10), 30);

  const creds = loadCredentials();
  ensureDirs();

  info("=== flight-monitor debug ===");
  info(`Origin:      ${origin}`);
  info(`Destination: ${dest}`);
  info(`Date:        ${date}`);
  info("");

  // Step 1: Auth
  info("--- Step 1: Amadeus token ---");
  let tokenResp: Response;
  try {
    tokenResp = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
    });
  } catch (err) {
    info("FAILED: network error");
    info(String(err));
    process.exit(1);
  }

  const tokenData = (await tokenResp.json()) as Record<string, unknown>;
  const token = tokenData.access_token as string | undefined;
  const expiresIn = tokenData.expires_in as number | undefined;

  if (!token) {
    info("FAILED: no token in response:");
    info(JSON.stringify(tokenData, null, 2));
    process.exit(1);
  }
  info(`OK — token: ${token.slice(0, 12)}... (expires in ${expiresIn}s)`);
  info("");

  // Step 2: Raw flight search
  info("--- Step 2: Flight Offers Search ---");
  const currency = creds.currency;
  const url = `${AMADEUS_BASE}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${dest}&departureDate=${date}&adults=1&max=3&currencyCode=${currency}`;
  info(`URL: ${url}`);
  info("");

  let searchResp: Response;
  try {
    searchResp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    info("FAILED: network error");
    info(String(err));
    process.exit(1);
  }

  info(`HTTP status: ${searchResp.status}`);
  info("");
  const body = await searchResp.json();
  process.stdout.write(JSON.stringify(body, null, 2) + "\n");
}

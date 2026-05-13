import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { TOKEN_CACHE, AMADEUS_BASE } from "./config.js";
import { die, info, nowEpoch } from "./utils.js";

export async function getToken(clientId: string, clientSecret: string): Promise<string> {
  if (existsSync(TOKEN_CACHE)) {
    const [cachedToken, cachedExpires] = readFileSync(TOKEN_CACHE, "utf8").split("|");
    if (nowEpoch() < parseInt(cachedExpires, 10) - 60) {
      return cachedToken;
    }
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => die("Amadeus auth failed. Check network/credentials."));

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    die(`Amadeus auth error ${resp.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const token = data.access_token as string | undefined;
  const expiresIn = (data.expires_in as number | undefined) ?? 1799;

  if (!token) die(`No token in Amadeus response: ${JSON.stringify(data)}`);

  writeFileSync(TOKEN_CACHE, `${token}|${nowEpoch() + expiresIn}`, "utf8");
  return token;
}

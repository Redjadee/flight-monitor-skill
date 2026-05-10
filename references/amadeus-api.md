# Amadeus API Reference

## Authentication

Production base URL: `https://api.amadeus.com`

Token endpoint:
```
POST https://api.amadeus.com/v1/security/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=<ID>&client_secret=<SECRET>
```

Response: `{ "access_token": "...", "expires_in": 1799 }`

Token is cached in `~/.flight-monitor/.token_cache` as `token|expires_epoch` and reused until 60s before expiry.

---

## Flight Offers Search

```
GET https://api.amadeus.com/v2/shopping/flight-offers
Authorization: Bearer <token>
```

### Key Parameters

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| `originLocationCode` | ✅ | string | IATA airport code |
| `destinationLocationCode` | ✅ | string | IATA airport code |
| `departureDate` | ✅ | string | YYYY-MM-DD |
| `adults` | ✅ | integer | Min 1 |
| `returnDate` | ❌ | string | YYYY-MM-DD, for round trips |
| `travelClass` | ❌ | string | ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST |
| `nonStop` | ❌ | bool | true = direct flights only |
| `includedAirlineCodes` | ❌ | string | Comma-separated IATA codes e.g. "CA,CX" |
| `max` | ❌ | integer | Max results, use 5 for monitoring |
| `currencyCode` | ❌ | string | e.g. CNY, USD |

### Response: Extracting the Cheapest Offer

Offers are returned sorted cheapest first. From `data[0]`:

```
price      → data[0].price.total (string, cast to float)
carrier    → data[0].itineraries[0].segments[0].carrierCode
flight_num → carrierCode + data[0].itineraries[0].segments[0].number
duration   → data[0].itineraries[0].duration
```

---

## Flexible Date Search

Loop over `depart_date ± flex_days` (capped at ±7), call Flight Offers Search once per date, collect cheapest offer per date, return the overall minimum. Sleep 0.5s between calls.

---

## Location Resolution

```
GET https://api.amadeus.com/v1/reference-data/locations?keyword=Beijing&subType=CITY,AIRPORT
```

Take first result with `subType=AIRPORT`. Used when user provides a city name instead of IATA code.

---

## Google Flights Deep Link

```
https://www.google.com/flights#flt={origin}.{destination}.{date};c:{cabin_code};e:1
```

Cabin codes: `e`=ECONOMY, `p`=PREMIUM_ECONOMY, `j`=BUSINESS, `f`=FIRST

---

## Rate Limits (Production)

No hard per-second limit documented. The 0.5s sleep between date-loop calls is a courtesy measure. Token valid for ~30min; reuse across calls in the same run.

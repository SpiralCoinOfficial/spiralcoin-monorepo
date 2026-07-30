# API Reference

All endpoints live at `https://www.spiralcoin.net/api/`. Responses are
`application/json; charset=utf-8` unless noted.

---

## `POST /api/sponsor-webhook.php`

GitHub Sponsors event sink. Not called by humans.

| Header | Required | Notes |
|---|---|---|
| `X-Hub-Signature-256` | yes | `sha256=<hex>` HMAC of raw body with shared secret |
| `X-GitHub-Event` | yes | e.g. `sponsorship`, `ping` |
| `X-GitHub-Delivery` | yes | Unique delivery UUID |
| `Content-Type` | yes | `application/json` |

| Status | Meaning |
|---|---|
| `202 Accepted` | Event logged |
| `400 Bad Request` | Malformed JSON |
| `401 Unauthorized` | Signature mismatch |
| `405 Method Not Allowed` | Non-POST |
| `413 Payload Too Large` | Body > 1 MB |
| `500 Internal Server Error` | Secret missing or disk write failed |

---

## `GET /api/sponsors-list.php`

Public sponsor wall data.

**Response:**

```json
{
  "sponsors": [
    {
      "login": "octocat",
      "avatar_url": "https://…",
      "tier": "Founding Sponsor",
      "one_time": true,
      "amount": 12000,
      "since": "2026-05-28T20:15:00+00:00"
    }
  ],
  "total_sponsors": 1,
  "one_time_count": 1,
  "total_raised_usd": 12000,
  "goal_usd": 120000,
  "goal_count": 10,
  "updated_at": "2026-05-28T20:16:00+00:00"
}
```

Cache: `public, max-age=60`. CORS: `https://www.spiralcoin.net`.

---

## `POST /api/bind-wallet.php`

Bind a MetaMask wallet to an Auth0 identity via EIP-4361 SIWE.

**Request:**

```http
POST /api/bind-wallet.php
Authorization: Bearer <Auth0 ID token (RS256 JWT)>
Content-Type: application/json

{
  "address":   "0xabcdef…",
  "message":   "www.spiralcoin.net wants you to sign in with…",
  "signature": "0x…130hex",
  "chainId":   42161
}
```

**Success (`200`):**

```json
{ "ok": true, "address": "0xabc…", "sub": "auth0|…", "mode": "mvp" }
```

**Errors:** `400` (validation), `401` (JWT/signature), `405`, `503` (JWKS),
`500` (file). Error body: `{"error":"<message>"}`.

See [Wallet-Binding](Wallet-Binding.md) for full validation rules.

---

## `POST /api/regd.php`

Reg D 506(c) investor capture (accredited-only). See file for full schema.

---

## `GET /api/balance.php?address=0x…`

Ethereum / Arbitrum native + ERC-20 balance proxy. Backed by Alchemy.

---

## `GET /api/polygon.php?...`

Polygon RPC proxy. Same pattern as `balance.php`.

---

## `GET /api/yahoo.php?symbol=AAPL`

Stock quote proxy. Used by the markets page.

---

## `GET /api/proposals.php`, `GET /api/staking.php`, `GET /api/status.php`

Placeholders for the eventual on-chain governance + staking UI. Currently
return mock data. Will be replaced post-LP-launch.

---

## Common conventions

| Convention | Applies to |
|---|---|
| `declare(strict_types=1)` | All endpoints |
| `Content-Type: application/json; charset=utf-8` | All endpoints |
| `X-Content-Type-Options: nosniff` | All endpoints |
| `Access-Control-Allow-Origin: https://www.spiralcoin.net` | Read endpoints |
| Constant-time `hash_equals` for any secret compare | Sensitive endpoints |
| `flock(LOCK_EX)` for any file write | Endpoints that persist |

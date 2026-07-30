# Sponsors

## Program

SpiralCoin runs a **GitHub Sponsors** program through the
`SpiralCoin-Official` organization:
<https://github.com/sponsors/SpiralCoin-Official>

> ⚠️ **Disclosure:** Sponsorships are donations toward bootstrapping public
> on-chain infrastructure. They are **not** investments, equity, securities,
> tokens, or revenue-share entitlements. No financial return is offered or
> implied.

## Tiers

| Tier | Amount | Type | Slots | Benefits |
|---|---|---|---|---|
| Founding Sponsor | **$12,000** | One-time | 10 | Permanent recognition on splc.html, top-row placement on homepage, direct engineering access during build phase, weekly on-chain TVL report (post-LP-launch) |

**Goal:** $120,000 total (10 × $12,000) to fund:

- Third-party smart-contract audit
- Arbitrum SPLC/USDC liquidity bootstrap
- Six months of full-time development
- Production infrastructure

## Tech: how a sponsorship becomes a wall-of-fame entry

```
GitHub Sponsors UI
    │
    │ HTTP POST (JSON) + X-Hub-Signature-256
    ▼
https://www.spiralcoin.net/api/sponsor-webhook.php
    │
    ├─ HMAC-SHA256 verify against /private/sponsor-webhook-secret.txt
    ├─ 1 MB request size guard
    ├─ Constant-time hash_equals
    │
    └─ Append JSON line to /private/sponsor-events.jsonl
                │
                ▼
        Reader endpoint:
        /api/sponsors-list.php
            │
            ├─ Replays events: created / edited / tier_changed / cancelled
            ├─ Computes active sponsor set + total raised
            └─ Returns public-safe JSON
                │
                ▼
        Front-end:  /assets/js/sponsor-widget.js
            │
            └─ Renders avatars + tier chips + progress bar on splc.html
```

## Webhook setup (one-time, manual)

1. **Generate a secret** locally:

   ```powershell
   $bytes = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   $secret = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
   $secret | Out-File -Encoding utf8 -NoNewline "$HOME\.spiralcoin_sponsor_webhook_secret"
   ```

2. **Upload the secret** to IONOS at `/private/sponsor-webhook-secret.txt`
   (via File Manager — never commit it).
3. Open <https://github.com/sponsors/SpiralCoin-Official/dashboard/webhooks>
   → **Add webhook**:
   - Payload URL: `https://www.spiralcoin.net/api/sponsor-webhook.php`
   - Content type: `application/json`
   - Secret: paste from step 1
   - SSL verification: **Enabled**
   - Events: **Send me everything**
   - Active: **leave unchecked** until the deploy has been verified
4. Send a test delivery from the webhook page.
5. Verify a new line appears in `/private/sponsor-events.jsonl`.
6. Flip Active ON.

## Stored event format

```jsonl
{"ts":"2026-05-28T20:15:00+00:00","event":"sponsorship","delivery":"ab12-…","action":"created","sponsor":"octocat","tier":"Founding Sponsor","amount":12000,"one_time":true,"raw":{ … full GitHub payload … }}
```

## Public sponsor JSON: `GET /api/sponsors-list.php`

```json
{
  "sponsors": [
    {"login":"octocat","avatar_url":"https://…","tier":"Founding Sponsor","one_time":true,"amount":12000,"since":"2026-05-28T20:15:00+00:00"}
  ],
  "total_sponsors": 1,
  "one_time_count": 1,
  "total_raised_usd": 12000,
  "goal_usd": 120000,
  "goal_count": 10,
  "updated_at": "2026-05-28T20:16:00+00:00"
}
```

Cache: 60 s public. CORS: only `https://www.spiralcoin.net`.

## Opt-out

A sponsor can request removal from the public wall by emailing
`sponsor@spiralcoin.net`. Their entry is suppressed by adding their GitHub
login to a server-side opt-out list (TODO: implement in `sponsors-list.php`).
The funding total remains accurate; only the display name/avatar is hidden.

## Compliance copy on splc.html

The sponsor section copy must always include the donation/not-investment
disclaimer. See [Compliance](Compliance.md).

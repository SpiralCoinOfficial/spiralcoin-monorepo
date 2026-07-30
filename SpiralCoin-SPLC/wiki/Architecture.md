# Architecture

## High-level diagram

```
                       ┌───────────────────────────┐
                       │   www.spiralcoin.net      │
                       │   (IONOS shared hosting)  │
                       │   Apache + PHP 8.x        │
                       └─────────────┬─────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
   Static HTML/JS               PHP API endpoints           Private storage
   (/, /splc.html,              (/api/*.php)                (/private/*.json
    /trade.html, …)                  │                       .jsonl, .htaccess
        │                            │                       deny-all)
        ▼                            ▼
   Auth0 SPA SDK              Auth0 JWKS verify
   (CDN, browser)             GitHub Sponsors HMAC
        │                     Webhook ingest
        ▼
   MetaMask + SIWE
        │
        ▼
   Arbitrum One RPC
   (Alchemy / Infura)
```

## Hosting

- **Provider:** IONOS shared webspace (`access-5020476011.webspace-host.com`)
- **Domain:** `www.spiralcoin.net` (DNS via Squarespace / IONOS)
- **TLS:** Let's Encrypt managed by IONOS
- **Runtime:** Apache 2.4 + PHP 8.x (no Composer, no command-line access)

## Front end

| Layer | Tech | Notes |
|---|---|---|
| Markup | Static HTML | One file per route — no SPA router |
| Styles | Inline + `/assets/css/*` | CSS variables, no framework |
| Scripts | Plain ES6, no bundler | Loaded with `?v=YYYYMMDDx` cache-bust |
| Auth | `@auth0/auth0-spa-js` 2.x | CDN, refresh tokens, localStorage cache |
| Wallet | `window.ethereum` direct | MetaMask / Brave / Coinbase Wallet |
| Analytics | GA4 via `gtag.js` | Custom event names in `assets/js/ga-events.js` |

## Back end

| Endpoint | File | Purpose |
|---|---|---|
| `/api/sponsor-webhook.php` | [api/sponsor-webhook.php](../api/sponsor-webhook.php) | Ingest GitHub Sponsors events |
| `/api/sponsors-list.php` | [api/sponsors-list.php](../api/sponsors-list.php) | Public read of active sponsors |
| `/api/bind-wallet.php` | [api/bind-wallet.php](../api/bind-wallet.php) | Auth0-authenticated wallet binding |
| `/api/regd.php` | [api/regd.php](../api/regd.php) | Reg D investor capture |
| `/api/balance.php` | [api/balance.php](../api/balance.php) | RPC proxy (Alchemy/Infura) |
| `/api/polygon.php` | [api/polygon.php](../api/polygon.php) | Polygon RPC proxy |
| `/api/yahoo.php` | [api/yahoo.php](../api/yahoo.php) | Quote proxy |

All PHP endpoints share these conventions:

- `declare(strict_types=1)`
- `Content-Type: application/json; charset=utf-8`
- `X-Content-Type-Options: nosniff`
- Constant-time compares via `hash_equals`
- Atomic file writes via `flock(LOCK_EX)`

## Persistence

No SQL database. Two append-only stores under `/private/`:

- `wallet-bindings.json` — keyed by Auth0 `sub`
- `sponsor-events.jsonl` — one event per line

Both are protected by `private/.htaccess` (`Require all denied`).

## CI / CD

| Workflow | File | Trigger |
|---|---|---|
| Deploy to IONOS | [.github/workflows/deploy-ionos.yml](../.github/workflows/deploy-ionos.yml) | push to `main` |
| CodeQL (JS only) | [.github/workflows/codeql.yml](../.github/workflows/codeql.yml) | push, PR, weekly cron |

## On-chain

- **Network:** Arbitrum One (chain ID `42161`)
- **Token:** SPLC (ERC-20) — **not deployed yet**
- **LP:** SPLC/USDC on a major Arbitrum AMM — **pending deploy**
- **Lock:** Founder LP tokens lock contract — **pending deploy**

## Identity & access

```
Visitor
   │
   ├─ Auth0 Universal Login (Email / Google / GitHub*)
   │     │
   │     └─ ID token (RS256 JWT) ──► PHP backend (JWKS verify)
   │
   └─ MetaMask connect (optional, post-login)
         │
         └─ EIP-4361 SIWE personal_sign ──► /api/bind-wallet.php
                                              │
                                              └─ stores {sub, address, message, sig}
```

\* GitHub social connection pending OAuth App creation in `SpiralCoinOfficial` org.

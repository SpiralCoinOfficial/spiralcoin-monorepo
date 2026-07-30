# Security Policy

## Reporting a Vulnerability

Email **<security@spiralcoin.net>** with a description, reproduction steps, and
your contact info. Please do **not** open public GitHub issues for suspected
vulnerabilities. We aim to acknowledge reports within 72 hours.

PGP key and bug-bounty details will be published prior to mainnet token launch.

## Supported Components

| Component                                    | Supported |
| -------------------------------------------- | --------- |
| `api/*.php` (current `main`)                 | yes       |
| `contracts/` (post-audit Arbitrum One)       | yes       |
| `app/` PWA shell                             | yes       |
| Pre-audit dev branches                       | no        |

## Security Architecture Highlights

### Authentication

- Auth0 SPA SDK (PKCE) front-end; refresh tokens enabled.
- All server endpoints requiring identity verify the Auth0 RS256 ID token via
  `api/_auth0_verify.php`, which:
  - Fetches and caches JWKS in `private/auth0-jwks.cache.json` (TTL 24h).
  - Reconstructs the RSA public key from JWKS `n`/`e` (no Composer required).
  - Verifies signature with `openssl_verify` + `OPENSSL_ALGO_SHA256`.
  - Validates `iss`, `aud` (SPA client ID), `exp`, and presence of `sub`.

### Wallet Binding (Sign-In With Ethereum, EIP-4361)

- **Server-issued single-use nonces** (`api/wallet-nonce.php`):
  - Issued only to authenticated Auth0 subs.
  - 32 hex chars (`random_bytes(16)`), 10-minute TTL.
  - Stored in `private/wallet-nonces.json` (write-locked with `flock(LOCK_EX)`).
  - **Rate-limited**: max 5 issuances per sub per 60-second window (HTTP 429).
- **Replay protection** (`api/bind-wallet.php`):
  - SIWE message must contain the server-issued nonce.
  - Nonce is atomically deleted after successful verification (single-use).
  - SIWE `Issued At` must be no more than 10 minutes old.
  - `Domain` must match an allowlist (`www.spiralcoin.net`, `spiralcoin.net`,
    `localhost` for dev).
  - `Chain ID` must equal **42161** (Arbitrum One).
  - Signature recovered via `personal_sign` ecrecover and compared with the
    submitted address using constant-time comparison.

### Data at Rest

- Sensitive state lives under `private/`, denied by `.htaccess Require all
  denied`.
- Webhook secret in `private/sponsor-webhook-secret.txt`, never committed.
- JSON/JSONL writes use `flock(LOCK_EX)` plus `ftruncate` for atomicity.

### Webhooks

- GitHub Sponsors webhook (`api/sponsor-webhook.php`) validates
  `X-Hub-Signature-256` with `hash_equals` (constant-time HMAC compare).

### Transport

- HTTPS-only on IONOS (HSTS recommended in `.htaccess`).
- All API responses set `X-Content-Type-Options: nosniff`.
- Public stats endpoints use short-lived public `Cache-Control` only;
  authenticated endpoints set `Cache-Control: no-store`.

### CI Safety Net

- `.github/workflows/codeql.yml` — JavaScript/TypeScript SAST.
- `.github/workflows/php-lint.yml` — `php -l` + PHPStan + PHPCS on `api/`.

## Out of Scope

- Smart-contract findings prior to the published audit.
- Third-party libraries with public CVEs already pending upstream patches.
- Social engineering, physical attacks, or DoS without proof of asymmetry.

## Disclosure Window

Coordinated disclosure. Typical fix window is 90 days from acknowledgement,
shortened for actively exploited issues.

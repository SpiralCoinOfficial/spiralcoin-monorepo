# Roadmap

> Living document. Tracks what's built, what's in flight, and what's next.

## Phase 0 — Site & infrastructure (✅ complete)

- [x] Public marketing site live at `www.spiralcoin.net`
- [x] Pages: home, splc, markets, trade (demo), portfolio, dashboard, account, settings, watchlist, news, charts, analytics, taxes, pricing, community, whitepaper, signup, login, cookies, 404
- [x] Brand: logo set, OG card, apple-touch-icon, favicon set
- [x] Apache `.htaccess` with HTTPS redirect, security headers, CSP
- [x] PWA manifest + service worker
- [x] GA4 analytics with custom event names
- [x] Geo-block bootstrap

## Phase 1 — Identity (✅ complete)

- [x] Auth0 SPA application provisioned (`hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB`)
- [x] PKCE flow + refresh tokens + localStorage cache
- [x] Email/password login
- [x] Google social login
- [x] `assets/js/auth0-client.js` singleton (`window.SPLCAuth`)
- [x] Branded login page + callback handler
- [x] Auth-guard on protected pages (account, dashboard, portfolio, settings, trade, trade-confirm, watchlist)

## Phase 2 — Wallet binding (🟡 MVP done, hardening pending)

- [x] MetaMask connect button + nav chip
- [x] EIP-4361 SIWE message construction
- [x] Server-side JWT verification (RS256 + JWKS, no Composer)
- [x] SIWE domain + Issued-At freshness validation
- [x] Atomic file storage in `/private/wallet-bindings.json`
- [ ] **Server-side ECDSA recovery** (vendor `simplito/elliptic-php` + `kornrunner/keccak`)
- [ ] Server-issued nonces (replace client `crypto.getRandomValues` with `GET /api/wallet-nonce.php` + Redis-like store)
- [ ] Per-user binding history page in `/account.html`

## Phase 3 — Sponsorship program (🟡 plumbing done, secret upload pending)

- [x] GitHub Sponsors tier defined ($12K × 10 = $120K founding round)
- [x] Webhook receiver (`api/sponsor-webhook.php`) — HMAC verify, JSONL append
- [x] Public read API (`api/sponsors-list.php`) — event replay, deduped active set
- [x] Live progress bar + sponsor grid on `splc.html`
- [ ] Upload webhook secret to IONOS `/private/sponsor-webhook-secret.txt`
- [ ] Register webhook in GitHub Sponsors dashboard
- [ ] Per-sponsor opt-out file + UI
- [ ] Email confirmation to sponsor after webhook fires
- [ ] Dedicated `funding/sponsors.html` wall page

## Phase 4 — CI/CD (🟡 workflow committed, secrets pending)

- [x] `.github/workflows/deploy-ionos.yml` — SFTP auto-deploy on push to main
- [x] `.github/workflows/codeql.yml` — JavaScript-only CodeQL
- [ ] Add `IONOS_SFTP_*` repo secrets
- [ ] First green deploy
- [ ] Disable GitHub's broken "default" CodeQL setup
- [ ] Add `php-cs-fixer` + `phpstan` workflow for PHP linting

## Phase 5 — Smart contracts (⏸ pre-audit)

- [ ] Finalize `SPLC.sol` (ERC-20, fixed supply, no mint, no pause)
- [ ] Finalize `LpAndLock.sol` (4-year linear unlock)
- [ ] Hardhat test suite ≥ 90% coverage
- [ ] Slither + Mythril clean
- [ ] Third-party audit (funded by founding sponsors)
- [ ] Mainnet deploy to Arbitrum One
- [ ] Publish addresses to `contracts/deployments/arbitrum/`
- [ ] Verify on Arbiscan

## Phase 6 — Liquidity bootstrap (⏸ post-audit)

- [ ] Acquire $20,000 USDC on Arbitrum
- [ ] Deploy SPLC/USDC pool on Uniswap V3 or Camelot
- [ ] Transfer LP tokens to `LpAndLock` contract
- [ ] Publish lock tx hash on `splc.html`
- [ ] Begin weekly TVL/volume report cron

## Phase 7 — Indexer (⏸ post-LP-launch)

- [x] `indexer/` directory scaffolded
- [ ] Subscribe to `Transfer` events on SPLC + pool
- [ ] Compute holder count, TVL, 24 h volume
- [ ] Expose via `/api/status.php`
- [ ] Render real numbers on home page hero

## Phase 8 — Real trading (⏸ post-licensure)

Blocked on either:

- **Self-hosted spot exchange license** (state-by-state MTL or BitLicense), or
- **Third-party broker partnership** (e.g. Alpaca Crypto, Apex Crypto)

Until then, the trading pages remain demo-only with persistent banner.

## Phase 9 — Governance (✏️ design)

- [ ] Snapshot space for off-chain signaling
- [ ] On-chain timelock + governor contracts (post-audit)
- [ ] First proposal: fee switch parameters

## Always-on

- Monitor IONOS uptime
- Rotate webhook secret every 90 days
- Review compliance copy quarterly
- Reply to GitHub issues and sponsor emails within 5 business days

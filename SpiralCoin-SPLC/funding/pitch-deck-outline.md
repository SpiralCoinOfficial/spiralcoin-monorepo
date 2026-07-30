# SpiralCoin — Pitch Deck Outline (Pre-Seed / Seed)

> 10-12 slide outline for raising $500K-$1M at $3-6M post-money on a SAFE.
> Target audience: crypto-native angels, ecosystem funds (Arbitrum, Base, Polygon),
> small fintech VCs comfortable with regulated paths.

Last updated: 2026-05-29

---

## Slide 1 — Cover

- **SpiralCoin** — a modern trading platform with a native multi-chain token
- One line: *Live charts, watchlists, and a portfolio workspace for active traders, paired with a multi-chain token (SPLC) that powers gas, governance, and rewards.*
- Founder: Trisha Dreyer · `owner.splctoken@gmail.com` · spiralcoin.net
- Raising: **$750K SAFE @ $5M post** (adjustable)

## Slide 2 — Problem

- Active traders juggle 4-6 separate tools: charts (TradingView), watchlists (Yahoo), portfolio (Excel), price alerts (Discord bots), exchange UIs, on-chain analytics.
- Crypto-native users additionally pay gas in ETH they don't always hold.
- No single workspace blends TradFi-style analytics with crypto-native primitives without forcing custody.

## Slide 3 — Solution

- One workspace: charts, watchlists, portfolio, alerts — mobile-ready
- A free demo so users try before they fund
- Native token (SPLC) for: gas payment (ERC-4337 paymaster), governance, staking rewards, AMM fee accrual
- Non-custodial by default; user keeps keys

## Slide 4 — Why now

- ERC-4337 (account abstraction) production-ready since 2024 → gas-in-token UX finally possible
- L2 fees on Arbitrum/Base sub-cent → paymaster economics work
- LayerZero OFT v2 makes one canonical token across 6 chains
- Retail brokerages (Robinhood, Public) added crypto but bad on-chain UX — gap to fill

## Slide 5 — Product (screenshots)

- Hero shot: dashboard with charts + watchlist + portfolio panes
- Mobile shot: same workspace on phone
- Paymaster flow: "Pay gas in SPLC"
- Demo mode: "Try the platform with simulated balances"

## Slide 6 — Technology / Architecture

- Smart contract suite (13 contracts): Token + DAO + Timelock + Staking + Presale + LP Lock + Paymaster + TWAP Oracle + Merkle Airdrop
- Solidity ^0.8.24 · OZ v5 · LayerZero OFT v2
- Multi-chain: Arbitrum, Base, Polygon, Optimism, BSC, Ethereum
- Internal audit complete (1 high, 3 medium all resolved); external audit Q2
- Trading platform: 28-page web app, GA4 + Cookiebot, CSP-hardened, IONOS-hosted
- CI/CD: Hardhat tests, Slither, deploy automation, working PHP API for wallet binding (ECDSA-verified)

## Slide 7 — Traction & Validation

*Honest current state:*

- Working codebase shipped (audit-clean internally)
- Site live at spiralcoin.net
- Compliance footer + risk disclosures on every page
- Google Tag wired (AW-18194981189)
- 6 ecosystem grant applications in motion (Arbitrum, Base, Optimism, Polygon, Gitcoin, Conduit, Mantle)
- Non-crypto ad campaign running (compliance-compatible while crypto cert pends)

*What we don't have yet (and the round funds):*

- External audit
- Mainnet deployment
- Paying users at scale
- FinCEN MSB registration

## Slide 8 — Business Model

- **Platform subscriptions:** $9.99/mo Pro tier, $19.99/mo Plus
- **AMM tax:** 3.14% on SPLC AMM trades, split 50/50 treasury / staking
- **Paymaster spread:** 2% surcharge on gas-in-SPLC
- **LP fees:** treasury-owned, locked LP position accrues fees
- **B2B / API:** future — data/widget licensing to other crypto sites

## Slide 9 — Go-to-market

- **Phase 1 (now):** Non-crypto "platform" Google Ads → SEO content → demo signups
- **Phase 2 (Q2-Q3):** Crypto-targeted ads after Google certification + FinCEN MSB
- **Phase 3 (Q4+):** Influencer / podcast / Twitter Spaces; tier-2 CEX listings; community grants
- **Distribution moats:** SEO content library + token holder community + paymaster ecosystem partners

## Slide 10 — Legal & Compliance

- FinCEN Form 107 filing in progress (Money Transmitter category)
- Google Financial Services Verification applied
- Google Cryptocurrency Advertiser Certification queued (post-MSB)
- US geofence active until first state MTL or partner-MSB live
- Reg D 506(c) path for US accredited investors only
- External audit committed before any mainnet TVL

## Slide 11 — 12-Month Plan & Use of Funds

| Quarter | Milestone |
|---|---|
| Q1 (Jun-Aug 26) | FinCEN MSB filed · audit kickoff · testnet deploy · grants out |
| Q2 (Sep-Nov 26) | MSB granted · audit done · mainnet with capped TVL · LP seeded |
| Q3 (Dec 26-Feb 27) | TGE · presale · cross-chain via LayerZero · paymaster beta · first hire |
| Q4 (Mar-May 27) | Scale ads · state MTLs or partner-MSB · staking live · airdrop |

**Use of $750K:**

- $80K external audit + bug bounty
- $60K legal (MSB filing, attorney, securities counsel, state-MTL strategy)
- $180K marketing (ads, content, listings)
- $200K first-year salaries (founder + one hire)
- $150K liquidity seed for SPLC/USDC mainnet LP
- $80K runway buffer / contingency

## Slide 12 — Team & Ask

**Founder — Trisha Dreyer**

- Solo-built the contract suite + platform + CI
- Owner-operator, full-time committed

**The ask: $750K SAFE at $5M post-money cap**

- Lead anchor preferred; rolling close OK
- 18-month runway to MRR profitability and Series A inflection

**Contact:** `owner.splctoken@gmail.com` · `spiralcoin.net`

---

## Appendix slides (only if asked)

### A1 — Token economics

- Fixed cap or capped emissions (TBD)
- Distribution: % presale, % team (vested 36mo cliff 12mo), % treasury (DAO-controlled), % staking rewards, % airdrop, % LP
- 3.14% AMM tax: 50% treasury, 50% staking rewards
- Governance: 48h timelock, SpiralDAO Governor

### A2 — Competitive landscape

- vs TradingView: we're cheaper + crypto-native
- vs CoinGecko: we have a workspace, not just data
- vs DEX aggregators (1inch): we're a workspace + token + paymaster, not just routing
- vs centralized brokerages (Public, Robinhood): we're non-custodial + on-chain

### A3 — Risk register (we proactively disclose)

- Regulatory: pre-MSB, will sequence carefully
- Technical: audit + bug bounty + capped TVL
- Market: not dependent on token price for runway
- Founder risk: first hire planned Q3

### A4 — Cap table & previous funding

- 100% founder-owned currently
- No prior priced rounds
- No debt
- Will issue SAFEs at $5M post-money cap, 20% discount

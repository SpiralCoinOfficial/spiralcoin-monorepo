# SpiralCoin LLC — 12-Month Roadmap (Jun 2026 → May 2027)

> Forward-looking plan. Numbers are planning brackets, not commitments.
> Update this file at the end of each month with actuals.
> Trading involves risk. Past performance does not guarantee future results.

Last updated: 2026-05-29
Owner: Trisha Dreyer (founder)

---

## Baseline assumptions

| Input | Value used |
|---|---|
| Starting cash on hand | ~$5K (founder-funded) |
| Team size | 1 founder; +1 contractor by Q3 |
| Monthly burn (lean) | $2-4K (hosting, tools, legal reserve) |
| External audit budget | $20-30K (CertiK Skynet / Hacken entry) |
| State strategy | Geofence US until ≥1 state MTL or partner-MSB live |
| Token launch | Q3 2026 testnet → Q4 limited mainnet → 2027 broader |
| Crypto market regime | Neutral / sideways |

---

## Quarterly plan

### Q1 — Jun-Aug 2026 — Legal & Foundation

**Legal**

- [ ] File **FinCEN Form 107** (Money Transmitter) → get MSB number
- [ ] Engage fintech attorney for **state-MTL exposure memo** ($3-8K)
- [ ] Draft **AML/KYC program** (use `aml-policy-draft.md` as starting point)
- [ ] Update Privacy Policy + Terms + Risk Disclosure on site

**Compliance**

- [ ] Apply for **Google Financial Services Verification**
- [x] Keep crypto Google ads paused; run `/platform.html` non-crypto ad set only

**Tech**

- [ ] External audit kickoff (CertiK or Hacken)
- [ ] Deploy core contracts (`SpiralCoinUpgradeable`, `SPLCStakingVault`, `SpiralDAO`) to **Arbitrum Sepolia testnet**
- [ ] Public testnet faucet

**Marketing**

- [ ] 5-10 SEO blog posts on charts/analytics/portfolio topics
- [ ] Twitter + Discord community soft-launch (target 250 followers)

**Grants**

- [ ] Submit Arbitrum, Base, Optimism, Polygon, Gitcoin, Conduit (see `grant-priority.md`)

**Revenue target:** $0-500 MRR

---

### Q2 — Sep-Nov 2026 — Audit & Soft Launch

**Legal**

- [ ] Receive FinCEN MSB number (typically 4-12 weeks after Form 107)
- [ ] Receive attorney's state-MTL memo → decide allowlist (likely WY, TX, FL, NH, MT + non-US)
- [ ] If keeping US blocked: keep `geo-block.js` as-is; if selectively allowing: enable `state-geofence.js`
- [ ] Apply for **Google Cryptocurrency Advertiser Certification** using MSB number

**Tech**

- [ ] Audit report received → fix findings → re-test
- [ ] Slither + Mythril in CI (Slither already added 2026-05-29)
- [ ] Bug bounty live on **Immunefi** ($5K-$25K pool)
- [ ] Deploy verified contracts to **Arbitrum One mainnet** with **capped TVL** ($100-250K)
- [ ] Seed **SPLC/USDC** pool ($25-50K personal capital, locked 12mo via `SPLCLPLock`)

**Marketing**

- [ ] If Google Crypto Cert lands → unpause crypto ad set
- [ ] List on CoinGecko (free) and CoinMarketCap (free)
- [ ] First podcast / Twitter Spaces appearances

**Grants**

- [ ] First decisions land: expect 1-2 yes out of 6 (target $10-50K)

**Revenue target:** $1K-5K MRR + first grant proceeds

---

### Q3 — Dec 2026-Feb 2027 — Token Launch & First Real Users

**Legal**

- [ ] If presale planned: **securities attorney** structures as Reg D 506(c) (US accredited) or Reg S (non-US) — never unregistered US retail ($5-15K legal)
- [ ] AML/KYC vendor live (Sumsub or Persona, ~$1-3/verification)

**Tech**

- [ ] **TGE** — Token Generation Event
- [ ] Public sale: $250K-$1M target at $0.01-$0.05/SPLC
- [ ] Cross-chain via LayerZero OFT to **Base + Polygon**
- [ ] Paymaster launch in limited beta

**Marketing**

- [ ] First listing on **Uniswap V3 (Arbitrum)**
- [ ] Apply tier-2 CEX listings (MEXC, Gate — defer until $1M+ daily volume)
- [ ] Spend $5-15K/month on Google + Twitter Ads

**Hiring**

- [ ] First contractor: smart contract dev or community manager ($3-6K/mo)

**Revenue target:** Platform $5-15K MRR + Presale $100K-$1M one-time + AMM tax $2-20K

---

### Q4 — Mar-May 2027 — Scale or Sober Up

**Legal**

- [ ] If 5-figure daily volume: begin **state MTL applications** for top 3-5 states OR formalize **partner-MSB** (Bridge / Prime Trust / MoonPay)
- [ ] 1099-DA tax reporting infrastructure (IRS req from 2026 forward)

**Tech**

- [ ] Audit v2 (post-mainnet usage)
- [ ] Launch staking rewards via `SPLCStakingVault`
- [ ] Launch `SPLCAirdropMerkle` for early users (10M-50M SPLC)
- [ ] Open-source platform widgets

**Marketing**

- [ ] $10-30K/month across Google, Twitter, Reddit, podcasts
- [ ] Target: 5,000-15,000 platform users

**Hiring**

- [ ] Add full-time CTO or growth marketer ($8-15K/mo)

**Revenue target:** Platform $15-50K MRR + Trading fees $20-100K MRR + LP/staking $5-20K MRR

---

## 12-month revenue scenarios

| Source | Conservative | Base case | Optimistic |
|---|---|---|---|
| Platform subscriptions | $20K | $80K | $300K |
| Trading fees (3.14% AMM tax, 50% to treasury) | $5K | $50K | $400K |
| Presale / token sale | $0 | $250K | $1.5M |
| Ecosystem grants | $5K | $25K | $100K |
| Paymaster gas markup | $0 | $5K | $40K |
| LP fee accrual | $2K | $15K | $80K |
| Advisory / partnerships | $0 | $10K | $50K |
| **TOTAL** | **$32K** | **$435K** | **$2.47M** |

Most-likely actual: **$50K-$300K collected**.

## 12-month cost stack

| Category | Conservative | Base | Optimistic |
|---|---|---|---|
| Legal | $5K | $20K | $60K |
| Audit + bug bounty | $20K | $40K | $80K |
| Hosting + tools + KYC | $3K | $10K | $25K |
| Ad spend | $5K | $40K | $200K |
| Contractor / first hire | $0 | $30K | $120K |
| Listing fees + gas + liquidity seed | $10K | $50K | $300K |
| State MTL + bonds | $0 | $50K | $500K |
| **TOTAL** | **$43K** | **$240K** | **$1.29M** |

## Net trajectory

| Scenario | Y1 cash position | Token treasury (paper) | Defensible company value |
|---|---|---|---|
| Conservative | ~-$10K | $50-200K | $150K-$500K |
| Base case | ~+$195K | $500K-$3M | $1.5M-$5M |
| Optimistic | ~+$1.18M | $3M-$15M | $8M-$30M |
| Failure | -$50-200K + legal | $0 | $0 or negative |

Probability mix (founder's honest estimate): Failure 30-40% · Conservative 25% · Base 25-30% · Optimistic 5-10%.

---

## Critical legal sequence (DO NOT skip or re-order)

1. Form 107 → FinCEN MSB number
2. Fintech attorney memo on state MTLs
3. Geofence implemented in signup (already live via `assets/geo-block.js`)
4. AML/KYC program + KYC vendor live
5. External audit + bug bounty live
6. Securities counsel review of presale structure
7. **Then and only then** — launch presale or paymaster on mainnet

Steps 1-6 take 4-6 months if you move fast. Don't compress.

---

## Decision points

- **End of Q1:** No FinCEN progress + no grants → reconsider scope; maybe ship non-custodial platform only for 6 more months
- **End of Q2:** Audit reveals criticals → delay TGE; never launch with known criticals
- **End of Q3:** Presale <$100K AND <100 paying platform users → product-market fit missing; pivot or accept lifestyle scale
- **End of Q4:** MRR <$5K → raise outside capital (20-30% equity for $500K-$1M seed) or downscale solo

---

## What can go wrong (likelihood-ordered)

1. **Regulatory letter** (SEC / state AG / FinCEN) → $20-200K legal defense
2. **Smart contract exploit** → reputational ruin → mitigation: audit + bug bounty + capped TVL
3. **Ad account permanent ban** for policy violations → no Google traffic ever
4. **Bear market** → token -70-90%, revenue collapses
5. **Founder burnout** (most common single-founder outcome)
6. **Stablecoin depeg** → LP loss
7. **AI-built competitor commoditizes platform UI**

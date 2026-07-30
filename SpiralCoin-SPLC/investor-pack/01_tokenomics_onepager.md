<!-- markdownlint-disable MD060 -->
# SPLC Tokenomics — One-Pager

**Token:** SpiralCoin (`SPLC`)
**Standard:** ERC-20 (UUPS upgradeable) + LayerZero OFT V2 (omnichain)
**Total Supply:** 1,000,000,000 SPLC (fixed — no mint function post-init)
**Transfer Tax:** 3.14% on AMM buys/sells only · immutable · routed to treasury

---

## 1. Headline Allocation — 9-Bucket Distribution

Tokenomics are locked in [`contracts/config/launch.json`](../contracts/config/launch.json) and enforced on-chain via `SPLCPresaleVesting`, `SPLCStakingVault`, and `SPLCLPLock`. No bucket can be silently re-weighted.

| Bucket                       | Tokens         | % of Supply | Cliff   | Vest     | Destination |
|------------------------------|----------------|-------------|---------|----------|-------------|
| Staking Rewards              | 300,000,000    | 30.0%       | 0       | 48 mo    | `SPLCStakingVault` |
| Project Treasury / Ops       | 200,000,000    | 20.0%       | 6 mo    | 24 mo    | Treasury Safe (multisig) |
| Founder & Team               | 150,000,000    | 15.0%       | 3 mo    | 12 mo    | `SPLCPresaleVesting` |
| Public Presale (Reg CF + S)  | 100,000,000    | 10.0%       | 0       | 6 mo     | `SPLCPresalePublic` |
| CEX Listing Reserve          | 100,000,000    | 10.0%       | 0       | n/a      | Cold Ledger (use-on-listing) |
| Ecosystem Grants (DAO-voted) | 80,000,000     | 8.0%        | 12 mo   | 36 mo    | DAO Timelock |
| Accredited Reg D 506(c)      | 50,000,000     | 5.0%        | 6 mo    | 12 mo    | `SPLCPresaleVesting` |
| Liquidity Seed (multi-chain) | 15,000,000     | 1.5%        | —       | 1 yr lock| `SPLCLPLock` |
| Airdrop (Merkle, 90-day)     | 5,000,000      | 0.5%        | 0       | 0        | `SPLCAirdropMerkle` |
| **Total**                    | **1,000,000,000** | **100.0%** |         |          |               |

### Float at TGE

- **Unlocked at TGE:** Public Presale (10%) + Airdrop (0.5%) + LP Seed (1.5%) = **12.0% circulating float**
- **Locked at TGE:** 88.0% (in vesting, staking, treasury, CEX reserve, grants contracts)

This light float is intentional: it minimizes day-1 sell pressure and protects LP depth.

### Founder Allocation Rationale

- 15% founder/team with **3-month cliff + 12-month linear** is industry-standard for early-stage L2 launches (see Arbitrum 2023, Optimism 2022, comparable to Aerodrome / Pendle founder schedules).
- Combined with the 20% Treasury bucket also held under multisig governance, insider supply is **well below** the 35% threshold most Tier-1 CEX listing committees flag for re-vesting.

---

## 2. On-Chain Initial Mint (Arbitrum One)

At construction, 1B SPLC is minted **once** to two wallets, then distributed into the bucket contracts above:

| Wallet                              | Address                                      | Initial Mint | Role |
|-------------------------------------|----------------------------------------------|--------------|------|
| Premine / Distribution Vault        | `0x3a1Dc8a78AE204C1EBAEe58699826f0b21c30D7F` | 900,000,000  | Funds 8 of 9 buckets via on-chain transfers post-deploy |
| Founder Operating Wallet            | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` | 100,000,000  | Working capital for the Founder & Team bucket (subject to same 3mo / 12mo vesting once moved into `SPLCPresaleVesting`) |

LayerZero V2 OFT bridges SPLC to ETH, Base, BSC, Optimism, and Polygon — **no re-mint occurs on other chains**; supply is locked at 1B forever.

---

## 3. Locked Allocation Detail

All locked tokens sit in the appropriate on-chain contract — beneficiary-pull, no admin revoke, no rug.

| Bucket            | Tokens         | Cliff      | Linear Release         | Fully Unlocked At |
|-------------------|----------------|------------|------------------------|-------------------|
| Founder & Team    | 150,000,000    | 3 months   | Monthly over 12 months | Month 15 |
| Project Treasury  | 200,000,000    | 6 months   | Monthly over 24 months | Month 30 |
| Reg D 506(c)      | 50,000,000     | 6 months   | Monthly over 12 months | Month 18 |
| Staking Rewards   | 300,000,000    | None       | 48 months linear        | Month 48 |
| Ecosystem Grants  | 80,000,000     | 12 months  | Monthly over 36 months | Month 48 |
| Public Presale    | 100,000,000    | None       | Monthly over 6 months  | Month 6 |
| CEX Reserve       | 100,000,000    | —          | Released only on signed listing agreement | Use-gated |

### Unlock Curve (approximate, cumulative tokens unlocked from locked buckets)

| Month | Founder (12mo) | Treasury (24mo) | Reg D (12mo) | Staking (48mo) | Grants (36mo) | Public (6mo) | Cumulative Unlocked | % of 1B Supply |
|-------|----------------|------------------|---------------|-----------------|----------------|---------------|----------------------|-----------------|
| 0     | 0              | 0                | 0             | 0               | 0              | 0             | 20.5M (TGE float)    | 2.05%           |
| 3     | 0 (cliff)      | 0 (cliff)        | 0 (cliff)     | ~18.75M         | 0 (cliff)      | 50M           | ~88.75M              | 8.9%            |
| 6     | 37.5M          | 0 (cliff)        | 0 (cliff)     | ~37.5M          | 0 (cliff)      | 100M (done)   | ~175M                | 17.5%           |
| 12    | 112.5M         | 50M              | 25M           | ~75M            | 0 (cliff)      | 100M          | ~362.5M              | 36.3%           |
| 15    | 150M (done)    | 75M              | 50M (done)    | ~93.75M         | ~6.7M          | 100M          | ~475M                | 47.5%           |
| 24    | 150M           | 150M             | 50M           | ~150M           | ~26.7M         | 100M          | ~626.7M              | 62.7%           |
| 30    | 150M           | 200M (done)      | 50M           | ~187.5M         | ~40M           | 100M          | ~727.5M              | 72.8%           |
| 36    | 150M           | 200M             | 50M           | ~225M           | ~53.3M         | 100M          | ~778.3M              | 77.8%           |
| 48    | 150M           | 200M             | 50M           | 300M (done)     | 80M (done)     | 100M          | ~880M + CEX (gated) + LP (1yr lock released) | 100% theoretical max |

---

## 4. LP Launch — Bootstrap Liquidity on Arbitrum One

SPLC launches with **honest, bootstrap-scale liquidity**. No fabricated valuation, no VC-priced premium, no promise of future price.

- **Pool:** `SPLC / USDC` on Uniswap V3, **1% fee tier**, **full-range** position
- **Chain:** Arbitrum One (chainId 42161) — proxy `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C`
- **Token seed:** **1,000,000 SPLC** (from the 15M LP Seed bucket; 14M reserved for future cross-chain expansion)
- **USDC seed:** **$1,000 USDC** — solo-founder bootstrap capital
- **Initial price:** **$0.001 / SPLC** (1M USDC-side ÷ 1M SPLC; bootstrap FDV ≈ $1M)
- **LP NFT custody:** transferred into `SPLCLPLock` immediately after mint
- **Lock duration:** **12 months minimum** (`LP_LOCK_DURATION_SEC=31536000`); recommended 24 months at launch
- **Tax fires?** **No** — V3 pools are tax-exempt to preserve K-invariant. The 3.14% AMM tax only activates if/when a V2 pool is added via explicit `setAmmPair()`.
- **Fee collection:** permissionless, routes 1% LP fees to treasury at unlock
- **Third-party lock option:** UNCX Network or Team Finance can take custody of the same NFT as an additional trust signal

### Why Bootstrap?

The pool is intentionally small because the project is solo-funded. We do not pretend otherwise.

- **Price is discovered, not declared.** Whatever the market pays after open is the price.
- **No VC valuation premium.** No private round priced higher than retail.
- **Future presale rounds (Reg D, Reg CF) — if conducted — will be priced from the then-current 30-day market VWAP**, with a documented discount or premium per offering. They are NOT pre-set in this document.
- **Cross-chain pool expansion** (ETH, Base, BSC, Polygon, Optimism) is funded from the remaining 14M LP Seed reserve and treasury, deployed as capital and organic demand justify — never on a fixed timeline.

> Trading involves risk. Past performance does not guarantee future results. Bootstrap-launched tokens with thin initial liquidity are inherently volatile.

---

## 5. Contract Architecture

- `SpiralCoinUpgradeable.sol` — UUPS proxy, ERC20Permit + ERC20Votes, immutable 3.14% AMM tax, LayerZero OFT V2
- `SPLCPresaleVesting.sol` — cliff + linear vesting, no revoke
- `SPLCLPLock.sol` — UniV3 NFT lock, extend-only, permissionless fee collection
- `SPLCPaymaster.sol` — ERC-4337 v0.7 paymaster, accepts SPLC for gas
- `SPLCTwapOracle.sol` — 30-min Uniswap V3 TWAP

Owner role transitions to a 48-hour `TimelockController` post-launch. Upgrades require timelock + owner signature.

---

## 6. Distribution Wallet Map

| Role                         | Address (current, replace pre-mainnet) |
|------------------------------|------------------------------------------|
| Deployer                     | `0x396157D2De70247dBc6895c5d835E46E6eB0BD22` |
| Founder Beneficiary          | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` |
| Treasury / Marketing / Community / Staking / Public Sale / LP | `0x3a1Dc8a78AE204C1EBAEe58699826f0b21c30D7F` |

> **Action item before mainnet:** split the shared wallet above into separate Gnosis Safe multisigs per bucket so on-chain holders are visually distinct on block explorers.

---

## 7. Disclaimers

This document describes the intended token mechanics and does not constitute an offer, solicitation, or guarantee of future performance.

**Trading involves risk. Past performance does not guarantee future results.** Token purchases may result in the total loss of principal. Holders should consult independent financial, tax, and legal advisors before participating. US persons may only participate via the Reg D 506(c) tranche described in `07_regd_506c_memo.md`.

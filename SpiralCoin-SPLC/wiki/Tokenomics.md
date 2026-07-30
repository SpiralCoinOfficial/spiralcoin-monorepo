# Tokenomics

> ⚠️ **The SPLC token is not deployed.** Everything on this page describes
> the **planned** design and is subject to change. No SPLC tokens are for sale.
> No sponsorship, donation, or whitepaper download confers any right to receive
> tokens.

## Token

| Attribute | Planned value |
|---|---|
| Symbol | SPLC |
| Name | SpiralCoin |
| Standard | ERC-20 |
| Network | Arbitrum One (chain ID 42161) |
| Decimals | 18 |
| Initial supply | 1,000,000,000 SPLC |
| Mint authority | None (fixed supply at deploy) |
| Pause authority | None |
| Upgradeability | None (immutable contract) |

## Initial allocation (planned)

| Bucket | % | SPLC | Notes |
|---|---|---|---|
| LP seed (SPLC/USDC) | 40% | 400,000,000 | Paired with $20K USDC, LP tokens locked |
| Founder | 20% | 200,000,000 | Locked in `LpAndLock.json` lock contract |
| Treasury | 20% | 200,000,000 | Multisig — audit, dev, infra |
| Founding sponsors | 10% | 100,000,000 | Distributed pro-rata at LP launch as recognition (non-transferable for 6 months) |
| Community / future programs | 10% | 100,000,000 | Reserved |

These percentages are illustrative and will be finalized in the published
whitepaper before any deployment.

## Liquidity bootstrap

| Step | Detail |
|---|---|
| Venue | A major Arbitrum AMM (Uniswap V3 or Camelot — TBD) |
| Pair | SPLC / USDC |
| Initial liquidity | $20,000 USDC + 400,000,000 SPLC |
| LP tokens | Sent to `LpAndLock` contract for time-lock |
| Lock duration | 4 years, linear unlock |
| Lock contract | [contracts/LpAndLock.sol](../contracts/LpAndLock.sol) |

## Contracts (pending audit + deploy)

| Contract | Purpose | Address |
|---|---|---|
| `SPLC` (ERC-20) | Token | Not deployed |
| `LpAndLock` | Hold LP tokens, time-locked release | Not deployed |
| Future: `Staking` | Stake SPLC for fee discounts | Not designed |
| Future: `Governance` | On-chain proposals | Not designed |

Deployment manifest (when live) is written to
[contracts/deployments/arbitrum/LpAndLock.json](../contracts/deployments/arbitrum/).

## Audit

A third-party smart-contract audit is a **prerequisite** to deploy. Funded by
the $120,000 founding-sponsor round. Auditor TBD.

## Why no presale / ICO?

- Avoids US securities-law ambiguity around solicited token sales
- Avoids the regulatory overhang of a SAFT / SAFE-T structure
- LP-bootstrap model: anyone can acquire SPLC by swapping USDC against the LP
  *after* deployment, with full on-chain price discovery

## Fees, yield, staking

**None at launch.** Initial release ships token + LP + lock only. Any
fee-switch, staking program, or governance proposal will be:

1. Designed publicly in `contracts/`
2. Discussed in a GitHub issue with sponsor input
3. Audited
4. Deployed via timelock with at least 14 days' notice

## What sponsors actually receive

See [Sponsors](Sponsors.md). Recap:

- Permanent recognition on `splc.html`
- Top-row placement on the homepage
- Direct engineering access during build phase
- Weekly on-chain TVL/volume/fees report post-launch
- **(planned)** Founding-sponsor recognition allocation of SPLC at LP launch,
  non-transferable for 6 months — pending legal review of jurisdictional
  treatment of "appreciation" tokens

No revenue share. No equity. No guaranteed liquidity for the recognition
allocation.

---

*This page is informational. It is not an offer, solicitation, or
recommendation to buy, sell, or hold any token. Crypto assets are highly
volatile and you can lose your entire investment.*

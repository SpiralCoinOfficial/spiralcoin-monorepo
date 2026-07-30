# Grant Application: MetaMask Grants DAO

**Submit at:** <https://forum.metamask-grants.org/> → "New Topic" in the **Grant Proposals** category

**Read first:** <https://metamask-grants.org/> (criteria, current funded projects)

**Tier:** Small ($1K – $25K) — perfect fit for our $20K ask.

---

## Title

SpiralCoin — bootstrap USDC liquidity for a fair-launch ERC-20 on Arbitrum (MetaMask-native)

## Project name

SpiralCoin (SPLC)

## Team

Solo founder + open-source contributors. Founder wallet, contract source, and
deployment records are public.

## Grant amount requested

$20,000 USDC (sized to seed the SPLC/USDC pool on Arbitrum)

## Category

Tooling / DeFi Infrastructure

## Problem statement

New fair-launch ERC-20 tokens on Arbitrum cannot list on aggregators
(GeckoTerminal, DEXScreener, CoinGecko) without a seeded AMM pool. Without
aggregator visibility, MetaMask users cannot discover or trade these tokens
inside the wallet. Bootstrapping the first $20K of pool liquidity is the
critical-path blocker.

## Proposed solution

Use the grant to seed a SPLC/USDC pool on Uniswap V3 (Arbitrum, 1% fee tier,
full-range). The LP NFT is immediately transferred to a custody contract that
prevents principal withdrawal for a minimum of 12 months. This makes SPLC
discoverable + tradeable inside MetaMask via the Swaps tab and the token-import
flow.

## Why this benefits MetaMask users specifically

1. **Token discoverability inside MetaMask Portfolio + Swaps** — once the pool
   has volume, SPLC indexes on the aggregators MetaMask sources its swap routes
   from (1inch, ParaSwap, 0x).
2. **A reference template for fair-launch tokens** — the deploy script
   (`scripts/deployLpAndLock.js`) and lock contract (`SPLCLPLock.sol`) are
   open-sourced and reusable by any future fair-launch team.
3. **MetaMask-native UX from day 1** — SPLC inherits ERC-20Permit (EIP-2612)
   so MetaMask users get gasless approvals via the standard `eth_signTypedData_v4`
   flow.

## Budget breakdown

| Item | USDC | Justification |
|------|------|---------------|
| Pool seed (USDC side, paired with 150K SPLC) | 19,000 | Bootstraps tradeable depth |
| Gas + deploy txs | 600 | createPool + initialize + mint + lock-transfer + OFT peer setup |
| Listing data fees | 400 | DEXScreener Enhanced Token Info, GeckoTerminal trust badge metadata |
| **Total** | **20,000** | |

## Deliverables + timeline

| T+ | Milestone | Verifiable via |
|----|-----------|----------------|
| 0 | USDC received in treasury multisig | Arbiscan tx hash |
| 24h | SPLC/USDC pool seeded on Uniswap V3 | Pool contract on Arbiscan |
| 48h | LP NFT transferred to SPLCLPLock (12-mo unlock) | Lock contract on Arbiscan |
| 72h | First swap executed, GeckoTerminal indexing begins | Pool URL on GeckoTerminal |
| 7 days | DEXScreener Enhanced Token Info live | DEXScreener URL |

## On-chain references

- SPLC token (Arbitrum, UUPS proxy): `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C`
- Treasury multisig: `0x3a1Dc8a78AE204C1EBAEe58699826f0b21c30D7F`
- Native USDC on Arbitrum: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- Source: <https://github.com/SpiralCoinOfficial/ionos-migration>
- Whitepaper: <https://www.spiralcoin.net/whitepaper.html>
- Sponsor pack: <https://www.spiralcoin.net/funding/splc-usdc-seed-pool.html?utm_source=metamask_grants&utm_medium=application&utm_campaign=seed_pool_20k>

## Risks + disclosures

SpiralCoin documents 5 explicit risk categories in §11 of the whitepaper:
general market risk, interim centralization (until DAO timelock takeover),
liquidity bootstrap risk, smart-contract risk (SPLC-specific extensions
unaudited; OZ + LayerZero base contracts are audited), and regulatory risk.
All five are stated plainly to grant reviewers and end users.

## Reporting commitment

Weekly on-chain pulled report to MetaMask Grants DAO for the first 12 weeks
post-deploy, covering: pool TVL, daily volume, fees accrued, lock status. All
data verifiable directly via Arbiscan + Uniswap subgraph.

## Contact

- Email: <grants@spiralcoin.net>
- X: <https://x.com/SpiralCoinLLC>
- Forum handle: [FILL IN AFTER FORUM REGISTRATION]

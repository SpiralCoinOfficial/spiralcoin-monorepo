# SpiralCoin (SPLC) — One Pager

**Tagline:** A self-funding DAO-governed ERC20 with a transparent 3.14% on-trade fee that
splits 50/50 between treasury and staker rewards.

## What it is

SpiralCoin (SPLC) is a governance token built on audited OpenZeppelin v5 primitives
(`ERC20`, `ERC20Permit`, `ERC20Votes`) with three pieces of intentionally minimal custom
code:

1. **On-trade fee router** — a 3.14% fee triggered only on transfers to/from registered
   AMM pairs (P2P transfers are fee-free). The fee splits 50/50 to a treasury and a
   staking vault. The rate is `constant`; no party (not even the DAO) can change it.
2. **MasterChef-style staking vault** — single-asset SPLC staking; rewards are funded by
   the fee router (no inflationary emissions).
3. **OpenZeppelin Governor + TimelockController** — 48-hour timelock on every execution.
   Ownership of `SpiralCoin` transfers to the timelock at deploy; deployer admin role is
   renounced in the deploy script.

## Why it matters

Most fee-on-transfer tokens are either rug-prone (mutable fee, owner-controlled
receivers) or extractive (fee accrues only to the team). SPLC's model is:

- **Predictable** — fee rate is immutable.
- **Aligned** — half of every trade subsidises the people securing the network through
  staking; the other half is treasury, controlled by a 48 h-delayed DAO vote.
- **Composable** — no rebasing, no proxy upgrades, no admin keys after deploy.

## Status (as of 2026-05-20)

| Milestone | Status |
| --- | --- |
| Solidity 0.8.24 + OZ 5.6.1 sources | ✅ Complete, hashed in `AUDIT.md` §8 |
| Internal security audit | ✅ Complete — 0 critical / 0 high / 0 medium |
| Test suite | ✅ 26 / 26 passing (hardhat + chai-matchers) |
| Ethereum Sepolia deploy | ✅ All 4 contracts verified on Etherscan v2 |
| L2 testnet deploys (Arb / Base / OP / Polygon) | ⏳ Scripts ready; awaiting faucets |
| Public website | ✅ <https://www.spiralcoin.net> |
| Open-source repo | ✅ <https://github.com/SpiralCoinOfficial/ionos-migration> |

## What this funding enables

| Bucket | Use |
| --- | --- |
| Third-party audit | OpenZeppelin / Trail of Bits / Spearbit review before mainnet TVL > $1M |
| Mainnet gas | Deployment + verification across Base / Arbitrum / Optimism / Polygon mainnets |
| Initial AMM liquidity | Seed Uniswap V3 pool on the funder's chain |
| Bug bounty | Immunefi tier-1 program for 6 months post-launch |
| Documentation | Developer docs, integrator examples, DAO operating handbook |

## Verifiable trust signals

- All 4 Sepolia contracts verified on Etherscan v2 (source matches repo).
- AUDIT.md publishes SHA-256 hashes of the exact source files audited.
- Repo is public from day one; commit history is intact.
- No private mainnet pre-mine — the founder allocation (100M of 1B supply) is hardcoded
  in the deploy script and visible on-chain at deploy time.
- Trading involves risk. Past testnet behavior does not guarantee future mainnet
  performance.

## Contacts

| Field | Value |
| --- | --- |
| Legal name | Matthew Ian Dreyer |
| Email | <M.dreyer@spiralcoin.net> |
| Founder wallet (payout address) | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` |
| Deployer | `0x396157D2De70247dBc6895c5d835E46E6eB0BD22` |
| GitHub | <https://github.com/SpiralCoinOfficial> |
| Site | <https://www.spiralcoin.net> |

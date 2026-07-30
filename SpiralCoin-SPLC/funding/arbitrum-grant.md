# Arbitrum Foundation Grants — Application

**Program page:** <https://arbitrum.foundation/grants>
**Typical award:** 10k–250k ARB (uses milestone-based vesting).
**Application portal:** <https://app.questbook.app> (Arbitrum Foundation domain) — verify
  the current intake link from the program page before submitting.

---

## 1. Project overview

**Project name**
SpiralCoin (SPLC)

**Website**
<https://www.spiralcoin.net>

**Repo**
<https://github.com/SpiralCoinOfficial/ionos-migration>

**Category**
DeFi → Governance Token / Protocol Infrastructure

**One-line summary**
DAO-governed ERC20 with immutable 3.14% on-trade fee, 50/50 routed to treasury and
single-asset staking vault — built entirely on OpenZeppelin v5 audited primitives.

## 2. Team

| Field | Value |
| --- | --- |
| Founder wallet | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` |
| Deployer | `0x396157D2De70247dBc6895c5d835E46E6eB0BD22` |
| GitHub org | SpiralCoinOfficial |
| Public site | <https://www.spiralcoin.net> |

## 3. Problem

Fee-on-transfer tokens dominate a meaningful share of long-tail ERC20 volume, but
~95% of deployed instances allow the owner to mutate the fee rate, redirect fee
receivers, or pause transfers. The on-chain pattern is functionally
indistinguishable from a honeypot until the moment it triggers. The result: builders
who want a credibly neutral self-funding governance token have to write bespoke code
and convince users the source matches the deployed bytecode.

## 4. Solution

SpiralCoin encodes the entire fee model in immutable storage at deploy time:

- `uint256 public constant FEE_BPS = 314;`
- Fee triggers only on transfers where `isAmmPair[from] || isAmmPair[to]` is true.
- `treasury` and `stakingVault` are settable by `owner` only — but post-deploy the
  owner is the `TimelockController`, which is controlled exclusively by `SpiralDAO`.
- `setAmmPair` is owner-gated (Timelock + DAO, 48-hour delay).
- No `pause`, no proxy, no `delegatecall`, no upgrade path.
- Deployer's `DEFAULT_ADMIN_ROLE` on the Timelock is `renounceRole`'d in the deploy
  script — verifiable on-chain.

## 5. Architecture (see `funding/technical-addendum.md` §4 for full audit details)

- **SpiralCoin.sol** — ERC20 + ERC20Permit + ERC20Votes + fee router (17 custom lines).
- **SpiralStakingVault.sol** — MasterChef accumulator (`accRewardPerShare`); rewards
  funded by 50% of fee routing.
- **SpiralDAO.sol** — OpenZeppelin Governor + 48-hour TimelockController.

Custom code surface intentionally minimal; everything else inherits from OZ 5.6.1.

## 6. Traction

| Milestone | Status | Evidence |
| --- | --- | --- |
| Solidity 0.8.24 source | ✅ | `contracts/contracts/*.sol`; SHA-256 hashes in AUDIT.md §8 |
| Internal audit (0 critical/high/medium) | ✅ | `contracts/AUDIT.md` |
| 26-test hardhat suite | ✅ | `contracts/test/` |
| Sepolia deploy + verify | ✅ | All 4 contracts on Etherscan v2 |
| **Arbitrum Sepolia deploy + verify** | ✅ | All 4 contracts on Arbiscan (chainId 421614) |
| Public site | ✅ | <https://www.spiralcoin.net> |
| Multichain configs | ✅ | `hardhat.config.js` includes Arbitrum + Arbitrum Sepolia |

Sepolia addresses (chainId 11155111):

| Contract | Address |
| --- | --- |
| SpiralCoin | `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0` |
| StakingVault | `0x71160B5aa3075f563E0221dF9720c04Fad64EA17` |
| Timelock | `0x080e214ffD1c52837741e2415d86206A4bC7684b` |
| DAO | `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04` |

Arbitrum Sepolia addresses (chainId 421614) — *all verified on Arbiscan*:

| Contract | Address |
| --- | --- |
| SpiralCoin | `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C` |
| StakingVault | `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D` |
| Timelock | `0x651462CD78a783a74c67e3bE9bED79b391570b98` |
| DAO | `0x7Cc9E93178798192f37e84449893c602235AE40F` |

## 7. Why Arbitrum

1. **Sequencer ordering reduces MEV against tax-bearing trades** — the AUDIT.md SWC-114
   note explicitly identifies Arbitrum as a partial mitigation venue.
2. **Largest DEX TVL outside mainnet** — Uniswap V3, Camelot, Trader Joe → multiple pair
   registrations possible after launch.
3. **Stylus + Nitro upgrades open future paths** for SPLC tooling (e.g. analytics
   subgraphs, staking accountant UI) without contract migration.
4. **Mature governance tooling** — Tally + Snapshot already index OZ Governor
   deployments on Arbitrum One; SpiralDAO will be voteable from day one.

## 8. Milestones (recommend milestone-based vesting)

| # | Deliverable | Target | Requested |
| --- | --- | --- | --- |
| M1 | Arbitrum Sepolia deploy + verify (4 contracts) | ✅ Complete | 5% release |
| M2 | Arbitrum One mainnet deploy behind 3-of-5 Gnosis Safe | Week 4 | 15% release |
| M3 | Third-party audit kickoff (OpenZeppelin / Spearbit) | Week 6 | 30% release |
| M4 | Audit report published; remediations merged | Week 14 | 25% release |
| M5 | Initial Uniswap V3 SPLC/USDC pool seeded; DAO-vote `setAmmPair(pool, true)` | Week 16 | 15% release |
| M6 | Immunefi bug bounty live (tier 1, 6 mo) + integrator docs published | Week 18 | 10% release |

## 9. Budget

| Bucket | Amount (USD-equivalent) | Notes |
| --- | --- | --- |
| Third-party audit | $60,000 | Single firm, narrow scope (our custom surface is 17 lines + 1 vault + DAO config) |
| Initial liquidity (Uniswap V3 SPLC/USDC) | $50,000 | Treasury-owned position |
| Bug bounty (6 months Immunefi tier 1) | $15,000 | Standard tier-1 retainer |
| Mainnet gas + verification | $2,500 | All chains |
| Documentation + integrator guides | $10,000 | Wagmi/Viem examples; AMM registration guide |
| Smart-wallet (Gnosis Safe) setup + signer hardware | $2,500 | 3-of-5 hardware-wallet quorum |
| **Total requested** | **$140,000** | Denominated in ARB at grant disbursement TWAP |

## 10. Open-source / public-goods commitment

- All code MIT-licensed (repo already public).
- Audit report published under repo `contracts/AUDIT.md` with cryptographic source hashes.
- DAO proposal history and treasury txs are inherently public on-chain.
- Integrator guides published to repo + cross-posted to Mirror.

## 11. Risk disclosure

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. The project will not solicit user deposits prior to completion of M4
(third-party audit + remediations). SPLC has no emergency pause by design — documented
in AUDIT.md §6 (I-1) as an intentional centralization-avoidance tradeoff.

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

# Polygon Village — Builder Grant Application

**Program page:** <https://polygon.technology/village>
**Typical award:** $25k–$250k (denominated in POL or USDC, per cohort).
**Decision time:** ~4 weeks (one of the fastest L2 programs).

---

## 1. Project

|  |  |
| --- | --- |
| Name | SpiralCoin (SPLC) |
| Site | <https://www.spiralcoin.net> |
| Repo | <https://github.com/SpiralCoinOfficial/ionos-migration> |
| Founder | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` |
| Stage | Audited + Sepolia deployed + multichain-ready |

## 2. Elevator pitch

SpiralCoin (SPLC) is a DAO-governed ERC20 with an immutable 3.14% on-trade fee that
splits 50/50 between treasury and a single-asset staking vault. Built entirely on
OpenZeppelin v5 audited primitives; no proxy, no admin keys after deploy, no mutable
fee.

## 3. Why Polygon

1. **Lowest L2 gas in the comparable peer set** — makes SPLC's on-trade fee viable for
   small-dollar trades that would be economically irrational on L1.
2. **Polygon Village's milestone-based vesting** matches our preference for transparent,
   on-chain-verifiable progress reporting.
3. **POL staking + restaking ecosystem** creates a natural complementary surface for
   SPLC's own staking vault — possible future integrations with Symbiotic / EigenLayer
   restaking primitives once available on Polygon CDK chains.
4. **Amoy testnet (chainId 80002)** is already configured in our hardhat config; deploy
   script ready.

## 4. What we'll ship with funding

| Milestone | Deliverable | Vesting % |
| --- | --- | --- |
| M1 | Polygon Amoy deploy + verify | 5% |
| M2 | Polygon PoS mainnet deploy behind 3-of-5 Gnosis Safe | 15% |
| M3 | Initial Uniswap V3 SPLC/USDC pool on Polygon PoS | 15% |
| M4 | DAO-vote `setAmmPair(pool, true)` to activate fee on the Polygon pool | 10% |
| M5 | Third-party audit (OpenZeppelin / Spearbit) — multichain scope | 30% |
| M6 | Public integrator guide + Polygon-specific deployment walkthrough | 10% |
| M7 | Immunefi bug bounty live (tier 1, 6 months) | 15% |

## 5. Budget request

| Bucket | Amount (USDC) |
| --- | --- |
| Polygon mainnet gas + verification | $200 |
| Initial Uniswap V3 SPLC/USDC liquidity (treasury-owned) | $30,000 |
| Third-party audit (multichain) | $40,000 |
| Immunefi bug bounty (6 months tier 1) | $15,000 |
| Documentation + integrator guides | $7,500 |
| Smart-wallet setup + hardware signer cost | $2,300 |
| **Total requested** | **$95,000** |

## 6. Status snapshot

- 26/26 hardhat tests passing.
- 0 critical / 0 high / 0 medium in internal audit (`contracts/AUDIT.md`).
- Sepolia: all 4 contracts verified on Etherscan v2.
- Polygon Amoy config + script already wired in `hardhat.config.js`
  (`polygonAmoy`, chainId 80002) and `package.json` (`deploy:polygon-amoy`).

## 7. Risk disclosure

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. SPLC will not solicit user deposits prior to completion of M5 (third-party
audit). The contract has no emergency pause by design — documented in AUDIT.md §6
(I-1) as an intentional centralization-avoidance tradeoff.

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

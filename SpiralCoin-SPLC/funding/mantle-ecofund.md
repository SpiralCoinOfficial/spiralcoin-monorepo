# Mantle EcoFund — Application

**Program page:** <https://www.mantle.xyz/ecofund>
**Form / portal:** <https://www.mantle.xyz/grants> (verify current intake before submitting)
**Typical award:** $10k–$200k (USDT / MNT), milestone-vested.
**Decision time:** ~4–6 weeks.

> **Verify before submitting:** Mantle has multiple funding tracks (EcoFund, Builder
> Grants, Methamorphosis hackathon prizes). Confirm the live program name + URL on
> mantle.xyz before pasting these answers — Mantle rebrands tracks periodically.

---

## 1. Project

| Field | Value |
| --- | --- |
| Name | SpiralCoin (SPLC) |
| Site | <https://www.spiralcoin.net> |
| Repo | <https://github.com/SpiralCoinOfficial/ionos-migration> |
| Category | DeFi → Governance / Tokenization |
| Stage | Audited (internal) → Sepolia + Arb Sepolia verified → Multichain mainnet-ready |

## 2. Pitch (≤ 280 chars)

SpiralCoin: DAO-governed ERC20 with an immutable 3.14% on-trade fee that splits 50/50
between treasury and a single-asset staking vault. Built on OpenZeppelin v5. No proxy,
no admin keys after deploy, no mutable fee. Audited; multichain-ready for Mantle.

## 3. Why Mantle

1. **Modular L2 architecture** — Mantle's separation of execution + data availability
   (EigenDA) is a natural fit for tax-bearing tokens: predictable gas + sequencer
   ordering reduces MEV against SPLC's on-trade fee (AUDIT.md §3 SWC-114).
2. **MNT token + native restaking thesis** — SPLC's single-asset staking vault is
   architecturally similar to mETH's accrual model; future composability is realistic.
3. **EcoFund mandate alignment** — Mantle EcoFund explicitly funds DeFi primitives that
   bring native users and TVL. SPLC is a self-funding governance token (no inflationary
   emissions); its treasury accrual is verifiable on-chain and grows mechanically with
   trading volume, not with subsidy.
4. **Underserved category** — most fee-on-transfer tokens on Mantle today are
   meme-tier with mutable fee functions. An audited, immutable, DAO-governed reference
   implementation fills a clear gap.

## 4. Deliverables

| # | Milestone | Target | Vesting % |
| --- | --- | --- | --- |
| M1 | Mantle Sepolia deploy + verify (4 contracts) | Week 1 | 5% |
| M2 | Mantle mainnet deploy behind 3-of-5 Gnosis Safe | Week 3 | 15% |
| M3 | Initial Agni / FusionX SPLC/USDC pool seeded; DAO-vote `setAmmPair(pool, true)` | Week 4 | 15% |
| M4 | Public integrator guide — "Add a Mantle AMM pair to SPLC via DAO proposal" | Week 6 | 10% |
| M5 | Third-party audit (multichain scope, includes Mantle deployment) | Week 12 | 30% |
| M6 | Immunefi bug bounty (tier 1, 6 months) | Week 14 | 15% |
| M7 | Mantle-native analytics dashboard (SPLC staking APY, fee accrual, DAO proposal history) | Week 16 | 10% |

## 5. Budget request

| Bucket | Amount (USD-equivalent) |
| --- | --- |
| Mantle mainnet gas + verification | $200 |
| Initial Agni / FusionX SPLC/USDC liquidity (treasury-owned) | $40,000 |
| Third-party audit (multichain, Mantle-inclusive) | $50,000 |
| Immunefi bug bounty (6 months tier 1) | $15,000 |
| Mantle-native analytics dashboard | $10,000 |
| Documentation + integrator guides | $7,500 |
| Smart-wallet setup + hardware signer cost | $2,300 |
| **Total requested** | **$125,000** |

## 6. Status snapshot

- 26/26 hardhat tests passing.
- 0 critical / 0 high / 0 medium in internal audit (`contracts/AUDIT.md`).
- **Ethereum Sepolia (chainId 11155111)** — all 4 contracts verified on Etherscan v2:
  - SpiralCoin: `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0`
  - StakingVault: `0x71160B5aa3075f563E0221dF9720c04Fad64EA17`
  - Timelock: `0x080e214ffD1c52837741e2415d86206A4bC7684b`
  - DAO: `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04`
- **Arbitrum Sepolia (chainId 421614)** — all 4 contracts verified on Arbiscan:
  - SpiralCoin: `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C`
  - StakingVault: `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D`
  - Timelock: `0x651462CD78a783a74c67e3bE9bED79b391570b98`
  - DAO: `0x7Cc9E93178798192f37e84449893c602235AE40F`
- Mantle config can be added to `hardhat.config.js` in <30 min (the same Alchemy-fallback
  pattern used for all other networks). Mantle uses chainId 5000 (mainnet) and 5003
  (Mantle Sepolia).

## 7. Open-source / public-goods commitment

- All code MIT-licensed.
- Audit report public with SHA-256 source hashes.
- Multichain reference template — any project wanting the same architecture on Mantle
  can fork and redeploy in <1 hour.
- Mantle-native analytics dashboard will be open-sourced and indexable by other
  Mantle protocols.

## 8. Risk disclosure

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. SPLC will not solicit user deposits prior to completion of M5
(third-party audit). The contract has no emergency pause by design — documented in
AUDIT.md §6 (I-1) as an intentional centralization-avoidance tradeoff.

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

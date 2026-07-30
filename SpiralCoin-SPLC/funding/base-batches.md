# Base Batches — Accelerator Application

**Program page:** <https://www.basebatches.xyz>
**Format:** Cohort-based accelerator (applications open in batches; check site for current cohort dates).
**Funding:** Equity-free grant + ecosystem access; check current cohort terms.

---

## Suggested answers

**Project name**
SpiralCoin (SPLC)

**Project URL**
<https://www.spiralcoin.net>

**Code repository**
<https://github.com/SpiralCoinOfficial/ionos-migration>

**Team / founder wallet**
`0xa1766d57a3102763ED89e9a543E960B5243ef2EE`

**Category**
DeFi → Governance / Tokenization

**Stage**
Audited (internal) → Sepolia deployed + verified → Multichain-ready

**Pitch (≤ 280 chars)**
SpiralCoin: DAO-governed ERC20 with an immutable 3.14% on-trade fee. Half funds the
treasury, half funds staker rewards. No mutable fee, no proxy, no admin keys after
deploy. Audited OpenZeppelin v5. Live on Sepolia; ready for Base.

**Problem you're solving**
Fee-on-transfer tokens have a credibility problem: most allow the owner to change the
rate, redirect receivers, or pause transfers — making them functionally indistinguishable
from honeypots at the contract level. Builders who want a transparent self-funding
governance token currently have to roll their own and hope users trust the source.

**Solution**
SPLC encodes the entire fee model in immutable storage:

- `FEE_BPS = 314` is `constant`.
- Fee triggers only on AMM-pair-tagged transfers (registry curated by 48h DAO vote).
- Receivers are governable but only via 48h timelock.
- No `pause`, no proxy, no upgrade path.
- Ownership transferred to TimelockController at deploy; deployer admin role renounced
  programmatically in the deploy script.

### Why Base?

- OP Stack sequencer ordering partially mitigates MEV exposure for tax-bearing trades.
- Coinbase on-ramp + Smart Wallet collapse the user-acquisition funnel for a token with a
  staking-driven yield narrative.
- Base ecosystem prioritizes builder visibility (Builder Rewards, ecosystem page),
  which compounds for projects whose value proposition is verifiable on-chain.

### Traction so far

- 26/26 hardhat tests passing.
- 0 critical / 0 high / 0 medium in internal audit.
- 4 contracts verified on Ethereum Sepolia (Etherscan v2):
  - SpiralCoin: `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0`
  - StakingVault: `0x71160B5aa3075f563E0221dF9720c04Fad64EA17`
  - Timelock: `0x080e214ffD1c52837741e2415d86206A4bC7684b`
  - DAO: `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04`
- 4 contracts verified on Arbitrum Sepolia (Arbiscan / Etherscan v2):
  - SpiralCoin: `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C`
  - StakingVault: `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D`
  - Timelock: `0x651462CD78a783a74c67e3bE9bED79b391570b98`
  - DAO: `0x7Cc9E93178798192f37e84449893c602235AE40F`
- Marketing site live: <https://www.spiralcoin.net>
- Repo public from day one.

### What you'll accomplish during the batch

1. Week 1–2: Deploy + verify SPLC suite on Base mainnet behind a 3-of-5 Gnosis Safe.
2. Week 3–4: Seed Uniswap V3 pool; DAO-vote `setAmmPair(pool, true)`.
3. Week 5–6: Ship single-asset staking dApp (Wagmi + Viem + Tailwind) on subdomain
   stake.spiralcoin.net.
4. Week 7–8: Publish integrator guide for protocols that want to register additional
   Base AMM pairs.
5. Week 9–10: Launch 6-month Immunefi bug bounty (tier 1).
6. Week 11–12: Demo Day — show on-chain volume, staker count, treasury accrual,
   and DAO proposal history.

### What you need from Base

- Mentor matchup on AMM integration + liquidity bootstrapping.
- Intro to a reputable audit firm in the Base ecosystem (Spearbit / OpenZeppelin /
  Trail of Bits).
- Demo Day exposure to ecosystem partners (DEX aggregators, wallets, on-ramps).
- Grant funding to cover audit retainer + initial Uniswap V3 liquidity + bug bounty.

**Risk and limitations**
Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. SPLC has no pause function by design — this is documented in AUDIT.md §6
(I-1) as an intentional centralization-avoidance tradeoff. The project recommends a
third-party audit before mainnet TVL exceeds $1M and will not solicit deposits before
that audit completes.

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

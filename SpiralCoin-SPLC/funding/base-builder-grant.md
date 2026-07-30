# Base Builder Grants — Nomination Form

**Submit at:** <https://docs.google.com/forms/d/e/1FAIpQLSfXuEzmiAzRhie_z9raFCF1BXweXgVt18o-DvBuRRgyTygL2A/viewform>
**Program page:** <https://paragraph.com/@grants.base.eth/calling-based-builders>
**Also worth applying to in parallel:**

- Base Batches accelerator → `base-batches.md`
- Builder Rewards (Talent Protocol) → <https://www.builderscore.xyz> (passive — based on shipped activity, no application)

The Base Builder Grants nomination form is short. Paste these answers into the
matching fields. Adjust wording to match the live form labels — Base updates the form
periodically.

---

## Suggested answers

**Builder name / handle**
SpiralCoinOfficial

**Wallet / smart-wallet address (Base preferred)**
`0xa1766d57a3102763ED89e9a543E960B5243ef2EE`

**Project name**
SpiralCoin (SPLC)

**Project link**
<https://www.spiralcoin.net>

**Repo link**
<https://github.com/SpiralCoinOfficial/ionos-migration>

**One-sentence description**
A DAO-governed ERC20 with an immutable 3.14% on-trade fee that splits 50/50 between
treasury and a single-asset staking vault — built entirely on audited OpenZeppelin v5
primitives.

**What have you shipped?**

- Full token + staking + DAO contract suite (Solidity 0.8.24, OpenZeppelin 5.6.1).
- 26-test hardhat suite covering premine, AMM tax math, fee split, exemptions, staking
  lifecycle, ERC20Votes checkpoints, ERC20Permit, and DAO quorum.
- Internal security audit (0 critical / 0 high / 0 medium; AUDIT.md in repo).
- Live verified deploy on Ethereum Sepolia — all 4 contracts on Etherscan v2.
- Multichain deploy scripts configured for Base, Base Sepolia, Arbitrum, Arb Sepolia,
  Optimism, OP Sepolia, Polygon, Polygon Amoy.
- Public marketing site at spiralcoin.net.

**What are you building next (on Base specifically)?**

1. Deploy the verified contract suite to Base Sepolia (this week — pending faucet).
2. Deploy to Base mainnet behind a 3-of-5 Gnosis Safe deployer.
3. Seed initial liquidity in a Uniswap V3 pool on Base.
4. DAO-vote `setAmmPair(pool, true)` so the 3.14% on-trade fee activates only for that
   pool — establishing Base as SPLC's home AMM venue.
5. Publish a developer integration guide for protocols that want to register additional
   Base AMM pairs via the DAO.

**Why Base?**

- Coinbase on-ramp + Smart Wallet make onboarding fee-on-trade tokens dramatically
  smoother than competing L2s.
- OP Stack sequencer ordering reduces MEV exposure for our tax mechanism (mitigation
  documented in AUDIT.md §3, SWC-114).
- Active builder ecosystem and clear ecosystem-page inclusion path.

**Are you bringing more users onchain?**
Yes. SPLC's staking vault is single-asset (no LP token required), which lowers the
onboarding bar for non-DeFi-native users: a holder only needs to acquire SPLC and click
stake. The 50% fee allocation to the vault funds rewards without requiring inflationary
emissions.

**Is your contribution live and making an impact?**
Live and verifiable on **two networks** today:

Ethereum Sepolia (chainId 11155111):

- SpiralCoin: `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0`
- StakingVault: `0x71160B5aa3075f563E0221dF9720c04Fad64EA17`
- Timelock: `0x080e214ffD1c52837741e2415d86206A4bC7684b`
- DAO: `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04`

Arbitrum Sepolia (chainId 421614) — same OP-Stack-adjacent rollup ordering Base uses:

- SpiralCoin: `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C`
- StakingVault: `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D`
- Timelock: `0x651462CD78a783a74c67e3bE9bED79b391570b98`
- DAO: `0x7Cc9E93178798192f37e84449893c602235AE40F`

Site: <https://www.spiralcoin.net>

**How would a grant be used?**

1. Base mainnet gas + contract verification.
2. Seed liquidity for Uniswap V3 SPLC/USDC or SPLC/ETH pool on Base.
3. Third-party audit retainer (OpenZeppelin / Spearbit) before any mainnet TVL accrues.
4. 6-month Immunefi bug bounty (tier 1).

**Anything else?**
Contracts are immutable (no proxy, no upgrade path) and the fee rate is `constant` —
neither the DAO nor any owner can change the 3.14% rate. Only fee *receivers* and AMM
*pair list* are governable, and both require a 48-hour timelocked DAO vote.

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance.

---

## Supplemental links to attach

- Audit: <https://github.com/SpiralCoinOfficial/ionos-migration/blob/main/contracts/AUDIT.md>
- Token source: <https://github.com/SpiralCoinOfficial/ionos-migration/blob/main/contracts/contracts/SpiralCoin.sol>
- Deploy script: <https://github.com/SpiralCoinOfficial/ionos-migration/blob/main/contracts/scripts/deploy-multichain.js>
- Sepolia manifest: <https://github.com/SpiralCoinOfficial/ionos-migration/blob/main/contracts/deployments/sepolia.json>

# Conduit RaaS Credits — Application

**Program page:** <https://www.conduit.xyz>
**Application path:** Conduit Dashboard → "Apply for Credits" or contact
  <hello@conduit.xyz> (verify the current intake on conduit.xyz before submitting).
**Typical award:** $500–$5,000 in rollup sequencing + DA credits; sometimes higher for
  projects committing to a public mainnet rollup launch with traction.

> **Important:** Conduit credits are *infrastructure* credits (sequencer fees, DA
> posting, RPC bandwidth) — not cash. They cover the operating cost of running an
> OP-Stack or Arbitrum-Orbit rollup.

---

## 1. Project

| Field | Value |
| --- | --- |
| Name | SpiralCoin (SPLC) |
| Site | <https://www.spiralcoin.net> |
| Repo | <https://github.com/SpiralCoinOfficial/ionos-migration> |
| Stage | Audited + 2-chain testnet verified + 6-chain mainnet-ready |

## 2. What we want to build on Conduit

A dedicated SpiralCoin L2 (codename: **SpiralChain**) — an OP-Stack rollup whose
defining feature is **native protocol-level fee routing to the SPLC treasury and
staking vault.** Specifically:

- All sequencer revenue earned by the rollup is routed to the same `treasury` +
  `stakingVault` addresses that receive SPLC's on-trade 3.14% fee, using the same
  50/50 split.
- The rollup's gas token can be SPLC itself (custom gas token feature) once
  liquidity and price stability allow — initially ETH as gas, transitioning to SPLC
  via DAO vote.
- The rollup becomes the canonical home for SpiralDAO governance: any holder bridging
  SPLC into SpiralChain gets the same ERC20Votes power without re-delegation, via a
  bridged-balance attestation contract.

## 3. Why Conduit specifically

1. **OP-Stack production-grade hosting** — Conduit runs Base's infra; battle-tested
   sequencer + DA pipeline.
2. **Custom gas token support** — Conduit is one of the few RaaS providers that
   supports OP-Stack custom gas token configs at deploy time, which is required for
   our long-term SPLC-as-gas roadmap.
3. **Bridge + explorer included** — reduces our integration burden vs. self-hosting.
4. **Superchain interop trajectory** — Conduit rollups can join the OP Superchain once
   interop fully ships; future SPLC bridging to Base / OP / Mode / World becomes
   native rather than relying on third-party bridges.

## 4. Operating budget request

| Bucket | Quantity | Notes |
| --- | --- | --- |
| Sequencer fees (first 3 months) | ~$1,500 in credits | Low-volume launch period |
| DA posting (Ethereum calldata or EigenDA) | ~$1,500 in credits | Depending on DA layer chosen |
| Explorer + RPC bandwidth | ~$500 in credits | Standard Conduit-hosted tier |
| Bridge + faucet infra | ~$500 in credits | For testnet phase |
| **Total credits requested** | **~$4,000** | Covers ~3 months runway |

After 3 months, sequencer + DA costs will be self-funded from on-chain protocol revenue
(the rollup's own sequencer fees + a portion of SPLC trading fees on Conduit-hosted DEXs).

## 5. Traction we bring

- Verified contract suite on **Ethereum Sepolia + Arbitrum Sepolia** (deployable to
  SpiralChain in <1 hour using the same `deploy-multichain.js` script).
- 26-test hardhat suite, 0 critical / 0 high / 0 medium internal audit.
- Pre-existing multichain plan: SPLC launching simultaneously on 6 EVM chains
  (Ethereum, Arbitrum, Base, Optimism, Polygon, BNB), with SpiralChain as the canonical
  governance + treasury L2.

## 6. Live deployments (verifiable)

**Ethereum Sepolia (chainId 11155111):**

- SpiralCoin: `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0`
- StakingVault: `0x71160B5aa3075f563E0221dF9720c04Fad64EA17`
- Timelock: `0x080e214ffD1c52837741e2415d86206A4bC7684b`
- DAO: `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04`

**Arbitrum Sepolia (chainId 421614):**

- SpiralCoin: `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C`
- StakingVault: `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D`
- Timelock: `0x651462CD78a783a74c67e3bE9bED79b391570b98`
- DAO: `0x7Cc9E93178798192f37e84449893c602235AE40F`

## 7. Roadmap

| Phase | Deliverable |
| --- | --- |
| Phase 0 (immediate) | Conduit testnet rollup spin-up; deploy SPLC suite to it |
| Phase 1 (~Month 1) | Public testnet faucet + explorer; community testing |
| Phase 2 (~Month 2) | Mainnet rollup launch with ETH as gas; bridge SPLC from Ethereum mainnet |
| Phase 3 (~Month 4) | DAO vote on custom-gas-token migration (SPLC-as-gas) |
| Phase 4 (~Month 6) | Native SpiralChain DEX with protocol-fee routing live |

## 8. Risk disclosure

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. SpiralChain launch dates are targets, not commitments — gated on Conduit
credit approval, third-party audit completion, and sufficient mainnet SPLC liquidity
to justify a dedicated L2.

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

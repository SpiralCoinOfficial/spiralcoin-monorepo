# SpiralCoin (SPLC) — Funding Application Package

This folder contains ready-to-submit grant / funding applications for the SpiralCoin protocol.
Each file is structured to match a specific program's submission form so you can copy
fields directly into the public application portal.

## Project snapshot

| Field | Value |
| --- | --- |
| Project | SpiralCoin (SPLC) |
| Type | ERC20 + ERC20Votes governance token with on-trade fee router + staking vault + DAO |
| Repo | <https://github.com/SpiralCoinOfficial/ionos-migration> |
| Website | <https://www.spiralcoin.net> |
| Deployer | `0x396157D2De70247dBc6895c5d835E46E6eB0BD22` |
| Founder wallet | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` |
| Stage | Audited (internal) + deployed + verified on Ethereum Sepolia |
| Test coverage | 26/26 hardhat tests passing |
| Audit | `contracts/AUDIT.md` — 0 critical / 0 high / 0 medium / 2 low (accepted) |
| Live testnet contracts | See `contracts/deployments/sepolia.json` |

## Live verified deployments

**Ethereum Sepolia (chainId 11155111)** — verified on Etherscan v2:

| Contract | Address |
| --- | --- |
| SpiralCoin (SPLC) | `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0` |
| SpiralStakingVault | `0x71160B5aa3075f563E0221dF9720c04Fad64EA17` |
| TimelockController (48h) | `0x080e214ffD1c52837741e2415d86206A4bC7684b` |
| SpiralDAO (Governor) | `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04` |

**Arbitrum Sepolia (chainId 421614)** — verified on Arbiscan (Etherscan v2):

| Contract | Address |
| --- | --- |
| SpiralCoin (SPLC) | `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C` |
| SpiralStakingVault | `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D` |
| TimelockController (48h) | `0x651462CD78a783a74c67e3bE9bED79b391570b98` |
| SpiralDAO (Governor) | `0x7Cc9E93178798192f37e84449893c602235AE40F` |

## Files in this folder

| File | Use for |
| --- | --- |
| `one-pager.md` | Universal pitch — paste into any program that asks for a project summary |
| `technical-addendum.md` | Engineering details — attach to any program that asks for architecture or audit info |
| `base-builder-grant.md` | Base Builder Grants nomination form (Google Form) |
| `base-batches.md` | Base Batches accelerator application |
| `arbitrum-grant.md` | Arbitrum Foundation Grants application |
| `optimism-mission.md` | Optimism Grants / RetroPGF round application |
| `polygon-village.md` | Polygon Village builder grant |
| `gitcoin.md` | Gitcoin Grants quadratic funding round entry |
| `mantle-ecofund.md` | Mantle EcoFund application ($10k–$200k) |
| `conduit-raas.md` | Conduit RaaS infrastructure-credits request (~$4k in credits) |
| `SUBMISSION_TRACKER.md` | **Master tracker** — status of all 7 submissions + scam red-flag checklist |

## Submission checklist (do these in order)

1. **Faucet the deployer on L2 testnets** so the program reviewers can see live multichain
   deploys (proof of execution capability). Free faucets, no funding required.
   - Arbitrum Sepolia: <https://www.alchemy.com/faucets/arbitrum-sepolia>
   - Base Sepolia: <https://www.alchemy.com/faucets/base-sepolia>
   - OP Sepolia: <https://www.alchemy.com/faucets/optimism-sepolia>
   - Polygon Amoy: <https://faucet.polygon.technology>
   Paste deployer `0x396157D2De70247dBc6895c5d835E46E6eB0BD22` into each.
2. **Run `npm run deploy:<chain>`** for each funded chain (see `contracts/package.json`).
3. **Confirm verification** on the chain's explorer (Etherscan v2 unified handles all four).
4. **Submit applications** in this priority order (best fit first) — see
   [SUBMISSION_TRACKER.md](SUBMISSION_TRACKER.md) for the live status table and the
   pre-submission checklist for each program:
   1. **Base Builder Grants** — smallest form, fastest turnaround, retroactive
   2. **Base Batches** — accelerator cohort + up to $25k
   3. **Arbitrum Foundation Grants** — largest typical award for governance projects
   4. **Conduit RaaS Credits** — infrastructure credits, fast turnaround, unblocks SpiralChain L2
   5. **Mantle EcoFund** — medium cycle, fits the cross-chain thesis
   6. **Optimism Mission / RetroPGF** — submit after mainnet shows traction
   7. **Polygon Village** + **Gitcoin** — supplemental, submit when rounds open

5. **Read the red-flag list** in `SUBMISSION_TRACKER.md` §4 before responding to *any*
   email, DM, or portal request claiming to be from a grant program. No legitimate
   program ever charges fees, asks for seed phrases, or requires you to sign a
   wallet-connect transaction to "claim" a grant.

## Compliance notes

All copy in this folder follows the SpiralCoin compliance guardrails:

- No "guaranteed returns," "risk-free," or absolute performance claims.
- Trading-related language is framed historically / hypothetically.
- CTAs are "explore," "review," "deploy" — no manufactured urgency.
- Trust signals are verifiable (on-chain addresses, public repo, audit hashes) — no
  invented certifications, regulatory approvals, or user counts.

If a reviewer asks for additional materials, point them at:

- `contracts/AUDIT.md` for security
- `contracts/contracts/*.sol` for source
- `contracts/test/` for the 26-test suite
- `contracts/deployments/sepolia.json` for live verified addresses

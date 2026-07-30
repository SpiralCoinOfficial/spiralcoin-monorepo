# Gitcoin Grants — Quadratic Funding Round Entry

**Program page:** <https://grants.gitcoin.co> (rounds open quarterly).
**Format:** Public crowdfunded matching round — anyone can contribute; Gitcoin matches
quadratically (small donors weighted higher). No single gatekeeper.

---

## 1. Round selection

SpiralCoin fits these typical Gitcoin round categories:

- **Web3 Infrastructure** — open-source governance + fee-router template usable by any
  protocol.
- **Open Source Software** — MIT-licensed contracts + audit + integrator docs.
- **DeFi** — if the active round includes a DeFi category.

Check <https://grants.gitcoin.co> for currently-open rounds before submitting.

## 2. Public-goods framing

The narrative for Gitcoin focuses on **what other builders get** from SPLC, not on
SPLC token economics:

> SpiralCoin publishes an open-source, audited reference implementation of a
> DAO-governed ERC20 with an immutable on-trade fee and a transparent staking
> accumulator. Any project wanting the same architecture can fork the repo, change the
> token name + premine table, and deploy. The accompanying AUDIT.md, 26-test suite,
> and integrator guides reduce the audit + documentation burden for downstream
> protocols by ~80%.

## 3. Project card content

**Title**
SpiralCoin — Open-source DAO-governed ERC20 reference template

**Banner image**
`splc.png` from the repo root (or a fresh export from the site).

**Website**
<https://www.spiralcoin.net>

**GitHub**
<https://github.com/SpiralCoinOfficial/ionos-migration>

**Contact email**
<M.dreyer@spiralcoin.net>

**Description (≤ 500 chars)**
A DAO-governed ERC20 with an immutable 3.14% on-trade fee that splits 50/50 between
treasury and staker rewards. Built on audited OpenZeppelin v5 primitives. The entire
contract suite (token + staking vault + Governor + Timelock) is MIT-licensed and
fork-ready, with a published internal audit (0 critical / 0 high / 0 medium) and a
26-test hardhat suite. Live on Sepolia today; multichain configs ready for Base,
Arbitrum, Optimism, and Polygon.

## 4. Funding goals (transparent line items)

| Bucket | Allocation |
| --- | --- |
| Third-party audit retainer | 50% |
| Open-source documentation + integrator guides | 20% |
| Mainnet deploy gas (4 chains) + verification | 5% |
| Bug bounty (Immunefi tier 1, 6 months) | 15% |
| Domain + hosting + analytics for public docs | 10% |

## 5. Verifiable proof

| Item | Link |
| --- | --- |
| Audit report | <https://github.com/SpiralCoinOfficial/ionos-migration/blob/main/contracts/AUDIT.md> |
| Token source (SHA-256 hashed in audit §8) | <https://github.com/SpiralCoinOfficial/ionos-migration/blob/main/contracts/contracts/SpiralCoin.sol> |
| Test suite (26 passing) | <https://github.com/SpiralCoinOfficial/ionos-migration/tree/main/contracts/test> |
| Sepolia SpiralCoin | <https://sepolia.etherscan.io/address/0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0> |
| Sepolia StakingVault | <https://sepolia.etherscan.io/address/0x71160B5aa3075f563E0221dF9720c04Fad64EA17> |
| Sepolia Timelock | <https://sepolia.etherscan.io/address/0x080e214ffD1c52837741e2415d86206A4bC7684b> |
| Sepolia DAO | <https://sepolia.etherscan.io/address/0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04> |
| SpiralCoin (Arbitrum One) | <https://arbiscan.io/address/0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C> |
| Arb Sepolia StakingVault | <https://arbiscan.io/address/0x4cEC763B2750B09272b70f040EaB6d0E6196A94D> |
| Arb Sepolia Timelock | <https://arbiscan.io/address/0x651462CD78a783a74c67e3bE9bED79b391570b98> |
| Arb Sepolia DAO | <https://arbiscan.io/address/0x7Cc9E93178798192f37e84449893c602235AE40F> |

## 6. Anti-Sybil + compliance

- SpiralCoin will not pay or incentivize Gitcoin Passport stamp acquisition.
- All funds received will be sent to a public treasury address visible in the project's
  Gitcoin page; spending will be reported via DAO proposals or repo-published quarterly
  updates.
- The project will not solicit deposits or promise returns to Gitcoin contributors.
  Donations are public-goods support for open-source work, not investment.

## 7. Risk disclosure

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. SPLC has no emergency pause by design (AUDIT.md §6 I-1). The project will
not deploy to mainnet under user-facing branding until a third-party audit completes.

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

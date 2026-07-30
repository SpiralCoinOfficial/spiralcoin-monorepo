# Optimism Mission Grants / RetroPGF — Application

**Program pages:**

- Mission Grants (upfront): <https://app.optimism.io/grants>
- RetroPGF (retroactive public-goods): <https://atlas.optimism.io>
- Citizens' House governance: <https://gov.optimism.io>

**Typical award:** 10k–50k OP for Mission Grants; RetroPGF varies per round.

---

## 1. Mission alignment

The most relevant Mission categories for SpiralCoin:

- **Tooling / Developer Experience** — open-source governance-token reference
  implementation built on audited primitives.
- **DeFi / Onchain Economy** — credibly neutral fee-on-trade token with on-chain
  treasury accrual.
- **Governance** — OpenZeppelin Governor + 48h Timelock deployment template.

## 2. Project summary

SpiralCoin (SPLC) is a DAO-governed ERC20 whose entire fee model is encoded in
immutable storage. A 3.14% fee triggers only on transfers to/from registered AMM pairs,
splitting 50/50 between the treasury and a single-asset staking vault. The fee rate is
`constant` — no party (including the DAO) can change it. Only fee receivers and the
AMM pair list are governable, both behind a 48-hour timelock.

## 3. Why OP Stack

1. **Sequencer ordering partially mitigates MEV** for tax-bearing trades — documented
   in AUDIT.md §3 (SWC-114).
2. **Superchain-native** — once deployed on OP mainnet, the same bytecode trivially
   redeploys to Base, Mode, Zora, World Chain, and other OP-Stack rollups, multiplying
   SPLC's accessible AMM venues without contract changes.
3. **Governor tooling** — Tally + Agora already index OP-deployed Governor instances;
   SpiralDAO will be voteable through public UIs from day one.
4. **Public-goods alignment** — SPLC's open-source design and RetroPGF eligibility (see
   §6 below) make OP a natural long-term home.

## 4. Deliverables

| # | Deliverable | Target |
| --- | --- | --- |
| D1 | OP Sepolia deploy + verify (4 contracts) | Week 1 |
| D2 | OP mainnet deploy behind 3-of-5 Gnosis Safe | Week 4 |
| D3 | Public reference template repo (`SpiralCoinOfficial/oz-governor-template`) — fork-and-deploy starter for any project wanting an immutable fee-on-trade + DAO + staking stack on OP | Week 8 |
| D4 | Integrator guide: "Register an AMM pair on SPLC via DAO proposal" | Week 10 |
| D5 | Tally + Agora listings live for SpiralDAO on OP mainnet | Week 12 |

## 5. Budget request

| Bucket | OP-equivalent | Notes |
| --- | --- | --- |
| OP mainnet gas + verification | 50 OP | Deploy + verify 4 contracts |
| Reference template repo + docs | 5,000 OP | Fork-and-deploy starter that other OP projects can use |
| Integrator guide + DAO operating handbook | 3,000 OP | Public-goods documentation |
| Initial Uniswap V3 SPLC/USDC liquidity (treasury-owned) | 7,000 OP | Bootstraps AMM venue on OP |
| Third-party audit contribution | 15,000 OP | Toward a broader audit covering all chain deploys |
| **Total** | **~30,000 OP** | Milestone-vested |

## 6. RetroPGF angle (separate from Mission Grants)

Once shipped, SpiralCoin's public-goods contributions for retroactive review:

- **Open-source reference template** — anyone can fork the OZ-Governor + Timelock +
  fee-router + staking-vault stack with one command.
- **Public audit report** with cryptographic source hashes — sets a documentation bar
  for long-tail token projects.
- **DAO operating handbook** — proposal lifecycle templates, voting power delegation
  guides, treasury-management playbooks reusable by any OZ Governor deployment.
- **On-chain primitive composability** — fee-routed treasury accrual is permissionlessly
  observable; other protocols can build analytics, vault wrappers, or insurance products
  against it.

## 7. Status snapshot (2026-05-20)

- 26/26 hardhat tests passing.
- 0 critical / 0 high / 0 medium in internal audit.
- All 4 contracts deployed + verified on Ethereum Sepolia (Etherscan v2).
- OP Sepolia config + deploy script already in `contracts/hardhat.config.js`
  (`optimismSepolia`, chainId 11155420) and `contracts/package.json`
  (`deploy:optimism-sepolia`).

## 8. Risk disclosure

Trading involves risk. Past testnet behavior does not guarantee future mainnet
performance. The project will not solicit user deposits prior to completion of the
third-party audit. SPLC has no emergency pause by design — see AUDIT.md §6 (I-1).

---

## Attach

- `funding/one-pager.md`
- `funding/technical-addendum.md`
- `contracts/AUDIT.md`

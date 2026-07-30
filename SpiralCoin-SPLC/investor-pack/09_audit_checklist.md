# Audit Checklist — Pre-Launch Security

> Trading involves risk. Past performance does not guarantee future results.

No legitimate launchpad will list SPLC without an audit. No serious VC will commit
without an audit. Get one before you do anything else.

---

## Auditor comparison

| Auditor | Cost | Time | Reputation | Best for |
| --- | --- | --- | --- | --- |
| OpenZeppelin | $50,000+ | 4-8 weeks | Tier-1, industry gold standard | Series A+ |
| Trail of Bits | $50,000+ | 4-8 weeks | Tier-1, deep technical | Series A+ |
| ConsenSys Diligence | $40,000+ | 4-8 weeks | Tier-1 | Series A+ |
| CertiK | $5,000-$50,000 | 2-6 weeks | Tier-2, fast, well-known | Seed launches |
| Hacken | $3,000-$30,000 | 2-4 weeks | Tier-2, well-known | Seed launches |
| PeckShield | $8,000-$40,000 | 3-6 weeks | Tier-2, strong China presence | Asia-focused |
| Quantstamp | $20,000-$80,000 | 4-8 weeks | Tier-2 | DeFi protocols |
| SolidProof | $1,500-$8,000 | 1-3 weeks | Tier-3, budget option | Bootstrap |
| Cyberscope | $1,500-$8,000 | 1-2 weeks | Tier-3, fast | Bootstrap |

**Recommendation for SpiralCoin:** Start with **CertiK Skynet ($5-15k)** OR **Hacken ($5-10k)**.
Tier-1 auditors are overkill for a seed-stage token. Add OpenZeppelin or Trail of Bits later
for the staking vault or paymaster contracts.

---

## What gets audited

| Contract | Priority |
| --- | --- |
| `SpiralCoin.sol` (ERC20 + tax + Votes) | Critical |
| `SpiralDAO.sol` (Governor + Timelock) | Critical |
| `SpiralStakingVault.sol` | Critical (holds user funds) |
| `SPLCPaymaster.sol` (when written) | Critical (holds ETH) |
| `SPLC_Presale_Vesting.sol` (when written) | High |
| Deploy + upgrade scripts | Medium (logic-only review) |

## Scope of work (typical)

- Static analysis (Slither, Mythril, Securify auto-scans)
- Manual code review by 2+ senior auditors
- Test coverage analysis
- Gas optimization recommendations
- Centralization risk assessment
- Front-running / MEV exposure analysis
- Re-entrancy and arithmetic safety
- Access control validation
- Upgrade safety (storage layout)
- Final report with severity rankings (Critical / High / Medium / Low / Informational)

## What you do before the audit

- [ ] Freeze contract code — no edits during audit
- [ ] Comprehensive test suite (target 95%+ coverage)
- [ ] Slither clean run (zero high-severity findings)
- [ ] All TODOs and FIXMEs resolved
- [ ] All `require` and `revert` strings present
- [ ] NatSpec documentation on all public/external functions
- [ ] README explaining design intent
- [ ] Deployment scripts working on testnet
- [ ] Integration tests passing on Sepolia/Arb-Sepolia/Base-Sepolia

## What you do after the audit

- [ ] Fix all Critical findings (mandatory)
- [ ] Fix all High findings (mandatory)
- [ ] Fix or formally accept all Medium findings
- [ ] Document why any Low/Informational findings are not addressed
- [ ] Re-audit if Critical/High findings required substantial changes
- [ ] Publish audit report PDF prominently on <www.spiralcoin.net>
- [ ] Display "Audited by [Auditor]" badge on site footer
- [ ] Submit audit to launchpad and VCs

## Bug bounty (recommended after audit)

| Platform | Cost | Reward range |
| --- | --- | --- |
| Immunefi | Free to list, you fund rewards | $1,000 – $1,000,000+ |
| HackerOne | Subscription | $500 – $50,000 |
| Code4rena | Contest-based | $10,000 – $200,000 per contest |
| Sherlock | Contest + coverage | Varies |

Suggested SPLC initial bounty: $25,000-$100,000 max payout via Immunefi.

## Continuous monitoring

- **Forta Network agents** — automated alerts for suspicious activity
- **OpenZeppelin Defender** — admin actions, automated incident response
- **Tenderly Real-time alerts** — pre-confirmation monitoring
- **PeckShield CoBOX** — exploit detection

Set up at minimum Forta + Defender before mainnet deploy.

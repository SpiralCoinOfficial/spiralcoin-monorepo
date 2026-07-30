# SpiralCoin LLC — AML / KYC Program (DRAFT)

> ⚠️ **This is a working draft, NOT a finished compliance program and NOT legal advice.**
> It is intended as a starting point to hand to a fintech attorney for review,
> revision, and formal adoption by SpiralCoin LLC's board / sole member.
>
> Do not represent this document as an adopted AML program to FinCEN, banking
> partners, or counterparties until it has been reviewed by qualified counsel,
> formally adopted in writing, and a designated Compliance Officer is in place.

Status: DRAFT v0.1
Owner: Trisha Dreyer
Date: 2026-05-29
Pending review by: [Fintech attorney TBD]

---

## 1. Purpose & Scope

SpiralCoin LLC ("SpiralCoin", "the Company") operates a trading-platform web
application at <https://www.spiralcoin.net> and a suite of smart contracts on
Arbitrum and other EVM-compatible chains, including a native ERC-20 token
("SPLC"), a presale contract, a staking vault, an ERC-4337 gas paymaster,
and related infrastructure.

This program is designed to comply with the Bank Secrecy Act ("BSA"),
FinCEN regulations applicable to Money Services Businesses ("MSBs")
(31 CFR Chapter X, Part 1022), and FinCEN guidance on convertible virtual
currency (FIN-2013-G001 and FIN-2019-G001).

SpiralCoin LLC is registered (or in the process of registering) as an MSB
on FinCEN Form 107 under the **Money Transmitter** category.

## 2. Compliance Officer

**Designation:** [Compliance Officer Name and Title — to be designated by
written resolution of SpiralCoin LLC.]

**Responsibilities:**

- Day-to-day oversight of this AML program
- Filing Suspicious Activity Reports (SARs) and Currency Transaction Reports (CTRs) as required
- Annual program review and update
- Coordination with KYC vendor and external auditors
- Maintaining all records required under 31 CFR 1022.410
- Single point of contact for FinCEN, IRS, state regulators, and law enforcement subpoenas

The Compliance Officer reports directly to the sole member / managing member
of SpiralCoin LLC and has authority to halt or restrict any user, transaction,
or campaign that presents AML/CFT risk.

## 3. Customer Identification Program (CIP)

### 3.1 Tiered KYC

| Tier | Trigger | Information collected | Verification |
|---|---|---|---|
| Tier 0 (Demo) | Free demo mode, simulated balances only | Email | Email confirmation only |
| Tier 1 (Basic) | Platform subscription, no on-chain custody | Email, name, country, state, DOB | ID + selfie via KYC vendor (Sumsub / Persona / Veriff) |
| Tier 2 (On-chain) | Presale participation, paymaster funding, staking with custody flow | Tier 1 + government-issued ID + proof of address (utility bill ≤90 days) + source-of-funds attestation | Enhanced KYC including liveness check |
| Tier 3 (Accredited) | Reg D 506(c) tranche participation by US persons | Tier 2 + accredited investor verification | Third-party verification (e.g. VerifyInvestor.com) |

### 3.2 Identity verification

- Conducted by a qualified third-party vendor (Sumsub, Persona, or Veriff)
- Document types accepted: passport, government-issued photo ID, residence permit
- Verification results retained for **5 years** after account closure
- Failed verifications retained for **5 years** with reason codes

### 3.3 Sanctions screening

- Every new user screened against:
  - OFAC SDN list
  - OFAC Sectoral Sanctions Identifications (SSI) list
  - EU Consolidated List
  - UN 1267 sanctions list
- Existing users re-screened on any list update (daily delta check)
- True matches: account frozen, SAR considered, OFAC notification within required timeframe

### 3.4 Geofence

- Hard-blocked jurisdictions: see `funding/geofence-list.json` → `always_blocked`
- US-state granularity: see `funding/geofence-list.json` → `us_states`
- Client-side enforcement: `assets/geo-block.js` (hard US block until MTL)
- Server-side enforcement: planned via IP geo + KYC address cross-check
- Periodic review: monthly against latest OFAC SDN updates

## 4. Customer Due Diligence (CDD) & Enhanced Due Diligence (EDD)

### 4.1 Standard CDD

For every Tier 1+ customer:

- Identity established and verified per §3
- Beneficial ownership collected for entity customers (25% ownership threshold per FinCEN CDD Rule)
- Risk-based profile assigned (Low / Medium / High)
- Expected activity pattern documented

### 4.2 Enhanced Due Diligence triggers

EDD is required when:

- Customer is a Politically Exposed Person (PEP) or close associate
- Customer is from a high-risk jurisdiction (FATF grey/black list)
- Cumulative deposits/withdrawals exceed $10,000 in a rolling 30 days
- Customer's wallet has any prior connection to known mixer, sanctioned address, or hack
- Source-of-funds explanation is implausible or inconsistent
- Transaction patterns deviate materially from initial profile

EDD additional steps:

- Manual review by Compliance Officer
- Additional source-of-funds documentation (bank statements, employer letter, sale receipts)
- Periodic refresh (every 6 months)

## 5. Transaction Monitoring

### 5.1 Automated rules (off-chain — platform actions)

- Login from new country / ASN → alert
- Multiple accounts from same device fingerprint → alert
- Velocity anomalies (e.g., >5x normal deposit rate) → alert

### 5.2 Automated rules (on-chain — wallet bindings + smart contract events)

- Wallet bound to KYC'd account interacts with known sanctioned address → freeze + SAR review
- Wallet receives funds from known mixer (Tornado Cash, Sinbad, etc.) → freeze + EDD
- Structuring patterns (sub-$10K transactions designed to avoid thresholds) → SAR review
- Paymaster activity from previously unseen wallets exceeding velocity threshold → alert

### 5.3 Human review SLA

- Low-priority alerts: reviewed within 5 business days
- High-priority alerts: reviewed same business day
- Sanctions hits: reviewed within 1 hour during business hours, otherwise next business day open

## 6. Suspicious Activity Reporting (SAR)

- SAR filed within **30 calendar days** of detection (extendable to 60 with documented justification)
- Filed via FinCEN BSA E-Filing portal
- $2,000 aggregate threshold for MSB SARs (vs. $5K for banks)
- Confidentiality: SARs not disclosed to subject; staff trained on no-tipping rules
- Records retained 5 years

## 7. Currency Transaction Reporting (CTR)

- CTR filed for any cash transaction (or equivalent CVC) exceeding **$10,000** in a single business day per customer
- Aggregation rules: multiple transactions same day by same customer aggregated
- Filed via FinCEN within 15 calendar days

## 8. Recordkeeping

| Record type | Retention | Required by |
|---|---|---|
| Customer identification records | 5 years after account closure | 31 CFR 1022.220 |
| Transaction records | 5 years | 31 CFR 1022.410 |
| SAR / supporting documentation | 5 years | 31 CFR 1022.320 |
| CTR / supporting documentation | 5 years | 31 CFR 1022.310 |
| Sanctions screening logs | 5 years | OFAC guidance |
| Training records | 5 years | 31 CFR 1022.210 |
| Independent review reports | 5 years | 31 CFR 1022.210 |

All records stored encrypted at rest, with access logs and least-privilege controls.

## 9. Training

- Initial AML training for all staff and contractors with customer or transaction access within 30 days of joining
- Annual refresher
- Role-specific training for Compliance Officer (FinCEN updates, FATF, OFAC, state regulators)
- Training records signed and retained per §8

## 10. Independent Review

- Independent review of this AML program at least annually by a qualified external party (not the Compliance Officer)
- Findings documented and remediation tracked
- First review scheduled within 12 months of MSB registration

## 11. Risk Assessment

The Company performs a formal AML/CFT risk assessment at least annually,
covering:

- **Product risk:** Native token, paymaster, presale, staking vault, cross-chain bridging
- **Customer risk:** Geographic mix, individual vs. entity, PEP exposure, accredited vs. retail
- **Geographic risk:** Countries served, FATF list status
- **Channel risk:** Web platform, wallet-bound on-chain interactions, direct contract calls
- **Mitigation effectiveness:** Are existing controls reducing residual risk to acceptable?

Material changes (new product, new jurisdiction, new partner) trigger ad-hoc reassessment.

## 12. Adoption

This AML program will become binding upon:

1. Review by qualified outside counsel
2. Adoption by written resolution of SpiralCoin LLC's sole member/managing member
3. Designation of a named Compliance Officer
4. Engagement of a KYC vendor
5. Integration of sanctions screening into the signup and on-chain wallet-binding flows

[Signature block]
SpiralCoin LLC, by: ______________________ Date: __________
Compliance Officer: ______________________ Date: __________

---

## Appendix A — Reference list

- FinCEN MSB regulations: 31 CFR Part 1022
- FinCEN CVC guidance 2013: <https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering>
- FinCEN CVC guidance 2019: <https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf>
- FinCEN CDD Rule: 31 CFR 1010.230
- OFAC SDN list: <https://www.treasury.gov/ofac/downloads/sdn.xml>
- FATF country lists: <https://www.fatf-gafi.org/en/publications/High-risk-and-other-monitored-jurisdictions.html>
- BSA E-Filing portal: <https://bsaefiling.fincen.treas.gov>
- VerifyInvestor (Reg D accreditation): <https://www.verifyinvestor.com>

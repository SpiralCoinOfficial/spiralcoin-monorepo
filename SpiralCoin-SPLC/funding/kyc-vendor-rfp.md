# KYC Vendor RFP — SpiralCoin LLC

> Short, structured Request for Proposal to send to identity-verification vendors.
> Goal: comparable pricing + capability data from 3+ vendors within 2 weeks,
> so we can pick one before user-facing onboarding goes live.

Last updated: 2026-05-30
Owner: Trisha Dreyer

---

## Shortlist (request quotes from all three)

| Vendor | Why on list | Sales contact path |
|---|---|---|
| **Sumsub** | Strong crypto/Web3 focus, ~200 countries, good travel-rule support | https://sumsub.com/contact |
| **Persona** | Excellent developer experience, US-strong, flexible flows | https://withpersona.com/contact-sales |
| **Veriff** | Solid European coverage, competitive pricing, document-first | https://www.veriff.com/contact |

Optional adds: **Jumio**, **Onfido**, **iDenfy**, **ShuftiPro**.

---

## Email to send (paste-and-customize per vendor)

### Subject line

`SpiralCoin LLC — KYC vendor RFP for crypto MSB launch`

### Body

```
Hello,

SpiralCoin LLC (a US-registered FinCEN MSB — Money Transmitter, Form 107
filed 2026-05-30) is selecting a KYC / identity-verification partner for
a Q3 2026 launch. We are requesting structured pricing and capability
information from three vendors and will make a decision within 30 days
of receiving complete responses.

Please respond to the inline questions below. A spreadsheet, deck, or
PDF reply is welcome.

Reference: https://www.spiralcoin.net
Contact: Trisha Dreyer, founder · owner.splctoken@gmail.com · 170-939-8601

Best,
Trisha Dreyer
SpiralCoin LLC
```

---

## Inline questionnaire (paste into the email)

### 1. Coverage

- Countries supported (full list or count)?
- Document types accepted (passport / national ID / driver's license / residence permit)?
- Coverage in: US (all 50 states), UK, EU, CA, AU, NZ, SG, JP, BR, MX, ZA?
- States/countries explicitly NOT supported?
- Sanctions list coverage: OFAC SDN, OFAC SSI, EU Consolidated, UN 1267, UK HMT — all included?
- PEP screening included? Adverse-media screening included?

### 2. Verification capabilities

- Document authenticity check (NFC chip read, hologram detection, MRZ validation)?
- Selfie + liveness detection? Active or passive liveness?
- Proof-of-address verification (utility bill, bank statement)?
- Source-of-funds collection workflow?
- Re-verification / ongoing monitoring cadence?
- Travel Rule (FATF Recommendation 16) compliance for crypto VASP transfers?

### 3. Workflow & integration

- SDK / API for web + mobile?
- Hosted flow URL (so we can embed via iframe / redirect)?
- Webhook support for status updates?
- Sandbox environment for testing?
- Average integration time for a small team (1 dev)?
- Sample policy templates / pre-built risk rules?

### 4. Pricing

Please quote per scenario:

| Scenario | Monthly verifications | Bucket name |
|---|---|---|
| Pre-launch | 10-50 | "ramp-up" |
| Year 1 base case | 100-500 | "growth" |
| Year 1 optimistic | 500-2,500 | "scale" |

For each, please provide:

- Per-verification price (USD)
- Monthly platform fee or minimum (if any)
- Setup / integration fee (if any)
- Volume discount thresholds
- Cost for re-verifications
- Cost for ongoing sanctions screening (per user per month)
- Cost for PEP / adverse-media screening (per user per month or per check)
- Cost overages above the bucket
- Annual contract discount vs. month-to-month

### 5. Compliance posture

- SOC 2 Type II report available (under NDA)?
- ISO 27001 certified?
- GDPR controller / processor agreement available?
- CCPA compliant data-handling?
- Where is verification data stored geographically?
- Data retention defaults (we require 5 years per 31 CFR 1022.410)?
- Right-to-deletion handling under GDPR / CCPA?
- Breach notification SLA?
- Number of regulatory or law-enforcement requests handled in past 12 months?

### 6. Support

- Implementation support (engineer-to-engineer)?
- Ongoing technical support — hours, response SLA?
- Dedicated account manager at what monthly spend threshold?
- Status page / uptime SLA?

### 7. Case studies

- 2-3 references of other crypto MSB / token-issuer customers we can speak with under NDA?
- Public case studies / customer logos in our space?

### 8. Risk-decisioning configurability

- Can we set country-specific KYC tiers (e.g. lighter for low-risk countries, EDD for high-risk)?
- Can we build custom risk rules without engineering involvement?
- Manual review queue with audit trail?
- Override capabilities for our compliance officer?

### 9. Commercial terms

- Standard contract length (month-to-month, annual, multi-year)?
- Termination clause — cancel anytime or notice required?
- Data-portability commitment on offboarding?
- Price-increase notice period?

### 10. Timing

- Time from signed contract to production-ready integration?
- Earliest sandbox access for a 1-developer team?

---

## Internal scoring rubric (don't send — for our own use)

Score each vendor 1-5 on the dimensions below. Pick the highest total.

| Dimension | Weight | Sumsub | Persona | Veriff |
|---|---|---|---|---|
| Per-verification price (lower better) | 20% | _ | _ | _ |
| Coverage of priority countries | 15% | _ | _ | _ |
| Sanctions + PEP + adverse-media bundled | 10% | _ | _ | _ |
| Travel Rule support | 10% | _ | _ | _ |
| Integration ease (sample SDK, hosted flow) | 10% | _ | _ | _ |
| Crypto MSB references available | 10% | _ | _ | _ |
| SOC 2 + GDPR + CCPA compliance | 10% | _ | _ | _ |
| Custom rule engine without dev work | 5% | _ | _ | _ |
| Contract flexibility (no annual lock-in) | 5% | _ | _ | _ |
| Support quality | 5% | _ | _ | _ |
| **Weighted total** | 100% | _ | _ | _ |

---

## Realistic budget expectation

Based on public pricing pages and 2025-2026 market data:

| Tier | Sumsub | Persona | Veriff |
|---|---|---|---|
| Per-verification | $1.00-$2.50 | $1.50-$3.50 | $1.00-$2.00 |
| Platform / minimum | ~$0-$500/mo | ~$200-$1,000/mo | ~$0-$500/mo |
| Setup fee | Usually waived | Usually waived | Usually waived |
| Annual sanctions monitoring | $0.05-$0.20/user/mo | $0.10-$0.30/user/mo | $0.05-$0.20/user/mo |

Estimated first-year all-in cost for SpiralCoin: **$3K-$15K** (base case ~$5-8K).

---

## After quotes arrive

1. Make a one-pager scoring matrix using the rubric above
2. Reference-call 1-2 customers per finalist
3. Sandbox-test the top 2 with a real 30-minute integration sprint
4. Choose, sign, integrate
5. Update `funding/aml-policy-draft.md` §3.2 with the selected vendor name before the AML program is adopted

# SpiralCoin LLC — Bank Onboarding Pack

> Single document to attach to every business-bank application. Most crypto-friendly
> banks (Mercury, Cross River, Lead Bank, Customers Bank, Axos) will ask for the
> same set of information; this pack lets you answer once.

Last updated: 2026-05-30
Owner: Trisha Dreyer

---

## 1. Business identification

| Field | Value |
|---|---|
| Legal name | SpiralCoin LLC |
| DBA | SpiralCoin |
| Formation state | [TODO — fill in state of LLC formation] |
| Formation date | [TODO — fill in] |
| EIN | [TODO — fill in EIN from IRS letter] |
| Registered agent | [TODO — fill in] |
| Principal business address | [TODO — physical address, not PO box] |
| Mailing address | [if different] |
| Website | https://www.spiralcoin.net |
| Business email | owner.splctoken@gmail.com |
| Business phone | 170-939-8601 |

## 2. Business activity classification

| Field | Value |
|---|---|
| NAICS code (primary) | **522320 — Financial Transactions Processing, Reserve, and Clearinghouse Activities** |
| NAICS code (secondary) | 541511 — Custom Computer Programming Services |
| SIC code | 6199 — Finance Services |
| MCC (if asked) | 5734 (Computer Software) for SaaS subscriptions only |
| IRS Principal Business Activity | 522320 |
| FinCEN MSB category | **Money Transmitter** |
| FinCEN registration status | **Form 107 filed 2026-05-30 — registration number pending** |
| FinCEN MSB number | [TODO — fill in when received] |
| FinCEN MSB Registrant Search URL | https://www.fincen.gov/msb-registrant-search (verify listing once number is issued) |
| Activity description (verbatim, for bank application narrative): | "SpiralCoin LLC develops and operates a software trading platform and a suite of smart contracts on Arbitrum and other EVM-compatible chains. The Company issues a native digital token (SPLC) used for protocol fees, governance, and staking. SpiralCoin is registered as a Money Services Business under FinCEN (Money Transmitter category)." |

## 3. Beneficial ownership (FinCEN CTA / CDD Rule)

For each individual owning ≥25% or exercising substantial control:

| Field | Beneficial owner 1 |
|---|---|
| Full legal name | Trisha Dreyer |
| DOB | [TODO] |
| Residential address | [TODO — physical address] |
| Government-issued ID | [TODO — driver's license or passport number] |
| Citizenship | [TODO] |
| Title | Founder / Sole Member / Managing Member |
| Ownership % | 100% (currently sole member) |
| PEP status | [TODO — Yes / No] |
| Sanctions screening | Clean (self-attested; will be re-verified by KYC vendor at onboarding) |

If additional owners join, add a section per owner.

## 4. Source of funds & wealth

| Source | Description |
|---|---|
| Initial capital | Founder personal savings, post-tax |
| Operating funds (first 12 months) | Founder-funded + ecosystem grants (Arbitrum, Base, Polygon, Optimism, Gitcoin, Conduit applications in progress) |
| Planned external funding | Pre-seed SAFE round, $500K-$1M target, Q3-Q4 2026 |
| **No funds derived from:** | Cash-intensive businesses, high-risk jurisdictions, prior money services activity, or any source under investigation |

## 5. Expected account activity (12-month forecast)

| Metric | Conservative | Base case | Optimistic |
|---|---|---|---|
| Average monthly deposits | $1K-$3K | $10K-$30K | $50K-$150K |
| Largest single deposit (anticipated) | $25K (grant) | $100K (grant or SAFE close) | $500K (SAFE close) |
| Average monthly withdrawals | $1K-$3K (vendors, hosting) | $5K-$15K | $30K-$80K |
| Wire / ACH transaction volume | 5-20/month | 30-100/month | 100-300/month |
| International wires | None anticipated in year 1 | 0-5/month | 5-20/month |
| Cash deposits or withdrawals | **None** | **None** | **None** |
| Customer payment processing | Via Stripe (SaaS subs only) | Via Stripe + crypto rails | Via Stripe + crypto rails |
| Crypto on/off-ramp activity through this account | **None — separate licensed processor** | Same | Same |

## 6. AML / BSA compliance program

| Element | Status |
|---|---|
| Designated Compliance Officer | [TODO — to be named in board / sole-member resolution] |
| Written AML program | DRAFT — see `/funding/aml-policy-draft.md`; pending attorney review and formal adoption |
| CIP (Customer Identification Program) | Tiered KYC defined in AML draft §3 |
| Sanctions screening | OFAC SDN, EU Consolidated, UN 1267, EU CSL — daily delta check planned |
| Transaction monitoring | Off-chain platform + on-chain wallet-binding monitoring (rules in AML draft §5) |
| SAR filing capability | Compliance Officer authorized to file via FinCEN BSA E-Filing |
| Recordkeeping | 5-year retention per 31 CFR 1022.410 |
| Training | Initial within 30 days of hire; annual refresher |
| Independent review | Annual, first review within 12 months of MSB registration |

## 7. Risk acknowledgments

We acknowledge that SpiralCoin LLC's activity profile carries:

- Inherent MSB risk (Money Transmitter category)
- Inherent virtual currency / digital asset risk
- Cross-border activity risk (international users post-geofence-launch)
- Token issuer regulatory risk (SPLC token likely classified as a security; structured offerings only)

In response, we:

- Maintain MSB registration current and renew biennially
- Use a tiered KYC program with third-party identity verification
- Maintain a geofence excluding OFAC-sanctioned jurisdictions and (currently) all US persons pending state-level licensing
- Restrict securities sales to Reg D 506(c) accredited investors or Reg S non-US persons
- Use Stripe / fiat rails only for SaaS subscriptions, not for crypto purchases
- Carry (or plan to carry) cyber-liability and E&O insurance

## 8. Supporting documents (attach to application)

- [ ] Certificate of formation (state-issued)
- [ ] EIN confirmation letter (IRS CP 575)
- [ ] FinCEN Form 107 confirmation receipt (BSA E-Filing PDF)
- [ ] Operating agreement (LLC)
- [ ] Proof of business address (utility bill or lease)
- [ ] Beneficial owner government ID
- [ ] Beneficial owner proof of address
- [ ] Domain ownership proof (WHOIS or Search Console verification)
- [ ] Draft AML/KYC program (`/funding/aml-policy-draft.md`)
- [ ] Privacy Policy + Terms of Service URLs (live on spiralcoin.net)
- [ ] Risk disclosure URL (live on every page footer)

## 9. Bank shortlist & application status

| Bank | MSB-friendly | Application status | Notes |
|---|---|---|---|
| Mercury | Case-by-case | [ ] Not started | Free; fast; check current crypto MSB policy |
| Cross River Bank | Yes | [ ] Not started | Works with regulated fintechs |
| Lead Bank | Yes | [ ] Not started | Sponsor bank for crypto fintechs |
| Customers Bank (CBIT) | Yes (CBIT network) | [ ] Not started | Real-time settlement rails |
| Axos Bank | Some crypto MSBs | [ ] Not started | Larger / more traditional |
| Coinbase Business (Prime) | Crypto-native | [ ] Not started | If you want a one-stop crypto + fiat |
| ❌ Chase / BofA / Wells | NO | n/a | Will close account upon discovering MSB activity |

**Recommendation:** Apply to Mercury first (lowest friction), Cross River second (best long-term fit), Lead Bank third (backup). Do not apply to the big-3 retail banks.

## 10. Disclosure principle

We disclose MSB status, virtual currency activity, and token issuer status on **every** banking application. Hiding it has cost other crypto founders not just one account but their entire banking relationship (314(a) reports propagate across institutions). Honesty up front is materially cheaper.

# Ad Certification & Paid-Acquisition Status

> Single source of truth for what is currently gating paid traffic and which
> ad sets can run safely right now.

Last updated: 2026-05-30

---

## TL;DR

| Channel | Status | Notes |
|---|---|---|
| Google Ads — crypto-themed campaign | ❌ **BLOCKED** | Cryptocurrencies policy violation. Requires Google's Cryptocurrency Advertiser Certification before any ad will serve. |
| Google Ads — non-crypto "platform" campaign | ✅ **CAN RUN NOW** | Use `/platform.html` as Final URL. Avoid crypto trigger words in headlines, descriptions, and ad images. |
| Google Ads — Financial Services Verification | ⚠️ **REQUIRED** | Yellow warning on the account. Apply alongside crypto cert. |
| FinCEN MSB registration | 🟨 **FILED 2026-05-30** | Form 107 submitted via BSA E-Filing. Awaiting MSB registration number (typical 2-6 weeks). |

Until the certifications come through, **do not re-enable the crypto ad group**.
Run the non-crypto platform ad set instead.

---

## Active campaigns

### 1. Modern Trading Platform (non-crypto)
- **Final URL:** `https://www.spiralcoin.net/platform.html`
- **Avoid in ad text:** crypto, cryptocurrency, token, SPLC, USDC, BTC, ETH, coin, wallet, airdrop, presale, staking, web3
- **Allowed angle:** charts, watchlists, portfolio, alerts, demo, mobile-ready
- **Primary CTA:** Start Demo
- **Conversion event:** `demo_signup` (wired via `data-ga-conversion="demo_signup"` on
  the primary CTAs in `platform.html`)
- **Compliance:** descriptions follow SpiralCoin guardrails — no "guaranteed,"
  "risk-free," or "always wins"; risk-disclosure footer is rendered on every page.

### 2. SpiralCoin (SPLC) — crypto-themed
- **Status: PAUSED.** Do not unpause until both certifications are granted.
- Account: `170-939-8601` · `owner.splctoken@gmail.com`
- Open policy violations:
  - Cryptocurrencies (red) — disallowed in 192 countries, cert required in 57.
  - Financial Services Verification (yellow) — certificate required.

---

## Certification roadmap (US)

### Phase A — Business foundation (week 1-2)
- [ ] Legal entity confirmed (LLC / corp) with EIN
- [ ] Domain WHOIS / verified contact on `spiralcoin.net` matches legal entity
- [ ] Business bank account in the entity's name
- [ ] Privacy Policy, Terms of Service, and full Risk Disclosure pages live and
      linked from every page footer

### Phase B — FinCEN MSB registration (week 2-6, free)
- [x] Account at https://bsaefiling.fincen.treas.gov
- [x] **Form 107 filed 2026-05-30** (Money Transmitter category)
- [ ] **MSB registration number received → record here:** `__________` (pending)
- [ ] Renewal calendar reminder set for **Dec 31, 2027** (biennial renewal)
- [ ] Review state money-transmitter licensing requirements (engage attorney for memo)
- [ ] AML/KYC policy document drafted (see `funding/aml-policy-draft.md`)
- [ ] Designate Compliance Officer in writing (board / sole-member resolution)

### Phase C — Google Financial Services Verification
- [ ] Apply: https://support.google.com/adspolicy/answer/11195222
- [ ] Upload business registration, EIN letter, proof of address, domain ownership
- [ ] Wait ~3-5 business days

### Phase D — Google Cryptocurrency Advertiser Certification
- [ ] Apply: https://support.google.com/adspolicy/contact/crypto_application
- [ ] Submit FinCEN MSB number + any state MTLs + business legal name + domain
- [ ] Confirm targeted countries are on Google's allowlist:
      https://support.google.com/adspolicy/answer/3030672

### Phase E — While waiting
- [x] Pause crypto ad group
- [x] Launch non-crypto `/platform.html` ad set
- [x] Risk-disclosure footer present on all public pages
- [ ] Configure conversion action in Google Ads, paste `AW_LABEL` into
      `assets/js/ads-config.js` (`AW_ID` is already `AW-18194981189`)

---

## Hard "don'ts"

These will get the account suspended permanently:

- ❌ Claiming FinCEN registration before it is granted
- ❌ Implying SEC / FINRA membership unless actually true
- ❌ Running ads in disallowed countries via VPN or proxy
- ❌ "Guaranteed returns," "risk-free," "make $X per day," "always wins"
- ❌ Fake testimonials, invented user counts, fabricated logos
- ❌ Mixing crypto messaging into the non-crypto platform ad set

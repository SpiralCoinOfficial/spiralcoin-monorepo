# SpiralCoin (SPLC) — Investor Pack

This folder contains everything needed to approach venture partners, launchpads,
and accredited investors for the SPLC token launch.

## Contents

| File | Purpose | Audience |
|------|---------|----------|
| `01_tokenomics_onepager.md` | Allocation, vesting, FDV, use of funds | All |
| `02_pitch_deck_outline.md` | 12-slide deck structure with copy | VCs, launchpads |
| `03_pinksale_listing.md` | Pre-filled PinkSale form values | Self-service launch |
| `04_launchpad_application.md` | DAO Maker / Polkastarter / Seedify apps | Vetted launches |
| `05_vc_outreach_email.md` | Cold email template + sequence | Crypto seed funds |
| `06_vc_target_list.md` | 30 real crypto seed funds, publicly known | You |
| `07_regd_506c_memo.md` | US accredited investor memo (lawyer required) | US-based raise |
| `08_lp_partner_term_sheet.md` | LP partnership terms (100M tokens for liquidity) | Strategic LPs |
| `09_audit_checklist.md` | Pre-launch security audit requirements | You + auditor |
| `10_kyc_dox_checklist.md` | What to publish to dox yourself credibly | You |

## Critical reminders

- **Get a crypto-securities attorney consult before any token sale.** Suggested firms:
  - Anderson Kill (NYC, crypto practice)
  - Cooley LLP (SF, fintech)
  - Reed Smith (global, blockchain group)
  - Hogan Lovells (DC, regulatory)
- **PinkSale and DXSale do not allow US participants.** If your raise targets US persons,
  you need Reg D 506(c) or Reg CF, not a launchpad.
- **Get an audit before any presale.** CertiK, Hacken, SolidProof, OpenZeppelin.
- **Trading involves risk. Past performance does not guarantee future results.**

## Status

- [x] Tokenomics finalized (1B fixed supply, 9-bucket allocation per `contracts/config/launch.json`: 15% founder/team, 20% treasury, 30% staking, 10% public sale, 5% Reg D, 1.5% LP seed, 10% CEX listing reserve, 8% ecosystem grants, 0.5% airdrop — all vested through on-chain `SPLCPresaleVesting` and time-locked contracts)
- [x] Contracts written (`contracts/contracts/SpiralCoin.sol`)
- [ ] Contracts audited
- [ ] Lawyer engaged
- [ ] Founder KYC/dox published
- [ ] Liquidity partner secured OR own ETH ready
- [ ] Launchpad chosen
- [ ] Mainnet deployment

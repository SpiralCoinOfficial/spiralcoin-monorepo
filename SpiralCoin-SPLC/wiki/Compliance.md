# Compliance

> This page describes the compliance posture of the SpiralCoin product copy and
> marketing surfaces. It is **not** legal advice. Consult a qualified attorney
> in your jurisdiction before launching paid trading, token sales, or solicited
> investment.

## Site-wide rules

Enforced via the `SpiralCoinCompliance.instructions.md` ruleset that loads on
every code-generation request touching `www.spiralcoin.net` content.

### Required behaviors

- ✅ Balanced, non-deceptive language
- ✅ Soft disclaimer on any page mentioning trading outcomes:
  *"Trading involves risk. Past performance does not guarantee future results."*
- ✅ Frame performance figures as historical/hypothetical unless audited
- ✅ Clarity on risk and user responsibility

### Banned language

- ❌ "Risk-free"
- ❌ "Guaranteed profits" / "guaranteed returns"
- ❌ "Always wins" / "never lose"
- ❌ Invented certifications, licenses, regulatory approvals, user counts, testimonials
- ❌ Manipulative urgency / fear-based pressure CTAs

### CTA policy

| Preferred (compliant) | Avoid |
|---|---|
| Start Demo | Start Earning |
| Explore Platform | Make Money Now |
| Learn How It Works | Don't Miss Out |
| Create Account | Last Chance |

## Sponsor / fundraise framing

Every page that mentions sponsorships must include language equivalent to:

> Sponsorships are donations toward bootstrapping public on-chain
> infrastructure. They are **not** investments, equity, securities, tokens,
> profit-share, or revenue-share entitlements. No financial return is offered
> or implied.

This appears verbatim on `splc.html` (the contributors section) and is required
on any new sponsor-facing landing page.

## Trading platform framing

While the trading UI is demo-only (pre-licensure):

- All quote data must be labeled "delayed" or "indicative"
- Order tickets must not transmit to a real venue
- A persistent banner reads: *"Demo mode — orders are not routed to any exchange."*
- Trading-outcome screenshots must carry: *"Hypothetical. Past performance
  does not guarantee future results."*

## Reg D 506(c) investor pack

The `investor-pack/` directory contains accredited-investor materials. These
are **not** linked from the public site navigation and are gated by the
`/api/regd.php` capture flow. Access requires:

- Self-certification of accredited status (US §501(a) definition)
- Email + signed self-cert form

The form links to:
<https://www.sec.gov/education/capitalraising/building-blocks/accredited-investor>

## Geographic restrictions

`assets/geo-block.js` runs on every page and reads the visitor's coarse
country via a free IP geo service. The trading platform pages display a
notice and disable the order ticket for visitors in:

- OFAC-sanctioned jurisdictions
- US states without an MTL where state law requires one (placeholder list)

This is a **defense in depth** measure, not a substitute for proper KYC.

## Cookies & privacy

[cookies.html](../cookies.html) lists:

- Auth0 session cookies
- GA4 analytics cookies (`_ga`, `_ga_*`) — anonymized IP
- Functional `splc_*` localStorage entries

No third-party advertising trackers are loaded.

## Email collection

Any email-collection form must:

- Have a checkbox for marketing consent (default off)
- Link to the privacy policy
- Comply with CAN-SPAM (US) and GDPR (EU) — including the ability to
  unsubscribe via a one-click link in every email sent

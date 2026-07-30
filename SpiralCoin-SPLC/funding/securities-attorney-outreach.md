# Securities Attorney Outreach — Fixed-Fee Memo Request

> Cold outreach templates to engage a securities attorney for a fixed-fee memo
> covering (1) SPLC token classification, (2) broker-dealer status of SpiralCoin
> LLC under current architecture, and (3) recommended Reg D 506(c) / Reg S
> presale structure.

Last updated: 2026-05-30
Owner: Trisha Dreyer

---

## Shortlist (in priority order)

| Firm | Why | Typical fixed-fee range | Notable practitioners (verify current roster) |
|---|---|---|---|
| **Anderson Kill** (Stephen Palley / digital assets group) | Long crypto track record; willing to do fixed-fee memos | $5K-$15K | Digital Assets practice group |
| **Sullivan & Worcester** (Crypto / Blockchain group) | Boutique-feel within mid-size firm; pragmatic | $7K-$20K | Joel Telpner historically |
| **K&L Gates** (Digital Assets, Blockchain & Cryptocurrencies) | Big-firm rigor; good for institutional credibility | $10K-$30K | Robert Tannenbaum / Judith Rinearson |
| **Cooley LLP** (Fintech / Digital Assets) | Premier VC-aligned firm; best if you want VC-friendly opinions | $15K-$50K | Marco Santori (formerly) / current crypto partners |
| **BakerHostetler** (Blockchain Tech group) | Litigation-aware; valuable defensive posture | $10K-$25K | Joanna Wasick et al. |
| **Goodwin Procter** (Digital Currency & Blockchain) | VC-friendly; strong on token structuring | $15K-$40K | Grant Fondo et al. |

**Plan:** email 3-4 firms simultaneously, take the first reasonable fixed-fee quote.

---

## Outreach email template (paste-and-customize)

### Subject line options

- "Fixed-fee memo request: token classification + broker-dealer analysis"
- "SpiralCoin LLC — engagement inquiry, ERC-20 issuer + paymaster"
- "New FinCEN MSB seeking securities counsel for token launch memo"

### Email body template

```
Hello [Partner Name],

I'm the founder of SpiralCoin LLC, a recently FinCEN-registered Money
Services Business (Money Transmitter category — Form 107 filed
2026-05-30, registration number pending).

We are pre-launch on a multi-chain ERC-20 token (SPLC) and an associated
trading-platform website at spiralcoin.net. Our smart contracts are
deployed to Arbitrum Sepolia testnet and have completed an internal
audit; an external audit is scheduled for Q3 2026.

Before we move toward mainnet, a presale, or any US-facing token
distribution, I am seeking a fixed-fee memo from your firm covering:

  1. Token classification under the Howey test — is SPLC likely a
     security at issuance?
  2. Broker-dealer status under Section 3(a)(4) / 3(a)(5) — given our
     current architecture (issuer-published AMM with a 3.14% protocol
     fee to a treasury; ERC-4337 paymaster swapping SPLC for ETH on
     Uniswap V3 on behalf of users), is SpiralCoin LLC likely operating
     as an unregistered broker or dealer?
  3. Recommended offering structure for a US presale (Reg D 506(c)
     accredited-only, Reg S non-US-only, or a combination) — including
     Form D filing requirements and any state blue-sky notice filings.
  4. Recommended architectural changes (if any) to reduce broker-dealer
     risk while preserving the protocol fee mechanism — e.g. routing
     fees to a separately-organized DAO entity (Wyoming DAO LLC or
     Cayman foundation).

I'm looking for a 5-10 page written memo with conclusions and supporting
analysis, suitable for sharing with our auditors, prospective investors,
and our compliance officer-of-record.

Could you please send:
  - Your fixed-fee quote for a memo of this scope
  - An estimated turnaround time
  - A standard engagement letter / conflict-check process
  - A short bio of the partner / senior associate who would lead the work

I have working capital allocated and am ready to move within 1-2 weeks of
your response.

Reference materials available on request:
  - Smart contract source code (private GitHub repo, access on NDA)
  - Internal audit report (PDF)
  - Draft AML/KYC program
  - Current site (spiralcoin.net)

Thank you,

Trisha Dreyer
Founder, SpiralCoin LLC
owner.splctoken@gmail.com
170-939-8601
https://www.spiralcoin.net
```

---

## Conflict-check disclosure (most firms will ask)

Before they engage, firms run a conflict check. Be ready to disclose:

- Legal name: SpiralCoin LLC
- All beneficial owners (you, currently)
- Counterparties (LayerZero Labs, Uniswap Labs, Arbitrum Foundation, Base, Polygon Labs, etc.)
- Any current or planned litigation (none)
- Whether any prior counsel has worked on these matters (presumably no)

---

## What to NOT do in initial outreach

- ❌ Don't ask for a "free 15-minute consultation" to extract legal advice. Reputable firms won't, and asking signals you're not serious.
- ❌ Don't share the contract source publicly in the first email. Wait for engagement letter + NDA.
- ❌ Don't represent your situation more favorably than reality. Disclose the 3.14% tax, the paymaster custody flow, the presale plans honestly. Hiding these = bad memo + bad defense if regulator comes.
- ❌ Don't engage the cheapest firm reflexively. The $5K memo from a generalist can cost you $500K when a regulator reads it.
- ❌ Don't engage anyone who guarantees the SEC won't act. Securities law is probabilistic; honest counsel will quantify risk, not eliminate it.

---

## After engagement — what to expect

1. **Engagement letter signed** + retainer paid (typically $5K-$15K up front)
2. **Information request list** (contracts, tokenomics doc, deployment plan, marketing copy, audit reports) → 1-2 weeks
3. **Kick-off call** with the lead partner → 1 hour
4. **Draft memo delivered** → 3-6 weeks from kick-off
5. **Revision call** → 1 hour
6. **Final memo delivered** → 1-2 weeks after revision call

Total elapsed time: typically 6-10 weeks. Build that into the Q3 timeline in `12-month-roadmap.md`.

---

## What to do with the memo

- **Read it.** Don't skim.
- **Implement the architectural recommendations** before TGE.
- **Share with prospective lead investors** under NDA — it's a credibility multiplier.
- **Reference it (not quote it)** in your AML/KYC program adoption resolution.
- **Update annually** as your facts change (new chains, new products, new jurisdictions).
- **Do NOT share publicly** — privileged communication, and once you waive privilege you can't get it back.

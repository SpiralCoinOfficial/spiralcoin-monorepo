# SpiralCoin — 30-Second Funding Video Ad · Production Script

**Runtime:** 30.0 seconds
**Aspect ratios:** 1920×1080 (default) and 1080×1920 (`?v=1`)
**Source render:** [funding/ads/video-ad-30s.html](video-ad-30s.html) — animated HTML5, no external assets
**Captions:** [funding/ads/video-ad-30s.srt](video-ad-30s.srt)

---

## How to produce the MP4

1. Open [funding/ads/video-ad-30s.html](video-ad-30s.html) in Chrome / Edge full-screen (F11).
2. Launch **OBS Studio** → add **Window Capture** source on the browser tab.
3. Crop the capture region to the dark stage (auto-scales to viewport — full-screen browser ≈ no crop needed).
4. Output: **1920×1080 @ 30 fps · CBR 10 Mbps · MP4 (H.264 + AAC)**.
5. Start recording → reload the page → record **31 seconds** → stop.
6. Trim head/tail in any editor (DaVinci Resolve free, ShotCut, CapCut).
7. Layer voiceover (see below) + music bed at -18 LUFS.
8. Burn in captions from `video-ad-30s.srt` or keep as a sidecar.
9. Export final: **MP4 H.264, 1080p, 30fps, ~10MB target for X / LinkedIn**.
10. Repeat for vertical (`video-ad-30s.html?v=1` → 1080×1920) for Reels / TikTok / Shorts.

---

## Voiceover script (warm, calm, measured — not hype)

> **Total VO duration ≈ 28 seconds. Leave ~1s pad at head and tail.**

| Time | VO line | Notes |
|------|---------|-------|
| 0.5 – 4.5s | "A crypto launch — without the hype premium." | Beat after "launch." Soft delivery. |
| 5.5 – 9.5s | "No VC round. No private valuation. Just open-source code." | Three short sentences. Even pacing. |
| 10.5 – 15.5s | "One billion fixed supply. Twelve-month locked liquidity. A three-point-one-four percent immutable AMM tax. One hundred twenty-one passing tests." | Slow on numbers. Let visuals lead. |
| 16.5 – 21.5s | "SPLC is live on Arbitrum One. Verify the contract. Read the code. Don't trust — verify." | "Verify" emphasized twice. |
| 22.5 – 29.0s | "Support an honest crypto launch. Review the source. Fund the runway. Spiralcoin dot net." | Land softly on URL. |

**Voice direction:** mid-range male or female; conversational not announcer; no rising inflection on numbers; pause for breath between sentences. Reject any take that sounds like crypto Twitter hype.

**Royalty-free VO options (paid, <$30):** Voices.com, Voice123, Fiverr Pro. Or use ElevenLabs (Adam / Bella / Rachel voices) — disclose AI-generated voice in video description for transparency.

---

## Music bed

**Vibe:** ambient electronic, slow build, minimal melody. Think *"Stranger Things"* synth pad meets indie-fintech explainer.

**Royalty-free sources:**

- Epidemic Sound: *"Reverberation"* by Hampus Naeselius, *"Sacred Geometry"* by Aeon Tales
- Artlist: search **"calm tech explainer"** or **"minimal cinematic"**
- YouTube Audio Library (free): *"Air to the Throne"*, *"Patient Wolf"*

**Mix:** music at **-22 LUFS**, VO at **-18 LUFS**, master output at **-16 LUFS** (X / LinkedIn loudness target).

---

## Storyboard (scene-by-scene)

### Scene 1 — Hook (0–5s)

- **Visual:** Black-to-galaxy fade. Gold spiral mark glints. Headline: *"A crypto launch without the hype premium."*
- **Motion:** Spiral mark rotates slowly (18s loop). Stars twinkle.
- **VO cue:** Line 1.

### Scene 2 — The Honest Pitch (5–10s)

- **Visual:** Three-line headline. *"No VC round. No private premium. Just code."* Subtitle row of 4 trust attributes.
- **Motion:** Lines stagger in (180 ms each).
- **VO cue:** Line 2.

### Scene 3 — The Numbers (10–16s)

- **Visual:** Four large stat cards: **1B · 12 mo · 3.14% · 121**.
- **Motion:** Cards rise into place with 100 ms stagger; gold values count up briefly.
- **VO cue:** Line 3.

### Scene 4 — Verify (16–22s)

- **Visual:** "SPLC is live on Arbitrum One." Contract address in monospace box. Footnote: *Open source · Multisig-bound treasury · 9-bucket on-chain allocation.*
- **Motion:** Address fades in with subtle gold glow pulse.
- **VO cue:** Line 4.

### Scene 5 — CTA (22–30s, holds)

- **Visual:** *"Review the source. Fund the runway."* CTA pill: **spiralcoin.net**. Sub-URL: **github.com/SpiralCoinOfficial/ionos-migration**.
- **Motion:** CTA pill scales up gently. Hold final frame for thumb-tap on social autoplay.
- **VO cue:** Line 5.

**Persistent overlays (entire video):**

- Top-left corner: SpiralCoin logo + "$SPLC · Arbitrum One"
- Bottom edge: gold 6-px progress bar
- Bottom centerline: compliance disclaimer (small, readable)

---

## On-screen text — copy block (for verification)

```
A crypto launch
without the hype premium.

No VC round.
No private premium.
Just code.

1B Fixed Supply · 12 mo LP NFT Lock · 3.14% AMM Tax (V2 only) · 121 Passing Tests

SPLC is live on Arbitrum One
0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C

Review the source.
Fund the runway.

spiralcoin.net
github.com/SpiralCoinOfficial/ionos-migration

Trading involves risk. Past performance does not guarantee future results. Not an offer to sell securities.
```

---

## B-roll alternatives (if HTML render is rejected by a placement)

- 3-second clip of Arbiscan transaction page for `0x8e45cc9F...` scrolling
- 3-second clip of GitHub repo file tree scrolling
- 3-second clip of Hardhat test suite running (`121 passing` green output)
- 3-second clip of Uniswap V3 pool page (post-launch only — do NOT fake)

---

## Distribution checklist

- [ ] **X / Twitter** — 1080×1080 square crop + thread (Section 2 of `funding-ad-draft.md`)
- [ ] **LinkedIn** — 1920×1080 landscape + LinkedIn caption (Section 3)
- [ ] **YouTube Shorts / TikTok / Reels** — 1080×1920 vertical
- [ ] **Farcaster** — embed 1920×1080 MP4 inline cast
- [ ] **Discord / Telegram** — 1080×1080 + 30s GIF preview (for mute autoplay)
- [ ] **Email signature** — animated GIF (10 sec loop of Scene 1+5 only)

---

## Compliance gate — DO NOT publish without these checks

- [ ] Disclaimer visible for ≥3 seconds on screen
- [ ] No spoken/written "guaranteed," "risk-free," "next 100x," or price targets
- [ ] Contract address matches `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C` exactly
- [ ] Captions burned in or attached for accessibility
- [ ] Video description includes: *"Trading involves risk. Past performance does not guarantee future results. This is not an offer to sell securities; any future regulated offering will be conducted under appropriate exemption with full subscription documents."*
- [ ] If AI voiceover used → disclose in description

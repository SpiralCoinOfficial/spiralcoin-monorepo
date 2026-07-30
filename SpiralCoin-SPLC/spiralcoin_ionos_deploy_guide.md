# SpiralCoin — IONOS Editor Deployment Guide

**Editor URL:** [https://editor.mywebsite-now.com/en-US/506b6fee-8b40-4412-8d0e-937f5f63f842](https://editor.mywebsite-now.com/en-US/506b6fee-8b40-4412-8d0e-937f5f63f842)
**Target domain:** [www.spiralcoin.net](https://www.spiralcoin.net)
**Canonical file:** `spiralcoin_trading_platform.html`

---

## Quick Reference — What You're Publishing

| Section | Version B Copy Source | Status |
| --- | --- | --- |
| Hero | `SpiralCoin_PagePack_VersionB.md` → Hero Block | ✅ Done |
| Features | VersionB Feature Cards | ✅ Done |
| Trust | VersionB Security & Trust | ✅ Done |
| FAQ | VersionB FAQ Block | ✅ Done |
| Final CTA | VersionB Final CTA Block | ✅ Done |

---

## Option A — Recommended: Host the Raw HTML File

IONOS MyWebsite Now supports uploading custom HTML. This deploys the full live platform instantly.

### Steps

1. **Open the editor**
   Go to: [https://editor.mywebsite-now.com/en-US/506b6fee-8b40-4412-8d0e-937f5f63f842](https://editor.mywebsite-now.com/en-US/506b6fee-8b40-4412-8d0e-937f5f63f842)

2. **Go to Pages → Add Page → Custom HTML / Embed**
   Or: Settings → Custom HTML → Full Page Mode

3. **Paste the contents of `spiralcoin_trading_platform.html`**
   Open the file, select all (Ctrl+A), paste into the custom HTML field.

4. **Upload the logo**
   - Go to Media Library → Upload → select `spiralcoin_logo.png`
   - Confirm the published URL ends with `/spiralcoin_logo.png` (the HTML references this path)

5. **Set as Home Page**
   Pages → drag the custom HTML page to position 1 → Set as Homepage

6. **Fill SEO fields** (Settings → SEO)
   - Page title: `SpiralCoin | Live Trading Platform`
   - Meta description: `Trade faster with live markets, AI signals, and full chart control. Stream real-time data and interactive charts.`
   - OG image: upload `spiralcoin_logo.png`

7. **Publish**
   Click Publish → confirm domain is `www.spiralcoin.net`

---

## Option B — Section-by-Section in the Visual Editor

Use this if Option A is not available in your IONOS plan tier.

### Section Order (top to bottom)

```text
1. Nav / Header
2. Live Ticker Strip
3. Hero
4. Chart + AI Panel
5. Features (3-column cards)
6. Why SpiralCoin (2-column)
7. Trust / Security
8. FAQ Accordion
9. Final CTA
10. Footer
```

### Section 1 — Nav / Header

- Logo: upload `spiralcoin_logo.png` (36×36, circular crop)
- Brand text: **SpiralCoin (SPLC)**
- Nav links: Platform · Features · Trust · FAQ
- Right CTA button: **Start Demo** (links to chart section)

---

### Section 2 — Live Ticker Strip

- Background: `#0e1621`
- Add a text/embed block and paste the ticker `<div>` from the HTML
- If visual editor blocks custom JS, embed the Binance ticker via iframe or skip and use static placeholder text

**Static fallback text (if JS blocked):**
`BTC/USDT  ·  ETH/USDT  ·  BNB/USDT  ·  SOL/USDT  ·  XRP/USDT  ·  DOGE/USDT`

---

### Section 3 — Hero

**Background:** Dark (`#0b0f15`) with subtle gold radial gradient overlay

| Element | Content |
| --- | --- |
| Badge / eyebrow | 🔴 Live Market Feed Active |
| H1 | **Trade Faster With Live Markets, AI Signals & Full Chart Control** |
| Subheadline | SpiralCoin combines streaming market data, AI-fed analysis, and fully interactive charts so you can move from insight to action in seconds. |
| Primary CTA | **Start Live Demo** → links to chart/demo section |
| Secondary CTA | **See It In Action** → links to Features section |
| Urgency microcopy | Join active users testing real-time workflows today. |

**CTA button style:** Gold fill (`#f5c451`), dark text (`#241b09`), rounded (10px), bold

---

### Section 4 — Live Chart + AI Panel

Paste the chart section HTML embed:

```html
<div id="demo"> ... </div>
```

This requires the TradingView Lightweight Charts `<script>` tag in the page `<head>`.

**IONOS Custom Code block path:**
Editor → Add Section → Custom Code → paste the chart HTML + include the CDN script in Header Code:

```html
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
```

---

### Section 5 — Features (3-column grid)

Add a 3-column card section. Content per card:

| Icon | Title | Body |
| --- | --- | --- |
| ⚡ | Live Market Integration | Stream near real-time market updates with clear live/reconnecting status so you stay aligned with current conditions at all times. |
| 🤖 | Live AI-Fed Data | AI context updates with market behavior to highlight trend, momentum, and volatility signals for faster analysis and decision support. |
| 📈 | Interactive Charts + User Modifications | Edit indicators, drawing tools, timeframes, and layouts. Your workspace is fully customizable and persists between sessions. |
| 🔄 | Multi-Pair Monitoring | Track BTC, ETH, BNB, SOL, XRP, DOGE and more. Switch chart pairs instantly without losing context. |
| 📐 | Multiple Timeframes | Switch between 1m, 5m, 15m, 1h, 4h, and 1D timeframes. Each view updates with fresh candle data in real time. |
| 🛡️ | Transparent Data State | Clear connection status means you always know whether you're viewing live or stale data. |

---

### Section 6 — Why SpiralCoin (2-column)

Section heading: **Why Traders Choose SpiralCoin**

| Bullet | Title | Body |
| --- | --- | --- |
| ✓ | Faster Clarity | See live movements without waiting on stale snapshots. React when it matters. |
| ✓ | Smarter Context | AI-assisted signal framing supports better decision flow without false certainty. |
| ✓ | Total Control | Modify chart behavior and views to match your exact strategy and preferences. |
| ✓ | Cleaner Execution Path | Less friction from analysis to action — built so insight becomes decision faster. |

---

### Section 7 — Trust / Security

Section title: **Built for Trust, Designed for Control**

Trust bullets:

- ✓ Transparent data-state labeling and live/reconnecting status at all times
- ✓ User-controlled chart personalization and workspace settings
- ✓ Clear risk-aware messaging and responsible product framing
- ✓ No unrealistic promises — just practical, high-performance tooling

**Disclaimer block (required — use highlighted/alert style):**
> ⚠️ Trading involves risk. Past performance does not guarantee future results. AI signals are informational only and not financial advice.

---

### Section 8 — FAQ Accordion

Add 5 FAQ items:

| Question | Answer |
| --- | --- |
| Is the market feed live? | SpiralCoin is designed for streaming market updates via WebSocket with status visibility during reconnect events, so you always know the freshness of your data. |
| Does AI guarantee profitable trades? | No. AI is a decision-support layer that surfaces trend, momentum, and volatility context. It cannot guarantee outcomes and should not replace your own analysis and risk management. |
| Can I fully customize the charts? | Yes. You can switch pairs, change timeframes, and the platform supports drawing tools, indicators, and saved layouts. |
| Is this only for advanced traders? | No. The platform is built for fast onboarding with the market overview and AI signals providing immediate context, while advanced depth is available for experienced users. |
| What data sources does SpiralCoin use? | Market price data streams from public exchange WebSocket endpoints. AI signals are derived from on-chart calculations including moving averages, RSI, and ATR — updated with each new candle. |

---

### Section 9 — Final CTA

| Element | Content |
| --- | --- |
| H2 | **Ready to Trade With Real-Time Intelligence?** |
| Body | Launch your live demo and experience streaming data, AI-assisted analysis, and user-driven chart control in one platform. |
| Primary CTA | **Start Your Demo** |
| Secondary CTA | **Compare Plans** |

Background: Gold-tinted dark card (`rgba(245,196,81,0.09)` on dark)

---

### Section 10 — Footer

- Brand: SpiralCoin (SPLC) · spiralcoin.net
- Disclaimer: "Trading involves risk. Past performance does not guarantee future results. Not financial advice."
- Font color: `#9da7ba` (muted)

---

## SEO Metadata Checklist

Fill these fields in **Settings → SEO** before publishing:

| Field | Value |
| --- | --- |
| Page title | `SpiralCoin \| Live Trading Platform` |
| Meta description | `Trade faster with live markets, AI signals, and full chart control. Stream real-time data, AI-fed analysis, and interactive charts on SpiralCoin.` |
| OG title | `SpiralCoin \| Live Trading Platform` |
| OG description | Same as meta description |
| OG image | Upload `spiralcoin_logo.png` |
| Canonical URL | `https://www.spiralcoin.net/` |
| Robots | `index, follow` |

---

## Pre-Publish Checklist

- [ ] Logo displayed correctly in nav and hero
- [ ] Hero H1 matches Version B copy exactly
- [ ] Primary CTA "Start Live Demo" visible above fold on mobile (375px viewport)
- [ ] Chart section loads (test with custom HTML embed)
- [ ] Disclaimer visible near conversion sections
- [ ] No guaranteed returns language anywhere
- [ ] All FAQ items expand/collapse
- [ ] Final CTA section present
- [ ] Domain set to `www.spiralcoin.net` (not default IONOS subdomain)
- [ ] SSL / HTTPS active
- [ ] Upload `robots.txt` to site root (IONOS → Files or FTP)
- [ ] Upload `sitemap.xml` to site root; submit URL in Google Search Console
- [ ] Test on mobile (iPhone SE / 375px)
- [ ] Test on desktop (1280px+)
- [ ] UTM parameters pass through to demo CTA links
- [ ] Publish and verify at [https://www.spiralcoin.net](https://www.spiralcoin.net)

---

## A/B Test Launch Checklist (after publish)

Refer to `SpiralCoin_AB_Test_Plan.md` for full framework.

- [ ] Version A (current balanced copy) preserved at separate URL or tracked separately
- [ ] Version B (`data-variant="B"`) live at primary URL
- [ ] UTM tracking active on all paid campaign traffic
- [ ] CTA click events firing (`hero_start_demo`, `final_start_demo`)
- [ ] Scroll depth events configured
- [ ] 14-day minimum run before assessing winner
- [ ] Stop rule: directional stability across 3 consecutive days

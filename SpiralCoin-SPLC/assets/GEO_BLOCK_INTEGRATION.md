# US Geo-Block Integration Snippet

Drop this into the `<head>` and `<body>` of any page that offers the public
presale (e.g. `signup.html`, `splc.html`, `spiralcoin_ads_landing.html`).

## In `<head>`

```html
<link rel="stylesheet" href="/assets/geo-block.css">
```

## Just before `</body>`

```html
<!-- ── SpiralCoin geo-block + affirmation ────────────────────── -->
<div id="splc-geo-block" hidden>
  <div class="splc-geo-modal">
    <h2>Not available in your region</h2>
    <p id="splc-geo-msg"></p>
    <p>If you are a U.S. accredited investor, our Reg D 506(c) tranche is open by application.</p>
    <a href="/regd.html" id="splc-regd-link" hidden>Apply via Reg D →</a>
  </div>
</div>

<div id="splc-affirm" hidden>
  <div class="splc-affirm-modal">
    <h2>Eligibility Confirmation</h2>
    <p>Before continuing, please confirm one of the following:</p>
    <label><input type="radio" name="splc-aff" value="non-us"> I am NOT a U.S. person.</label>
    <label><input type="radio" name="splc-aff" value="accredited"> I am a U.S. accredited investor and have completed Reg D KYC.</label>
    <p><button id="splc-aff-confirm" disabled>Continue</button></p>
    <p style="font-size:.8rem;opacity:.7">
      <a href="https://www.sec.gov/education/capitalraising/building-blocks/accredited-investor"
         target="_blank" rel="noopener">What is an accredited investor?</a>
    </p>
    <p style="font-size:.75rem;opacity:.6;margin-top:1rem">
      Trading involves risk. Past performance does not guarantee future results.
    </p>
  </div>
</div>

<script src="/assets/geo-block.js"></script>
```

## Legal posture (NOT legal advice)

- Client-side blocking is one layer. Real Reg S / Reg D compliance requires:
  - Server-side IP geo-filtering at the CDN (Cloudflare WAF rule blocking `cf.country == "US"` on presale endpoints)
  - KYC + accreditation verification before any U.S. wallet can buy (use VerifyInvestor.com or Parallel Markets)
  - Smart-contract allowlist (`SPLCPresalePublic.allowRoot`) populated only with verified non-US or accredited US wallets
  - Recorded affirmation at sign-up time, retained per record-keeping rules
- Do not rely on this script alone. Engage a securities attorney before launch.

## Future hardening

- Replace `api.country.is` with a paid GeoIP DB (MaxMind GeoIP2) on the server side
- Add IP-reputation check (block known VPN/Tor exit nodes)
- Sign the affirmation with the user's wallet (`personal_sign`) so it's portable to the smart contract

/**
 * SpiralCoin US geo-block + accredited-investor affirmation gate.
 *
 * Behavior:
 *   1. On page load, fetch the visitor's country via a lightweight free API
 *      (api.country.is). Fallback: Cloudflare cdn-cgi/trace.
 *   2. If country === "US": show a hard block modal explaining that the
 *      public presale is unavailable to US persons, and pointing to the
 *      Reg D 506(c) accredited-investor path (separate flow).
 *   3. If country is unknown or non-US: still show a one-time affirmation
 *      asking the visitor to confirm "I am not a U.S. person" or "I am a
 *      U.S. accredited investor and have completed KYC/Reg D verification."
 *   4. Store the affirmation in localStorage so returning visitors don't
 *      see it again.
 *
 * Legal note: client-side geo-blocking is NOT sufficient compliance on its
 * own. It is one layer in a defense-in-depth stack. The Reg D path must
 * still verify accreditation independently (e.g. VerifyInvestor.com).
 *
 * Markup expected on the page (hidden until JS shows it):
 *
 *   <div id="splc-geo-block" hidden>
 *     <div class="splc-geo-modal">
 *       <h2>Not available in your region</h2>
 *       <p id="splc-geo-msg"></p>
 *       <a href="/regd.html" id="splc-regd-link" hidden>Accredited US investor? Apply via Reg D →</a>
 *     </div>
 *   </div>
 *
 *   <div id="splc-affirm" hidden>
 *     <div class="splc-affirm-modal">
 *       <h2>Eligibility Confirmation</h2>
 *       <p>By proceeding you confirm one of the following:</p>
 *       <label><input type="radio" name="splc-aff" value="non-us"> I am NOT a U.S. person.</label><br/>
 *       <label><input type="radio" name="splc-aff" value="accredited"> I am a U.S. accredited investor and have completed Reg D KYC.</label>
 *       <p><button id="splc-aff-confirm" disabled>Continue</button></p>
 *       <p><a href="https://www.sec.gov/education/capitalraising/building-blocks/accredited-investor" target="_blank" rel="noopener">What is an accredited investor?</a></p>
 *     </div>
 *   </div>
 *
 * Trading involves risk. Past performance does not guarantee future results.
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'splc_affirmation_v1';
    var US_BLOCKED_KEY = 'splc_us_blocked_v1';

    function showBlock(country) {
        var el = document.getElementById('splc-geo-block');
        if (!el) return;
        var msg = document.getElementById('splc-geo-msg');
        if (msg) {
            msg.textContent =
                'Due to U.S. securities regulations, the SpiralCoin public token sale ' +
                'is not available to U.S. persons. (Detected region: ' + country + ')';
        }
        var regd = document.getElementById('splc-regd-link');
        if (regd) regd.hidden = false;
        el.hidden = false;
        // freeze background scroll
        document.body.style.overflow = 'hidden';
        try { localStorage.setItem(US_BLOCKED_KEY, '1'); } catch (e) {}
    }

    function showAffirm() {
        var el = document.getElementById('splc-affirm');
        if (!el) return;
        el.hidden = false;
        document.body.style.overflow = 'hidden';

        var radios = document.querySelectorAll('input[name="splc-aff"]');
        var btn = document.getElementById('splc-aff-confirm');
        radios.forEach(function (r) {
            r.addEventListener('change', function () { btn.disabled = false; });
        });
        if (btn) {
            btn.addEventListener('click', function () {
                var picked = document.querySelector('input[name="splc-aff"]:checked');
                if (!picked) return;
                try { localStorage.setItem(STORAGE_KEY, picked.value + '|' + Date.now()); } catch (e) {}
                el.hidden = true;
                document.body.style.overflow = '';
            });
        }
    }

    function fetchCountry() {
        // Primary: api.country.is (lightweight, CORS-friendly)
        return fetch('https://api.country.is/', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { return j && j.country ? j.country : null; })
            .catch(function () { return null; })
            .then(function (cc) {
                if (cc) return cc;
                // Fallback: Cloudflare trace (works only if site is fronted by CF)
                return fetch('/cdn-cgi/trace', { cache: 'no-store' })
                    .then(function (r) { return r.ok ? r.text() : ''; })
                    .then(function (txt) {
                        var m = /loc=([A-Z]{2})/.exec(txt || '');
                        return m ? m[1] : null;
                    })
                    .catch(function () { return null; });
            });
    }

    function init() {
        // If already affirmed previously, skip
        try {
            if (localStorage.getItem(STORAGE_KEY)) return;
            if (localStorage.getItem(US_BLOCKED_KEY)) {
                // re-block if a US visitor returns, even if we can't reach API
                showBlock('US (cached)');
                return;
            }
        } catch (e) {}

        fetchCountry().then(function (country) {
            if (country === 'US') {
                showBlock('US');
            } else {
                // Always show affirmation gate for non-US (we can't fully trust geo API)
                showAffirm();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/**
 * SpiralCoin state-level geofence (DORMANT BY DEFAULT).
 *
 * This script supplements assets/geo-block.js with US-state-level granularity
 * for the post-MTL phase. It is OFF until you explicitly opt in by setting
 *
 *     window.SPLC_GEO_MODE = 'allowlist';
 *
 * on the page BEFORE this script loads. Until then it is a no-op and
 * assets/geo-block.js remains the only enforcement layer (blocks all US).
 *
 * Activation prerequisites (see funding/geofence-list.json → activation_checklist):
 *   1. FinCEN MSB number received
 *   2. State MTL granted (or partner-MSB coverage) for every state you allow
 *   3. KYC vendor live
 *   4. AML program documented
 *   5. Securities attorney memo confirming token sale structure
 *
 * Behavior when activated:
 *   - Loads /funding/geofence-list.json
 *   - Detects visitor country + (for US) state via free IP API
 *   - If country is in always_blocked: hard block
 *   - If country === 'US' AND state NOT in approved set: hard block, point to Reg D
 *   - If country === 'US' AND state IS in approved set: allow (still surfaces affirmation)
 *   - If country is in allowed_phase1: allow
 *   - Otherwise: show "not yet available in your region" soft block
 *
 * Legal note: client-side geo enforcement is one defense layer; do not rely on
 * it alone. Server-side IP check + KYC vendor address verification are required
 * for actual compliance.
 */
(function () {
  'use strict';

  // OFF by default. Opt in by setting window.SPLC_GEO_MODE = 'allowlist'.
  if (typeof window === 'undefined') return;
  if (window.SPLC_GEO_MODE !== 'allowlist') return;

  // Approved US states (mirror funding/geofence-list.json tier1 + whichever
  // tier2 you actually hold MTLs for). Edit this list as licenses come online.
  var APPROVED_US_STATES = (window.SPLC_APPROVED_STATES || ['WY']);

  var GEOFENCE_URL = '/funding/geofence-list.json';

  function blockHard(message) {
    var modal = document.getElementById('splc-geo-block');
    var msg = document.getElementById('splc-geo-msg');
    var regd = document.getElementById('splc-regd-link');
    if (msg) msg.textContent = message;
    if (regd) regd.hidden = false;
    if (modal) modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function fetchLoc() {
    return fetch('https://api.country.is', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return { country: (j && j.country) || null, region: null }; })
      .catch(function () {
        return fetch('https://cdn-cgi/trace').then(function (r) { return r.text(); })
          .then(function (t) {
            var m = /loc=([A-Z]{2})/.exec(t || '');
            return { country: m ? m[1] : null, region: null };
          })
          .catch(function () { return { country: null, region: null }; });
      });
  }

  function fetchUSRegion() {
    return fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.region_code) || null; })
      .catch(function () { return null; });
  }

  function run() {
    fetch(GEOFENCE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        var blocked = (cfg && cfg.international && cfg.international.always_blocked) || [];
        var allowed = (cfg && cfg.international && cfg.international.allowed_phase1) || [];

        fetchLoc().then(function (loc) {
          var c = loc.country;
          if (!c) {
            blockHard('We could not verify your region. Please contact support if you believe this is an error.');
            return;
          }
          if (blocked.indexOf(c) !== -1 && c !== 'US') {
            blockHard('SpiralCoin is not available in your region (' + c + ') under current sanctions and compliance rules.');
            return;
          }
          if (c === 'US') {
            fetchUSRegion().then(function (st) {
              if (!st) {
                blockHard('We could not verify your US state. Please contact support.');
                return;
              }
              if (APPROVED_US_STATES.indexOf(st) === -1) {
                blockHard('SpiralCoin is not yet licensed in ' + st + '. Currently available in: ' + APPROVED_US_STATES.join(', ') + '. If you are an accredited investor, our Reg D 506(c) tranche is open.');
                return;
              }
              // Approved state — let geo-block.js's affirmation step handle the rest
            });
            return;
          }
          if (allowed.indexOf(c) === -1) {
            blockHard('SpiralCoin is not yet available in your region (' + c + '). Sign up for our waitlist for updates.');
          }
        });
      })
      .catch(function (e) {
        // If config can't load, fail closed.
        blockHard('Geofence configuration unavailable. Please try again later.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

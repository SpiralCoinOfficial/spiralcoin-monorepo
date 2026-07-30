/*!
 * SpiralCoin — Google Ads conversion config
 * -----------------------------------------------------------------------------
 * Edit the two strings below ONCE, after you create the conversion action in
 * Google Ads:
 *   1. Sign in to https://ads.google.com
 *   2. Tools & Settings → Conversions → + New conversion action → Website
 *   3. Choose your category (e.g. "Sign-up" or "Lead") and value settings
 *   4. Click "Use Google tag" → copy the "Send to" string, which looks like:
 *        AW-1234567890/AbCdEfGhIjKlMnOp
 *      ─ everything before the "/" is AW_ID
 *      ─ everything after  the "/" is AW_LABEL
 *
 * Leaving these as empty strings is safe — the tracker silently no-ops until
 * configured (GA4 events still fire either way).
 *
 * Load order in every HTML page that needs Ads conversion tracking:
 *   <script src="/assets/js/ads-config.js"></script>
 *   <script src="/assets/js/ga-events.js" defer></script>
 *
 * Then on any CTA element/form, add data-ga-conversion:
 *   <a href="/signup.html" data-ga-event="cta_click" data-ga-label="hero"
 *      data-ga-conversion>Start Demo</a>
 * =============================================================================
 */
(function () {
  window.SPLC_ADS_CONFIG = {
    AW_ID:    '',   // e.g. 'AW-1234567890'
    AW_LABEL: ''    // e.g. 'AbCdEfGhIjKlMnOp'
  };
})();

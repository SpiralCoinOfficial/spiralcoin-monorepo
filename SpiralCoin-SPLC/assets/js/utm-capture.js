/*!
 * SpiralCoin — UTM capture & attribution
 *
 * - Captures ?utm_source / utm_medium / utm_campaign / utm_term / utm_content
 *   plus gclid (Google Ads click ID) and msclkid (Microsoft Ads) on landing.
 * - Persists them in localStorage for 30 days so signup attribution survives
 *   navigation across the multi-page site.
 * - Forwards them to GA4 as a custom event (utm_landing) and registers them
 *   on the gtag config so they're attached to subsequent events.
 *
 * Load AFTER the gtag <script> in the page <head>:
 *   <script src="/assets/js/utm-capture.js?v=20260528a" defer></script>
 *
 * To read in your signup handler:
 *   const attrib = JSON.parse(localStorage.getItem('splc_attribution') || '{}');
 *   // send `attrib` along with the form payload.
 */
(function () {
  'use strict';

  var KEY = 'splc_attribution';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  function readParams() {
    try {
      var p = new URLSearchParams(window.location.search);
      var keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','msclkid','ref'];
      var found = {};
      var any = false;
      keys.forEach(function (k) {
        var v = p.get(k);
        if (v) { found[k] = v; any = true; }
      });
      return any ? found : null;
    } catch (_) { return null; }
  }

  function loadStored() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.savedAt || (Date.now() - obj.savedAt) > TTL_MS) return null;
      return obj;
    } catch (_) { return null; }
  }

  function save(record) {
    try {
      record.savedAt = Date.now();
      record.landing_path = record.landing_path || window.location.pathname;
      record.landing_referrer = record.landing_referrer || document.referrer || '';
      localStorage.setItem(KEY, JSON.stringify(record));
    } catch (_) {}
  }

  function pushToGA(record) {
    if (typeof window.gtag !== 'function') return;
    try {
      // Re-configure GA4 with traffic-type hints so future events inherit them.
      window.gtag('set', 'user_properties', {
        last_utm_source: record.utm_source || '(none)',
        last_utm_medium: record.utm_medium || '(none)',
        last_utm_campaign: record.utm_campaign || '(none)',
      });
      window.gtag('event', 'utm_landing', {
        utm_source: record.utm_source,
        utm_medium: record.utm_medium,
        utm_campaign: record.utm_campaign,
        utm_term: record.utm_term,
        utm_content: record.utm_content,
        gclid: record.gclid,
        msclkid: record.msclkid,
        landing_path: record.landing_path,
        landing_referrer: record.landing_referrer,
      });
    } catch (_) {}
  }

  var fresh = readParams();
  if (fresh) {
    save(fresh);
    pushToGA(fresh);
  }

  // Expose
  window.splcAttribution = function () { return loadStored() || readParams() || {}; };
})();

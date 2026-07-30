/*!
 * SpiralCoin — GA4 event helper
 * Auto-tracks user interactions for GA4 (G-MEMH1LPSD4) + Google Ads.
 *
 * USAGE — declarative (no JS needed in templates):
 *   <a href="/signup.html" data-ga-event="cta_click" data-ga-label="hero_signup">Sign up</a>
 *   <button data-ga-event="cta_click" data-ga-label="open_demo">Open demo</button>
 *   <form data-ga-form="signup_submit" data-ga-conversion>...</form>
 *
 * data-ga-event       -> GA4 event name (snake_case)
 * data-ga-label       -> custom label (becomes event_label)
 * data-ga-value       -> numeric value (becomes value)
 * data-ga-form        -> fires when form submits successfully (no validation errors)
 * data-ga-conversion  -> ALSO fires Google Ads conversion (requires AW_ID + AW_LABEL below)
 *
 * Manual API:
 *   window.splcTrack('event_name', {label:'foo', value:10});
 *   window.splcTrackConversion();
 */
(function () {
  'use strict';

  // ===== Google Ads conversion settings =====
  // Configured via /assets/js/ads-config.js — load it BEFORE this file.
  // Falls back to empty strings (silent no-op) if ads-config.js is missing.
  var _cfg = (typeof window.SPLC_ADS_CONFIG === 'object' && window.SPLC_ADS_CONFIG) || {};
  var AW_ID    = _cfg.AW_ID    || '';   // e.g. 'AW-1234567890'
  var AW_LABEL = _cfg.AW_LABEL || '';   // e.g. 'AbCdEfGhIjKlMnOp'
  // ==========================================

  function gtagReady() {
    return typeof window.gtag === 'function';
  }

  function track(name, params) {
    if (!gtagReady() || !name) return;
    try { window.gtag('event', name, params || {}); } catch (e) {}
  }

  function trackConversion(extra) {
    if (!gtagReady()) return;
    if (!AW_ID || !AW_LABEL) {
      // Silent no-op until publisher configures Ads.
      if (window.console && console.debug) console.debug('[splc-ga] Ads conversion skipped: AW_ID/AW_LABEL unset');
      return;
    }
    try {
      window.gtag('event', 'conversion', Object.assign({
        send_to: AW_ID + '/' + AW_LABEL
      }, extra || {}));
    } catch (e) {}
  }

  // Ensure Google Ads gtag is registered alongside GA4
  function ensureAdsRegistered() {
    if (!AW_ID || !gtagReady()) return;
    if (window.__splcAdsRegistered) return;
    try { window.gtag('config', AW_ID); window.__splcAdsRegistered = true; } catch (e) {}
  }

  function paramsFrom(el) {
    var p = {};
    var label = el.getAttribute('data-ga-label');
    var value = el.getAttribute('data-ga-value');
    if (label) p.event_label = label;
    if (value && !isNaN(parseFloat(value))) p.value = parseFloat(value);
    if (el.id) p.element_id = el.id;
    if (el.href) p.link_url = el.href;
    return p;
  }

  function onClick(e) {
    var el = e.target.closest('[data-ga-event]');
    if (!el) return;
    var name = el.getAttribute('data-ga-event');
    track(name, paramsFrom(el));
    if (el.hasAttribute('data-ga-conversion')) trackConversion();
  }

  function onSubmit(e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('form[data-ga-form]')) return;
    var name = form.getAttribute('data-ga-form');
    track(name, paramsFrom(form));
    if (form.hasAttribute('data-ga-conversion')) trackConversion();
  }

  function trackOutboundLinks(e) {
    var a = e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-ga-event')) return; // already handled
    var href = a.getAttribute('href');
    if (!href || href[0] === '#') return;
    try {
      var u = new URL(href, window.location.href);
      if (u.host && u.host !== window.location.host) {
        track('outbound_click', { event_label: u.host, link_url: u.href });
      }
    } catch (_) {}
  }

  // Wire up after DOM is ready
  function init() {
    ensureAdsRegistered();
    document.addEventListener('click', onClick, true);
    document.addEventListener('click', trackOutboundLinks, true);
    document.addEventListener('submit', onSubmit, true);

    // Fire a "page_ready" event so you can verify in GA4 Realtime.
    track('page_ready', { page_path: location.pathname });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API
  window.splcTrack = track;
  window.splcTrackConversion = trackConversion;
})();

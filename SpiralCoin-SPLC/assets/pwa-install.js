/* SpiralCoin PWA install — captures beforeinstallprompt and wires it
   to every element with class .splc-install-btn. Falls back to opening
   /app/ on browsers that don't support PWA install (iOS Safari, etc.). */
(function () {
  'use strict';
  if (window.__SPLC_PWA_INSTALL__) return;
  window.__SPLC_PWA_INSTALL__ = true;

  var deferred = null;

  // Register the service worker (required for installability)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(function (err) {
          console.warn('[SpiralCoin] sw register failed:', err);
        });
    });
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
  }

  function setState(installed) {
    var btns = document.querySelectorAll('.splc-install-btn');
    btns.forEach(function (b) {
      if (installed) {
        b.textContent = '✓ App Installed';
        b.setAttribute('disabled', 'disabled');
        b.style.opacity = '0.7';
        b.style.cursor = 'default';
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    setState(true);
  });

  function handleClick(e) {
    var btn = e.currentTarget;
    if (deferred) {
      e.preventDefault();
      deferred.prompt();
      deferred.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          setState(true);
        }
        deferred = null;
      });
      return;
    }
    // Fallback: no install prompt available (iOS, already installed,
    // or unsupported browser). Open the web app instead.
    if (isStandalone()) {
      // Already running as installed app — just route into the app shell.
      e.preventDefault();
      window.location.href = '/app/';
    }
    // Otherwise let the link's default href="/app/" navigate normally.
  }

  function wire() {
    var btns = document.querySelectorAll('.splc-install-btn');
    btns.forEach(function (b) {
      if (b.__splcWired) return;
      b.__splcWired = true;
      b.addEventListener('click', handleClick);
    });
    if (isStandalone()) setState(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();

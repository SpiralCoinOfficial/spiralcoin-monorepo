/* ==========================================================================
 * SpiralCoin — auth guard
 * --------------------------------------------------------------------------
 * Drop this script into any page that requires a logged-in user. It waits
 * for the Auth0 client (assets/js/auth0-client.js) to initialize, then
 * either: (a) lets the page render normally if authenticated, or
 *         (b) redirects to /login.html?next=<current-path>.
 *
 * Usage in HTML:
 *   <script src="/assets/js/auth0-client.js?v=20260528a"></script>
 *   <script src="/assets/js/auth-guard.js?v=20260528a"></script>
 *
 * To avoid a flash-of-protected-content, this script hides <main>/<body>
 * until the auth check resolves.
 * ========================================================================== */
(() => {
  // Hide body immediately (FOPC prevention). Restored after auth check.
  const styleEl = document.createElement('style');
  styleEl.id = 'splc-auth-guard-style';
  styleEl.textContent = 'body{visibility:hidden!important}';
  document.head.appendChild(styleEl);

  const reveal = () => {
    const s = document.getElementById('splc-auth-guard-style');
    if (s) s.remove();
  };

  const redirectToLogin = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace('/login.html?next=' + next);
  };

  const check = async () => {
    // Wait up to 8s for SPLCAuth to appear
    const start = Date.now();
    while (!window.SPLCAuth && Date.now() - start < 8000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!window.SPLCAuth) { reveal(); return; } // fail-open if SDK missing

    try {
      const ok = await window.SPLCAuth.isAuthenticated();
      if (ok) {
        reveal();
      } else {
        redirectToLogin();
      }
    } catch (e) {
      redirectToLogin();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
})();

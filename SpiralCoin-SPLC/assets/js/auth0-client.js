/* ============================================================================
 * SpiralCoin Auth0 client (vanilla JS, no build step)
 * ----------------------------------------------------------------------------
 *  - Singleton @auth0/auth0-spa-js v2 instance
 *  - Auto-wires #loginBtn / #signupBtn / #logoutBtn if present in the page
 *  - Swaps nav UI between logged-out / logged-in state
 *  - Stores intended destination across the redirect round-trip
 *  - Exposes window.SPLCAuth.{login,signup,logout,getUser,getToken,isAuthenticated}
 *  - On protected pages, add: <script>SPLCAuth.require();</script> AFTER this file
 *
 * Config (Domain + Client ID) are PUBLIC SPA credentials — safe to commit.
 * Secret-bearing flows (Management API, GitHub OAuth client secret) live
 * server-side, never here.
 * ========================================================================== */
(() => {
  const CONFIG = {
    domain:   'dev-t6gnxzv48a8g4ny3.us.auth0.com',
    clientId: 'hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB',
    // audience: 'https://api.spiralcoin.net',   // uncomment after creating an Auth0 API
    authorizationParams: {
      redirect_uri: window.location.origin + '/callback.html',
      scope: 'openid profile email',
    },
    cacheLocation: 'localstorage',          // survives full reloads
    useRefreshTokens: true,                  // silent renewal w/o iframe
  };

  let _clientPromise = null;
  const getClient = () => {
    if (_clientPromise) return _clientPromise;
    _clientPromise = (async () => {
      // wait for the SDK <script> to finish loading
      if (typeof auth0 === 'undefined') {
        await new Promise((r) => {
          const i = setInterval(() => { if (typeof auth0 !== 'undefined') { clearInterval(i); r(); } }, 50);
        });
      }
      return auth0.createAuth0Client({
        domain: CONFIG.domain,
        clientId: CONFIG.clientId,
        authorizationParams: CONFIG.authorizationParams,
        cacheLocation: CONFIG.cacheLocation,
        useRefreshTokens: CONFIG.useRefreshTokens,
      });
    })();
    return _clientPromise;
  };

  // --- public helpers ----------------------------------------------------
  const login = async (opts = {}) => {
    const client = await getClient();
    sessionStorage.setItem('splc_post_login', window.location.href);
    await client.loginWithRedirect({ authorizationParams: opts });
  };
  const signup = () => login({ screen_hint: 'signup' });
  const loginWithGithub = () => login({ connection: 'github' });
  const logout = async () => {
    const client = await getClient();
    await client.logout({ logoutParams: { returnTo: window.location.origin } });
  };
  const isAuthenticated = async () => (await getClient()).isAuthenticated();
  const getUser   = async () => (await getClient()).getUser();
  const getToken  = async () => (await getClient()).getTokenSilently();
  const require_  = async (redirectTo = '/login.html') => {
    if (!(await isAuthenticated())) {
      sessionStorage.setItem('splc_post_login', window.location.href);
      window.location.href = redirectTo;
    }
  };

  // --- nav auto-wiring ----------------------------------------------------
  const wireNav = async () => {
    const loginBtn  = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (loginBtn)  loginBtn.addEventListener('click',  (e) => { e.preventDefault(); login(); });
    if (signupBtn) signupBtn.addEventListener('click', (e) => { e.preventDefault(); signup(); });
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    try {
      if (await isAuthenticated()) {
        const user = await getUser();
        // Replace login/signup with a small user chip + logout
        if (loginBtn && signupBtn) {
          const navActions = loginBtn.parentElement;
          const displayName = (user.given_name || user.name || user.email || '').split('@')[0];
          navActions.innerHTML = `
            <span class="splc-user-chip" style="display:inline-flex;align-items:center;gap:8px;color:var(--gold);font-weight:600">
              <img src="${user.picture || '/brand/splc-logo-64.png'}" alt="" width="28" height="28" style="border-radius:50%;border:1px solid var(--gold)"/>
              ${displayName}
            </span>
            <button class="btn btn-ghost" id="logoutBtn">Log Out</button>`;
          document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
        }
        // Fire GA event for analytics
        if (typeof gtag === 'function') gtag('event', 'login_session_active', { method: user.sub ? user.sub.split('|')[0] : 'unknown' });
      }
    } catch (err) { console.warn('[SPLCAuth] nav wiring:', err); }
  };

  // --- export -------------------------------------------------------------
  window.SPLCAuth = { login, signup, loginWithGithub, logout, isAuthenticated, getUser, getToken, require: require_ };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireNav);
  } else {
    wireNav();
  }
})();

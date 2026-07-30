/* ============================================================================
 * SpiralCoin Wallet Binding (MetaMask + SIWE → Auth0 user_metadata)
 * ----------------------------------------------------------------------------
 *  - Adds a "Connect Wallet" button to nav-actions when user is logged in
 *  - On click:  request MetaMask account → build SIWE message →
 *               personal_sign → POST to /api/bind-wallet.php
 *  - Persists  splc_wallet_address  in localStorage for instant nav re-render
 *  - Exposes   window.SPLCWallet.{connect, disconnect, getAddress}
 *
 *  Requires:   auth0-client.js loaded BEFORE this file
 *              window.ethereum injected (MetaMask / Brave / Coinbase Wallet)
 *
 *  The PHP endpoint verifies the Auth0 ID token (proving WHO the user is)
 *  and stores the wallet address. Full server-side ECDSA recovery of the
 *  signed SIWE message is performed in api/bind-wallet.php using the
 *  bundled pure-PHP secp256k1 ecrecover (no native deps, IONOS-safe).
 * ========================================================================== */
(() => {
  const LS_KEY  = 'splc_wallet_address';
  const ENDPOINT = '/api/bind-wallet.php';
  const CHAIN_ID = 42161; // Arbitrum One

  const short = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';

  // ---- SIWE message builder (EIP-4361 style, simple variant) ------------
  const buildSiweMessage = (address, nonce, auth0Sub) => {
    const domain = window.location.host;
    const uri    = window.location.origin;
    const now    = new Date().toISOString();
    return [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      ``,
      `Bind this wallet to your SpiralCoin account (${auth0Sub}).`,
      ``,
      `URI: ${uri}`,
      `Version: 1`,
      `Chain ID: ${CHAIN_ID}`,
      `Nonce: ${nonce}`,
      `Issued At: ${now}`,
    ].join('\n');
  };

  const randomNonce = () => {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Fetch a single-use server-issued nonce (replay protection).
  // Returns the hex nonce string, or throws.
  const fetchServerNonce = async (idToken) => {
    const res = await fetch('/api/wallet-nonce.php', {
      headers: { 'Authorization': `Bearer ${idToken}`, 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('nonce-issue failed: ' + res.status);
    const data = await res.json();
    if (!data.nonce) throw new Error('no nonce in response');
    return data.nonce;
  };

  // ---- Core flow --------------------------------------------------------
  const connect = async () => {
    if (!window.ethereum) {
      alert('No Ethereum wallet detected. Install MetaMask first: https://metamask.io/download/');
      return null;
    }
    if (!window.SPLCAuth || !(await SPLCAuth.isAuthenticated())) {
      alert('Please log in to SpiralCoin first, then connect your wallet.');
      if (window.SPLCAuth) SPLCAuth.login();
      return null;
    }

    let address, signature, message, idToken, user;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      address = accounts[0];
      user    = await SPLCAuth.getUser();
      // ID token includes the audience-bound JWT we need for server verification
      const claims = await (await getClient()).getIdTokenClaims();
      idToken = claims.__raw;

      // Server-issued single-use nonce (replay-safe)
      const nonce = await fetchServerNonce(idToken);
      message = buildSiweMessage(address, nonce, user.sub);
      signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });
    } catch (e) {
      console.error('[SPLCWallet] sign cancelled or failed:', e);
      if (e.code === 4001) alert('You rejected the signature. Wallet not bound.');
      return null;
    }

    // POST to backend for verification + storage
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ address, message, signature, chainId: CHAIN_ID }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[SPLCWallet] bind failed:', data);
        alert(`Wallet binding failed: ${data.error || res.statusText}`);
        return null;
      }
      localStorage.setItem(LS_KEY, address);
      renderChip(address);
      if (typeof gtag === 'function') gtag('event', 'wallet_bound', { method: 'metamask' });
      return address;
    } catch (e) {
      console.error('[SPLCWallet] network error:', e);
      alert('Could not reach the SpiralCoin server. Try again in a moment.');
      return null;
    }
  };

  const disconnect = () => {
    localStorage.removeItem(LS_KEY);
    renderChip(null);
  };

  const getAddress = () => localStorage.getItem(LS_KEY);

  // Reach into auth0-client.js's internal client for getIdTokenClaims()
  // (SPLCAuth doesn't expose the client directly to keep its API minimal)
  const getClient = () => auth0.createAuth0Client({
    domain: 'dev-t6gnxzv48a8g4ny3.us.auth0.com',
    clientId: 'hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB',
    authorizationParams: { redirect_uri: window.location.origin + '/callback.html' },
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  });

  // ---- Nav UI -----------------------------------------------------------
  const renderChip = (address) => {
    const nav = document.querySelector('.nav-actions');
    if (!nav) return;
    // Remove old wallet chip if present
    nav.querySelectorAll('.splc-wallet-chip, .splc-wallet-btn').forEach((el) => el.remove());

    if (address) {
      const chip = document.createElement('span');
      chip.className = 'splc-wallet-chip';
      chip.title = address;
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 12px;margin-left:8px;border:1px solid #d4af37;border-radius:999px;color:#d4af37;font-size:13px;font-weight:600;cursor:pointer';
      chip.innerHTML = `🦊 ${short(address)}`;
      chip.addEventListener('click', () => {
        if (confirm(`Disconnect wallet ${short(address)}?`)) disconnect();
      });
      nav.appendChild(chip);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost splc-wallet-btn';
      btn.style.cssText = 'margin-left:8px';
      btn.textContent = 'Connect Wallet';
      btn.addEventListener('click', (e) => { e.preventDefault(); connect(); });
      nav.appendChild(btn);
    }
  };

  // ---- Boot -------------------------------------------------------------
  const boot = async () => {
    // Wait briefly for SPLCAuth to be ready
    let tries = 0;
    while (!window.SPLCAuth && tries < 40) { await new Promise((r) => setTimeout(r, 50)); tries++; }
    if (!window.SPLCAuth) return;

    try {
      if (await SPLCAuth.isAuthenticated()) {
        const stored = getAddress();
        renderChip(stored);
      }
    } catch (e) { console.warn('[SPLCWallet] boot:', e); }

    // React to wallet account changes
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', (accts) => {
        if (!accts.length) disconnect();
        else if (getAddress() && accts[0].toLowerCase() !== getAddress().toLowerCase()) {
          // user switched account in MetaMask — drop binding, require re-bind
          disconnect();
        }
      });
    }
  };

  window.SPLCWallet = { connect, disconnect, getAddress };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

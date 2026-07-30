# Authentication

SpiralCoin uses **Auth0** as its identity provider with the SPA + PKCE flow.

## Tenant

| Field | Value |
|---|---|
| Tenant domain | `dev-t6gnxzv48a8g4ny3.us.auth0.com` |
| Application name | SpiralCoin SPA |
| Application type | Single Page Application |
| Client ID | `hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB` |
| Token endpoint auth | None (public client, PKCE) |
| Refresh tokens | Enabled, rotating |

## Allowed URLs (Auth0 dashboard → Applications → SpiralCoin SPA)

| Field | Values (comma-separated) |
|---|---|
| Allowed Callback URLs | `https://www.spiralcoin.net/callback.html, http://localhost:443/callback.html, http://localhost:8080/callback.html` |
| Allowed Logout URLs | `https://www.spiralcoin.net/, http://localhost:443/, http://localhost:8080/` |
| Allowed Web Origins | `https://www.spiralcoin.net, http://localhost:443, http://localhost:8080` |

## Social connections

| Provider | Status | Notes |
|---|---|---|
| Email / password | ✅ Default | Built-in Auth0 database connection |
| Google | ✅ Live | Configured via Auth0 default Google connection (dev keys ok for now) |
| GitHub | ⏸ Pending | Requires OAuth App in `SpiralCoinOfficial` org first |

### Creating the GitHub OAuth App (manual one-time)

1. Open <https://github.com/organizations/SpiralCoinOfficial/settings/applications/new>
2. Application name: **SpiralCoin SPLC** ("SpiralCoin" alone is reserved)
3. Homepage URL: `https://www.spiralcoin.net`
4. Authorization callback URL: `https://dev-t6gnxzv48a8g4ny3.us.auth0.com/login/callback`
5. Register → copy Client ID + generate Client Secret
6. Auth0 dashboard → Authentication → Social → GitHub → paste credentials → enable

## Client-side integration

The SDK and helpers live in:

- [assets/js/auth0-client.js](../assets/js/auth0-client.js) — singleton wrapper exposing `window.SPLCAuth`
- [callback.html](../callback.html) — handles the `?code=&state=` redirect
- [login.html](../login.html) — branded entry point
- [assets/js/auth-guard.js](../assets/js/auth-guard.js) — page-level guard for protected routes

### Public API: `window.SPLCAuth`

```js
SPLCAuth.login()              // Universal Login (email or social chooser)
SPLCAuth.signup()             // Same, screen_hint=signup
SPLCAuth.loginWithGithub()    // Direct GitHub connection
SPLCAuth.logout()             // Clears local + Auth0 session
SPLCAuth.getUser()            // → Promise<UserProfile | undefined>
SPLCAuth.getToken()           // → Promise<accessToken>
SPLCAuth.isAuthenticated()    // → Promise<boolean>
SPLCAuth.require(redirectTo)  // Redirect to login if not authed
```

## Pages that require authentication

These pages include `auth-guard.js` and redirect to `/login.html?next=<path>`
if the user is not authenticated:

- `/account.html`
- `/dashboard.html`
- `/portfolio.html`
- `/settings.html`
- `/trade.html`
- `/trade-confirm.html`
- `/watchlist.html`

## Server-side JWT verification

Backend endpoints that need a verified user identity (currently
`/api/bind-wallet.php`) expect:

```
Authorization: Bearer <Auth0 ID token>
```

The PHP code:

1. Splits the JWT, decodes the header, looks up `kid`
2. Fetches Auth0 JWKS (cached for 24 h in `private/auth0-jwks.cache.json`)
3. Reconstructs the RSA public key in PEM via raw ASN.1 (no Composer)
4. `openssl_verify($signingInput, $sigBin, $pem, OPENSSL_ALGO_SHA256)`
5. Validates `iss`, `aud`, `exp`, `iat`

No third-party JWT library required. See [Security](Security.md#jwt-verification).

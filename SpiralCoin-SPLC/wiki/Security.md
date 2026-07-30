# Security

## Threat model

| Asset | Threat | Mitigation |
|---|---|---|
| User identity | Account takeover | Auth0 SSO + MFA available + rotating refresh tokens |
| Wallet binding | Spoofed address claim | SIWE signature stored for ECDSA re-verify; binding is non-value-bearing |
| Sponsor webhook | Forged sponsor events | HMAC-SHA256 with constant-time compare, 1 MB size guard |
| Private files | Web disclosure | `/private/.htaccess` `Require all denied` + outside doc-root layout |
| Secrets in git | Accidental commit | `.gitignore` + pre-deploy exclude_list + repo scanning |
| XSS | Injected scripts | CSP via root `.htaccess`, no `innerHTML` of user data without `esc()` |
| CSRF | Cross-origin POST | Same-origin auth header (`Bearer`) on state-changing endpoints |
| Clickjacking | iframe embed | `X-Frame-Options: DENY` via Apache header |
| MITM | Plaintext intercept | HSTS via Apache header, HTTPS redirect, TLS via Let's Encrypt |

## Security headers (root `.htaccess`)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: <see .htaccess for full policy>
```

## JWT verification

`api/bind-wallet.php` performs full RS256 verification without Composer:

1. Split JWT, base64url-decode header + payload
2. Look up `kid` in cached JWKS (`private/auth0-jwks.cache.json`, 24 h TTL)
3. If miss, fetch `https://<tenant>/.well-known/jwks.json` with 5 s timeout
4. Reconstruct RSA public key in raw ASN.1 → PEM
5. `openssl_verify($input, $sig, $pem, OPENSSL_ALGO_SHA256)` → expects `1`
6. Validate `iss`, `aud`, `exp`, `iat`

This avoids any third-party JWT lib (and the supply-chain risk that comes
with one).

## HMAC verification

`api/sponsor-webhook.php`:

```php
$expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
if (!hash_equals($expected, $headerSig)) { http_response_code(401); exit; }
```

Body size capped at 1 MB before hash to bound resource use.

## SIWE validation

`api/bind-wallet.php` enforces (see [Wallet-Binding](Wallet-Binding.md#server-validation-apibind-walletphp)):

- Domain allow-list match
- `Chain ID: 42161`
- Address present in message
- 16+ hex char Nonce field
- `Issued At` parseable, within ±60 s future skew, < 10 min old

## File handling

- Atomic writes via `fopen('c+')` + `flock(LOCK_EX)` + `ftruncate` + `fwrite`
- All writable paths under `/private/` (denied to web)
- JWKS cache uses `LOCK_EX` on write to avoid torn reads under concurrency

## Known limitations

| Risk | Status |
|---|---|
| Server-side ECDSA recovery missing | Tracked. Trust = JWT-claimed address. No value-bearing feature relies on the binding. |
| Auth0 dev keys for Google connection | Auth0's shared Google OAuth client — rate-limited, fine for dev/launch. Migrate to project-owned Google OAuth before scaling beyond a few hundred users. |
| GitHub OAuth App not created | Pending. Until then, GitHub social login is disabled. |
| No WAF in front of IONOS | Shared hosting — no Cloudflare proxy. Consider adding Cloudflare in front of `www.spiralcoin.net` post-launch. |

## Vulnerability disclosure

Email `security@spiralcoin.net`. Please do not file public GitHub issues for
suspected vulnerabilities. We do not currently run a paid bug-bounty program;
acknowledged reports will receive credit on the wall of contributors.

## Secret rotation procedure

```powershell
# 1. Generate new 64-char hex
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$new = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

# 2. Write to local cache
$new | Out-File -Encoding utf8 -NoNewline "$HOME\.spiralcoin_sponsor_webhook_secret"

# 3. Update IONOS file via File Manager
# 4. Update GitHub Sponsors webhook secret field
# 5. Send a test ping from the webhook UI → expect 202
```

The Auth0 client secret is **not** used by the SPA flow (PKCE), so it doesn't
need rotation for the front-end build.

## CodeQL

JavaScript-only CodeQL scan runs on every push and PR. See
[.github/workflows/codeql.yml](../.github/workflows/codeql.yml).
PHP is not supported by CodeQL; consider adding `phpcs` + `phpstan` later.

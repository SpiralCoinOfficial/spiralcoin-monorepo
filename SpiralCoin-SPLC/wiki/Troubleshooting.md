# Troubleshooting

## Build / deploy

### CodeQL fails: "could not automatically build any of it" for C/C++

**Cause:** GitHub's default CodeQL setup auto-detected C/C++ but the repo
contains none.

**Fix:**

1. Open <https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-/settings/security_analysis>
2. CodeQL analysis → switch from **Default** to **Advanced** (or disable)
3. The committed [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) takes over and only scans JavaScript

### `code` CLI hangs / errors with `NODE_OPTIONS`

```powershell
Remove-Item Env:NODE_OPTIONS
# or
$env:NODE_OPTIONS=""
```

### Auth0 sample `npm run dev` fails: `start.cjs` path error on Windows

The sample's `tools/start.cjs` builds Unix paths and breaks on Windows.
Bypass:

```powershell
npx http-server -p 443 -a localhost -c-1 .
```

### IONOS SFTP authentication failed

Three or more failed attempts locks the account for ~15 min.

```powershell
# Wait 15 min, then reset password at:
Start-Process "https://login.ionos.com/"
# Hosting → SFTP/SSH access → Reset password
# Write new password without BOM:
[IO.File]::WriteAllText("$HOME\.ionos_sftp_pwd", "NEW_PASSWORD", [Text.UTF8Encoding]::new($false))
```

Then update the GitHub repo secret `IONOS_SFTP_PASSWORD` with the new value.

### WinSCP not found

It's not in PATH by default:

```powershell
& "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com" /script="_sftp_full_deploy.txt"
```

### `Set-Content` adds a BOM that breaks the password file

`Set-Content -Encoding utf8` writes a UTF-8 BOM. IONOS SFTP rejects it.

```powershell
# Correct way to write a no-BOM UTF-8 file
[IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
```

### `git push` reports "redirect notice"

The repo was renamed from `ionos-migration` to `SpiralCoin-SPLC-`. Fix:

```powershell
git remote set-url origin https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-.git
```

## PowerShell gotchas

- **No `&&`** — chain with `;` instead (PowerShell 5.1)
- **Em-dash (`—`) in strings** — PS 5.1 sometimes mangles it. Use `--` or backtick escape
- **No here-string `--`** — multi-line commit messages: use `git commit -m "line1" -m "line2"` or use a temp file

## Auth0

### Login redirects but stays on `/callback.html`

Check the browser console for the actual error. Common causes:

1. Callback URL not in Auth0 → Application → Allowed Callback URLs
2. `auth0-client.js` failed to load (CDN reachability)
3. State mismatch (cleared localStorage mid-flow) — retry login

### "Unknown client" or "Client not found"

The Client ID hardcoded in `assets/js/auth0-client.js` doesn't match your
tenant. Search-and-replace `hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB` and
`dev-t6gnxzv48a8g4ny3` repo-wide.

### Refresh-token rotation error

Auth0 sometimes refuses if the cached refresh token is older than max-age.
Workaround:

```js
SPLCAuth.logout(); // forces fresh Universal Login
```

## Wallet binding

### "No Ethereum wallet detected"

MetaMask (or compatible) extension isn't installed. Install:
<https://metamask.io/download/>

### "You rejected the signature" — but I didn't

MetaMask shows the signature popup behind the browser window if the tab
isn't focused. Click the MetaMask icon to surface it.

### Server returns 401 "JWT signature invalid"

The cached JWKS in `/private/auth0-jwks.cache.json` may be stale. Delete it
on the server; the next request re-fetches.

### Server returns 400 "SIWE message expired"

Client clock drift > 10 min. User should sync their OS time and retry. Or
relax the window in [`api/bind-wallet.php`](../api/bind-wallet.php) (search
`$issuedTs < time() - 600`).

## Sponsor webhook

### GitHub shows 401 on test delivery

Secret mismatch. Verify:

```bash
# On IONOS server (via File Manager view)
cat /private/sponsor-webhook-secret.txt
```

vs the value pasted in the GitHub webhook UI. They must match byte-for-byte
(no trailing newline, no BOM).

### 413 Payload Too Large

Payload exceeded 1 MB. Increase `MAX_BODY` constant in
[`api/sponsor-webhook.php`](../api/sponsor-webhook.php) if GitHub ever sends
a larger event.

### 500 "Secret missing"

`/private/sponsor-webhook-secret.txt` doesn't exist or PHP can't read it.
Check file permissions: should be `644`, owned by the PHP user.

## Site / Apache

### Mixed-content warnings

Hard-coded `http://` URL in the page. Search for `http://` in the repo and
switch to `https://` or protocol-relative `//`.

### Service worker serving stale pages

```js
// In DevTools console:
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
location.reload();
```

Then bump the `?v=YYYYMMDDx` query string on the offending script tag.

### CSP violations in the console

The CSP is defined in the root `.htaccess`. If you add a new third-party
script/style/font, add its origin to the appropriate `*-src` directive.

## Git

### `.gitignore` is ignored — file was already tracked

`.gitignore` only ignores **untracked** files. To untrack:

```powershell
git rm --cached path/to/file
git commit -m "stop tracking <file>"
```

### Accidentally committed a secret

```powershell
# 1. Rotate the secret immediately (don't wait)
# 2. Remove from history with git-filter-repo (NOT filter-branch):
pip install git-filter-repo
git filter-repo --invert-paths --path private/sponsor-webhook-secret.txt
git push --force origin main
# 3. Notify any collaborators to re-clone
```

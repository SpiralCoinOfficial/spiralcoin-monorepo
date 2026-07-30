# Deployment

There are **two** deploy paths. Prefer #1 once secrets are wired.

## 1. Automated — GitHub Actions → IONOS (recommended)

Every push to `main` triggers `.github/workflows/deploy-ionos.yml` which
uploads the site to IONOS webspace via SFTP.

### One-time secret setup

Open: <https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-/settings/secrets/actions>

Click **New repository secret** four times:

| Secret name | Value |
|---|---|
| `IONOS_SFTP_HOST` | `access-5020476011.webspace-host.com` |
| `IONOS_SFTP_USER` | `a2797960` |
| `IONOS_SFTP_PORT` | `22` |
| `IONOS_SFTP_PASSWORD` | *(your IONOS SFTP password — reset via <https://login.ionos.com/> if locked)* |

### Deploy trigger

- Automatic: `git push origin main`
- Manual: GitHub UI → Actions → **Deploy to IONOS** → **Run workflow**
- CLI: `gh workflow run deploy-ionos.yml`

### What gets deployed

Everything in the repo **except** the exclude list in the workflow file:

```yaml
exclude_list: |
  .git
  .github
  node_modules
  *.log
  _sftp_*.txt
  _*.ps1
  _*.js
  _*.json
  .ionos_sftp_pwd
  .spiralcoin_sponsor_webhook_secret
  private/sponsor-events.jsonl
  private/wallet-bindings.json
  private/sponsor-webhook-secret.txt
```

The exclude list also covers leftover scratch scripts (`_*.ps1`, `_*.js`,
`_sftp_*.txt`) so they never reach production.

### Files that must exist on the server but never in git

| Path | How to create |
|---|---|
| `/private/sponsor-webhook-secret.txt` | Paste 64-char hex via IONOS File Manager |
| `/private/.htaccess` | Auto-deployed (it's the only allow-listed file inside `/private/`) |
| `/private/wallet-bindings.json` | Auto-created on first wallet bind |
| `/private/sponsor-events.jsonl` | Auto-created on first webhook event |
| `/private/auth0-jwks.cache.json` | Auto-created on first JWT verify |

## 2. Manual — WinSCP (fallback)

The legacy SFTP script is still in the repo:
[`_sftp_full_deploy.txt`](../_sftp_full_deploy.txt).

### Run it

```powershell
# Password lives in a local-only file (gitignored)
$pwd = Get-Content "$HOME\.ionos_sftp_pwd" -Raw
& "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com" /parameter PWD=$pwd /script="_sftp_full_deploy.txt"
```

WinSCP is **not in PATH** by default — use the full path above.

### Known issues

- IONOS SFTP locks the account after 3+ failed password attempts. If you see
  "Authentication failed", wait 15 min or reset the password via the IONOS
  web panel.
- `Set-Content` adds a UTF-8 BOM that breaks IONOS's password parsing. Always
  write the password file with:

  ```powershell
  [IO.File]::WriteAllText("$HOME\.ionos_sftp_pwd", $pwd, [Text.UTF8Encoding]::new($false))
  ```

## Apache `.htaccess`

The root [`.htaccess`](../.htaccess) handles:

- HTTPS redirect
- WWW canonicalization
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Static asset caching
- SPA-style clean URLs for HTML pages

`/private/.htaccess` is one line:

```apache
Require all denied
```

## Smoke tests after deploy

```bash
# Should return JSON (empty sponsors array is fine pre-launch)
curl -s https://www.spiralcoin.net/api/sponsors-list.php | jq .

# Should return 405 (POST-only endpoint)
curl -s -o /dev/null -w "%{http_code}\n" https://www.spiralcoin.net/api/bind-wallet.php

# Should return 401 (signature missing)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: application/json" -d '{}' \
  https://www.spiralcoin.net/api/sponsor-webhook.php
```

## Rollback

```powershell
git revert HEAD --no-edit
git push origin main
```

GitHub Actions re-runs and the previous version uploads.

# Getting Started

## Prerequisites

- **Git** ≥ 2.40
- **PowerShell 5.1** (Windows) or Bash (macOS/Linux)
- A local web server for previewing PHP — recommended:
  - **XAMPP** (Windows): <https://www.apachefriends.org/>
  - **php -S** (built-in PHP dev server)
- **Node.js** ≥ 20 — only needed for the Auth0 quickstart sample, not for the main site
- An IONOS hosting account (for production deploys — or use GitHub Actions auto-deploy)

## Clone

```powershell
git clone https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-.git
cd SpiralCoin-SPLC-
```

## Local preview (static HTML only — no PHP)

```powershell
# Python 3
python -m http.server 8080
# or Node
npx http-server -p 8080 -c-1 .
```

Open <http://localhost:8080>. Auth0 login won't complete because the callback URL
`http://localhost:8080/callback.html` isn't in the Auth0 tenant allowed list.
Add it under Auth0 dashboard → Applications → SpiralCoin SPA → **Allowed
Callback URLs**, **Allowed Logout URLs**, **Allowed Web Origins**.

## Local preview with PHP endpoints

```powershell
# Requires PHP 8.x in PATH
php -S localhost:8080
```

Then create a local `private/` folder and a stub secret:

```powershell
New-Item -ItemType Directory -Force private | Out-Null
"localdev_secret_replace_me" | Out-File -Encoding utf8 -NoNewline private/sponsor-webhook-secret.txt
```

## First-time Auth0 setup

The SpiralCoin Auth0 tenant is **already configured**:

- Domain: `dev-t6gnxzv48a8g4ny3.us.auth0.com`
- SPA Client ID: `hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB`
- Google social: ✅ enabled
- GitHub social: ⏸ pending OAuth App creation

To use a different tenant, search the repo for `hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB`
and `dev-t6gnxzv48a8g4ny3` and replace both.

## Deploy to production

See [Deployment](Deployment.md). Short version:

1. Add 4 secrets to GitHub repo → Settings → Secrets and variables → Actions
2. `git push origin main`
3. GitHub Actions auto-uploads via SFTP

## Repo layout

```
.
├── *.html                       # Pages — one file per route
├── api/                         # PHP backend
├── assets/                      # JS, CSS, images
├── brand/                       # Logo variants
├── contracts/                   # Solidity (LP + lock contracts)
├── deploy/                      # Hardhat deploy scripts
├── funding/                     # Public sponsor / listing pack pages
├── private/                     # Runtime-writable, web-denied
├── investor-pack/               # Reg D materials (private)
├── indexer/                     # On-chain event indexer
├── .github/workflows/           # CI/CD
├── wiki/                        # This documentation
├── _sftp_full_deploy.txt        # WinSCP script (legacy — Actions is preferred)
└── README.md
```

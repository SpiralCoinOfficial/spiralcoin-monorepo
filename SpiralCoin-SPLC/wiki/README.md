# SpiralCoin Wiki — local copy

These markdown files mirror what should live in the GitHub Wiki tab.

## Two ways to use them

### Option A — keep them in-repo as docs (simplest)

They're already here. Read them on github.com via:
`https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-/tree/main/wiki`

### Option B — push to the GitHub Wiki backend

GitHub Wiki is a separate git repo at
`https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-.wiki.git`.
It requires the wiki tab to be enabled in repo Settings first, and at least
one page created via the web UI to initialize the backend repo. Then:

```bash
cd ..
git clone https://github.com/SpiralCoinOfficial/SpiralCoin-SPLC-.wiki.git
cp SpiralCoin-SPLC-/wiki/*.md SpiralCoin-SPLC-.wiki/
cd SpiralCoin-SPLC-.wiki
git add .
git commit -m "Import wiki from main repo"
git push origin master
```

GitHub Wiki uses `Home.md` as the landing page automatically.

## File index

| File | Topic |
|---|---|
| [Home.md](Home.md) | Landing page / navigation |
| [Overview.md](Overview.md) | What SpiralCoin is and isn't |
| [Architecture.md](Architecture.md) | System diagram + components |
| [Getting-Started.md](Getting-Started.md) | Local dev setup |
| [Authentication.md](Authentication.md) | Auth0 SSO + Google + GitHub |
| [Wallet-Binding.md](Wallet-Binding.md) | MetaMask + EIP-4361 SIWE flow |
| [Sponsors.md](Sponsors.md) | GitHub Sponsors program + webhook |
| [Deployment.md](Deployment.md) | IONOS + GitHub Actions |
| [API-Reference.md](API-Reference.md) | All PHP endpoints |
| [Security.md](Security.md) | Threat model + headers + JWT |
| [Compliance.md](Compliance.md) | Site copy rules + disclaimers |
| [Tokenomics.md](Tokenomics.md) | Planned SPLC design |
| [Roadmap.md](Roadmap.md) | Phase tracking |
| [Troubleshooting.md](Troubleshooting.md) | Common errors + fixes |

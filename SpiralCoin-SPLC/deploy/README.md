# Deploy SpiralCoin to the production droplet

Your IONOS plan is **MyWebsite Now** (drag-and-drop builder) — it cannot host arbitrary `.html` / `.php` files, so the real site lives on the DigitalOcean droplet at **`174.138.37.6`**.

Right now (May 2026) the droplet's nginx/firewall is not serving HTTP. Use this folder to fix that and ship the site.

---

## One-time droplet setup

```powershell
# from workspace root
scp deploy/bootstrap-droplet.sh root@174.138.37.6:/root/
ssh root@174.138.37.6 'bash /root/bootstrap-droplet.sh'
```

That installs **nginx + PHP-FPM + ufw + certbot**, opens ports 80/443, writes the nginx vhost for `spiralcoin.net` + `www.spiralcoin.net`, and creates `/var/www/spiralcoin`.

After it finishes, verify in a browser: **<http://174.138.37.6/>** — should show the "Droplet ready" placeholder.

---

## Upload the site

```powershell
.\deploy\upload-do.ps1
```

This uses your existing WinSCP install to SFTP the site:

- All top-level `.html` pages
- `assets/`, `app/`, `api/`, `indexer/`, `SPLC/`
- `robots.txt`, `sitemap.xml`, `.htaccess`

**Never uploaded:** `.env*`, `.git`, `node_modules`, `contracts/`, `deployments/`, `*.log`, `*.bak`, `*.bat`, `*.ps1`, `*.sql`, `*.md`, `live-config.example.js`.

Add `-DryRun` to preview without uploading.

---

## Repoint DNS at IONOS

In the IONOS Domain Center for `spiralcoin.net`, edit the **A records**:

| Host | Old | New |
| --- | --- | --- |
| `@` (apex) | `217.160.0.90` | `174.138.37.6` |
| `www` | `212.227.172.250` | `174.138.37.6` |

TTL: 3600. Propagation: 5–60 min.

---

## Enable HTTPS

Once DNS resolves to the droplet:

```bash
ssh root@174.138.37.6
certbot --nginx -d spiralcoin.net -d www.spiralcoin.net \
        -m trishadreyer@spiralcoin.net --agree-tos --redirect -n
```

Auto-renew is already wired by the certbot package (`systemctl status certbot.timer`).

---

## Day-to-day re-deploy

After any local edit, just:

```powershell
.\deploy\upload-do.ps1
```

`synchronize` only sends changed files.

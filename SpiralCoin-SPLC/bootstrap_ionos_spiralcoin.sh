#!/usr/bin/env bash
set -euo pipefail

# Bootstrap SpiralCoin host on IONOS (Ubuntu/Debian)
# Usage:
#   sudo bash bootstrap_ionos_spiralcoin.sh \
#     --domain spiralcoin.net \
#     --wallet 0x396157D2De70247dBc6895c5d835E46E6eB0BD22 \
#     --premine-wallet 0x3a1Dc8a78AE204C1EBAEe58699826f0b21c30D7F \
#     --premine-amount 900000000 \
#     --founder-wallet 0xa1766d57a3102763ED89e9a543E960B5243ef2EE \
#     --founder-amount 100000000 \
#     --token-address 0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C \
#     --chain arbitrum \
#     --web-root /var/www/spiralcoin.net/html \
#     --ssh-user deploy \
#     --ssh-pubkey "ssh-ed25519 AAAA... you@example"

DOMAIN="spiralcoin.net"
WALLET_ADDRS=()
WEB_ROOT="/var/www/spiralcoin.net/html"
SSH_USER="deploy"
SSH_PUBKEY=""
LOGO_SOURCE="/root/spiralcoin_logo.png"
INSTALL_SSL="true"
EMAIL_FOR_SSL="admin@spiralcoin.net"
TOKEN_ADDRESS=""
CHAIN=""
EXPLORER_BASE=""
PREMINE_WALLET=""
PREMINE_AMOUNT=""
FOUNDER_WALLET=""
FOUNDER_AMOUNT=""

		while [[ $# -gt 0 ]]; do
		  case "$1" in
		    --domain) DOMAIN="$2"; shift 2 ;;
		    --wallet) WALLET_ADDRS+=("$2"); shift 2 ;;
		    --premine-wallet) PREMINE_WALLET="$2"; shift 2 ;;
		    --premine-amount) PREMINE_AMOUNT="$2"; shift 2 ;;
		    --founder-wallet) FOUNDER_WALLET="$2"; shift 2 ;;
		    --founder-amount) FOUNDER_AMOUNT="$2"; shift 2 ;;
		    --token-address) TOKEN_ADDRESS="$2"; shift 2 ;;
		    --chain) CHAIN="$2"; shift 2 ;;
		    --explorer-base) EXPLORER_BASE="$2"; shift 2 ;;
		    --web-root) WEB_ROOT="$2"; shift 2 ;;
		    --ssh-user) SSH_USER="$2"; shift 2 ;;
		    --ssh-pubkey) SSH_PUBKEY="$2"; shift 2 ;;
		    --logo-source) LOGO_SOURCE="$2"; shift 2 ;;
		    --install-ssl) INSTALL_SSL="$2"; shift 2 ;;
	    --ssl-email) EMAIL_FOR_SSL="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
		  esac
		done

		if [[ "$(id -u)" -ne 0 ]]; then
		  echo "Run as root (sudo)."
		  exit 1
		fi

		if [[ -n "$PREMINE_WALLET" && -z "$PREMINE_AMOUNT" ]]; then
		  echo "--premine-amount is required when --premine-wallet is set"
		  exit 1
		fi
		if [[ -n "$PREMINE_AMOUNT" && -z "$PREMINE_WALLET" ]]; then
		  echo "--premine-wallet is required when --premine-amount is set"
		  exit 1
		fi
		if [[ -n "$FOUNDER_WALLET" && -z "$FOUNDER_AMOUNT" ]]; then
		  echo "--founder-amount is required when --founder-wallet is set"
		  exit 1
		fi
		if [[ -n "$FOUNDER_AMOUNT" && -z "$FOUNDER_WALLET" ]]; then
		  echo "--founder-wallet is required when --founder-amount is set"
		  exit 1
		fi

		# Ensure tokenomics wallets are included in the displayed wallet list
		if [[ -n "$PREMINE_WALLET" ]]; then WALLET_ADDRS+=("$PREMINE_WALLET"); fi
		if [[ -n "$FOUNDER_WALLET" ]]; then WALLET_ADDRS+=("$FOUNDER_WALLET"); fi

		if [[ -z "$EXPLORER_BASE" && -n "$CHAIN" ]]; then
		  case "${CHAIN,,}" in
		    sepolia|eth-sepolia|ethereum-sepolia) EXPLORER_BASE="https://sepolia.etherscan.io" ;;
		    ethereum|eth|mainnet) EXPLORER_BASE="https://etherscan.io" ;;
		    base) EXPLORER_BASE="https://basescan.org" ;;
		    base-sepolia|sepolia-base) EXPLORER_BASE="https://sepolia.basescan.org" ;;
		    arbitrum|arb|arbitrum-one) EXPLORER_BASE="https://arbiscan.io" ;;
		    arb-sepolia|arbitrum-sepolia|sepolia-arbitrum) EXPLORER_BASE="https://sepolia.arbiscan.io" ;;
		  esac
		fi

		# De-dupe and drop empty wallet args (preserve order)
		declare -A __wallet_seen=()
		WALLET_ADDRS_DEDUPED=()
		for w in "${WALLET_ADDRS[@]:-}"; do
	  w="${w#"${w%%[![:space:]]*}"}"
	  w="${w%"${w##*[![:space:]]}"}"
	  if [[ -z "$w" ]]; then
	    continue
	  fi
	  if [[ -z "${__wallet_seen[$w]+x}" ]]; then
	    WALLET_ADDRS_DEDUPED+=("$w")
	    __wallet_seen[$w]=1
	  fi
	done
	unset __wallet_seen
	WALLET_ADDRS=("${WALLET_ADDRS_DEDUPED[@]:-}")
	unset WALLET_ADDRS_DEDUPED

	if [[ "${#WALLET_ADDRS[@]}" -eq 0 ]]; then
	  echo "--wallet is required"
	  exit 1
	fi
	WALLET_PRIMARY="${WALLET_ADDRS[0]}"

	echo "[1/7] Update OS + install packages"
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -y
	apt-get upgrade -y
apt-get install -y nginx ufw fail2ban unattended-upgrades curl git build-essential cmake python3 python3-pip rsync ca-certificates

if [[ "$INSTALL_SSL" == "true" ]]; then
  apt-get install -y certbot python3-certbot-nginx
fi

echo "[2/7] Create least-privileged SSH user"
id -u "$SSH_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$SSH_USER"
usermod -aG sudo "$SSH_USER"
mkdir -p "/home/$SSH_USER/.ssh"
chmod 700 "/home/$SSH_USER/.ssh"
if [[ -n "$SSH_PUBKEY" ]]; then
  echo "$SSH_PUBKEY" > "/home/$SSH_USER/.ssh/authorized_keys"
  chmod 600 "/home/$SSH_USER/.ssh/authorized_keys"
  chown -R "$SSH_USER:$SSH_USER" "/home/$SSH_USER/.ssh"
fi

echo "[3/7] Harden SSH daemon"
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)
cat >/etc/ssh/sshd_config.d/99-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding yes
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30
MaxAuthTries 3
AllowUsers $SSH_USER
EOF
sshd -t
systemctl restart ssh || systemctl restart sshd

echo "[4/7] Firewall + fail2ban"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
systemctl enable fail2ban
systemctl restart fail2ban

echo "[5/7] Deploy nginx site"
mkdir -p "$WEB_ROOT"
chown -R www-data:www-data "$(dirname "$WEB_ROOT")"

cat >/etc/nginx/sites-available/spiralcoin <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF

ln -sf /etc/nginx/sites-available/spiralcoin /etc/nginx/sites-enabled/spiralcoin
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

if [[ -f "$LOGO_SOURCE" ]]; then
  cp "$LOGO_SOURCE" "$WEB_ROOT/spiralcoin_logo.png"
fi

# Deploy the full trading platform if available, otherwise fall back to basic page
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
	PLATFORM_SRC="$SCRIPT_DIR/spiralcoin_trading_platform.html"

		if [[ -f "$PLATFORM_SRC" ]]; then
		  echo "  → Deploying full trading platform HTML"
		  cp "$PLATFORM_SRC" "$WEB_ROOT/index.html"
		  WALLETS_JSON="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "${WALLET_ADDRS[@]}")"
		  TOKEN_CONFIG_JSON=""
		  if [[ -n "$TOKEN_ADDRESS" || -n "$PREMINE_WALLET" || -n "$FOUNDER_WALLET" || -n "$EXPLORER_BASE" ]]; then
		    TOKEN_CONFIG_JSON="$(python3 - "$TOKEN_ADDRESS" "$EXPLORER_BASE" "$PREMINE_WALLET" "$PREMINE_AMOUNT" "$FOUNDER_WALLET" "$FOUNDER_AMOUNT" <<'PY'
import json
import sys

token_address = (sys.argv[1] or "").strip()
explorer_base = (sys.argv[2] or "").strip()
premine_wallet = (sys.argv[3] or "").strip()
premine_amount = (sys.argv[4] or "").strip()
founder_wallet = (sys.argv[5] or "").strip()
founder_amount = (sys.argv[6] or "").strip()

allocations = []
if premine_wallet:
  allocations.append({"type": "premine", "label": "Premine", "address": premine_wallet, "amount": premine_amount})
if founder_wallet:
  allocations.append({"type": "founder", "label": "Founder", "address": founder_wallet, "amount": founder_amount})

cfg = {
  "name": "SpiralCoin",
  "symbol": "SPLC",
  "decimals": 18,
  "tokenAddress": token_address,
  "explorerBase": explorer_base,
  "allocations": allocations,
}

print(json.dumps(cfg, separators=(",", ":")))
PY
)"
		  fi

		  python3 - "$WEB_ROOT/index.html" "$WALLETS_JSON" "$TOKEN_CONFIG_JSON" <<-'PY'
	import sys
	from pathlib import Path

	path = Path(sys.argv[1])
	wallets_json = sys.argv[2]
	token_json = sys.argv[3] if len(sys.argv) > 3 else ""
	text = path.read_text(encoding="utf-8")

	snippets = []
	if "window.SPLC_WALLETS=" not in text:
	  snippets.append(f"window.SPLC_WALLETS={wallets_json};")
	if token_json and token_json != "null" and "window.SPLC_TOKEN_CONFIG=" not in text:
	  snippets.append(f"window.SPLC_TOKEN_CONFIG={token_json};")

	if snippets:
	  snippet = f"<script>{''.join(snippets)}</script>\n"
	  if "</head>" in text:
	    text = text.replace("</head>", snippet + "</head>", 1)
	  else:
	    text = snippet + text
	  path.write_text(text, encoding="utf-8")
	PY
		else
		  echo "  → spiralcoin_trading_platform.html not found, deploying basic placeholder"
		cat >"$WEB_ROOT/index.html" <<HTML
	<!DOCTYPE html>
	<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="SpiralCoin (SPLC) is a privacy-focused digital asset ecosystem with secure infrastructure and transparent tokenomics." />
  <title>SpiralCoin (SPLC) | Privacy-Focused Digital Asset</title>
  <style>
    :root {
      --bg: #0b0f15;
      --bg-soft: #121924;
      --card: #111827;
      --gold: #f5c451;
      --gold-soft: #d7a93f;
      --text: #e8edf6;
      --muted: #9da7ba;
      --line: rgba(245, 196, 81, 0.25);
      --radius: 14px;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Inter, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 15% 10%, rgba(245,196,81,0.13), transparent 35%),
        radial-gradient(circle at 80% 0%, rgba(245,196,81,0.08), transparent 28%),
        var(--bg);
    }

    a { color: var(--gold); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .container {
      width: min(1100px, 92%);
      margin: 0 auto;
    }

    .nav {
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(10px);
      background: rgba(11, 15, 21, 0.78);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.9rem 0;
      gap: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    .brand img {
      width: 36px;
      height: 36px;
      object-fit: contain;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(245, 196, 81, 0.35);
    }

    .hero {
      padding: 5rem 0 2.5rem;
      display: grid;
      gap: 1.5rem;
      text-align: center;
    }

    .hero-logo {
      width: 120px;
      height: 120px;
      margin: 0 auto;
      border-radius: 50%;
      box-shadow: 0 12px 40px rgba(245, 196, 81, 0.22);
    }

    h1 {
      margin: 0.25rem 0 0.5rem;
      font-size: clamp(1.9rem, 3.7vw, 3rem);
      line-height: 1.1;
      color: var(--gold);
    }

    .lead {
      margin: 0 auto;
      max-width: 760px;
      color: var(--muted);
      font-size: 1.05rem;
      line-height: 1.65;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .btn {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 0.8rem 1.2rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, opacity 0.2s ease;
    }

    .btn:hover { transform: translateY(-1px); opacity: 0.96; }
    .btn-primary { background: var(--gold); color: #241b09; }
    .btn-outline { background: transparent; color: var(--gold); border-color: var(--line); }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin: 2.2rem 0;
    }

    .card {
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: var(--radius);
      padding: 1.15rem;
      text-align: left;
    }

    .card h3 {
      margin: 0 0 0.45rem;
      color: var(--gold);
      font-size: 0.92rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .metric {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
    }

    .section {
      margin: 2.1rem 0;
      padding: 1.35rem;
      border-radius: var(--radius);
      background: var(--bg-soft);
      border: 1px solid rgba(255,255,255,0.06);
    }

    .section h2 {
      margin: 0 0 0.8rem;
      font-size: 1.2rem;
      color: var(--gold);
    }

    .mono {
      display: inline-block;
      padding: 0.45rem 0.62rem;
      border-radius: 8px;
      background: #0a101a;
      border: 1px solid rgba(255,255,255,0.08);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #f2f5fb;
      word-break: break-all;
    }

    footer {
      margin: 2.5rem 0 2rem;
      color: var(--muted);
      text-align: center;
      font-size: 0.94rem;
    }

    @media (max-width: 860px) {
      .grid { grid-template-columns: 1fr; }
      .hero { padding-top: 4rem; }
      .nav-inner { flex-wrap: wrap; justify-content: center; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="container nav-inner">
      <div class="brand">
        <img src="spiralcoin_logo.png" alt="SpiralCoin" />
        <span>SpiralCoin (SPLC)</span>
      </div>
      <div>
        <a href="#tokenomics">Tokenomics</a> ·
        <a href="#wallet">Wallet</a> ·
        <a href="#network">Network</a>
      </div>
    </div>
  </nav>

  <main class="container">
    <section class="hero">
      <img class="hero-logo" src="spiralcoin_logo.png" alt="SpiralCoin Logo" />
      <h1>Secure. Private. Built to Scale.</h1>
      <p class="lead">
        SpiralCoin is engineered for modern digital value transfer with a focus on privacy,
        resilient infrastructure, and transparent ecosystem growth.
      </p>
      <div class="actions">
        <button class="btn btn-primary" onclick="location.href='#wallet'">View Wallet</button>
        <button class="btn btn-outline" onclick="location.href='#network'">Network Status</button>
      </div>
    </section>

	    <section id="tokenomics" class="grid" aria-label="SpiralCoin token metrics">
	      <article class="card">
	        <h3>Total Supply</h3>
	        <p class="metric">1,000,000,000</p>
	      </article>
	      <article class="card">
	        <h3>Asset Symbol</h3>
	        <p class="metric">SPLC</p>
	      </article>
	      <article class="card">
	        <h3>Default Wallet</h3>
	        <p class="metric">${WALLET_PRIMARY:0:8}…</p>
	      </article>
	    </section>

	    <section id="wallet" class="section">
	      <h2>Wallet Addresses</h2>
	      <p>Use the official SpiralCoin wallet destination below:</p>
	      <ul class="mono" style="margin:0;padding-left:1.2rem;line-height:1.85;">
$(for w in "${WALLET_ADDRS[@]}"; do
  w="${w//&/&amp;}"
  w="${w//</&lt;}"
  w="${w//>/&gt;}"
  w="${w//\"/&quot;}"
  w="${w//\'/&#39;}"
  printf '	        <li>%s</li>\n' "$w"
done)
	      </ul>
	    </section>

	    <section id="network" class="section">
	      <h2>Mining Demo</h2>
	      <p>Interactive hash counter for UI demonstration purposes.</p>
      <div class="actions" style="justify-content:flex-start; margin-top:0.6rem;">
        <button class="btn btn-primary" onclick="startMining()">Start Mining</button>
        <span id="hashes" class="mono">Hashes: 0</span>
      </div>
    </section>
  </main>

  <footer>
    SpiralCoin · <a href="https://$DOMAIN">$DOMAIN</a>
  </footer>
<script>
  let mining = false;
  let hashCount = 0;
  let mi;
  function startMining() {
    if (mining) return;
    mining = true;
    mi = setInterval(() => {
      hashCount += Math.floor(Math.random() * 1000);
      document.getElementById('hashes').innerText = 'Hashes: ' + hashCount;
    }, 500);
  }
</script>
</body>
</html>
HTML
fi

chown -R www-data:www-data "$WEB_ROOT"

echo "[6/7] Optional Let's Encrypt SSL"
if [[ "$INSTALL_SSL" == "true" ]]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL_FOR_SSL" --redirect || true
fi

echo "[7/7] Optional SpiralCoin daemon service"
if command -v spiralcoind >/dev/null 2>&1; then
  cat >/etc/systemd/system/spiralcoind.service <<EOF
[Unit]
Description=SpiralCoin Daemon
After=network.target

[Service]
User=root
ExecStart=$(command -v spiralcoind) -daemon
ExecStop=$(command -v spiralcoin-cli) stop
Restart=on-failure
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable spiralcoind
  systemctl restart spiralcoind
fi

echo "Done. Verify: https://$DOMAIN"

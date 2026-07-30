#!/usr/bin/env bash
# ============================================================================
#  SpiralCoin DigitalOcean droplet bootstrap
#  Run ONCE on a fresh Ubuntu droplet as root:
#    scp deploy/bootstrap-droplet.sh root@174.138.37.6:/root/
#    ssh root@174.138.37.6 'bash /root/bootstrap-droplet.sh'
#
#  Idempotent — safe to re-run.
# ============================================================================
set -euo pipefail

DOMAIN_PRIMARY="spiralcoin.net"
DOMAIN_WWW="www.spiralcoin.net"
WEBROOT="/var/www/spiralcoin"
NGINX_SITE="/etc/nginx/sites-available/spiralcoin"
NGINX_ENABLED="/etc/nginx/sites-enabled/spiralcoin"
ADMIN_EMAIL="${ADMIN_EMAIL:-trishadreyer@spiralcoin.net}"

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx php-fpm php-cli php-mysql php-curl php-mbstring php-xml php-zip \
                   ufw certbot python3-certbot-nginx curl unzip

PHP_VERSION="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VERSION}-fpm.sock"
echo "==> Detected PHP-FPM socket: ${PHP_SOCK}"

echo "==> Webroot ${WEBROOT}"
mkdir -p "${WEBROOT}"
chown -R www-data:www-data "${WEBROOT}"

echo "==> Writing nginx site config"
cat >"${NGINX_SITE}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_PRIMARY} ${DOMAIN_WWW};

    root ${WEBROOT};
    index index.html index.php;

    # Security headers (CSP allows Alchemy/Infura WSS for live-feed.js)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;

    # Cache static assets
    location ~* \.(?:css|js|jpg|jpeg|png|gif|ico|svg|woff2?|ttf|webp)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        try_files \$uri =404;
    }

    # PHP API endpoints
    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_SOCK};
    }

    # Clean URLs: try file, then file.html, then 404
    location / {
        try_files \$uri \$uri.html \$uri/ =404;
    }

    # Block dotfiles + sensitive
    location ~ /\.(?!well-known) { deny all; }
    location ~* \.(env|sql|md|bat|ps1|sh|log)\$ { deny all; }

    access_log /var/log/nginx/spiralcoin.access.log;
    error_log  /var/log/nginx/spiralcoin.error.log warn;
}
NGINX

ln -sf "${NGINX_SITE}" "${NGINX_ENABLED}"
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing nginx config"
nginx -t
systemctl enable --now nginx
systemctl enable --now "php${PHP_VERSION}-fpm"
systemctl reload nginx

echo "==> Firewall (ufw)"
ufw allow OpenSSH       || true
ufw allow 'Nginx Full'  || true
ufw --force enable      || true
ufw status

echo "==> Placeholder index"
if [ ! -f "${WEBROOT}/index.html" ]; then
    cat >"${WEBROOT}/index.html" <<HTML
<!doctype html><meta charset=utf-8><title>SpiralCoin</title>
<style>body{background:#0b0f15;color:#f5c451;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}</style>
<div><h1>SpiralCoin</h1><p>Droplet ready. Awaiting deploy.</p></div>
HTML
    chown www-data:www-data "${WEBROOT}/index.html"
fi

echo ""
echo "============================================================"
echo "  Bootstrap complete."
echo "  Webroot     : ${WEBROOT}"
echo "  Nginx site  : ${NGINX_SITE}"
echo "  PHP socket  : ${PHP_SOCK}"
echo ""
echo "  Next:"
echo "  1. From Windows, run:  .\\deploy\\upload-do.ps1"
echo "  2. Point IONOS DNS A records (apex + www) to this droplet's IP"
echo "  3. After DNS propagates, run:"
echo "       certbot --nginx -d ${DOMAIN_PRIMARY} -d ${DOMAIN_WWW} \\"
echo "               -m ${ADMIN_EMAIL} --agree-tos --redirect -n"
echo "============================================================"

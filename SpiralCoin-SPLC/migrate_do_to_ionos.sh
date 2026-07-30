#!/usr/bin/env bash
set -euo pipefail

# Migrate SpiralCoin site: DigitalOcean → IONOS
# Usage:
#   bash migrate_do_to_ionos.sh \
#     --do-host 1.2.3.4 \
#     --ionos-host 5.6.7.8 \
#     [options]

DO_HOST=""
DO_USER="root"
DO_WEB_ROOT="/var/www/spiralcoin.net/html"
DO_DB_NAME=""            # optional MySQL/MariaDB database name on DO

IONOS_HOST=""
IONOS_USER="deploy"
IONOS_WEB_ROOT="/var/www/spiralcoin.net/html"
IONOS_DB_HOST="localhost"
IONOS_DB_USER="splcdb"
IONOS_DB_NAME=""

SSH_KEY="$HOME/.ssh/id_ed25519"
BACKUP_DIR="./migration_backup_$(date +%Y%m%d_%H%M%S)"
DRY_RUN="false"
SKIP_DB="false"

# ─── Argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --do-host)       DO_HOST="$2";       shift 2 ;;
    --do-user)       DO_USER="$2";       shift 2 ;;
    --do-web-root)   DO_WEB_ROOT="$2";   shift 2 ;;
    --do-db-name)    DO_DB_NAME="$2";    shift 2 ;;
    --ionos-host)    IONOS_HOST="$2";    shift 2 ;;
    --ionos-user)    IONOS_USER="$2";    shift 2 ;;
    --ionos-web-root) IONOS_WEB_ROOT="$2"; shift 2 ;;
    --ionos-db-host) IONOS_DB_HOST="$2"; shift 2 ;;
    --ionos-db-user) IONOS_DB_USER="$2"; shift 2 ;;
    --ionos-db-name) IONOS_DB_NAME="$2"; shift 2 ;;
    --ssh-key)       SSH_KEY="$2";       shift 2 ;;
    --backup-dir)    BACKUP_DIR="$2";    shift 2 ;;
    --dry-run)       DRY_RUN="true";     shift ;;
    --skip-db)       SKIP_DB="true";     shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── Validation ──────────────────────────────────────────────────────────────
if [[ -z "$DO_HOST" || -z "$IONOS_HOST" ]]; then
  echo "ERROR: --do-host and --ionos-host are required."
  exit 1
fi

SSH_DO="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $DO_USER@$DO_HOST"
SSH_IONOS="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $IONOS_USER@$IONOS_HOST"
RSYNC_OPTS="-azP --delete -e 'ssh -i $SSH_KEY -o StrictHostKeyChecking=no'"

log() { echo "[$(date +%H:%M:%S)] $*"; }
dry() { [[ "$DRY_RUN" == "true" ]] && echo "[DRY-RUN] $*" || eval "$*"; }

mkdir -p "$BACKUP_DIR"

# ─── Step 1: Verify SSH connectivity ────────────────────────────────────────
log "[1/6] Verifying SSH connectivity"
$SSH_DO   "echo 'DO OK'"    || { echo "Cannot reach DO server.";    exit 1; }
$SSH_IONOS "echo 'IONOS OK'" || { echo "Cannot reach IONOS server."; exit 1; }

# ─── Step 2: Backup web root from DO ─────────────────────────────────────────
log "[2/6] Backing up web root from DigitalOcean → $BACKUP_DIR/webroot"
mkdir -p "$BACKUP_DIR/webroot"
dry "rsync -azP -e 'ssh -i $SSH_KEY -o StrictHostKeyChecking=no' \
  $DO_USER@$DO_HOST:$DO_WEB_ROOT/ $BACKUP_DIR/webroot/"

# ─── Step 3: Optional DB dump from DO ────────────────────────────────────────
if [[ "$SKIP_DB" == "false" && -n "$DO_DB_NAME" ]]; then
  log "[3/6] Dumping database '$DO_DB_NAME' from DigitalOcean"
  mkdir -p "$BACKUP_DIR/db"
  dry "$SSH_DO 'mysqldump --single-transaction $DO_DB_NAME' > $BACKUP_DIR/db/$DO_DB_NAME.sql"
else
  log "[3/6] Skipping DB migration (no --do-db-name supplied or --skip-db set)"
fi

# ─── Step 4: Push web root to IONOS ──────────────────────────────────────────
log "[4/6] Pushing web root to IONOS → $IONOS_WEB_ROOT"
dry "$SSH_IONOS 'mkdir -p $IONOS_WEB_ROOT && chown -R $IONOS_USER: $IONOS_WEB_ROOT'"
dry "rsync -azP --delete -e 'ssh -i $SSH_KEY -o StrictHostKeyChecking=no' \
  $BACKUP_DIR/webroot/ $IONOS_USER@$IONOS_HOST:$IONOS_WEB_ROOT/"

# ─── Step 5: Optional DB restore on IONOS ────────────────────────────────────
if [[ "$SKIP_DB" == "false" && -n "$IONOS_DB_NAME" && -f "$BACKUP_DIR/db/$DO_DB_NAME.sql" ]]; then
  log "[5/6] Restoring database to IONOS"
  dry "scp -i $SSH_KEY $BACKUP_DIR/db/$DO_DB_NAME.sql $IONOS_USER@$IONOS_HOST:/tmp/$DO_DB_NAME.sql"
  dry "$SSH_IONOS 'mysql -h $IONOS_DB_HOST -u $IONOS_DB_USER -p $IONOS_DB_NAME < /tmp/$DO_DB_NAME.sql && rm /tmp/$DO_DB_NAME.sql'"
else
  log "[5/6] Skipping DB restore"
fi

# ─── Step 6: Smoke test IONOS ────────────────────────────────────────────────
log "[6/6] Smoke testing IONOS server"
HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --connect-to spiralcoin.net:80:$IONOS_HOST:80 http://spiralcoin.net/ 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" =~ ^(200|301|302)$ ]]; then
  log "Smoke test PASSED (HTTP $HTTP_CODE)"
else
  log "WARNING: Smoke test returned HTTP $HTTP_CODE — verify nginx config on IONOS"
fi

log ""
log "Migration complete. Next steps:"
log "  1. Test the site at http://$IONOS_HOST/ (before DNS cut-over)"
log "  2. When ready, update your DNS A/AAAA records:"
log "     spiralcoin.net     → $IONOS_HOST"
log "     www.spiralcoin.net → $IONOS_HOST"
log "  3. Allow up to 48 h for DNS propagation; monitor with: watch -n 60 dig spiralcoin.net"
log "  4. Renew Let's Encrypt cert on IONOS after DNS propagates:"
log "     sudo certbot --nginx -d spiralcoin.net -d www.spiralcoin.net"
log "  5. Keep the DO droplet live for 72 h as a rollback option, then destroy."

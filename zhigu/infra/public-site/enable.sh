#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || exit 1
# Run only after the owner approves publishing this site and opening TCP 80/443.
source_file=/opt/ShawnWorkSpace/zhigu/infra/public-site/Caddyfile
/usr/bin/caddy validate --config "$source_file" --adapter caddyfile
install -d -m 755 /etc/caddy /etc/systemd/system/zhigu.service.d
backup=$(mktemp -d /var/backups/zhigu-public.XXXXXX)
if [[ -f /etc/caddy/Caddyfile ]]; then cp -p /etc/caddy/Caddyfile "$backup/"; fi
if [[ -f /etc/systemd/system/zhigu.service.d/public-origin.conf ]]; then cp -p /etc/systemd/system/zhigu.service.d/public-origin.conf "$backup/"; fi
install -m 644 "$source_file" /etc/caddy/Caddyfile
cat > /etc/systemd/system/zhigu.service.d/public-origin.conf <<'UNIT'
[Service]
Environment=PUBLIC_ORIGIN=https://shawnlee.top
UNIT
systemctl daemon-reload
systemctl restart zhigu
for attempt in 1 2 3 4 5; do
  if curl --fail --silent http://127.0.0.1:3000/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:3000/health
systemctl unmask caddy
systemctl enable caddy
if systemctl is-active --quiet caddy; then systemctl reload caddy; else systemctl start caddy; fi
systemctl is-active caddy zhigu
# Secrets platforms, application database and proxy remain bound to loopback.
# Cloud security-group TCP 80/443 rules and DNS are managed separately.

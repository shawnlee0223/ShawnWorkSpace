#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || exit 1
test -s /etc/zhigu-infisical/reader.json
chmod 600 /etc/zhigu-infisical/reader.json
/usr/local/bin/node /opt/ShawnWorkSpace/zhigu/infra/infisical/sync.mjs
cat > /etc/systemd/system/zhigu-infisical-sync.service <<'UNIT'
[Unit]
Description=Read Zhigu production configuration from local Infisical
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/node /opt/ShawnWorkSpace/zhigu/infra/infisical/sync.mjs
UMask=0077
UNIT
cat > /etc/systemd/system/zhigu-infisical-sync.timer <<'UNIT'
[Unit]
Description=Refresh Zhigu configuration from Infisical every five minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true
[Install]
WantedBy=timers.target
UNIT
install -d -m 755 /etc/systemd/system/zhigu.service.d
cat > /etc/systemd/system/zhigu.service.d/infisical.conf <<'UNIT'
[Service]
Environment=ZHIGU_CONNECTIONS_MANAGED=infisical
UNIT
systemctl daemon-reload
systemctl enable --now zhigu-infisical-sync.timer
systemctl restart zhigu

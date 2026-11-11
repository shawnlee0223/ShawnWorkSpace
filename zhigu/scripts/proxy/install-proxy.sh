#!/usr/bin/env bash
set -euo pipefail
if ! id zhigu-proxy >/dev/null 2>&1; then
 useradd --system --user-group --no-create-home --home-dir /var/lib/zhigu-proxy --shell /usr/sbin/nologin zhigu-proxy
fi
install -d -o root -g root -m 755 /usr/local/lib/zhigu-proxy
install -o root -g root -m 755 /tmp/mihomo-zhigu /usr/local/lib/zhigu-proxy/mihomo
install -d -o zhigu-proxy -g zhigu-proxy -m 700 /var/lib/zhigu-proxy
install -o zhigu-proxy -g zhigu-proxy -m 600 /root/zhigu-proxy-staging.json /var/lib/zhigu-proxy/config.json
if runuser -u zhigu-proxy -- /usr/local/lib/zhigu-proxy/mihomo -t -d /var/lib/zhigu-proxy -f /var/lib/zhigu-proxy/config.json >/root/zhigu-proxy-validation.log 2>&1; then
 printf 'Proxy configuration validated\n'
else
 printf 'Proxy configuration validation failed; no service started\n'
 exit 1
fi
cat > /etc/systemd/system/zhigu-proxy.service <<'UNIT'
[Unit]
Description=Private proxy for Zhigu Brave and OKX requests
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zhigu-proxy
Group=zhigu-proxy
WorkingDirectory=/var/lib/zhigu-proxy
ExecStart=/usr/local/lib/zhigu-proxy/mihomo -d /var/lib/zhigu-proxy -f /var/lib/zhigu-proxy/config.json
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/zhigu-proxy
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now zhigu-proxy
systemctl is-active zhigu-proxy
rm -f /root/zhigu-proxy-staging.json /tmp/mihomo-zhigu

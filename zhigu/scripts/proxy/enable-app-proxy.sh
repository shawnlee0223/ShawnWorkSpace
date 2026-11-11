#!/usr/bin/env bash
set -euo pipefail
install -d -m 755 /etc/systemd/system/zhigu.service.d
cat > /etc/systemd/system/zhigu.service.d/research-proxy.conf <<'UNIT'
[Unit]
Wants=zhigu-proxy.service
After=zhigu-proxy.service

[Service]
Environment=NODE_USE_ENV_PROXY=1
Environment=HTTPS_PROXY=http://127.0.0.1:17890
Environment=HTTP_PROXY=http://127.0.0.1:17890
Environment=NO_PROXY=localhost,127.0.0.1,::1,.gtimg.cn,.volces.com,eodhd.com,.coingecko.com
UNIT
systemctl daemon-reload
systemctl restart zhigu
systemctl is-active zhigu

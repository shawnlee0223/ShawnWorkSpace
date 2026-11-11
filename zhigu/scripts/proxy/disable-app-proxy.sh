#!/usr/bin/env bash
set -euo pipefail
rm -f /etc/systemd/system/zhigu.service.d/research-proxy.conf
systemctl daemon-reload
systemctl restart zhigu
systemctl disable --now zhigu-proxy

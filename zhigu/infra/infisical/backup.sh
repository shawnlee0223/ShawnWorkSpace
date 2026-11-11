#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/ShawnWorkSpace/zhigu/infra/infisical
install -d -m 700 /var/backups/zhigu-infisical
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target=/var/backups/zhigu-infisical/$stamp
mkdir -m 700 "$target"
docker compose exec -T db pg_dump -U infisical -d infisical -Fc > "$target/database.dump"
cp /etc/zhigu-infisical/instance.env /etc/zhigu-infisical/database.env "$target/"
# These keys decrypt the database. Keep this directory private; never upload it to GitHub.
printf '%s\n' 'Infisical backup complete (database and encryption keys).'

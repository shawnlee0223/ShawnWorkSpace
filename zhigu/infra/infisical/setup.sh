#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run on ECS as root'; exit 1; }
cd /opt/ShawnWorkSpace/zhigu/infra/infisical
# Generate once. Never print or overwrite the keys on upgrades.
install -d -m 700 /etc/zhigu-infisical
/usr/local/bin/node --input-type=module - <<'JS'
import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const dir='/etc/zhigu-infisical/';
const a=existsSync(dir+'instance.env'), b=existsSync(dir+'database.env');
if(a!==b)throw Error('Incomplete private configuration: restore the existing backup before proceeding');
if(!a){
 const p=randomBytes(32).toString('hex');
 writeFileSync(dir+'database.env',`POSTGRES_USER=infisical\nPOSTGRES_DB=infisical\nPOSTGRES_PASSWORD=${p}\n`,{mode:0o600,flag:'wx'});
 writeFileSync(dir+'instance.env',`ENCRYPTION_KEY=${randomBytes(16).toString('hex')}\nAUTH_SECRET=${randomBytes(32).toString('base64')}\nDB_CONNECTION_URI=postgres://infisical:${p}@db:5432/infisical\nREDIS_URL=redis://redis:6379\n`,{mode:0o600,flag:'wx'});
}
JS
cat > /etc/systemd/system/zhigu-infisical-backup.service <<'UNIT'
[Unit]
Description=Back up private Infisical database and root keys
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
ExecStart=/opt/ShawnWorkSpace/zhigu/infra/infisical/backup.sh
UMask=0077
UNIT
cat > /etc/systemd/system/zhigu-infisical-backup.timer <<'UNIT'
[Unit]
Description=Daily private Infisical backup
[Timer]
OnCalendar=*-*-* 03:50:00 Asia/Shanghai
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now zhigu-infisical-backup.timer
docker compose config --quiet
docker compose up -d
for attempt in $(seq 1 60); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:8090/api/status >/dev/null; then
    echo 'Infisical is ready on loopback port 8090'; exit 0
  fi
  sleep 2
done
echo 'Infisical did not become healthy; Zhigu configuration has not been changed.' >&2
exit 1

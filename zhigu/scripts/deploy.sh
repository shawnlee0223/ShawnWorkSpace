#!/usr/bin/env bash
# Usage: SSH_KEY=/private/key SSH_KNOWN_HOSTS=/private/known_hosts ./zhigu/scripts/deploy.sh
set -euo pipefail
repo=$(git -C "$(dirname "$0")/../.." rev-parse --show-toplevel)
cd "$repo"
[[ $(git remote get-url origin) == https://github.com/shawnlee0223/ShawnWorkSpace.git ]] || { echo 'Unexpected origin; deployment stopped.' >&2; exit 1; }
[[ $(git branch --show-current) == main ]] || { echo 'Deploy main only.' >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo 'Commit and push all changes before deployment.' >&2; exit 1; }
commit=$(git rev-parse HEAD)
remote=$(git ls-remote --exit-code origin refs/heads/main | awk '{print $1}')
[[ "$commit" == "$remote" ]] || { echo 'GitHub main does not match HEAD; push first. Nothing deployed.' >&2; exit 1; }
: "${SSH_KEY:?Provide the private SSH key outside the repository}"
: "${SSH_KNOWN_HOSTS:?Provide pinned SSH known_hosts outside the repository}"
ssh_args=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_KNOWN_HOSTS" -o GlobalKnownHostsFile=/dev/null -o BatchMode=yes -o ConnectTimeout=10)
# The destination is intentionally fixed to the authorized Zhigu ECS instance.
ssh_host=root@115.190.159.42
(cd zhigu && npm test)
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
git archive --format=tar "$commit" zhigu > "$archive"
scp "${ssh_args[@]}" "$archive" "$ssh_host:/tmp/zhigu-release-$commit.tar"
ssh "${ssh_args[@]}" "$ssh_host" bash -s -- "$commit" <<'REMOTE'
set -euo pipefail
commit=$1
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || exit 1
exec 9>/run/lock/zhigu-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
app=/opt/ShawnWorkSpace/zhigu
release=/opt/zhigu-releases/$commit
archive=/tmp/zhigu-release-$commit.tar
mkdir -p "$release"
tar -xf "$archive" -C "$release"
cd "$release/zhigu"
/usr/local/bin/node --check server.mjs
/usr/local/bin/node --test tests/*.test.mjs
# Check active research before stopping the service, without showing private settings.
/usr/local/bin/node --input-type=module - <<'JS'
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('/var/lib/zhigu/zhigu.sqlite', {readOnly:true});
if (db.prepare("SELECT count(*) AS n FROM research_runs WHERE status='running'").get().n) throw Error('Research is running; retry deployment after completion');
db.close();
JS
backup=$(mktemp /opt/zhigu-releases/rollback.XXXXXX.tar)
tar -cf "$backup" --exclude=.env --exclude=data --exclude=backups --exclude=node_modules -C "$app" .
previous=$(cat /opt/ShawnWorkSpace/DEPLOYED_COMMIT 2>/dev/null || true)
rollback() {
  trap - ERR
  tar -xf "$backup" -C "$app"
  systemctl restart zhigu
  printf '%s\n' "$previous" > /opt/ShawnWorkSpace/DEPLOYED_COMMIT
  echo 'Deployment failed; restored previous source files.' >&2
  exit 1
}
trap rollback ERR
systemctl stop zhigu
# Overlay source only: no deletion of .env, SQLite, connections or scheduler settings.
tar -xf "$archive" -C /opt/ShawnWorkSpace
systemctl start zhigu
healthy=false
for attempt in 1 2 3 4 5; do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/health | /usr/local/bin/node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{if(JSON.parse(s).ok!==true)process.exit(1)}catch{process.exit(1)}})'; then healthy=true; break; fi
  sleep 1
done
[[ "$healthy" == true ]]
printf '%s\n' "$commit" > /opt/ShawnWorkSpace/DEPLOYED_COMMIT
trap - ERR
rm -f "$archive"
printf 'Healthy deployment: %s\n' "$commit"
REMOTE

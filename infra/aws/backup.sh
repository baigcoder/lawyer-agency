#!/bin/bash
# Nightly logical backup of both databases to S3 (pilot tier of
# docs/infrastructure/BACKUP_STRATEGY.md). Dumps stream straight to S3, so
# nothing large lands on the instance disk.
#
# Install on the EC2 host (cron runs it at 02:00 PKT = 21:00 UTC):
#   sudo snap install aws-cli --classic
#   sudo install -m 755 infra/aws/backup.sh /usr/local/bin/wakeel-backup
#   echo '0 21 * * * ubuntu /usr/local/bin/wakeel-backup >> /var/log/wakeel-backup.log 2>&1' \
#     | sudo tee /etc/cron.d/wakeel-backup
#
# The instance role may only PutObject under postgres/ in the bucket: a
# compromised host cannot read or delete existing backups. Objects expire
# after 14 days (bucket lifecycle rule).
#
# .env/.env.app are deliberately NOT uploaded: MASTER_ENCRYPTION_KEY must not
# sit next to the data it protects. Keep those files in a password manager.
set -euo pipefail

BUCKET="${WAKEEL_BACKUP_BUCKET:-wakeel-backups-645443951171-ap-south-1}"
REGION="${WAKEEL_BACKUP_REGION:-ap-south-1}"
REPO_DIR="${WAKEEL_REPO_DIR:-/home/ubuntu/lawyer-agency}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

cd "$REPO_DIR"

dump() {
  local service="$1" db="$2"
  local key="postgres/${STAMP}/${db}.dump"
  docker compose -f docker-compose.aws.yml exec -T "$service" \
    pg_dump -U postgres -Fc "$db" \
    | aws s3 cp - "s3://${BUCKET}/${key}" --region "$REGION" --only-show-errors
  echo "$(date -u +%FT%TZ) ok ${key}"
}

dump postgres lawyer_agency
dump evolution-postgres evolution_api

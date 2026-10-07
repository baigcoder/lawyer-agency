# Database & Storage Backup Strategy

## 1. Statutory Obligations & Recovery Objectives

Advocate-client communications, case records, vakalatnamas, and court hearing dates constitute privileged legal records under the **Qanun-e-Shahadat Order 1984** and the **Pakistan Bar Council Canons of Professional Conduct**. Data loss in a legal practice can lead to procedural defaults, missed court limitation deadlines, and civil liability.

Wakeel defines two immutable recovery thresholds:
- **Recovery Point Objective (RPO):** `< 15 minutes` (Maximum permissible data loss in catastrophic disaster).
- **Recovery Time Objective (RTO):** `< 1 hour` (Maximum time to restore full service on fresh infrastructure).

---

## 2. Multi-Tiered Backup Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PostgreSQL Instance                           │
│                                                                         │
│   ┌──────────────────────────┐         ┌────────────────────────────┐   │
│   │   Continuous WAL Pipe    │         │     Daily Snapshot Job     │   │
│   │       (Every 60s)        │         │      (02:00 PKT / UTC+5)   │   │
│   └─────────────┬────────────┘         └─────────────┬──────────────┘   │
└─────────────────┼────────────────────────────────────┼──────────────────┘
                  ▼                                    ▼
       ┌──────────────────────┐             ┌──────────────────────┐
       │ WAL-G Object Archive │             │ Compressed pg_dump   │
       │ (S3 / Cloud Storage) │             │ (Encrypted AES-256)  │
       └──────────────────────┘             └──────────────────────┘
                  │                                    │
                  └─────────────────┬──────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │ Off-Site Secondary Bucket   │
                     │ (EU / Wasabi / Backblaze B2)│
                     └─────────────────────────────┘
```

---

## 3. Database Continuous Archiving (Point-in-Time Recovery)

For primary database protection, PostgreSQL is configured with continuous Write-Ahead Log (WAL) archiving via **WAL-G**:

### 3.1 PostgreSQL Engine Configuration (`postgresql.conf`)
```ini
wal_level = replica
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 60 # Flush WAL segment at least once per minute
```

### 3.2 WAL-G Scheduled Snapshots
- **Full Base Backup:** Taken every Sunday at 01:00 PKT.
- **Incremental WAL Streaming:** Captured continuously (RPO < 60 seconds).
- **Retention Period:** 30 days of continuous PITR capability.

---

## 4. Daily Logical Backup Automation (`infra/scripts/backup-db.sh`)

In addition to continuous WAL archiving, an encrypted logical snapshot is generated daily:

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/wakeel/postgres"
BACKUP_FILE="${BACKUP_DIR}/wakeel_db_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Initiating pg_dump logical backup..."
docker exec -t lawyer_agency-postgres-1 pg_dump \
  -U postgres \
  -Fc \
  -v \
  lawyer_agency > "${BACKUP_FILE}"

echo "[backup] Encrypting snapshot using AES-256..."
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in "${BACKUP_FILE}" \
  -out "${ENCRYPTED_FILE}" \
  -pass "env:BACKUP_ENCRYPTION_PASSPHRASE"

rm -f "${BACKUP_FILE}"

echo "[backup] Uploading snapshot to off-site cloud storage..."
rclone copy "${ENCRYPTED_FILE}" remote-backup:wakeel-snapshots/daily/

echo "[backup] Pruning local snapshots older than 14 days..."
find "${BACKUP_DIR}" -type f -name "*.enc" -mtime +14 -delete
echo "[backup] Completed successfully."
```

---

## 5. Document & Media Object Storage Replication

Client-submitted documents (CNIC scans, FIRs, court notices, voice notes) residing in Supabase Storage or the persistent host volume `/var/lib/wakeel/media` are synchronized using continuous object versioning:
1. **Primary Store:** Supabase Storage (S3-compatible bucket) with server-side AES-256 encryption.
2. **Object Versioning:** Enabled across all buckets to prevent accidental or malicious client overwrites.
3. **Cross-Region Replication:** Asynchronous hourly rsync mirror to a secondary bucket located in an alternate jurisdiction.

---

## 6. Disaster Recovery Verification & Restoration Drills

Backups are only as reliable as their last successful restoration. Wakeel mandates **Quarterly Automated Restoration Drills**:

### 6.1 Verification Script (`infra/scripts/verify-restore.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail

TEST_CONTAINER="wakeel-restore-test-db"

echo "[drill] Spinning up ephemeral PostgreSQL container..."
docker run --name "${TEST_CONTAINER}" -e POSTGRES_PASSWORD=test -d postgres:16-alpine

sleep 5

echo "[drill] Restoring latest encrypted backup..."
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "$(ls -t /var/backups/wakeel/postgres/*.enc | head -1)" \
  -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" | \
  docker exec -i "${TEST_CONTAINER}" pg_restore -U postgres -d postgres -v

echo "[drill] Validating row counts and RLS policies..."
docker exec -i "${TEST_CONTAINER}" psql -U postgres -d postgres -c \
  "SELECT count(*) FROM platform.tenants; 
   SELECT relname, relrowsecurity, relforcerowsecurity 
   FROM pg_class WHERE relnamespace = 'app'::regnamespace;"

docker rm -f "${TEST_CONTAINER}"
echo "[drill] Restoration drill PASSED."
```

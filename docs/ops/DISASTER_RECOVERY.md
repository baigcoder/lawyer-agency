# Disaster Recovery Plan — Business Continuity Architecture

## 1. Disaster Recovery Objectives & Scope

For legal practices, data unavailability during an active court proceeding or bail application can cause irreparable harm to litigants and violate professional duties.

Wakeel mandates strict recovery targets across all failure domains:
- **Recovery Point Objective (RPO):** `< 15 minutes` (Maximum acceptable data loss).
- **Recovery Time Objective (RTO):** `< 1 hour` (Full service restoration on fresh infrastructure).

---

## 2. Disaster Scenarios & Resilience Matrix

| Disaster Scenario | Impact Scope | Primary Recovery Mechanism | Target RTO |
| :--- | :--- | :--- | :--- |
| **Datacenter Outage / VPS Destruction** | Complete system unavailability | Cold standby provisioning in secondary region + WAL-G restore | < 45 mins |
| **Database Corruption / Dropped Table** | Partial data loss | PostgreSQL Point-in-Time Recovery (PITR) to exact minute | < 30 mins |
| **Meta WhatsApp Account Ban / WABA Ban** | WhatsApp communication halted | Seamless failover to Evolution Baileys QR numbers | < 15 mins |
| **Host Ransomware / Security Breach** | Server compromised | Clean OS reinstallation, DNS repointing, encrypted snapshot restore | < 60 mins |

---

## 3. Off-Site Backup Topology

```
   PRIMARY HOST (Hetzner Frankfurt)             SECONDARY CLOUD (AWS / Wasabi)
┌─────────────────────────────────────┐      ┌──────────────────────────────────┐
│  PostgreSQL (Port 5432)             │      │  S3 Object Bucket                │
│  • Continuous WAL-G Archiving ──────┼─────►│  "wakeel-wal-archive"            │
│  • Daily Encrypted pg_dump ─────────┼─────►│  "wakeel-snapshots/daily/"       │
│                                     │      │                                  │
│  Supabase Storage (Documents) ──────┼─────►│  Cross-Region Replicated Bucket  │
│  "wakeel-case-documents"            │      │  "wakeel-documents-backup"       │
└─────────────────────────────────────┘      └──────────────────────────────────┘
```

---

## 4. Cold Standby Host Recovery Protocol (Step-by-Step)

In the event of total destruction of the primary host:

### Step 1: Provision Secondary Host (< 10 minutes)
1. Deploy fresh Ubuntu 24.04 LTS instance on secondary cloud provider (e.g., AWS EC2 `c6i.xlarge` in Frankfurt or DigitalOcean 16GB Droplet).
2. Execute initialization script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/baigcoder/lawyer-agency/main/infra/scripts/init-host.sh | bash
   ```

### Step 2: Restore Database via WAL-G (< 20 minutes)
1. Configure WAL-G environment pointing to off-site S3 bucket:
   ```bash
   export WALG_S3_PREFIX="s3://wakeel-wal-archive/postgres"
   export AWS_ACCESS_KEY_ID="${BACKUP_AWS_KEY}"
   export AWS_SECRET_ACCESS_KEY="${BACKUP_AWS_SECRET}"
   ```
2. Pull latest base backup:
   ```bash
   wal-g backup-fetch /var/lib/postgresql/data LATEST
   ```
3. Create recovery trigger file for Point-in-Time Recovery:
   ```ini
   # /var/lib/postgresql/data/recovery.signal
   restore_command = 'wal-g wal-fetch %f %p'
   recovery_target_time = '2026-10-15 14:30:00 UTC'
   ```
4. Start PostgreSQL container; it replays WAL segments up to target second and brings database online.

### Step 3: Deploy Application Stack (< 10 minutes)
1. Clone repository and inject encrypted production secrets:
   ```bash
   git clone https://github.com/baigcoder/lawyer-agency.git /var/www/wakeel
   # Inject secrets from secure vault into apps/api/.env
   ```
2. Build and launch production Docker Compose stack:
   ```bash
   cd /var/www/wakeel
   docker compose -f docker-compose.prod.yml up -d
   ```

### Step 4: DNS Failover & Traffic Cutover (< 5 minutes)
1. Update DNS A-records in Cloudflare:
   - `app.wakeel.pk` -> Point to New Secondary Server IPv4
   - `api.wakeel.pk` -> Point to New Secondary Server IPv4
2. Issue new Let's Encrypt certificates via Certbot:
   ```bash
   certbot --nginx -d app.wakeel.pk -d api.wakeel.pk
   ```

### Step 5: WhatsApp Webhook Repointing
1. Update Webhook callback URL in Meta App Dashboard if domain IP changed.
2. Verify inbound message test:
   ```bash
   curl -fsS http://localhost/health | jq .status
   ```

---

## 5. Post-Recovery Validation & Audit

Following cutover:
1. **Integrity Check:** Execute `infra/scripts/verify-integrity.sql` to verify that all 34 tenant schemas report zero orphaned records.
2. **Audit Logging:** Log recovery event in `platform.audit_logs`.
3. **Law Firm Notification:** Broadcast operational status alert via email/SMS to managing partners confirming recovery completion.

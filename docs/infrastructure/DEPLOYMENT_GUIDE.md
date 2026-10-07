# Production Deployment Guide — Bare-Metal & Cloud VPS

## 1. Hosting Target & Infrastructure Sizing

Wakeel is optimized for deployment on dedicated or virtual cloud instances located in Western Europe (Frankfurt/Falkenstein via Hetzner Cloud) or Middle East (Bahrain/UAE via AWS) to achieve minimal network round-trip latency (<120ms) to Pakistani telecommunications networks (PTCL, Nayatel, Jazz, Zong).

### 1.1 Compute & Sizing Recommendations

| Scale Tier | Target Tenant Load | Recommended Server Profile | CPU / RAM / NVMe Storage | Estimated Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Starter / Pilot** | 1–5 Law Firms (<10k msgs/mo) | Hetzner CPX31 / DO 8GB Droplet | 4 vCPU / 8 GB RAM / 80 GB SSD | ~$16 – $48 / month |
| **Growth (Phase 15 Target)**| 10–50 Law Firms (100k msgs/mo)| Hetzner CCX23 Dedicated vCPU | 4 Dedicated vCPU / 16 GB RAM / 100 GB SSD | ~$45 – $75 / month |
| **Scale / Enterprise** | 100+ Firms (500k+ msgs/mo) | Hetzner CCX33 / AWS EC2 c6i.2xlarge | 8 Dedicated vCPU / 32 GB RAM / 240 GB NVMe | ~$90 – $220 / month |

---

## 2. Server Preparation & System Prerequisites

### 2.1 OS & Kernel Hardening
Deploy Ubuntu 22.04 LTS or 24.04 LTS. Execute initial system hardening:
```bash
# 1. System update
apt update && apt upgrade -y

# 2. Install baseline utilities
apt install -y curl git ufw fail2ban jq htop certbot python3-certbot-nginx

# 3. Configure UFW Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp          # SSH
ufw allow 80/tcp          # HTTP
ufw allow 443/tcp         # HTTPS
ufw allow 5060/udp        # Wavoip SIP signaling
ufw allow 5060/tcp        # SIP TCP fallback
ufw allow 40000:40031/udp # WebRTC RTP audio streams
ufw enable
```

### 2.2 Docker & Compose Installation
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER
systemctl enable docker && systemctl start docker
```

---

## 3. Deployment Procedure via Docker Compose

### 3.1 Clone Repository & Configure Environment
```bash
git clone https://github.com/baigcoder/lawyer-agency.git /var/www/wakeel
cd /var/www/wakeel

# Copy environment template
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

### 3.2 Generate Cryptographic Keys
Generate the 64-character hexadecimal `MASTER_ENCRYPTION_KEY` for AES-256-GCM token protection:
```bash
# Must be exactly 64 hex characters (32 bytes)
openssl rand -hex 32
```
Paste this into `apps/api/.env` under `MASTER_ENCRYPTION_KEY=...`.

### 3.3 Validate Required Production Secrets
Ensure all mandatory environment variables are populated (see [`docs/ENV_SETUP.md`](file:///f:/lawyer_agency/docs/ENV_SETUP.md)):
- `DATABASE_URL` (pointing to `app_user`)
- `MIGRATION_DATABASE_URL` (pointing to `postgres` superuser)
- `REDIS_URL`
- `CLERK_SECRET_KEY` & `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
- `GROQ_API_KEY` or `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY` & voice IDs
- `WAVOIP_TOKEN` (for WhatsApp voice calling)

### 3.4 Execute Database Migrations
Run the isolated migration container to apply all 30 migrations and verify database schema integrity:
```bash
docker compose -f docker-compose.prod.yml up -d migrate
# Follow logs until migration completes with exit code 0
docker compose -f docker-compose.prod.yml logs -f migrate
```

### 3.5 Launch Core Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3.6 Verify Deployment Health
Verify that all containers report healthy:
```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS http://localhost/health
```

---

## 4. SSL & Edge Reverse Proxy Setup

If running behind host-level NGINX with automatic Let's Encrypt certificates:
```bash
certbot --nginx -d app.wakeel.pk -d api.wakeel.pk
```
Configure NGINX to proxy traffic to internal container ports (`80` / `443`).

---

## 5. Zero-Downtime Rolling Update Strategy

When shipping new releases:
1. Pull latest code: `git pull origin main`
2. Run database migrations: `docker compose -f docker-compose.prod.yml up --build -d migrate`
3. Rebuild and gracefully replace worker: `docker compose -f docker-compose.prod.yml up -d --no-deps --build worker`
4. Rebuild and gracefully replace voice: `docker compose -f docker-compose.prod.yml up -d --no-deps --build voice`
5. Rebuild and gracefully replace API: `docker compose -f docker-compose.prod.yml up -d --no-deps --build api`
6. Rebuild and gracefully replace web: `docker compose -f docker-compose.prod.yml up -d --no-deps --build web`
7. Clean up dangling images: `docker image prune -f`

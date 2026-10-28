# Backend on AWS Free Plan (single EC2 host)

The dashboard runs on Vercel (`lawyer-agency-web`). Everything else — API,
worker, Evolution API (WhatsApp), Postgres + pgvector, Redis, local embeddings,
optionally voice — runs on **one EC2 instance** with Docker Compose
([`docker-compose.aws.yml`](../../docker-compose.aws.yml)), behind Caddy for HTTPS.

```
Browser ──> Vercel (Next.js) ──/backend/*──> https://API_DOMAIN ──> Caddy ──> api
                                                                           ├─ worker
                                              WhatsApp <──> evolution-api ─┤
                                                                           ├─ postgres, redis
                                                                           └─ embeddings
```

## What "free" means here

AWS accounts opened since mid-2025 get the **Free plan**: sign-up credits
(about $100, up to ~$200 by completing onboarding tasks) usable for about
6 months on eligible services. Check the current terms on the AWS Free Tier
page before you start — they change.

- Recommended instance: **t3.small** (2 vCPU, 2 GB RAM) + 4 GB swap, 30 GB gp3
  disk, region **ap-south-1 (Mumbai)** for low latency to Pakistan.
  Expected spend ≈ $15–20/month (instance + public IPv4 + disk), so the
  credits cover roughly the whole Free plan period.
- **t3.micro (1 GB) is too small** for this stack.
- If the box is slow or OOM-kills containers, stop it and change the type to
  **t3.medium** (4 GB, ≈ $30/month) — credits then last about half as long.
- When the Free plan period ends, AWS closes the account unless you upgrade to
  a paid plan. **Upgrade (or move off) before then**, or the instance and its
  data are deleted.

## 1. Account and guardrails

1. Create the AWS account (choose the Free plan) and enable MFA on root.
2. **Billing → Budgets → Create budget** → zero-spend or $5 monthly budget with
   an email alert, so nothing surprises you after credits run out.

## 2. Domain (free)

The API needs a hostname for its HTTPS certificate. Zero-setup option:
`<ip-with-dashes>.sslip.io` (e.g. `65-1-69-172.sslip.io`) resolves to the IP
with no account — the pilot uses this; skip step 4. Alternatively sign in at
[duckdns.org](https://www.duckdns.org) and create a subdomain (e.g.
`wakeel-api.duckdns.org`), or use your own domain.

## 3. Launch the instance

EC2 console (region ap-south-1) → **Launch instance**:

| Setting | Value |
|---|---|
| AMI | Ubuntu Server 24.04 LTS (x86_64) |
| Type | t3.small |
| Key pair | create one, keep the `.pem` safe |
| Storage | 30 GiB gp3 |
| Security group | SSH 22 from **My IP**; HTTP 80 and HTTPS 443 from anywhere |

Only if you enable live calls (voice profile): also UDP 5060 and UDP
40000–40031 from anywhere.

Then **Elastic IPs → Allocate → Associate** with the instance, so the IP
survives stop/start.

## 4. Point the domain at the server

In DuckDNS, set the subdomain's IP to the Elastic IP. Check:

```bash
nslookup wakeel-api.duckdns.org
```

## 5. Install and configure

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>
git clone https://github.com/baigcoder/lawyer-agency.git
cd lawyer-agency
git checkout dev
sudo bash infra/aws/setup.sh wakeel-api.duckdns.org https://lawyer-agency-web.vercel.app
```

`setup.sh` installs Docker, adds swap, and creates two git-ignored files with
generated secrets:

- `.env` — database/Evolution passwords, `API_DOMAIN`, `APP_PUBLIC_URL`.
  Never passed to app containers; the app only gets the non-owner `app_user`
  connection (RLS stays binding, D-020).
- `.env.app` — app config. **Edit it** and fill in `CLERK_SECRET_KEY`,
  `VAPID_SUBJECT`, `EMAIL_FROM` and at least one AI provider key
  (see `docs/ENV_SETUP.md`). The API refuses to boot in production without
  the Clerk, VAPID and email values.

Back up `.env` and `.env.app` somewhere safe (password manager).
`MASTER_ENCRYPTION_KEY` cannot be regenerated without losing stored tenant
secrets.

## 6. Start

Log out and back in (docker group), then:

```bash
cd lawyer-agency
docker compose -f docker-compose.aws.yml up -d --build
```

The first build takes 15–25 minutes on a t3.small. Then:

```bash
docker compose -f docker-compose.aws.yml ps
curl https://wakeel-api.duckdns.org/health
```

Caddy fetches the Let's Encrypt certificate on the first HTTPS request.

Live calls (optional): `docker compose -f docker-compose.aws.yml --profile voice up -d`.

## 7. Connect Vercel

In the Vercel project `lawyer-agency-web` → Settings → Environment Variables
(Production):

| Key | Value |
|---|---|
| `API_INTERNAL_URL` | `https://wakeel-api.duckdns.org` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from Clerk |
| `CLERK_SECRET_KEY` | from Clerk (same instance as the API's) |

Set the Clerk keys **together with** `API_INTERNAL_URL`: without Clerk the
dashboard runs the dev seam, which would let any visitor act as a tenant once
an API is reachable. Then **redeploy** — `API_INTERNAL_URL` is baked into the
`/backend/*` rewrite at build time.

## Operating

```bash
# Update to latest dev
git pull && docker compose -f docker-compose.aws.yml up -d --build

# Logs
docker compose -f docker-compose.aws.yml logs -f api worker evolution-api

# Manual DB backup (copy the file off the box)
docker compose -f docker-compose.aws.yml exec -T postgres \
  pg_dump -U postgres -Fc lawyer_agency > wakeel-$(date +%F).dump
```

## Backups and cost alerts

- **Nightly backups:** [`infra/aws/backup.sh`](../../infra/aws/backup.sh)
  (installed as `/usr/local/bin/wakeel-backup`, cron 02:00 PKT) streams
  `pg_dump` of both databases to the private, encrypted bucket
  `wakeel-backups-<account>-ap-south-1` under `postgres/<timestamp>/`.
  Objects expire after 14 days. The instance role `wakeel-backend-ec2` may
  only `PutObject` there — it cannot read or delete backups. Log:
  `/var/log/wakeel-backup.log`.
- **Restore:** download a dump with your own AWS credentials, then
  `pg_restore -U postgres -d lawyer_agency --clean <file>` inside the
  postgres container (stop api/worker first).
- **Budgets:** "Wakeel zero-spend guard" emails on any spend after credits;
  "Wakeel credit burn" emails at 80% of $25/month gross (before credits)
  or when the forecast exceeds it.

Still a pilot setup: one disk, daily (not continuous) backups, no failover.
See [BACKUP_STRATEGY.md](BACKUP_STRATEGY.md) for the production target
(WAL archiving, off-site copy) and add EBS snapshots.

# Deploy Runbook — AWS backend

How to ship a new backend version to the single EC2 host, check it, and roll
it back. First-time setup is in [AWS_FREE_TIER.md](AWS_FREE_TIER.md); this is
the routine procedure after that.

| What | Where |
|---|---|
| Dashboard | Vercel `lawyer-agency-web` — deploys itself on every push to `dev` |
| Backend | EC2 (ap-south-1), `~/lawyer-agency`, [`docker-compose.aws.yml`](../../docker-compose.aws.yml) |
| API URL | `https://65-1-69-172.sslip.io` (Vercel `API_INTERNAL_URL`) |
| Secrets | `~/lawyer-agency/.env` (infra) and `.env.app` (app) — never committed |
| Backups | S3 `wakeel-backups-<account>-ap-south-1`, nightly, 14 days |

The backend does **not** deploy itself. Merging to `dev` updates the
dashboard only; until you run step 2 the dashboard talks to the old API.
Ship the backend first when a change touches both.

## 1. Before you deploy

- CI is green on the `dev` commit you are shipping (GitHub → Actions).
- Read the merged PRs for new env keys (`git diff <old>..origin/dev -- .env.example`)
  and new migrations (`git diff --stat <old>..origin/dev -- apps/api/prisma/migrations`).
- Migrations are forward-only. If one drops or rewrites data, take a fresh
  backup first (step 6) — rollback in step 5 cannot undo it.

## 2. Deploy

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>
cd ~/lawyer-agency
git rev-parse --short HEAD > ~/last-good-sha   # remember what is running now
git fetch origin && git checkout dev && git pull --ff-only
# add any new keys to .env.app now (step 1)
SENTRY_RELEASE=$(git rev-parse --short HEAD) \
  docker compose -f docker-compose.aws.yml up -d --build
```

`up` builds the image (10–25 min on a t3.small), runs the `migrate` service
to completion, then recreates `api` and `worker`. If `migrate` fails, the new
containers do not start and the old ones keep serving — read
`docker compose -f docker-compose.aws.yml logs migrate`.

With live calls enabled, add `--profile voice`.

Env-only change (no new code): edit `.env.app`, then
`docker compose -f docker-compose.aws.yml up -d api worker` — no rebuild.

## 3. Verify (5 minutes)

```bash
docker compose -f docker-compose.aws.yml ps                 # all healthy / running
curl -fsS https://65-1-69-172.sslip.io/health               # {"status":"ok",...}
curl -fsS https://65-1-69-172.sslip.io/health/ready         # database reachable
docker compose -f docker-compose.aws.yml logs --since 5m api worker | grep -iE 'error|fatal' || echo clean
```

Then, from the dashboard:

1. Sign in and open the inbox — conversations load.
2. Settings → WhatsApp shows the number as connected.
3. Send a WhatsApp message from a test phone to the firm number; the AI
   replies (or a draft appears, if auto-reply is off) within ~30 s.
4. Sentry (if `SENTRY_DSN` is set): no new issues tagged with this release.

If any of these fail, roll back (step 5) before investigating.

## 4. Watch

- Errors: Sentry, filtered by `release` = the deployed SHA. Events carry
  identifiers only (tenant id, correlation id, event type) — never message
  text, request bodies or headers beyond user-agent (D-005).
- Logs: `docker compose -f docker-compose.aws.yml logs -f api worker evolution-api`.
  Search by the `correlationId` from a Sentry event or a 5xx response.
- Rate limiting: a burst of `429` responses means `RATE_LIMIT_PER_MINUTE`
  (default 300 per signed-in user per minute) is too low for real use —
  raise it in `.env.app` and recreate `api`.

## 5. Roll back

```bash
cd ~/lawyer-agency
git checkout $(cat ~/last-good-sha)
SENTRY_RELEASE=$(git rev-parse --short HEAD) \
  docker compose -f docker-compose.aws.yml up -d --build
```

This puts the old code back. It does **not** revert migrations: old code runs
against the new schema, which is fine for additive migrations (new tables or
nullable columns) — the usual case. If the bad release ran a destructive
migration, restore the pre-deploy backup (step 6) instead.

Return to `dev` with `git checkout dev` once the fix is merged.

For the dashboard, use Vercel → Deployments → previous production deployment
→ **Promote** (instant, no rebuild).

## 6. Backups

Take one on demand before risky deploys:

```bash
sudo /usr/local/bin/wakeel-backup          # streams both dumps to S3
tail -n 3 /var/log/wakeel-backup.log       # "ok postgres/<stamp>/..."
```

Check the nightly job ran: the log has an `ok` line from the last 24 h.

**Restore test — do this once a month and after any backup change.** A backup
that was never restored is not a backup.

```bash
# On your machine, with your own AWS credentials (the instance cannot read):
aws s3 ls s3://<bucket>/postgres/ --region ap-south-1 | tail -n 3
aws s3 cp s3://<bucket>/postgres/<stamp>/lawyer_agency.dump . --region ap-south-1
# Restore into a throwaway database, never the live one:
docker run -d --name restore-test -e POSTGRES_PASSWORD=x pgvector/pgvector:pg16
docker cp lawyer_agency.dump restore-test:/tmp/
docker exec restore-test createdb -U postgres restore_check
docker exec restore-test pg_restore -U postgres -d restore_check --no-owner /tmp/lawyer_agency.dump
docker exec restore-test psql -U postgres -d restore_check -c 'select count(*) from tenants;'
docker rm -f restore-test
```

Real restore onto the server: stop `api` and `worker`, copy the dump into the
postgres container, `pg_restore -U postgres -d lawyer_agency --clean <file>`,
start them again, then run step 3.

## 7. Rotating a secret

1. Create the new key at the provider (Groq, ElevenLabs, Gemini, Clerk, …).
2. Replace it in `.env.app` on the server.
3. `docker compose -f docker-compose.aws.yml up -d api worker` (add `voice` if used).
4. Run step 3, then revoke the old key at the provider.

Never rotate `MASTER_ENCRYPTION_KEY` this way — it encrypts stored tenant
secrets, and changing it makes them unreadable.

## Settings this runbook relies on

| Key (`.env.app`) | Purpose |
|---|---|
| `SENTRY_DSN` | Error tracking; empty disables it. Self-hosted Sentry or sentry.io — both receive identifiers only. |
| `SENTRY_RELEASE` | Set per deploy from the shell (step 2), not in `.env.app`. |
| `RATE_LIMIT_PER_MINUTE` | HTTP requests per signed-in user (or per IP) per minute; `0` disables. Webhooks and `/health` are exempt. |

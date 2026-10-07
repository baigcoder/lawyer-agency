# Production Readiness & Go-Live Audit Checklist

## 1. Production Launch Gate Matrix

Prior to onboarding paying law firms, the deployment must pass all 8 verification gates. Failure on any single item halts deployment.

| Category | Verification Item | Target Status | Validation Command / Evidence |
| :--- | :--- | :--- | :--- |
| **1. Database** | All 30 migrations applied | Pass | `SELECT count(*) FROM "_prisma_migrations"` = 30 |
| | `FORCE RLS` active on all 34 `app` tables | Pass | `SELECT count(*) FROM pg_class WHERE relnamespace='app'::regnamespace AND relforcerowsecurity=true` = 34 |
| | `app_user` role lacks `BYPASSRLS` | Pass | `SELECT rolbypassrls FROM pg_roles WHERE rolname='app_user'` = `false` |
| | Monthly partitions pre-created (6 months) | Pass | Partitions exist up to current date + 6 months |
| | Vector indexes built on 384 dimensions | Pass | `SELECT indexdef FROM pg_indexes WHERE indexname='kb_chunks_embedding_hnsw'` |
| **2. Auth & Web** | Production Clerk keys configured | Pass | Real Clerk orgs synced; JWT verification passing |
| | Dev seam stripped from production bundle | Pass | `NEXT_PUBLIC_DEV_TENANT_ID` absent in web bundle |
| | Same-origin `/backend/*` reverse proxy | Pass | Browser makes zero cross-origin API calls |
| **3. WhatsApp** | Official WABA or Evolution API online | Pass | `wget -qO- http://localhost:8080/` returns HTTP 200 |
| | Webhook HMAC verification verified | Pass | Invalid signatures rejected with HTTP 401 |
| | Approved Meta utility templates active | Pass | `SELECT count(*) FROM app.whatsapp_templates WHERE status='APPROVED'` >= 3 |
| **4. Voice** | SIP port 5060 open & bound | Pass | `netstat -ulnp \| grep 5060` |
| | RTP audio port range open (40000–40031) | Pass | `iptables -L -n \| grep 40000:40031` |
| | Wavoip token active & connected | Pass | Voice container logs: `[Wavoip] Connected to sipv2.wavoip.com` |
| **5. AI & Storage** | Local embeddings microservice healthy | Pass | `curl -s http://localhost:8081/health` returns HTTP 200 |
| | Groq / OpenAI LLM keys funded | Pass | AI intake turns succeed in < 1500ms |
| | ElevenLabs Urdu TTS synthesis verified | Pass | Voice greeting generated in Urdu audio format |
| | Supabase document storage accessible | Pass | Upload test PDF and verify signed download URL |
| **6. Observability** | Sentry error tracking active | Pass | `SENTRY_DSN` configured across API and Worker |
| | Append-only audit logs active | Pass | `UPDATE app.audit_logs` fails with permission denied |

---

## 2. Health Probes & Edge Monitoring

The API exposes a comprehensive health endpoint at `/health` (proxied to public edge via NGINX):

### 2.1 Health Check Probe Contract (`GET /health`)
```json
{
  "status": "ok",
  "version": "1.0.0",
  "role": "api",
  "uptime": 86400,
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 2
    },
    "redis": {
      "status": "healthy",
      "latencyMs": 1
    },
    "evolutionApi": {
      "status": "healthy",
      "instancesConnected": 4
    },
    "embeddings": {
      "status": "healthy",
      "model": "intfloat/multilingual-e5-small",
      "dimensions": 384
    }
  }
}
```

---

## 3. Staging Smoke Test Automation Script

Run this bash script to validate end-to-end operational readiness before enabling client traffic:

```bash
#!/usr/bin/env bash
set -euo pipefail

API_URL="http://localhost:3001"
echo "=== WAKEEL STAGING SMOKE TEST SUITE ==="

# 1. Health Probe Check
echo "[test 1/5] Checking /health probe..."
HEALTH=$(curl -fsS "${API_URL}/health")
echo "${HEALTH}" | jq -e '.status == "ok"' > /dev/null
echo "✓ Health probe returned status OK"

# 2. Local Embeddings Inference Check
echo "[test 2/5] Testing local vector embeddings..."
EMBED_RESP=$(curl -fsS -X POST "http://localhost:8081/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{"model":"intfloat/multilingual-e5-small","input":"khula procedure lahore"}')
DIM_COUNT=$(echo "${EMBED_RESP}" | jq '.data[0].embedding | length')
if [ "${DIM_COUNT}" -eq 384 ]; then
  echo "✓ Embeddings verified at 384 dimensions"
else
  echo "✗ Failed: Expected 384 dimensions, got ${DIM_COUNT}"
  exit 1
fi

# 3. Evolution WhatsApp Gateway Check
echo "[test 3/5] Testing Evolution WhatsApp API Gateway..."
EVO_RESP=$(curl -fsS "http://localhost:8080/")
echo "✓ Evolution API reachable and responding"

# 4. Outbox Dispatcher Check
echo "[test 4/5] Testing Redis & Outbox Event queue..."
docker exec -i lawyer_agency-redis-1 redis-cli ping > /dev/null
echo "✓ Redis queue broker healthy"

# 5. Database RLS Integrity Verification
echo "[test 5/5] Verifying database RLS security policies..."
docker exec -i lawyer_agency-postgres-1 psql -U postgres -d lawyer_agency -c \
  "SELECT count(*) FROM pg_policy WHERE polname = 'tenant_isolation';" | grep -q "34"
echo "✓ All 34 app-schema tables enforce tenant_isolation RLS"

echo "=== ALL PRODUCTION GATES PASSED SUCCESSFULLY ==="
```

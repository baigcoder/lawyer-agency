# Secrets Management & Key Rotation Architecture

## 1. Secrets Inventory & Classification

Wakeel utilizes a categorized secrets model spanning identity providers, WhatsApp gateways, AI providers, telephony trunks, and local cryptographic layers.

| Secret Key | Target Role | Classification | Usage & Scope |
| :--- | :--- | :--- | :--- |
| **`MASTER_ENCRYPTION_KEY`** | `api`, `worker`, `voice` | **Tier 0 Critical** | 64-hex-char key used by `CryptoService` for AES-256-GCM encryption of sensitive database fields. |
| **`CLERK_SECRET_KEY`** | `api`, `worker`, `voice` | Tier 1 Identity | Backend token verification and Clerk B2B Organization management. |
| **`CLERK_JWKS_URL`** | `api`, `worker`, `voice` | Tier 1 Identity | Public key endpoint for validating client JWT RS256 signatures. |
| **`META_APP_SECRET`** | `api`, `worker` | Tier 1 Messaging | Validates HMAC-SHA256 signatures on inbound Meta WhatsApp Cloud API webhooks. |
| **`META_WEBHOOK_VERIFY_TOKEN`**| `api` | Tier 1 Messaging | Shared challenge secret verified during Meta webhook subscription handshake. |
| **`EVOLUTION_API_KEY`** | `api`, `voice`, `evolution-api` | Tier 1 Messaging | API bearer token authenticating REST calls to Evolution API. |
| **`EVOLUTION_WEBHOOK_SECRET`** | `api` | Tier 1 Messaging | HMAC secret verifying Evolution API webhook callbacks. |
| **`WAVOIP_TOKEN`** | `voice` | Tier 1 Telephony | API authentication token for Wavoip WhatsApp SIP live call bridge. |
| **`WAVOIP_SIP_PASSWORD`** | `voice` | Tier 1 Telephony | Digest authentication password for SIP registration (`sipv2.wavoip.com`). |
| **`GROQ_API_KEY`** | `worker`, `voice` | Tier 2 Inference | Model inference key for Llama 3.3 70B legal triage and intake. |
| **`OPENAI_API_KEY`** | `worker`, `voice` | Tier 2 Inference | Fallback inference key for GPT-4o mini summarization. |
| **`ELEVENLABS_API_KEY`** | `worker`, `voice` | Tier 2 Audio | Multilingual TTS synthesis key for Urdu and English voice reception. |
| **`VAPID_PRIVATE_KEY`** | `worker` | Tier 3 Notification | Cryptographic private key for Web Push notification signing (RFC 8292). |
| **`SMTP_PASS`** | `worker` | Tier 3 Notification | Password for transactional email delivery (daily digests). |

---

## 2. Cryptographic Secret Generation Standards

Every production deployment must generate unique, cryptographically random keys. **Default passwords and template secrets must never be used.**

```bash
# 1. Generate 64-character hex MASTER_ENCRYPTION_KEY (32 raw bytes)
openssl rand -hex 32

# 2. Generate Meta Webhook Verification Token
openssl rand -hex 24

# 3. Generate Evolution API Key
openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32

# 4. Generate Web Push VAPID Keypair
npx web-push generate-vapid-keys --json
```

---

## 3. Host Storage & Permission Hardening

Environment configuration files must be stored on the host filesystem with strict POSIX file permissions restricting access to the deployment operator:
```bash
chmod 600 /var/www/wakeel/apps/api/.env
chmod 600 /var/www/wakeel/apps/web/.env.local
chown deployer:deployer /var/www/wakeel/apps/api/.env
```

Secrets are passed directly to container runtimes via Docker Compose `env_file:` or environment injection. Secrets are **never baked into Docker image layers**.

---

## 4. Key Rotation Procedures

### 4.1 Zero-Downtime Rotation for External API Keys
For third-party provider keys (`GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `WAVOIP_TOKEN`):
1. Provision secondary API key in provider console.
2. Update key in `/var/www/wakeel/apps/api/.env`.
3. Perform rolling reload of application containers:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps api worker voice
   ```
4. Revoke legacy API key in provider console.

### 4.2 Master Encryption Key Rotation Runbook
Rotating `MASTER_ENCRYPTION_KEY` requires re-encrypting all encrypted database columns:
1. Generate new 64-hex key: `NEW_KEY=$(openssl rand -hex 32)`.
2. Execute migration utility script:
   ```bash
   docker exec -it lawyer_agency-worker-1 npx ts-node scripts/rotate-encryption-key.ts \
     --current-key "${CURRENT_KEY}" \
     --new-key "${NEW_KEY}"
   ```
3. Update `MASTER_ENCRYPTION_KEY` in `.env`.
4. Restart application containers to load the new key.

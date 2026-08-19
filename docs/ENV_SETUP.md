# Environment Setup Guide — All Keys & Services

This guide lists **every external service and secret** Wakeel needs, how to get each key, and where to paste it. Copy `.env.example` to `apps/api/.env` and `apps/web/.env.local`, then fill the values from this guide.

> **Live testing:** To receive WhatsApp webhooks on your machine you need a public HTTPS URL. Use [ngrok](https://ngrok.com/) (`ngrok http 3001`) or deploy the Docker Compose stack to a server first. Meta rejects `http://localhost` webhooks.

---

## 1. Required for local development

These are the minimum keys needed to run the app locally with the dev seam (no Clerk/Meta AI required for basic boot).

### 1.1 `MASTER_ENCRYPTION_KEY`
- **What it does:** Encrypts per-tenant WhatsApp tokens stored in the database (AES-256-GCM).
- **How to get it:** Generate locally — it is **not** from an external service.
- **Command:**
  ```bash
  openssl rand -hex 32
  ```
- **Paste into:** `apps/api/.env` → `MASTER_ENCRYPTION_KEY=`
- **Rules:** exactly 64 hex characters. Keep it secret and back it up — losing it means encrypted tokens cannot be decrypted.

### 1.2 Postgres user password
- **What it does:** The dev database password for the non-owner `app_user` role.
- **How to get it:** Set it yourself in `infra/postgres/init.sql` (default is `change-me`) or in your managed Postgres provider.
- **Paste into:** `apps/api/.env`
  - `DATABASE_URL=postgresql://app_user:YOUR_PASSWORD@localhost:5432/lawyer_agency`
  - `MIGRATION_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/lawyer_agency`
- **Note:** `MIGRATION_DATABASE_URL` must use the **owner** role (`postgres` in dev) because migrations create RLS policies and partitions.

### 1.3 Redis URL
- **What it does:** Queue backend for BullMQ workers.
- **How to get it:** Use the included `docker compose up -d` Redis, or a managed Redis.
- **Paste into:** `apps/api/.env` → `REDIS_URL=redis://localhost:6379`

---

## 2. Required for production / real auth

### 2.1 Clerk (authentication)
Wakeel uses Clerk for firm-staff login. Without Clerk keys the app falls back to the dev seam (`x-tenant-id` header).

- **Sign up:** https://dashboard.clerk.com/
- **Create an application.**
- **Get keys:**
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Settings → API keys → Publishable key (starts with `pk_test_` or `pk_live_`).
  - `CLERK_SECRET_KEY` — Settings → API keys → Secret key (starts with `sk_test_` or `sk_live_`).
- **Paste into:**
  - `apps/web/.env.local` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
  - `apps/api/.env` → `CLERK_SECRET_KEY=sk_test_...`
  - `apps/api/.env` → `APP_PUBLIC_URL=http://localhost:3002` (public dashboard origin; Clerk invitation emails link here)
- **Map org to tenant:** In production each law firm is a Clerk organization. On first login the backend links `tenant.clerkOrgId` to the local tenant. Create the tenant row in the database first (or use the onboarding flow when built).

---

## 3. Required for WhatsApp Cloud API

### 3.1 Meta app credentials
- **Sign up / log in:** https://developers.facebook.com/
- **Create an app:** My Apps → Create App → "Business" type.
- **Add product:** In the app dashboard, click **Set Up** on **WhatsApp**.
- **Get values:**
  - `META_APP_ID` — App dashboard → Settings → Basic → App ID.
  - `META_APP_SECRET` — Settings → Basic → App Secret (click Show).
  - `META_WEBHOOK_VERIFY_TOKEN` — invent a long random string, e.g.:
    ```bash
    openssl rand -hex 32
    ```
    Paste the same value into both Meta webhook settings and `apps/api/.env`.
- **Paste into:** `apps/api/.env`

### 3.2 Webhook URL
- **What it does:** Meta sends incoming WhatsApp messages and status updates to this URL.
- **Format:** `https://your-domain.com/backend/whatsapp/webhook`
- **For local testing:** use ngrok:
  ```bash
  ngrok http 3001
  # Then set webhook to https://<ngrok-id>.ngrok-free.app/backend/whatsapp/webhook
  ```
- **Configure in Meta:** WhatsApp → Configuration → Webhook → Edit → paste URL and verify token.
- **Subscribe to fields:** `messages`, `message_status` (and `message_reactions` if needed).

### 3.3 Redirect URI (Embedded Signup)
- **What it does:** Meta redirects back (with `?code=...&state=...`) after a law firm authorizes Wakeel to manage its WABA.
- **Format:** a **frontend page** that captures the code — `https://your-domain.com/dashboard/whatsapp`. The page then POSTs the code to `POST /v1/whatsapp/onboarding/complete` using the logged-in user's session (that endpoint is auth-guarded, so Meta cannot POST to it directly — the dashboard must relay the code).
- **Paste into:** `apps/api/.env` → `META_REDIRECT_URI=...` (must match the value registered below).
- **Configure in Meta:** App → WhatsApp → Configuration → Add a callback URL (Valid OAuth Redirect URIs) — must exactly match `META_REDIRECT_URI`.

### 3.4 Graph API base URL
- Usually leave default:
  ```
  META_GRAPH_BASE_URL=https://graph.facebook.com/v22.0
  ```

### 3.5 Test number (optional for quick manual tests)
- In the Meta app dashboard, WhatsApp → Getting Started gives a test phone number and a **temporary access token**.
- For production each tenant must complete Embedded Signup so their own WABA + phone number is connected (D-002, D-048).

---

## 3.6 — Pakistan-specific setup (Cloud API from PK)

> **Premise check:** The WhatsApp Cloud API is **available in Pakistan**. The Graph API endpoint (`https://graph.facebook.com/v22.0`) is reachable from PK hosts, Pakistani businesses run on it today, and `+92` numbers are supported. No code change is required in Wakeel for geographic reasons — the friction is onboarding/verification/billing, not API access. This section walks a PK operator through end-to-end.

### 3.6.1 Getting a +92 business number

- Meta does **not** sell Pakistani (+92) Cloud-API numbers directly. You bring your own.
- Buy a **fresh SIM** from a PK operator (Jazz, Zong, Telenor, SCOM). Activate it in the legal name of the firm/business, not an individual's name — Meta Business Verification compares names.
- **Do NOT register this number on the consumer WhatsApp app first.** A number can exist on either the consumer app or the WhatsApp Business API — never both. If it is already on consumer WA, delete the account there before onboarding.
- During Embedded Signup, port this number into a new WhatsApp Business Account (WABA). Meta sends an SMS or voice call to verify ownership, so keep the SIM live and reachable during the flow.
- The display name must match the registered business (e.g. "ABC Law Associates"); Meta reviews display names and rejects generic or mismatched ones.

### 3.6.2 Meta Business Verification from Pakistan

Required by D-002 / risk R1. Plan days, not minutes.

- **Business Manager:** create one at `business.facebook.com` in the firm's legal name.
- **Documents Meta accepts from PK** (all in English or translated):
  - SECP incorporation certificate (or registration certificate for sole-prop/partnership).
  - NTN / PRAL tax-registration certificate from the FBR.
  - A utility bill or bank statement whose legal name and address match the business. Name mismatch is the #1 rejection cause — fix it before applying.
  - A live business website on a real domain (a `.pk` or `.com` is fine; a Facebook page alone is not).
- **Common rejection causes:** legal-name mismatch across docs, unverifiable business address, no website, duplicate Business Manager, or a display name that doesn't match the business.
- **Escalation:** Meta Business Support Inbox (`business.facebook.com/support`). Expect several business days per response round; start early.

### 3.6.3 Becoming a Meta Tech Provider (operator of Wakeel)

D-002 has each firm onboard via Embedded Signup, which means **Wakeel must be registered as a WhatsApp Business Solution Provider / Tech Provider**, not just an ordinary app owner.

- Apply at `business.facebook.com` → Partner → **Become a Tech Provider** (or Solution Partner). Pakistan is an accepted market for this program.
- **App Review scope you'll request:** `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`. Document the data flow honestly — Meta reviewers read these.
- **Public URLs you must host on the Wakeel domain** (mandatory, also ties to D-005 PECA/PDPB posture):
  - Privacy Policy
  - Terms of Service
  - **Data Deletion Instructions / callback endpoint** — Meta verifies this exists and works.
- **Timeline:** review-on-review; budget 2–6 weeks realistically for a new Tech Provider from PK. Start this before you onboard paying firms — it's on the critical path (R1).

### 3.6.4 Paying Meta from Pakistan

Meta bills WhatsApp Cloud API per-message, in **USD**, on a recurring card charge. This is where most PK operators get blocked.

- **Most Pakistani-bank PKR cards fail recurring USD billing** on Meta — even if the first auth succeeds, subsequent ones often decline.
- **Reliable paths:**
  - A **USD-denominated account + card from a PK bank** (e.g. Meezan Bank USD-aisa account + USD card, Standard Chartered USD account, Faysal). Fund via remittance or PK bank inward remittance.
  - A **virtual USD card** funded via remittance — Wise, Payoneer (note Payoneer has its own KYC/billing rules; confirm it accepts Meta's billing descriptor before relying on it).
- **Keep the card's billing name consistent with the Meta Business Manager legal entity name** — Meta's risk team sometimes re-checks cardholder name vs. verified business; mismatches can disable billing mid-month.
- Meta's UI does not offer Pakistani PKR payment methods or Facebook Payments Lite in PK; only card billing is available.

### 3.6.5 Local quirks to know

- **No local payment rail in Meta billing** — see 3.6.4. The downstream client payment rails (JazzCash/Easypaisa, D-008) are unaffected; this only concerns what *you pay Meta*.
- **Time handling:** the 24h session window (`session_window_expires_at`, D-003) and all queue/attempts are computed server-side in **UTC**. Pakistan is PKT = UTC+5. Verify the dashboard converts UTC timestamps to PKT for display — `apps/web` should render via the tenant's locale, not raw UTC.
- **Weekend definition:** PK weekend is Saturday + Sunday. Confirm the tenant working-hours default in `FR-APT-01` (appointments) reflects this, not the US Mon–Fri convention.
- **Language:** Roman-Urdu and English-mixed input is handled per D-004. No setup needed — just make sure both EN and UR template packs are submitted per WABA during onboarding (D-049).
- **Connectivity:** `graph.facebook.com` and webhooks (outbound from Wakeel to Meta) are fine from PK datacenter/home ISPs. Inbound Meta→PK webhooks only need a clean public HTTPS IP; no special whitelisting of Meta's egress ranges is required.

### 3.6.6 End-to-end PK operator checklist

1. SECP + NTN docs in the firm's exact legal name; address matches a utility bill.
2. Fresh +92 SIM, activated in the firm's name, **not** registered on consumer WhatsApp.
3. Business Manager created in the firm's legal name; verification submitted.
4. (Operator of Wakeel) Tech Provider / Solution Partner application submitted + App Review scheduled.
5. USD billing card (PK-bank USD or virtual USD) ready, cardholder name matching the Business Manager entity.
6. Wakeel deployed with a public HTTPS domain; Privacy Policy, Terms, Data Deletion callback live.
7. `apps/api/.env` filled per sections 3.1–3.4; webhook reachable at `https://your-domain/backend/whatsapp/webhook`.
8. Embedded Signup run from the dashboard → WABA + number bound to tenant → template pack submitted (EN+UR) → wait for APPROVED.
9. Send a test message to the +92 number from a real phone; watch logs hit `/v1/webhooks/whatsapp`, the inbound persisted, and the AI reply dispatched.

---

## 3.7 Testing WhatsApp locally with Meta's test number (no verification)

Before you go through days of Business Verification, you can test the real inbound/outbound WhatsApp message path using Meta's **temporary test phone number** and token.

### 3.7.1 Get the test credentials

1. Go to your Meta app dashboard → **WhatsApp** → **Getting Started**.
2. Copy:
   - **Test phone number** (e.g. `+1 555 123 4567`)
   - **Phone number ID** (a long numeric ID, e.g. `123456789012345`)
   - **WhatsApp Business Account ID** (also numeric, e.g. `987654321098765`)
   - **Temporary access token** (starts with `EAA...`)

These expire, so this is only for local development.

### 3.7.2 Register the test number in Wakeel

Use the dev helper script (no code changes, no full Embedded Signup):

```bash
cd apps/api
node scripts/seed-test-whatsapp.js \
  --phoneNumberId=123456789012345 \
  --wabaId=987654321098765 \
  --displayPhoneNumber="+1 555 123 4567" \
  --accessToken=EAA...
```

This upserts `platform.wa_routes` (so inbound webhooks can be routed to the tenant before RLS context exists) and `app.whatsapp_accounts` (the encrypted token Wakeel uses for outbound sends). It uses the same AES-256-GCM encryption as `CryptoService`.

If you also need the starter template pack in the DB, call:

```bash
curl -X POST \
  -H "x-tenant-id: 018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e" \
  http://localhost:3001/v1/whatsapp/templates/seed-defaults
```

(These templates are `DRAFT` locally — Meta approval is only required for production sends. The test number can usually send free-form session messages without pre-approved templates.)

### 3.7.3 Expose the webhook publicly

Meta cannot reach `http://localhost`. Use ngrok:

```bash
ngrok http 3001
```

Copy the HTTPS URL, e.g. `https://a1b2-3-4-5-6.ngrok-free.app`.

### 3.7.4 Configure the webhook in Meta

1. Meta app dashboard → WhatsApp → Configuration → Webhook → **Edit**.
2. Callback URL: `https://<ngrok>/v1/webhooks/whatsapp`
3. Verify token: the same value you set in `META_WEBHOOK_VERIFY_TOKEN`.
4. Subscribe to fields: `messages`, `message_status`.

### 3.7.5 Send a test message

1. Add the test phone number to your phone's contacts (optional but makes it easier).
2. Open WhatsApp and send a message to that test number.
3. Watch the API logs:
   - `POST /v1/webhooks/whatsapp` receives the inbound message
   - Webhook event is persisted, normalized, and enqueued
   - AI pipeline runs and queues an outbound reply
   - `SendService` calls Meta Graph API with the encrypted token

If the AI reply is queued but not sent, check:
- the access token hasn't expired (Meta test tokens are short-lived)
- the worker role is running (`API_ROLE=worker`) so BullMQ jobs are consumed
- outbound queue logs for Meta error codes (e.g. `131047` = outside 24h window)

### 3.7.6 Limitations of the test number

- **Cannot send to arbitrary numbers** — Meta test numbers usually only allow messaging to a small set of pre-registered recipient numbers you add in the dashboard.
- **Token expires** — regenerate it in the Meta dashboard when it does, then re-run `seed-test-whatsapp.js`.
- **No template approval needed** for basic session-message testing, but production firms still need the §3.6 / D-002 onboarding path.

---

## 3.8 Testing the automation with Twilio Sandbox (no business approval)

Twilio Sandbox is suitable for confirming that Wakeel receives a real WhatsApp
message, runs the automation, and sends its reply. It is **not** a production
sender: each tester must first join the sandbox, and the shared sandbox number
must not be used by real clients.

1. Create a Twilio account and open **Messaging → Try it out → Send a WhatsApp message**.
2. From the test phone, send Twilio's displayed `join <code>` message to the
   displayed sandbox number. Twilio then permits that phone to exchange sandbox
   messages.
3. Copy the Account SID and Auth Token into `apps/api/.env`:

   ```dotenv
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```

   Use the sender shown in the Twilio Console if it differs from the default.
4. Register the sandbox sender for the development tenant:

   ```bash
   cd apps/api
   node scripts/seed-twilio-sandbox.js
   ```

5. Start the API and worker in separate terminals, then expose the API over
   HTTPS, for example with `ngrok http 3001`.
6. In the Twilio Sandbox configuration, set **When a message comes in** to:

   ```text
   https://<your-ngrok-host>/v1/webhooks/twilio
   ```

   Use `POST` and save. Do not add `/backend`; that prefix belongs only to the
   browser-to-API reverse proxy.
7. Send a normal WhatsApp message from the joined phone to the sandbox number.
   Wakeel should ingest it, queue the AI automation, and reply from the sandbox.

If Twilio reports error `63007`, the test phone has not joined the sandbox (or
its sandbox session has expired); repeat the displayed `join <code>` step.

## 3.9 Configuring the Meta app for production

This section assumes you have already created the Meta app (App Name, App Email, Use case = WhatsApp) and are now inside the Meta dashboard.

### 3.9.1 Important: business identity first

Before submitting for review, the app's Business Manager should represent a **registered business entity** (SECP + NTN in Pakistan), not a personal name. A student email (`@student.uol.edu.pk`) or personal Business Manager (`Hassan Baig`) is likely to fail Business Verification and Tech Provider review. Use:

- App contact email: `admin@your-domain.com` or similar business-domain address
- Business Manager: registered company's legal name
- Domain: your own domain (`wakeel.pk` etc.) with working `/privacy`, `/terms`, and `/data-deletion` pages

### 3.9.2 Add the WhatsApp product

1. Left sidebar → **Add product**.
2. Find **WhatsApp** → click **Set up**.
3. Link a Business Manager if prompted.

### 3.9.3 WhatsApp → Getting Started (test credentials)

1. Copy the **test phone number**, **Phone Number ID**, **WhatsApp Business Account ID**, and **temporary access token**.
2. Use `scripts/seed-test-whatsapp.js` (§3.7.2) to bind them to the dev tenant for local testing.

### 3.9.4 WhatsApp → Configuration

| Setting | Value |
|---|---|
| Webhook URL | `https://your-domain.com/backend/whatsapp/webhook` |
| Verify token | Same as `META_WEBHOOK_VERIFY_TOKEN` in `apps/api/.env` |
| Subscribed fields | `messages`, `message_status` |
| Valid OAuth Redirect URIs | `https://your-domain.com/backend/whatsapp/onboarding/complete` |

> **Note:** `your-domain.com` is the public domain where Wakeel is deployed. For local testing with ngrok, replace it with the ngrok HTTPS URL (§3.7.3).

### 3.9.5 App → Settings → Basic

| Field | Value |
|---|---|
| App domains | `your-domain.com` |
| Privacy Policy URL | `https://your-domain.com/privacy` |
| Terms of Service URL | `https://your-domain.com/terms` |
| Data Deletion Instructions URL | `https://your-domain.com/data-deletion` |
| Category | Business and Pages → Legal or Business Services |
| App icon | Upload a product logo (required for App Review) |

Wakeel already serves `/privacy`, `/terms`, and `/data-deletion` as static pages (see `apps/web/src/app/privacy|terms|data-deletion/page.tsx`). Replace the placeholder `[Your registered business name]` and email addresses in those files before deploying.

### 3.9.6 Permissions & Features / Use cases

Add and request approval for:

- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `business_management`

For each permission, Meta asks for a screencast and description. Record a short video showing:

1. A law firm logging into Wakeel.
2. Navigating to WhatsApp onboarding.
3. Completing Embedded Signup (or selecting a WABA).
4. Sending/receiving a WhatsApp message through the dashboard.
5. Explaining that each firm gets its own WABA and +92 number (D-002).

### 3.9.7 Become a Meta Tech Provider (required for D-002)

Wakeel onboards each law firm via Embedded Signup, so you must be approved as a WhatsApp Business Solution Provider / Tech Provider:

1. Go to `business.facebook.com` → **Settings** → **Business Use** → **Become a Tech Provider**.
2. Complete the application with your registered business details, privacy policy, and a description of Wakeel.
3. Link the Wakeel app.
4. Expected timeline: 2–6 weeks.

Without Tech Provider status, you can only use one WABA (your own) and cannot onboard other firms.

### 3.9.8 Business Verification

1. In Business Manager, start **Business Verification**.
2. Submit from Pakistan:
   - SECP incorporation/registration certificate
   - NTN/PRAL tax certificate
   - Utility bill or bank statement matching the business name and address
   - Live business website
3. Expected timeline: 3–14 days, often with back-and-forth for document corrections.

### 3.9.9 App Review submission

Only submit for App Review after:

- [ ] Business Verification is approved
- [ ] Tech Provider application is submitted (can be in parallel)
- [ ] `/privacy`, `/terms`, `/data-deletion` pages are live on your domain
- [ ] Webhook is publicly reachable and responding 200 to Meta verification
- [ ] Embedded Signup works end-to-end in test mode
- [ ] Screencast video is uploaded for each permission

Typical App Review timeline: 3–10 days.

### 3.9.10 Production deployment checklist

- [ ] Set `NODE_ENV=production`, `API_ROLE=api|worker` in `docker-compose.prod.yml`
- [ ] Fill all secrets in `.env` (Clerk, Meta, AI, SMTP, etc.)
- [ ] Run migrations once: `docker compose -f docker-compose.prod.yml up -d migrate`
- [ ] Start services: `docker compose -f docker-compose.prod.yml up -d`
- [ ] Verify health: `curl http://localhost/health` (nginx → api)
- [ ] Point your domain's DNS to the server
- [ ] Configure Meta webhook and OAuth redirect URIs to use your real domain
- [ ] Issue an SSL certificate (nginx config expects HTTPS; use Let's Encrypt or your host)

---

## 4. Required for AI features

At least one provider key is required. The model router falls back through providers based on the tenant allow-list and agent needs.

### 4.1 OpenAI
- **Sign up:** https://platform.openai.com/
- **Get key:** Settings → API keys → Create new secret key.
- **Paste into:** `apps/api/.env` → `OPENAI_API_KEY=sk-...`
- **Custom / OpenAI-compatible endpoints:** set `OPENAI_BASE_URL=https://your-provider.com/v1` (defaults to `https://api.openai.com/v1`).
- **Models used by default:** `gpt-4o-mini` (router/intent), `gpt-4o` (stronger agents). Set `AI_DEFAULT_MODEL=` to the model your provider supports.
- **List available models:** `curl $OPENAI_BASE_URL/models -H "Authorization: Bearer $OPENAI_API_KEY"`.
- **Embeddings:** set `OPENAI_EMBEDDING_BASE_URL` if your provider exposes `/embeddings`; otherwise leave it empty to use OpenAI directly (requires a real OpenAI key for RAG).
- **Make sure:** your account has credit/quota and the models are enabled in your project.

### 4.2 Anthropic (optional fallback)
- **Sign up:** https://console.anthropic.com/
- **Get key:** Account → API keys.
- **Paste into:** `apps/api/.env` → `ANTHROPIC_API_KEY=sk-ant-...`

### 4.3 Google Gemini (optional fallback)
- **Sign up:** https://aistudio.google.com/app/apikey
- **Get key:** Create API key.
- **Paste into:** `apps/api/.env` → `GOOGLE_GENERATIVE_AI_API_KEY=...`

---

## 5. Optional production services

### 5.1 Object storage for documents (Supabase or S3)
The dev seam stores files on disk (`MEDIA_STORAGE_PATH`). Production should use Supabase Storage or S3.

- **Sign up:** https://supabase.com/
- **Create a project.**
- **Get values:** Project Settings → API:
  - `SUPABASE_URL` — Project URL.
  - `SUPABASE_SERVICE_ROLE_KEY` — service_role key (keep secret).
- **Create bucket:** Storage → New bucket named `tenant-documents`, set to private.
- **Paste into:** `apps/api/.env`
  ```
  SUPABASE_URL=https://....supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  SUPABASE_STORAGE_BUCKET=tenant-documents
  ```

### 5.2 Document AI (optional)
For OCR/extraction of uploaded ID cards/documents.

- **Console:** https://console.cloud.google.com/
- **Enable Document AI API** and create a processor.
- **Paste into:** `apps/api/.env`
  ```
  GOOGLE_DOCUMENT_AI_PROJECT=your-gcp-project-id
  GOOGLE_DOCUMENT_AI_LOCATION=us
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID=...
  ```

### 5.3 Email digest (optional)
For payment receipts to the firm owner and weekly staff digests.

- Use any SMTP provider (Gmail app password, Mailgun, SendGrid SMTP, Resend, Amazon SES, etc.).
- `EMAIL_FROM` must be a bare address (the boot validator rejects `Name <email>`).
- Port **465** uses implicit TLS; port **587** uses STARTTLS.
- **Paste into:** `apps/api/.env`
  ```
  EMAIL_FROM=notifications@your-domain.com
  SMTP_HOST=smtp.mailgun.org
  SMTP_PORT=465
  SMTP_USER=postmaster@your-domain.com
  SMTP_PASS=...
  ```

### 5.4 Web push notifications (optional)
Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

- **Paste into:** `apps/api/.env`
  ```
  VAPID_PUBLIC_KEY=BL...
  VAPID_PRIVATE_KEY=...
  VAPID_SUBJECT=mailto:admin@your-domain.com
  ```

### 5.5 Observability (optional)
- **Sentry:** https://sentry.io/ — create a project, copy DSN.
  ```
  SENTRY_DSN=https://...@....ingest.sentry.io/...
  ```
- **OpenTelemetry:** self-hosted collector endpoint, e.g.
  ```
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
  ```

---

## 6. Frontend `.env.local` summary

```bash
# Server-side: where Next.js proxies /backend/*
API_INTERNAL_URL=http://localhost:3001

# Public API path (must match NGINX rewrite)
NEXT_PUBLIC_API_BASE=/backend

# Clerk publishable key (browser)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Dev seam tenant (only used when Clerk keys are absent)
NEXT_PUBLIC_DEV_TENANT_ID=018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e
```

---

## 7. Backend `.env` summary

See `.env.example` for the full template. Minimum required values for a live test:

```bash
NODE_ENV=production
API_PORT=3001
API_ROLE=api

DATABASE_URL=postgresql://app_user:...@localhost:5432/lawyer_agency
MIGRATION_DATABASE_URL=postgresql://postgres:...@localhost:5432/lawyer_agency
REDIS_URL=redis://localhost:6379

MASTER_ENCRYPTION_KEY=...64-hex-chars...

CLERK_SECRET_KEY=sk_test_...
APP_PUBLIC_URL=https://your-domain.com

META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...random-hex...
META_GRAPH_BASE_URL=https://graph.facebook.com/v22.0
META_REDIRECT_URI=https://your-domain.com/backend/whatsapp/onboarding/complete

OPENAI_API_KEY=sk-...
```

---

## 8. Quick live-test checklist

1. Fill `.env` files.
2. Start dependencies: `docker compose up -d`
3. Run migrations: `cd apps/api && npx prisma migrate deploy`
4. Start API: `cd apps/api && npm run start` (or `API_ROLE=worker` in a second terminal).
5. Start web: `cd apps/web && npm run dev`.
6. Expose API to HTTPS:
   - For local: `ngrok http 3001` and set Meta webhook to the ngrok `/backend/whatsapp/webhook` URL.
   - For server: use the Docker Compose prod stack + `docker compose -f docker-compose.prod.yml up -d`.
7. Send a WhatsApp message to the connected number.
8. Watch logs: you should see the webhook hit `/backend/whatsapp/webhook`, the message persisted, and an AI response queued/sent.

If any key is missing the backend will fail fast at boot with a zod validation error telling you exactly which env var is required.

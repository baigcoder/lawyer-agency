# Docker Topology & Service Orchestration

## 1. Overview & Multi-Container Architecture

Wakeel employs a modular, containerized micro-service topology built on Docker Compose. The architecture cleanly separates state stores, messaging brokers, application roles, AI inference engines, and WhatsApp gateway transports.

The application container image (`apps/api/Dockerfile`) is built once and instantiated under three distinct roles via the `API_ROLE` environment variable:
1. `API_ROLE=api`: Ingests HTTP traffic, serves `/backend/*` routes, processes webhooks, and manages transactional outbox dispatch.
2. `API_ROLE=worker`: Consumes asynchronous BullMQ queues, executes AI pipeline turns, processes document OCR, and orchestrates reminder crons.
3. `API_ROLE=voice`: Operates as the real-time AI WhatsApp Receptionist, terminating WebRTC media streams and SIP/RTP voice calls.

---

## 2. Service Inventory Matrix

| Service | Base Image / Build Context | Role / Function | Ports (Host:Container) | Volumes | Healthcheck Probe |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | Custom build (`infra/postgres/Dockerfile`) based on `postgres:16-alpine` + `pgvector` + `btree_gist` | Primary multi-tenant database storing `platform` and `app` schemas. | `5432:5432` | `pgdata:/var/lib/postgresql/data` | `pg_isready -U postgres` |
| **`redis`** | `redis:7-alpine` | Job queue broker for BullMQ, distributed locks, rate-limiting counters. | `6379:6379` | `redisdata:/data` (AOF enabled) | `redis-cli ping` |
| **`migrate`** | `apps/api/Dockerfile` (target: `migrator`) | One-shot startup container running `prisma migrate deploy` as DB owner. | None | None | Runs to exit code 0 |
| **`seed`** (Dev only) | `infra/postgres/Dockerfile` | One-shot container seeding the development tenant (`NEXT_PUBLIC_DEV_TENANT_ID`). | None | None | Runs to exit code 0 |
| **`api`** | `apps/api/Dockerfile` (target: `runner`) | REST API monolith (`API_ROLE=api`), Clerk JWT verification, Outbox scheduler. | `3001:3001` | `wakeel_media:/var/lib/wakeel/media` | `wget -qO- http://localhost:3001/health` |
| **`worker`** | `apps/api/Dockerfile` (target: `runner`) | BullMQ queue worker (`API_ROLE=worker`), LLM agent turns, Whisper OCR, TTS. | None | `wakeel_media:/var/lib/wakeel/media` | Process supervisor |
| **`voice`** | `apps/api/Dockerfile` (target: `runner`) | AI Receptionist (`API_ROLE=voice`), WebRTC (`werift`), Wavoip SIP/RTP receiver. | `5060:5060/tcp,udp`, `40000-40031:udp` | `wakeel_media:/var/lib/wakeel/media` | Process supervisor |
| **`embeddings`** | `ghcr.io/huggingface/text-embeddings-inference:cpu-latest` | Local embedding microservice hosting `intfloat/multilingual-e5-small`. | `8081:80` | `embedding-models:/data` | `curl -fsS http://localhost:80/health` |
| **`evolution-postgres`** | `postgres:16-alpine` | Dedicated database for Evolution API WhatsApp session store. | `5433:5432` | `evolution_pgdata:/var/lib/postgresql/data` | `pg_isready -U postgres` |
| **`evolution-redis`** | `redis:7-alpine` | Dedicated caching layer for Evolution API Baileys pre-keys. | `6380:6379` | `evolution_redisdata:/data` | `redis-cli ping` |
| **`evolution-api`** | Custom build (`infra/evolution/Dockerfile`) with Wavoip Baileys UWP patch | Multi-instance WhatsApp gateway managing Baileys QR sessions and Cloud API webhooks. | `8080:8080` | None | `wget -qO- http://localhost:8080/` |
| **`web`** (Prod) | `apps/web/Dockerfile` | Next.js 16 standalone Node.js server hosting lawyer dashboard. | None | None | HTTP GET `/` |
| **`nginx`** (Prod) | `nginx:alpine` (`infra/nginx/nginx.conf`) | Edge reverse proxy, SSL termination, `/backend/*` rewrite, service worker scoping. | `80:80`, `443:443` | `infra/nginx/nginx.conf` | `nginx -t` |

---

## 3. Container Topology Diagram

```mermaid
graph TD
    Client[Advocate Browser / Mobile] -->|Port 80/443| NGINX[nginx:alpine]
    WhatsApp[Meta Cloud / WhatsApp Client] -->|Port 8080| Evolution[evolution-api]
    Wavoip[Wavoip SIP / Audio RTP] -->|Port 5060/40000-40031| VoiceContainer[wakeel-api:voice]

    NGINX -->|/| WebContainer[wakeel-web]
    NGINX -->|/backend/*| ApiContainer[wakeel-api:api]
    
    Evolution -->|Webhook POST /v1/whatsapp/webhook| ApiContainer
    ApiContainer -->|REST commands| Evolution

    ApiContainer -->|DB Queries (app_user)| Postgres[(PostgreSQL 16 + pgvector)]
    WorkerContainer[wakeel-api:worker] -->|DB Queries (app_user)| Postgres
    VoiceContainer -->|DB Queries (app_user)| Postgres
    
    ApiContainer -->|BullMQ Jobs / Outbox| Redis[(Redis 7)]
    WorkerContainer -->|Consume Queues| Redis
    VoiceContainer -->|PubSub Events| Redis

    WorkerContainer -->|POST /v1/embeddings| EmbeddingsContainer[text-embeddings-inference]
    VoiceContainer -->|POST /v1/embeddings| EmbeddingsContainer

    Evolution --> EvolutionPG[(evolution-postgres)]
    Evolution --> EvolutionRedis[(evolution-redis)]

    WorkerContainer -.->|Store/Read Voice Audio| SharedMedia[wakeel_media Volume]
    ApiContainer -.->|Stream Audio to Dashboard| SharedMedia
    VoiceContainer -.->|Dump Call Recordings| SharedMedia
```

---

## 4. Startup Ordering & Dependency Flow

Docker Compose enforces strict dependency health constraints:

1. **Phase 1 (Base Storage):** `postgres`, `redis`, `evolution-postgres`, and `evolution-redis` initialize and report healthy via `pg_isready` and `redis-cli ping`.
2. **Phase 2 (Database Migration):** The `migrate` container boots, runs `prisma migrate deploy` against `postgres`, and exits with code 0.
3. **Phase 3 (Database Seeding - Dev only):** The `seed` container executes `/seed.sql.seed` to initialize the dev tenant and exits with code 0.
4. **Phase 4 (Gateways & Inference):** `evolution-api` and `embeddings` start up. `evolution-api` waits for its internal Postgres and Redis before declaring healthy.
5. **Phase 5 (Application Monolith):** `api`, `worker`, and `voice` containers start in parallel once migrations, database, Redis, and Evolution API are healthy.
6. **Phase 6 (Edge Proxy):** `web` and `nginx` initialize, exposing the unified platform interface on port 80.

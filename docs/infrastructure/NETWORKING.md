# Network Architecture & Traffic Routing

## 1. Internal Docker Bridge Network & DNS Topology

Wakeel services operate within an isolated, user-defined Docker bridge network. Service-to-service communication relies on Docker's embedded DNS server (`127.0.0.11`), allowing containers to resolve peers via canonical service hostnames:

```
                    INTERNET / CLIENT ACCESS
                               │
               ┌───────────────┴───────────────┐
               │                               │
         HTTPS: 443 / HTTP: 80           SIP: 5060 (UDP/TCP)
               │                         RTP: 40000-40031 (UDP)
               ▼                               │
      ┌─────────────────┐                      │
      │   nginx:edge    │                      │
      └────────┬────────┘                      │
               │                               │
   ┌───────────┴───────────┐                   │
   │ /                     │ /backend/*        │
   ▼                       ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  web:3000    │    │   api:3001   │    │  voice:5060  │
└──────────────┘    └──────┬───────┘    └──────┬───────┘
                           │                   │
                           ├───────────────────┼──────────────────┐
                           ▼                   ▼                  ▼
                  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐
                  │  postgres:5432  │ │   redis:6379    │ │embeddings:80  │
                  └─────────────────┘ └─────────────────┘ └───────────────┘
                           ▲                   ▲
                           │                   │
                  ┌────────┴────────┐          │
                  │  worker:runner  │──────────┘
                  └─────────────────┘
```

---

## 2. Port Allocation & Exposure Matrix

| Port | Protocol | Boundary | Target Service | Operational Description |
| :--- | :--- | :--- | :--- | :--- |
| **`80` / `443`** | TCP | Public Edge | `nginx` | Standard HTTP/HTTPS ingress. SSL terminated by NGINX via Let's Encrypt Certbot. |
| **`3000`** | TCP | Internal Only | `web` | Next.js 16 App Router SSR dashboard server. Not exposed directly to public internet. |
| **`3001`** | TCP | Internal / Dev | `api` | NestJS REST API. Routed internally via `/backend/*`. In dev, exposed for local inspection. |
| **`5060`** | UDP / TCP | Public Edge | `voice` | SIP signaling port for inbound Wavoip WhatsApp live calls. |
| **`40000–40031`** | UDP | Public Edge | `voice` | RTP media stream port range for real-time WebRTC audio packets (`werift`). |
| **`5432`** | TCP | Internal / Dev | `postgres` | Primary PostgreSQL database. Bound to internal network in production. |
| **`5433`** | TCP | Internal / Dev | `evolution-postgres` | PostgreSQL instance dedicated to Evolution API session storage. |
| **`6379`** | TCP | Internal | `redis` | Primary Redis broker for BullMQ job queues and distributed locks. |
| **`6380`** | TCP | Internal | `evolution-redis` | Redis instance dedicated to Evolution API Baileys pre-key caching. |
| **`8080`** | TCP | Public / RevProxy | `evolution-api` | Evolution API REST interface and webhook receiver. |
| **`8081`** | TCP | Internal | `embeddings` | Text Embeddings Inference engine (`multilingual-e5-small`) running on port 80. |

---

## 3. Same-Origin Routing Convention (Zero CORS)

To eliminate Cross-Origin Resource Sharing (CORS) security vulnerabilities and browser preflight overhead (`OPTIONS` requests), the web frontend interacts with the API exclusively through **same-origin proxying** ([D-038](file:///f:/lawyer_agency/docs/decision-log.md)).

### 3.1 Production Reverse Proxy (`infra/nginx/nginx.conf`)
NGINX intercepts all `/backend/*` URIs and transparently rewrites them to the internal NestJS API:
```nginx
location /backend/ {
    proxy_pass http://api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

### 3.2 Local Dev Next.js Proxy (`apps/web/next.config.ts`)
During local frontend development without NGINX, Next.js performs identical rewrites:
```typescript
async rewrites() {
  return [
    {
      source: '/backend/:path*',
      destination: `${process.env.API_INTERNAL_URL || 'http://localhost:3001'}/:path*`,
    },
  ];
}
```

---

## 4. Web Push Service Worker Root Scoping

Web Push notifications (`NotificationChannel.WEB_PUSH`) require the service worker script to reside at the root scope (`/`) to control all dashboard pages. Because the Next.js App Router dynamic route handler can interfere with static asset serving, NGINX routes `/service-worker.js` directly to the static public folder and injects the `Service-Worker-Allowed` header:
```nginx
location = /service-worker.js {
    proxy_pass http://web/service-worker.js;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    add_header Service-Worker-Allowed "/";
}
```

---

## 5. WhatsApp Voice NAT Traversal & RTP Media Routing

Pakistani cellular internet providers (Jazz, Telenor, Zong, Ufone) operate behind Carrier-Grade NAT (CGNAT) with aggressive UDP state timeouts. 

To maintain crystal-clear audio during WhatsApp audio receptionist calls:
1. **RTP Port Windowing:** The WebRTC ICE port range is tightly clamped to UDP ports `40000-40031` (`WEBRTC_ICE_PORT_MIN` / `WEBRTC_ICE_PORT_MAX`), permitting precise firewall rule definitions without opening large port blocks.
2. **STUN/TURN Relay:** When direct peer-to-peer UDP connectivity fails, media is relayed through a Coturn server (`WEBRTC_TURN_URL`), authenticating via ephemeral credentials.
3. **Wavoip SIP Trunking:** For Baileys QR instances, signaling traverses SIP port `5060` directly to `sipv2.wavoip.com`, streaming G.711 PCMU (8kHz) audio.

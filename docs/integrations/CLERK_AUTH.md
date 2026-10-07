# Clerk Authentication & Multi-Tenant Identity Model

## 1. Overview & Multi-Tenant Mapping

User authentication and law firm organization membership are managed by **Clerk v7** ([D-017](file:///f:/lawyer_agency/docs/decision-log.md)). Clerk serves as the identity provider for all desktop dashboard users (advocates, partners, paralegals, and billing staff). Note that end-clients interact exclusively through WhatsApp and do not possess Clerk accounts.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Clerk B2B                                 │
│                                                                        │
│   ┌────────────────────────────────┐  ┌────────────────────────────┐   │
│   │   Organization: org_88291      │  │   Organization: org_44102   │   │
│   │   "Malik & Associates"         │  │   "Chaudhry Law Chambers"  │   │
│   │                                │  │                            │   │
│   │ • User: user_advocate_tariq    │  │ • User: user_advocate_ali  │   │
│   │ • User: user_paralegal_zain    │  │ • User: user_clerk_usman   │   │
│   └────────────────┬───────────────┘  └─────────────┬──────────────┘   │
└────────────────────┼────────────────────────────────┼──────────────────┘
                     │ 1:1 Mapping                    │ 1:1 Mapping
                     ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Wakeel PostgreSQL Engine                        │
│                                                                        │
│   platform.tenants:                                                    │
│   • id: "7a2f...-uuid"             • id: "e14b...-uuid"                │
│   • clerkOrgId: "org_88291"        • clerkOrgId: "org_44102"           │
│                                                                        │
│   app.users (RLS Scoped):          app.users (RLS Scoped):             │
│   • clerkUserId: "user_advocate_t" • clerkUserId: "user_advocate_a"    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. JWT Verification & Token Lifecycle

Client requests sent from the Next.js dashboard through `/backend/*` carry Clerk session JWT tokens:

### 2.1 Verification Flow (`ClerkAuthGuard`)
1. Controller intercepts HTTP request with `Authorization: Bearer <jwt>`.
2. NestJS auth module fetches and caches Clerk public signing keys from `CLERK_JWKS_URL`.
3. Verifies token integrity via RS256 algorithm and checks expiration (`exp`).
4. Extracts JWT claims:
   - `sub`: Clerk User ID (`user_2...`).
   - `org_id`: Active Clerk Organization ID (`org_2...`).
   - `org_role`: Role within firm (`org:admin` vs `org:member`).
5. **Tenant Resolution:** Maps `org_id` to `platform.tenants.id`.
6. **Transaction Context:** Injects resolved tenant ID into transaction context (`SET LOCAL app.tenant_id = :tenantId`).

---

## 3. RBAC Synchronization: Owner vs Invited Lawyer (D-116)

When new team members join a law firm, their roles synchronize seamlessly:

| Clerk Organization Role | Wakeel Internal Role (`app.roles`) | Permissions Granted |
| :--- | :--- | :--- |
| **`org:admin` (Firm Owner / Partner)** | **Firm Admin** | Full access: manage billing, invite lawyers, configure WhatsApp WABA, view firm-wide analytics, delete cases. |
| **`org:member` (Associate Advocate)** | **Lawyer** | Practice operations: manage assigned cases, client chat, book consultations, upload pleadings, manage diary. |
| **`org:member` (Legal Assistant / Clerk)**| **Staff** | Administrative: schedule appointments, intake review, record manual fee receipts. Cannot edit legal advice notes. |

---

## 4. The Development Seam Fallback (D-017)

To allow developers to build, test, and run full test suites locally without requiring active internet connectivity or valid Clerk API keys, Wakeel provides an environment-gated **Development Seam**:

### 4.1 Activation Criteria
If `CLERK_SECRET_KEY` is omitted or empty, both `apps/api` and `apps/web` gracefully activate the dev seam.

### 4.2 Behavior
- Web app automatically injects development headers:
  - `x-tenant-id`: Defaults to `NEXT_PUBLIC_DEV_TENANT_ID`.
  - `x-user-id`: Defaults to `NEXT_PUBLIC_DEV_USER_ID`.
- Backend bypasses JWT signature checking and verifies that the provided `x-tenant-id` exists in `platform.tenants`.
- The development tenant is automatically initialized during stack startup via `infra/postgres/seed-dev-tenant.sql.seed`.

### 4.3 Production Stripping
The production Docker build (`apps/web/Dockerfile`) **deliberately excludes** `NEXT_PUBLIC_DEV_TENANT_ID` from the build environment arguments. Consequently, the dev seam cannot be invoked in production.

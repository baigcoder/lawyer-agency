# Wakeel — User Roles & Permissions

**Status:** IMPLEMENTED BASELINE & RBAC SPECIFICATION  
**Classification:** Authorization Model, User Roles, Permissions, and Clerk Mapping  
**Source Code References:** `apps/api/src/modules/auth/`, `apps/api/src/modules/users/`, `apps/web/src/lib/permissions.ts`, `docs/decision-log.md` (D-071, D-116)

---

## 1. Persona Definitions in Pakistani Legal Practice

### 1.1 Managing Partner / Senior Advocate (Firm Owner)
- **Profile:** Advocate Supreme Court or Senior Advocate High Court. Owns the law firm, manages major corporate and high-stakes litigation, sets consultation fees, and controls firm operations.
- **Goals:** Eliminate intake chaos, protect firm reputation, prevent uncaptured consultation fees, ensure high-urgency matters are attended to immediately, and maintain strict data confidentiality.
- **Key Actions in Wakeel:** Configures AI tone and auto-reply rules, connects firm WhatsApp number via QR or official Meta WABA, verifies payment receipts, reviews analytics, and invites associates and clerks.

### 1.2 Associate Advocate / Junior Lawyer
- **Profile:** Advocate High Court or Subordinate Courts. Conducts research, drafts pleadings, attends morning court hearings, and interviews qualified leads.
- **Goals:** Get clear, concise case briefs without scrolling through hundreds of chaotic WhatsApp messages; quickly access client documents; stay on top of morning court diary cause lists.
- **Key Actions in Wakeel:** Reads structured Lawyer Handoff Briefs, conducts consultations, syncs appointments with Google Calendar, transitions case statuses, and adds internal case notes.

### 1.3 Court Clerk / Legal Assistant (*Munshi*)
- **Profile:** Legal administrative assistant responsible for physical court filings, cause-list tracking, client reception, and payment logistics.
- **Goals:** Ensure court dates are logged accurately, request missing client documents (challan, CNIC, fard), and mark fee payments received.
- **Key Actions in Wakeel:** Logs next court hearing dates, checks document upload receipts, sends bank details, and flags unread messages.

### 1.4 The WhatsApp Client (Litigant / Citizen)
- **Profile:** Individual or business representative in Pakistan seeking legal assistance. Operates exclusively from WhatsApp (English, Urdu, or Roman Urdu).
- **Goals:** Obtain fast, dignified reassurance; understand legal fees and process; book an advocate consultation without telephone delays; upload documents easily.
- **Key Actions:** Messages firm number, answers intake questions, receives appointment confirmations, sends payment screenshots, and receives PDF receipts.

---

## 2. Role Taxonomy & Permission Mapping

Wakeel implements a granular, local Role-Based Access Control (RBAC) engine backed by `app.roles` and `app.role_permissions`, with tenant-level isolation:

| Permission Name | Category | Managing Partner (Owner) | Associate (Lawyer) | Court Clerk (Staff) |
|---|---|:---:|:---:|:---:|
| `firm-profile:read` | Profile | Yes | Yes | Yes |
| `firm-profile:write` | Profile | Yes | No | No |
| `inbox:read` | Inbox | Yes | Yes | Yes |
| `inbox:write` | Inbox | Yes | Yes | Yes |
| `cases:read` | Cases | Yes | Yes | Yes |
| `cases:write` | Cases | Yes | Yes | Yes |
| `documents:read` | Documents | Yes | Yes | Yes |
| `documents:write` | Documents | Yes | Yes | No |
| `knowledge-base:read` | Knowledge | Yes | Yes | Yes |
| `knowledge-base:write` | Knowledge | Yes | No | No |
| `appointments:read` | Calendar | Yes | Yes | Yes |
| `appointments:write` | Calendar | Yes | Yes | Yes |
| `payments:read` | Payments | Yes | Yes | Yes |
| `payments:write` | Payments | Yes | No | Yes (Manual) |
| `analytics:read` | Analytics | Yes | No | No |
| `users:read` | Team | Yes | Yes | Yes |
| `users:manage` | Team | Yes | No | No |
| `whatsapp:read` | WhatsApp | Yes | No | No |
| `whatsapp:manage` | WhatsApp | Yes | No | No |
| `notifications:write` | Settings | Yes | Yes | Yes |

---

## 3. Authentication & Organization Membership (Clerk v7)

### 3.1 Organization-Bound Tenancy (D-116)
- Every firm in Wakeel corresponds to exactly one **Clerk Organization**.
- The firm creator becomes the organization **Admin** (`org:admin`), which maps automatically to the local **Owner** role.
- Team members are invited via Clerk Organization Invitations (`POST /v1/users`). Staff receive an official invitation email from Clerk with a secure sign-in link.
- Users authenticate via JWKS-verified JWT session tokens.
- On first login, the user record is lazily provisioned in `app.users` under the tenant mapped from the Clerk organization ID (`tenant.clerkOrgId`).

### 3.2 Development Seam Fallback (D-037, D-070)
- In local development without Clerk credentials (`clerkEnabled === false`), both backend and frontend activate the development seam.
- The browser proxy automatically attaches the configured `NEXT_PUBLIC_DEV_TENANT_ID` and `NEXT_PUBLIC_DEV_USER_ID` as headers (`x-tenant-id`, `x-user-id`).
- The dev seam provisions a complete firm tenant (`dev-tenant-pk-01`) automatically via database seeds.

# Pakistan Tier-1 Backlog (Post-MVP)

Tracked gaps for paid launch in the Pakistan market. These are **not** in the owner-profile sprint — implement in separate PRs.

## Must-have for paid launch

| Item | Why it matters | Current state | Target |
|------|----------------|---------------|--------|
| **Cases detail UI** | Matter lifecycle is core to lawyers | API complete; dashboard list is read-only | Detail drawer: assign lawyer, change status, link conversation |
| **Inbox template send** | Meta 24h window forces templates | Templates API exists; inbox has no picker | Show UTILITY templates when `sessionWindowExpiresAt` passed |
| **Notification center** | Escalations need in-app alerts | `/v1/notifications` API only | Bell icon + unread list in dashboard shell |
| **Live payment rails** | JazzCash/Easypaisa expected in PK | `StubRailAdapter` only (D-096 legal gate) | Merchant agreements + real adapters |
| **Production ops** | Firms need trust in data safety | Backlog in AGENTS.md | Hosting target, backups, alerting, staging smoke tests |
| **AI red-team CI** | Legal AI must not miss escalations | FR-AI-05 suite not in CI | Red-team eval gate on PR/deploy |

## Quick wins (existing features)

- Payments UX: client/case pickers instead of raw UUIDs on payments page
- Mobile nav: add Documents + Knowledge to bottom nav
- Separate Whisper key (`OPENAI_WHISPER_API_KEY`) when LLM uses Groq
- ElevenLabs per-tenant char tracking + 80% warning

## Phase B (after owner profile)

- Per-lawyer profiles on team page (same schema, any `Lawyer` row)
- FAQ routes to assigned lawyer when conversation has `caseId`
- Urdu-first dashboard copy (optional EN toggle)

## References

- Decision log: D-003 (24h window), D-005 (T1/T2/T3), D-096 (payment rails)
- Plan: Pakistan SaaS roadmap (owner profile Phase A complete)

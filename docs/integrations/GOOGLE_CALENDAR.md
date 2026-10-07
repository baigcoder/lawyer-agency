# Google Calendar Integration — Advocate Diary Synchronization

## 1. Architectural Scope & Problem Statement

Pakistani advocates maintain rigorous daily court schedules across District Courts, Special Tribunals, High Courts, and evening chamber consultations. Advocates rely heavily on the native Google Calendar app on their smartphones to track their daily court diary.

Per Architecture Decision [D-109](file:///f:/lawyer_agency/docs/decision-log.md), Wakeel provides **Two-Way Synchronization** between the firm's appointments ledger (`app.appointments`) and individual advocates' Google Calendars (`app.lawyer_calendars`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Wakeel Lawyer Dashboard                         │
│                  (or WhatsApp AI Receptionist)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       1. Books Consultation Slot
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                            │
│  • Inserts app.appointments                                            │
│  • Enforces GIST Exclusion Constraint (No Double Booking)              │
│  • Dispatches appointment.created to Outbox                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       2. Outbox Worker Consumes
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Google Calendar Sync Service                       │
│  • Reads AES-256 encrypted refresh token                               │
│  • Obtains Google OAuth2 Bearer Token                                  │
│  • POST /calendars/primary/events                                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       3. Google Event Created
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Google Calendar API v3                           │
│  • Appears instantly on Advocate's Android / iPhone                    │
│  • Stores externalEventId back in app.appointments                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       4. Automatic WhatsApp Alert
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     WhatsApp Template Dispatch                         │
│  • Dispatches appointment_confirmation_v1 to Client Mobile             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. OAuth2 Connection Flow & Token Protection

Advocates connect their Google Calendar via standard OAuth2 authorization in their profile settings:

### 2.1 Required Scopes
- `https://www.googleapis.com/auth/calendar.events` (Read/write access to calendar events).

### 2.2 Token Protection at Rest
Google OAuth2 refresh tokens are never stored in plaintext. They are encrypted using authenticated **AES-256-GCM** via `CryptoService` prior to writing to `app.lawyer_calendars`:
```typescript
const encryptedRefreshToken = this.cryptoService.encrypt(tokens.refresh_token);
await this.prisma.lawyerCalendar.upsert({
  where: { lawyerId },
  create: {
    tenantId,
    lawyerId,
    googleRefreshTokenEnc: encryptedRefreshToken,
    googleCalendarId: 'primary',
  },
  update: {
    googleRefreshTokenEnc: encryptedRefreshToken,
    updatedAt: new Date(),
  },
});
```

---

## 3. Conflict Detection & Free/Busy Interrogation

Before the WhatsApp AI assistant suggests available consultation slots to a client, it checks availability across two layers:

1. **Internal Database Check:** Validates against `app.lawyer_availability` and existing `app.appointments`.
2. **Google Calendar Free/Busy API Query:** Calls Google's `freeBusy.query` endpoint to ensure the advocate has not scheduled a personal meeting or external court engagement outside Wakeel:
```json
POST https://www.googleapis.com/calendar/v3/freeBusy
{
  "timeMin": "2026-10-15T09:00:00Z",
  "timeMax": "2026-10-15T18:00:00Z",
  "items": [{ "id": "primary" }]
}
```
Any busy intervals returned by Google are subtracted from the available consultation candidate slots.

---

## 4. Double-Booking Prevention (GIST Constraint)

Even if two clients attempt to book the same time slot concurrently across WhatsApp and the web dashboard, the database kernel guarantees zero double-booking via PostgreSQL's **GIST Exclusion Constraint** ([0002_rls_and_constraints](file:///f:/lawyer_agency/apps/api/prisma/migrations/0002_rls_and_constraints/migration.sql)):
```sql
ALTER TABLE app.appointments
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    "lawyerId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));
```
If a race condition occurs, the second transaction fails at the database level with code `23P01` (`exclusion_violation`), prompting the AI to offer the client the next adjacent slot.

---

## 5. Event Payload & WhatsApp Confirmation Trigger

When an appointment confirms, Wakeel creates a Google Calendar event containing rich context:
- **Summary:** `Consultation: [Client Name] — [Matter Reference]`
- **Description:** 
  ```text
  Client: Muhammad Bilal (0300-1234567)
  Matter: Family Dispute / Khula Advisory
  WhatsApp Thread: https://app.wakeel.pk/inbox/conv_984210
  Booked via: WhatsApp AI Receptionist
  ```
- **Reminders:** Pop-up alert 30 minutes prior to meeting.

Simultaneously, the transactional outbox dispatches a bilingual WhatsApp confirmation template with the Google Calendar start time to the client's phone.

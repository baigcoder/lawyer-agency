# Wakeel — Form Patterns & Architecture

**Status:** IMPLEMENTED BASELINE & FORM ARCHITECTURE SPECIFICATION  
**Classification:** Form Structure, Validation Pipelines, and Form Components  
**Implementation Foundation:** React Hook Form (`react-hook-form`), Zod (`zod`), `@hookform/resolvers/zod`  

---

## 1. Architectural Form Standards

Every form across Wakeel adheres to three strict architectural requirements:
1. **Zod-First Schemas:** Every form is backed by an explicit Zod schema defining types, string lengths, regex constraints, and custom cross-field refinements.
2. **Deterministic Error Surfaces:** Fields are wrapped in `<Field>`, binding the label, input, description, and error message cleanly with accessible ARIA references.
3. **No Unchecked State:** Inputs are controlled via React Hook Form (`register` or `Controller`), guaranteeing type safety from input change to server submission.

---

## 2. Standard Form Field Composition

```tsx
<Field>
  <FieldLabel htmlFor="matterType">Matter Type / کیس کی نوعیت</FieldLabel>
  <Input
    id="matterType"
    {...register('matterType')}
    aria-invalid={Boolean(errors.matterType)}
  />
  {errors.matterType ? (
    <FieldError>{errors.matterType.message}</FieldError>
  ) : (
    <FieldDescription>Choose from the firm's approved practice areas.</FieldDescription>
  )}
</Field>
```

---

## 3. Specific Form Implementations in Wakeel

### 3.1 Firm Onboarding Wizard (`apps/web/src/app/onboarding/page.tsx`)
- **Schema:** `wizardSchema` (zod)
- **Validation Rules:** Firm legal name (min 2, max 120), city (min 2), practice areas (min 1 selection), client languages (min 1 of EN/UR/ROMAN_URDU), office hours, team size (positive integer).
- **Multi-Step State:** 4 progressive steps with step navigation and final confirmation review.

### 3.2 Consultation Booking Form (`apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx`)
- **Schema:** `bookFormSchema` (zod)
- **Cross-Field Refinement:**
  ```typescript
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'End time must be after start time',
    path: ['endsAt'],
  })
  ```
- **Inputs:** Client select, Lawyer select, local ISO datetime strings, notes textarea.

### 3.3 Fee Request & Instruction Form (`apps/web/src/app/(dashboard)/dashboard/payments/page.tsx`)
- **Schema:** `paymentFormSchema` (zod)
- **Validation:** Client UUID, optional case UUID, amount in PKR (min 1), payment method (`JAZZCASH`, `EASYPAISA`, `BANK_TRANSFER`, etc.).
- **Submission:** Submits fee prompt request and displays confirmed fee request in ledger.

### 3.4 Team Member Invite Form (`apps/web/src/app/(dashboard)/dashboard/team/page.tsx`)
- **Schema:** `inviteUserSchema` (zod)
- **Validation:** Member full name, valid email address, role selection (`Lawyer` vs `Staff`).
- **Submission:** Provisions local record and triggers Clerk organization invitation email.

### 3.5 Firm Payment Details Form (`apps/web/src/components/payment-receiving-details-card.tsx`)
- **Inputs:** Bank title, bank name, IBAN (validated PK format), JazzCash account/till number, Easypaisa account number.
- **Security:** Fields are sent over HTTPS and encrypted at rest in PostgreSQL using AES-256-GCM via `MASTER_ENCRYPTION_KEY`.

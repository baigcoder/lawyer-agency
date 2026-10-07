# Wakeel — Form Architecture & Schema Repository

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Form Pipeline, Zod Schema Catalog, and Field Level Integration  
**Source Code References:** `apps/web/src/lib/schemas/`, `apps/web/src/components/ui/field.tsx`  

---

## 1. Schema-Driven Architecture

In Wakeel, form state and validation logic are completely decoupled from UI presentation:
1. **Schema Source of Truth:** Schemas reside in `apps/web/src/lib/schemas/` and directly mirror the backend NestJS `ZodValidationPipe` DTOs.
2. **Type Inference:** TypeScript types are inferred directly from Zod: `type BookFormValues = z.infer<typeof bookFormSchema>`.
3. **Automated Error Mapping:** React Hook Form’s `zodResolver` automatically maps schema refinement failures directly to input field error paths.

---

## 2. Shared Schema Catalog (`apps/web/src/lib/schemas/`)

| Schema File | Exported Schemas | Target Forms / Surfaces |
|---|---|---|
| `case.ts` | `caseSchema`, `caseListSchema`, `hearingSchema` | Case status transition dropdown, court hearing logger. |
| `appointment.ts`| `appointmentSchema`, `bookFormSchema`, `lawyerListSchema`| Consultation booking modal, calendar status updater. |
| `firm-profile.ts`| `firmProfileSchema`, `practiceAreaOptions` | Firm profile settings, onboarding wizard. |
| `lawyers.ts` | `lawyerSchema`, `availabilitySlotSchema` | Advocate bio editor, weekly availability matrix. |
| `users.ts` | `userListSchema`, `inviteUserSchema`, `roleListSchema` | Team member invite dialog, role assignment. |
| `payment.ts` | `paymentFormSchema`, `paymentListSchema` | Fee prompt dialog, screenshot verification. |
| `ai-settings.ts`| `aiSettingsSchema`, `createKbSchema`, `kbListSchema` | AI assumptions card, knowledge base authoring form. |
| `whatsapp.ts` | `pilotTestInboundSchema`, `evolutionConnectionStatusSchema` | Setup test simulator, QR pairing monitor. |

---

## 3. Form Lifecycle & Error Flow

```text
User Input ──► RHF (useForm) ──► zodResolver(schema)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼ (Fail)                              ▼ (Pass)
          errors[fieldName] set                   handleSubmit(onSubmit)
                   │                                     │
                   ▼                                     ▼
        <FieldError> displays                     TanStack Query Mutation
        aria-invalid="true" set                   (apiRequest POST/PUT)
```

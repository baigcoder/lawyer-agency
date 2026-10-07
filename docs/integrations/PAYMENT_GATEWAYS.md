# Payment Gateways & Pakistani Financial Rails

## 1. Domestic Payment Landscape in Pakistani Legal Practice

Law firms in Pakistan operate in a distinctive financial ecosystem dominated by domestic mobile financial services and interbank transfer rails:
- **Mobile Wallets:** JazzCash and Easypaisa are the primary payment channels for lower-to-middle income litigants seeking initial consultations, bail processing, or family law advice.
- **Interbank Transfers (IBAN / Raast):** Corporate clients and high-net-worth individuals pay retaining fees via direct 1Link or State Bank of Pakistan's Raast instant payment system.
- **Diaspora International Cards:** Overseas Pakistanis dealing with inheritance, power of attorney, or real estate litigation pay retainers via international debit/credit cards.
- **In-Chamber Cash:** Physical cash handed to chamber billing clerks remains prevalent in District Courts.

---

## 2. Integer Money Invariant (Pakistani Paisas)

To prevent floating-point arithmetic rounding errors and financial discrepancies, monetary values are stored strictly as **32-bit signed integers in Pakistani Paisas** (1 PKR = 100 paisas):
- **Schema Field:** `app.payments.amountCents` (`int4 NOT NULL`).
- **PKR 5,000 Consultation Fee:** Stored as `500000` paisas.
- Floating-point representations (`float`, `double`, `number` without integer clamping) are strictly prohibited across both backend pipes and frontend calculators.

---

## 3. Supported Payment Rails (`enum:PaymentMethod`)

| Method Code | Channel Description | Integration / Reconciliation Flow |
| :--- | :--- | :--- |
| **`JAZZCASH`** | JazzCash Mobile Wallet / Merchant Till | Merchant API webhook or manual client screenshot verification. |
| **`EASYPAISA`** | Easypaisa Mobile Account / OTC | Easypaisa Payment Gateway callback or slip verification. |
| **`BANK_TRANSFER`** | 1Link / Raast Direct IBAN Transfer | Client transfers to firm IBAN and uploads bank transfer receipt. |
| **`CARD_LOCAL`** | Domestic 1Link PayPak / Visa / Mastercard | Gateway checkout session (PayFast / Safepay). |
| **`CARD_INTL`** | International Visa / Mastercard | Stripe / Checkout session for overseas diaspora clients. |
| **`CASH`** | Physical cash paid at chamber | Attributed to staff member via `recordedBy` foreign key. |
| **`OTHER_MANUAL`** | Cheque / Pay Order / Court Stamped Paper | Manual entry with reference notes. |

---

## 4. Encrypted Firm Payment Credentials (`app.firm_payment_details`)

Each law firm configures its official bank accounts and mobile wallet receive numbers in the dashboard. Because these details could be targeted for social engineering or fraudulent redirection, they are protected at rest via **AES-256-GCM** authenticated encryption:

```json
{
  "bankName": "Meezan Bank Limited",
  "accountTitle": "Malik and Associates Legal Services",
  "iban": "PK42MEZN0001234567890101",
  "jazzcashTillNumber": "984210",
  "easypaisaAccountNumber": "03001234567",
  "raastId": "03001234567"
}
```
When a client requests payment details over WhatsApp, the AI assistant decrypts the record in memory and generates structured payment instructions formatted in Urdu or English.

---

## 5. Webhook Ingestion & Idempotency Anchor

Payment webhooks from gateway providers (JazzCash, PayFast) are posted to `POST /v1/payments/webhook`:
1. **Signature Check:** Validates provider cryptographic signature (HMAC-SHA256).
2. **Database Idempotency Constraint:** The database enforces uniqueness on `("tenantId", "providerTxnId")` via a partial unique index ([0002_rls_and_constraints](file:///f:/lawyer_agency/apps/api/prisma/migrations/0002_rls_and_constraints/migration.sql)):
   ```sql
   CREATE UNIQUE INDEX payments_provider_txn_uniq
     ON app.payments ("tenantId", "providerTxnId")
     WHERE "providerTxnId" IS NOT NULL;
   ```
3. **Duplicate Prevention:** If a gateway retries an already confirmed transaction, the database index causes an upsert conflict check to exit idempotently, preventing duplicate fee credits.

---

## 6. Manual Slip Verification Workflow (`DocType.PAYMENT_PROOF`)

For bank transfers and wallet payments made outside the automated gateway:
1. Client uploads payment slip or screenshot to the firm's WhatsApp.
2. AI classifies the document as `docType: PAYMENT_PROOF` and links it to `app.documents`.
3. An alert is pushed to the firm billing dashboard (`NotificationChannel.DASHBOARD`).
4. Staff member reviews the slip against online bank statement and clicks **"Confirm Payment"**.
5. System transitions payment record to `status: SUCCEEDED`, attributes `recordedBy: staffUserId`, and dispatches an automated WhatsApp receipt (`payment_receipt_v1`) to the client.

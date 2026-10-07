# Supabase Storage Integration — Secure Legal Document Vault

## 1. Overview & Confidentiality Posture

Law firm clients frequently submit evidentiary documents via WhatsApp: Computerised National Identity Cards (CNIC), First Information Reports (FIRs), Nikahnamas, property registries, and bank statements. Under advocate-client privilege, these files represent strictly confidential legal artifacts.

Wakeel delegates binary file persistence to an S3-compatible **Supabase Storage** layer (with an in-cluster filesystem driver for local development and self-hosted environments).

```
                      INBOUND WHATSAPP DOCUMENT (PDF / IMAGE)
                                         │
                                         ▼
                             Evolution / Meta Gateway
                                         │
                                         ▼
                               Wakeel API Ingestion
                     (MIME Validation & Extension Whitelist)
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         Production Environment                     Local Development
      (Supabase Storage S3 API)               (FilesystemObjectStorage Driver)
                    │                                         │
          Private Bucket Vault                    Local Directory Bind
         "wakeel-case-documents"                "/var/lib/wakeel/media"
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         ▼
                              ClamAV Malware Scan Hook
                                         │
                                         ▼
                            Tesseract OCR / Text Extract
                                         │
                                         ▼
                            384-Dim Vector Embeddings
```

---

## 2. Storage Driver Abstraction (`ObjectStoragePort`)

The application decouples storage vendors via the `ObjectStoragePort` interface:

```typescript
export interface ObjectStoragePort {
  uploadFile(path: string, buffer: Buffer, mimeType: string): Promise<string>;
  downloadFile(path: string): Promise<Buffer>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
}
```

### 2.1 Storage Drivers
1. **`SupabaseObjectStorage` (`supabase-object-storage.ts`):** Talks to Supabase Storage REST API using service role credentials. Stores files in the private `wakeel-case-documents` bucket.
2. **`FilesystemObjectStorage` (`filesystem-object-storage.ts`):** Fallback driver writing directly to local volume mounts (`MEDIA_STORAGE_PATH: /var/lib/wakeel/media`).

---

## 3. Storage Hierarchy & Multi-Tenant Namespace

To prevent cross-tenant directory collisions, object paths follow a deterministic hierarchy:
```
tenants/
  └── {tenantId}/
        ├── cases/
        │     └── {caseId}/
        │           ├── {docUuid}_cnic_front.jpg
        │           ├── {docUuid}_fir_rawalpindi.pdf
        │           └── {docUuid}_bail_petition_draft.pdf
        ├── voicenotes/
        │     └── {messageUuid}.ogg
        └── receipts/
              └── {paymentUuid}_jazzcash_slip.jpg
```

---

## 4. Time-Limited Signed URLs & Zero Public Access

All storage buckets are configured with **Zero Public Access**. Client browsers in the dashboard cannot fetch documents directly via static URLs.

### 4.1 Ephemeral Download URLs (`GET /v1/documents/:id/download-url`)
When an advocate clicks to view a case attachment in the dashboard:
1. Controller validates that the advocate holds `case:read` permissions and belongs to the document's tenant.
2. `ObjectStoragePort.createSignedUrl(storagePath, 900)` generates a signed URL with a strictly enforced **15-minute expiration window**.
3. Access is logged in `app.audit_logs` (`action: "document.download"`).

---

## 5. Security & Malware Ingestion Pipeline

To safeguard law firm computers against malicious document attachments:
1. **MIME Whitelist:** Only legal file formats are permitted: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `audio/ogg`, `audio/mp4`. Executables (`.exe`, `.bat`, `.sh`) are rejected at the edge.
2. **Size Clamping:** Individual documents are capped at **25 MB**.
3. **Scan Lifecycle (`enum:ScanStatus`):** Files default to `PENDING`. An asynchronous worker runs ClamAV scanning, updating status to `CLEAN` or `INFECTED`. Infected files are quarantined and inaccessible to users.
4. **OCR & Grounding:** Clean documents enter the OCR queue (`Tesseract.js` / Whisper for audio), populating `app.documents.extractedText` and generating local 384-dimensional dense vectors in `app.document_chunks`.

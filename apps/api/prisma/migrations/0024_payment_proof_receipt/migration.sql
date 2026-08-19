-- Payment screenshot proofs and generated receipts (D-120).
ALTER TYPE "app"."DocType" ADD VALUE IF NOT EXISTS 'PAYMENT_PROOF';
ALTER TYPE "app"."DocType" ADD VALUE IF NOT EXISTS 'RECEIPT';

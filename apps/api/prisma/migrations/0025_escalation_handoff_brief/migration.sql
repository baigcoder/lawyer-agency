-- Lawyer handoff brief on escalations (D-123 / FR-AI-08).
ALTER TABLE "app"."escalations"
  ADD COLUMN IF NOT EXISTS "handoffReason" TEXT,
  ADD COLUMN IF NOT EXISTS "handoffBrief" JSONB NOT NULL DEFAULT '{}';

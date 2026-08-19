-- 0015_whatsapp_connection_stage — Phase 3 connection state machine (D-092).
--
-- Adds the ConnectionStage enum + a connectionStage column to app.whatsapp_accounts,
-- defaulting every existing/new account to OFFICIAL_CONNECT_STARTED. Stage
-- transitions are meditated by OnboardingService; LIVE is gated behind an
-- explicit admin go-live call once READY_TO_GO_LIVE + approved templates exist.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ConnectionStage' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
  ) THEN
    CREATE TYPE "app"."ConnectionStage" AS ENUM (
      'OFFICIAL_CONNECT_STARTED',
      'META_PENDING_VERIFICATION',
      'NUMBER_VERIFIED',
      'TEMPLATES_PENDING',
      'READY_TO_GO_LIVE',
      'LIVE',
      'PAUSED',
      'REJECTED',
      'DISCONNECTED'
    );
  END IF;
END
$$;

ALTER TABLE "app"."whatsapp_accounts" ADD COLUMN IF NOT EXISTS "connectionStage" "app"."ConnectionStage" NOT NULL DEFAULT 'OFFICIAL_CONNECT_STARTED';

COMMIT;

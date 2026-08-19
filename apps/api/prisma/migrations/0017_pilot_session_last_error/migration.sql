-- 0017_pilot_session_last_error — actionable pilot bridge failures.
--
-- The Baileys bridge can die silently for the user (handshake failure loop,
-- device logout, connection replaced). `lastError`/`lastErrorAt` record the
-- terminal reason so the dashboard can show "re-pair required: <reason>"
-- instead of an unexplained DISCONNECTED status.

ALTER TABLE app.pilot_sessions
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "lastErrorAt" TIMESTAMPTZ(6);

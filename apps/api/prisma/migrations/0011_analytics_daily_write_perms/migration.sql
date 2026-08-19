-- 0011_analytics_daily_write_perms — the analytics projector needs to upsert
-- daily aggregate rows, not just read them. Migration 0010 granted SELECT but
-- omitted INSERT/UPDATE.

GRANT INSERT, UPDATE ON platform.analytics_daily TO app_user;

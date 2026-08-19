-- 0016_wa_routes_delete_grant — allow app_user to DELETE platform.wa_rows (B3).
--
-- Onboarding (complete) inserts wa_routes and that worked because migration
-- 0004 granted INSERT. Disconnect (B3) must also remove the route so inbound
-- webhooks for a disconnected number stop resolving to the tenant — which
-- requires DELETE, missing from the 0004 grant.

BEGIN;

GRANT DELETE ON platform.wa_routes TO app_user;

COMMIT;

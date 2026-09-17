#!/bin/bash
# Apply Wavoip Baileys fingerprint before Evolution boots, then run the
# stock Evolution entrypoint (database deploy + start:prod).
set -euo pipefail
cd /evolution
if [ -f /wavoip-patch/apply-wavoip-baileys-patch.mjs ]; then
  node /wavoip-patch/apply-wavoip-baileys-patch.mjs || true
fi
exec /bin/bash -c '. ./Docker/scripts/deploy_database.sh && npm run start:prod'

#!/usr/bin/env node
/**
 * Dev helper: register a Meta test WhatsApp number with a tenant.
 *
 * Use this when you want to receive real WhatsApp webhooks locally without
 * completing full Meta Business Verification / Embedded Signup (which takes
 * days). Meta's "Getting Started" test phone number + temporary access token
 * are enough to exercise the inbound/outbound message path.
 *
 * Usage (from apps/api):
 *   node scripts/seed-test-whatsapp.js \
 *     --phoneNumberId=123456789012345 \
 *     --wabaId=987654321098765 \
 *     --displayPhoneNumber="+1 555 123 4567" \
 *     --accessToken=EAA...
 *
 * The script reads MASTER_ENCRYPTION_KEY and DATABASE_URL from apps/api/.env,
 * encrypts the token the same way CryptoService does (AES-256-GCM), and upserts
 * platform.wa_routes + app.whatsapp_accounts for the dev seam tenant.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');

// Load .env from apps/api (the script is expected to be run from that dir).
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_DEV_TENANT_ID = '018f3d6e-7c8b-7a2c-9d4e-5f6a7b8c9d0e';

function showUsage(error) {
  const out = error ? console.error : console.log;
  out(`
${error ? `Error: ${error}` : ''}
Seed a Meta test WhatsApp number into the local Wakeel database.

Required flags:
  --phoneNumberId=<id>      From Meta dashboard → WhatsApp → Getting Started
  --wabaId=<id>             WhatsApp Business Account ID shown next to the test number
  --displayPhoneNumber=<n>  E.164 or display form, e.g. "+1 555 123 4567"
  --accessToken=<token>     Temporary access token from Meta dashboard

Optional flags:
  --tenantId=<uuid>         Defaults to NEXT_PUBLIC_DEV_TENANT_ID or ${DEFAULT_DEV_TENANT_ID}
  --verificationStatus=     VERIFIED | NOT_STARTED | EXPIRED | DELETED  (default: VERIFIED)

Example:
  node scripts/seed-test-whatsapp.js \\
    --phoneNumberId=123456789012345 \\
    --wabaId=987654321098765 \\
    --displayPhoneNumber="+1 555 123 4567" \\
    --accessToken=EAA...
`);
  process.exit(error ? 1 : 0);
}

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = /^--([a-zA-Z]+)=(.*)$/.exec(raw);
    if (!m) showUsage(`Unrecognized argument: ${raw}`);
    args[m[1]] = m[2];
  }
  return args;
}

function encryptToken(plaintext, keyHex) {
  if (typeof keyHex !== 'string' || keyHex.length !== 64) {
    throw new Error('MASTER_ENCRYPTION_KEY must be a 64-character hex string');
  }
  const key = Buffer.from(keyHex, 'hex');
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]).toString('base64url');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help !== undefined) showUsage();
  if (!args.phoneNumberId || !args.wabaId || !args.displayPhoneNumber || !args.accessToken) {
    showUsage('Missing one or more required flags.');
  }

  const tenantId = args.tenantId || process.env.NEXT_PUBLIC_DEV_TENANT_ID || DEFAULT_DEV_TENANT_ID;
  if (!/^[0-9a-fA-F-]{36}$/.test(tenantId)) {
    showUsage(`tenantId is not a valid UUID: ${tenantId}`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    showUsage('DATABASE_URL not found in apps/api/.env');
  }

  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    showUsage('MASTER_ENCRYPTION_KEY not found in apps/api/.env');
  }

  const verificationStatus = args.verificationStatus || 'VERIFIED';
  const allowedStatuses = ['VERIFIED', 'NOT_STARTED', 'EXPIRED', 'DELETED'];
  if (!allowedStatuses.includes(verificationStatus)) {
    showUsage(`verificationStatus must be one of: ${allowedStatuses.join(', ')}`);
  }

  const accessTokenEnc = encryptToken(args.accessToken, masterKey);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Set tenant GUC so RLS allows the insert (matches UnitOfWork.withTenant).
    // SET does not accept parameter placeholders, so we interpolate the already-UUID-validated value.
    await client.query(`SET app.tenant_id = '${tenantId}'`);

    // Routing table: maps Meta's phone_number_id to tenant before any tenant context exists.
    await client.query(
      `
      INSERT INTO platform.wa_routes ("phoneNumberId", "tenantId", "wabaId")
      VALUES ($1, $2, $3)
      ON CONFLICT ("phoneNumberId") DO UPDATE
        SET "tenantId" = EXCLUDED."tenantId",
            "wabaId" = EXCLUDED."wabaId";
      `,
      [args.phoneNumberId, tenantId, args.wabaId],
    );

    // Tenant account: one row per tenant; encrypted token for outbound sends.
    await client.query(
      `
      INSERT INTO app.whatsapp_accounts (
        "tenantId", "wabaId", "phoneNumberId", "displayPhoneNumber",
        "accessTokenEnc", "verificationStatus", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT ("tenantId") DO UPDATE
        SET "wabaId" = EXCLUDED."wabaId",
            "phoneNumberId" = EXCLUDED."phoneNumberId",
            "displayPhoneNumber" = EXCLUDED."displayPhoneNumber",
            "accessTokenEnc" = EXCLUDED."accessTokenEnc",
            "verificationStatus" = EXCLUDED."verificationStatus",
            "updatedAt" = NOW();
      `,
      [tenantId, args.wabaId, args.phoneNumberId, args.displayPhoneNumber, accessTokenEnc, verificationStatus],
    );

    const { rows } = await client.query(
      'SELECT "phoneNumberId", "displayPhoneNumber", "verificationStatus" FROM app.whatsapp_accounts WHERE "tenantId" = $1',
      [tenantId],
    );

    console.log('\n✅ Test WhatsApp account registered for tenant:', tenantId);
    console.log('   phoneNumberId:', rows[0].phoneNumberId);
    console.log('   displayPhoneNumber:', rows[0].displayPhoneNumber);
    console.log('   verificationStatus:', rows[0].verificationStatus);
    console.log('\nNext steps:');
    console.log('  1. Expose the API publicly: ngrok http 3001');
    console.log('  2. In Meta dashboard set the webhook to: https://<ngrok>/v1/webhooks/whatsapp');
    console.log('  3. Subscribe to messages + message_status fields.');
    console.log('  4. Send a WhatsApp message to the test number.');
    console.log('  5. Watch the API logs: webhook → inbound message → AI reply queued/sent.\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

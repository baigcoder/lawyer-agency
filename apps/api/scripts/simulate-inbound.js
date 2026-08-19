#!/usr/bin/env node
/**
 * Simulate a Meta WhatsApp inbound text message webhook to test the local
 * AI pipeline without needing ngrok or a real phone delivery.
 *
 * Usage (from apps/api, with API running on :3001):
 *   node scripts/simulate-inbound.js "I need help with a property dispute in Lahore"
 *
 * This will:
 *   1. POST a signed webhook payload to /v1/webhooks/whatsapp.
 *   2. The API ingests it and enqueues a job.
 *   3. The worker processes the job, runs the AI orchestrator, and attempts
 *      to send a reply via Meta's Cloud API.
 *
 * The Meta send may fail if the recipient number is not a pre-registered test
 * recipient in the Meta dashboard. Even if it fails, the AI logs (app.ai_logs)
 * will show the router/intake/agent LLM calls, and the application logs will
 * show the generated response text.
 */

const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const APP_SECRET = process.env.META_APP_SECRET;
const API_PORT = process.env.API_PORT || 3001;
const PHONE_NUMBER_ID = process.argv[3] || '1258383914025073';
const FROM_WA_PHONE = process.argv[4] || '923007038803';
const BODY = process.argv[2] || 'I need help with a property dispute in Lahore. What should I do?';

if (!APP_SECRET) {
  console.error('META_APP_SECRET not found in apps/api/.env');
  process.exit(1);
}

function makePayload() {
  const now = Math.floor(Date.now() / 1000);
  const messageId = `wamid.sim.${Date.now()}`;
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '0',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15556698845',
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [
                {
                  profile: { name: 'Test Client' },
                  wa_id: FROM_WA_PHONE,
                },
              ],
              messages: [
                {
                  from: FROM_WA_PHONE,
                  id: messageId,
                  timestamp: String(now),
                  text: { body: BODY },
                  type: 'text',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signPayload(body) {
  const hmac = crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return `sha256=${hmac}`;
}

async function main() {
  const payload = makePayload();
  const body = JSON.stringify(payload);
  const signature = signPayload(body);

  console.log('Sending simulated inbound webhook...');
  console.log('  phone_number_id:', PHONE_NUMBER_ID);
  console.log('  from:', FROM_WA_PHONE);
  console.log('  body:', BODY);

  const response = await fetch(`http://localhost:${API_PORT}/v1/webhooks/whatsapp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body,
  });

  const text = await response.text();
  console.log(`\nAPI response: ${response.status} ${response.statusText}`);
  console.log(text);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

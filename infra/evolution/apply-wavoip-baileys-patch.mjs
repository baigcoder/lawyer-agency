#!/usr/bin/env node
/**
 * Wavoip requires Baileys to advertise a desktop/UWP client or call audio
 * never flows (signaling may still show CB:call). Official patch targets
 * baileys@7.0.0-rc13; Evolution ships other RCs — apply the same payload
 * changes surgically so live WhatsApp calls can reach SIP/webphone.
 *
 * Also harden Evolution's Wavoip bridge: `volatile.timeout(1000)` drops
 * CB:call packets when the socket briefly disconnects.
 *
 * Source of truth: https://github.com/wavoip/voice-calls-baileys
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const VALIDATE = '/evolution/node_modules/baileys/lib/Utils/validate-connection.js';
const BRIDGE_FILES = [
  '/evolution/dist/api/integrations/channel/whatsapp/voiceCalls/useVoiceCallsBaileys.js',
  '/evolution/dist/api/integrations/channel/whatsapp/whatsapp.baileys.service.js',
];

function patchValidateConnection() {
  if (!existsSync(VALIDATE)) {
    console.warn('[wavoip-patch] baileys validate-connection.js not found — skip');
    return false;
  }

  let src = readFileSync(VALIDATE, 'utf8');
  const before = src;

  src = src.replace(
    /let webSubPlatform = proto\.ClientPayload\.WebInfo\.WebSubPlatform\.WEB_BROWSER;/,
    'let webSubPlatform = proto.ClientPayload.WebInfo.WebSubPlatform.WIN_HYBRID;',
  );
  src = src.replace(
    /Windows:\s*proto\.ClientPayload\.WebInfo\.WebSubPlatform\.WIN32/,
    'Windows: proto.ClientPayload.WebInfo.WebSubPlatform.WIN_HYBRID',
  );
  src = src.replace(
    /config\.browser\[1\] === 'Desktop'/,
    "(config.browser[1] === 'Desktop' || config.browser[1] === 'UWP')",
  );
  src = src.replace(
    /passive:\s*true,\s*pull:\s*true,/,
    'passive: false,\n        pull: true,',
  );
  src = src.replace(/lidDbMigrated:\s*false/, 'lidDbMigrated: true');
  if (!/mcc:\s*["']261["']/.test(src) && /device:\s*['"]Desktop['"]/.test(src)) {
    src = src.replace(
      /device:\s*(['"])Desktop\1,/,
      'mcc: "261",\n        mnc: "000",\n        manufacturer: "",\n        device: $1Desktop$1,',
    );
  }

  if (src === before) {
    console.log('[wavoip-patch] validate-connection already applied or markers missing');
  } else {
    writeFileSync(VALIDATE, src);
    console.log('[wavoip-patch] applied Baileys call fingerprint');
  }

  const check = readFileSync(VALIDATE, 'utf8');
  const ok = check.includes('WIN_HYBRID') && /passive:\s*false/.test(check);
  if (!ok) {
    console.warn('[wavoip-patch] validate-connection verification incomplete');
    return false;
  }
  console.log('[wavoip-patch] validate-connection ok');
  return true;
}

function patchCallBridge(path) {
  if (!existsSync(path)) return;
  let src = readFileSync(path, 'utf8');
  const before = src;
  src = src.replace(/\.volatile\.timeout\(1e3\)\.emit\((["'])CB:call\1/g, '.emit($1CB:call$1');
  src = src.replace(
    /\.volatile\.timeout\(1e3\)\.emit\((["'])CB:ack,class:call\1/g,
    '.emit($1CB:ack,class:call$1',
  );
  src = src.replace(/\.volatile\.timeout\(1000\)\.emit\((["'])CB:call\1/g, '.emit($1CB:call$1');
  src = src.replace(
    /\.volatile\.timeout\(1000\)\.emit\((["'])CB:ack,class:call\1/g,
    '.emit($1CB:ack,class:call$1',
  );
  if (src !== before) {
    writeFileSync(path, src);
    console.log('[wavoip-patch] hardened call bridge emit in', path);
  }
}

patchValidateConnection();
for (const file of BRIDGE_FILES) patchCallBridge(file);

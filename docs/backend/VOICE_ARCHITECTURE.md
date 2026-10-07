# Wakeel — Voice Architecture & WhatsApp Receptionist

**Status:** IMPLEMENTED BASELINE & RUNTIME SPECIFICATION  
**Classification:** Voice Notes, Live WebRTC Calling, SIP Trunking, and Audio Pipelines  
**Runtime Role:** `API_ROLE=voice` (Live Calls) & `API_ROLE=worker` (Audio Media Transcripts)  
**Source Code References:** `apps/api/src/modules/voice/`, `apps/api/src/modules/voice-calls/`  

---

## 1. Dual-Surface Voice Architecture

Wakeel handles voice across two distinct real-world surfaces in Pakistani legal practice:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VOICE SUBSYSTEM TOPOLOGY                           │
├─────────────────────────────────────────┬───────────────────────────────────┤
│ 1. ASYNC AUDIO VOICE NOTES              │ 2. LIVE WHATSAPP AI RECEPTIONIST  │
│    (Handled by role=worker)             │    (Handled by role=voice)        │
├─────────────────────────────────────────┼───────────────────────────────────┤
│ • Inbound WhatsApp .ogg voice note      │ • Live telephone call from client │
│ • Download via "whatsapp-media" queue   │ • Cloud Calling: WebRTC (Graph)   │
│ • Transcribed via Whisper STT Port      │ • QR/Baileys: Wavoip SIP Trunk    │
│ • AI generates response                 │ • CallMediaLoop with VAD          │
│ • ElevenLabs Turbo v2.5 generates       │ • Real-time STT + LLM Tools + TTS │
│   Urdu audio note back to client        │ • Auto-hangup & follow-up text    │
└─────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 2. Live WhatsApp Receptionist: WebRTC & SIP (`API_ROLE=voice`)

### 2.1 Official Cloud API Calling (Graph WebRTC)
- Inbound call webhooks trigger `werift` WebRTC peer connections.
- Negotiates SDP answer via Graph API (`pre_accept` → `accept`).
- Publishes UDP ICE candidates over the configured port range `40000–40031`.

### 2.2 QR/Baileys Live Audio via Wavoip SIP Trunk (D-124)
- When a client calls a QR-paired Baileys number, Evolution API relays the incoming WhatsApp VoIP stanza (`CB:call`) to Wavoip.
- The `voice` process REGISTERs the Wavoip device token as a standard SIP trunk at `sipv2.wavoip.com` (port 5060, G.711 PCMU codec).
- Matches incoming SIP `INVITE` headers to the WhatsApp caller's phone number.
- Feeds raw RTP audio packets into `CallMediaLoop`.

### 2.3 The Baileys UWP Patch Requirement (D-124)
Standard browser-based WhatsApp Web sessions (Chrome user agent) do not support WhatsApp VoIP calling. Wakeel applies an automated boot patch (`infra/evolution/apply-wavoip-baileys-patch.mjs`), advertising a **Windows/UWP (WIN_HYBRID)** client identity. This unlocks WhatsApp VoIP stanza relay without triggering account bans.

---

## 3. Real-Time Conversation Media Loop (`CallMediaLoop`)

1. **Voice Activity Detection (VAD):** `CallVad` monitors incoming PCM audio frames, detecting speech onsets and silences (>600ms pause indicates turn completion).
2. **Speech-to-Text (STT):** Transcribes audio chunk into text via Whisper port.
3. **Voice Agent & Tool Calling:** Evaluates transcript, checks office hours, queries SlotFinder for available appointments, or initiates safety escalation.
4. **Text-to-Speech (TTS):** Generates streaming audio via ElevenLabs Turbo v2.5 in natural Urdu or English, streaming RTP audio back to the caller.
5. **Post-Call WhatsApp Follow-Up:** Upon call termination, a written confirmation with appointment details or lawyer handoff notes is dispatched to the client's WhatsApp chat.

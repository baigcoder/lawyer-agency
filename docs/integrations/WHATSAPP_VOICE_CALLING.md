# WhatsApp Voice Calling & Receptionist Architecture

## 1. Domain Problem & Pakistani Cultural Reality

In the Pakistani legal market, prospective litigants and existing clients overwhelmingly prefer calling an advocate's WhatsApp number over typing extensive text or navigating menus ([D-124](file:///f:/lawyer_agency/docs/decision-log.md)). Litigants facing urgent police raids, pending bail deadlines, or domestic disputes call at all hours. When calls go unanswered, clients immediately seek alternative legal counsel.

Wakeel deploys an automated **AI WhatsApp Receptionist** running on a dedicated process role (`API_ROLE=voice`) capable of answering live WhatsApp audio calls, conducting bilingual voice intake in Urdu and English, and booking consultation slots.

```
                         INBOUND WHATSAPP AUDIO CALL
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
    Official Meta Cloud API                             Baileys QR Session
            │                                                   │
     WebRTC Signaling                                   Wavoip SIP Trunk
  (SDP Offer / Answer)                             (sipv2.wavoip.com:5060)
            │                                                   │
            ▼                                                   ▼
     werift WebRTC Peer                                 SIP UDP User Agent
(UDP RTP Ports 40000-40031)                            (G.711 PCMU / 8 kHz)
            │                                                   │
            └─────────────────────────┬─────────────────────────┘
                                      │ Inbound RTP Audio Buffer
                                      ▼
                        STT: Whisper / Composite STT
                                      │ Text Transcript
                                      ▼
                      LLM: Groq Llama 3.3 70B (<500ms)
                                      │ AI Response Text
                                      ▼
                     TTS: ElevenLabs Urdu Turbo v2.5
                                      │ Outbound RTP Stream
                                      ▼
                           Streamed to Caller Ear
```

---

## 2. Dual-Transport Telephony Implementation

### 2.1 Transport 1: Official Meta Cloud Calling API (WebRTC)
For verified Meta WABAs, voice calling utilizes the official WebRTC media channel:
- **Signaling:** Handled via Meta Graph API call events (`call:ringing`, `call:accepted`).
- **Media Engine:** Built using **`werift`** (a native TypeScript WebRTC and RTP implementation running directly inside Node.js, eliminating heavy external dependencies like Asterisk or FreeSWITCH).
- **ICE Port Windowing:** Clamped to `40000–40031` UDP (`WEBRTC_ICE_PORT_MIN` / `WEBRTC_ICE_PORT_MAX`) for deterministic firewall traversal.
- **Audio Codec:** Opus at 48kHz sampling rate.

### 2.2 Transport 2: Baileys QR Sessions via Wavoip SIP Bridge
For pilot law firms connected via Baileys QR codes:
- **Signaling & Media Bridge:** Leverages Wavoip SIP infrastructure (`sipv2.wavoip.com:5060`).
- **Device Fingerprint Requirement:** Requires the surgical Baileys patch (`apply-wavoip-baileys-patch.mjs`), which reports client identity as `WIN_HYBRID` / `UWP`. If connected as a standard web browser, WhatsApp drops call media.
- **Audio Codec:** G.711 PCMU (8kHz). Converted on the fly via PCM resampling.

---

## 3. Real-Time Conversational Turn Pipeline

To maintain conversational fluidity, total pipeline latency from caller silence detection to outbound audio playback must stay under **1,200ms**:

| Step | Engine | Tech Details & Optimization | Latency Budget |
| :--- | :--- | :--- | :--- |
| **1. VAD & Silence** | Silero VAD | Energy and speech probability detection | 200 ms |
| **2. Transcription (STT)**| Whisper / Composite | Optimized Urdu phonetic model | 300 ms |
| **3. Reasoning (LLM)** | Groq Llama 3.3 70B | Legal receptionist system prompt; streaming TTFT | 350 ms |
| **4. Speech Synthesis (TTS)**| ElevenLabs Turbo v2.5 | Native Urdu streaming chunk playback | 250 ms |
| **Total Turn Roundtrip** | | | **~1,100 ms** |

---

## 4. Voice Call State Machine & Dispositions

Every incoming call lifecycle is persisted in `app.voice_calls` and linked to the client's `app.conversations` record:

### 4.1 State Machine (`enum:VoiceCallStatus`)
`RINGING` -> `ANSWERED` -> `COMPLETED` (or `REJECTED` / `FAILED`).

### 4.2 Terminal Dispositions (`enum:VoiceCallDisposition`)
At call conclusion, the AI Receptionist classifies the interaction:
- **`BOOKED`:** The caller agreed to and scheduled a consultation appointment. Created record in `app.appointments`.
- **`ESCALATED`:** The caller exhibited extreme urgency (active arrest, domestic violence). Immediately pings lawyer via WhatsApp template alert.
- **`INFO`:** General inquiry (office location, Bar Council standing, fee range) resolved.
- **`ABANDONED`:** Caller hung up before completion.
- **`REJECTED_OFF`:** Call received outside office hours, and after-hours auto-attendant was toggled off.
- **`OUTSIDE_HOURS`:** Greeting played notifying caller of office hours; WhatsApp text intake initiated.

### 4.3 Post-Call Summary Note
At call termination, a structured brief is inserted into `app.conversation_notes`:
```markdown
📞 **WhatsApp Voice Call Summary**
- **Duration:** 1m 42s
- **Disposition:** BOOKED
- **Caller Concern:** Bail application in Section 489-F (Dishonoured Cheque) case.
- **Action Taken:** Scheduled consultation for tomorrow at 11:30 AM with Advocate Tariq.
```

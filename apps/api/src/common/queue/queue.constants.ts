export const QUEUES = {
  /** Scheduler tick that drains platform.outbox_events (ADR-003). */
  OUTBOX: 'outbox',
  /** Domain events after outbox dispatch; consumers: notifications, analytics, n8n relay. */
  DOMAIN_EVENTS: 'domain-events',
  /** Normalized inbound WhatsApp messages awaiting persistence (Phase 6). */
  WHATSAPP_INBOUND: 'whatsapp-inbound',
  /** WhatsApp message status updates (sent/delivered/read/failed) (Phase 6b). */
  WHATSAPP_STATUS: 'whatsapp-status',
  /** Media download jobs for inbound WhatsApp attachments (Phase 6b). */
  WHATSAPP_MEDIA: 'whatsapp-media',
  /** Pilot bridge jobs (D-092): pair / send / disconnect via Baileys (worker). */
  WHATSAPP_PILOT: 'whatsapp-pilot',
  /** Notification jobs and periodic alerting (Phase 9). */
  NOTIFICATIONS: 'notifications',
} as const;

export const OUTBOX_DISPATCH_JOB = 'outbox:dispatch';
export const ESCALATION_SLA_MONITOR_JOB = 'escalation-sla-monitor';
export const HEARING_REMINDER_JOB = 'hearing-reminder';
export const PILOT_PAIR_JOB = 'pilot:pair';
export const PILOT_SEND_JOB = 'pilot:send';
export const PILOT_DISCONNECT_JOB = 'pilot:disconnect';

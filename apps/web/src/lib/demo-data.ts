import type { HandoffBrief } from '@/lib/schemas/escalations';

/**
 * Illustrative data for the marketing site and /demo. Typed against the real
 * API schemas so the demo renders through the same components as the
 * dashboard — if a schema changes, the demo fails to compile instead of
 * silently drifting from the product. No real client data.
 */
export const DEMO_BRIEF: HandoffBrief = {
  reason: 'Client reports an arrest last night; first hearing is within 24 hours.',
  matterType: 'Criminal · post-arrest bail',
  situation:
    "Client's brother was taken into custody by PS Gulberg last night under FIR 412/26. First production before the Cantt courts is tomorrow at 09:00. Family is seeking representation for bail.",
  facts: {
    client: 'Ahmed Raza (brother of the accused)',
    city: 'Lahore',
    'police station': 'PS Gulberg',
    FIR: '412/26',
    'next date': 'Tomorrow, 09:00 · Cantt courts',
    language: 'Roman Urdu',
  },
  documents: {
    requests: [
      { description: 'FIR copy', status: 'PENDING' },
      { description: 'CNIC of accused (front & back)', status: 'PENDING' },
    ],
    files: [],
  },
  openItems: [
    'Sections invoked in the FIR are not yet known.',
    'Has a vakalatnama been signed with any other counsel?',
  ],
  nextAction: 'Call the client before 22:00 and confirm availability for tomorrow’s 09:00 production.',
};

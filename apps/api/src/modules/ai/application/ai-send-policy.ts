/**
 * When the AI pipeline may deliver a WhatsApp reply.
 *
 * HUMAN_REQUIRED is used both for real escalations and for leftover
 * "needs human" state (auto-reply was off, or staff-approval drafts).
 * Open escalations stay with staff; otherwise auto-reply may resume.
 */
export function shouldSendAiReply(params: {
  conversationState: string;
  hasOpenEscalation: boolean;
  responseText: string | null | undefined;
}): boolean {
  if (!params.responseText) return false;
  if (params.conversationState === 'CLOSED' || params.conversationState === 'HUMAN_ACTIVE') {
    return false;
  }
  if (params.conversationState === 'HUMAN_REQUIRED' && params.hasOpenEscalation) {
    return false;
  }
  return true;
}

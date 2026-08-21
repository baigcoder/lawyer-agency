/**
 * When the AI pipeline may deliver a WhatsApp reply.
 *
 * Staff takeover (`HUMAN_ACTIVE`) and closed chats stay silent.
 * An open escalation still lets the assistant answer until a person is actually
 * in the thread — otherwise a “needs lawyer” flag mutes follow-up voice notes.
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
  return true;
}

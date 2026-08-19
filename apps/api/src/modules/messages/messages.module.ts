import { Module } from '@nestjs/common';
import { MessagesService } from './application/messages.service';

/**
 * Messages — conversations, message store, intake state, conversation state
 * machine (AI_ACTIVE / HUMAN_REQUIRED / HUMAN_ACTIVE / CLOSED).
 * Owns: conversations, messages, intake_sessions.
 * Publishes: message.inbound.received (via outbox).
 * Inbox read API (CQRS read model, D-018) and handoff endpoints land with
 * the inbox UI work; the AI pipeline consumes recordInbound's event in Phase 7.
 *
 * Phase 6b: enqueues media-download jobs to the globally-registered queue.
 */
@Module({
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { InboxService } from '../application/inbox.service';
import type { ConversationState } from '../../../generated/prisma/client';

const stateSchema = z.enum(['AI_ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED']);

const listQuerySchema = z.object({
  state: stateSchema.optional(),
  assignedToMe: z.enum(['true', 'false']).optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  q: z.string().max(100).optional(),
});

const assignBodySchema = z.object({
  assigneeUserId: z.string().uuid().nullable(),
});

const stateBodySchema = z.object({
  state: stateSchema,
});

const replyBodySchema = z.object({
  body: z.string().min(1).max(4000),
});

const messagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

type ListQuery = z.infer<typeof listQuerySchema>;
type AssignBody = z.infer<typeof assignBodySchema>;
type StateBody = z.infer<typeof stateBodySchema>;
type ReplyBody = z.infer<typeof replyBodySchema>;
type MessagesQuery = z.infer<typeof messagesQuerySchema>;

/**
 * Dashboard inbox API (Phase 11). Lists conversations, exposes assignment
 * handoffs, state transitions, and manual replies from firm staff.
 */
@Controller('inbox')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('inbox:read')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ) {
    return this.inbox.listConversations(
      tenantId,
      {
        state: query.state,
        assignedToMe: query.assignedToMe === 'true',
        unassigned: query.unassigned === 'true',
        q: query.q,
      },
      user.userId,
    );
  }

  @Get('messages/:messageId/media')
  async streamMedia(
    @TenantId() tenantId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Res() res: Response,
  ) {
    const media = await this.inbox.streamMessageMedia(tenantId, messageId);
    res.setHeader('content-type', media.mimeType);
    res.setHeader('content-length', String(media.contentLength));
    res.setHeader('content-disposition', 'inline');
    res.setHeader('cache-control', 'private, max-age=3600');
    media.stream.pipe(res);
  }

  @Get(':id/messages')
  listMessages(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQuery,
  ) {
    return this.inbox.listMessages(tenantId, id, {
      before: query.before ? new Date(query.before) : undefined,
      limit: query.limit,
    });
  }

  @Get(':id')
  get(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inbox.getConversation(tenantId, id);
  }

  @Post(':id/assign')
  @RequirePermission('inbox:write')
  assign(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignBodySchema)) body: AssignBody,
  ) {
    return this.inbox.assignConversation(tenantId, id, body.assigneeUserId ?? null);
  }

  @Post(':id/state')
  @RequirePermission('inbox:write')
  transition(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(stateBodySchema)) body: StateBody,
  ) {
    return this.inbox.transitionState(tenantId, id, body.state as ConversationState);
  }

  @Post(':id/reply')
  @RequirePermission('inbox:write')
  async reply(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(replyBodySchema)) body: ReplyBody,
  ) {
    const result = await this.inbox.reply(tenantId, id, {
      body: body.body,
      senderUserId: user.userId ?? '',
    });
    return result;
  }

  @Post(':id/convert-to-case')
  @RequirePermission('cases:write')
  convertToCase(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(z.object({
      matterType: z.string().min(2).max(100),
      urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
    }))) body: { matterType: string; urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' },
  ) {
    return this.inbox.convertToCase(tenantId, id, body);
  }

  @Get(':id/notes')
  listNotes(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.listNotes(tenantId, id);
  }

  @Post(':id/notes')
  @RequirePermission('inbox:write')
  addNote(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(z.object({ body: z.string().min(1).max(5000) }))) body: { body: string },
  ) {
    return this.inbox.addNote(tenantId, id, user.userId ?? '', body.body);
  }

  @Post(':id/drafts/:messageId/approve')
  @RequirePermission('inbox:write')
  approveDraft(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.inbox.approveDraft(tenantId, id, messageId, user.userId ?? '');
  }

  @Post(':id/drafts/:messageId/reject')
  @RequirePermission('inbox:write')
  rejectDraft(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.inbox.rejectDraft(tenantId, id, messageId);
  }
}

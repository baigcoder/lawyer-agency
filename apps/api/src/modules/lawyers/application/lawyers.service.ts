import { Injectable, NotFoundException } from '@nestjs/common';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type {
  AvailabilitySlotInput,
  CreateLawyerInput,
  SetAvailabilityInput,
  UpdateLawyerInput,
} from './dto';

export interface LawyerSummary {
  id: string;
  userId: string;
  name: string;
  email: string;
  practiceAreas: string[];
  whatsappNumber: string | null;
}

export interface LawyerWithAvailability extends LawyerSummary {
  availability: AvailabilitySlotInput[];
}

/**
 * Lawyer profiles and weekly availability (Phase 16).
 * A lawyer row is the bridge between a User and case-assignment/appointment
 * scheduling. The whatsappNumber powers the WhatsApp-template notification
 * channel (FR-NTF-01).
 */
@Injectable()
export class LawyersService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
  ) {}

  async list(tenantId: string): Promise<LawyerWithAvailability[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.lawyer.findMany({
        include: { user: true, availability: { orderBy: { weekday: 'asc' } } },
        orderBy: { user: { name: 'asc' } },
      });
      return rows.map((l) => ({
        id: l.id,
        userId: l.userId,
        name: l.user.name,
        email: l.user.email,
        practiceAreas: l.practiceAreas,
        whatsappNumber: l.whatsappNumber,
        availability: l.availability.map((a) => ({
          weekday: a.weekday,
          startTime: a.startTime,
          endTime: a.endTime,
          slotDurationMinutes: a.slotDurationMinutes,
        })),
      }));
    });
  }

  async getById(tenantId: string, lawyerId: string): Promise<LawyerWithAvailability> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const l = await tx.lawyer.findFirst({
        where: { id: lawyerId },
        include: { user: true, availability: { orderBy: { weekday: 'asc' } } },
      });
      if (!l) throw new NotFoundException('lawyer not found');
      return {
        id: l.id,
        userId: l.userId,
        name: l.user.name,
        email: l.user.email,
        practiceAreas: l.practiceAreas,
        whatsappNumber: l.whatsappNumber,
        availability: l.availability.map((a) => ({
          weekday: a.weekday,
          startTime: a.startTime,
          endTime: a.endTime,
          slotDurationMinutes: a.slotDurationMinutes,
        })),
      };
    });
  }

  async create(tenantId: string, input: CreateLawyerInput): Promise<LawyerSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: input.userId } });
      if (!user) throw new NotFoundException('user not found');
      const created = await tx.lawyer.create({
        data: {
          tenantId,
          userId: input.userId,
          practiceAreas: input.practiceAreas,
          whatsappNumber: input.whatsappNumber ?? null,
        },
        include: { user: true },
      });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.LawyerCreated, {
        lawyerId: created.id,
        userId: created.userId,
      });
      return {
        id: created.id,
        userId: created.userId,
        name: created.user.name,
        email: created.user.email,
        practiceAreas: created.practiceAreas,
        whatsappNumber: created.whatsappNumber,
      };
    });
  }

  async update(tenantId: string, lawyerId: string, input: UpdateLawyerInput): Promise<LawyerSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.lawyer.findFirst({ where: { id: lawyerId }, include: { user: true } });
      if (!current) throw new NotFoundException('lawyer not found');
      const data: Record<string, unknown> = {};
      if (input.practiceAreas !== undefined) data.practiceAreas = input.practiceAreas;
      if (input.whatsappNumber !== undefined) data.whatsappNumber = input.whatsappNumber;

      const updated = await tx.lawyer.update({
        where: { id: lawyerId },
        data,
        include: { user: true },
      });
      return {
        id: updated.id,
        userId: updated.userId,
        name: updated.user.name,
        email: updated.user.email,
        practiceAreas: updated.practiceAreas,
        whatsappNumber: updated.whatsappNumber,
      };
    });
  }

  async setAvailability(
    tenantId: string,
    lawyerId: string,
    input: SetAvailabilityInput,
  ): Promise<AvailabilitySlotInput[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const lawyer = await tx.lawyer.findFirst({ where: { id: lawyerId } });
      if (!lawyer) throw new NotFoundException('lawyer not found');

      // Replace the lawyer's weekly availability in one transaction.
      await tx.lawyerAvailability.deleteMany({ where: { lawyerId } });
      if (input.slots.length > 0) {
        await tx.lawyerAvailability.createMany({
          data: input.slots.map((s) => ({
            tenantId,
            lawyerId,
            weekday: s.weekday,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationMinutes: s.slotDurationMinutes,
          })),
        });
      }
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.LawyerAvailabilityUpdated, { lawyerId });
      return input.slots;
    });
  }
}
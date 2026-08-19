import { describe, expect, it, vi } from 'vitest';
import { AppointmentsService } from './appointments.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import type { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import type { AppointmentNotificationsService } from './appointment-notifications.service';
import type { CryptoService } from '../../../common/crypto/crypto.service';

function makeService() {
  const appts: Record<string, unknown>[] = [];
  const lawyers = new Set(['lw1']);
  const clients = new Set(['cl1']);

  const tx = {
    lawyer: { findFirst: vi.fn(async (a: { where: { id: string } }) => (lawyers.has(a.where.id) ? { id: a.where.id } : null)) },
    client: { findFirst: vi.fn(async (a: { where: { id: string } }) => (clients.has(a.where.id) ? { id: a.where.id, name: 'Test Client', waPhone: '+923001234567' } : null)) },
    appointment: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const row = {
          id: `ap-${appts.length + 1}`,
          reminderSentAt: null,
          client: { name: 'Test Client', waPhone: '+923001234567' },
          lawyer: { user: { name: 'Test Lawyer' } },
          ...a.data,
        };
        appts.push(row);
        return row;
      }),
      findMany: vi.fn(async (a: { where?: Record<string, unknown>; take?: number; skip?: number }) => {
        let result = appts;
        if (a.where?.status) result = appts.filter((x) => x.status === a.where!.status);
        return result.slice(a.skip ?? 0, (a.skip ?? 0) + (a.take ?? 50));
      }),
      findFirst: vi.fn(async (a: { where: { id: string } }) => appts.find((x) => x.id === a.where.id) ?? null),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const i = appts.findIndex((x) => x.id === a.where.id);
        if (i >= 0) appts[i] = { ...appts[i], ...a.data };
        return appts[i];
      }),
    },
    lawyerCalendar: { findFirst: vi.fn(async () => null) },
    outboxEvent: { create: vi.fn(async () => ({})) },
  };
  const uow = {
    withTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as UnitOfWork;
  const outbox = { append: vi.fn(async () => undefined) } as unknown as OutboxWriter;
  const googleCalendar = {
    createEvent: vi.fn(async () => null),
    updateEvent: vi.fn(async () => null),
    deleteEvent: vi.fn(async () => true),
  } as unknown as GoogleCalendarService;
  const crypto = {
    encrypt: vi.fn((s: string) => s),
    decrypt: vi.fn((s: string) => s),
  } as unknown as CryptoService;
  const notifications = {
    sendConfirmation: vi.fn(async () => false),
    sendCancellation: vi.fn(async () => false),
    sendUpdate: vi.fn(async () => false),
  } as unknown as AppointmentNotificationsService;
  return { service: new AppointmentsService(uow, outbox, googleCalendar, crypto, notifications), tx, appts, outbox, googleCalendar, notifications };
}

describe('AppointmentsService', () => {
  it('books an appointment and appends event', async () => {
    const { service, outbox } = makeService();
    const appt = await service.book('t1', {
      clientId: 'cl1',
      lawyerId: 'lw1',
      startsAt: '2026-08-13T09:00:00Z',
      endsAt: '2026-08-13T09:30:00Z',
    });
    expect(appt.status).toBe('CONFIRMED');
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'appointment.booked', expect.objectContaining({ lawyerId: 'lw1' }));
  });

  it('throws when lawyer not found', async () => {
    const { service } = makeService();
    await expect(
      service.book('t1', { clientId: 'cl1', lawyerId: 'missing', startsAt: '2026-08-13T09:00:00Z', endsAt: '2026-08-13T09:30:00Z' }),
    ).rejects.toThrow();
  });

  it('throws when client not found', async () => {
    const { service } = makeService();
    await expect(
      service.book('t1', { clientId: 'missing', lawyerId: 'lw1', startsAt: '2026-08-13T09:00:00Z', endsAt: '2026-08-13T09:30:00Z' }),
    ).rejects.toThrow();
  });

  it('cancels and appends cancellation event', async () => {
    const { service, outbox } = makeService();
    const appt = await service.book('t1', {
      clientId: 'cl1',
      lawyerId: 'lw1',
      startsAt: '2026-08-13T10:00:00Z',
      endsAt: '2026-08-13T10:30:00Z',
    });
    await service.update('t1', appt.id, { status: 'CANCELLED' });
    expect(outbox.append).toHaveBeenCalledWith(expect.anything(), 't1', 'appointment.cancelled', expect.objectContaining({ appointmentId: appt.id }));
  });

  it('emits appointment.completed when a meeting is marked done', async () => {
    const { service, outbox } = makeService();
    const appt = await service.book('t1', {
      clientId: 'cl1',
      lawyerId: 'lw1',
      startsAt: '2026-08-13T11:00:00Z',
      endsAt: '2026-08-13T11:30:00Z',
    });
    await service.update('t1', appt.id, { status: 'COMPLETED' });
    expect(outbox.append).toHaveBeenCalledWith(
      expect.anything(),
      't1',
      'appointment.completed',
      expect.objectContaining({ appointmentId: appt.id, clientId: 'cl1' }),
    );
  });

  it('lists appointments filtered by status', async () => {
    const { service } = makeService();
    await service.book('t1', { clientId: 'cl1', lawyerId: 'lw1', startsAt: '2026-08-13T09:00:00Z', endsAt: '2026-08-13T09:30:00Z' });
    const list = await service.list('t1', { status: 'CONFIRMED' });
    expect(list).toHaveLength(1);
  });

  it('marks reminder as sent', async () => {
    const { service, appts } = makeService();
    const appt = await service.book('t1', { clientId: 'cl1', lawyerId: 'lw1', startsAt: '2026-08-13T09:00:00Z', endsAt: '2026-08-13T09:30:00Z' });
    await service.markReminderSent('t1', appt.id);
    expect(appts[0].reminderSentAt).not.toBeNull();
  });
});
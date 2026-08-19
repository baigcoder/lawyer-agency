import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import type { Env } from '../../../config/env';

export interface CalendarStatus {
  connected: boolean;
  calendarId: string | null;
  connectedAt: Date | null;
}

/**
 * Application service for connecting/disconnecting a lawyer's Google Calendar.
 *
 * Stores the refresh token encrypted at rest (D-024). OAuth URLs are signed
 * with the lawyer id so the callback can be verified.
 */
@Injectable()
export class CalendarConnectionService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly google: GoogleCalendarService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  isConfigured(): boolean {
    return this.google.isConfigured();
  }

  async getAuthUrl(tenantId: string, lawyerId: string): Promise<string> {
    const state = this.encodeState(tenantId, lawyerId);
    return this.google.buildAuthUrl(state);
  }

  async connect(tenantId: string, lawyerId: string, code: string): Promise<CalendarStatus> {
    const { refreshToken } = await this.google.exchangeCode(code);
    return this.uow.withTenant(tenantId, async (tx) => {
      await tx.lawyerCalendar.upsert({
        where: { lawyerId },
        create: {
          tenantId,
          lawyerId,
          googleRefreshTokenEnc: this.crypto.encrypt(refreshToken),
          googleCalendarId: 'primary',
        },
        update: {
          googleRefreshTokenEnc: this.crypto.encrypt(refreshToken),
          googleCalendarId: 'primary',
        },
      });
      const calendar = await tx.lawyerCalendar.findFirst({ where: { lawyerId } });
      return {
        connected: true,
        calendarId: calendar?.googleCalendarId ?? 'primary',
        connectedAt: calendar?.connectedAt ?? new Date(),
      };
    });
  }

  async disconnect(tenantId: string, lawyerId: string): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      await tx.lawyerCalendar.deleteMany({ where: { lawyerId } });
    });
  }

  async getStatus(tenantId: string, lawyerId: string): Promise<CalendarStatus> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const calendar = await tx.lawyerCalendar.findFirst({ where: { lawyerId } });
      return {
        connected: calendar !== null,
        calendarId: calendar?.googleCalendarId ?? null,
        connectedAt: calendar?.connectedAt ?? null,
      };
    });
  }

  decodeState(state: string): { tenantId: string; lawyerId: string } {
    const decrypted = this.crypto.decrypt(state);
    const parsed = JSON.parse(decrypted) as { tenantId: string; lawyerId: string };
    if (!parsed.tenantId || !parsed.lawyerId) throw new Error('Invalid OAuth state');
    return parsed;
  }

  private encodeState(tenantId: string, lawyerId: string): string {
    return this.crypto.encrypt(JSON.stringify({ tenantId, lawyerId }));
  }
}

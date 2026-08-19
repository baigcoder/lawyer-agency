import { Injectable, NotFoundException } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { toInputJson } from '../../../common/persistence/json';
import type { FirmProfileInput } from './dto';
import { aiSettingsSchema, parseAiSettings, persistAiSettings, type AiSettings } from './ai-settings.dto';

export interface FirmProfile {
  firmName: string;
  displayName: string;
  city: string;
  officeAddress: string;
  website: string;
  practiceAreas: string[];
  clientLanguages: Array<'EN' | 'UR' | 'ROMAN_URDU'>;
  officeHours: string;
  teamSize: number;
  consultationFeePkr: number;
  firmAbout: string;
  foundingYear: number | null;
  differentiators: string[];
  setupTestSentAt: string | null;
  firstClientMessageAt: string | null;
}

const defaults: Omit<FirmProfile, 'firmName' | 'displayName'> = {
  city: '',
  officeAddress: '',
  website: '',
  practiceAreas: [],
  clientLanguages: ['EN', 'UR', 'ROMAN_URDU'],
  officeHours: 'Mon–Sat, 9:00–18:00 PKT',
  teamSize: 1,
  consultationFeePkr: 0,
  firmAbout: '',
  foundingYear: null,
  differentiators: [],
  setupTestSentAt: null,
  firstClientMessageAt: null,
};

@Injectable()
export class FirmProfileService {
  constructor(private readonly uow: UnitOfWork) {}

  async get(tenantId: string): Promise<FirmProfile> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, settings: true } });
      if (!tenant) throw new NotFoundException('Firm not found');
      const settings = asRecord(tenant.settings);
      return {
        firmName: tenant.name,
        displayName: typeof settings['displayName'] === 'string' && settings['displayName'].trim() ? settings['displayName'] : tenant.name,
        city: str(settings['city'], defaults.city),
        officeAddress: str(settings['officeAddress'], defaults.officeAddress),
        website: str(settings['website'], defaults.website),
        practiceAreas: Array.isArray(settings['practiceAreas']) ? settings['practiceAreas'].filter((v): v is string => typeof v === 'string') : [],
        clientLanguages: Array.isArray(settings['clientLanguages'])
          ? settings['clientLanguages'].filter((v): v is FirmProfile['clientLanguages'][number] => v === 'EN' || v === 'UR' || v === 'ROMAN_URDU')
          : defaults.clientLanguages,
        officeHours: str(settings['officeHours'], defaults.officeHours),
        teamSize: typeof settings['teamSize'] === 'number' && settings['teamSize'] > 0 ? settings['teamSize'] : defaults.teamSize,
        consultationFeePkr: typeof settings['consultationFeePkr'] === 'number' && settings['consultationFeePkr'] >= 0 ? settings['consultationFeePkr'] : defaults.consultationFeePkr,
        firmAbout: str(settings['firmAbout'], defaults.firmAbout),
        foundingYear:
          typeof settings['foundingYear'] === 'number' && settings['foundingYear'] >= 1900
            ? settings['foundingYear']
            : defaults.foundingYear,
        differentiators: Array.isArray(settings['differentiators'])
          ? settings['differentiators'].filter((v): v is string => typeof v === 'string')
          : defaults.differentiators,
        setupTestSentAt: typeof settings['setupTestSentAt'] === 'string' ? settings['setupTestSentAt'] : null,
        firstClientMessageAt: typeof settings['firstClientMessageAt'] === 'string' ? settings['firstClientMessageAt'] : null,
      };
    });
  }

  async update(tenantId: string, input: FirmProfileInput): Promise<FirmProfile> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
      if (!current) throw new NotFoundException('Firm not found');
      const prior = asRecord(current.settings);
      const settings = toInputJson({
        ...prior,
        displayName: input.displayName,
        city: input.city,
        officeAddress: input.officeAddress,
        website: input.website,
        practiceAreas: input.practiceAreas,
        clientLanguages: input.clientLanguages,
        officeHours: input.officeHours,
        teamSize: input.teamSize,
        consultationFeePkr: input.consultationFeePkr,
        firmAbout: input.firmAbout,
        foundingYear: input.foundingYear ?? null,
        differentiators: input.differentiators,
      });
      await tx.tenant.update({ where: { id: tenantId }, data: { name: input.firmName, settings } });
      const currentProfile = await this.get(tenantId);
      return currentProfile;
    });
  }

  async getAiAutoReply(tenantId: string): Promise<{ aiAutoReplyEnabled: boolean }> {
    const settings = await this.getAiSettings(tenantId);
    return { aiAutoReplyEnabled: settings.aiAutoReplyEnabled };
  }

  async setAiAutoReply(tenantId: string, enabled: boolean): Promise<{ aiAutoReplyEnabled: boolean }> {
    const current = await this.getAiSettings(tenantId);
    return this.setAiSettings(tenantId, { ...current, aiAutoReplyEnabled: enabled });
  }

  async getAiSettings(tenantId: string): Promise<AiSettings> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
      if (!tenant) throw new NotFoundException('Firm not found');
      return parseAiSettings(asRecord(tenant.settings));
    });
  }

  async setAiSettings(tenantId: string, input: AiSettings): Promise<AiSettings> {
    const parsed = aiSettingsSchema.parse(input);
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
      if (!current) throw new NotFoundException('Firm not found');
      const prior = asRecord(current.settings);
      const settings = toInputJson({
        ...prior,
        ...persistAiSettings(parsed),
      });
      await tx.tenant.update({ where: { id: tenantId }, data: { settings } });
      return parsed;
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

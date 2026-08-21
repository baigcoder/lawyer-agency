import { Module } from '@nestjs/common';
import {
  META_CLOUD_API,
  META_OAUTH_CLIENT,
  OBJECT_STORAGE,
  OUTBOUND_SENDER,
  PILOT_SESSION_REPOSITORY,
  WA_ROUTE_LOOKUP,
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_CONNECTION_REPOSITORY,
  WHATSAPP_TEMPLATE_REPOSITORY,
  WHATSAPP_CALLING,
} from './application/ports';
import { MetaCloudApiClient } from './infrastructure/meta-cloud-api.client';
import { MetaOAuthClientImpl } from './infrastructure/meta-oauth.client';
import {
  PrismaWaRouteLookup,
  PrismaWhatsappAccountRepository,
  PrismaWhatsappTemplateRepository,
} from './infrastructure/prisma-whatsapp.repositories';
import { PrismaPilotSessionRepository } from './infrastructure/prisma-pilot.repositories';
import { PrismaWhatsappConnectionRepository } from './infrastructure/prisma-whatsapp-connection.repository';
import { FilesystemObjectStorage } from './infrastructure/filesystem-object-storage';
import { SupabaseObjectStorage } from './infrastructure/supabase-object-storage';
import { FallbackObjectStorage } from './infrastructure/fallback-object-storage';
import { DevMockMetaCloudApi } from './infrastructure/dev-mock-meta-cloud-api';
import { EvolutionOutboundSender } from './application/evolution-outbound-sender.service';
import { SendService } from './application/send.service';
import { MediaReadService } from './application/media-read.service';
import { EvolutionApiClient } from './infrastructure/evolution-api.client';
import { WhatsappCallingAdapter } from './infrastructure/whatsapp-calling.adapter';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/**
 * Shared WhatsApp infrastructure ports (D-013 / D-024). Extracted into its own
 * module so both WhatsappModule and DocumentsModule can import it without a
 * circular dependency. WhatsappModule owns the adapters; other modules consume
 * the ports only.
 */
@Module({
  providers: [
    { provide: WA_ROUTE_LOOKUP, useClass: PrismaWaRouteLookup },
    { provide: WHATSAPP_ACCOUNT_REPOSITORY, useClass: PrismaWhatsappAccountRepository },
    { provide: WHATSAPP_CONNECTION_REPOSITORY, useClass: PrismaWhatsappConnectionRepository },
    { provide: WHATSAPP_TEMPLATE_REPOSITORY, useClass: PrismaWhatsappTemplateRepository },
    { provide: PILOT_SESSION_REPOSITORY, useClass: PrismaPilotSessionRepository },
    MetaCloudApiClient,
    DevMockMetaCloudApi,
    EvolutionApiClient,
    { provide: WHATSAPP_CALLING, useClass: WhatsappCallingAdapter },
    {
      provide: META_CLOUD_API,
      inject: [ConfigService, MetaCloudApiClient, DevMockMetaCloudApi],
      useFactory: (
        config: ConfigService<Env, true>,
        meta: MetaCloudApiClient,
        mock: DevMockMetaCloudApi,
      ) => {
        // Configuration is read after ConfigModule loads apps/api/.env. Reading
        // process.env during module evaluation misses dotenv-only values.
        if (config.get('META_USE_REAL_API', { infer: true }) === 'true') return meta;
        return mock;
      },
    },
    { provide: OUTBOUND_SENDER, useClass: EvolutionOutboundSender },
    SendService,
    MediaReadService,
    { provide: META_OAUTH_CLIENT, useClass: MetaOAuthClientImpl },
    FilesystemObjectStorage,
    SupabaseObjectStorage,
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService, SupabaseObjectStorage, FilesystemObjectStorage],
      useFactory: (
        config: ConfigService<Env, true>,
        supabase: SupabaseObjectStorage,
        filesystem: FilesystemObjectStorage,
      ) => {
        const url = config.get('SUPABASE_URL', { infer: true });
        const key = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
        const driver = config.get('OBJECT_STORAGE_DRIVER', { infer: true }) ?? 'auto';
        if (driver === 'filesystem') return filesystem;
        if (driver === 'supabase') return supabase;
        if (url && key) {
          return new FallbackObjectStorage(supabase, filesystem);
        }
        return filesystem;
      },
    },
  ],
  exports: [
    WA_ROUTE_LOOKUP,
    WHATSAPP_ACCOUNT_REPOSITORY,
    WHATSAPP_CONNECTION_REPOSITORY,
    WHATSAPP_TEMPLATE_REPOSITORY,
    PILOT_SESSION_REPOSITORY,
    META_CLOUD_API,
    META_OAUTH_CLIENT,
    OBJECT_STORAGE,
    OUTBOUND_SENDER,
    SendService,
    MediaReadService,
    EvolutionApiClient,
    WHATSAPP_CALLING,
  ],
})
export class WhatsappPortsModule {}

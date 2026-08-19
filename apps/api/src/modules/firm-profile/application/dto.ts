import { z } from 'zod';

export const firmProfileSchema = z.object({
  firmName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(60),
  officeAddress: z.string().trim().max(200).optional().default(''),
  website: z.union([z.string().trim().url().max(200), z.literal('')]).optional().default(''),
  practiceAreas: z.array(z.string().trim().min(2).max(60)).min(1).max(20),
  clientLanguages: z.array(z.enum(['EN', 'UR', 'ROMAN_URDU'])).min(1).max(3),
  officeHours: z.string().trim().min(2).max(120),
  teamSize: z.number().int().min(1).max(5000),
  consultationFeePkr: z.number().int().min(0).max(1_000_000).default(0),
  firmAbout: z.string().trim().max(2000).optional().default(''),
  foundingYear: z.number().int().min(1900).max(2100).nullable().optional(),
  differentiators: z.array(z.string().trim().min(1).max(200)).max(10).optional().default([]),
});

export type FirmProfileInput = z.infer<typeof firmProfileSchema>;

/**
 * Onboarding wizard payload (Phase 18 / D-093). `firmName` is the legal
 * name; `displayName` is what clients see. Everything except `firmName`
 * and `adminName` is optional so the legacy single-field call keeps working.
 */
export const provisionFirmSchema = z.object({
  firmName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().min(2).max(60).optional(),
  officeAddress: z.string().trim().max(200).optional(),
  website: z.union([z.string().trim().url().max(200), z.literal('')]).optional(),
  practiceAreas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  clientLanguages: z.array(z.enum(['EN', 'UR', 'ROMAN_URDU'])).max(3).optional(),
  officeHours: z.string().trim().min(2).max(120).optional(),
  teamSize: z.number().int().min(1).max(5000).optional(),
  adminName: z.string().trim().min(1).max(120).optional(),
  adminEmail: z.union([z.string().trim().email().max(200), z.literal('')]).optional(),
});

export type ProvisionFirmInput = z.infer<typeof provisionFirmSchema>;

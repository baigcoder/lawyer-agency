import { z } from 'zod';

export const firmProfileSchema = z.object({
  firmName: z.string().trim().min(2, 'Firm name is required').max(120),
  displayName: z.string().trim().min(2, 'Display name is required').max(120),
  city: z.string().trim().min(2, 'City is required').max(60),
  officeAddress: z.string().trim().max(200).optional(),
  website: z.union([z.string().trim().url('Enter a valid URL').max(200), z.literal('')]).optional(),
  practiceAreas: z.array(z.string().trim().min(2).max(60)).min(1, 'Add at least one practice area').max(20),
  clientLanguages: z.array(z.enum(['EN', 'UR', 'ROMAN_URDU'])).min(1).max(3),
  officeHours: z.string().trim().min(2, 'Office hours are required').max(120),
  teamSize: z.number().int().min(1).max(5000),
  consultationFeePkr: z.number().int().min(0).max(1_000_000),
  firmAbout: z.string().trim().max(2000).optional(),
  foundingYear: z.number().int().min(1900).max(2100).nullable().optional(),
  differentiators: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});

export const firmProfileReadSchema = firmProfileSchema.extend({
  setupTestSentAt: z.string().nullable().optional(),
  firstClientMessageAt: z.string().nullable().optional(),
});

export type FirmProfile = z.infer<typeof firmProfileSchema>;

export const practiceAreaOptions = [
  'Family law',
  'Property and real estate',
  'Criminal defence',
  'Corporate and commercial',
  'Civil litigation',
  'Tax law',
  'Labour and employment',
  'Intellectual property',
  'Banking and finance',
  'Immigration law',
  'Consumer protection',
  'Constitutional law',
  'Other',
] as const;

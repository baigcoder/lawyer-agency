import type { RetrievedChunk } from '../../rag/application/retriever.port';
import type { AiSettings } from '../../firm-profile/application/ai-settings.dto';

export interface FirmProfileSnapshot {
  firmName: string;
  displayName: string;
  city: string;
  officeAddress: string;
  website: string;
  practiceAreas: string[];
  clientLanguages: Array<'EN' | 'UR' | 'ROMAN_URDU'>;
  officeHours: string;
  consultationFeePkr: number;
  teamSize: number;
  firmAbout: string;
  foundingYear: number | null;
  differentiators: string[];
}

export interface OwnerProfileSnapshot {
  ownerName: string;
  bio: string;
  bioUr: string;
  yearsExperience: number | null;
  barCouncil: string;
  barEnrollmentNumber: string;
  education: string[];
  achievements: string[];
  languages: string[];
  practiceAreas: string[];
  featuredCases: Array<{ publicTitle: string; publicOutcome: string }>;
}

export interface AiRunContext {
  firm: FirmProfileSnapshot;
  ownerProfile: OwnerProfileSnapshot | null;
  aiSettings: AiSettings;
  /** True when the AI has not sent any outbound message in this thread yet. */
  isFirstClientTurn: boolean;
  conversationHistory: string;
  /** Most recent AI outbound text in this thread (empty if none). */
  lastAiReply: string;
  intakeFields: Record<string, unknown>;
  clientId: string;
  caseId: string | undefined;
  retrievedChunks: RetrievedChunk[];
  retrievedContext: string;
}

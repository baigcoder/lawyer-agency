'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DashboardView } from '@/lib/dashboard-nav';
import type { DemoActivity, DemoConversation, DemoEscalation, DemoPayment } from '@/lib/demo-workspace';
import type { UiSound } from '@/lib/ui-sound';

export interface DemoContextValue {
  view: DashboardView;
  go: (view: DashboardView, opts?: { conversation?: string; caseRef?: string; escalation?: string }) => void;
  conversations: DemoConversation[];
  selectedConversation: string | null;
  setSelectedConversation: (id: string | null) => void;
  markRead: (id: string) => void;
  approveDraft: (id: string, text: string) => void;
  sendMessage: (id: string, text: string, asNote: boolean) => void;
  escalations: DemoEscalation[];
  selectedEscalation: string;
  setSelectedEscalation: (id: string) => void;
  acknowledge: (id: string) => void;
  resolve: (id: string) => void;
  payments: DemoPayment[];
  verifyPayment: (id: string) => void;
  focusCase: string | null;
  setFocusCase: (ref: string | null) => void;
  play: (cue: UiSound) => void;
  arrivedId: string | null;
  /** Who is typing in which conversation right now (live script). */
  typing: { id: string; who: 'client' | 'ai' } | null;
  activity: DemoActivity[];
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used inside <DemoApp>');
  return ctx;
}


/** Page padding shared by every demo view (matches the dashboard main area). */
export function DemoPage({ children }: { children: ReactNode }) {
  return <div className="app-enter mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>;
}

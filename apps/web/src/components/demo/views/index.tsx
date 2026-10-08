'use client';

import { useDemo } from '@/components/demo/demo-context';
import { AnalyticsView } from '@/components/demo/views/analytics';
import { CalendarView } from '@/components/demo/views/calendar';
import { CasesView } from '@/components/demo/views/cases';
import { DocumentsView } from '@/components/demo/views/documents';
import { EscalationsView } from '@/components/demo/views/escalations';
import { InboxView } from '@/components/demo/views/inbox';
import { KnowledgeView } from '@/components/demo/views/knowledge';
import { OverviewView } from '@/components/demo/views/overview';
import { PaymentsView } from '@/components/demo/views/payments';
import { SettingsView } from '@/components/demo/views/settings';
import { SetupView } from '@/components/demo/views/setup';
import { TeamView } from '@/components/demo/views/team';
import { WhatsappView } from '@/components/demo/views/whatsapp';
import type { DashboardView } from '@/lib/dashboard-nav';

const VIEWS: Record<DashboardView, () => React.JSX.Element> = {
  overview: OverviewView,
  inbox: InboxView,
  escalations: EscalationsView,
  cases: CasesView,
  calendar: CalendarView,
  documents: DocumentsView,
  knowledge: KnowledgeView,
  whatsapp: WhatsappView,
  payments: PaymentsView,
  analytics: AnalyticsView,
  team: TeamView,
  settings: SettingsView,
  setup: SetupView,
};

export function DemoView() {
  const { view } = useDemo();
  const View = VIEWS[view];
  return <View />;
}

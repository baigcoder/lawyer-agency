'use client';

import { Check, Minus, UserPlus } from 'lucide-react';
import { DemoPage } from '@/components/demo/demo-context';
import { PageHeader } from '@/components/page-header';
import { Signal } from '@/components/signal';
import { Button } from '@/components/ui/button';
import { Panel, PersonAvatar } from '@/components/workspace/panel';
import { TEAM } from '@/lib/demo-workspace';
import { useLanguage } from '@/lib/language';
import type { TranslationKey } from '@/lib/translations';

const PERMISSIONS: Array<{ key: TranslationKey; owner: boolean; lawyer: boolean; staff: boolean }> = [
  { key: 'permInbox', owner: true, lawyer: true, staff: true },
  { key: 'permApprove', owner: true, lawyer: true, staff: false },
  { key: 'permEscalations', owner: true, lawyer: true, staff: false },
  { key: 'permPayments', owner: true, lawyer: false, staff: true },
  { key: 'permWhatsapp', owner: true, lawyer: false, staff: false },
  { key: 'permSettings', owner: true, lawyer: false, staff: false },
];

export function TeamView() {
  const { t } = useLanguage();
  const roleKey = { Owner: 'roleOwner', Lawyer: 'roleLawyer', Staff: 'roleStaff' } as const;

  return (
    <DemoPage>
      <PageHeader
        eyebrow={`${TEAM.length} ${t('teamMembers')} · ${TEAM.filter((m) => m.role !== 'Staff').length} ${t('teamAdvocates')}`}
        title={t('demoRosterTitle')}
        description={t('demoRosterLede')}
        action={
          <Button size="sm" className="h-8">
            <UserPlus aria-hidden />
            {t('teamInvite')}
          </Button>
        }
      />

      <Panel bodyClassName="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="bg-sunken/70">
            <tr>
              {[t('teamPerson'), t('teamRole'), t('teamEnrolment'), t('teamAvailability'), t('teamMatters'), t('teamEsc7d'), t('teamActive')].map((h, i) => (
                <th key={h} scope="col" className={`docket px-4 py-2 font-medium text-muted-foreground ${i >= 4 && i <= 5 ? 'text-end' : 'text-start'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TEAM.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <PersonAvatar initials={m.initials} firm={m.role !== 'Staff'} />
                    <span>
                      <span className="block font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">{m.title}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3"><span className="docket text-foreground/80">{t(roleKey[m.role])}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{m.enrolment}</td>
                <td className="px-4 py-3"><Signal level={m.availability.level} className="normal-case tracking-normal">{m.availability.label}</Signal></td>
                <td className="px-4 py-3 text-end font-mono tabular-nums">{m.openMatters || '—'}</td>
                <td className="px-4 py-3 text-end font-mono tabular-nums">{m.escalations7d || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel className="mt-4 max-w-2xl" title={t('teamPermissions')} meta={t('teamPermissionsMeta')} bodyClassName="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2 text-start"><span className="sr-only">{t('teamPermissions')}</span></th>
              {(['roleOwner', 'roleLawyer', 'roleStaff'] as const).map((r) => (
                <th key={r} scope="col" className="docket w-20 px-2 py-2 text-center font-medium text-muted-foreground">{t(r)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PERMISSIONS.map((p) => (
              <tr key={p.key}>
                <th scope="row" className="px-4 py-2 text-start font-normal">{t(p.key)}</th>
                {[p.owner, p.lawyer, p.staff].map((on, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    {on ? <Check className="mx-auto size-4 text-primary" aria-label="✓" /> : <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="—" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </DemoPage>
  );
}

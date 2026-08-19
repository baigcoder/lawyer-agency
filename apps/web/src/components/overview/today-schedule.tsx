'use client';

import Link from 'next/link';
import { CalendarDays, Gavel, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { humanizeEnum } from '@/lib/format';
import { useLanguage } from '@/lib/language';
import type { AppointmentDto } from '@/lib/schemas/appointment';
import type { HearingDto } from '@/lib/schemas/case';

type ScheduleItem =
  | { kind: 'appointment'; at: Date; appointment: AppointmentDto }
  | { kind: 'hearing'; at: Date; hearing: HearingDto };

function timeLabel(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TodaySchedule({
  appointments,
  hearings,
  isPending,
  isError,
}: {
  appointments: AppointmentDto[] | undefined;
  hearings: HearingDto[] | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const { t } = useLanguage();

  const items: ScheduleItem[] = [
    ...(appointments ?? [])
      .filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING')
      .map((appointment) => ({ kind: 'appointment' as const, at: appointment.startsAt, appointment })),
    ...(hearings ?? []).map((hearing) => ({ kind: 'hearing' as const, at: hearing.hearingAt, hearing })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
              {t('todaysSchedule')}
            </CardTitle>
            <CardDescription>{t('todaysScheduleDetail')}</CardDescription>
          </div>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/calendar" />}>
            {t('openCalendar')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : null}
        {isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('couldntLoadSchedule')}
          </p>
        ) : null}
        {!isPending && !isError && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('nothingOnSchedule')}</p>
        ) : null}
        {items.slice(0, 8).map((item) =>
          item.kind === 'appointment' ? (
            <Link
              key={`a-${item.appointment.id}`}
              href="/dashboard/calendar"
              className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
            >
              <div className="w-14 shrink-0 pt-0.5 font-mono text-xs font-medium text-primary">
                {timeLabel(item.at)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {item.appointment.clientName ?? item.appointment.clientWaPhone}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t('consultationWith')} {item.appointment.lawyerName}
                  {item.appointment.location ? ` · ${item.appointment.location}` : ''}
                </p>
              </div>
              <Badge variant="outline">{humanizeEnum(item.appointment.status)}</Badge>
            </Link>
          ) : (
            <Link
              key={`h-${item.hearing.id}`}
              href="/dashboard/cases"
              className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
            >
              <div className="w-14 shrink-0 pt-0.5 font-mono text-xs font-medium text-primary">
                {timeLabel(item.at)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  <Gavel className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {item.hearing.courtName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.hearing.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {item.hearing.location}
                    </span>
                  ) : (
                    t('courtHearing')
                  )}
                  {item.hearing.judge ? ` · ${item.hearing.judge}` : ''}
                </p>
              </div>
              <Badge variant="secondary">{t('hearing')}</Badge>
            </Link>
          ),
        )}
      </CardContent>
    </Card>
  );
}

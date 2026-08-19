'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { humanizeEnum } from '@/lib/format';
import { BadgeVariants } from '@/lib/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { PageHeader } from '@/components/page-header';
import { CalendarConnectionCard } from '@/components/calendar-connection-card';
import {
  appointmentListSchema,
  appointmentStatusSchema,
  lawyerListSchema,
  type BookAppointmentInput,
} from '@/lib/schemas/appointment';
import type { AppointmentDto } from '@/lib/schemas/appointment';
import { inboxListSchema, type InboxSummary } from '@/lib/schemas/inbox';

const statusVariant = BadgeVariants([
  ['PENDING', 'secondary'],
  ['CONFIRMED', 'default'],
  ['CANCELLED', 'destructive'],
  ['COMPLETED', 'secondary'],
  ['NO_SHOW', 'outline'],
] as const);

const bookFormSchema = z
  .object({
    clientId: z.string().min(1, 'Choose a client'),
    lawyerId: z.string().min(1, 'Choose a lawyer'),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
    location: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'End time must be after start time',
    path: ['endsAt'],
  });
type BookFormValues = z.infer<typeof bookFormSchema>;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function monthRange(monthStart: Date): { from: string; to: string } {
  const from = new Date(Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), 1));
  const to = new Date(Date.UTC(monthStart.getFullYear(), monthStart.getMonth() + 1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Monday-first 6-week grid (empty cells for days outside the month). */
function gridCells(monthStart: Date): (Date | null)[] {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day.getMonth() === monthStart.getMonth() ? day : null;
  });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarPage() {
  const { t } = useLanguage();
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const { from, to } = useMemo(() => monthRange(monthStart), [monthStart]);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', from, to],
    queryFn: () =>
      apiRequest(`/v1/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`, {
        schema: appointmentListSchema,
      }),
  });

  const [bookOpen, setBookOpen] = useState(false);
  const [bookDate, setBookDate] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = appointmentsQuery.data?.find((a) => a.id === selectedId) ?? null;

  const cells = useMemo(() => gridCells(monthStart), [monthStart]);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('calendar')}
        description={t('calendarDescription')}
        icon={CalendarDays}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="size-4" />
              <span className="sr-only">{t('previousMonth')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonthStart(new Date(today.getFullYear(), today.getMonth(), 1))}>
              {t('today')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRight className="size-4" />
              <span className="sr-only">{t('nextMonth')}</span>
            </Button>
          </div>
        }
      />

      <CalendarConnectionCard />

      {appointmentsQuery.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load appointments: {appointmentsQuery.error.message}
          {appointmentsQuery.error instanceof ApiError && appointmentsQuery.error.correlationId && (
            <span className="mt-1 block text-xs text-muted-foreground">
              correlation id: {appointmentsQuery.error.correlationId}
            </span>
          )}
        </p>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <Button size="sm" onClick={() => { setBookDate(new Date()); setBookOpen(true); }}>
            <CalendarDays className="size-4" />
            {t('bookAppointment')}
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1" aria-busy={appointmentsQuery.isPending} aria-label="Calendar grid">
          {WEEKDAYS.map((day) => (
            <div key={day} className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}

          {appointmentsQuery.isPending ? (
            Array.from({ length: 42 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : (
            cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="h-24 rounded-lg bg-muted/40" />;
              const dayAppts = (appointmentsQuery.data ?? []).filter((a) => sameDay(a.startsAt, day));
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  role="gridcell"
                  className="group/cell flex h-24 flex-col gap-1 rounded-lg border border-border/60 p-1.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-xs font-medium ${isToday ? 'flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                      {day.getDate()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 opacity-0 group-hover/cell:opacity-100"
                      onClick={() => { setBookDate(day); setBookOpen(true); }}
                      aria-label={`Book appointment on ${day.toLocaleDateString()}`}
                    >
                      <span aria-hidden>+</span>
                    </Button>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                    {dayAppts.slice(0, 3).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[11px] text-primary hover:bg-primary/20"
                      >
                        {formatTime(a.startsAt)} · {a.clientName ?? a.clientWaPhone}
                      </button>
                    ))}
                    {dayAppts.length > 3 && (
                      <span className="truncate px-1 text-[11px] text-muted-foreground">+{dayAppts.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })
            )}
        </div>
      </Card>

      {bookOpen && bookDate && (
        <BookAppointmentDialog
          initialDate={bookDate}
          open={bookOpen}
          onOpenChange={setBookOpen}
          onBooked={() => {
            setBookOpen(false);
            appointmentsQuery.refetch();
          }}
        />
      )}

      {selected && (
        <AppointmentDetailsDialog
          appointment={selected}
          open={selectedId !== null}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }}
          onChanged={() => appointmentsQuery.refetch()}
        />
      )}
    </div>
  );
}

function BookAppointmentDialog({
  initialDate,
  open,
  onOpenChange,
  onBooked,
}: {
  initialDate: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}) {
  const defaultStart = new Date(initialDate);
  defaultStart.setHours(10, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(10, 30, 0, 0);

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: {
      clientId: '',
      lawyerId: '',
      startsAt: toLocalInputValue(defaultStart),
      endsAt: toLocalInputValue(defaultEnd),
      location: '',
      notes: '',
    },
  });

  const lawyersQuery = useQuery({
    queryKey: ['lawyers'],
    queryFn: () => apiRequest('/v1/lawyers', { schema: lawyerListSchema }),
  });

  const inboxQuery = useQuery({
    queryKey: ['inbox'],
    queryFn: () => apiRequest('/v1/inbox', { schema: inboxListSchema }),
  });

  const clients = useMemo(() => {
    const byId = new Map<string, InboxSummary['client']>();
    for (const c of inboxQuery.data ?? []) {
      if (!byId.has(c.client.id)) byId.set(c.client.id, c.client);
    }
    return [...byId.values()].sort((a, b) => (a.name ?? a.waPhone).localeCompare(b.name ?? b.waPhone));
  }, [inboxQuery.data]);

  const queryClient = useQueryClient();
  const bookMutation = useMutation({
    mutationFn: (input: BookAppointmentInput) =>
      apiRequest('/v1/appointments', { method: 'POST', body: input }),
    onSuccess: () => {
      toast.success('Appointment booked');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onBooked();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const toIso = (v: string) => new Date(v).toISOString();
    bookMutation.mutate({ ...values, startsAt: toIso(values.startsAt), endsAt: toIso(values.endsAt) });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>
            {initialDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Controller
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? '')}>
                  <SelectTrigger id="clientId" className="w-full">
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name ?? c.waPhone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.clientId && (
              <p className="text-sm text-destructive" role="alert">{form.formState.errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lawyerId">Lawyer</Label>
            <Controller
              control={form.control}
              name="lawyerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? '')}>
                  <SelectTrigger id="lawyerId" className="w-full">
                    <SelectValue placeholder="Choose a lawyer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(lawyersQuery.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.lawyerId && (
              <p className="text-sm text-destructive" role="alert">{form.formState.errors.lawyerId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" type="datetime-local" {...form.register('startsAt')} />
              {form.formState.errors.startsAt && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.startsAt.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsAt">Ends</Label>
              <Input id="endsAt" type="datetime-local" {...form.register('endsAt')} />
              {form.formState.errors.endsAt && (
                <p className="text-sm text-destructive" role="alert">{form.formState.errors.endsAt.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Office, court, video call…" {...form.register('location')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} placeholder="Optional context for the appointment" {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={bookMutation.isPending}>
              {bookMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const statusOptions = appointmentStatusSchema.options.filter((s) => s !== 'PENDING');

function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  onChanged,
}: {
  appointment: AppointmentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (status: AppointmentDto['status']) =>
      apiRequest(`/v1/appointments/${appointment.id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      toast.success('Appointment updated');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onChanged();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment.clientName ?? appointment.clientWaPhone}</DialogTitle>
          <DialogDescription>
            {appointment.startsAt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}{' '}
            · {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={statusVariant[appointment.status]}>{appointment.status}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Client</span>
            <span>{appointment.clientName ?? appointment.clientWaPhone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-mono text-xs">{appointment.clientWaPhone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Lawyer</span>
            <span>{appointment.lawyerName}</span>
          </div>
          {appointment.location && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Location</span>
              <span>{appointment.location}</span>
            </div>
          )}
          {appointment.notes && (
            <div>
              <span className="text-muted-foreground">Notes</span>
              <p className="mt-1 rounded-md bg-muted/50 p-2 whitespace-pre-wrap">{appointment.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          {statusOptions.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={s === appointment.status ? 'default' : 'outline'}
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate(s)}
            >
              {s === appointment.status ? 'Current' : humanizeEnum(s)}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LoaderCircle, Mail, Save, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { availabilitySlotSchema, lawyerListSchema, lawyerSchema, type AvailabilitySlot, type LawyerDto } from '@/lib/schemas/lawyers';
import { inviteUserSchema, roleListSchema, userListSchema, userSummarySchema, type UserSummary } from '@/lib/schemas/users';
import { practiceAreaOptions } from '@/lib/schemas/firm-profile';

const WEEKDAYS = [
  { weekday: 1, label: 'Monday' },
  { weekday: 2, label: 'Tuesday' },
  { weekday: 3, label: 'Wednesday' },
  { weekday: 4, label: 'Thursday' },
  { weekday: 5, label: 'Friday' },
  { weekday: 6, label: 'Saturday' },
  { weekday: 0, label: 'Sunday' },
] as const;

interface DraftSlot {
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotDurationMinutes: string;
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function draftFromLawyer(lawyer: LawyerDto): Record<number, DraftSlot> {
  const draft: Record<number, DraftSlot> = {};
  for (const day of WEEKDAYS) {
    const slot = lawyer.availability.find((a) => a.weekday === day.weekday);
    draft[day.weekday] = slot
      ? {
          enabled: true,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotDurationMinutes: String(slot.slotDurationMinutes),
        }
      : { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: '30' };
  }
  return draft;
}

function InviteMemberForm() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => apiRequest('/v1/users/roles/list', { schema: roleListSchema }),
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');

  const invite = useMutation({
    mutationFn: (body: z.infer<typeof inviteUserSchema>) =>
      apiRequest('/v1/users', { method: 'POST', body, schema: userSummarySchema }),
    onSuccess: () => {
      toast.success(t('invitationSent'));
      setName('');
      setEmail('');
      setPhone('');
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('couldNotInviteMember')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const lawyerRoleId = roles.data?.find((r) => r.name === 'Lawyer')?.id ?? roles.data?.[0]?.id ?? '';
  const selectedRoleId = roleId || lawyerRoleId;
  const selectedRoleName =
    roles.data?.find((r) => r.id === selectedRoleId)?.name ?? t('selectRole');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const selectedRole = roleId || lawyerRoleId;
    if (!selectedRole) {
      toast.error(t('chooseRoleFirst'));
      return;
    }
    const parsed = inviteUserSchema.safeParse({
      name: name.trim(),
      email: email.trim(),
      roleId: selectedRole,
      phone: phone.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t('invalidInviteDetails'));
      return;
    }
    invite.mutate(parsed.data);
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="invite-name">{t('name')}</Label>
        <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invite-email">{t('email')}</Label>
        <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invite-phone">{t('phoneOptional')}</Label>
        <Input id="invite-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>{t('role')}</Label>
        <Select value={selectedRoleId} onValueChange={(v) => v && setRoleId(v)} disabled={roles.isPending}>
          <SelectTrigger className="w-full *:data-[slot=select-value]:line-clamp-none" aria-label={t('role')}>
            <span>{selectedRoleName}</span>
          </SelectTrigger>
          <SelectContent>
            {(roles.data ?? []).map((role) => (
              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto" disabled={invite.isPending || roles.isPending}>
          {invite.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t('inviteTeamMember')}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{t('inviteTeamMemberHint')}</p>
      </div>
    </form>
  );
}

function UsersTable({ users, lawyers, canManage }: { users: UserSummary[]; lawyers: LawyerDto[]; canManage: boolean }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => apiRequest('/v1/users/roles/list', { schema: roleListSchema }),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      apiRequest(`/v1/users/${userId}`, { method: 'PATCH', body: { roleId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('couldNotUpdateRole')),
  });

  const createLawyer = useMutation({
    mutationFn: (userId: string) =>
      apiRequest('/v1/lawyers', { method: 'POST', body: { userId, practiceAreas: [] }, schema: lawyerSchema }),
    onSuccess: () => {
      toast.success(t('lawyerProfileCreated'));
      void queryClient.invalidateQueries({ queryKey: ['lawyers'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('couldNotCreateLawyerProfile')),
  });

  const resendInvite = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/v1/users/${userId}/resend-invite`, { method: 'POST', schema: userSummarySchema }),
    onSuccess: () => toast.success(t('invitationResent')),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('couldNotResendInvite')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const lawyerUserIds = new Set(lawyers.map((l) => l.userId));

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center">
        <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm font-medium">{t('noTeamMembersYet')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('noTeamMembersYetDesc')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('email')}</TableHead>
          <TableHead>{t('role')}</TableHead>
          <TableHead>{t('status')}</TableHead>
          <TableHead>{t('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
                  {initials(user.name)}
                </div>
                <span className="font-medium">{user.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              {canManage ? (
              <Select
                value={user.roleId}
                onValueChange={(rid) => rid && updateRole.mutate({ userId: user.id, roleId: rid })}
                disabled={updateRole.isPending || roles.isPending}
              >
                <SelectTrigger
                  className="h-8 w-auto min-w-[8.5rem] text-xs *:data-[slot=select-value]:line-clamp-none"
                  aria-label={t('role')}
                >
                  <span>
                    {roles.data?.find((r) => r.id === user.roleId)?.name ?? user.roleName}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(roles.data ?? []).map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              ) : (
                <span className="text-sm">{user.roleName}</span>
              )}
            </TableCell>
            <TableCell>
              <Badge
                variant={user.status === 'ACTIVE' ? 'default' : user.status === 'SUSPENDED' ? 'outline' : 'secondary'}
              >
                {user.status === 'INVITED'
                  ? t('statusInvited')
                  : user.status === 'SUSPENDED'
                    ? t('statusSuspended')
                    : t('statusActive')}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-2">
                {canManage && user.status === 'INVITED' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resendInvite.isPending}
                    onClick={() => resendInvite.mutate(user.id)}
                  >
                    {resendInvite.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {t('resendInvite')}
                  </Button>
                ) : null}
                {canManage && user.status === 'ACTIVE' && user.roleName === 'Lawyer' && !lawyerUserIds.has(user.id) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={createLawyer.isPending}
                    onClick={() => createLawyer.mutate(user.id)}
                  >
                    {t('addLawyerProfile')}
                  </Button>
                ) : user.status === 'ACTIVE' && user.roleName === 'Lawyer' ? (
                  <span className="text-xs text-muted-foreground">{t('profileReady')}</span>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AvailabilityEditor({ lawyer, onSaved }: { lawyer: LawyerDto; onSaved: () => void }) {
  const { t } = useLanguage();
  const utils = useQueryClient();
  const [draft, setDraft] = useState<Record<number, DraftSlot>>(() => draftFromLawyer(lawyer));

  const save = useMutation({
    mutationFn: (slots: AvailabilitySlot[]) =>
      apiRequest(`/v1/lawyers/${lawyer.id}/availability`, {
        method: 'PUT',
        body: { slots },
        schema: z.array(availabilitySlotSchema),
      }),
    onSuccess: () => {
      toast.success(t('availabilitySaved').replace('{name}', lawyer.name));
      void utils.invalidateQueries({ queryKey: ['lawyers'] });
      onSaved();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('couldNotSaveAvailability'));
    },
  });

  const handleSave = () => {
    const slots = Object.entries(draft)
      .filter(([, d]) => d.enabled)
      .map(([weekday, d]) => ({
        weekday: Number(weekday),
        startTime: d.startTime,
        endTime: d.endTime,
        slotDurationMinutes: Number(d.slotDurationMinutes),
      }));
    for (const slot of slots) {
      if (slot.startTime >= slot.endTime) {
        toast.error(t('endTimeAfterStart'));
        return;
      }
    }
    save.mutate(slots);
  };

  return (
    <div className="space-y-3">
      <div className="hidden gap-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[8rem_5rem_5rem_5rem_4rem]">
        <span>{t('day')}</span>
        <span>{t('start')}</span>
        <span>{t('end')}</span>
        <span>{t('slotDuration')}</span>
        <span />
      </div>
      <div className="grid gap-2">
        {WEEKDAYS.map((day) => {
          const d = draft[day.weekday];
          if (!d) return null;
          return (
            <div
              key={day.weekday}
              className={cn(
                'grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[8rem_5rem_5rem_5rem_4rem]',
                d.enabled ? 'border-border bg-card' : 'border-transparent bg-muted/30 opacity-70',
              )}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`avail-${day.weekday}`}
                  checked={d.enabled}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    typeof checked === 'boolean' &&
                    setDraft((prev) => ({
                      ...prev,
                      [day.weekday]: { ...prev[day.weekday], enabled: checked },
                    }))
                  }
                  aria-label={`${day.label} available`}
                />
                <Label htmlFor={`avail-${day.weekday}`} className="text-sm font-normal">
                  {day.label}
                </Label>
              </div>
              <Input
                type="time"
                value={d.startTime}
                disabled={!d.enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [day.weekday]: { ...prev[day.weekday], startTime: e.target.value },
                  }))
                }
                aria-label={`${day.label} start`}
              />
              <Input
                type="time"
                value={d.endTime}
                disabled={!d.enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [day.weekday]: { ...prev[day.weekday], endTime: e.target.value },
                  }))
                }
                aria-label={`${day.label} end`}
              />
              <Input
                type="number"
                min={5}
                max={480}
                value={d.slotDurationMinutes}
                disabled={!d.enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [day.weekday]: { ...prev[day.weekday], slotDurationMinutes: e.target.value },
                  }))
                }
                aria-label={`${day.label} slot minutes`}
              />
              <span className="text-xs text-muted-foreground">{t('minPerSlot')}</span>
            </div>
          );
        })}
      </div>
      <Button type="button" size="sm" onClick={handleSave} disabled={save.isPending}>
        {save.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('saveAvailability')}
      </Button>
    </div>
  );
}

function TeamContent() {
  const { t } = useLanguage();
  const { can } = useSession();
  const canManage = can('users:write');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lawyers = useQuery({
    queryKey: ['lawyers'],
    queryFn: () => apiRequest('/v1/lawyers', { schema: lawyerListSchema }),
  });
  const users = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => apiRequest('/v1/users?limit=100', { schema: userListSchema }),
  });

  const selected = useMemo(
    () => lawyers.data?.find((l) => l.id === selectedId) ?? lawyers.data?.[0] ?? null,
    [lawyers.data, selectedId],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader icon={Users} title={t('team')} description={t('teamDescription')} />

      {canManage ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-5 w-5 text-primary" aria-hidden /> {t('inviteTeamMember')}
          </CardTitle>
          <CardDescription>{t('inviteTeamMemberCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm />
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('teamMembers')}</CardTitle>
          <CardDescription>{t('teamMembersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {users.isPending ? <Skeleton className="h-24 w-full" /> : null}
          {users.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('couldNotLoadTeam')}: {users.error instanceof ApiError ? users.error.message : 'unknown error'}
            </p>
          ) : null}
          {users.data ? <UsersTable users={users.data} lawyers={lawyers.data ?? []} canManage={canManage} /> : null}
        </CardContent>
      </Card>

      {lawyers.isPending ? <Skeleton className="h-24 w-full" /> : null}
      {lawyers.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('couldNotLoadLawyers')}: {lawyers.error instanceof ApiError ? lawyers.error.message : 'unknown error'}
        </p>
      ) : null}

      {lawyers.data && lawyers.data.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-medium">{t('noLawyerProfilesYet')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('noLawyerProfilesYetDesc').replace('{areas}', practiceAreaOptions.slice(0, 3).join(', '))}
          </p>
        </div>
      ) : null}

      {(lawyers.data ?? []).length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {(lawyers.data ?? []).map((lawyer) => {
            const active = selected?.id === lawyer.id;
            return (
              <button
                key={lawyer.id}
                type="button"
                onClick={() => setSelectedId(lawyer.id)}
                className={cn(
                  'min-w-[10rem] shrink-0 rounded-xl border p-3 text-left transition-colors',
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-primary/30 hover:bg-accent/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
                    {initials(lawyer.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lawyer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{lawyer.email}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected && canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>{selected.email}</span>
              {selected.whatsappNumber ? <Badge variant="outline">{selected.whatsappNumber}</Badge> : null}
              {selected.practiceAreas.length > 0 ? (
                <Badge variant="secondary">{selected.practiceAreas.join(' · ')}</Badge>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvailabilityEditor key={selected.id} lawyer={selected} onSaved={() => {}} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function TeamPage() {
  return <TeamContent />;
}

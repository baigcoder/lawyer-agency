'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, ApiError } from '@/lib/api-client';
import { calendarStatusSchema, lawyerListSchema } from '@/lib/schemas/appointment';

export function CalendarConnectionCard() {
  const [lawyerId, setLawyerId] = useState('');
  const queryClient = useQueryClient();

  const lawyers = useQuery({
    queryKey: ['lawyers'],
    queryFn: () => apiRequest('/v1/lawyers', { schema: lawyerListSchema }),
  });

  const status = useQuery({
    queryKey: ['calendar-status', lawyerId],
    queryFn: () =>
      lawyerId
        ? apiRequest(`/v1/appointments/calendar/status?lawyerId=${encodeURIComponent(lawyerId)}`, {
            schema: calendarStatusSchema,
          })
        : Promise.resolve(null),
    enabled: Boolean(lawyerId),
  });

  const authUrl = useMutation({
    mutationFn: () =>
      apiRequest<{ configured: boolean; url: string | null }>(
        `/v1/appointments/calendar/auth-url?lawyerId=${encodeURIComponent(lawyerId)}`,
      ),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (!data.configured) {
        toast.error('Google Calendar is not configured for this environment.');
      }
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Failed to start OAuth'),
  });

  const disconnect = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/appointments/calendar/disconnect?lawyerId=${encodeURIComponent(lawyerId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast.success('Google Calendar disconnected');
      void queryClient.invalidateQueries({ queryKey: ['calendar-status', lawyerId] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Disconnect failed'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="size-4" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Connect a lawyer&apos;s Google Calendar to sync appointments and send WhatsApp confirmations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lawyers.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : lawyers.isError ? (
          <p role="alert" className="text-sm text-destructive">Couldn&apos;t load lawyers</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="lawyer">Lawyer</Label>
            <select
              id="lawyer"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={lawyerId}
              onChange={(e) => setLawyerId(e.target.value)}
            >
              <option value="">Select a lawyer</option>
              {lawyers.data.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {lawyerId && status.isPending && <Skeleton className="h-16 w-full" />}
        {lawyerId && status.data && (
          <div className="rounded-md border p-3 text-sm">
            {status.data.connected ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Connected</p>
                  <p className="text-muted-foreground">Calendar: {status.data.calendarId ?? 'primary'}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {disconnect.isPending && <Loader2 className="size-4 animate-spin" />}
                  <Unlink className="size-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Not connected</p>
                  <p className="text-muted-foreground">
                    {status.data.configured
                      ? 'Authorize Google Calendar to sync appointments.'
                      : 'Google Calendar OAuth is not configured in this environment.'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={authUrl.isPending || !status.data.configured}
                  onClick={() => authUrl.mutate()}
                >
                  {authUrl.isPending && <Loader2 className="size-4 animate-spin" />}
                  Connect
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

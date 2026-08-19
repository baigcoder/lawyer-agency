'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { caseListSchema, type CaseDto } from '@/lib/schemas/case';
import { DocumentRequestsCard } from '@/components/document-requests-card';

const ALL_STATUSES = ['ALL', 'LEAD', 'CONSULTATION', 'ENGAGED', 'IN_COURT', 'CLOSED'] as const;
type StatusFilter = (typeof ALL_STATUSES)[number];

const statusVariant: Record<CaseDto['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  LEAD: 'secondary',
  CONSULTATION: 'outline',
  ENGAGED: 'default',
  IN_COURT: 'default',
  CLOSED: 'secondary',
  ARCHIVED: 'outline',
};

export default function CasesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const query = useQuery({
    queryKey: ['cases', statusFilter === 'ALL' ? 'all' : statusFilter],
    queryFn: () =>
      apiRequest(`/v1/cases?status=${statusFilter === 'ALL' ? 'all' : 'open'}`, {
        schema: caseListSchema,
      }),
  });

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    if (statusFilter === 'ALL') return rows;
    return rows.filter((c) => c.status === statusFilter);
  }, [query.data, statusFilter]);

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: CaseDto['status'] }) =>
      apiRequest(`/v1/cases/${id}/status`, { method: 'POST', body: { to } }),
    onSuccess: () => {
      toast.success('Case status updated');
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update status'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t('cases')} description={t('casesDescription')} icon={Briefcase} />

      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'ALL' ? 'All' : s.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matters</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isPending && (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {query.isError && (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load cases: {query.error.message}
            </p>
          )}

          {query.isSuccess && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matters in this view — convert inbox conversations or wait for qualified leads.
            </p>
          )}

          {query.isSuccess && filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Matter type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Change status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.reference}</TableCell>
                    <TableCell>{row.matterType}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.urgency}</TableCell>
                    <TableCell>{row.openedAt.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={row.status}
                        onValueChange={(v) => v && transition.mutate({ id: row.id, to: v as CaseDto['status'] })}
                      >
                        <SelectTrigger className="ml-auto h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.filter((s) => s !== 'ALL').map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DocumentRequestsCard cases={query.data ?? []} />
    </div>
  );
}

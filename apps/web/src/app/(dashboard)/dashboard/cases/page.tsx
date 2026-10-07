'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Landmark,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

const ALL_STATUSES = ['ALL', 'IN_COURT', 'ENGAGED', 'CONSULTATION', 'LEAD', 'CLOSED'] as const;
type StatusFilter = (typeof ALL_STATUSES)[number];

const statusVariant: Record<CaseDto['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  LEAD: 'secondary',
  CONSULTATION: 'outline',
  ENGAGED: 'default',
  IN_COURT: 'default',
  CLOSED: 'secondary',
  ARCHIVED: 'outline',
};

function urgencyBadge(urgency: CaseDto['urgency']) {
  switch (urgency) {
    case 'CRITICAL':
      return <Badge variant="destructive" className="text-[10px] py-0 h-4 uppercase">Critical</Badge>;
    case 'HIGH':
      return <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 uppercase">High</Badge>;
    case 'NORMAL':
      return <span className="text-[11px] text-muted-foreground">Normal</span>;
    default:
      return <span className="text-[11px] text-muted-foreground/70">Low</span>;
  }
}

export default function CasesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseDto | null>(null);

  const query = useQuery({
    queryKey: ['cases', statusFilter === 'ALL' ? 'all' : statusFilter],
    queryFn: () =>
      apiRequest(`/v1/cases?status=${statusFilter === 'ALL' ? 'all' : 'open'}`, {
        schema: caseListSchema,
      }),
  });

  const filtered = useMemo(() => {
    let rows = query.data ?? [];
    if (statusFilter !== 'ALL') {
      rows = rows.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.reference.toLowerCase().includes(q) ||
          c.matterType.toLowerCase().includes(q) ||
          (c.summary && c.summary.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [query.data, statusFilter, search]);

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: CaseDto['status'] }) =>
      apiRequest(`/v1/cases/${id}/status`, { method: 'POST', body: { to } }),
    onSuccess: () => {
      toast.success('Case status updated');
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update status'),
  });

  const allCases = query.data ?? [];
  const inCourtCount = allCases.filter((c) => c.status === 'IN_COURT').length;
  const engagedCount = allCases.filter((c) => c.status === 'ENGAGED').length;
  const leadCount = allCases.filter((c) => c.status === 'LEAD').length;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title={t('cases')}
        description="Active legal matters, litigation diary, client files, and procedural status."
        icon={Briefcase}
      />

      {/* Metrics overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Matters
          </span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{allCases.length}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Landmark className="h-3 w-3 text-primary" />
            In Court / Trial
          </span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-primary">{inCourtCount}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Retainers
          </span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{engagedCount}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Qualified Leads
          </span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-muted-foreground">{leadCount}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reference, matter type, summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs ps-8 border-border/80 bg-card/60"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          {ALL_STATUSES.map((s) => {
            const count = s === 'ALL' ? allCases.length : allCases.filter((c) => c.status === s).length;
            return (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="h-8 text-xs px-2.5"
              >
                {s === 'ALL' ? 'All Matters' : s.replace('_', ' ')}
                <span className="ml-1.5 opacity-60 tabular-nums">({count})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-border/80 shadow-2xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              Matter Docket ({filtered.length})
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">
              Click any row to view full matter dossier &amp; intake details
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {query.isPending && (
            <div className="p-4 space-y-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          )}

          {query.isError && (
            <div role="alert" className="p-4 text-xs text-destructive">
              Couldn&apos;t load cases: {query.error.message}
            </div>
          )}

          {query.isSuccess && filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No matters found</p>
              <p className="max-w-sm mx-auto">
                No active legal files match your filter. Convert conversations from Inbox or create a case from qualified leads.
              </p>
            </div>
          )}

          {query.isSuccess && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[140px] text-xs font-semibold">Reference</TableHead>
                    <TableHead className="text-xs font-semibold">Practice Area</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Urgency</TableHead>
                    <TableHead className="text-xs font-semibold">Opened Date</TableHead>
                    <TableHead className="text-xs font-semibold">Summary</TableHead>
                    <TableHead className="text-right text-xs font-semibold w-[160px]">Change Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedCase(row)}
                    >
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {row.reference}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.matterType}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[row.status]} className="text-[10px] py-0 h-4">
                          {row.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{urgencyBadge(row.urgency)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {row.openedAt.toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {row.summary ?? 'Intake via WhatsApp'}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={row.status}
                          onValueChange={(v) => v && transition.mutate({ id: row.id, to: v as CaseDto['status'] })}
                          disabled={transition.isPending}
                        >
                          <SelectTrigger aria-label="Change stage" className="ml-auto h-7 w-32 text-xs border-border/80">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="end">
                            {ALL_STATUSES.filter((s) => s !== 'ALL').map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case Details Slide-over / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="case-dialog-title" className="w-full max-w-xl rounded-xl border border-border/80 bg-card p-5 shadow-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="case-dialog-title" className="font-mono text-base font-bold text-foreground">
                    {selectedCase.reference}
                  </h3>
                  <Badge variant={statusVariant[selectedCase.status]}>
                    {selectedCase.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedCase.matterType} · Opened {selectedCase.openedAt.toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedCase(null)}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selectedCase.summary && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] block mb-1">
                  Matter Executive Summary
                </span>
                <p className="text-foreground leading-relaxed">{selectedCase.summary}</p>
              </div>
            )}

            {/* Intake Verified Data */}
            {Object.keys(selectedCase.intakeData ?? {}).length > 0 && (
              <div className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-2">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] block">
                  Intake Fields Captured
                </span>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(selectedCase.intakeData).map(([k, v]) => (
                    <div key={k} className="border-b border-border/40 pb-1">
                      <dt className="text-muted-foreground font-medium capitalize text-[10px]">{k}</dt>
                      <dd className="font-semibold text-foreground text-xs">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                className="text-xs"
                render={<Link href="/dashboard/inbox" />}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> View in Inbox
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedCase(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Linked Document Requests */}
      <DocumentRequestsCard cases={query.data ?? []} />
    </div>
  );
}

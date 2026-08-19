'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, FileText, LoaderCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, ApiError } from '@/lib/api-client';
import type { CaseDto } from '@/lib/schemas/case';
import {
  documentRequestListSchema,
  documentRequestSchema,
  type DocumentRequestDto,
} from '@/lib/schemas/document-requests';

const statusVariant: Record<DocumentRequestDto['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  FULFILLED: 'default',
  CANCELLED: 'outline',
};

/**
 * Document requests (Phase 5 firm ops) — case-scoped asks for documents.
 * Mounted on the Cases page; creation picks a matter, fulfilment marks the
 * request done (optionally linking an uploaded document id later).
 */
export function DocumentRequestsCard({ cases }: { cases: CaseDto[] }) {
  const utils = useQueryClient();
  const [caseId, setCaseId] = useState('');
  const [description, setDescription] = useState('');

  const requests = useQuery({
    queryKey: ['document-requests'],
    queryFn: () => apiRequest('/v1/document-requests', { schema: documentRequestListSchema }),
  });

  const create = useMutation({
    mutationFn: (input: { caseId: string; clientId: string; description: string }) =>
      apiRequest('/v1/document-requests', { method: 'POST', body: input, schema: documentRequestSchema }),
    onSuccess: () => {
      toast.success('Document request created — the client will be asked on WhatsApp.');
      setDescription('');
      void utils.invalidateQueries({ queryKey: ['document-requests'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the request.');
    },
  });

  const fulfil = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/document-requests/${id}/fulfil`, { method: 'POST', body: { documentId: null }, schema: documentRequestSchema }),
    onSuccess: () => {
      toast.success('Request marked fulfilled.');
      void utils.invalidateQueries({ queryKey: ['document-requests'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not fulfil the request.');
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/document-requests/${id}/cancel`, { method: 'POST', schema: documentRequestSchema }),
    onSuccess: () => {
      toast.success('Request cancelled.');
      void utils.invalidateQueries({ queryKey: ['document-requests'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not cancel the request.');
    },
  });

  const selectedCase = cases.find((c) => c.id === caseId);
  const pending = (requests.data ?? []).filter((r) => r.status === 'PENDING');
  const recent = (requests.data ?? []).filter((r) => r.status !== 'PENDING').slice(0, 5);

  const submit = () => {
    if (!selectedCase) {
      toast.error('Pick a matter first.');
      return;
    }
    if (description.trim().length < 3) {
      toast.error('Describe the document you need (at least 3 characters).');
      return;
    }
    create.mutate({ caseId: selectedCase.id, clientId: selectedCase.clientId, description: description.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" /> Document requests
        </CardTitle>
        <CardDescription>
          Ask clients for documents against a matter. Requests are queued to WhatsApp; mark them
          fulfilled once received.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Select value={caseId} onValueChange={(v) => setCaseId(v ?? '')}>
            <SelectTrigger aria-label="Matter" className="h-8 w-full">
              <SelectValue placeholder="Select matter…" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.reference} · {c.matterType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. CNIC copy and property deed (Plot 42, DHA)"
            aria-label="Document description"
          />
          <Button type="button" size="sm" onClick={submit} disabled={create.isPending || cases.length === 0}>
            {create.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Request
          </Button>
        </div>

        {requests.isPending ? <Skeleton className="h-16 w-full" /> : null}
        {requests.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t load requests:{' '}
            {requests.error instanceof ApiError ? requests.error.message : 'unknown error'}
          </p>
        ) : null}

        {requests.isSuccess && pending.length === 0 && recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No document requests yet — create one above once a matter exists.
          </p>
        ) : null}

        {pending.length > 0 ? (
          <ul className="space-y-2">
            {pending.map((request) => {
              const matter = cases.find((c) => c.id === request.caseId);
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{request.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {matter ? `${matter.reference} · ${matter.matterType}` : request.caseId} ·{' '}
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fulfil.mutate(request.id)}
                      disabled={fulfil.isPending}
                      aria-label="Mark fulfilled"
                    >
                      {fulfil.isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Fulfilled
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => cancel.mutate(request.id)}
                      disabled={cancel.isPending}
                      aria-label="Cancel request"
                    >
                      {cancel.isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {recent.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {recent.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{request.description}</span>
                <Badge variant={statusVariant[request.status]}>{request.status}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

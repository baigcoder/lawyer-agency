'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen } from 'lucide-react';
import { DocumentManager } from '@/components/document-manager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest, ApiError } from '@/lib/api-client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/language';
import { PageHeader } from '@/components/page-header';
import { caseListSchema } from '@/lib/schemas/case';
import { clientFolderListSchema } from '@/lib/schemas/client';

type BrowseMode = 'client' | 'case';

export default function DocumentsPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<BrowseMode>('client');
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');

  const clients = useQuery({
    queryKey: ['documents', 'clients'],
    queryFn: () => apiRequest('/v1/documents/clients/list', { schema: clientFolderListSchema }),
    enabled: mode === 'client',
  });

  const cases = useQuery({
    queryKey: ['cases', 'all'],
    queryFn: () => apiRequest('/v1/cases?status=all', { schema: caseListSchema }),
    enabled: mode === 'case',
  });

  const selectedClient = clients.data?.find((c) => c.id === clientId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t('documents')}
        description={t('documentsDescription')}
        icon={FolderOpen}
      />

      <div className="flex gap-2">
        <Button type="button" variant={mode === 'client' ? 'default' : 'outline'} size="sm" onClick={() => setMode('client')}>
          {t('byClientFolder')}
        </Button>
        <Button type="button" variant={mode === 'case' ? 'default' : 'outline'} size="sm" onClick={() => setMode('case')}>
          {t('byCase')}
        </Button>
      </div>

      {mode === 'client' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client folders</CardTitle>
              <CardDescription>
                Each folder is named after the client. Documents uploaded here are indexed for AI answers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clients.isPending ? (
                <Skeleton className="h-32 w-full" />
              ) : clients.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Couldn&apos;t load clients: {clients.error instanceof ApiError ? clients.error.message : 'unknown error'}
                </p>
              ) : clients.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No clients yet — folders appear when someone messages your WhatsApp number.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {clients.data.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setClientId(client.id)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/70 ${
                        clientId === client.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{client.name ?? client.waPhone}</p>
                        <p className="truncate text-xs text-muted-foreground">{client.waPhone}</p>
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {client.documentCount} document{client.documentCount === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {clientId ? (
            <DocumentManager
              clientId={clientId}
              folderLabel={selectedClient?.name ?? selectedClient?.waPhone}
            />
          ) : null}
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select case</CardTitle>
              <CardDescription>Documents linked to a specific matter.</CardDescription>
            </CardHeader>
            <CardContent>
              {cases.isPending ? (
                <Skeleton className="h-10 w-full" />
              ) : cases.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Couldn&apos;t load cases: {cases.error instanceof ApiError ? cases.error.message : 'unknown error'}
                </p>
              ) : (
                <div>
                  <Label className="text-sm">Case</Label>
                  <Select value={caseId} onValueChange={(value) => setCaseId(value ?? '')}>
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue placeholder="Choose a case" />
                    </SelectTrigger>
                    <SelectContent>
                      {cases.data.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.reference} — {c.matterType}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {caseId ? <DocumentManager caseId={caseId} /> : null}
        </>
      )}
    </div>
  );
}

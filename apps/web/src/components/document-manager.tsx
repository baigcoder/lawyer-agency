'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  File,
  FileImage,
  FileText,
  FileUp,
  Loader2,
  Pin,
  PinOff,
  UploadCloud,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { documentListSchema, documentSchema, type DocumentDto } from '@/lib/schemas/document';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DocumentManagerProps {
  clientId?: string;
  caseId?: string;
  folderLabel?: string;
}

const docTypeLabels: Record<DocumentDto['docType'], string> = {
  CNIC: 'CNIC',
  FIR: 'FIR',
  COURT_NOTICE: 'Court notice',
  AFFIDAVIT: 'Affidavit',
  CONTRACT: 'Contract',
  EVIDENCE_PHOTO: 'Evidence photo',
  PAYMENT_PROOF: 'Payment screenshot',
  RECEIPT: 'Receipt',
  OTHER: 'Other',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = mimeType.startsWith('image/')
    ? FileImage
    : mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')
      ? FileText
      : File;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden />;
}

export function DocumentManager({ clientId, caseId, folderLabel }: DocumentManagerProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [docType, setDocType] = useState<DocumentDto['docType']>('OTHER');
  const [dragOver, setDragOver] = useState(false);

  const listKey = clientId ? ['documents', 'client', clientId] : ['documents', 'case', caseId ?? ''];
  const listUrl = clientId ? `/v1/documents/client/${clientId}` : `/v1/documents/case/${caseId}`;

  const documents = useQuery({
    queryKey: listKey,
    queryFn: () => apiRequest(listUrl, { schema: documentListSchema }),
    enabled: Boolean(clientId ?? caseId),
  });

  const upload = useMutation({
    mutationFn: async (input: { file: File; clientId?: string; caseId?: string; description?: string; docType: DocumentDto['docType'] }) => {
      const formData = new FormData();
      formData.append('file', input.file);
      if (input.clientId) formData.append('clientId', input.clientId);
      if (input.caseId) formData.append('caseId', input.caseId);
      if (input.description) formData.append('description', input.description);
      formData.append('docType', input.docType);
      return apiRequest('/v1/documents/upload', {
        method: 'POST',
        body: formData,
        schema: documentSchema,
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      void queryClient.invalidateQueries({ queryKey: listKey });
      if (clientId) void queryClient.invalidateQueries({ queryKey: ['documents', 'clients'] });
      setFile(null);
      setDescription('');
      setDocType('OTHER');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Upload failed'),
  });

  const togglePin = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      apiRequest(`/v1/documents/${id}/pin`, { method: 'PUT', body: { isPinned }, schema: documentSchema }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listKey }),
    onError: () => toast.error('Could not update pin'),
  });

  const handleUpload = () => {
    if (!file) return;
    if (!clientId && !caseId) return;
    upload.mutate({ file, clientId, caseId, description, docType });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload document</CardTitle>
          <CardDescription>PDF, DOCX, TXT, and images up to 10 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              dragOver
                ? 'border-primary/60 bg-primary/5'
                : file
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <UploadCloud
              className={cn('h-8 w-8', file ? 'text-primary' : 'text-muted-foreground/50')}
              aria-hidden
            />
            {file ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">Drop a file here, or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, JPG, PNG — max 10 MB</p>
              </>
            )}
          </div>
          <Input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note (e.g. client CNIC front)"
            />
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentDto['docType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(docTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpload} disabled={!file || upload.isPending} className="w-full sm:w-auto">
            {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Upload
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {folderLabel ? `Folder: ${folderLabel}` : 'Documents'}
          </CardTitle>
          {folderLabel ? (
            <CardDescription>Pinned documents in this folder are prioritized in AI answers.</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {documents.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : documents.isError ? (
            <p role="alert" className="text-sm text-destructive">Couldn&apos;t load documents.</p>
          ) : documents.data.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium">No documents yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload files here, or they&apos;ll appear automatically when clients send them on WhatsApp.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.data.map((doc) => (
                <li
                  key={doc.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                    doc.isPinned
                      ? 'border-primary/30 bg-primary/5'
                      : 'hover:border-primary/30 hover:bg-accent/40',
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileTypeIcon mimeType={doc.mimeType} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{doc.filename}</p>
                      {doc.isPinned ? <Badge variant="default" className="text-[10px]">Pinned</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {docTypeLabels[doc.docType]} · {formatBytes(doc.sizeBytes)} · {doc.ocrStatus.toLowerCase()}
                      {doc.description ? ` · ${doc.description}` : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={doc.isPinned ? 'Unpin document' : 'Pin document'}
                    onClick={() => togglePin.mutate({ id: doc.id, isPinned: !doc.isPinned })}
                    disabled={togglePin.isPending}
                  >
                    {doc.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/page-header';
import {
  createKbSchema,
  kbEntrySchema,
  kbListSchema,
  type CreateKbInput,
} from '@/lib/schemas/ai-settings';

export default function KnowledgePage() {
  const { t } = useLanguage();
  const { can } = useSession();
  const canWriteKb = can('knowledge-base:write');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('EN');
  const [category, setCategory] = useState('');

  const list = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => apiRequest('/v1/knowledge-base', { schema: kbListSchema }),
  });

  const create = useMutation({
    mutationFn: (body: CreateKbInput) =>
      apiRequest('/v1/knowledge-base', { method: 'POST', body, schema: kbEntrySchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      setShowForm(false);
      setTitle('');
      setContent('');
      setCategory('');
      toast.success('Knowledge entry created as draft');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create entry.'),
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/knowledge-base/${id}/publish`, { method: 'POST', schema: kbEntrySchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Entry published — AI can now use it');
    },
    onError: () => toast.error('Could not publish entry.'),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/knowledge-base/${id}/archive`, { method: 'POST', schema: kbEntrySchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast.success('Entry archived');
    },
    onError: () => toast.error('Could not archive entry.'),
  });

  const handleCreate = () => {
    const parsed = createKbSchema.safeParse({
      title,
      content,
      language,
      ...(category.trim() ? { category: category.trim() } : {}),
    });
    if (!parsed.success) {
      toast.error('Please fill in title and content.');
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t('knowledge')}
        description={t('knowledgeDescription')}
        icon={BookOpen}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" /> FAQ & firm information
            </CardTitle>
            <CardDescription>Add process guides, fees, document lists, and common answers.</CardDescription>
          </div>
          {canWriteKb ? (
          <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> New entry
          </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && canWriteKb ? (
            <div className="space-y-3 rounded-lg border p-4">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Consultation fees" />
              </Field>
              <Field label="Language">
                <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="EN" />
              </Field>
              <Field label="Category" hint="Optional">
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Fees" />
              </Field>
              <Field label="Content">
                <Textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Our initial consultation fee is…"
                />
              </Field>
              <div className="flex gap-2">
                <Button type="button" onClick={handleCreate} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save draft
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {list.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : list.isError ? (
            <p role="alert" className="text-sm text-destructive">Could not load knowledge base.</p>
          ) : list.data.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium">No entries yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add FAQs so the AI can answer accurately.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{entry.title}</p>
                      <Badge variant={entry.status === 'PUBLISHED' ? 'default' : 'secondary'}>{entry.status}</Badge>
                      <span className="text-xs text-muted-foreground">{entry.language}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.content}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {canWriteKb && entry.status !== 'PUBLISHED' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={publish.isPending}
                        onClick={() => publish.mutate(entry.id)}
                      >
                        Publish
                      </Button>
                    ) : null}
                    {canWriteKb && entry.status !== 'ARCHIVED' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={archive.isPending}
                        onClick={() => archive.mutate(entry.id)}
                        aria-label={`Archive ${entry.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

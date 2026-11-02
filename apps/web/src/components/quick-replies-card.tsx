'use client';

import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { QUICK_REPLIES_KEY, useQuickReplyList } from '@/components/inbox/quick-reply-picker';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { quickReplyFormSchema, type QuickReply, type QuickReplyForm } from '@/lib/schemas/quick-replies';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Filled automatically in the inbox; shown as one-click chips while writing. */
const AUTO_FILLED = ['client_name', 'firm_name', 'case_ref', 'lawyer_name'] as const;
const EMPTY: QuickReplyForm = { title: '', body: '', language: 'en' };

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function QuickRepliesCard() {
  const { t } = useLanguage();
  const { can } = useSession();
  const canManage = can('quick-replies:manage');
  const queryClient = useQueryClient();
  const list = useQuickReplyList();
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUICK_REPLIES_KEY });

  const starter = useMutation({
    mutationFn: () => apiRequest('/v1/quick-replies/starter-pack', { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('quickRepliesStarterAdded'));
      void refresh();
    },
    onError: (e) => toast.error(errorText(e, t('quickRepliesSaveFailed'))),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/quick-replies/${id}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(errorText(e, t('quickRepliesSaveFailed'))),
  });

  const items = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-primary" aria-hidden />
          {t('quickReplies')}
        </CardTitle>
        <CardDescription>{t('quickRepliesHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 && editing === null ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">{t('quickRepliesEmptyTitle')}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{t('quickRepliesEmptyBody')}</p>
            {canManage ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => starter.mutate()} disabled={starter.isPending}>
                  {starter.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {t('quickRepliesAddStarter')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
                  <Plus />
                  {t('quickRepliesNew')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) =>
              editing !== 'new' && editing?.id === item.id ? (
                <li key={item.id} className="p-3">
                  <QuickReplyEditor initial={item} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={item.id} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {item.language === 'ur' ? 'اردو' : 'EN'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="auto">{item.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground" dir="auto">{item.body}</p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={t('quickRepliesEdit')} onClick={() => setEditing(item)}>
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('quickRepliesDelete')}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(t('quickRepliesDeleteConfirm').replace('{title}', item.title))) remove.mutate(item.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}

        {editing === 'new' ? (
          <div className="rounded-xl border border-border p-3">
            <QuickReplyEditor onDone={() => setEditing(null)} />
          </div>
        ) : canManage && items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
              <Plus />
              {t('quickRepliesNew')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => starter.mutate()} disabled={starter.isPending}>
              <Sparkles />
              {t('quickRepliesAddStarter')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuickReplyEditor({ initial, onDone }: { initial?: QuickReply; onDone: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const form = useForm<QuickReplyForm>({
    resolver: zodResolver(quickReplyFormSchema),
    defaultValues: initial ? { title: initial.title, body: initial.body, language: initial.language } : EMPTY,
  });
  const language = useWatch({ control: form.control, name: 'language' });

  const save = useMutation({
    mutationFn: (values: QuickReplyForm) =>
      initial
        ? apiRequest(`/v1/quick-replies/${initial.id}`, { method: 'PUT', body: values })
        : apiRequest('/v1/quick-replies', { method: 'POST', body: values }),
    onSuccess: () => {
      toast.success(t('quickRepliesSaved'));
      void queryClient.invalidateQueries({ queryKey: QUICK_REPLIES_KEY });
      onDone();
    },
    onError: (e) => toast.error(errorText(e, t('quickRepliesSaveFailed'))),
  });

  /** Inserts {name} at the cursor so firms don't have to remember the spelling. */
  function insertPlaceholder(name: string) {
    const el = bodyRef.current;
    const body = form.getValues('body');
    const at = el?.selectionStart ?? body.length;
    const token = `{${name}}`;
    form.setValue('body', body.slice(0, at) + token + body.slice(el?.selectionEnd ?? at), { shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  }

  const bodyField = form.register('body');

  return (
    <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Field label={t('quickRepliesTitle')} error={form.formState.errors.title?.message}>
            <Input dir="auto" placeholder={t('quickRepliesTitlePlaceholder')} {...form.register('title')} />
          </Field>
        </div>
        <div role="radiogroup" aria-label={t('quickRepliesLanguage')} className="flex rounded-lg border border-border p-0.5">
          {(['en', 'ur'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={language === value}
              onClick={() => form.setValue('language', value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium',
                language === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'ur' ? 'اردو' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <Field label={t('quickRepliesMessage')} error={form.formState.errors.body?.message}>
        <Textarea
          rows={4}
          dir="auto"
          {...bodyField}
          ref={(el) => {
            bodyField.ref(el);
            bodyRef.current = el;
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t('quickRepliesAutoFill')}</span>
        {AUTO_FILLED.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => insertPlaceholder(name)}
            className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 hover:bg-primary/10"
          >
            {`{${name}}`}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('quickRepliesBlanksHint')}</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t('quickRepliesSave')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('tlCancel')}
        </Button>
      </div>
    </form>
  );
}

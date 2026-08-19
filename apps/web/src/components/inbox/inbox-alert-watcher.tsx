'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { playInboxSound, unlockInboxSound } from '@/lib/inbox-alert-sound';
import { latestClientConversation, useInboxListQuery } from '@/lib/inbox-unread';
import { useLanguage } from '@/lib/language';
import type { InboxSummary } from '@/lib/schemas/inbox';

function previewText(conversation: InboxSummary, voiceLabel: string): string {
  const message = conversation.lastMessage;
  if (!message) return '';
  if (message.contentType === 'AUDIO') return voiceLabel;
  const body = message.body?.trim() ?? '';
  if (body.length > 120) return `${body.slice(0, 117)}…`;
  return body;
}

function clientLabel(conversation: InboxSummary): string {
  return conversation.client.name?.trim() || conversation.client.waPhone;
}

function showBrowserNotification(title: string, body: string, href: string): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;

  const notification = new Notification(title, {
    body,
    tag: 'wakeel-inbox',
    silent: true,
  });
  notification.onclick = () => {
    window.focus();
    window.location.assign(href);
    notification.close();
  };
}

export function InboxAlertWatcher() {
  const { t } = useLanguage();
  const router = useRouter();
  const query = useInboxListQuery();
  const previousClientAt = useRef<number | null>(null);

  useEffect(() => {
    const unlock = () => unlockInboxSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const conversations = query.data;
    if (!conversations) return;

    const latest = latestClientConversation(conversations);
    const latestAt = latest?.lastClientMessageAt?.getTime() ?? 0;

    if (previousClientAt.current === null) {
      previousClientAt.current = latestAt;
      return;
    }

    const isNewClientMessage = latestAt > previousClientAt.current;
    previousClientAt.current = Math.max(previousClientAt.current, latestAt);

    if (!isNewClientMessage || !latest) return;

    const name = clientLabel(latest);
    const title = t('inboxNewMessageFrom').replace('{name}', name);
    const body = previewText(latest, t('inboxVoiceNote')) || t('inboxNewMessageFallback');
    const href = `/dashboard/inbox?conversation=${latest.id}`;

    playInboxSound();
    toast(title, {
      description: body,
      action: {
        label: t('inbox'),
        onClick: () => router.push(href),
      },
    });
    showBrowserNotification(title, body, href);
  }, [query.data, router, t]);

  return null;
}

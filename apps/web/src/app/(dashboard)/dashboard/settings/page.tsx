'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Bell,
  Building2,
  CreditCard,
  Languages,
  Loader2,
  Mail,
  MessageCircle,
  Monitor,
  Settings as SettingsIcon,
  Smartphone,
  User,
  Zap,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/page-header';
import { Switch } from '@/components/ui/switch';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useLanguage } from '@/lib/language';
import { hasAnyPermission } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { FirmProfileForm } from '@/components/firm-profile-form';
import { AiSettingsCard } from '@/components/ai-settings-card';
import { OwnerProfileCard } from '@/components/owner-profile-card';

const prefsSchema = z.object({
  DASHBOARD: z.boolean(),
  WEB_PUSH: z.boolean(),
  WHATSAPP_TEMPLATE: z.boolean(),
  EMAIL_DIGEST: z.boolean(),
});
type Prefs = z.infer<typeof prefsSchema>;

const SECTIONS = [
  { key: 'general', icon: Languages },
  { key: 'firm', icon: Building2 },
  { key: 'owner', icon: User },
  { key: 'payments', icon: CreditCard },
  { key: 'ai', icon: Zap },
  { key: 'notifications', icon: Bell },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const SECTION_ACCESS: Record<SectionKey, { anyOf?: string[]; always?: boolean }> = {
  general: { always: true },
  firm: { anyOf: ['users:manage'] },
  owner: { anyOf: ['users:manage', 'lawyers:write'] },
  payments: { anyOf: ['users:manage'] },
  ai: { anyOf: ['users:manage'] },
  notifications: { anyOf: ['notifications:write'] },
};

function useVisibleSections(permissions: string[] | undefined): SectionKey[] {
  return SECTIONS.map((s) => s.key).filter((key) => {
    const rule = SECTION_ACCESS[key];
    if (rule.always) return true;
    if (rule.anyOf) return hasAnyPermission(permissions, rule.anyOf);
    return false;
  });
}

function useActiveSection(visible: SectionKey[]) {
  const [active, setActive] = useState<SectionKey>('general');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id as SectionKey);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    for (const key of visible) {
      const el = document.getElementById(key);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visible]);

  return active;
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const { session } = useSession();
  const visibleKeys = useVisibleSections(session?.permissions);
  const visible = SECTIONS.filter((s) => visibleKeys.includes(s.key));
  const activeSection = useActiveSection(visibleKeys);

  const sectionLabels: Record<SectionKey, string> = {
    general: t('settingsSectionGeneral'),
    firm: t('settingsSectionFirm'),
    owner: 'Owner profile',
    payments: t('paymentReceivingDetails'),
    ai: t('settingsSectionAi'),
    notifications: t('settingsSectionNotifications'),
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        icon={SettingsIcon}
        title={t('settings')}
        description={t('settingsDescription')}
      />

      <div className="mt-6 flex gap-8">
        {/* Sidebar nav */}
        <nav className="sticky top-6 hidden h-fit w-48 shrink-0 flex-col gap-1 self-start lg:flex">
          {visible.map(({ key, icon: Icon }) => (
            <a
              key={key}
              href={`#${key}`}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                activeSection === key
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {sectionLabels[key]}
            </a>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-10">
          <section id="general" className="scroll-mt-6 space-y-4">
            <SectionHeading title={t('settingsSectionGeneral')} />
            <LanguageCard />
          </section>

          {visibleKeys.includes('firm') ? (
          <section id="firm" className="scroll-mt-6 space-y-4">
            <SectionHeading title={t('settingsSectionFirm')} />
            <FirmProfileForm />
          </section>
          ) : null}

          {visibleKeys.includes('owner') ? (
          <section id="owner" className="scroll-mt-6 space-y-4">
            <SectionHeading title="Owner profile" />
            <OwnerProfileCard />
          </section>
          ) : null}

          {visibleKeys.includes('payments') ? (
          <section id="payments" className="scroll-mt-6 space-y-4">
            <SectionHeading title={t('paymentReceivingDetails')} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-primary" aria-hidden />
                  {t('paymentReceivingDetails')}
                </CardTitle>
                <CardDescription>{t('paymentReceivingDetailsSettingsHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="text-sm">
                    <p className="font-medium">JazzCash, EasyPaisa &amp; bank details</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Set where client payments should be sent
                    </p>
                  </div>
                  <Button
                    render={<Link href="/dashboard/payments" />}
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                  >
                    {t('managePaymentDetails')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
          ) : null}

          {visibleKeys.includes('ai') ? (
          <section id="ai" className="scroll-mt-6 space-y-4">
            <SectionHeading title={t('settingsSectionAi')} />
            <AiSettingsCard />
          </section>
          ) : null}

          {visibleKeys.includes('notifications') ? (
          <section id="notifications" className="scroll-mt-6 space-y-4">
            <SectionHeading title={t('settingsSectionNotifications')} />
            <NotificationSettingsCard />
          </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      <span className="h-px flex-1 bg-border" aria-hidden />
      {title}
      <span className="h-px flex-1 bg-border" aria-hidden />
    </h2>
  );
}

function LanguageCard() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-4 w-4 text-primary" aria-hidden /> {t('languagePreference')}
        </CardTitle>
        <CardDescription>{t('languagePreferenceDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {(['en', 'ur'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              aria-pressed={language === lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border p-4 transition-all',
                language === lang
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <span className={cn('text-2xl', lang === 'ur' && 'font-urdu')}>
                {lang === 'en' ? 'Aa' : 'اردو'}
              </span>
              <span className={cn(
                'text-sm font-medium',
                language === lang ? 'text-primary' : 'text-muted-foreground',
              )}>
                {lang === 'en' ? 'English' : 'Urdu'}
              </span>
              {language === lang && (
                <span className="mt-1 flex h-2 w-2 rounded-full bg-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettingsCard() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [pushState, setPushState] = useState<'unsupported' | 'prompt' | 'subscribed' | 'blocked'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return 'unsupported';
    }
    if (Notification.permission === 'denied') return 'blocked';
    if (Notification.permission === 'granted') return 'subscribed';
    return 'prompt';
  });

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiRequest('/v1/notifications/preferences', { schema: prefsSchema }),
  });

  const prefsMutation = useMutation({
    mutationFn: (body: Prefs) => apiRequest('/v1/notifications/preferences', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  const toggle = (key: keyof Prefs) => {
    if (!prefsQuery.data) return;
    prefsMutation.mutate({ ...prefsQuery.data, [key]: !prefsQuery.data[key] });
  };

  const subscribePush = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushState(permission === 'denied' ? 'blocked' : 'prompt');
      return;
    }
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    const { publicKey } = await apiRequest('/v1/notifications/vapid-public-key', {
      schema: z.object({ publicKey: z.string().nullable() }),
    });
    if (!publicKey) {
      toast.error(t('webPushNotConfigured'));
      return;
    }
    const key = urlBase64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer as ArrayBuffer,
    });
    const subJson = subscription.toJSON();
    await apiRequest('/v1/notifications/push-subscriptions', {
      method: 'POST',
      body: {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      },
    });
    setPushState('subscribed');
    toast.success(t('webPushEnabled'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" aria-hidden /> {t('notificationChannels')}
        </CardTitle>
        <CardDescription>{t('notificationChannelsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {prefsQuery.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : prefsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t('couldNotLoadPreferences')}: {prefsQuery.error.message}
          </p>
        ) : (
          <>
            <ChannelToggle
              icon={Monitor}
              label={t('notifDashboard')}
              description={t('notifDashboardDesc')}
              checked={prefsQuery.data.DASHBOARD}
              onCheckedChange={() => toggle('DASHBOARD')}
            />
            <ChannelToggle
              icon={Smartphone}
              label={t('notifWebPush')}
              description={t('notifWebPushDesc')}
              checked={prefsQuery.data.WEB_PUSH}
              onCheckedChange={() => toggle('WEB_PUSH')}
            />
            {pushState !== 'unsupported' && (
              <div className="ms-14 space-y-2">
                {pushState === 'prompt' && (
                  <Button type="button" size="sm" variant="outline" onClick={subscribePush}>
                    {t('enableBrowserNotifications')}
                  </Button>
                )}
                {pushState === 'subscribed' && (
                  <p className="text-xs text-muted-foreground">{t('browserNotificationsEnabled')}</p>
                )}
                {pushState === 'blocked' && (
                  <p className="text-xs text-destructive">{t('browserNotificationsBlocked')}</p>
                )}
              </div>
            )}
            <ChannelToggle
              icon={MessageCircle}
              label={t('notifWhatsapp')}
              description={t('notifWhatsappDesc')}
              checked={prefsQuery.data.WHATSAPP_TEMPLATE}
              onCheckedChange={() => toggle('WHATSAPP_TEMPLATE')}
            />
            <ChannelToggle
              icon={Mail}
              label={t('notifEmailDigest')}
              description={t('notifEmailDigestDesc')}
              checked={prefsQuery.data.EMAIL_DIGEST}
              onCheckedChange={() => toggle('EMAIL_DIGEST')}
            />
          </>
        )}
        {prefsMutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {prefsMutation.error instanceof ApiError ? prefsMutation.error.message : t('failedToSave')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ChannelToggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw.split('').map((c) => c.charCodeAt(0)));
}

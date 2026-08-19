import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ConnectionBanner() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How WhatsApp connection works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <CardDescription>
          Wakeel supports two connection paths (D-092):
        </CardDescription>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <Badge variant="secondary">Pilot bridge (dev)</Badge> — a short-lived, allowlist-only
            Baileys bridge for local testing without a Meta app. Disabled by default in production.
          </li>
          <li>
            <Badge>Official Meta Cloud API</Badge> — the firm&apos;s own WhatsApp Business number,
            connected via the OAuth flow below. Required to receive messages in production.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          The 24-hour WhatsApp messaging window is always respected; proactive sends outside it use
          Meta-approved templates (D-003). AI never sees message bodies from third-party providers
          beyond T1/T2 payloads (D-005).
        </p>
      </CardContent>
    </Card>
  );
}

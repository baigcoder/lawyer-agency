import { AlertTriangle, ArrowRight, FileText, HelpCircle, ListFilter, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HandoffBrief } from '@/lib/schemas/escalations';

export function HandoffBriefView({
  reason,
  excerpt,
  brief,
}: {
  reason: string | null;
  excerpt: string | null;
  brief: HandoffBrief;
}) {
  const factEntries = Object.entries(brief.facts ?? {});
  const hasDocs =
    (brief.documents?.requests?.length ?? 0) > 0 ||
    (brief.documents?.files?.length ?? 0) > 0;
  const situation = brief.situation?.trim();

  return (
    <div className="space-y-3.5 text-xs">
      {/* 1. Executive Summary & Situation */}
      {situation && (
        <div className="rounded-md border border-border/80 bg-card p-3 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Executive Summary
          </p>
          <p className="text-foreground leading-relaxed font-medium">{situation}</p>
        </div>
      )}

      {/* 2. Matter Type & Primary Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {brief.matterType && (
          <div className="rounded-md border border-border/70 bg-muted/40 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Matter Classification
            </span>
            <span className="font-semibold text-foreground mt-0.5 inline-block">
              {brief.matterType}
            </span>
          </div>
        )}

        {reason && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive block flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Escalation Trigger
            </span>
            <span className="font-medium text-destructive mt-0.5 inline-block">
              {reason}
            </span>
          </div>
        )}
      </div>

      {/* 3. Detected Client Excerpt */}
      {excerpt && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-[10px] uppercase tracking-wider mb-1">
            <Quote className="h-3 w-3" />
            Triggering Excerpt (WhatsApp)
          </div>
          <p dir="auto" className="text-foreground/90 italic font-mono text-[11px] leading-relaxed">
            &ldquo;{excerpt}&rdquo;
          </p>
        </div>
      )}

      {/* 4. Extracted Key Facts */}
      {factEntries.length > 0 && (
        <div className="rounded-md border border-border/80 bg-card p-3 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <ListFilter className="h-3 w-3" />
            Verified Case Facts
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {factEntries.map(([key, value]) => (
              <div key={key} className="border-b border-border/40 pb-1.5">
                <dt className="text-[10px] text-muted-foreground capitalize font-medium">{key}</dt>
                <dd className="font-semibold text-foreground text-[11px] mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* 5. Documents Status */}
      {hasDocs && (
        <div className="rounded-md border border-border/80 bg-card p-3 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Document Status
          </p>
          <div className="space-y-1.5">
            {brief.documents.requests.map((row) => (
              <div
                key={`${row.description}-${row.status}`}
                className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
              >
                <span className="text-[11px] text-foreground font-medium">{row.description}</span>
                <Badge
                  variant={row.status === 'VERIFIED' ? 'default' : 'outline'}
                  className="text-[9px] py-0 h-4"
                >
                  {row.status}
                </Badge>
              </div>
            ))}
            {brief.documents.files.map((row) => (
              <div
                key={`${row.filename}-${row.docType}`}
                className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
              >
                <span className="text-[11px] text-foreground font-medium">{row.filename}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{row.docType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Open Items / Questions */}
      {brief.openItems.length > 0 && (
        <div className="rounded-md border border-border/80 bg-card p-3 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            Open Legal Inquiries
          </p>
          <ul className="space-y-1 text-[11px] text-foreground/90">
            {brief.openItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-primary font-bold">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 7. Recommended Next Action */}
      {brief.nextAction && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Recommended Lawyer Action
          </p>
          <p className="font-semibold text-foreground text-xs leading-relaxed">
            {brief.nextAction}
          </p>
        </div>
      )}
    </div>
  );
}

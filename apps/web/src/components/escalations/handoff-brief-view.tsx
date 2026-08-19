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
  const factEntries = Object.entries(brief.facts);
  const hasDocs = brief.documents.requests.length > 0 || brief.documents.files.length > 0;
  const situation = brief.situation?.trim();

  return (
    <div className="space-y-3 text-sm">
      {situation ? <p className="leading-relaxed">{situation}</p> : null}
      {reason ? (
        <p>
          <span className="font-medium">Why: </span>
          {reason}
        </p>
      ) : null}
      {brief.matterType ? (
        <p>
          <span className="font-medium">Matter: </span>
          {brief.matterType}
        </p>
      ) : null}
      {brief.nextAction ? (
        <p>
          <span className="font-medium">Next: </span>
          {brief.nextAction}
        </p>
      ) : null}
      {factEntries.length > 0 ? (
        <ul className="list-inside list-disc text-muted-foreground">
          {factEntries.map(([key, value]) => (
            <li key={key}>
              {key}: {value}
            </li>
          ))}
        </ul>
      ) : null}
      {hasDocs ? (
        <div className="text-muted-foreground">
          <p className="font-medium text-foreground">Documents</p>
          <ul className="mt-1 list-inside list-disc">
            {brief.documents.requests.map((row) => (
              <li key={`${row.description}-${row.status}`}>
                {row.description} ({row.status.toLowerCase()})
              </li>
            ))}
            {brief.documents.files.map((row) => (
              <li key={`${row.filename}-${row.docType}`}>
                {row.filename} · {row.docType}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {brief.openItems.length > 0 ? (
        <div className="text-muted-foreground">
          <p className="font-medium text-foreground">Open items</p>
          <ul className="mt-1 list-inside list-disc">
            {brief.openItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {excerpt ? (
        <p className="rounded-md bg-muted/50 p-3 text-sm">&ldquo;{excerpt}&rdquo;</p>
      ) : null}
    </div>
  );
}

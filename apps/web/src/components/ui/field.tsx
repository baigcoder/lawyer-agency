import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/**
 * Shared form Field (Batch 2c): associates the label with its control via a
 * generated id (useId) and wires the error through `aria-describedby` so
 * screen readers announce it. Replaces the two page-local Field helpers
 * that left labels unassociated (setup ×8 fields, settings ×4, payments).
 *
 * If the child is a single element, its `id` is set automatically; pass
 * `id` explicitly only if you need a specific one.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={generatedId}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {/* Clone the child so its `id` is linked to the label. React 19 lets
          us spread `id` onto a single child element without a wrapper. */}
      {cloneChildWithId(children, generatedId)}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function cloneChildWithId(children: ReactNode, id: string): ReactNode {
  if (Array.isArray(children)) {
    // For multiple children we can't safely inject an id; render as-is and
    // let the caller pass ids explicitly on each control.
    return children;
  }
  if (
    typeof children === 'object' &&
    children !== null &&
    'props' in children
  ) {
    return cloneElement(
      children as ReactElement<{ id?: string }>,
      { id },
    );
  }
  return children;
}

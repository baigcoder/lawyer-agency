import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/**
 * Shared form Field: associates the label with its control via a generated id
 * (useId), and wires the hint and error through `aria-describedby` +
 * `aria-invalid` so screen readers announce them and the primitives'
 * `aria-invalid:*` variants actually fire.
 *
 * The id is cloned onto a single child element. A child *component* only
 * receives it if it forwards `id`/`aria-*` down to its DOM node — `Input`,
 * `Textarea` and `SelectTrigger` all do. For a child that does not (RHF's
 * `Controller`, or several controls at once), pass `htmlFor` and set that same
 * id on the real control: the label then points at something that exists
 * instead of at a generated id nothing carries, and the child owns its own
 * aria wiring.
 *
 * Pass `id` on the child directly when you need a specific one; it wins over
 * the generated id.
 */
interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /**
   * Id of the real control, for children that cannot receive a cloned `id`.
   * When set, nothing is cloned — the caller owns `id` and the aria attributes.
   */
  htmlFor?: string;
  children: ReactNode;
}

/** The props Field injects into a single element child. */
type InjectedProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;

  // Only a single element child can be cloned. Arrays and plain text cannot,
  // and an explicit htmlFor means the caller has taken over.
  const cloneable = htmlFor === undefined && isValidElement(children);
  const child = cloneable ? (children as ReactElement<InjectedProps>) : undefined;

  const controlId = htmlFor ?? child?.props.id ?? (cloneable ? generatedId : undefined);

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      {/* No id to point at means no `for`: a dangling htmlFor reports an
          association it cannot deliver, which is worse than plain text. */}
      <Label {...(controlId ? { htmlFor: controlId } : {})}>{label}</Label>

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {child
        ? cloneElement(child, {
            id: controlId,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })
        : children}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

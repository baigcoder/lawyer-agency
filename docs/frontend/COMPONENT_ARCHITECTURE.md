# Wakeel — Component Architecture

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** React 19 Component Architecture, Primitive Composition, and Slot Standards  
**Foundation:** `@base-ui/react`, Base UI Composition, TypeScript 5  

---

## 1. Composition Over Cloning: The Base UI `render` Model

Wakeel avoids the legacy Radix UI `asChild` cloning pattern in favor of **Base UI's explicit `render` prop**:

### Why `render` Prop Over `asChild`?
1. **Zero CloneElement Mutations:** Radix's `asChild` clones React elements and merges props via runtime inspection, which frequently causes React 19 ref forwarding warnings and unpredictable event handler chaining.
2. **Deterministic Prop Forwarding:** Base UI’s `render` prop accepts a render function or JSX element, explicitly passing down merged state, ARIA attributes, and classes without mutating children.

### Example in `Button` (`apps/web/src/components/ui/button.tsx`):
```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={nativeButton ?? render == null}
      render={render}
      {...props}
    />
  );
}

// Usage as Next.js Link:
<Button render={<Link href="/dashboard/inbox" />}>
  Open Priority Inbox
</Button>
```

---

## 2. Deterministic `data-slot` Styling

All UI components output explicit `data-slot` attributes:
- `data-slot="button"`
- `data-slot="dialog"`
- `data-slot="card"`
- `data-slot="field"`

This allows global CSS rules and parent components to target nested primitives predictably using clean descendant selectors (e.g. `[&_[data-slot=button]]:shrink-0`) without brittle CSS class chaining.

---

## 3. Strict Props & Zod Boundary Typing

Component props are strictly typed with zero use of `any`:
- All server data passed into components conforms to shared Zod DTO types (e.g. `CaseDto`, `InboxDetail`, `AppointmentDto`).
- Optional callbacks are strictly typed as `() => void` or `(id: string) => Promise<void>`.

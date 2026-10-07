# Wakeel — Navigation Specification

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Navigation Architecture, Sidebar Specs, Mobile Drawer, and Route Guards  
**Source Code References:** `apps/web/src/components/dashboard-nav.tsx`, `apps/web/src/lib/dashboard-nav.ts`, `apps/web/src/components/mobile-nav.tsx`, `apps/web/src/components/route-guard.tsx`  

---

## 1. Desktop Sidebar Specifications

- **Location:** Left boundary in LTR (`dir="ltr"`), Right boundary in RTL (`dir="rtl"`).
- **Dimensions:** Width `w-64` (256px), Height `h-svh` (100% viewport height, sticky).
- **Surface Styling:**
  - Background: `var(--color-sidebar)` (`oklch(0.99 0.002 250)` light, `oklch(0.165 0.005 285)` dark).
  - Border: `var(--color-sidebar-border)` (`oklch(0.91 0.01 260)` light, `oklch(1 0 0 / 8%)` dark).
- **Header:** Height `h-14` (56px) with firm brand icon (`Scale` in `bg-primary/10`), brand wordmark (`Wakeel`), and localized subtitle.
- **Footer:** Pin to bottom (`mt-auto`) with language switcher and active user profile.

---

## 2. Nav Items, Route Mapping & Permission Guards

The navigation list is filtered in real time based on active session permissions (`apps/web/src/lib/permissions.ts`):

```typescript
export const dashboardNavSections: DashboardNavSection[] = [
  {
    key: 'groupMain',
    items: [
      { href: '/dashboard', key: 'overview', icon: LayoutDashboard, permission: 'firm-profile:read' },
      { href: '/dashboard/inbox', key: 'inbox', icon: Inbox, permission: 'inbox:read' },
      { href: '/dashboard/escalations', key: 'escalations', icon: AlertTriangle, permission: 'inbox:read' },
    ],
  },
  {
    key: 'groupManage',
    items: [
      { href: '/dashboard/cases', key: 'cases', icon: FolderOpen, permission: 'cases:read' },
      { href: '/dashboard/documents', key: 'documents', icon: FileText, permission: 'cases:write' },
      { href: '/dashboard/knowledge', key: 'knowledge', icon: BookOpen, permission: 'knowledge-base:read' },
      { href: '/dashboard/calendar', key: 'calendar', icon: CalendarDays, permission: 'appointments:read' },
      { href: '/dashboard/team', key: 'team', icon: Users, permission: 'users:read' },
    ],
  },
  {
    key: 'groupFirm',
    items: [
      { href: '/dashboard/whatsapp', key: 'whatsapp', icon: MessageCircleMore, permission: 'whatsapp:read' },
      { href: '/dashboard/payments', key: 'payments', icon: Wallet, permission: 'payments:read' },
      { href: '/dashboard/analytics', key: 'analytics', icon: BarChart3, permission: 'analytics:read' },
      { href: '/dashboard/settings', key: 'settings', icon: Settings, anyOf: ['users:manage', 'lawyers:write', 'notifications:write'] },
    ],
  },
  {
    key: 'groupSystem',
    items: [
      { href: '/dashboard/setup', key: 'setup', icon: ListChecks, permission: 'users:manage' },
    ],
  },
];
```

---

## 3. Active State & Interaction States

1. **Active Route Styling:**
   - Background: `bg-sidebar-accent` (`oklch(0.94 0.03 152)` light / `oklch(0.26 0.04 162)` dark).
   - Text & Icon: `text-sidebar-accent-foreground` (`oklch(0.35 0.08 152)` light / `oklch(0.85 0.12 162)` dark).
   - Indicator: Leading 3px vertical accent border or rounded container pill.
2. **Hover State:**
   - Background: `hover:bg-sidebar-accent/50`, transition 100ms.
3. **Badge Indicators:**
   - Priority Inbox displays unread message badge count (`InboxUnreadBadge`).
   - Escalations displays count of open, unacknowledged safety triage items (`Badge variant="destructive"`).

---

## 4. Mobile Navigation Drawer (`MobileNav`)

- **Trigger:** Hamburger icon button in mobile header (`lg:hidden`).
- **Container:** Full-height slide-over sheet drawer (`DialogPrimitive` from `@base-ui/react`).
- **Animation:** Slides from start edge (left in LTR, right in RTL) with 150ms cubic ease.
- **Dismissal:** Backdrop tap, swipe gesture, or navigation link selection automatically closes the drawer.

---

## 5. Route Protection & Forbidden States

Every dashboard route is wrapped by `<RouteGuard>`:
- If user permissions do not satisfy the required permission for the current path, the main content area renders `<ForbiddenState>` instead of a blank screen or broken table.
- `<ForbiddenState>` displays a clear, dignified notice: `"Access restricted — contact your firm administrator to request permissions"` with a direct link back to `/dashboard`.

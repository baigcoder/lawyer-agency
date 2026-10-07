# Wakeel — Table Patterns & Data Density

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Table Design Standards, Column Geometry, and Data Presentation  
**Source Code References:** `apps/web/src/components/ui/table.tsx`, `cases/page.tsx`, `payments/page.tsx`, `team/page.tsx`  

---

## 1. Table Architecture & Visual Rhythm

In a legal practice, tables are operational workspaces. Advocates must scan hundreds of matters, verify client payment proofs, and assign lawyers in seconds.

### Core Commandments
1. **Header Restraint:** Headers use `text-xs font-medium text-muted-foreground` with uppercase or title-case labels.
2. **Alignment Discipline:**
   - Text & Case Names: Left-aligned (`text-left`).
   - Badges, Urgency, Counts: Center-aligned (`text-center`).
   - Currency, Fees, Actions: Right-aligned (`text-right`).
3. **Monospaced Identifiers:** All reference IDs, dates, and amounts use Geist Mono (`font-mono text-sm`).

---

## 2. Table Implementation Examples in Wakeel

### 2.1 Legal Matters Table (`apps/web/src/app/(dashboard)/dashboard/cases/page.tsx`)
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Reference</TableHead>
      <TableHead>Matter type</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Urgency</TableHead>
      <TableHead>Opened</TableHead>
      <TableHead className="text-right">Change status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {filtered.map((row) => (
      <TableRow key={row.id}>
        <TableCell className="font-mono text-sm">{row.reference}</TableCell>
        <TableCell className="font-medium">{row.matterType}</TableCell>
        <TableCell><Badge variant={statusVariant[row.status]}>{row.status}</Badge></TableCell>
        <TableCell>{row.urgency}</TableCell>
        <TableCell className="font-mono text-xs">{row.openedAt.toLocaleDateString()}</TableCell>
        <TableCell className="text-right">
          <Select value={row.status} onValueChange={(v) => transition.mutate({ id: row.id, to: v })}>
            <SelectTrigger className="ml-auto h-8 w-36"><SelectValue /></SelectTrigger>
          </Select>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 2.2 Payments & Fee Ledger (`apps/web/src/app/(dashboard)/dashboard/payments/page.tsx`)
- Columns: Client Name, Matter Reference, Amount (`PKR`), Payment Method (`JAZZCASH`, `EASYPAISA`, `BANK_TRANSFER`), Status Badge, Proof Trigger, Action Button.
- Action: "Verify Payment" triggers receipt generation and appointment confirmation.

### 2.3 Team Roster Table (`apps/web/src/app/(dashboard)/dashboard/team/page.tsx`)
- Columns: Member (Avatar + Full Name), Role Badge (`Owner`, `Lawyer`, `Staff`), Email, Status (`ACTIVE`, `INVITED`), Actions (`Resend Invite`, `Edit Availability`).

---

## 3. Responsive Table Adaptation

On viewport widths below `768px` (`md` breakpoint):
- Tables wrap inside an overflow container (`overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0`).
- Critical identifiers (Matter Reference / Client Name) freeze as sticky columns where required, or the table transforms into a structured card feed displaying the key identifier, status badge, and action trigger.

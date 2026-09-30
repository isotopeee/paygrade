<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PayGrade conventions

PayGrade is a front-end-only payroll prototype for MMWGH (a DOH hospital). All data is mocked in zustand stores. No backend.

## Stack notes (current major versions, APIs differ from older tutorials)

- **Next.js 16** App Router. Pages under `src/app/(app)/` are client components (`"use client"`) because all data lives in client stores. Dynamic params: use `useParams()` from `next/navigation` in client pages.
- **shadcn/ui on Base UI** (not Radix). There is no `asChild`. Compose with the `render` prop:
  `<DropdownMenuTrigger render={<Button variant="outline" />}>Label</DropdownMenuTrigger>`,
  `<SheetTrigger render={<Button />}>`, `<TooltipTrigger render={<Button />}>`, `<SidebarMenuButton render={<Link href="/x" />}>`.
  - `DropdownMenuLabel` must be inside a `DropdownMenuGroup`.
  - `<Button render={<Link href="/x" />}>` works as a link button; the shared Button sets `nativeButton={false}` automatically for non-button elements.
  - Base UI `Select` shows the raw value unless you pass `items` to `<Select items={[{label, value}]}>`. For simple forms prefer `NativeSelect` from `@/components/ui/native-select`.
  - Checkbox: `checked`, `indeterminate`, `onCheckedChange(checked: boolean)`.
  - `AlertDialogAction` is a plain Button; control `open` yourself.
  - Forms: use `Field`, `FieldLabel`, `FieldError`, `FieldDescription`, `FieldGroup` from `@/components/ui/field` with react-hook-form + zod (`@hookform/resolvers/zod`). Zod is v4.
- **TanStack Table v9** (`useTable`, `tableFeatures`). Do not use v8 APIs. Always use the shared `DataTable` from `@/components/data-table`.
- **Recharts 3** via shadcn `ChartContainer` (`@/components/ui/chart`).
- **TypeScript 7** (`tsc`) with the TS 6 API aliased as `typescript` for typescript-eslint.

## Design rules

- Strictly black and white. Neutral tokens only (`bg-background`, `text-muted-foreground`, `border`, `bg-muted`, `bg-foreground text-background` for emphasis). No color classes such as `text-red-500` or `bg-blue-*`.
- Status is shown through badge weight (solid, muted, outline) plus an icon. Use the components in `@/components/status-badge` or `StatusBadge` for new statuses.
- Money: integer centavos everywhere. Display with `formatCurrency` / `formatAmount` from `@/lib/format` or the `<Money>` component. Numeric columns use `meta: { numeric: true }` (right aligned, `tabular-nums`).
- Dates: `formatDate` (`MMM d, yyyy`). Periods: `formatPeriod(start, end)` gives `Sep 1 to 15, 2026`.
- No em dashes anywhere in UI copy. No lorem ipsum. Use real hospital and Philippine government payroll terminology.
- Information dense, Linear or Vercel dashboard style. Use `PageContainer` and `PageHeader` from `@/components/page-header`.
- Accessible: labels on every input, `aria-label` on icon buttons, visible focus.
- Responsive down to tablet width (768px).

## Data and state

- Types: `src/types/index.ts`.
- Store: `useDataStore` in `src/stores/data-store.ts` holds all domain data and actions (every action writes an audit entry). `useSessionStore` holds the signed-in mock user; `useRole()` returns the active role.
- Permissions: `can(role, "employees.manage")` from `@/lib/permissions`. Payroll workflow rules: `@/lib/workflow`. Hide or disable actions the active role cannot perform.
- Payroll math: pure functions in `src/lib/payroll/` (`compute.ts`, `engine.ts`). All rates come from `RatesConfig` versions in the store (seeded from `src/lib/payroll/rates.ts`). Never hardcode rates in components; use `ratesForDate(ratesVersions, date)`.
- Derived data: `src/lib/selectors.ts` (remittances, payslip history, YTD, pending approvals).
- Mock exports: `useMockExport()` from `@/hooks/use-mock-export`.
- Seed: `src/data/seed.ts`, deterministic. Demo "today" is Sep 22, 2026 (`DEMO_TODAY`).

## DataTable usage

```tsx
const col = createColumns<Employee>()
const columns = col.columns([
  col.accessor("employeeNo", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No." />,
    meta: { label: "Employee No." },
  }),
  col.accessor((row) => departmentName(row.departmentId), {
    id: "department",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    filterFn: "arrHas", // required for faceted filters
    meta: { label: "Department" },
  }),
  col.accessor("net", { header: ..., cell: ({ getValue }) => <Money value={getValue()} />, meta: { numeric: true, label: "Net" } }),
])

<DataTable columns={columns} data={rows} getRowId={(r) => r.id}
  searchPlaceholder="Search employees"
  filters={[{ columnId: "department", title: "Department", options }]}
  enableSelection selectionActions={(rows, clear) => ...}
  onRowClick={(row) => router.push(...)} emptyState={{ title, description, action }} />
```

Define `columns` with `useMemo` (or at module scope) so the reference is stable.

## Verification

- `pnpm test` (Vitest), `pnpm lint`, `npx tsc --noEmit`, `pnpm build`.

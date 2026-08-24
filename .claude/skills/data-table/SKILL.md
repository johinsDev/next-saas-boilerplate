---
name: data-table
description: The one list pattern for every admin CRUD — a server-driven, URL-state (nuqs) data table built on @tanstack/react-table + @saas/ui (Base UI), with pagination, multi-column sort, search, faceted/date/range filters, column visibility, grid/list toggle, row selection + bulk actions (export/delete/…), skeletons, and an RSC-prefetched first paint. Use when adding or migrating any admin list (clientes, productos, recompensas, promos, …). Stores is the worked reference. Composes with `admin-filters` (the facet controls) and `admin-ui` (screen chrome).
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# Data Table — the standard admin list

Every admin CRUD lists the same way: a server-driven table whose entire state
(page, sort, search, filters, view, hidden columns) lives in the **URL via nuqs**,
so lists are shareable, reload-safe, and reflect mutations. Built on the headless
**`@tanstack/react-table`** rendered with our **`@saas/ui`** (Base UI) — never
diceui/Radix. **Reference:** Tiendas (`apps/admin/src/features/stores/`).

## The pieces (`apps/admin/src/components/data-table/`)
- `parsers.ts` — shared nuqs parsers: `q`, `page`, `perPage`, `sort` (`field.dir,…`), `view` (`list|grid`), `cols` (hidden). `PER_PAGE_OPTIONS`.
- `use-data-table.ts` — `useDataTable({ data, columns, pageCount, getRowId })` wires tanstack ↔ URL: pagination/sort/columnVisibility in nuqs, **row selection local** (a Record by id, persists across pages), all `manual*` (server does the work). Returns `{ table, selectedIds, resetSelection }`. Augments `ColumnMeta` with `label` (for View/Sort).
- `data-table.tsx` — `<DataTable table view isFetching emptyState renderGrid />`: renders the list (our `Table`) or the `renderGrid` cards; skeleton rows while `isFetching`.
- `data-table-column-header.tsx` — sortable header (click toggles asc/desc).
- `data-table-sort-list.tsx` — multi-column Sort panel (Add sort / Reset).
- `data-table-view-options.tsx` — "View" column-visibility menu.
- `data-table-pagination.tsx` — "N of M selected" + rows-per-page + page X/Y + first/prev/next/last.
- `data-table-bulk-bar.tsx` — floating "N selected" bar; actions passed as children.
- `data-table-filters.tsx` — **filters drawer**: `DataTableFilters` (a "Filtros" trigger with an active-count badge → a right-side `Sheet` with Clear-all / Done) + `FilterSection` (a labeled section). Keeps the toolbar to just **search + Filtros + Sort + View + grid/list**; the facets live expanded inside the drawer (checkbox lists, a Switch, radio rows, an inline range `Calendar`) — not inline pills, so the toolbar never overflows/jumps.
- Facets reuse `@/components/filters` (`FilterSelect` / `FilterMultiSelect`, the `admin-filters` skill); dates reuse `@saas/ui` `DateRangePicker`. **Numeric range** facet: compose a `NumberInput` pair + `Slider` in a `Popover` writing `{min,max}` to nuqs (build it in the feature when a CRUD has a numeric column — stores has none, so it's not shipped here).
- CSV: `@/lib/csv` (`rowsToCsv` + `downloadCsv`).

## Data fetching (hybrid — "best of Next")
1. The **RSC page** reads `searchParams`, derives the list input with a shared
   `buildXInput` + a nuqs **`createLoader`**, prefetches via the server caller
   (`the service directly` → `await the API()`), and passes the result as
   **`initialData`** → server-rendered first paint, no skeleton.
2. The **client view** reads the same nuqs params, builds the same input, and runs
   `useQuery(api.X.list query options(input, { placeholderData: keepPreviousData, initialData? }))`.
   nuqs is **shallow** → react-query owns refetching (skeleton on `isFetching`).
   Seed `initialData` only when the current input equals the mount input
   (`JSON.stringify` guard) so other pages don't get page-1 data. Mutations
   `invalidateQueries(api.X.list query key())`.

See `apps/admin/src/features/stores/list-params.ts` (`storesSearchParams`,
`buildStoresInput`, `loadStoresSearchParams`) + `…/stores/page.tsx` + `stores-view.tsx`.

## BE list contract (`packages/api/src/features/_shared/list.ts`)
`listQueryBase` zod (`q`, `page`, `perPage`, `sort: {id,desc}[]`); per-feature
schema extends it with filter keys. Repository: build a `where` (reuse
`_shared/filters.ts` or inline conds), `buildOrderBy(sort, columnWhitelist, fallback)`
(unknown sort ids dropped), offset + `count(*)` → `ListResult<T> = { rows, total, pageCount }`
(via `pageOffset`/`pageCountOf`). Return a **lean row type** (keep heavy JSON out of lists).
Reference: `stores/{schemas,repository,service,router}.ts` (`adminList`, `listByIds`).

## Bulk actions
Universal: **Export** (CSV of `listByIds(selectedIds)` → `downloadCsv`) + **Delete**
(count-confirm modal; soft-delete; guard that refuses wiping all). Model-specific
extras when warranted (stores: Publish/Unpublish via `bulkSetPublished`). BE bulk
endpoints take `{ ids }`; the per-row destructive delete keeps its type-the-exact-name
confirmation.

## Add a CRUD to the pattern (recipe)
1. **BE**: `<feature>ListInputSchema = listQueryBase.extend({ …filters })`, a lean
   `XListItem`, `adminList`/`listByIds` (+ any bulk) on repo/service/router; export
   the schema subpath in `packages/api/package.json` (`./features/<x>/schemas`).
2. **FE params**: `list-params.ts` — the nuqs parser map + `buildXInput` + `createLoader`.
3. **View**: columns (`ColumnDef[]` with `meta.label`, a `select` + `actions` column),
   `useDataTable`, the toolbar (search + facets + date + `DataTableSortList` +
   `DataTableViewOptions` + `ViewToggle`), `<DataTable>` (+ `renderGrid` if grid),
   `DataTablePagination`, `DataTableBulkBar`.
4. **RSC page**: `loadXSearchParams` → `buildXInput` → `await the API()` prefetch → `initialData`.
5. i18n: reuse the `DataTable` namespace (pagination/sort/view/bulk) + add column/facet/bulk labels under the feature.

## Detail view (intercepting modal — optional per CRUD)
A read-only detail that opens as a modal over the list on in-app nav, and as a full
page on hard load / reload / share. Mirrors the customer web `/compras/[id]` flow.
The **bare `[id]` route is the DETAIL**; the edit wizard moves to `[id]/edit`.
- **Shared view** (`<X>DetailView`, `"use client"`): read-only summary; takes
  `{ entity, variant: "page" | "modal" }`. "Editar" routes to `/<x>/[id]/edit`.
- **Modal** (`<X>DetailModal`, `"use client"`): fetches `x.get` via react-query,
  wraps `<X>DetailView variant="modal"` in `ResponsiveModal open onOpenChange={(o)=>!o && router.back()}`, skeleton while loading.
- **Routes** (under the `(dashboard)` group, so `(.)` resolves to `(dashboard)/<x>/[id]`):
  - `(dashboard)/layout.tsx` declares the parallel slot: `modal: ReactNode` prop, render `{modal}` after `{children}` (one-time setup per app).
  - `(dashboard)/@modal/default.tsx` → `return null`.
  - `(dashboard)/@modal/(.)<x>/[id]/page.tsx` → `<X>DetailModal`.
  - `(dashboard)/<x>/[id]/page.tsx` → RSC: `await the API()` → `x.get` → `notFound()` → `<X>DetailView variant="page">` (back link).
  - `(dashboard)/<x>/[id]/edit/page.tsx` → the wizard; add `/<x>/[id]/edit` to `i18n/routing.ts` `pathnames`.
- **Triggers**: name cell + grid card click → `/<x>/[id]` (card stops propagation on its checkbox/actions wrapper); row `⋯` menu gets "Ver detalle" → `/<x>/[id]` and "Editar" → `/<x>/[id]/edit`.
- Stores is the reference (`store-detail-view.tsx` + `store-detail-modal.tsx`).

## Gotchas
- `manualPagination/Sorting/Filtering` — the server is the source of truth; tanstack only renders + holds selection/visibility.
- Reset `page` to 1 whenever a facet/search changes.
- Selection is by **id** and persists across pages; Export/Delete operate on `selectedIds` (Export fetches them via `listByIds`, since off-page rows aren't loaded).
- `@saas/ui` stays free of nuqs/tanstack — the data-table lives in `apps/admin` (admin-only).

Pairs with: `admin-filters` (facets), `admin-ui` (chrome/width), `zustand` (only if selection must be shared across components), `date` (`formatDate` columns + range), `api-filters` (the BE sibling).

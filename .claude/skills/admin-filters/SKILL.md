---
name: admin-filters
description: The reusable Vercel-style filter pattern for admin resource lists (single-select, single-with-search, multi-select). Use when adding or changing filters on any list (clientes, productos, recompensas, compras, campañas, …) so every resource filters the same way.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# admin-filters — the one filter pattern for every admin list

Every resource list in `apps/admin` filters with the **same two components**, never
ad-hoc chip rows. They live in `apps/admin/src/components/filters.tsx` and look
like Vercel's dashboard filters: an outline pill trigger that opens a popover.

Pick the variant by what you're filtering — don't invent a new control:

| Need | Component | Notes |
| --- | --- | --- |
| Pick **one** value (or "all") | `FilterSelect` | trigger shows the active label or `allLabel`; menu has a check on the active row. `null` = all. |
| Pick one from a **long** list | `FilterSelect` + `searchable` | adds a search box in the popover. |
| Pick **several** values | `FilterMultiSelect` | checkbox rows; trigger shows a dot-stack + `selected/total` badge. |
| Pick several from a **long** list | `FilterMultiSelect` + `searchable` | same, with a search box. |
| Pick several from an **unbounded** list (customers, …) | `FilterMultiSelectAsync` | the caller owns the query and feeds `options` back; `searchable` filters a preloaded array, which this cannot do. Badge is a bare count; one selection names itself on the trigger. |

> Don't use chip rows (`bg-primary` pills) for filters anymore — they don't scale
> past ~4 options and read inconsistently across resources. Migrate them to these.

## Options

Both take `options: FilterOption<T>[]` where:

```ts
type FilterOption<T extends string> = {
  value: T;
  label: string;   // already localized by the caller
  dot?: string;    // optional CSS color dot (status colors, etc.)
};
```

Labels are **always pre-localized by the caller** (`t("...")`) — the components
stay i18n-agnostic, same rule as `SegmentedControl`.

## Single-select

```tsx
const [tier, setTier] = useState<Tier | null>(null);

<FilterSelect
  allLabel={t("allTiers")}
  value={tier}
  onValueChange={setTier}
  options={TIERS.map((v) => ({ value: v, label: t(`tier.${v}`) }))}
  searchable           // optional, for long lists
  searchPlaceholder={t("search")}
/>;

// filter: if (tier && row.tier !== tier) return false;
```

## Multi-select

Default the selection to **all options checked** (Vercel's `6/7` semantics): an
empty filter shows everything, and unchecking narrows down.

```tsx
const STATUSES = ["active", "inactive"] as const;
const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);

<FilterMultiSelect
  label={t("statusFilter")}
  selected={statuses}
  onChange={setStatuses}
  options={[
    { value: "active", label: t("active"), dot: "#1f9d68" },
    { value: "inactive", label: t("inactive"), dot: "#9aa1ab" },
  ]}
/>;

// filter: if (!statuses.includes(row.active ? "active" : "inactive")) return false;
```

## Async multi-select (unbounded option set)

When the options can't be preloaded — customers, orders, anything that grows —
`searchable` is not enough: it filters an array you already hold. Use
`FilterMultiSelectAsync`, own the query yourself, and pass the results down.

An id can arrive from a deep-link (`?customer=<id>`) and never appear in a
search result, so pass its resolved label in `selectedOptions`. The component
pins the selection to the top of the list, which is what keeps a deep-linked
value uncheckable-from-nowhere.

```tsx
const [query, setQuery] = useState("");
const debounced = useDebounce(query, { wait: 250 });
const { data, isFetching } = useQuery(api.customers.search query options({ query: debounced, limit: 20 }));

<FilterMultiSelectAsync
  label={t("col.customer")}
  options={(data ?? []).map((c) => ({ value: c.id, label: c.name || c.phone, hint: c.name ? c.phone : undefined }))}
  selectedOptions={selectedOptions}   // resolved labels for `selected`
  selected={ids}
  onChange={setIds}
  query={query}
  onQueryChange={setQuery}
  isLoading={isFetching}
/>;
```

Reference: `apps/admin/src/features/purchases/components/customer-filter.tsx`.

## Toolbar layout

Search box first (`flex-1`), then filters, on one wrapping row:

```tsx
<div className="mt-5 flex flex-wrap items-center gap-2">
  <div className="relative min-w-52 flex-1">{/* search input */}</div>
  <FilterMultiSelect … />
  <FilterSelect … />
</div>
```

When filtering empties the list, render the shared
`EmptyState` (`@/components/empty-state`) with a **"clear filters"** action that
resets query + every filter to its default (all).

## Where it's used

- `features/products/components/products-view.tsx` — category + status multi-selects
- `features/rewards/components/rewards-view.tsx` — cost-type select + status multi-select
- `features/customers/components/customers-view.tsx` — status + tier (migrating off chips)

New list? Reuse these. New control idea? Extend `filters.tsx` and update this
table — don't fork a one-off filter into a feature folder.

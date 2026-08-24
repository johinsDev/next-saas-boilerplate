---
name: admin-ui
description: Admin (apps/admin) UI conventions — control sizing (40px admin vs 56px customer), create/edit wizards with live preview, list patterns (filters, empty states, undo, ⌘K), and confirm dialogs. Use when building or polishing any admin screen so it matches the rest of the CRM.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# admin-ui — conventions for the staff CRM (apps/admin)

The admin is denser and mouse-first; the customer PWA (apps/web) is touch-first.
The shared `@saas/ui` controls are tuned for **customer** defaults, so admin
screens override a few things. Follow these so every admin screen feels the same.

## Control height — admin 40px, customer 56px

`@saas/ui` form controls default to **h-14 (56px)** for the touch-first PWA.
In **apps/admin**, single-line controls must be **h-10 (40px)**:

| Control | Make it 40px with |
| --- | --- |
| `Input`, `Textarea`* | `className="h-10"` (overrides the h-14 default via tailwind-merge) |
| `InputPhone` | `size="sm"` (height is baked into its inner input+trigger; className can't reach them) |
| `Select` (`SelectTrigger`) | `size="lg"` — **not** `className="h-10"`. The trigger's `data-[size=default]:h-8` beats a plain `h-10` by CSS specificity, so use the size variant. |
| `NativeSelect` | `size="lg"` (same reason; prefer the styled `Select` though — see below) |
| `NumberInput` / `CurrencyInput` | `className="h-10"`. Use these (react-number-format: digits-only, grouped thousands, no spinner, emits a real `number`) for any numeric/price field — never `<Input type="number">`. `CurrencyInput` derives the symbol from `currency`+`locale`. Stories: `Components/NumberInput`. |

\* `Textarea` is multi-line — the 40px rule is for single-line controls; give it a
sensible `min-h-*` instead.

This is also in CLAUDE.md ("Form-control height differs by app"). The login
(`sign-in-form.tsx`) and the sidebar ⌘K search button follow it too; the cashier
POS register (`features/cashier`) is the one exception — it stays h-14 (touch).

## Use the styled Select, never the native one

Prefer `Select` (Base-UI popover, looks on-brand) over `NativeSelect` for form
fields. Base-UI `Select.Value` renders the **raw value**, so show a localized
label with the render-function form:

```tsx
<Select value={tier} onValueChange={(v) => set("tier", v as Tier)}>
  <SelectTrigger size="lg" className="w-full text-sm">
    <SelectValue>{(v) => t(`tier.${v as Tier}`)}</SelectValue>
  </SelectTrigger>
  <SelectContent>
    {TIERS.map((tr) => (
      <SelectItem key={tr} value={tr}>{t(`tier.${tr}`)}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Create / edit = a wizard with live preview

Every create/edit flow is a **dedicated page** (not a modal): `/<resource>/new`
and `/<resource>/[id]` (or `/[id]/edit`), built on `WizardShell`
(`@/components/wizard-shell`): a `Stepper`, a "borrador guardado" indicator, the
step content on the left and a **sticky live preview** on the right, Back/Next
footer. Step state is local (design-first); the server-driven draft (see the
`wizard` skill + PromoWizard) is the seam. References: `CustomerWizard`,
`ProductWizard`, `RewardWizard`.

- Dates: use the shadcn-style **`DatePicker`** (`@saas/ui` — Button trigger +
  `Calendar` in a `Popover`) for any calendar date (scheduling, send dates). Pass
  `formatLabel={(d) => formatDate(d, { locale })}` from `@saas/date` for the
  localized label. **`DateWheelPicker`** is only for birthdays / date-of-birth
  (year scrolling) — open it inside a `ResponsiveModal` (don't inline the wheel).
  Pass `dayLabel` / `monthLabel` / `yearLabel`: they are the column headings *and*
  each wheel's accessible name. Leave `maxYear` unset — the default upper bound is
  today, so a future birth date can't be picked. Never `<input type="date">`.
  See the `ui` skill for the full API.

## List screens

- **Filters**: the `admin-filters` pattern (`FilterSelect` / `FilterMultiSelect`,
  `searchable` for long lists). Never chip rows. Multi-select shows all option
  dots always (dimming the unselected) so the trigger width never jumps.
- **Empty / no-results**: the shared `EmptyState` (`@/components/empty-state`)
  with a "clear filters" action.
- **Delete**: `AlertDialog` confirm with `size="sm"` buttons, then a success
  `toast` that offers **Undo** (`toast.success(msg, { action: { label: t("undo"), onClick } })`).
- **Search everything**: the sidebar ⌘K `CommandPalette` (`@/components/command-palette`)
  jumps to any section + quick "new …" actions.

## Where the shared admin pieces live

| Piece | Path |
| --- | --- |
| Wizard chrome | `apps/admin/src/components/wizard-shell.tsx` |
| Reusable filters | `apps/admin/src/components/filters.tsx` (skill: `admin-filters`) |
| Empty state | `apps/admin/src/components/empty-state.tsx` |
| ⌘K palette | `apps/admin/src/components/command-palette.tsx` |
| Shell / sidebar / topbar | `apps/admin/src/components/admin-{shell,nav}.tsx` |

New admin screen? Reuse these. New shared pattern? Add it here + update this skill.

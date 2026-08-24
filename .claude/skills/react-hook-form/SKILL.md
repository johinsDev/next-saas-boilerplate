---
name: react-hook-form
description: The forms standard for the next-saas-boilerplate monorepo — React Hook Form + Zod (`zodResolver`). Use when building or refactoring any form in apps/{web,admin}, wiring a shadcn/Base-UI control into a form, handling dynamic field arrays, surfacing server (Hono RPC) errors, or fixing form re-render/perf issues. RHF is uncontrolled-by-default (fast); reach for `Controller` only for controlled UI primitives. Pairs with the `zod` and `ui` skills.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# react-hook-form

Every form uses **React Hook Form (`^7`) + a Zod schema via `@hookform/resolvers/zodResolver`**. The schema is the single source of truth (see the `zod` skill) and is shared with the route handler that receives the submit. RHF keeps inputs **uncontrolled** (registered refs) so typing doesn't re-render the whole form — that's the performance win, don't fight it.

**Rule — every form submits on Enter.** Always wrap inputs in a real `<form onSubmit={...}>` (RHF's `handleSubmit`, or `e.preventDefault()` + the handler for a plain form) and make the primary action a `<Button type="submit">` — never an `onClick`-only button outside a form. A sticky/bottom CTA still works: put the `<form>` around the whole screen (inputs + footer) so Enter in any field triggers submit. Validate on submit and show inline errors; don't disable the submit button just because the form is invalid — let the tap surface the validation.

Existing example to copy: `apps/admin/src/features/storage/components/rhf-file-upload.tsx` (a `useFieldArray` + Dropzone bridge — see the `file-upload` skill).

## The baseline form

```tsx
"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, Input } from "@saas/ui";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email(),
});
type Values = z.infer<typeof schema>;

export function ProfileForm({ onSave }: { onSave: (v: Values) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" },
  });

  return (
    <form onSubmit={handleSubmit(async (values) => { await onSave(values); reset(values); })}>
      <Input {...register("name")} aria-invalid={!!errors.name} />
      {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      <Input type="email" {...register("email")} aria-invalid={!!errors.email} />
      <Button type="submit" disabled={isSubmitting}>Save</Button>
    </form>
  );
}
```

Always pass **`defaultValues`** (avoids uncontrolled→controlled warnings and types `watch`/`reset`). Default mode is `onSubmit`; use `mode: "onBlur"` / `"onChange"` only when the UX needs eager validation.

## register vs Controller (the key decision)

- **`register("field")`** — for native/uncontrolled inputs: `<Input>`, `<Textarea>`, native `<select>`. Spreads `ref` + `name` + handlers. This is the default and the fast path. **`register` gives you the ref** — for an imperative focus, use `const { ref, ...rest } = register("x")` and merge.
- **`Controller`** — for **controlled** components that don't forward a ref / use `value`+`onChange` callbacks. In this repo that's the Base-UI shadcn primitives: `Select`, `Switch`, `Checkbox`, `Slider`, `RadioGroup`, the `Dropzone` bridge.

```tsx
import { Controller } from "react-hook-form";
import { Switch } from "@saas/ui";

<Controller
  control={control}
  name="marketingEnabled"
  render={({ field }) => (
    <Switch checked={field.value} onCheckedChange={field.onChange} />
  )}
/>
```

Rule: **native input → `register`; Base-UI controlled primitive → `Controller`.**

## Dynamic arrays — `useFieldArray`

For repeatable rows (line items, multiple recipients, uploaded files). **Key the list by `field.id`, never the index** (RHF's stable id; the array index is not stable across add/remove).

```tsx
const { control, register } = useForm<{ rewards: { name: string; stamps: number }[] }>({
  resolver: zodResolver(schema),
  defaultValues: { rewards: [{ name: "", stamps: 1 }] },
});
const { fields, append, remove, move } = useFieldArray({ control, name: "rewards" });

{fields.map((field, i) => (
  <div key={field.id}>
    <Input {...register(`rewards.${i}.name`)} />
    <Input type="number" {...register(`rewards.${i}.stamps`, { valueAsNumber: true })} />
    <Button type="button" onClick={() => remove(i)}>Remove</Button>
  </div>
))}
<Button type="button" onClick={() => append({ name: "", stamps: 1 })}>Add</Button>
```

`valueAsNumber` / `valueAsDate` on `register` coerce native string inputs (or use `z.coerce` in the schema).

## Reading values without re-rendering everything

- Prefer `formState.errors` and `handleSubmit` over reading values in render.
- Need a live value (e.g. conditional field)? Use **`useWatch({ control, name })`** in a small child component so only that subtree re-renders — not `watch()` at the top, which re-renders the whole form on every keystroke.

## Server (Hono RPC) errors

On a failed mutation, map field errors back with `setError`, and use a form-level message for the rest:

```tsx
try { await mutateAsync(values); }
catch (e) {
  // field-specific:
  setError("email", { message: "Already in use" });
  // or generic: toast.error(...) (sonner)
}
```

For nested/many forms, wrap with `FormProvider` and read context via `useFormContext` so deep fields don't need prop-drilling `control`.

## Footguns

- **Define the schema at module scope** (or `useMemo`) — a new `zodResolver` each render thrashes validation (see `zod` skill).
- **`key={field.id}`**, not `key={i}`, in field arrays.
- **`Controller` for Base-UI controls** — `register` alone won't wire `Select`/`Switch` (they don't forward a ref).
- **Always `defaultValues`** — otherwise inputs flip controlled/uncontrolled and `reset()`/types break.
- Don't lift `watch()` to the top for one conditional field — use `useWatch` locally.

## Common tasks

| Goal | Do |
| --- | --- |
| New form | `useForm({ resolver: zodResolver(schema), defaultValues })`, share the schema with the the validated input |
| Native input | `{...register("field")}` |
| Base-UI control (Select/Switch/Checkbox/Dropzone) | `Controller` with `field.value` + `field.onChange` |
| Repeatable rows | `useFieldArray`, key by `field.id` |
| Conditional field on a value | `useWatch({ control, name })` in a child |
| Number/date field | `register(..., { valueAsNumber })` or `z.coerce` |
| Server error → field | `setError("field", { message })` |

## Why uncontrolled + Zod

RHF's uncontrolled model means keystrokes don't re-render the form, so even big forms stay fast without memo gymnastics. Pairing it with one Zod schema (shared client↔server) means a single declaration validates the form and the the validated input — no drift, no double-maintenance.

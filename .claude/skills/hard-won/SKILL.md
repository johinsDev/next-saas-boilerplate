---
name: hard-won
description: Bugs this codebase has actually shipped, each with the rule that prevents the next one. Use before writing a Server Action, a guard, a test fixture, a storage key, a timestamp write, a client component import, or any CSS that bounds a box's height — and when a fix "works" but you have only checked it one way.
---

# Hard-won

Every entry below is a bug that **reached a running app**, or a habit that produced one.
None is hypothetical. Most were found in a product built on this boilerplate — same Next
16, same Better Auth, same Drizzle over libSQL, same `packages/services` /
`packages/storage` / `packages/ui` split — so the shapes apply here directly, and several
of the fixes belong here rather than downstream.

Where an entry names a file that does not exist in this repo yet, the shape is still the
point: it is what the equivalent code here will look like when it is written. They are grouped by the shape of the mistake rather
than by the file it happened in, because the same shape keeps arriving through different
doors.

Read the shape, not just the example. The examples are already fixed.

---

## 1. Tests that are exhaustive and blind

The most expensive failure mode here, by a wide margin. A test suite can be thorough,
green, and prove nothing, because its fixture compares like to like.

**What shipped.** `accounts-actions.ts` forwarded `account.account_id` — Google's `sub` —
to Better Auth's `unlinkAccount`, which matches on `account.id`, the row's own primary
key. **Unlink could never have succeeded.** It survived review because:

- the test account had exactly one connected account, so the Remove button never rendered
  in any browser check, and
- the guard's own test compared `accountId` to `accountId` — the same field on both sides
  of the assertion. Internally consistent. Completely blind.

**The rule.** Before writing a test, name the production change that would make it fail.
If you cannot name one, the test asserts a tautology. Then **verify by mutation**: break
the code the way the bug would, and watch that specific test go red. A test you never
watched fail has never been shown to catch anything.

**The fixture corollary.** A fixture where every candidate value is identical cannot
distinguish a correct lookup from a wrong one. Give the fixture at least two rows that
differ in the field under test — a second connected account, a second session, a second
population.

---

## 2. Guards, and the difference between hiding and preventing

**What shipped.**

- `UserRowActions` fired ban (with an empty reason), revoke-all, impersonate, and a
  cross-population role change on **one click** — on the very screen whose job is the
  confirmation ladder.
- A **tombstone** (a deleted, anonymised account) still offered every administrative
  action, **impersonation included** — which would have minted a live session attributed
  to "Deleted account".
- `impersonate: 3` had a weight and an artboard dialog, and no implementation.

**The rules.**

- **Every Server Action guards itself.** Hiding a button is a courtesy to the reader,
  never a control. The action is the boundary; the UI is decoration on top of it.
- **A greyed-out control is neither `read` nor `hidden`.** Model the three states
  explicitly — `capabilities.ts` returns them — and let the action ask the same function
  the UI asked.
- **Answer "is this a tombstone?" before "is this person allowed?"** A deleted row has no
  privileges to reason about. `TOMBSTONE` returns first, before any privilege question.
- **Browser evidence is not guard evidence.** "I clicked it and it was refused" proves
  the UI path. A server-side guard whose UI path hides the button needs a test that calls
  the action directly. A reviewer was right to reject browser evidence for exactly this.

---

## 3. Client bundles and barrel imports

**Five separate breakages on one branch.** A client component importing from
`@saas/services` — the package barrel — drags `@saas/db` and `node:fs` into the
browser bundle. The last one was a **bare constant** (`MAX_AVATAR_BYTES`): no function, no
database call, and it still pulled the whole graph.

**The rule.** No barrel import of a services package from a client component. Ever.
Constants a client needs live beside the client, or in a leaf module with no other
imports. If a client needs a shape from the server, pass it as a prop — the server
component already has it.

Related: `packages/services` stays free of Next (`next/*`, `use cache`, `server-only`) and
of any storage vendor, because `apps/api` runs it in a Worker. `server-only` in a shared
package is the same lesson that already cost us once.

---

## 4. Storage keys are attacker input

**What shipped.** `presignUpload` never parsed the caller's key. R2's
`encodeURIComponent` leaves `..` intact for `new URL` to normalise, so
`avatars/../../other/x.png` presigned a `PUT` **against a different bucket**.

`packages/storage` already exported a `keySchema` forbidding exactly that. It was wired to
nothing.

**The rules.**

- Parse every key at the edge of the storage package, with the schema that already exists.
  An exported validator nothing calls is worse than no validator: it reads as protection.
- **SVG is refused for avatars.** It carries script, and one served from our own origin is
  XSS arriving through a profile picture.
- `packages/storage` must not read `process.env` or import `next/*` — it runs in a
  Cloudflare Worker. AWS SDKs stay optional peers, reached only through a lazy
  `new Function` import.
- **No tokens leave the repository.** `account` rows carry `accessToken`, `refreshToken`,
  `idToken`, `password`. Never select `*` from that table into anything that renders.

---

## 5. Units, drivers, and the shapes you assume

**What shipped.** Audit rows dated **year 58622** in the dev database. Drizzle's
`integer(..., { mode: "timestamp" })` stores **whole seconds** —
`SQLiteTimestamp.mapToDriverValue` does `Math.floor(unix / 1e3)`. Milliseconds went in.

**Also learned the hard way.** `@libsql/client`'s `transaction()` nulls its cached
connection; reopening a bare `:memory:` URL yields a *second, empty database*. SQL tests
therefore use a **temp file**, never `:memory:`.

**And.** Better Auth's `updateWithHooks` resolves `context` once and threads a single
reference to both `before` and `after` — mutating it in `before` is visible in `after`.

**The rule.** When a library sits between you and a store, read what it does to the value.
`grep` the driver's `mapToDriverValue`, or write one row and read it back. Assumed units
are the cheapest bug to prevent and among the most expensive to notice.

---

## 6. Bounding a box (the ten-round lesson)

The person-detail layout took ten rounds. Four of them were the same mistake wearing
different clothes.

**The stale-constant loop.** `calc(100dvh - 2rem)`, then `calc(90dvh - Nrem)`, then a
re-derived `1.5rem` — each a hand-derived guess about how much chrome sits above or below
a card. Every one went stale the moment a header wrapped, a banned callout appeared, or a
padding changed.

> **Rule.** A chrome allowance is **measured live off the element that owns it**
> (`getBoundingClientRect()`, `getComputedStyle().paddingBottom`), never typed in. If you
> are about to change a number in a `calc()`, you are about to write the next stale
> constant.

**The stacked-margin bug.** The trail's bound reserved `1rem` below its card so the card
landed inside the window — and it did, with 14px to spare. Then the page container added
its own `sm:p-6` (24px) *underneath the grid*, and the document rendered 10px taller than
the window. Two boxes each reserving their own bottom margin, **stacked rather than
shared**.

> **Rule.** When two elements each reserve space at the same edge, one of them must read
> the other's. They cannot both guess.

**The clip that hid the content.** The fix for that 10px capped the *page container* with
`max-height` + `overflow: clip`. Verified on desktop; shipped. Measured afterwards at a
500px container — the single-column layout, i.e. **every phone and tablet**:

```
clientHeight   1463
scrollHeight   2620
hidden         1157 px
scrollTop = 9999 → still 0     (clip refuses programmatic scroll too)
```

> **Rule — the one that matters most.** **Bounding a box that has its own scrollport is
> safe. Bounding one that does not is hiding content.** The trail card could be capped
> because a `ScrollArea` lives inside it. The page container could not, because nothing
> inside it scrolls.
>
> `overflow: hidden` on `body`, or `clip` on a page container, is never the fix for a
> document that is too tall. It removes the scrollbar, not the overflow.

**Container queries measure the content box.** The modal was widened to 920px and still
drew one column: `@container` on a padded popup gives `920 − 40 − 2 = 878`, which never
reached the `@min-[900px]:` threshold. When a container query does not fire, subtract the
padding and the border before assuming the query is wrong.

**No arbitrary values.** `max-w-[1418px]` is a smell and was rejected on sight. Use
Tailwind's scale, or name the formula as an `@utility` (`trail-bound-page`) so the call
site reads as a rule rather than a measurement.

---

## 7. Verification that actually verifies

Three separate rounds reported "fixed and verified" and were wrong in the same way: they
checked **one** condition, at **one** size.

- A trail card's bottom edge was measured and declared bounded. Nobody asked whether the
  **document** was taller than the window. It was.
- A layout fix was verified at desktop widths only. It broke every width below the
  breakpoint.
- A component was declared "installed and verified" after checking its imports and
  dependencies. It had `@/` imports that only break when something consumes it.

**The rules.**

- **Check the whole claim, not the part you fixed.** For layout that means
  `document.documentElement.scrollHeight === window.innerHeight`, not the card's own rect.
- **Two sizes minimum**, and one of them must be below the layout's own breakpoint.
- **"Installed" means it compiles in a consumer**, not that the package looks right.
- **Composition first, details second.** A full-width header above a capped grid was
  looked at and not seen, because the check was for collisions and spacing rather than for
  whether the page reads as one composition.

---

## 8. Don't damage the developer's world

Three incidents in the dev database, none of them self-disclosed by the agent that caused
them: a real profile photo overwritten irreversibly during upload testing; audit rows
written with millisecond timestamps; display names left as test values.

Twice a background process belonging to the developer was killed by a broad `pkill`
pattern — once their dev server, once a task that was mid-port.

**The rules.**

- **Cleanup must be verifiable.** Re-read the rows you touched and paste what came back.
  "I cleaned up" is not a report.
- **Never test destructive paths against real rows.** Seed a row you own, and say which.
- **Never `pkill` on a broad pattern.** Target a pid you started.
- **Disclose damage immediately**, in the report, before the good news.

---

## 9. Next.js 16 specifics that cost time here

- **`instant` is a validator, not a switch.** `export const instant = false` *disables*
  static-shell validation. It belongs only on a redirect-only index page — and on the
  **page**, never the layout, because a `false` above wins over any `true` beneath and
  would silently disable the check app-wide.
- **`typedRoutes` types are generated at `build`**, not by `tsc --noEmit`. A bad `Route`
  cast passes typecheck and fails the build.
- **The versioned docs in `node_modules/next/dist/docs/` are the authority** — over
  training data and over example repos, several of which run preview builds carrying APIs
  that never shipped (`prefetch = 'allow-runtime'` does not exist in what we run).
- **`use cache` stays in the app, never in `packages/services`** — it is a Next compiler
  construct, and the same service called from a Worker would silently not cache.
- **Cache the inner function, not the wrapper.** `cookies()` cannot be called inside
  `'use cache'`: export an uncached wrapper that reads the request and pass the id into a
  cached inner function. **The privacy comes from the key, not the directive.**
- **The static shell is public under PPR.** Anything identifying lives behind
  `<Suspense>`.
- **`prefetch={true}` on a list is one server invocation per visible row.** Use
  `HoverPrefetchLink` for rows; reserve `true` for a handful of fixed destinations.

---

## 10. Dependencies

- **`packages/ui` must not gain a dependency.** **Radix especially** — it has been removed
  from this repo three times. Base UI (`@base-ui/react`) and beUI (over `motion/react`)
  are already here; reach for those.
- Before adding anything, check whether the package is already a dependency of a package
  you can import from. `ScrollArea` and `PreviewRail` both turned out to be free.

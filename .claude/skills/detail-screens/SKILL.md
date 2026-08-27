---
name: detail-screens
description: How a person/entity detail screen is built here — one component behind two URLs via intercepting routes, capability groups instead of a permissions matrix, avatar upload through presigned keys, a paginated activity trail that is a real server round trip, and the layout rules that took ten rounds. Use when building or changing any detail screen, a modal that must also be a page, an upload flow, or an activity/audit panel.
---

# Detail screens

This is the shape a detail screen takes here. It was worked out in a product built on this
boilerplate — `apps/admin/src/features/users/`, two populations at `/staff/[id]` and
`/players/[id]` — and most of it was arrived at by getting it wrong first, which is what
`hard-won` records. Nothing below is speculative; all of it shipped.

`apps/admin/src/features/users/` here is where it belongs when it is built.

---

## One component, two URLs

A detail is a **modal on a soft navigation** and a **page on a hard reload**. Both render
the same component; nothing is duplicated.

```
app/(app)/staff/
  layout.tsx              children + modal, synchronous, holds no data
  page.tsx                the roster
  [id]/page.tsx           the page variant     ← a hard reload lands here
  @modal/
    default.tsx           null, so the slot is empty when no detail is open
    (.)[id]/page.tsx      the modal variant    ← a soft navigation is intercepted here
```

`(.)` intercepts at the level of the folder containing it, so `@modal/(.)[id]` catches
`/staff/<id>`. The layout must be **synchronous and data-free**: it renders on every
navigation under `/staff`, and an `await` there blocks the roster on the detail.

**The data fetch stays server-side.** `<PersonDetail>` is a Server Component rendered
inside the modal route and handed to the client `<PersonDetailModal>` as `children`. The
modal never fetches.

`PersonDetail` takes `variant: "modal" | "page"` and branches only on presentation.

## The two variants are not the same layout

They were, briefly, and it was wrong.

- **Page** — two columns above the container breakpoint: the panel groups on the left, the
  activity trail sticky on the right.
- **Modal** — a **single tabbed column**. The modal was widened to 920px to fit two and
  still drew one, because `@container` measures the *content* box: `920 − 40 − 2 = 878`
  never reached the `@min-[900px]:` threshold. Rather than keep widening, the modal admits
  it is narrow.

Do not try to make one layout serve both. The available width genuinely differs.

---

## Capability groups, not a permissions matrix

Panels are grouped by **who the change belongs to**, which is a more useful question than
which role can do it:

| Group | Contains | Rule |
|---|---|---|
| **Theirs to change** | photo, name, email, connected accounts | self-only in Better Auth; an admin cannot do these *for* someone |
| **Facts** | joined, last seen, sign-in method, anything the product knows but nobody edits | read-only, no affordance at all |
| **Yours to decide** | role, ban, sessions, impersonate, delete | administrative; every one goes through the ladder |

`capabilities.ts` (in `packages/services`) is **pure** and returns three states per action:
`allowed`, `read`, `hidden`. A greyed-out control is none of those by accident — it is
`read`, chosen deliberately, because a control that vanishes teaches nothing while one that
is visibly refused explains the rule.

**`TOMBSTONE` returns before any privilege question.** A deleted, anonymised row has no
privileges to reason about, and an earlier version happily offered to impersonate one —
which would have minted a live session attributed to "Deleted account".

Guards live in small pure modules beside their actions — `avatar-guard.ts`,
`accounts-guard.ts`, `email-guard.ts`, `name-guard.ts`, `session-guard.ts`,
`anonymise-guard.ts` — each with an exhaustive test. The **Server Action calls the same
guard the UI called.** Hiding a button is never the control.

## The confirmation ladder

`confirm-ladder.ts` weights each action; anything above the threshold needs a typed
confirmation, and destructive ones need a reason. This shipped once with **ban, revoke-all,
impersonate and a cross-population role change all firing on a single click** — on the
screen whose entire job is the ladder. Wire it before wiring the actions.

## Delete means anonymise

The row stays so `audit_log` keeps its actor; identifying fields are cleared and the row
becomes a tombstone. **Nobody anonymises their own account.** The audit event type list is closed on purpose — never
widen it to describe a new event; map the event onto an existing type, or change the
schema deliberately and migrate.

---

## Avatar upload

The flow is presign → PUT → confirm, and every step is validated server-side.

- **Parse the key.** `avatar-key.ts` builds it, and `packages/storage`'s `keySchema` is
  applied inside `presignUpload`. Skipping this let `avatars/../../other/x.png` presign a
  PUT against a **different bucket** — `encodeURIComponent` leaves `..` for `new URL` to
  normalise.
- **Refuse SVG.** It carries script, and one served from our own origin is XSS arriving
  through a profile picture. `avatar-limits.ts` holds the accepted types and
  `MAX_AVATAR_BYTES`.
- **The limits module is a leaf.** A client needs `MAX_AVATAR_BYTES`; importing it from the
  services barrel dragged `node:fs` into the browser bundle. Constants a client reads live
  where a client can read them.
- **The states are the feature.** `use-avatar-upload.ts` owns idle → picking → uploading
  (with progress) → error → done. "It opens a file picker and the page changes later" is
  not an upload UI.

`packages/storage` itself: disks by name, `manager.fake()` for tests (never inject a
`FakeDisk` by hand), no `process.env`, no `next/*`, AWS SDKs as optional peers behind a
lazy import — it runs in a Worker.

---

## The activity trail

A paginated audit list beside the detail. Three things about it are load-bearing.

**"Show more" is a real server round trip, not a client fetch.** The whole client surface
is a `useQueryStates` write with `shallow: false` inside a transition:

```tsx
const [{ activityShown }, setActivityParams] = useQueryStates(activitySearchParams, {
  shallow: false,
  startTransition,
});
…
onClick={() => setActivityParams({ activityShown: activityShown + ACTIVITY_PAGE_SIZE })}
```

The URL is the state, so the page is shareable and a reload keeps the reader where they
were. The server re-renders with a larger window.

**The scrollport is Base UI's `ScrollArea`**, not `overflow-y-auto`. The card's border and
radius live on `ScrollArea.Root`; `ScrollArea.Viewport` is what scrolls; padding sits on
`ScrollArea.Content` so the scrollbar can overlay the card's own edge.

**The rail is beUI's `PreviewRail`**, inside the card and sharing one continuous border
with it — a rail with a gap beside a bordered box reads as two boxes. It is populated only
when the viewport actually overflows; a short trail gets no rail rather than a decoration.

Neither was a new dependency. Check before adding one.

---

## The layout rules (read `hard-won` §6 for how these were learned)

1. **Bounding a box that has its own scrollport is safe. Bounding one that does not is
   hiding content.** The trail card may be capped because a `ScrollArea` lives in it. The
   page container may not, because nothing inside it scrolls. `overflow: hidden` on `body`
   or `clip` on a page container removes the scrollbar, not the overflow.
2. **Chrome allowances are measured live, never typed in.** `--trail-top` comes from
   `getBoundingClientRect().top + scrollY`; `--trail-bottom-chrome` from
   `getComputedStyle(owner).paddingBottom`. Changing a number inside a `calc()` is how you
   write the next stale constant.
3. **Two elements reserving space at the same edge must share, not each guess.** The page
   container's bottom padding sits under the grid; the trail's bound reads it.
4. **Name the formula.** `@utility trail-bound-page`, not `max-h-[calc(…)]` at the call
   site. Arbitrary values (`max-w-[1418px]`) are rejected on sight.
5. **A container query measures the content box.** When one does not fire, subtract padding
   and border before assuming the query is wrong.
6. **Verify at two widths minimum**, one of them below the layout's breakpoint, and check
   `document.documentElement.scrollHeight === window.innerHeight` rather than one card's
   rect. Three rounds reported "verified" having checked one width.

## Streaming and caching

The page is synchronous (`params.then()`), owns its own `<Suspense>` boundaries, and keeps
each skeleton in the same file as the component it stands in for. The static shell is
public under PPR, so **anything identifying lives behind a boundary**. Queries follow the
uncached-wrapper / cached-inner split, with the viewer id as part of the cache key — the
privacy comes from the key, not the directive.

Rows link with `HoverPrefetchLink`. `prefetch={true}` on a roster is one server invocation
per visible row.

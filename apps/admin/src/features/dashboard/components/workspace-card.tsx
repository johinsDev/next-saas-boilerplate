import { readWorkspace } from "../dashboard-queries";

/**
 * The reference screen: a real service call, cached, behind the page's own
 * Suspense boundary, with a skeleton that reserves the same height.
 *
 * There is nothing special about the data — it exists to show the shape a
 * feature component takes here. It receives no route props, awaits its own
 * query, and exports its skeleton from this same file so the two cannot drift.
 */
export async function WorkspaceCard() {
  const workspace = await readWorkspace();

  if (!workspace) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          This account is not a member of any organization yet.
        </p>
      </Card>
    );
  }

  const rows = [
    ["Default locale", workspace.defaultLocale],
    ["Currency", workspace.currency],
    ["Timezone", workspace.timezone],
    ["Supported locales", workspace.supportedLocales.join(", ")],
  ] as const;

  return (
    <Card>
      <dl className="flex flex-col gap-px overflow-hidden rounded-lg border border-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-4 bg-card px-3 py-2.5">
            <dt className="w-40 shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function WorkspaceCardSkeleton() {
  return (
    <Card>
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-border" aria-hidden>
        {/* Four rows, matching the real list, so nothing below shifts when it lands. */}
        {Array.from({ length: 4 }, (_unused, index) => (
          <div key={index} className="flex items-center gap-4 bg-card px-3 py-2.5">
            <span className="h-4 w-40 shrink-0 animate-pulse rounded bg-muted" />
            <span className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground">Workspace</h2>
        <p className="text-xs text-muted-foreground">Settings this organization renders with</p>
      </header>
      {children}
    </section>
  );
}

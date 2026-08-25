import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * The admin has no landing page — the dashboard is the landing page.
 *
 * It stays outside `(app)` because it renders nothing to guard: `proxy.ts`
 * already turned away anyone with no session, and the layout's gate runs on
 * `/dashboard` the moment this lands there.
 */
export default function HomePage() {
  redirect("/dashboard" as Route);
}

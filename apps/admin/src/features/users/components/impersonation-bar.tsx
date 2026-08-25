import { getViewer } from "@/features/auth/auth-queries";
import { stopImpersonatingAction } from "../users-actions";
import { ImpersonationBanner } from "./impersonation-banner";

/**
 * The band across the top that says you are not yourself.
 *
 * It lives in the layout rather than on the roster, and that is the entire
 * point: impersonation follows you everywhere, so the reminder has to as well.
 * Without it somebody edits a board from a colleague's account and the audit
 * trail records the colleague — which is exactly what an impersonation feature
 * is for, and exactly what makes it dangerous unlabelled.
 *
 * Renders nothing in the ordinary case, so it costs one session read the chip
 * in the sidebar was making anyway.
 *
 * The server half reads the session; the banner itself is a Client Component
 * because it animates. Splitting them keeps `getViewer` off the client without
 * giving up the exit animation.
 */
export async function ImpersonationBar() {
  const viewer = await getViewer();
  if (!viewer?.impersonatedBy) return null;

  return (
    <ImpersonationBanner
      who={viewer.name?.trim() || viewer.email}
      onStop={stopImpersonatingAction}
    />
  );
}

import { Suspense } from "react";

import { AccountCard, AccountCardSkeleton } from "@/features/auth/account-card";

export const metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Your account</h1>

      <Suspense fallback={<AccountCardSkeleton />}>
        <AccountCard />
      </Suspense>
    </div>
  );
}

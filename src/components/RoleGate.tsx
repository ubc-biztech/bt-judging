"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useClientSession } from "@/lib/session";

export default function RoleGate({
  allow,
  children,
  redirectTo = "/auth"
}: {
  allow: Array<"admin" | "judge" | "team">;
  children: ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { ready, session } = useClientSession();

  useEffect(() => {
    if (!ready) return;
    if (!session || !allow.includes(session.role)) {
      router.replace(redirectTo);
    }
  }, [ready, session, allow, router, redirectTo]);

  if (!ready) {
    return (
      <div className="min-h-dvh">
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
          Loading…
        </div>
      </div>
    );
  }

  if (!session || !allow.includes(session.role)) return null;
  return <>{children}</>;
}

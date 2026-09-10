// pages/index.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useClientSession } from "@/lib/session";
import { db, EVENT_ID } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Home() {
  const router = useRouter();
  const { ready, session } = useClientSession();

  useEffect(() => {
    if (!ready) return;

    if (!session) {
      router.replace("/auth");
      return;
    }

    (async () => {
      if (session.role === "admin") {
        router.replace("/admin");
        return;
      }
      if (session.role === "team") {
        router.replace("/submit");
        return;
      }
      if (session.role === "judge") {
        try {
          const s = await getDoc(doc(db, "events", EVENT_ID));
          const data = s.exists() ? s.data() : {};
          const finals = data?.phase === "finals";
          const finalsJudgeIds: string[] = data?.finalsJudgeIds || [];
          if (finals && finalsJudgeIds.includes(session.judgeId)) {
            router.replace("/judge/finals");
          } else {
            router.replace("/judge");
          }
        } catch {
          router.replace("/judge");
        }
      }
    })();
  }, [ready, session, router]);

  return (
    <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  );
}

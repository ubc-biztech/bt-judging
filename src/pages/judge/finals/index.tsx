"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useClientSession } from "@/lib/session";
import { db, EVENT_ID } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import Link from "next/link";

type Team = { id: string; name: string; members?: string[] };
type EventSettings = {
  phase?: string;
  finalsJudgeIds?: string[];
  finalsTeamIds?: string[];
};

export default function JudgeFinalsIndex() {
  return (
    <RoleGate allow={["judge"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const router = useRouter();
  const { ready, session } = useClientSession();
  const judgeId = ready && session?.role === "judge" ? session.judgeId : null;

  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({});
  const [finalsTeamIds, setFinalsTeamIds] = useState<string[]>([]);
  const [judgedIds, setJudgedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready || !judgeId) return;
    const unsubSettings = onSnapshot(doc(db, "events", EVENT_ID), (snap) => {
      const sData = (snap.exists() ? snap.data() : {}) as EventSettings;
      setSettings(sData);
      if (sData.phase !== "finals") {
        router.replace("/judge");
        return;
      }
      const finalsJudgeIds: string[] = sData.finalsJudgeIds || [];
      if (!finalsJudgeIds.includes(judgeId)) {
        router.replace("/judge");
        return;
      }
      setFinalsTeamIds((sData.finalsTeamIds || []) as string[]);
    });

    const unsubTeams = onSnapshot(
      collection(db, "events", EVENT_ID, "teams"),
      (snap) => {
        const next: Record<string, Team> = {};
        snap.forEach((d) => {
          const data = d.data() as Partial<Team>;
          next[d.id] = {
            id: d.id,
            name: data.name || d.id,
            members: data.members
          };
        });
        setTeamMap(next);
      }
    );

    const rq = query(
      collection(db, "events", EVENT_ID, "reviews"),
      where("judgeId", "==", judgeId),
      where("round", "==", "finals")
    );
    const unsubReviews = onSnapshot(rq, (snap) => {
      const done = new Set<string>();
      snap.forEach((d) => {
        const teamId = (d.data() as { teamId?: string }).teamId;
        if (teamId) done.add(teamId);
      });
      setJudgedIds(done);
    });

    return () => {
      unsubSettings();
      unsubTeams();
      unsubReviews();
    };
  }, [ready, judgeId, router]);

  const teams = useMemo(
    () => finalsTeamIds.map((id) => teamMap[id]).filter(Boolean),
    [finalsTeamIds, teamMap]
  );

  const progress = useMemo(() => {
    const total = teams.length;
    const done = teams.filter((t) => judgedIds.has(t.id)).length;
    return { done, total };
  }, [teams, judgedIds]);

  if (!judgeId) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Finals Judging
        </h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Phase: {settings?.phase || "—"} • Progress: {progress.done}/
          {progress.total}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {teams.map((t) => {
          const done = judgedIds.has(t.id);
          return (
            <Link
              href={`/judge/finals/${t.id}`}
              key={t.id}
              className={[
                "rounded-2xl border p-4 transition",
                done
                  ? "border-green-300/40 bg-green-50 dark:border-green-400/20 dark:bg-green-400/5"
                  : "border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {t.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Members: {t.members?.join(", ") || "—"}
                  </div>
                </div>
                {done ? (
                  <span className="rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                    Judged
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
        {teams.length === 0 && (
          <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
            No finals teams assigned yet.
          </div>
        )}
      </div>
    </div>
  );
}

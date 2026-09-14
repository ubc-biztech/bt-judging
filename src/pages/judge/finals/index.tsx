"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import Link from "next/link";
import type { JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, listReviews } from "@/lib/bt";

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
  const judgeId = ready && session?.role === "judge" ? session.id : null;

  const { data: doc } = usePoll(ready && judgeId ? eventOrEmpty : null, [ready, judgeId]);
  const settings = doc?.settings ?? null;
  const teamList = doc?.teams ?? null;

  const fetchMyFinals = useCallback(
    () => listReviews({ judgeId: judgeId as string, round: "finals" }),
    [judgeId]
  );
  const { data: myFinals } = usePoll(ready && judgeId ? fetchMyFinals : null, [ready, judgeId]);

  // Not in finals, or not a finals judge: back to the judge home.
  useEffect(() => {
    if (!settings || !judgeId) return;
    if (settings.phase !== "finals") {
      router.replace("/judge");
      return;
    }
    if (!settings.finalsJudgeIds.includes(judgeId)) {
      router.replace("/judge");
    }
  }, [settings, judgeId, router]);

  const finalsTeamIds = settings?.finalsTeamIds ?? [];

  const teamMap = useMemo(() => {
    const next: Record<string, Team> = {};
    for (const t of teamList ?? []) next[t.id] = t;
    return next;
  }, [teamList]);

  const judgedIds = useMemo(
    () => new Set((myFinals ?? []).map((r) => r.teamId)),
    [myFinals]
  );

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

"use client";

import { useCallback, useMemo } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import TeamCard from "@/components/TeamCard";
import { usePoll } from "@/lib/usePoll";
import { useClientSession } from "@/lib/session";
import type { JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, listReviews } from "@/lib/bt";

function Page() {
  const { ready, session } = useClientSession();
  const judgeId = ready && session?.role === "judge" ? session.id : null;
  const judgeName =
    ready && session?.role === "judge" ? session.name || "Judge" : "Judge";

  // One document: settings, teams, and this judge's assignments.
  const { data: doc } = usePoll(judgeId ? eventOrEmpty : null, [judgeId]);
  const settings = doc?.settings ?? null;
  const teamList = doc?.teams ?? null;
  const judge = doc?.judges.find((j) => j.id === judgeId) ?? null;

  const fetchMyReviews = useCallback(
    () => listReviews({ judgeId: judgeId as string, round: "prelim" }),
    [judgeId]
  );
  const { data: myReviews } = usePoll(judgeId ? fetchMyReviews : null, [judgeId]);

  const teamMap = useMemo(() => {
    const next: Record<string, Team> = {};
    for (const t of teamList ?? []) next[t.id] = t;
    return next;
  }, [teamList]);

  const assignedTeamIds = judge?.assignedTeamIds ?? [];
  const doneTeamIds = useMemo(
    () => new Set((myReviews ?? []).map((r) => r.teamId)),
    [myReviews]
  );

  const teams = useMemo(
    () => assignedTeamIds.map((id) => teamMap[id]).filter(Boolean),
    [assignedTeamIds, teamMap]
  );

  const progress = useMemo(() => {
    const d = doneTeamIds.size;
    const total = teams.length || 0;
    return `${d}/${total} completed`;
  }, [doneTeamIds, teams]);

  const doneCount = useMemo(
    () => teams.filter((t) => doneTeamIds.has(t.id)).length,
    [teams, doneTeamIds]
  );
  const remainingCount = Math.max(0, teams.length - doneCount);

  return (
    <Layout>
      <div className="max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Judge Workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                Welcome, {judgeName}
              </h1>
              <p className="mt-3 text-sm text-slate-400">Complete assigned reviews.</p>
            </div>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              {progress}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#0c1324]/70 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Assigned
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {teams.length}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300/70">
                Completed
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">
                {doneCount}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-300/70">
                Remaining
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">
                {remainingCount}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Assigned Teams
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((t) => (
              <TeamCard
                key={t.id}
                team={{
                  ...t,
                  name: settings?.anonymizeTeams
                    ? `Team ${t.id.slice(0, 4).toUpperCase()}`
                    : t.name
                }}
                judged={doneTeamIds.has(t.id)}
              />
            ))}
            {teams.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No assignments yet.
              </div>
            )}
          </div>
        </section>

      </div>
    </Layout>
  );
}

export default function JudgeHome() {
  return (
    <RoleGate allow={["judge"]}>
      <Page />
    </RoleGate>
  );
}

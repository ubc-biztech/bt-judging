// pages/team/feedback.tsx
"use client";

import { useMemo, useState } from "react";
import { Status } from "@/components/Feedback";
import { ForbiddenError } from "@ubc-biztech/sdk";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { normalizeRubric, rubricUsesPointTotals } from "@/lib/judging";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import type { Review, Rubric, JudgingTeam as Team } from "@ubc-biztech/sdk";
import type { Criterion } from "@/lib/types";
import { errorMessage, eventOrEmpty, listReviews } from "@/lib/bt";

export default function TeamFeedbackPage() {
  return (
    <RoleGate allow={["team"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const { ready, session } = useClientSession();
  const [tab, setTab] = useState<"prelim" | "finals">("prelim");

  const teamId = session?.role === "team" ? session.id : undefined;
  const active = ready && !!teamId;

  // One document: settings, rubric, and this team, as the team code may see it.
  const docPoll = usePoll(active ? eventOrEmpty : null, [teamId], 10000);
  // The server refuses (403) until results are public; treat that as "not yet", not an error.
  const reviewsPoll = usePoll(
    active ? () => listReviews({ teamId: teamId! }) : null,
    [teamId],
  );

  const canViewFeedback =
    docPoll.data?.settings.showTeamFeedback !== false &&
    !(reviewsPoll.error instanceof ForbiddenError);
  const failure = docPoll.error || (canViewFeedback ? reviewsPoll.error : null);
  const loading =
    !ready || (active && (docPoll.loading || reviewsPoll.loading));
  const team: Team | null = canViewFeedback
    ? (docPoll.data?.teams.find((t) => t.id === teamId) ?? null)
    : null;
  const rubricRaw = docPoll.data?.rubric ?? null;
  const rubric: Rubric | null = useMemo(
    () => (rubricRaw === null ? null : normalizeRubric(rubricRaw)),
    [rubricRaw],
  );
  const reviews: Review[] = useMemo(
    () => (canViewFeedback ? (reviewsPoll.data ?? []) : []),
    [canViewFeedback, reviewsPoll.data],
  );

  const prelimReviews = useMemo(
    () => reviews.filter((r) => (r.round || "prelim") === "prelim"),
    [reviews],
  );
  const finalsReviews = useMemo(
    () => reviews.filter((r) => (r.round || "prelim") === "finals"),
    [reviews],
  );

  const crits = rubric?.criteria || [];
  const criterionMax = (c: Criterion) =>
    Math.max(1, Math.round(Number(c.maxScore ?? rubric?.scaleMax ?? 5) || 5));
  const current = tab === "prelim" ? prelimReviews : finalsReviews;
  const pointTotals = rubricUsesPointTotals(rubric);

  const sorted = useMemo(
    () =>
      [...current].sort((a, b) =>
        (b.completedAt || "").localeCompare(a.completedAt || ""),
      ),
    [current],
  );

  if (failure)
    return (
      <Status
        error={errorMessage(failure)}
        onRetry={() => {
          void docPoll.refresh();
          void reviewsPoll.refresh();
        }}
      />
    );
  if (!loading && !canViewFeedback) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300">
          The organizers have not released feedback yet.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        My Feedback
      </h1>

      <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        {team ? (
          <>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {team.name}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Members: {team.members?.join(", ") || "—"}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {loading
              ? "Loading team…"
              : "Could not find your team. Double-check your team code or contact organizers."}
          </div>
        )}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
        {(["prelim", "finals"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-1.5 text-xs rounded-md",
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-gray-700 dark:text-gray-300",
            ].join(" ")}
          >
            {t === "prelim" ? "Preliminary Round" : "Final Round"}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 p-4 text-sm dark:border-white/10">
        {loading ? (
          <div className="text-gray-500 dark:text-gray-400">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No feedback yet for this round.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    <th className="px-3 py-2 text-left">Judge</th>
                    {crits.map((c) => (
                      <th key={c.id} className="px-3 py-2 text-left">
                        {c.label}
                        <div className="text-[10px] text-gray-500">
                          {!pointTotals && `Weight ${c.weight} · `}Max{" "}
                          {criterionMax(c)}
                        </div>
                      </th>
                    ))}
                    {!pointTotals && (
                      <th className="px-3 py-2 text-left">Raw total</th>
                    )}
                    <th className="px-3 py-2 text-left">
                      {pointTotals ? "Score Total" : "Weighted Total"}
                    </th>
                    <th className="px-3 py-2 text-left">Feedback</th>
                    <th className="px-3 py-2 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-gray-100 dark:border-white/10 align-top"
                    >
                      <td className="px-3 py-2">
                        {r.judgeName || r.judgeId || "Judge"}
                      </td>
                      {crits.map((c) => (
                        <td key={c.id} className="px-3 py-2">
                          {typeof r.scores?.[c.id] === "number"
                            ? r.scores![c.id]
                            : "—"}
                        </td>
                      ))}
                      {!pointTotals && (
                        <td className="px-3 py-2">
                          {Number(r.total || 0).toFixed(2)}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {Number(
                          pointTotals ? r.total : r.weightedTotal || 0,
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800 dark:text-gray-100 border border-gray-200/70 dark:border-white/10 rounded-md px-2 py-1 bg-gray-50/70 dark:bg-white/5">
                          {r.feedback || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.completedAt
                          ? new Date(r.completedAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

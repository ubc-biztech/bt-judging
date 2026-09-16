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

      <div className="mt-4 inline-flex max-w-full flex-wrap rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
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
          <div className="space-y-6">
            {sorted.map((r) => (
              <article
                key={r.id}
                className="min-w-0 border-b border-[var(--line)] pb-6 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{r.judgeName || "Judge"}</h2>
                    <p className="mt-1 text-xs text-[var(--ink-3)]">
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleString()
                        : "Submission time unavailable"}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {pointTotals ? "Score total" : "Weighted total"}:{" "}
                    {Number(
                      pointTotals ? r.total : r.weightedTotal || 0,
                    ).toFixed(2)}
                  </p>
                </div>
                <dl className="my-4 grid gap-3 sm:grid-cols-2">
                  {crits.map((c) => (
                    <div
                      key={c.id}
                      className="min-w-0 flex items-start justify-between gap-3 rounded-lg bg-[var(--paper)] p-3"
                    >
                      <dt className="min-w-0">
                        {c.label}
                        {!pointTotals && (
                          <span className="mt-1 block text-xs text-[var(--ink-3)]">
                            Weight {c.weight}
                          </span>
                        )}
                      </dt>
                      <dd className="shrink-0 font-medium">
                        {typeof r.scores?.[c.id] === "number"
                          ? r.scores[c.id]
                          : "—"}{" "}
                        / {criterionMax(c)}
                      </dd>
                    </div>
                  ))}
                  {!pointTotals && (
                    <div className="flex flex-wrap justify-between gap-3 p-3">
                      <dt>Raw total</dt>
                      <dd>{Number(r.total || 0).toFixed(2)}</dd>
                    </div>
                  )}
                </dl>
                <h3 className="mb-2 font-medium">Feedback</h3>
                <p className="whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                  {r.feedback || "No written feedback."}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

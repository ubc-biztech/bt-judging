// pages/team/feedback.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { Status } from "@/components/Feedback";
import TableScroll from "@/components/TableScroll";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useRef<HTMLElement>(null);
  const selectedButton = useRef<HTMLButtonElement>(null);

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
  const selected = sorted.find((r) => r.id === selectedId) ?? sorted[0];

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
    <div className="max-w-7xl">
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
            onClick={() => {
              setTab(t);
              setSelectedId(null);
            }}
            className="ux-tab"
          >
            {t === "prelim" ? "Preliminary Round" : "Final Round"}
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm">
        {loading ? (
          <div className="text-gray-500 dark:text-gray-400">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No feedback yet for this round.
          </div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
            <section
              aria-labelledby="scores-heading"
              className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <h2 id="scores-heading" className="text-lg font-semibold">
                Judges ({sorted.length})
              </h2>
              <p className="mb-4 mt-1 text-[var(--ink-3)]">
                Select a judge to read their feedback.
              </p>
              <TableScroll label="Judge scores">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--line)] text-xs">
                    <tr>
                      <th scope="col" className="min-w-28 px-2 py-3">Judge</th>
                      {crits.map((c) => (
                        <th key={c.id} scope="col" className="min-w-28 px-2 py-3">
                          {c.label}
                          <span className="mt-1 block font-normal text-[var(--ink-3)]">
                            Max {criterionMax(c)}{!pointTotals && ` · Weight ${c.weight}`}
                          </span>
                        </th>
                      ))}
                      {!pointTotals && <th scope="col" className="min-w-24 p-3">Raw total</th>}
                      <th scope="col" className="min-w-24 p-3">
                        {pointTotals ? "Score total" : "Weighted total"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-b border-[var(--line)] last:border-0 ${selected.id === r.id ? "bg-[var(--blue)]/10" : ""}`}
                      >
                        <th scope="row" className="p-2 font-medium">
                          <button
                            ref={selected.id === r.id ? selectedButton : undefined}
                            type="button"
                            aria-label={`View feedback from ${r.judgeName || "Judge"}`}
                            aria-pressed={selected.id === r.id}
                            aria-controls="judge-feedback"
                            className="min-h-10 w-full rounded-md px-1 text-left text-[var(--blue)] underline decoration-[var(--blue)]/40 underline-offset-4"
                            onClick={() => {
                              setSelectedId(r.id);
                              requestAnimationFrame(() => {
                                detail.current?.focus({ preventScroll: true });
                                detail.current?.scrollIntoView({ block: "nearest" });
                              });
                            }}
                          >
                            {r.judgeName || "Judge"}
                          </button>
                        </th>
                        {crits.map((c) => (
                          <td key={c.id} className="p-3 tabular-nums">
                            {typeof r.scores?.[c.id] === "number" ? r.scores[c.id] : "—"}
                          </td>
                        ))}
                        {!pointTotals && <td className="p-3 tabular-nums">{Number(r.total || 0).toFixed(2)}</td>}
                        <td className="p-3 font-semibold tabular-nums">
                          {Number(pointTotals ? r.total : r.weightedTotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </section>
            <section
              ref={detail}
              id="judge-feedback"
              aria-labelledby="feedback-heading"
              tabIndex={-1}
              className="min-w-0 scroll-mt-20 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
            >
              <h2 id="feedback-heading" className="text-lg font-semibold">Judge feedback</h2>
              <h3 className="mt-4 font-semibold">{selected.judgeName || "Judge"}</h3>
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                {selected.completedAt
                  ? `Submitted ${new Date(selected.completedAt).toLocaleString()}`
                  : "Submission time unavailable"}
              </p>
              <p className="mt-5 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                {selected.feedback?.trim() ? selected.feedback : "No written feedback."}
              </p>
              <button
                type="button"
                className="ux-secondary mt-5"
                onClick={() => {
                  selectedButton.current?.focus({ preventScroll: true });
                  selectedButton.current?.scrollIntoView({ block: "nearest" });
                }}
              >
                Back to scores
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// pages/results.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { EVENT_ID } from "@/lib/event";
import { normalizeRubric, rubricUsesPointTotals } from "@/lib/judging";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import type { Review, Rubric, JudgingTeam as Team } from "@ubc-biztech/sdk";
import type { Criterion } from "@/lib/types";
import { eventOrEmpty, listReviews } from "@/lib/bt";

type Row = {
  teamId: string;
  total: number;
  weightedTotal: number;
  count: number;
};

export default function Results() {
  const { ready, session } = useClientSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"prelim" | "finals">("prelim");
  const [hideUnderCovered, setHideUnderCovered] = useState(true);

  const isAdmin = ready && session?.role === "admin";
  const isJudge = ready && session?.role === "judge";
  const canViewFullResults = isAdmin || isJudge;
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/auth");
      return;
    }
    if (session.role === "team") {
      router.replace("/team/feedback");
      return;
    }
  }, [ready, session, router]);

  const active = ready && !!session && session.role !== "team";
  // One document (settings, rubric, teams) plus the reviews this role may see.
  const { data: doc } = usePoll(active ? eventOrEmpty : null, [active, session?.role], 10000);
  const settings = doc?.settings ?? null;
  const rubricRaw = doc?.rubric ?? null;
  const teamList = doc?.teams ?? null;
  const { data: reviewList } = usePoll(active ? () => listReviews() : null, [active, session?.role]);

  const allowJudgeSeeOthers = !!settings?.allowJudgeSeeOthers;
  const rubric: Rubric | null = useMemo(() => (rubricRaw === null ? null : normalizeRubric(rubricRaw)), [rubricRaw]);
  const teams = useMemo(() => {
    const map: Record<string, Team> = {};
    for (const t of teamList ?? []) map[t.id] = t;
    return map;
  }, [teamList]);
  const reviewsByTeam = useMemo(() => {
    const byTeam: Record<string, Review[]> = {};
    for (const r of reviewList ?? []) (byTeam[r.teamId] ||= []).push(r);
    return byTeam;
  }, [reviewList]);

  // Aggregate for current tab only
  useEffect(() => {
    const agg: Record<string, Row> = {};
    Object.entries(reviewsByTeam).forEach(([teamId, list]) => {
      list
        .filter((r) => (r.round || "prelim") === tab)
        .forEach((r) => {
          const cur = agg[teamId] || {
            teamId,
            total: 0,
            weightedTotal: 0,
            count: 0
          };
          cur.total += r.total || 0;
          cur.weightedTotal += r.weightedTotal || 0;
          cur.count += 1;
          agg[teamId] = cur;
        });
    });

    // coverage-aware sort: avg (weighted) desc, then review count desc
    const req = Number(settings?.perTeamJudges ?? 3);
    const pointTotals = rubricUsesPointTotals(rubric);
    const sorted = Object.values(agg)
      .map((r) => ({ ...r, meetsCoverage: r.count >= req }))
      .sort((a, b) => {
        const aAvg =
          (pointTotals ? a.total : a.weightedTotal) / Math.max(1, a.count);
        const bAvg =
          (pointTotals ? b.total : b.weightedTotal) / Math.max(1, b.count);
        if (bAvg !== aAvg) return bAvg - aAvg;
        return (b.count || 0) - (a.count || 0);
      });
    setRows(sorted);
  }, [reviewsByTeam, rubric, tab, settings?.perTeamJudges]);

  const reqCount = Number(settings?.perTeamJudges ?? 3);

  const canShowDetails = isAdmin || allowJudgeSeeOthers;
  const pointTotals = rubricUsesPointTotals(rubric);
  const primaryMetricLabel = pointTotals ? "Avg Score" : "Avg (Weighted)";

  const visibleRows = rows.filter(
    (r) => !hideUnderCovered || r.count >= reqCount
  );

  /* ----------------- EXPORTS ----------------- */

  function csvCell(s: unknown) {
    const str = s == null ? "" : String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function exportLeaderboardCsv() {
    const header = [
      "Rank",
      "Team",
      pointTotals ? "AvgScore" : "AvgWeighted",
      "AvgRaw",
      "ReviewCount",
      "TeamId"
    ];
    const lines = [header.join(",")];
    visibleRows.forEach((r, i) => {
      const avgW =
        (pointTotals ? r.total : r.weightedTotal) / Math.max(1, r.count);
      const avg = r.total / Math.max(1, r.count);
      const t = teams[r.teamId];
      lines.push(
        [
          String(i + 1),
          csvCell(t?.name || r.teamId),
          avgW.toFixed(4),
          avg.toFixed(4),
          String(r.count),
          r.teamId
        ].join(",")
      );
    });
    downloadBlob(
      [lines.join("\n")],
      `${EVENT_ID}-results-${tab}-${dateSlug()}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function exportDetailedCsv() {
    const crits = rubric?.criteria || [];
    const columns = [
      "TeamId",
      "TeamName",
      "JudgeId",
      "JudgeName",
      "Round",
      ...crits.map((c) => `score_${c.id}`),
      "TotalRaw",
      "TotalWeighted",
      "Feedback",
      "SubmittedAt"
    ];
    const lines = [columns.map(csvCell).join(",")];

    Object.entries(reviewsByTeam).forEach(([teamId, list]) => {
      const team = teams[teamId];
      list
        .filter((r) => (r.round || "prelim") === tab)
        .forEach((r) => {
          const perCrit = crits.map((c) =>
            r.scores && typeof r.scores[c.id] === "number" ? r.scores[c.id] : ""
          );
          lines.push(
            [
              csvCell(teamId),
              csvCell(team?.name || teamId),
              csvCell(r.judgeId),
              csvCell(r.judgeName || ""),
              csvCell(r.round || "prelim"),
              ...perCrit.map(csvCell),
              csvCell(nf(r.total)),
              csvCell(nf(r.weightedTotal)),
              csvCell(r.feedback || ""),
              csvCell(r.completedAt || "")
            ].join(",")
          );
        });
    });

    downloadBlob(
      [lines.join("\n")],
      `${EVENT_ID}-results-detailed-${tab}-${dateSlug()}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadBlob(
    parts: (string | Blob)[],
    filename: string,
    type: string
  ) {
    const blob = new Blob(parts, { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function dateSlug() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }
  function nf(n: unknown) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(4) : "";
  }

  if (!ready || !canViewFullResults) {
    return null;
  }

  /* ----------------- UI ----------------- */

  return (
    <Layout>
      <div className="max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              Results
            </h1>
            {settings?.phase && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Event phase: {settings.phase}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tabs */}
            <div className="mr-2 inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
              {(["prelim", "finals"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setExpanded(null);
                    setTab(t);
                  }}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs",
                    tab === t
                      ? "bg-indigo-600 text-white"
                      : "text-gray-700 dark:text-gray-300"
                  ].join(" ")}
                >
                  {t === "prelim" ? "Prelim" : "Finals"}
                </button>
              ))}
            </div>

            {/* Coverage filter (admins only) */}
            {isAdmin && (
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hideUnderCovered}
                  onChange={(e) => setHideUnderCovered(e.target.checked)}
                />
                Hide under-covered teams ({reqCount})
              </label>
            )}

            {/* Exports */}
            <button
              onClick={exportLeaderboardCsv}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              Export CSV
            </button>
            <button
              onClick={exportDetailedCsv}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
              title="Per judge, per criterion with feedback"
            >
              Export Detailed CSV
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-2 text-left">Rank</th>
                <th className="px-4 py-2 text-left">Team</th>
                <th className="px-4 py-2 text-left">{primaryMetricLabel}</th>
                <th className="px-4 py-2 text-left">Avg (Raw)</th>
                <th className="px-4 py-2 text-left"># Reviews</th>
                <th className="px-4 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const avgW =
                  (pointTotals ? r.total : r.weightedTotal) /
                  Math.max(1, r.count);
                const avg = r.total / Math.max(1, r.count);
                const t = teams[r.teamId];
                const isExpanded = expanded === r.teamId;
                const coverageOk = r.count >= reqCount;

                return (
                  <tr
                    key={r.teamId}
                    className={[
                      "border-t border-gray-100 align-top dark:border-white/10",
                      coverageOk ? "" : "opacity-75"
                    ].join(" ")}
                  >
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>{t?.name || r.teamId}</span>
                        <span
                          className={[
                            "rounded-md px-1.5 py-0.5 text-[11px] border",
                            coverageOk
                              ? "border-green-300 text-green-700 dark:text-green-400"
                              : "border-amber-300 text-amber-700 dark:text-amber-400"
                          ].join(" ")}
                          title={`Coverage: ${r.count}/${reqCount}`}
                        >
                          {r.count}/{reqCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">{avgW.toFixed(2)}</td>
                    <td className="px-4 py-2">{avg.toFixed(2)}</td>
                    <td className="px-4 py-2">{r.count}</td>
                    <td className="px-4 py-2">
                      {canShowDetails && r.count > 0 && (
                        <button
                          onClick={() =>
                            setExpanded(isExpanded ? null : r.teamId)
                          }
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                        >
                          {isExpanded ? "Hide details" : "Show details"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {visibleRows.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-4 text-gray-500 dark:text-gray-400"
                    colSpan={6}
                  >
                    No reviews yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded per-team details with per-criterion columns */}
        {expanded && canShowDetails && (
          <Details
            team={teams[expanded]}
            reviews={(reviewsByTeam[expanded] || []).filter(
              (r) => (r.round || "prelim") === tab
            )}
            rubric={rubric}
            pointTotals={pointTotals}
          />
        )}

        {/* All Teams list (compact) */}
        <h2 className="mt-10 text-lg font-semibold text-gray-900 dark:text-white">
          All Teams
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(teams).map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-gray-200 p-4 dark:border-white/10"
            >
              <div className="font-medium text-gray-900 dark:text-white">
                {t.name}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Members: {t.members?.join(", ") || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function Details({
  team,
  reviews,
  rubric,
  pointTotals
}: {
  team: Team | undefined;
  reviews: Review[];
  rubric: Rubric | null;
  pointTotals: boolean;
}) {
  const crits = rubric?.criteria || [];
  const criterionMax = (c: Criterion) =>
    Math.max(1, Math.round(Number(c.maxScore ?? rubric?.scaleMax ?? 5) || 5));

  // newest first
  const sorted = useMemo(
    () => [...reviews].sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")),
    [reviews]
  );

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 p-4 text-sm dark:border-white/10">
      <div className="mb-2 font-semibold">
        Judge breakdown for{" "}
        <span className="text-gray-900 dark:text-white">
          {team?.name || team?.id}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left">Judge</th>
              {crits.map((c) => (
                <th key={c.id} className="px-3 py-2 text-left">
                  {c.label}
                  <div className="text-[10px] text-gray-500">
                    wt {c.weight} | max {criterionMax(c)}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-left">Raw</th>
              <th className="px-3 py-2 text-left">
                {pointTotals ? "Score" : "Weighted"}
              </th>
              <th className="px-3 py-2 text-left">Feedback</th>
              <th className="px-3 py-2 text-left">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className="border-top border-gray-100 dark:border-white/10"
              >
                <td className="px-3 py-2">{r.judgeName || r.judgeId}</td>
                {crits.map((c) => (
                  <td key={c.id} className="px-3 py-2">
                    {typeof r.scores?.[c.id] === "number"
                      ? r.scores![c.id]
                      : "—"}
                  </td>
                ))}
                <td className="px-3 py-2">{Number(r.total || 0).toFixed(2)}</td>
                <td className="px-3 py-2">
                  {Number(pointTotals ? r.total : r.weightedTotal || 0).toFixed(
                    2
                  )}
                </td>
                <td className="px-3 py-2 max-w-[24rem]">
                  <div className="line-clamp-3" title={r.feedback || ""}>
                    {r.feedback || "—"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  className="px-3 py-3 text-gray-500 dark:text-gray-400"
                  colSpan={5 + (crits?.length || 0)}
                >
                  No reviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tiny legend */}
      {crits.length > 0 && (
        <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          {pointTotals
            ? "Each criterion uses its own score range (0 to max). The score column matches the direct category point total."
            : "Each criterion uses its own score range (0 to max). “Weighted” is the average of (criterion score × weight)."}
        </div>
      )}
    </div>
  );
}

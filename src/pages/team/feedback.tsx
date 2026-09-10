/* eslint-disable @typescript-eslint/no-explicit-any */
// pages/team/feedback.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { normalizeRubric, rubricUsesPointTotals } from "@/lib/judging";
import { useClientSession } from "@/lib/session";
import { db, EVENT_ID } from "@/lib/firebase";
import { Criterion, Rubric } from "@/lib/types";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

type Review = {
  id: string;
  teamId: string;
  judgeId: string;
  judgeName?: string;
  total: number;
  weightedTotal: number;
  scores?: Record<string, number>;
  feedback?: string;
  round?: "prelim" | "finals";
  createdAt?: any;
};

type Team = {
  id: string;
  name: string;
  members?: string[];
  track?: string;
};

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
  const [team, setTeam] = useState<Team | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canViewFeedback, setCanViewFeedback] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"prelim" | "finals">("prelim");

  const teamId = (session as any)?.teamId as string | undefined;

  useEffect(() => {
    if (!ready) return;
    if (!teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const readyFlags = {
      settings: false,
      team: false,
      rubric: false,
      reviews: false
    };
    const markReady = (key: keyof typeof readyFlags) => {
      readyFlags[key] = true;
      if (Object.values(readyFlags).every(Boolean)) {
        setLoading(false);
      }
    };

    const unsubSettings = onSnapshot(
      doc(db, "events", EVENT_ID),
      (sSnap) => {
        const settings = sSnap.exists() ? (sSnap.data() as any) : {};
        if (settings.showTeamFeedback === false) {
          setCanViewFeedback(false);
          setTeam(null);
          setRubric(null);
          setReviews([]);
        } else {
          setCanViewFeedback(true);
        }
        markReady("settings");
      },
      () => markReady("settings")
    );

    const unsubTeam = onSnapshot(
      doc(db, "events", EVENT_ID, "teams", teamId),
      (tSnap) => {
        if (tSnap.exists()) {
          setTeam({ id: tSnap.id, ...(tSnap.data() as any) });
        } else {
          setTeam(null);
        }
        markReady("team");
      },
      () => markReady("team")
    );

    const unsubRubric = onSnapshot(
      doc(db, "events", EVENT_ID, "rubric", "default"),
      (rSnap) => {
        if (rSnap.exists()) {
          setRubric(normalizeRubric(rSnap.data() as Partial<Rubric>));
        } else {
          setRubric(normalizeRubric());
        }
        markReady("rubric");
      },
      () => markReady("rubric")
    );

    const rq = query(
      collection(db, "events", EVENT_ID, "reviews"),
      where("teamId", "==", teamId)
    );
    const unsubReviews = onSnapshot(
      rq,
      (rs) => {
        const list: Review[] = [];
        rs.forEach((d) => {
          const v = { id: d.id, ...(d.data() as any) } as Review;
          const round = (v.round || "prelim") as "prelim" | "finals";
          list.push({ ...v, round });
        });
        setReviews(list);
        markReady("reviews");
      },
      () => markReady("reviews")
    );

    return () => {
      unsubSettings();
      unsubTeam();
      unsubRubric();
      unsubReviews();
    };
  }, [ready, teamId]);

  const prelimReviews = useMemo(
    () => reviews.filter((r) => (r.round || "prelim") === "prelim"),
    [reviews]
  );
  const finalsReviews = useMemo(
    () => reviews.filter((r) => (r.round || "prelim") === "finals"),
    [reviews]
  );

  const crits = rubric?.criteria || [];
  const criterionMax = (c: Criterion) =>
    Math.max(1, Math.round(Number(c.maxScore ?? rubric?.scaleMax ?? 5) || 5));
  const current = tab === "prelim" ? prelimReviews : finalsReviews;
  const pointTotals = rubricUsesPointTotals(rubric);

  const sorted = useMemo(
    () =>
      [...current].sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      }),
    [current]
  );

  function csvCell(v: any) {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function dateSlug() {
    return new Date().toISOString().replace(/[:.]/g, "-");
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

  function exportCsv() {
    if (!teamId) return;

    const cols = [
      "Round",
      "JudgeId",
      "JudgeName",
      ...crits.map((c) => `score_${c.id}`),
      "TotalRaw",
      "TotalWeighted",
      "Feedback",
      "SubmittedAt"
    ];
    const lines: string[] = [];
    lines.push(cols.map(csvCell).join(","));

    current.forEach((r) => {
      const perCrit = crits.map((c) =>
        typeof r.scores?.[c.id] === "number" ? r.scores![c.id] : ""
      );
      lines.push(
        [
          csvCell(r.round || "prelim"),
          csvCell(r.judgeId),
          csvCell(r.judgeName || ""),
          ...perCrit.map(csvCell),
          csvCell(Number(r.total || 0).toFixed(2)),
          csvCell(Number(r.weightedTotal || 0).toFixed(2)),
          csvCell(r.feedback || ""),
          csvCell(r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : "")
        ].join(",")
      );
    });

    const filename = `${EVENT_ID}-${
      team?.name || teamId
    }-feedback-${tab}-${dateSlug()}.csv`;
    downloadBlob([lines.join("\n")], filename, "text/csv;charset=utf-8");
  }

  if (!loading && !canViewFeedback) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-white/10 dark:text-gray-300">
          Feedback is hidden right now.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            My Feedback
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            You’re signed in as a team. This page shows feedback only for your
            own project.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sorted.length > 0 && (
            <button
              onClick={exportCsv}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        {team ? (
          <>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {team.name}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Members: {team.members?.join(", ") || "—"}
            </div>
            {team.track && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Track: {team.track}
              </div>
            )}
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
            onClick={() => setTab(t)}
            className={[
              "px-3 py-1.5 text-xs rounded-md",
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-gray-700 dark:text-gray-300"
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
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {pointTotals
                ? "Each criterion uses its own score range (0 to max). Score totals reflect the direct category points entered by judges."
                : "Each criterion uses its own score range (0 to max). Weighted score is the average of (criterion score × weight)."}
              {" "}Feedback is shown exactly as judges entered it.
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
                    <th className="px-3 py-2 text-left">Raw Total</th>
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
                      <td className="px-3 py-2">
                        {Number(r.total || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        {Number(pointTotals ? r.total : r.weightedTotal || 0).toFixed(
                          2
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800 dark:text-gray-100 border border-gray-200/70 dark:border-white/10 rounded-md px-2 py-1 bg-gray-50/70 dark:bg-white/5">
                          {r.feedback || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.createdAt?.toDate
                          ? r.createdAt.toDate().toLocaleString()
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
